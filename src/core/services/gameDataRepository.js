// src/core/services/gameDataRepository.js
// ────────────────────────────────────────────────────────────────────────────────

import {IGameDataRepository} from "../interfaces/IGameDataRepository.js";

/**
 * @class GameDataRepository
 * @extends {IGameDataRepository}
 * @implements {IGameDataRepository} // Explicitly documents that it fulfills the IGameDataRepository contract.
 * @description
 * Lightweight façade over whatever `IDataRegistry` implementation you are using.
 * The class does **not** cache anything internally: every getter reflects the
 * current contents of the registry so that late-loaded content (e.g. in tests or
 * when hot-reloading mods) is immediately visible.
 *
 * If you really want an in-memory cache, wrap this repository with your own
 * service – don’t put the cache here.
 *
 * @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../interfaces/coreServices.js').ILogger}        ILogger
 * @typedef {import('../../types/actionDefinition.js').ActionDefinition} ActionDefinition
 * @typedef {import('../../types/eventDefinition.js').EventDefinition} EventDefinition
 * @typedef {import('../../types/entityDefinition.js').EntityDefinition} EntityDefinition
 */
export class GameDataRepository extends IGameDataRepository {
    /** @type {IDataRegistry}  */ #registry;
    /** @type {ILogger}        */ #logger;

    /**
     * @param {IDataRegistry} registry
     * @param {ILogger}       logger
     */
    constructor(registry, logger) {
        super();
        // --- Validation ---
        if (!logger?.info || !logger?.warn || !logger?.error || !logger?.debug) {
            throw new Error('GameDataRepository requires a valid ILogger with info, warn, error, and debug methods.');
        }

        if (!registry ||
            typeof registry.getStartingPlayerId !== 'function' ||
            typeof registry.getStartingLocationId !== 'function' ||
            typeof registry.getActionDefinition !== 'function' ||
            typeof registry.getAllActionDefinitions !== 'function' ||
            typeof registry.getEntityDefinition !== 'function' ||
            typeof registry.getAllEntityDefinitions !== 'function' ||
            typeof registry.getEventDefinition !== 'function' ||
            typeof registry.getAllEventDefinitions !== 'function'
        ) {
            const missing = [
                !registry && 'registry object',
                !(registry?.getStartingPlayerId) && 'getStartingPlayerId',
                !(registry?.getStartingLocationId) && 'getStartingLocationId',
                !(registry?.getActionDefinition) && 'getActionDefinition',
                !(registry?.getAllActionDefinitions) && 'getAllActionDefinitions',
                !(registry?.getEntityDefinition) && 'getEntityDefinition',
                !(registry?.getAllEntityDefinitions) && 'getAllEntityDefinitions',
                !(registry?.getEventDefinition) && 'getEventDefinition',
                !(registry?.getAllEventDefinitions) && 'getAllEventDefinitions',
            ].filter(Boolean).join(', ');
            throw new Error(`GameDataRepository requires a valid IDataRegistry with specific methods. Missing or invalid: ${missing}.`);
        }

        this.#registry = registry;
        this.#logger = logger;

        this.#logger.info('GameDataRepository initialised (delegates to registry).');
    }

    // ────────────────────────────────────────────────────────────────────────────
    //  Manifest / World Info
    // ────────────────────────────────────────────────────────────────────────────

    /**
     * Retrieves the official name of the loaded world/game.
     * Assumes the name is stored in a manifest object in the registry.
     * @returns {string | null} The world name, or null if not found.
     */
    getWorldName() {
        // We used to get the world name through the world manifest, but no such manifest exists anymore.
        return "DEMO_WORLD";
    }

    /**
     * Retrieves the starting player ID from the manifest stored in the registry.
     * @returns {string | null} The starting player entity definition ID, or null if not found in the manifest.
     */
    getStartingPlayerId() {
        const playerId = this.#registry.getStartingPlayerId();
        if (!playerId) {
            this.#logger.warn('GameDataRepository: getStartingPlayerId called, but no ID found in registry/manifest.');
        }
        return playerId;
    }

    /**
     * Retrieves the starting location ID from the manifest stored in the registry.
     * @returns {string | null} The starting location entity definition ID, or null if not found in the manifest.
     */
    getStartingLocationId() {
        const locationId = this.#registry.getStartingLocationId();
        if (!locationId) {
            this.#logger.warn('GameDataRepository: getStartingLocationId called, but no ID found in registry/manifest.');
        }
        return locationId;
    }


    // ────────────────────────────────────────────────────────────────────────────
    //  Action definitions
    // ────────────────────────────────────────────────────────────────────────────

    /**
     * Return **all** `ActionDefinition` objects currently stored in the registry.
     * Delegates directly to the registry.
     *
     * @returns {ActionDefinition[]}
     */
    getAllActionDefinitions() {
        return this.#registry.getAllActionDefinitions();
    }

    /**
     * Retrieves a specific `ActionDefinition` by its ID from the registry.
     * Delegates directly to the registry.
     *
     * @param   {string} id The fully qualified ID (e.g., 'core:move').
     * @returns {ActionDefinition | null} The definition or null if not found.
     */
    getActionDefinition(id) {
        if (typeof id !== 'string' || !id.trim()) {
            this.#logger.warn(`GameDataRepository: getActionDefinition called with invalid ID: ${id}`);
            return null;
        }
        const definition = this.#registry.getActionDefinition(id);
        return definition ?? null;
    }

    // ────────────────────────────────────────────────────────────────────────────
    //  Entity definitions (convenience – used by loaders & editors)
    // ────────────────────────────────────────────────────────────────────────────

    /**
     * Retrieves a specific raw `EntityDefinition` by its ID from the registry.
     * Delegates directly to the registry.
     *
     * @param   {string} id The fully qualified ID (e.g., 'core:player').
     * @returns {EntityDefinition | null} The raw entity definition as stored, or null if not found.
     */
    getEntityDefinition(id) {
        if (typeof id !== 'string' || !id.trim()) {
            this.#logger.warn(`GameDataRepository: getEntityDefinition called with invalid ID: ${id}`);
            return null;
        }
        const definition = this.#registry.getEntityDefinition(id);
        return definition ?? null;
    }

    /**
     * Retrieves **all** `EntityDefinition` objects currently stored in the registry.
     * Delegates directly to the registry.
     *
     * @returns {EntityDefinition[]} An array of all entity definitions.
     */
    getAllEntityDefinitions() {
        return this.#registry.getAllEntityDefinitions();
    }

    // ────────────────────────────────────────────────────────────────────────────
    //  Event definitions
    // ────────────────────────────────────────────────────────────────────────────

    /**
     * Retrieves a specific `EventDefinition` by its ID from the registry.
     * Delegates directly to the registry.
     *
     * @param {string} id - The event ID (e.g., 'textUI:display_message').
     * @returns {EventDefinition | null} The definition or null if not found.
     */
    getEventDefinition(id) {
        if (typeof id !== 'string' || !id.trim()) {
            this.#logger.warn(`GameDataRepository: getEventDefinition called with invalid ID: ${id}`);
            return null;
        }
        const definition = this.#registry.getEventDefinition(id);
        return definition ?? null;
    }

    /**
     * Retrieves **all** `EventDefinition` objects currently stored in the registry.
     * Delegates directly to the registry.
     *
     * @returns {EventDefinition[]} An array of all event definitions.
     */
    getAllEventDefinitions() {
        return this.#registry.getAllEventDefinitions();
    }

    // --- ADDED METHOD ---
    /**
     * Handles queries directed to the GameDataRepository via the SystemDataRegistry.
     * @param {string | object} queryDetails - Details about the query.
     * For GameDataRepository, this is expected to be a string for simple queries.
     * @returns {any | undefined} The result of the query or undefined if not supported.
     */
    handleQuery(queryDetails) {
        this.#logger.debug(`GameDataRepository.handleQuery received: ${JSON.stringify(queryDetails)}`);
        if (typeof queryDetails === 'string') {
            switch (queryDetails) {
                case 'getWorldName':
                    return this.getWorldName();
                // Add other simple string-based queries here if needed in the future
                default:
                    this.#logger.warn(`GameDataRepository: Unsupported string query: '${queryDetails}'`);
                    return undefined;
            }
        } else if (typeof queryDetails === 'object' && queryDetails !== null) {
            // If GameDataRepository needs to support complex object-based queries in the future:
            // const { query_type, ...params } = queryDetails;
            // switch (query_type) {
            //     case 'someComplexQuery':
            //         return this.handleSomeComplexQuery(params);
            //     default:
            //         this.#logger.warn(`GameDataRepository: Unsupported object query_type: '${queryDetails.query_type}'`);
            //         return undefined;
            // }
            this.#logger.warn(`GameDataRepository: Received object query, but no complex query types are currently supported. Query: ${JSON.stringify(queryDetails)}`);
            return undefined;
        } else {
            this.#logger.warn(`GameDataRepository: Invalid queryDetails format. Expected string or object. Received: ${typeof queryDetails}`);
            return undefined;
        }
    }

    // --- END ADDED METHOD ---
}

export default GameDataRepository;