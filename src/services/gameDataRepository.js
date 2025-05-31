// src/services/gameDataRepository.js
// --- FILE START ---
import {IGameDataRepository} from "../interfaces/IGameDataRepository.js"; // Ensure this path is correct

/**
 * @class GameDataRepository
 * @extends {IGameDataRepository}
 * @implements {IGameDataRepository}
 * @description
 * Lightweight façade over an IDataRegistry implementation.
 * This class does not cache anything internally; every getter reflects the
 * current contents of the registry.
 *
 * @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../types/actionDefinition.js').ActionDefinition} ActionDefinition
 * @typedef {import('../types/eventDefinition.js').EventDefinition} EventDefinition
 * @typedef {import('../types/entityDefinition.js').EntityDefinition} EntityDefinition
 * @typedef {object} ComponentDefinition // Assuming a basic object type for now, or import a more specific typedef if available
 */
export class GameDataRepository extends IGameDataRepository {
    /** @type {IDataRegistry} */
    #registry;
    /** @type {ILogger} */
    #logger;

    /**
     * @param {IDataRegistry} registry
     * @param {ILogger} logger
     */
    constructor(registry, logger) {
        super();
        // --- Validation ---
        if (!logger?.info || !logger?.warn || !logger?.error || !logger?.debug) {
            throw new Error('GameDataRepository requires a valid ILogger with info, warn, error, and debug methods.');
        }

        // Extended to include component definition methods
        const requiredRegistryMethods = [
            'getStartingPlayerId', 'getStartingLocationId',
            'getActionDefinition', 'getAllActionDefinitions',
            'getEntityDefinition', 'getAllEntityDefinitions',
            'getEventDefinition', 'getAllEventDefinitions',
            'getComponentDefinition', 'getAllComponentDefinitions', // Added
            'get', 'getAll', 'clear', 'store' // Basic IDataRegistry methods
        ];
        const missingMethods = requiredRegistryMethods.filter(method => typeof registry?.[method] !== 'function');

        if (!registry || missingMethods.length > 0) {
            const missing = (!registry ? ['registry object'] : []).concat(missingMethods).join(', ');
            throw new Error(`GameDataRepository requires a valid IDataRegistry with specific methods. Missing or invalid: ${missing}.`);
        }

        this.#registry = registry;
        this.#logger = logger;

        this.#logger.info('GameDataRepository initialised (delegates to registry).');
    }

    // ────────────────────────────────────────────────────────────────────────────
    //  Manifest / World Info
    // ────────────────────────────────────────────────────────────────────────────

    getWorldName() {
        // Consider if this should also come from registry or a manifest object within it
        return "DEMO_WORLD"; // Placeholder, as in original
    }

    getStartingPlayerId() {
        const playerId = this.#registry.getStartingPlayerId();
        // if (!playerId) { // Logging can be verbose, IDataRegistry might log this
        //     this.#logger.warn('GameDataRepository: getStartingPlayerId called, but no ID found in registry.');
        // }
        return playerId;
    }

    getStartingLocationId() {
        const locationId = this.#registry.getStartingLocationId();
        // if (!locationId) { // Logging can be verbose
        //     this.#logger.warn('GameDataRepository: getStartingLocationId called, but no ID found in registry.');
        // }
        return locationId;
    }

    // ────────────────────────────────────────────────────────────────────────────
    //  Action definitions
    // ────────────────────────────────────────────────────────────────────────────

    /** @returns {ActionDefinition[]} */
    getAllActionDefinitions() {
        return this.#registry.getAllActionDefinitions();
    }

    /**
     * @param {string} id
     * @returns {ActionDefinition | null}
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
    //  Entity definitions
    // ────────────────────────────────────────────────────────────────────────────

    /**
     * @param {string} id
     * @returns {EntityDefinition | null}
     */
    getEntityDefinition(id) {
        if (typeof id !== 'string' || !id.trim()) {
            this.#logger.warn(`GameDataRepository: getEntityDefinition called with invalid ID: ${id}`);
            return null;
        }
        const definition = this.#registry.getEntityDefinition(id);
        return definition ?? null;
    }

    /** @returns {EntityDefinition[]} */
    getAllEntityDefinitions() {
        return this.#registry.getAllEntityDefinitions();
    }

    // ────────────────────────────────────────────────────────────────────────────
    //  Event definitions
    // ────────────────────────────────────────────────────────────────────────────

    /**
     * @param {string} id
     * @returns {EventDefinition | null}
     */
    getEventDefinition(id) {
        if (typeof id !== 'string' || !id.trim()) {
            this.#logger.warn(`GameDataRepository: getEventDefinition called with invalid ID: ${id}`);
            return null;
        }
        const definition = this.#registry.getEventDefinition(id);
        return definition ?? null;
    }

    /** @returns {EventDefinition[]} */
    getAllEventDefinitions() {
        return this.#registry.getAllEventDefinitions();
    }

    // ────────────────────────────────────────────────────────────────────────────
    //  Component definitions (NEW SECTION)
    // ────────────────────────────────────────────────────────────────────────────

    /**
     * Retrieves a specific ComponentDefinition by its ID from the registry.
     * @param {string} id The fully qualified ID (e.g., 'core:position').
     * @returns {ComponentDefinition | null} The component definition, or null if not found.
     */
    getComponentDefinition(id) {
        if (typeof id !== 'string' || !id.trim()) {
            this.#logger.warn(`GameDataRepository: getComponentDefinition called with invalid ID: ${id}`);
            return null;
        }
        // `getComponentDefinition` should exist on IDataRegistry per interface contract
        const definition = this.#registry.getComponentDefinition(id);
        // Optionally log if not found, but can be noisy if checks are frequent
        // if (!definition) this.#logger.debug(`GameDataRepository: Component definition not found for ID: ${id}`);
        return definition ?? null;
    }

    /**
     * Retrieves all ComponentDefinition objects currently stored in the registry.
     * @returns {ComponentDefinition[]} An array of all component definitions.
     */
    getAllComponentDefinitions() {
        // `getAllComponentDefinitions` should exist on IDataRegistry per interface contract
        return this.#registry.getAllComponentDefinitions();
    }

    // ────────────────────────────────────────────────────────────────────────────
    //  Generic Query Handler
    // ────────────────────────────────────────────────────────────────────────────

    /**
     * Handles queries directed to the GameDataRepository.
     * @param {string | object} queryDetails - Details about the query.
     * @returns {any | undefined} The result of the query or undefined if not supported.
     */
    handleQuery(queryDetails) {
        this.#logger.debug(`GameDataRepository.handleQuery received: ${JSON.stringify(queryDetails)}`);
        if (typeof queryDetails === 'string') {
            switch (queryDetails) {
                case 'getWorldName':
                    return this.getWorldName();
                // Add other simple string-based queries here if needed
                default:
                    this.#logger.warn(`GameDataRepository: Unsupported string query: '${queryDetails}'`);
                    return undefined;
            }
        } else if (typeof queryDetails === 'object' && queryDetails !== null) {
            // Example for future complex queries:
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
}

export default GameDataRepository;
// --- FILE END ---