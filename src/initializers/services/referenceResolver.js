// src/initializers/services/referenceResolver.js
// --- TYPE IMPORTS ---
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../data/schemas/entity-definition.schema.json').EntityDefinition} EntityDefinition */
/** @typedef {import('../../entities/entity.js').default} Entity */

// --- LIBRARY IMPORTS ---
import _get from 'lodash/get.js';
// import _set from 'lodash/set.js'; // _set is not used

/**
 * @class ReferenceResolver
 * @classdesc This service is responsible for resolving definition IDs to instance IDs
 * within entity component data based on defined resolution strategies. It will be
 * used by WorldInitializer to decouple reference resolution logic.
 * THIS SERVICE IS BEING PHASED OUT as resolutionStrategy is deprecated.
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
   *
   * @param {object} dependencies - The dependencies for this service.
   * @param {EntityManager} dependencies.entityManager - The entity manager service, used to find entity instances by definition IDs.
   * @param {ILogger} dependencies.logger - The logging service, for diagnostic messages.
   * @throws {Error} If `entityManager` or `logger` dependency is missing.
   */
  constructor({ entityManager, logger }) {
    if (!entityManager) {
      throw new Error('ReferenceResolver requires an EntityManager.');
    }
    if (!logger) {
      throw new Error('ReferenceResolver requires an ILogger.');
    }
    this.#entityManager = entityManager; // Kept for now, but its use of getPrimaryInstanceByDefinitionId is removed.
    this.#logger = logger;
    this.#logger.warn(
      'ReferenceResolver: This service implements a deprecated pattern (resolutionStrategy). It will be removed in a future update. Ensure data uses direct instance IDs where needed.'
    );
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
      this.#logger.warn(
        `ReferenceResolver: Invalid resolveFields spec for component ${componentTypeId} on entity ${entityId}. Spec:`,
        spec
      );
      return {
        resolvedValue: undefined,
        valueChanged: false,
        dataPath: spec?.dataPath || null,
        dataPathIsSelf: spec?.dataPathIsSelf || false,
      };
    }

    const { dataPath, dataPathIsSelf = false, resolutionStrategy } = spec;
    let currentValue;
    let resolutionResult = { resolvedValue: undefined, valueChanged: false }; // Default result

    // For logging purposes, create a display string for the path
    const dataPathDisplay = `[${componentTypeId}]@'${dataPathIsSelf ? '(self)' : dataPath}'`;

    this.#logger.debug(
      `ReferenceResolver: Processing ${dataPathDisplay} for entity ${entityId} with strategy ${resolutionStrategy.type}. This pattern is deprecated.`
    );

    if (dataPathIsSelf) {
      currentValue = componentDataInstance;
    } else if (typeof dataPath === 'string' && dataPath.trim() !== '') {
      currentValue = _get(componentDataInstance, dataPath);
    } else {
      this.#logger.warn(
        `ReferenceResolver: Invalid dataPath in resolveFields spec for ${dataPathDisplay} on entity ${entityId}. Spec:`,
        spec
      );
      return {
        resolvedValue: undefined,
        valueChanged: false,
        dataPath,
        dataPathIsSelf,
      };
    }

    if (currentValue === undefined && !dataPathIsSelf && dataPath) {
      this.#logger.debug(
        `ReferenceResolver: No value at path '${dataPath}' for component ${componentTypeId} on entity ${entityId}. Skipping resolution for this field.`
      );
      return {
        resolvedValue: undefined,
        valueChanged: false,
        dataPath,
        dataPathIsSelf,
      };
    }

    switch (resolutionStrategy.type) {
      case 'direct':
        resolutionResult = this._resolveDirect(
          currentValue,
          entityId,
          componentTypeId,
          dataPathDisplay
        );
        break;
      case 'arrayOfDefinitionIds':
        resolutionResult = this._resolveArrayOfDefinitionIds(
          currentValue,
          entityId,
          componentTypeId,
          dataPathDisplay
        );
        break;
      case 'arrayOfObjects':
        resolutionResult = this._resolveArrayOfObjects(
          currentValue,
          spec, // _resolveArrayOfObjects needs the 'spec' for 'idField'
          entityId,
          componentTypeId,
          dataPathDisplay
        );
        break;
      default:
        this.#logger.warn(
          `ReferenceResolver: Unknown resolutionStrategy type '${resolutionStrategy.type}' for ${dataPathDisplay} on entity ${entityId}.`
        );
        // Ensure original value is part of the result for unknown strategy, and valueChanged is false.
        resolutionResult = { resolvedValue: currentValue, valueChanged: false };
        break;
    }

    return { ...resolutionResult, dataPath, dataPathIsSelf };
  }

  /**
   * Was: Resolves a direct definition ID to an instance ID.
   * Now: Logs a warning and returns the original value, as this resolution is deprecated.
   *
   * @param currentValue
   * @param entityId
   * @param componentTypeId
   * @param dataPathDisplay
   * @private
   */
  _resolveDirect(currentValue, entityId, componentTypeId, dataPathDisplay) {
    if (typeof currentValue === 'string' && currentValue.includes(':')) {
      this.#logger.warn(
        `ReferenceResolver (Deprecated): Attempted 'direct' resolution for ${dataPathDisplay} on entity ${entityId} with value '${currentValue}'. Data should use direct instance IDs. Returning original value.`
      );
    }
    // No change is made; the value should already be an instanceId if it refers to a specific entity,
    // or it's a definitionId for other purposes (e.g. spawner type) and shouldn't be changed.
    return { resolvedValue: currentValue, valueChanged: false };
  }

  /**
   * Was: Resolves an array of definition IDs to an array of instance IDs.
   * Now: Logs warnings and returns the original array, as this resolution is deprecated.
   *
   * @param currentValue
   * @param entityId
   * @param componentTypeId
   * @param dataPathDisplay
   * @private
   */
  _resolveArrayOfDefinitionIds(
    currentValue,
    entityId,
    componentTypeId,
    dataPathDisplay
  ) {
    if (Array.isArray(currentValue)) {
      currentValue.forEach((item, index) => {
        if (typeof item === 'string' && item.includes(':')) {
          this.#logger.warn(
            `ReferenceResolver (Deprecated): Attempted 'arrayOfDefinitionIds' resolution for item '${item}' at ${dataPathDisplay}[${index}] on entity ${entityId}. Data should use direct instance IDs. Original value kept.`
          );
        }
      });
    }
    // No change is made to the array elements.
    return { resolvedValue: currentValue, valueChanged: false };
  }

  /**
   * Was: Resolves definition IDs within a specified field of objects in an array.
   * Now: Logs warnings and returns the original array, as this resolution is deprecated.
   *
   * @param currentValue
   * @param spec
   * @param entityId
   * @param componentTypeId
   * @param dataPathDisplay
   * @private
   */
  _resolveArrayOfObjects(
    currentValue,
    spec,
    entityId,
    componentTypeId,
    dataPathDisplay
  ) {
    const idField = spec?.resolutionStrategy?.idField;
    if (!idField) {
      this.#logger.warn(
        `ReferenceResolver (Deprecated): 'arrayOfObjects' resolution for ${dataPathDisplay} on entity ${entityId} is missing 'idField' in strategy. Cannot process.`
      );
      return { resolvedValue: currentValue, valueChanged: false };
    }

    if (Array.isArray(currentValue)) {
      currentValue.forEach((obj, index) => {
        if (obj && typeof obj === 'object') {
          const valToResolve = _get(obj, idField);
          if (typeof valToResolve === 'string' && valToResolve.includes(':')) {
            this.#logger.warn(
              `ReferenceResolver (Deprecated): Attempted 'arrayOfObjects' resolution for idField '${idField}' (value: '${valToResolve}') in object at ${dataPathDisplay}[${index}] on entity ${entityId}. Data should use direct instance IDs. Original value kept.`
            );
          }
        }
      });
    }
    // No change is made to the objects or their specified fields.
    return { resolvedValue: currentValue, valueChanged: false };
  }
}

export default ReferenceResolver;
