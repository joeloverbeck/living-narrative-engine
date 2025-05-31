// src/initializers/services/referenceResolver.js
// --- TYPE IMPORTS ---
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../data/schemas/entity.schema.json').EntityDefinition} EntityDefinition */
/** @typedef {import('../../entities/entity.js').default} Entity */

// --- LIBRARY IMPORTS ---
import _get from 'lodash/get.js';
import _set from 'lodash/set.js';

/**
 * @class ReferenceResolver
 * @classdesc This service is responsible for resolving definition IDs to instance IDs
 * within entity component data based on defined resolution strategies. It will be
 * used by WorldInitializer to decouple reference resolution logic.
 */
class ReferenceResolver {
    /** @type {EntityManager} */
    #entityManager;
    /** @type {ILogger} */
    #logger;

    /**
     * Creates an instance of ReferenceResolver.
     * This service is responsible for resolving definition IDs to instance IDs
     * within component data based on defined resolution strategies.
     * @param {object} dependencies - The dependencies for this service.
     * @param {EntityManager} dependencies.entityManager - The entity manager service, used to find entity instances by definition IDs.
     * @param {ILogger} dependencies.logger - The logging service, for diagnostic messages.
     * @throws {Error} If `entityManager` or `logger` dependency is missing.
     */
    constructor({entityManager, logger}) {
        if (!entityManager) {
            throw new Error('ReferenceResolver requires an EntityManager.');
        }
        if (!logger) {
            throw new Error('ReferenceResolver requires an ILogger.');
        }
        this.#entityManager = entityManager;
        this.#logger = logger;
        // Optional: this.#logger.info('ReferenceResolver: Instance created.');
    }

    /**
     * Resolves definition IDs in component data based on a resolution specification.
     * This is the main public method for this service.
     *
     * @param {object} componentDataInstance - The data instance of the component.
     * @param {object} spec - The resolution specification from componentDefinition.resolveFields.
     * Expected to have properties like `dataPath`, `dataPathIsSelf`, `resolutionStrategy`.
     * @param {string} entityId - The ID of the entity being processed (for logging and context).
     * @param {string} componentTypeId - The ID of the component type being processed (for logging and context).
     * @returns {{resolvedValue: any, valueChanged: boolean, dataPath: string|null, dataPathIsSelf: boolean}}
     * An object containing the resolved value (if changed), a flag indicating if a change occurred,
     * and the original dataPath and dataPathIsSelf from the spec.
     */
    resolve(componentDataInstance, spec, entityId, componentTypeId) {
        if (!spec || !spec.resolutionStrategy) {
            this.#logger.warn(`ReferenceResolver: Invalid resolveFields spec for component ${componentTypeId} on entity ${entityId}. Spec:`, spec);
            return {
                resolvedValue: undefined,
                valueChanged: false,
                dataPath: spec?.dataPath || null,
                dataPathIsSelf: spec?.dataPathIsSelf || false
            };
        }

        const {dataPath, dataPathIsSelf = false, resolutionStrategy} = spec;
        let currentValue;
        let resolutionResult = {resolvedValue: undefined, valueChanged: false}; // Default result

        // For logging purposes, create a display string for the path
        const dataPathDisplay = `[${componentTypeId}]@'${dataPathIsSelf ? '(self)' : dataPath}'`;

        if (dataPathIsSelf) {
            currentValue = componentDataInstance;
        } else if (typeof dataPath === 'string' && dataPath.trim() !== '') {
            currentValue = _get(componentDataInstance, dataPath);
        } else {
            this.#logger.warn(`ReferenceResolver: Invalid dataPath in resolveFields spec for ${dataPathDisplay} on entity ${entityId}. Spec:`, spec);
            return {resolvedValue: undefined, valueChanged: false, dataPath, dataPathIsSelf};
        }

        // If currentValue is undefined at a specific path (and not dataPathIsSelf),
        // it means the path doesn't exist or explicitly holds undefined. Nothing to resolve further.
        if (currentValue === undefined && !dataPathIsSelf && dataPath) {
            // Not an error, just nothing to do for this specific field.
            this.#logger.debug(`ReferenceResolver: No value at path '${dataPath}' for component ${componentTypeId} on entity ${entityId}. Skipping resolution for this field.`);
            return {resolvedValue: undefined, valueChanged: false, dataPath, dataPathIsSelf};
        }

        switch (resolutionStrategy.type) {
            case "direct":
                resolutionResult = this._resolveDirect(currentValue, entityId, componentTypeId, dataPathDisplay);
                break;
            case "arrayOfDefinitionIds":
                resolutionResult = this._resolveArrayOfDefinitionIds(currentValue, entityId, componentTypeId, dataPathDisplay);
                break;
            case "arrayOfObjects":
                // Note: _resolveArrayOfObjects needs the 'spec' for 'idField'
                resolutionResult = this._resolveArrayOfObjects(currentValue, spec, entityId, componentTypeId, dataPathDisplay);
                break;
            default:
                this.#logger.warn(`ReferenceResolver: Unknown resolutionStrategy type '${resolutionStrategy.type}' for ${dataPathDisplay} on entity ${entityId}.`);
        }

        return {...resolutionResult, dataPath, dataPathIsSelf};
    }

    /**
     * Resolves a direct definition ID to an instance ID.
     * @param {string} currentValue - The current value, expected to be a definition ID string.
     * @param {string} entityId - ID of the entity being processed (for logging).
     * @param {string} componentTypeId - ID of the component being processed (for logging).
     * @param {string} dataPathDisplay - String representing the component and path (e.g., "[compType]@'path'") (for logging).
     * @returns {{resolvedValue: string|undefined, valueChanged: boolean}}
     * @private
     */
    _resolveDirect(currentValue, entityId, componentTypeId, dataPathDisplay) {
        let resolvedValue = undefined;
        let valueChanged = false;
        if (typeof currentValue === 'string' && currentValue.includes(':')) {
            const targetInstance = this.#entityManager.getPrimaryInstanceByDefinitionId(currentValue);
            if (targetInstance) {
                if (targetInstance.id !== currentValue) {
                    resolvedValue = targetInstance.id;
                    valueChanged = true;
                    this.#logger.debug(`ReferenceResolver: Resolved ${dataPathDisplay} for entity ${entityId}: '${currentValue}' -> '${resolvedValue}'.`);
                } else {
                    resolvedValue = targetInstance.id; // Ensure it's the instance ID
                    // Handles case where input might be subtly different (e.g. string object) but resolves to same ID value
                    if (currentValue !== targetInstance.id) valueChanged = true;
                }
            } else {
                this.#logger.warn(`ReferenceResolver: Could not resolve ${dataPathDisplay} definitionId '${currentValue}' for entity ${entityId}.`);
            }
        }
        return {resolvedValue, valueChanged};
    }

    /**
     * Resolves an array of definition IDs to an array of instance IDs.
     * @param {string[]} currentValue - The array of definition IDs.
     * @param {string} entityId - ID of the entity (for logging).
     * @param {string} componentTypeId - ID of the component (for logging).
     * @param {string} dataPathDisplay - String representing the component and path (for logging).
     * @returns {{resolvedValue: string[]|undefined, valueChanged: boolean}}
     * @private
     */
    _resolveArrayOfDefinitionIds(currentValue, entityId, componentTypeId, dataPathDisplay) {
        let resolvedValue = undefined;
        let valueChanged = false;
        if (Array.isArray(currentValue)) {
            const originalArray = [...currentValue]; // Keep a shallow copy for comparison
            const resolvedArrayValues = currentValue.map((defId, index) => {
                const itemPathDisplay = `${dataPathDisplay}[${index}]`;
                if (typeof defId === 'string' && defId.includes(':')) {
                    const targetInstance = this.#entityManager.getPrimaryInstanceByDefinitionId(defId);
                    if (targetInstance) {
                        if (targetInstance.id !== defId) { // Log only if it actually changed
                            this.#logger.debug(`ReferenceResolver: Resolved ${itemPathDisplay} for entity ${entityId}: '${defId}' -> '${targetInstance.id}'.`);
                        }
                        return targetInstance.id;
                    } else {
                        this.#logger.warn(`ReferenceResolver: Could not resolve ${itemPathDisplay} definitionId '${defId}' for entity ${entityId}.`);
                        return defId; // Return original if not resolved
                    }
                }
                return defId; // Return original if not a definition ID string
            });

            // Check if any value in the array actually changed
            if (originalArray.some((val, i) => val !== resolvedArrayValues[i])) {
                resolvedValue = resolvedArrayValues;
                valueChanged = true;
            } else if (originalArray.length === resolvedArrayValues.length) {
                // If values are the same but it's a new array object (due to .map()), assign it.
                // This handles cases where the caller might expect a new array if processing occurred.
                resolvedValue = resolvedArrayValues;
            }
        }
        return {resolvedValue, valueChanged};
    }

    /**
     * Resolves definition IDs within a specified field of objects in an array.
     * @param {object[]} currentValue - The array of objects.
     * @param {object} spec - The resolution specification, containing `resolutionStrategy.idField`.
     * @param {string} entityId - ID of the entity (for logging).
     * @param {string} componentTypeId - ID of the component (for logging).
     * @param {string} dataPathDisplay - String representing the component and path (for logging).
     * @returns {{resolvedValue: object[]|undefined, valueChanged: boolean}}
     * @private
     */
    _resolveArrayOfObjects(currentValue, spec, entityId, componentTypeId, dataPathDisplay) {
        let resolvedValue = undefined;
        let valueChanged = false; // Overall flag if any object's critical ID field was changed

        if (Array.isArray(currentValue) && spec.resolutionStrategy && typeof spec.resolutionStrategy.idField === 'string') {
            const idField = spec.resolutionStrategy.idField;
            let arrayHadChanges = false; // Tracks if any object instance in the array is new/modified

            const tempArray = currentValue.map((obj, index) => {
                let currentItem = obj; // Assume item won't change unless explicitly modified
                const itemPathDisplay = `${dataPathDisplay}[${index}].${idField}`;

                if (typeof obj === 'object' && obj !== null) {
                    const definitionId = _get(obj, idField);

                    if (typeof definitionId === 'string' && definitionId.includes(':')) {
                        const targetInstance = this.#entityManager.getPrimaryInstanceByDefinitionId(definitionId);
                        if (targetInstance) {
                            // Only create new object and mark changed if ID actually differs
                            if (targetInstance.id !== definitionId) {
                                const newObj = {...obj}; // Shallow clone
                                _set(newObj, idField, targetInstance.id);
                                currentItem = newObj;
                                valueChanged = true; // A meaningful ID resolution occurred
                                arrayHadChanges = true; // An object in the array was modified/replaced
                                this.#logger.debug(`ReferenceResolver: Resolved ${itemPathDisplay} for entity ${entityId}: '${definitionId}' -> '${targetInstance.id}'.`);
                            } else {
                                // Definition ID resolved to the same instance ID string value.
                                // Check if the actual field value needs updating (e.g., it was a String object, not primitive)
                                if (_get(obj, idField) !== targetInstance.id) {
                                    const newObj = {...obj}; // Shallow clone
                                    _set(newObj, idField, targetInstance.id);
                                    currentItem = newObj;
                                    arrayHadChanges = true; // An object in the array was modified/replaced
                                    // valueChanged remains false here as the *resolved ID* is the same.
                                }
                            }
                        } else {
                            this.#logger.warn(`ReferenceResolver: Could not resolve ${itemPathDisplay} definitionId '${definitionId}' for entity ${entityId}.`);
                        }
                    }
                }
                return currentItem;
            });

            if (valueChanged || arrayHadChanges) {
                resolvedValue = tempArray;
            }
        }
        return {resolvedValue, valueChanged};
    }
}

export default ReferenceResolver;