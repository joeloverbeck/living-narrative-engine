// src/initializers/worldInitializer.js
// --- FILE START ---
// --- Type Imports ---
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../interfaces/IWorldContext.js').default} IWorldContext */
/** @typedef {import('../services/gameDataRepository.js').default} GameDataRepository */
/** @typedef {import('../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../../data/schemas/entity.schema.json').EntityDefinition} EntityDefinition */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/coreServices.js').ISpatialIndexManager} ISpatialIndexManager */
/** @typedef {import('../entities/entity.js').default} Entity */

// --- Library Imports ---
import _get from 'lodash/get.js';
import _set from 'lodash/set.js';

// --- Constant Imports ---
import {POSITION_COMPONENT_ID} from '../constants/componentIds.js';

/**
 * Service responsible for instantiating entities defined
 * in the world data, resolving their references (e.g., location IDs),
 * and building the spatial index. Runs after GameStateInitializer.
 * Dispatches events related to world entity initialization.
 */
class WorldInitializer {
    /** @type {EntityManager} */
    #entityManager;
    /** @type {IWorldContext} */
    #worldContext;
    /** @type {GameDataRepository} */
    #repository;
    /** @type {ValidatedEventDispatcher} */
    #validatedEventDispatcher;
    /** @type {ILogger} */
    #logger;
    /** @type {ISpatialIndexManager} */
    #spatialIndexManager;

    /**
     * Creates an instance of WorldInitializer.
     * @param {object} dependencies
     * @param {EntityManager} dependencies.entityManager
     * @param {IWorldContext} dependencies.worldContext
     * @param {GameDataRepository} dependencies.gameDataRepository
     * @param {ValidatedEventDispatcher} dependencies.validatedEventDispatcher
     * @param {ILogger} dependencies.logger
     * @param {ISpatialIndexManager} dependencies.spatialIndexManager
     * @throws {Error} If any required dependency is missing or invalid.
     */
    constructor({
                    entityManager,
                    worldContext,
                    gameDataRepository,
                    validatedEventDispatcher,
                    logger,
                    spatialIndexManager
                }) {
        if (!entityManager) throw new Error('WorldInitializer requires an EntityManager.');
        if (!worldContext) throw new Error('WorldInitializer requires a WorldContext.');
        if (!gameDataRepository) throw new Error('WorldInitializer requires a GameDataRepository.');
        if (!validatedEventDispatcher) throw new Error('WorldInitializer requires a ValidatedEventDispatcher.');
        if (!logger) throw new Error('WorldInitializer requires an ILogger.');
        if (!spatialIndexManager) throw new Error('WorldInitializer requires an ISpatialIndexManager.');

        this.#entityManager = entityManager;
        this.#worldContext = worldContext;
        this.#repository = gameDataRepository;
        this.#validatedEventDispatcher = validatedEventDispatcher;
        this.#logger = logger;
        this.#spatialIndexManager = spatialIndexManager;

        this.#logger.info('WorldInitializer: Instance created.');
    }

    /**
     * Instantiates initial world entities from definitions, resolves references (like location IDs),
     * and builds the spatial index.
     * Dispatches 'initialization:world_initializer:started/completed/failed' events.
     * Dispatches finer-grained 'worldinit:entity_instantiated' and 'worldinit:entity_instantiation_failed' events.
     * @returns {Promise<boolean>} Resolves with true if successful.
     * @throws {Error} If a critical error occurs during initialization.
     */
    async initializeWorldEntities() {
        this.#logger.info('WorldInitializer: Starting world entity initialization process...');
        // Dispatch 'initialization:world_initializer:started' if you have such an event
        let totalInstantiatedCount = 0;
        /** @type {Entity[]} */
        const instantiatedEntities = [];

        try {
            // --- PASS 1: Instantiate all entities from definitions ---
            this.#logger.info('WorldInitializer (Pass 1): Instantiating entities from definitions...');
            const allEntityDefinitions = this.#repository.getAllEntityDefinitions?.() || [];

            if (allEntityDefinitions.length === 0) {
                this.#logger.warn('WorldInitializer (Pass 1): No entity definitions found. World may be empty of defined entities.');
            }

            for (const entityDef of allEntityDefinitions) {
                if (!entityDef || !entityDef.id) {
                    this.#logger.warn('WorldInitializer (Pass 1): Skipping invalid entity definition (missing or empty id):', entityDef);
                    continue;
                }
                const definitionId = entityDef.id;
                const instance = this.#entityManager.createEntityInstance(definitionId);

                if (instance) {
                    this.#logger.info(`WorldInitializer (Pass 1): Instantiated entity ${instance.id} (from definition: ${instance.definitionId})`);
                    instantiatedEntities.push(instance);
                    totalInstantiatedCount++;

                    this.#validatedEventDispatcher.dispatchValidated(
                        'worldinit:entity_instantiated',
                        {entityId: instance.id, definitionId: instance.definitionId, reason: 'Initial World Load'},
                        {allowSchemaNotFound: true}
                    ).catch(e => this.#logger.error(`Failed dispatching entity_instantiated event for ${instance.id}`, e));
                } else {
                    this.#logger.warn(`WorldInitializer (Pass 1): Failed to instantiate entity from definition: ${definitionId}.`);
                    this.#validatedEventDispatcher.dispatchValidated('worldinit:entity_instantiation_failed', {
                        definitionId: definitionId,
                        reason: 'Initial World Load'
                    }, {allowSchemaNotFound: true}).catch(e => this.#logger.error(`Failed dispatching entity_instantiation_failed for ${definitionId}`, e));
                }
            }
            this.#logger.info(`WorldInitializer (Pass 1): Completed. Instantiated ${totalInstantiatedCount} total entities.`);

            // --- PASS 2: Resolve references based on component metadata and populate spatial index ---
            this.#logger.info('WorldInitializer (Pass 2): Resolving component references and populating spatial index...');
            let entitiesAddedToSpatialIndex = 0;

            for (const entity of instantiatedEntities) {
                // Check if the entity is valid and has the methods we need from the Entity class
                if (!entity || typeof entity.componentEntries !== 'function' || typeof entity.addComponent !== 'function' || typeof entity.getComponentData !== 'function') {
                    this.#logger.error(`WorldInitializer (Pass 2): Entity ${entity?.id || 'Unknown ID'} is invalid or missing required component access methods. Skipping reference resolution for this entity.`);
                    continue;
                }

                // Iterate over component entries using the Entity's public API
                for (const [componentTypeId, componentDataInstance] of entity.componentEntries()) {
                    const componentDefinition = this.#repository.getComponentDefinition(componentTypeId);

                    if (componentDefinition?.resolveFields && Array.isArray(componentDefinition.resolveFields)) {
                        for (const spec of componentDefinition.resolveFields) {
                            if (!spec || !spec.resolutionStrategy) {
                                this.#logger.warn(`WorldInitializer (Pass 2): Invalid resolveFields spec for component ${componentTypeId} on entity ${entity.id}`, spec);
                                continue;
                            }

                            const {dataPath, dataPathIsSelf = false, resolutionStrategy} = spec;
                            let currentValue;
                            let valueChanged = false;
                            let newValue = undefined; // Initialize to undefined

                            if (dataPathIsSelf) {
                                currentValue = componentDataInstance;
                            } else if (typeof dataPath === 'string' && dataPath.trim() !== '') {
                                currentValue = _get(componentDataInstance, dataPath);
                            } else {
                                this.#logger.warn(`WorldInitializer (Pass 2): Invalid dataPath in resolveFields spec for ${componentTypeId} on entity ${entity.id}:`, spec);
                                continue;
                            }

                            if (currentValue === undefined && !dataPathIsSelf && dataPath) {
                                // this.#logger.debug(`WorldInitializer (Pass 2): Path '${dataPath}' not found for ${componentTypeId} on entity ${entity.id}. Skipping resolution for this spec.`);
                                continue; // Value at path does not exist, nothing to resolve
                            }

                            switch (resolutionStrategy.type) {
                                case "direct":
                                    if (typeof currentValue === 'string' && currentValue.includes(':')) {
                                        const targetInstance = this.#entityManager.getPrimaryInstanceByDefinitionId(currentValue);
                                        if (targetInstance) {
                                            if (targetInstance.id !== currentValue) {
                                                newValue = targetInstance.id;
                                                valueChanged = true;
                                                this.#logger.debug(`WorldInitializer (Pass 2): Resolved [${componentTypeId}]@'${dataPathIsSelf ? '(self)' : dataPath}' for entity ${entity.id}: '${currentValue}' -> '${newValue}'.`);
                                            }
                                        } else {
                                            this.#logger.warn(`WorldInitializer (Pass 2): Could not resolve [${componentTypeId}]@'${dataPathIsSelf ? '(self)' : dataPath}' definitionId '${currentValue}' for entity ${entity.id}.`);
                                        }
                                    }
                                    break;

                                case "arrayOfDefinitionIds":
                                    if (Array.isArray(currentValue)) {
                                        const originalArray = [...currentValue]; // Shallow copy for comparison
                                        const resolvedArray = currentValue.map((defId, index) => {
                                            if (typeof defId === 'string' && defId.includes(':')) {
                                                const targetInstance = this.#entityManager.getPrimaryInstanceByDefinitionId(defId);
                                                if (targetInstance) {
                                                    if (targetInstance.id !== defId) {
                                                        this.#logger.debug(`WorldInitializer (Pass 2): Resolved [${componentTypeId}]@'${dataPathIsSelf ? '(self)' : dataPath}'[${index}] for entity ${entity.id}: '${defId}' -> '${targetInstance.id}'.`);
                                                        return targetInstance.id;
                                                    }
                                                    return targetInstance.id; // Return even if same, for consistency if array is rebuilt
                                                } else {
                                                    this.#logger.warn(`WorldInitializer (Pass 2): Could not resolve [${componentTypeId}]@'${dataPathIsSelf ? '(self)' : dataPath}'[${index}] definitionId '${defId}' for entity ${entity.id}.`);
                                                    return defId;
                                                }
                                            }
                                            return defId;
                                        });
                                        // Check if any element actually changed
                                        if (originalArray.some((val, i) => val !== resolvedArray[i])) {
                                            newValue = resolvedArray;
                                            valueChanged = true;
                                        }
                                    }
                                    break;

                                case "arrayOfObjects":
                                    if (Array.isArray(currentValue) && typeof resolutionStrategy.idField === 'string') {
                                        const idField = resolutionStrategy.idField;
                                        let itemChangedInArray = false;
                                        const tempArray = currentValue.map((obj, index) => {
                                            let currentItem = obj; // Start with original object
                                            if (typeof obj === 'object' && obj !== null) {
                                                const definitionId = _get(obj, idField);
                                                if (typeof definitionId === 'string' && definitionId.includes(':')) {
                                                    const targetInstance = this.#entityManager.getPrimaryInstanceByDefinitionId(definitionId);
                                                    if (targetInstance) {
                                                        if (targetInstance.id !== definitionId) {
                                                            const newObj = {...obj}; // Clone before modifying
                                                            _set(newObj, idField, targetInstance.id);
                                                            currentItem = newObj;
                                                            itemChangedInArray = true;
                                                            this.#logger.debug(`WorldInitializer (Pass 2): Resolved [${componentTypeId}]@'${dataPathIsSelf ? '(self)' : dataPath}'[${index}].${idField} for entity ${entity.id}: '${definitionId}' -> '${targetInstance.id}'.`);
                                                        }
                                                    } else {
                                                        this.#logger.warn(`WorldInitializer (Pass 2): Could not resolve [${componentTypeId}]@'${dataPathIsSelf ? '(self)' : dataPath}'[${index}].${idField} definitionId '${definitionId}' for entity ${entity.id}.`);
                                                    }
                                                }
                                            }
                                            return currentItem;
                                        });

                                        if (itemChangedInArray) {
                                            newValue = tempArray;
                                            valueChanged = true;
                                        }
                                    }
                                    break;
                                default:
                                    this.#logger.warn(`WorldInitializer (Pass 2): Unknown resolutionStrategy type '${resolutionStrategy.type}' for ${componentTypeId} on entity ${entity.id}.`);
                            }

                            if (valueChanged && newValue !== undefined) {
                                if (dataPathIsSelf) {
                                    // The componentDataInstance itself is being replaced.
                                    // Update it in the entity's internal map using its public method.
                                    entity.addComponent(componentTypeId, newValue);
                                    this.#logger.debug(`WorldInitializer (Pass 2): Updated component [${componentTypeId}] data directly for entity ${entity.id} via addComponent with new value.`);
                                } else {
                                    _set(componentDataInstance, dataPath, newValue);
                                    // This modifies the componentDataInstance obtained from the iterator.
                                    // Since componentDataInstance is an object stored in the Entity's map,
                                    // this modification will persist as long as the map holds references
                                    // to these objects (which it does, as they are cloned on initial add).
                                    this.#logger.debug(`WorldInitializer (Pass 2): Modified path '${dataPath}' in component [${componentTypeId}] for entity ${entity.id} to new value.`);
                                }
                            }
                        }
                    }
                } // End of component loop for an entity

                // --- Spatial Index Population (uses the now-resolved component data) ---
                // Assumes entity.getComponentData() correctly retrieves data from the Entity's internal map.
                const positionComponentData = entity.getComponentData(POSITION_COMPONENT_ID);
                let locationIdForSpatialIndex = null;

                if (positionComponentData && typeof positionComponentData.locationId === 'string' && positionComponentData.locationId.trim() !== '') {
                    locationIdForSpatialIndex = positionComponentData.locationId;

                    if (locationIdForSpatialIndex.includes(':')) {
                        this.#logger.warn(`WorldInitializer (Pass 2): Entity ${entity.id}'s position component locationId '${locationIdForSpatialIndex}' appears to be an unresolved definitionId. Spatial index might be incorrect.`);
                    }

                    if (locationIdForSpatialIndex) {
                        const locationEntity = this.#entityManager.getEntityInstance(locationIdForSpatialIndex);
                        if (locationEntity || !locationIdForSpatialIndex.includes(':')) {
                            this.#spatialIndexManager.addEntity(entity.id, locationIdForSpatialIndex);
                            entitiesAddedToSpatialIndex++;
                            this.#logger.debug(`WorldInitializer (Pass 2): Added entity ${entity.id} to spatial index at location ${locationIdForSpatialIndex}.`);
                        } else {
                            this.#logger.warn(`WorldInitializer (Pass 2): Entity ${entity.id} locationId '${locationIdForSpatialIndex}' not added to spatial index because it's an unresolved definitionId or unknown instance.`);
                        }
                    } else {
                        this.#logger.warn(`WorldInitializer (Pass 2): Entity ${entity.id} has position component but final locationId is invalid or null. Not added to spatial index.`);
                    }
                } else if (positionComponentData) {
                    this.#logger.debug(`WorldInitializer (Pass 2): Entity ${entity.id} has a position component but missing or invalid locationId after resolution. Not added to spatial index.`);
                } else {
                    this.#logger.debug(`WorldInitializer (Pass 2): Entity ${entity.id} has no position component. Not added to spatial index.`);
                }
            } // End of for (const entity of instantiatedEntities)

            this.#logger.info(`WorldInitializer (Pass 2): Completed. Processed ${instantiatedEntities.length} entities for linking. Added ${entitiesAddedToSpatialIndex} entities to spatial index.`);

            this.#logger.info('WorldInitializer: World entity initialization and spatial indexing complete.');
            // Dispatch 'initialization:world_initializer:completed' event if you have one.
            return true;

        } catch (error) {
            this.#logger.error('WorldInitializer: CRITICAL ERROR during entity initialization or reference resolution:', error);
            // Dispatch 'initialization:world_initializer:failed' event if you have one.
            throw error;
        }
    }
}

export default WorldInitializer;
// --- FILE END ---