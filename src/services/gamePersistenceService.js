// src/services/gamePersistenceService.js

// --- JSDoc Type Imports ---
/** @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/ISaveLoadService.js').ISaveLoadService} ISaveLoadService */
/** @typedef {import('../interfaces/ISaveLoadService.js').SaveGameStructure} SaveGameStructure */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../core/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('./playtimeTracker.js').default} PlaytimeTracker */
/** @typedef {import('../core/config/appContainer.js').default} AppContainer */
/** @typedef {import('../core/turns/interfaces/ITurnManager.js').ITurnManager} ITurnManager */
/** @typedef {import('../core/services/worldLoader.js').default} WorldLoader */ // Assuming this path based on GameEngine context

// --- Import Tokens ---
import {tokens} from '../core/config/tokens.js';

// Note: Assuming MissingDependencyError is a custom error. If not, a standard Error will be used.
// For now, we'll use a standard Error as MissingDependencyError is not defined in the provided context.

/**
 * Service responsible for orchestrating the capture and restoration of game state,
 * as well as interacting with the ISaveLoadService for file operations.
 */
class GamePersistenceService {
    /**
     * To store an ILogger instance.
     * @private
     * @type {ILogger}
     */
    #logger;

    /**
     * To store an ISaveLoadService instance.
     * @private
     * @type {ISaveLoadService}
     */
    #saveLoadService;

    /**
     * To store an EntityManager instance.
     * @private
     * @type {EntityManager}
     */
    #entityManager;

    /**
     * To store an IDataRegistry instance.
     * @private
     * @type {IDataRegistry}
     */
    #dataRegistry;

    /**
     * To store a PlaytimeTracker instance.
     * @private
     * @type {PlaytimeTracker}
     */
    #playtimeTracker;

    /**
     * To store an AppContainer instance (for resolving other transient or less frequently used dependencies).
     * @private
     * @type {AppContainer}
     */
    #container;

    /**
     * Creates an instance of GamePersistenceService.
     * @param {object} dependencies - The dependencies for the service.
     * @param {ILogger} dependencies.logger - The logger service.
     * @param {ISaveLoadService} dependencies.saveLoadService - The save/load service.
     * @param {EntityManager} dependencies.entityManager - The entity manager.
     * @param {IDataRegistry} dependencies.dataRegistry - The data registry.
     * @param {PlaytimeTracker} dependencies.playtimeTracker - The playtime tracker.
     * @param {AppContainer} dependencies.container - The application container.
     * @throws {Error} If any required dependency is missing.
     */
    constructor({
                    logger,
                    saveLoadService,
                    entityManager,
                    dataRegistry,
                    playtimeTracker,
                    container
                }) {
        const missingDependencies = [];
        if (!logger) missingDependencies.push('logger');
        if (!saveLoadService) missingDependencies.push('saveLoadService');
        if (!entityManager) missingDependencies.push('entityManager');
        if (!dataRegistry) missingDependencies.push('dataRegistry');
        if (!playtimeTracker) missingDependencies.push('playtimeTracker');
        if (!container) missingDependencies.push('container');

        if (missingDependencies.length > 0) {
            const errorMessage = `GamePersistenceService: Fatal - Missing required dependencies: ${missingDependencies.join(', ')}.`;
            // Attempt to log if logger is available, otherwise console.error
            if (logger && typeof logger.error === 'function') {
                logger.error(errorMessage);
            } else {
                console.error(errorMessage);
            }
            throw new Error(errorMessage); // Using standard Error as MissingDependencyError is not defined.
        }

        this.#logger = logger;
        this.#saveLoadService = saveLoadService;
        this.#entityManager = entityManager;
        this.#dataRegistry = dataRegistry;
        this.#playtimeTracker = playtimeTracker;
        this.#container = container;

        this.#logger.info('GamePersistenceService: Instance created.');
    }

    /**
     * Deep clones an object using JSON stringify/parse.
     * Suitable for POJOs (Plain Old JavaScript Objects) as used in game state.
     * This method is primarily used for creating independent copies of component data
     * during state capture and restoration.
     *
     * Note: This method will not correctly clone complex objects containing Dates,
     * Maps, Sets, functions, undefined, or circular references. It is intended
     * for simple, serializable data structures.
     *
     * @param {any} obj - The object or value to clone. If not an object, it's returned as is.
     * @returns {any} The cloned object, or the original value if not an object or if cloning fails.
     * @throws {Error} If `JSON.stringify` fails on the object, indicating it's not suitable for this cloning method.
     * @private
     */
    #deepClone(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        try {
            return JSON.parse(JSON.stringify(obj));
        } catch (e) {
            // Use the injected logger instance
            this.#logger.error('GamePersistenceService.#deepClone failed:', e, obj);
            throw new Error('Failed to deep clone object data.');
        }
    }

    /**
     * Captures the current, comprehensive game state into a structured object
     * conforming to the SaveGameStructure.
     * This method gathers data from various services and structures it appropriately.
     * @returns {SaveGameStructure} The structured game state object.
     * @throws {Error} If critical services like EntityManager or DataRegistry are unavailable at the time of calling,
     * or if resolving dependencies like ITurnManager or WorldLoader fails critically.
     */
    captureCurrentGameState() {
        this.#logger.info('GamePersistenceService: Capturing current game state...');

        // Core dependencies are expected to be present due to constructor checks.
        // These checks serve as an additional safeguard during the actual operation.
        if (!this.#entityManager) {
            this.#logger.error('GamePersistenceService.captureCurrentGameState: EntityManager is not available!');
            throw new Error('EntityManager not available for capturing game state.');
        }
        if (!this.#dataRegistry) {
            this.#logger.error('GamePersistenceService.captureCurrentGameState: DataRegistry is not available!');
            throw new Error('DataRegistry not available for capturing mod manifest.');
        }
        if (!this.#playtimeTracker) { // Should be guaranteed by constructor
            this.#logger.error('GamePersistenceService.captureCurrentGameState: PlaytimeTracker is not available!');
            throw new Error('PlaytimeTracker not available for capturing game state.');
        }
        if (!this.#container) { // Should be guaranteed by constructor
            this.#logger.error('GamePersistenceService.captureCurrentGameState: AppContainer is not available!');
            throw new Error('AppContainer not available for resolving dependencies.');
        }

        const entitiesData = [];
        for (const entity of this.#entityManager.activeEntities.values()) {
            const components = {};
            // entity.componentEntries should yield [componentTypeId, componentData]
            for (const [componentTypeId, componentData] of entity.componentEntries) {
                // Deep clone component data to ensure the save file has an independent snapshot
                components[componentTypeId] = this.#deepClone(componentData);
            }
            entitiesData.push({
                instanceId: entity.id,
                // Fallback for definitionId as seen in the original GameEngine logic
                definitionId: entity.definitionId || (this.#entityManager.getEntityDefinition?.(entity.id)?.id || 'unknown:definition'),
                components: components,
            });
        }
        this.#logger.debug(`GamePersistenceService: Captured ${entitiesData.length} entities.`);

        let activeModsManifest = [];
        if (typeof this.#dataRegistry.getLoadedModManifests === 'function') {
            activeModsManifest = this.#dataRegistry.getLoadedModManifests().map(mod => ({
                modId: mod.modId,
                version: mod.version,
                // checksum: mod.checksum, // Optional: if manifest includes it and it's desired in the save
            }));
            this.#logger.debug(`GamePersistenceService: Captured ${activeModsManifest.length} active mods from DataRegistry.`);
        } else {
            this.#logger.warn('GamePersistenceService: DataRegistry does not have getLoadedModManifests. Mod manifest in save may be incomplete or basic.');
            const coreModDef = this.#dataRegistry.getModDefinition?.('core'); // Hypothetical method from original
            if (coreModDef) {
                activeModsManifest = [{modId: 'core', version: coreModDef.version || 'unknown'}];
            } else {
                activeModsManifest = [{modId: 'core', version: 'unknown_fallback'}];
            }
            this.#logger.debug('GamePersistenceService: Used fallback for mod manifest.');
        }

        let turnManager = null;
        let currentTurn = 0;
        try {
            turnManager = /** @type {ITurnManager} */ (this.#container.resolve(tokens.ITurnManager));
            currentTurn = turnManager?.currentTurn ?? 0;
        } catch (error) {
            this.#logger.warn('GamePersistenceService.captureCurrentGameState: Failed to resolve ITurnManager. Current turn will be default (0).', error);
            // currentTurn remains 0
        }

        let worldLoader = null;
        let currentWorldName = 'Unknown Game'; // Default value
        try {
            worldLoader = /** @type {WorldLoader} */ (this.#container.resolve(tokens.WorldLoader));
            currentWorldName = worldLoader?.getActiveWorldName() || 'Unknown Game';
        } catch (error) {
            this.#logger.warn(`GamePersistenceService.captureCurrentGameState: Failed to resolve WorldLoader or get active world name. Using default ('${currentWorldName}').`, error);
        }

        const currentTotalPlaytime = this.#playtimeTracker.getTotalPlaytime();
        this.#logger.debug(`GamePersistenceService: Fetched total playtime: ${currentTotalPlaytime}s.`);

        const gameStateObject = {
            metadata: {
                saveFormatVersion: '1.0.0', // Consider making this a constant or configurable
                engineVersion: '0.1.0-stub', // TODO: Get this from a central place (e.g., package.json or config)
                gameTitle: currentWorldName,
                timestamp: new Date().toISOString(),
                playtimeSeconds: currentTotalPlaytime,
                saveName: '', // This should be set by the calling context (e.g., the method that orchestrates saving)
                // screenshotDataURI: undefined, // Optional, not part of this port
            },
            modManifest: {
                activeMods: activeModsManifest,
            },
            gameState: {
                entities: entitiesData,
                playerState: {
                    // Placeholder: Adapt as actual player state structure evolves.
                    // e.g., globalFlags: this.#somePlayerStateService.getFlags(),
                    // This data would be gathered from relevant services or entity components.
                },
                worldState: {
                    // Placeholder: Adapt as actual world state structure evolves.
                    // e.g., timeOfDay: this.#worldStateService.getCurrentTimeOfDay(),
                    // This data would be gathered from relevant services or entity components.
                },
                engineInternals: {
                    currentTurn: currentTurn,
                    // Other engine-specific states if needed, e.g.:
                    // eventQueueSnapshot: this.eventSystem?.snapshotQueue() || [],
                    // ruleEngineVariables: this.ruleProcessor?.getPersistentVariables() || {},
                },
            },
            integrityChecks: {
                gameStateChecksum: 'PENDING_CALCULATION', // To be calculated by ISaveLoadService before final save
            },
        };

        this.#logger.info(`GamePersistenceService: Game state capture complete. ${entitiesData.length} entities captured. Playtime: ${currentTotalPlaytime}s. Current turn: ${currentTurn}.`);
        return gameStateObject;
    }

    /**
     * Determines if the game is currently in a state where saving is permissible.
     * This method checks if the game engine is initialized and includes a placeholder
     * for more detailed checks against critical game moments (e.g., UI dialogs, turn phases).
     *
     * @param {boolean} isEngineInitialized - Indicates whether the core game engine is initialized.
     * @returns {boolean} True if saving is allowed, false otherwise.
     */
    isSavingAllowed(isEngineInitialized) {
        if (!isEngineInitialized) {
            this.#logger.warn('GamePersistenceService.isSavingAllowed: Save attempt while engine not initialized.');
            return false;
        }

        // TODO: Implement actual logic to check if game is in a "non-critical moment".
        // This might involve querying other services (e.g., UI service for modal dialogs,
        // ITurnManager for turn phase) via this.#container or injected dependencies.
        // For example:
        // const uiService = this.#container.resolve(tokens.UIService);
        // if (uiService.isModalDialogOpen()) {
        //     this.#logger.debug('GamePersistenceService.isSavingAllowed: Modal dialog is open, saving not allowed.');
        //     return false;
        // }
        // const turnManager = this.#container.resolve(tokens.ITurnManager);
        // if (turnManager.currentPhase === 'AI_THINKING' || turnManager.currentPhase === 'PLAYER_ACTION_RESOLUTION') {
        //     this.#logger.debug(`GamePersistenceService.isSavingAllowed: Game in critical phase (${turnManager.currentPhase}), saving not allowed.`);
        //     return false;
        // }

        this.#logger.debug('GamePersistenceService.isSavingAllowed: Check returned true (currently a basic stub).');
        return true;
    }

    /**
     * Orchestrates the process of saving the game.
     * It checks if saving is allowed, captures the current game state,
     * sets the save name in the metadata, and then delegates to the
     * ISaveLoadService to write the game data to a persistent store.
     *
     * @async
     * @public
     * @param {string} saveName - The desired name for the save. This will be used
     * to identify the save file and will also be stored
     * within the save file's metadata.
     * @param {boolean} isEngineInitialized - The current initialized state of the
     * GameEngine. This is used to determine
     * if saving is permissible.
     * @returns {Promise<{success: boolean, message?: string, error?: string, filePath?: string}>}
     * A promise that resolves with an object indicating the outcome of the save operation.
     * - On success: `{ success: true, message: string, filePath: string }`
     * - On failure (e.g., saving not allowed, service unavailable, internal error):
     * `{ success: false, error: string }`
     */
    async saveGame(saveName, isEngineInitialized) {
        this.#logger.info(`GamePersistenceService: Manual save triggered with name: "${saveName}".`);

        if (!this.#saveLoadService) {
            const errorMsg = 'SaveLoadService is not available. Cannot save game.';
            this.#logger.error(`GamePersistenceService.saveGame: ${errorMsg}`);
            return {success: false, error: errorMsg};
        }

        if (!this.isSavingAllowed(isEngineInitialized)) {
            const errorMsg = 'Saving is not currently allowed.';
            // The ticket asks for: "Saving is not currently allowed (e.g., engine not ready or critical moment in game)."
            // My method `isSavingAllowed` logs the reason (e.g. engine not initialized).
            // The returned error message should be generic as per ticket, the detailed log is already done.
            this.#logger.warn(`GamePersistenceService.saveGame: Saving is not currently allowed (e.g., engine not ready or critical moment in game).`);
            return {success: false, error: errorMsg};
        }

        try {
            this.#logger.debug(`GamePersistenceService.saveGame: Capturing current game state for save "${saveName}".`);
            const gameStateObject = this.captureCurrentGameState();

            // Ensure metadata object exists before attempting to set saveName
            // captureCurrentGameState should always create .metadata, but this is a safe check.
            if (!gameStateObject.metadata) {
                this.#logger.warn(`GamePersistenceService.saveGame: gameStateObject from captureCurrentGameState was missing 'metadata' property. Initializing it for saveName.`);
                gameStateObject.metadata = {}; // Initialize if somehow missing
            }
            gameStateObject.metadata.saveName = saveName;
            this.#logger.debug(`GamePersistenceService.saveGame: Set saveName "${saveName}" in gameStateObject.metadata.`);

            this.#logger.info(`GamePersistenceService.saveGame: Delegating to ISaveLoadService.saveManualGame for "${saveName}".`);
            const result = await this.#saveLoadService.saveManualGame(saveName, gameStateObject);

            if (result.success) {
                this.#logger.info(`GamePersistenceService.saveGame: Manual save successful: ${result.message || `Save "${saveName}" completed.`}`);
            } else {
                this.#logger.error(`GamePersistenceService.saveGame: Manual save failed: ${result.error || 'Unknown error from SaveLoadService.'}`);
            }
            return result;

        } catch (error) {
            // Ensure error.message is accessed safely
            const errorMessage = (error && error.message) ? error.message : 'An unknown error occurred.';
            this.#logger.error(`GamePersistenceService.saveGame: An unexpected error occurred during saveGame for "${saveName}": ${errorMessage}`, error);
            // The ticket asks for: `Unexpected error during save: ${error.message}` (using backticks for template literal)
            // I'll stick to the exact format.
            return {success: false, error: `Unexpected error during save: ${errorMessage}`};
        }
    }
}

export default GamePersistenceService;