// ────────────────────────────────────────────────────────────────────────────────
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
 */

export class GameDataRepository {
    /** @type {IDataRegistry}  */ #registry;
    /** @type {ILogger}        */ #logger;

    /**
     * @param {IDataRegistry} registry
     * @param {ILogger}       logger
     */
    constructor(registry, logger) {
        if (!registry?.get || !registry?.getAll) {
            throw new Error('GameDataRepository requires a valid IDataRegistry.');
        }
        if (!logger?.info || !logger?.debug || !logger?.error) {
            throw new Error('GameDataRepository requires a valid ILogger.');
        }

        this.#registry = registry;
        this.#logger = logger;

        this.#logger.info('GameDataRepository initialised (no internal cache).');
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
        const collection = this.#registry.getAll('actions');
        if (!collection) return [];
        // convert Map | Record | whatever into an array
        return Array.isArray(collection)
            ? collection
            : Array.from(collection.values?.() ?? Object.values(collection));
    }

    /**
     * @param   {string} id
     * @returns {ActionDefinition | null}
     */
    getActionDefinition(id) {
        if (typeof id !== 'string' || !id.trim()) return null;
        return this.#registry.get('actions', id) ?? null;
    }

    // ────────────────────────────────────────────────────────────────────────────
    //  Entity definitions (convenience – used by loaders & editors)
    // ────────────────────────────────────────────────────────────────────────────

    /**
     * @param   {string} id
     * @returns {object | null}  raw entity definition as stored
     */
    getEntityDefinition(id) {
        if (typeof id !== 'string' || !id.trim()) return null;
        return this.#registry.get('entities', id) ?? null;
    }

    /**
     * @returns {object[]} array of **all** entity definitions
     */
    getAllEntityDefinitions() {
        const collection = this.#registry.getAll('entities');
        if (!collection) return [];
        return Array.isArray(collection)
            ? collection
            : Array.from(collection.values?.() ?? Object.values(collection));
    }

    /**
     * Retrieves a definition classified as an 'event'.
     * @param {string} id - The event ID (e.g., 'event:display_message').
     * @returns {EventDefinition | null} // Use specific EventDefinition type if available
     */
    getEventDefinition(id) {
        // Delegate to the specific method on IDataRegistry - THIS IS THE MISSING METHOD
        return this.#registry.getEventDefinition(id) ?? null;
    }

    /**
     * @returns {EventDefinition[]} // Use specific EventDefinition type if available
     */
    getAllEventDefinitions() {
        // Delegate to the specific method on IDataRegistry
        return this.#registry.getAllEventDefinitions();
    }
}

// Optional default export for `import GameDataRepository from ...` style
export default GameDataRepository;