// src/entities/entityManager.js
// -----------------------------------------------------------------------------
//  Living Narrative Engine – EntityManager
// -----------------------------------------------------------------------------
//  @description
//  Centralised factory and runtime registry for all Entity instances. Handles
//  validation of component payloads, automatic injection of required defaults
//  (e.g. `core:short_term_memory`, `core:notes`) and co-ordination with the
//  spatial-index service.
//
//  @module EntityManager
//  @since   0.3.0
// -----------------------------------------------------------------------------

import {v4 as uuidv4} from 'uuid';
import Entity from './entity.js';
import {
    ACTOR_COMPONENT_ID,
    POSITION_COMPONENT_ID,
    SHORT_TERM_MEMORY_COMPONENT_ID,
    NOTES_COMPONENT_ID,
} from '../constants/componentIds.js';
import {IEntityManager} from '../interfaces/IEntityManager.js';

/* -------------------------------------------------------------------------- */
/* Type-Hint Imports (JSDoc only – removed at runtime)                        */
/* -------------------------------------------------------------------------- */

/** @typedef {import('../interfaces/coreServices.js').IDataRegistry}         IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator}      ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').ILogger}               ILogger */
/** @typedef {import('../interfaces/coreServices.js').ISpatialIndexManager}  ISpatialIndexManager */
/** @typedef {import('../interfaces/coreServices.js').ValidationResult}      ValidationResult */

/* -------------------------------------------------------------------------- */
/* Internal Utilities                                                         */

/* -------------------------------------------------------------------------- */

/**
 * Normalise any validator return shape to a simple `true | false`.
 *
 * Legacy validators may return `undefined`, `null`, or a bare boolean. Newer
 * validators should return `{ isValid: boolean, errors?: any }`.
 *
 * @private
 * @param {undefined|null|boolean|ValidationResult} rawResult
 * @returns {boolean}
 */
function validationSucceeded(rawResult) {
    if (rawResult === undefined || rawResult === null) return true;
    if (typeof rawResult === 'boolean') return rawResult;
    return !!rawResult.isValid;
}

/* -------------------------------------------------------------------------- */
/* EntityManager Implementation                                               */

/* -------------------------------------------------------------------------- */

/**
 * @class EntityManager
 * @extends {IEntityManager}
 *
 * @description
 * Runtime manager responsible for:
 *  • Instantiating entities from definitions
 *  • Validating and mutating component payloads
 *  • Injecting engine-level default components
 *  • Tracking active entities and their primary instances
 *  • Propagating position changes to the spatial index
 */
class EntityManager extends IEntityManager {
    /** @type {IDataRegistry}  @private */           #registry;
    /** @type {ISchemaValidator} @private */         #validator;
    /** @type {ILogger} @private */                  #logger;
    /** @type {ISpatialIndexManager} @private */     #spatialIndexManager;

    /** @type {Map<string, Entity>} */
    activeEntities = new Map();

    /** @type {Map<string, string>}  @private */
    #definitionToPrimaryInstanceMap;

    /**
     * @constructor
     * @param {IDataRegistry}        registry
     * @param {ISchemaValidator}     validator
     * @param {ILogger}              logger
     * @param {ISpatialIndexManager} spatialIndexManager
     * @throws {Error} If any dependency is missing or malformed.
     */
    constructor(registry, validator, logger, spatialIndexManager) {
        super();

        /* ---------- dependency checks ---------- */
        if (!registry || typeof registry.getEntityDefinition !== 'function') {
            throw new Error(
                'EntityManager requires an IDataRegistry instance with getEntityDefinition.'
            );
        }
        if (!validator || typeof validator.validate !== 'function') {
            throw new Error(
                'EntityManager requires an ISchemaValidator instance with validate.'
            );
        }
        if (
            !logger ||
            typeof logger.info !== 'function' ||
            typeof logger.error !== 'function' ||
            typeof logger.warn !== 'function' ||
            typeof logger.debug !== 'function'
        ) {
            throw new Error(
                'EntityManager requires an ILogger instance with info, error, warn, and debug methods.'
            );
        }
        if (
            !spatialIndexManager ||
            typeof spatialIndexManager.updateEntityLocation !== 'function' ||
            typeof spatialIndexManager.removeEntity !== 'function' ||
            typeof spatialIndexManager.addEntity !== 'function'
        ) {
            throw new Error(
                'EntityManager requires an ISpatialIndexManager instance with addEntity, removeEntity, and updateEntityLocation.'
            );
        }

        this.#registry = registry;
        this.#validator = validator;
        this.#logger = logger;
        this.#spatialIndexManager = spatialIndexManager;
        this.#definitionToPrimaryInstanceMap = new Map();

        this.#logger.info('EntityManager initialised.');
    }

    /* ---------------------------------------------------------------------- */
    /* Entity Creation                                                         */

    /* ---------------------------------------------------------------------- */

    /**
     * Create a new Entity instance from its definition.
     *
     * @param {string}  definitionId
     * @param {?string} [instanceId=null]
     * @param {boolean} [forceNew=false]
     * @returns {?Entity}
     */
    createEntityInstance(definitionId, instanceId = null, forceNew = false) {
        if (!definitionId || typeof definitionId !== 'string') {
            this.#logger.error(
                `EntityManager.createEntityInstance: Invalid definitionId provided: ${definitionId}`
            );
            return null;
        }

        const actualInstanceId = instanceId || uuidv4();
        if (!actualInstanceId || typeof actualInstanceId !== 'string') {
            this.#logger.error('createEntityInstance: invalid/generated instanceId.');
            return null;
        }

        if (!forceNew && this.activeEntities.has(actualInstanceId)) {
            this.#logger.debug(
                `EntityManager.createEntityInstance: Returning existing instance for ID: ${actualInstanceId}`
            );
            return this.activeEntities.get(actualInstanceId);
        }

        const entityDefinition = this.#registry.getEntityDefinition(definitionId);
        if (!entityDefinition) {
            this.#logger.error(
                `EntityManager.createEntityInstance: Entity definition not found for ID: ${definitionId}`
            );
            return null;
        }

        entityDefinition.components =
            entityDefinition.components && typeof entityDefinition.components === 'object'
                ? entityDefinition.components
                : {};

        let entity;
        try {
            entity = new Entity(actualInstanceId, definitionId);

            /* --- copy + validate each component from definition --- */
            for (const [componentTypeId, componentData] of Object.entries(
                entityDefinition.components,
            )) {
                const dataClone = JSON.parse(JSON.stringify(componentData));

                const rawResult = this.#validator.validate(componentTypeId, dataClone);
                if (!validationSucceeded(rawResult)) {
                    const details =
                        typeof rawResult === 'object' && rawResult?.errors
                            ? JSON.stringify(rawResult.errors, null, 2)
                            : '(validator returned false)';
                    this.#logger.error(
                        `createEntityInstance: validation failed for '${componentTypeId}' on definition '${definitionId}'.\n${details}`,
                    );
                    throw new Error('Component validation failed during instantiation.');
                }

                entity.addComponent(componentTypeId, dataClone);
            }

            /* --- default injections --------------------------------------- */
            if (
                entity.hasComponent(ACTOR_COMPONENT_ID) &&
                !entity.hasComponent(SHORT_TERM_MEMORY_COMPONENT_ID)
            ) {
                const defaultStm = {thoughts: [], maxEntries: 10};
                if (
                    !validationSucceeded(
                        this.#validator.validate(
                            SHORT_TERM_MEMORY_COMPONENT_ID,
                            defaultStm,
                        ),
                    )
                ) {
                    throw new Error('Default STM validation failed.');
                }
                entity.addComponent(SHORT_TERM_MEMORY_COMPONENT_ID, defaultStm);
                this.#logger.debug(
                    `createEntityInstance: default 'core:short_term_memory' injected into ${actualInstanceId}.`,
                );
            }

            if (
                entity.hasComponent(ACTOR_COMPONENT_ID) &&
                !entity.hasComponent(NOTES_COMPONENT_ID)
            ) {
                const defaultNotes = {notes: []};
                if (
                    !validationSucceeded(
                        this.#validator.validate(NOTES_COMPONENT_ID, defaultNotes),
                    )
                ) {
                    throw new Error('Default core:notes validation failed.');
                }
                entity.addComponent(NOTES_COMPONENT_ID, defaultNotes);
                this.#logger.debug(
                    `createEntityInstance: default 'core:notes' injected into ${actualInstanceId}.`,
                );
            }

            /* --- bookkeeping --------------------------------------------- */
            if (!forceNew) {
                this.activeEntities.set(actualInstanceId, entity);
                if (!this.#definitionToPrimaryInstanceMap.has(definitionId)) {
                    this.#definitionToPrimaryInstanceMap.set(
                        definitionId,
                        actualInstanceId,
                    );
                }
            }

            this.#logger.info(
                `createEntityInstance: created '${actualInstanceId}' from '${definitionId}'.`,
            );
            return entity;
        } catch (err) {
            this.#logger.error('createEntityInstance: aborting due to error.', err);
            if (entity && this.activeEntities.get(actualInstanceId) === entity) {
                this.activeEntities.delete(actualInstanceId);
            }
            return null;
        }
    }

    /* ---------------------------------------------------------------------- */
    /* Component-level Mutations                                               */

    /* ---------------------------------------------------------------------- */

    /**
     * Add or overwrite a component on an existing entity.
     *
     * @param {string} instanceId
     * @param {string} componentTypeId
     * @param {object} componentData
     * @returns {boolean}
     * @throws {Error}
     */
    addComponent(instanceId, componentTypeId, componentData) {
        const entity = this.activeEntities.get(instanceId);
        if (!entity) {
            const msg = `EntityManager.addComponent: Entity not found with ID: ${instanceId}`;
            this.#logger.error(msg);
            throw new Error(msg);
        }

        const rawResult = this.#validator.validate(componentTypeId, componentData);
        if (!validationSucceeded(rawResult)) {
            const details =
                typeof rawResult === 'object' && rawResult?.errors
                    ? JSON.stringify(rawResult.errors, null, 2)
                    : '(validator returned false)';
            const msg = `EntityManager.addComponent: Component data validation failed for type '${componentTypeId}' on entity '${instanceId}'. Errors:\n${details}`;
            this.#logger.error(msg);
            throw new Error(
                `EntityManager.addComponent: Component data validation failed for type '${componentTypeId}' on entity '${instanceId}'.`,
            );
        }
        this.#logger.debug(
            `EntityManager.addComponent: validation passed for '${componentTypeId}' on '${instanceId}'.`,
        );

        /* --- positional bookkeeping ----------------------------------- */
        let oldLocationId = null;
        if (componentTypeId === POSITION_COMPONENT_ID) {
            oldLocationId =
                entity.getComponentData(POSITION_COMPONENT_ID)?.locationId;
            this.#logger.debug(
                `EntityManager.addComponent: Old location for entity ${instanceId} was ${
                    oldLocationId ?? 'null/undefined'
                }.`,
            );
        }

        /* --- mutate ---------------------------------------------------- */
        const clonedData = JSON.parse(JSON.stringify(componentData));
        entity.addComponent(componentTypeId, clonedData);
        this.#logger.debug(
            `EntityManager.addComponent: Successfully added/updated component '${componentTypeId}' data on entity '${instanceId}'.`,
        );

        /* --- spatial index update -------------------------------------- */
        if (componentTypeId === POSITION_COMPONENT_ID) {
            const newLocationId =
                entity.getComponentData(POSITION_COMPONENT_ID)?.locationId;
            this.#logger.debug(
                `EntityManager.addComponent: New location for entity ${instanceId} is ${
                    newLocationId ?? 'null/undefined'
                }. Updating spatial index.`,
            );

            if (
                newLocationId &&
                !this.activeEntities.has(newLocationId) &&
                newLocationId.includes(':')
            ) {
                this.#logger.warn(
                    `addComponent: '${instanceId}' given locationId '${newLocationId}' that looks like a definition ID.`,
                );
            }

            this.#spatialIndexManager.updateEntityLocation(
                instanceId,
                oldLocationId,
                newLocationId,
            );
        }

        return true;
    }

    /* ---------------------------------------------------------------------- */
    /* Query / Utility Methods                                                 */

    /* ---------------------------------------------------------------------- */

    getPrimaryInstanceByDefinitionId(definitionId) {
        const instanceId = this.#definitionToPrimaryInstanceMap.get(definitionId);
        if (instanceId) return this.activeEntities.get(instanceId);
        this.#logger.debug(
            `getPrimaryInstanceByDefinitionId: no primary for '${definitionId}'.`,
        );
        return undefined;
    }

    getEntityInstance(instanceId) {
        return this.activeEntities.get(instanceId);
    }

    /**
     * Remove a component from an existing entity.
     *
     * @param {string} instanceId          – UUID of the target entity.
     * @param {string} componentTypeId     – Component type to remove.
     * @returns {boolean}                  – `true` if the component was removed.
     */
    removeComponent(instanceId, componentTypeId) {
        const entity = this.activeEntities.get(instanceId);

        /* ---------- entity guard ---------- */
        if (!entity) {
            this.#logger.warn(
                `Entity not found with ID: ${instanceId}. Cannot remove component.`,
            );
            return false;
        }

        /* ---------- position bookkeeping (old location) ---------- */
        let oldLocationId = null;
        if (componentTypeId === POSITION_COMPONENT_ID) {
            oldLocationId = entity.getComponentData(POSITION_COMPONENT_ID)?.locationId;
            this.#logger.debug(
                `Removing position component from entity ${instanceId}. Old location was ${
                    oldLocationId ?? 'null/undefined'
                }.`,
            );
        }

        /* ---------- remove from entity ---------- */
        const removed = entity.removeComponent(componentTypeId);

        if (removed) {
            this.#logger.debug(
                `Successfully removed component '${componentTypeId}' from entity '${instanceId}'.`,
            );

            if (componentTypeId === POSITION_COMPONENT_ID) {
                /* propagate to spatial index */
                this.#spatialIndexManager.removeEntity(instanceId, oldLocationId);
                this.#logger.debug(
                    `Updated spatial index for entity ${instanceId} removal from location ${
                        oldLocationId ?? 'null/undefined'
                    }.`,
                );
            }
        } else {
            /* nothing to remove */
            this.#logger.debug(
                `Component '${componentTypeId}' not found on entity '${instanceId}'. Nothing removed.`,
            );
        }

        return removed;
    }

    getComponentData(instanceId, componentTypeId) {
        return this.activeEntities
            .get(instanceId)
            ?.getComponentData(componentTypeId);
    }

    hasComponent(instanceId, componentTypeId) {
        return !!this.activeEntities.get(instanceId)?.hasComponent(componentTypeId);
    }

    /**
     * Return **new array** of entities that possess `componentTypeId`.
     * Logs diagnostic info for engine analytics / debugging.
     *
     * @param {*} componentTypeId
     * @returns {Entity[]} fresh array (never a live reference)
     */
    getEntitiesWithComponent(componentTypeId) {
        /* Guard – bad input ---------------------------------------------------- */
        if (typeof componentTypeId !== 'string' || !componentTypeId) {
            this.#logger.debug(
                `EntityManager.getEntitiesWithComponent: Received invalid componentTypeId (${componentTypeId})`,
            );
            return [];
        }

        /* Gather matches ------------------------------------------------------- */
        const matching = [];
        for (const entity of this.activeEntities.values()) {
            if (entity.hasComponent(componentTypeId)) matching.push(entity);
        }

        /* Emit diagnostics ----------------------------------------------------- */
        this.#logger.debug(
            `EntityManager.getEntitiesWithComponent: Found ${matching.length} entities with component '${componentTypeId}'`,
        );

        return matching;            // already a brand-new array
    }

    /**
     * Retrieve the set of entity IDs currently inside a location instance.
     *
     * @param {string} locationInstanceId – UUID of the location entity.
     * @returns {Set<string>}             – Set of contained entity IDs.
     */
    getEntitiesInLocation(locationInstanceId) {
        return this.#spatialIndexManager.getEntitiesInLocation(locationInstanceId);
    }


    /**
     * Remove a single entity instance from runtime state (and spatial index).
     *
     * @param {string} instanceId – UUID of the entity to remove.
     * @returns {boolean}         – `true` if the entity was removed.
     */
    removeEntityInstance(instanceId) {
        const entity = this.activeEntities.get(instanceId);

        /* ---------- guard: missing entity ---------- */
        if (!entity) {
            this.#logger.warn(
                `Attempted to remove non-existent entity instance ${instanceId}`,
            );
            return false;
        }

        /* ---------- spatial-index bookkeeping ---------- */
        const oldLocationId =
            entity.getComponentData(POSITION_COMPONENT_ID)?.locationId ?? null;

        if (oldLocationId !== null && oldLocationId !== undefined) {
            this.#spatialIndexManager.removeEntity(instanceId, oldLocationId);
            this.#logger.debug(
                `Removed entity ${instanceId} from spatial index (location instanceId: ${oldLocationId}).`,
            );
        }

        /* ---------- maps & primary-instance bookkeeping ---------- */
        this.activeEntities.delete(instanceId);

        if (
            this.#definitionToPrimaryInstanceMap.get(entity.definitionId) ===
            instanceId
        ) {
            this.#definitionToPrimaryInstanceMap.delete(entity.definitionId);
        }

        /* ---------- final audit log ---------- */
        this.#logger.info(
            `Removed entity instance ${instanceId} from active map.`,
        );

        return true;
    }

    /**
     * Clear **all** runtime state — primarily for use in test harnesses.
     */
    clearAll() {
        this.activeEntities.clear();
        this.#definitionToPrimaryInstanceMap.clear();
        this.#spatialIndexManager.clearIndex();
        this.#logger.info(
            'EntityManager: Cleared all active entities, definition map, and delegated spatial index clearing.',
        );
    }
}

export default EntityManager;