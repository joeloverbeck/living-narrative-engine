// src/core/services/gameDataRepository.js
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Lightweight façade over whatever `IDataRegistry` implementation you are using.
 * The class does **not** cache anything internally: every getter reflects the
 * current contents of the registry so that late-loaded content (e.g. in tests or
 * when hot-reloading mods) is immediately visible.
 *
 * If you really want an in-memory cache, wrap this repository with your own
 * service – don’t put the cache here, or you will have exactly the stale-data
 * bug you just ran into. 🙂
 *
 * @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../interfaces/coreServices.js').ILogger}        ILogger
 * @typedef {import('../../types/actionDefinition.js').ActionDefinition} ActionDefinition
 * @typedef {import('../../types/eventDefinition.js').EventDefinition} EventDefinition // Assuming this type exists
 * @typedef {import('../../types/entityDefinition.js').EntityDefinition} EntityDefinition // Assuming this type exists
 */

export class GameDataRepository {
    /** @type {IDataRegistry}  */ #registry;
    /** @type {ILogger}        */ #logger;

    /**
     * @param {IDataRegistry} registry
     * @param {ILogger}       logger
     */
    constructor(registry, logger) {
        // Updated checks to include necessary IDataRegistry methods
        if (!registry?.get || !registry?.getAll || !registry?.getStartingPlayerId || !registry?.getStartingLocationId || !registry?.getEventDefinition || !registry?.getAllEventDefinitions) {
            throw new Error('GameDataRepository requires a valid IDataRegistry with expected methods (get, getAll, getStartingPlayerId, getStartingLocationId, getEventDefinition, getAllEventDefinitions).');
        }
        if (!logger?.info || !logger?.debug || !logger?.error || !logger.warn) { // Added warn check
            throw new Error('GameDataRepository requires a valid ILogger.');
        }

        this.#registry = registry;
        this.#logger = logger;

        this.#logger.info('GameDataRepository initialised (no internal cache).');
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
        // TODO: Implement fetching world name from registry manifest if needed
        const manifest = this.#registry.getManifest();
        return manifest?.worldName ?? "Unknown World"; // Example access
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
     *
     * @returns {ActionDefinition[]}
     */
    getAllActionDefinitions() {
        // Use the specific getter from IDataRegistry
        return this.#registry.getAllActionDefinitions();
    }

    /**
     * @param   {string} id
     * @returns {ActionDefinition | null}
     */
    getActionDefinition(id) {
        if (typeof id !== 'string' || !id.trim()) return null;
        // Use the specific getter from IDataRegistry
        return this.#registry.getActionDefinition(id) ?? null;
    }

    // ────────────────────────────────────────────────────────────────────────────
    //  Entity definitions (convenience – used by loaders & editors)
    // ────────────────────────────────────────────────────────────────────────────

    /**
     * @param   {string} id
     * @returns {EntityDefinition | null}  raw entity definition as stored
     */
    getEntityDefinition(id) {
        if (typeof id !== 'string' || !id.trim()) return null;
        // Use the specific getter from IDataRegistry
        return this.#registry.getEntityDefinition(id) ?? null;
    }

    /**
     * @returns {EntityDefinition[]} array of **all** entity definitions
     */
    getAllEntityDefinitions() {
        // Use the specific getter from IDataRegistry
        return this.#registry.getAllEntityDefinitions();
    }

    // ────────────────────────────────────────────────────────────────────────────
    //  Event definitions
    // ────────────────────────────────────────────────────────────────────────────

    /**
     * Retrieves a definition classified as an 'event'.
     * @param {string} id - The event ID (e.g., 'textUI:display_message').
     * @returns {EventDefinition | null}
     */
    getEventDefinition(id) {
        if (typeof id !== 'string' || !id.trim()) return null;
        // Delegate to the specific method on IDataRegistry
        return this.#registry.getEventDefinition(id) ?? null;
    }

    /**
     * @returns {EventDefinition[]}
     */
    getAllEventDefinitions() {
        // Delegate to the specific method on IDataRegistry
        return this.#registry.getAllEventDefinitions();
    }

    // Add getters for other types (items, locations, etc.) as needed, delegating to IDataRegistry
}

// Optional default export for `import GameDataRepository from ...` style
export default GameDataRepository;