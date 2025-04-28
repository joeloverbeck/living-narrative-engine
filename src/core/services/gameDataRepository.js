// src/core/services/gameDataRepository.js
// ────────────────────────────────────────────────────────────────────────────────

/**
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

export class GameDataRepository {
    /** @type {IDataRegistry}  */ #registry;
    /** @type {ILogger}        */ #logger;

    /**
     * @param {IDataRegistry} registry
     * @param {ILogger}       logger
     */
    constructor(registry, logger) {
        // --- Validation ---
        // Validate Logger first
        if (!logger?.info || !logger?.warn || !logger?.error || !logger?.debug) {
            throw new Error('GameDataRepository requires a valid ILogger with info, warn, error, and debug methods.');
        }

        // Validate IDataRegistry for methods *actually used* by this facade
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
            // Be specific about which methods are missing for easier debugging
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
        // --- End Validation ---

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
        const manifest = this.#registry.getManifest();
        // Provide a default or null if manifest/worldName is missing
        return manifest?.worldName ?? null;
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
        // Delegate to the specific method on IDataRegistry
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
        // Delegate to the specific method on IDataRegistry
        const definition = this.#registry.getActionDefinition(id);
        return definition ?? null; // Ensure null is returned if undefined
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
        // Delegate to the specific method on IDataRegistry
        const definition = this.#registry.getEntityDefinition(id);
        return definition ?? null; // Ensure null is returned if undefined
    }

    /**
     * Retrieves **all** `EntityDefinition` objects currently stored in the registry.
     * Delegates directly to the registry.
     *
     * @returns {EntityDefinition[]} An array of all entity definitions.
     */
    getAllEntityDefinitions() {
        // Delegate to the specific method on IDataRegistry
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
        // Delegate to the specific method on IDataRegistry
        const definition = this.#registry.getEventDefinition(id);
        return definition ?? null; // Ensure null is returned if undefined
    }

    /**
     * Retrieves **all** `EventDefinition` objects currently stored in the registry.
     * Delegates directly to the registry.
     *
     * @returns {EventDefinition[]} An array of all event definitions.
     */
    getAllEventDefinitions() {
        // Delegate to the specific method on IDataRegistry
        return this.#registry.getAllEventDefinitions();
    }

    // Note: No other specific getters (like getItemDefinition) are included here.
    // If access to other types is needed, consumers should ideally use a
    // registry instance directly or this facade could be extended *if* the
    // IDataRegistry interface defines corresponding specific methods.
}

// Optional default export for `import GameDataRepository from ...` style
export default GameDataRepository;