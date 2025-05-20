// src/core/gameEngine.js

// --- Type Imports ---
/** @typedef {import('./config/appContainer.js').default} AppContainer */
/** @typedef {import('./interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('./turns/interfaces/ITurnManager.js').ITurnManager} ITurnManager */
/** @typedef {import('../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('./initializers/services/initializationService.js').default} InitializationService */
/** @typedef {import('./initializers/services/initializationService.js').InitializationResult} InitializationResult */
/** @typedef {import('./shutdown/services/shutdownService.js').default} ShutdownService */
/** @typedef {import('./interfaces/ISaveLoadService.js').ISaveLoadService} ISaveLoadService */
/** @typedef {import('./interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */


// --- Import Tokens ---
import {tokens} from './config/tokens.js';


/**
 * Encapsulates the core game engine, managing state, coordinating initialization
 * via InitializationService, starting the game via TurnManager, and coordinating shutdown
 * via ShutdownService. Also handles triggering save/load operations.
 */
class GameEngine {
    /** @private @type {AppContainer} */
    #container;
    /** @private @type {boolean} */
    #isInitialized = false;
    /** @private @type {ILogger | null} */
    #logger = null;
    /** @private @type {ISaveLoadService | null} */
    #saveLoadService = null;
    /** @private @type {IDataRegistry | null} */
    #dataRegistry = null;
    /** @private @type {EntityManager | null} */
    #entityManager = null;

    // Placeholder for playtime tracking
    /** @private @type {number} */
    #sessionStartTime = 0;
    /** @private @type {number} */
    #accumulatedPlaytimeSeconds = 0;


    /**
     * Creates a new GameEngine instance.
     * @param {object} options
     * @param {AppContainer} options.container - The application's dependency container.
     */
    constructor({container}) {
        if (!container) {
            console.error('GameEngine requires a valid AppContainer instance.');
            throw new Error('GameEngine requires a valid AppContainer instance.');
        }
        this.#container = container;

        try {
            this.#logger = this.#container.resolve(tokens.ILogger);
        } catch (error) {
            console.warn('GameEngine Constructor: Could not resolve ILogger dependency. Falling back to console.', error);
            this.#logger = {info: console.info, warn: console.warn, error: console.error, debug: console.debug};
        }

        try {
            this.#saveLoadService = this.#container.resolve(tokens.ISaveLoadService);
        } catch (error) {
            this.#logger.warn('GameEngine Constructor: Could not resolve ISaveLoadService. Save/Load will not function.', error);
        }
        try {
            this.#dataRegistry = this.#container.resolve(tokens.IDataRegistry);
        } catch (error) {
            this.#logger.warn('GameEngine Constructor: Could not resolve IDataRegistry. Mod manifest capture will fail.', error);
        }
        try {
            this.#entityManager = this.#container.resolve(tokens.EntityManager);
        } catch (error) {
            this.#logger.warn('GameEngine Constructor: Could not resolve EntityManager. Game state capture will fail.', error);
        }


        this.#logger.info('GameEngine: Instance created. Ready to start.');
    }

    /**
     * Checks if the game engine has been successfully initialized and hasn't been stopped.
     * @returns {boolean} True if the engine is considered initialized, false otherwise.
     */
    get isInitialized() {
        return this.#isInitialized;
    }


    /**
     * Initializes the game using InitializationService and then starts the turn processing via TurnManager.
     * @param {string} worldName - The identifier of the world to load and start.
     * @returns {Promise<void>} A promise that resolves when the turn manager has successfully started, or rejects if initialization or startup fails.
     */
    async start(worldName) {
        if (!worldName || typeof worldName !== 'string' || worldName.trim() === '') {
            this.#logger?.error('GameEngine: Fatal Error - start() called without a valid worldName.');
            throw new Error('GameEngine.start requires a valid non-empty worldName argument.');
        }

        if (this.isInitialized) {
            this.#logger?.warn(`GameEngine: start('${worldName}') called, but engine is already initialized. Ignoring.`);
            return;
        }

        this.#logger?.info(`GameEngine: Starting initialization sequence for world: ${worldName}...`);
        this.#sessionStartTime = Date.now();
        this.#accumulatedPlaytimeSeconds = 0;

        let initResult;
        let turnManager = null;
        try {
            const initializationService = /** @type {InitializationService} */ (
                this.#container.resolve(tokens.InitializationService)
            );
            this.#logger?.debug('GameEngine: InitializationService resolved.');
            initResult = await initializationService.runInitializationSequence(worldName);

            if (!initResult.success) {
                const failureReason = initResult.error?.message || 'Unknown initialization error';
                this.#logger?.error(`GameEngine: Initialization sequence failed for world '${worldName}'. Reason: ${failureReason}`, initResult.error);
                this.#isInitialized = false;
                throw initResult.error || new Error(`Game engine initialization failed: ${failureReason}`);
            }

            this.#logger?.info('GameEngine: Initialization sequence reported success.');
            this.#isInitialized = true;

            this.#logger?.info('GameEngine: Resolving TurnManager...');
            turnManager = /** @type {ITurnManager} */ (
                this.#container.resolve(tokens.ITurnManager)
            );
            this.#logger?.info('GameEngine: Starting TurnManager...');
            await turnManager.start();
        } catch (error) {
            this.#logger?.error(`GameEngine: CRITICAL ERROR during initialization or TurnManager startup for world '${worldName}'.`, error);
            this.#isInitialized = false;
            if (turnManager && typeof turnManager.stop === 'function') {
                try {
                    await turnManager.stop();
                    this.#logger.warn("GameEngine: Attempted to stop TurnManager after startup error.");
                } catch (stopError) {
                    this.#logger.error("GameEngine: Error stopping TurnManager during error handling.", stopError);
                }
            }
            throw error;
        }
    }

    /**
     * Stops the game engine by delegating to the ShutdownService and resetting internal state.
     */
    async stop() {
        this.#logger?.info('GameEngine: Stop requested.');

        if (!this.isInitialized) {
            this.#logger?.info('GameEngine: Stop requested, but engine is not initialized. No action needed.');
            return;
        }

        if (this.#sessionStartTime > 0) {
            this.#accumulatedPlaytimeSeconds += Math.floor((Date.now() - this.#sessionStartTime) / 1000);
            this.#sessionStartTime = 0;
        }

        try {
            this.#logger?.debug('GameEngine: Resolving ShutdownService...');
            const shutdownService = /** @type {ShutdownService} */ (
                this.#container.resolve(tokens.ShutdownService)
            );
            this.#logger?.info('GameEngine: Executing shutdown sequence via ShutdownService...');
            await shutdownService.runShutdownSequence();
            this.#logger?.info('GameEngine: Shutdown sequence completed successfully via ShutdownService.');
        } catch (shutdownError) {
            this.#logger?.error('GameEngine: Error resolving or running ShutdownService.', shutdownError);
            this.#logger?.warn('GameEngine: Attempting minimal fallback cleanup after ShutdownService error...');
            try {
                const fallbackTurnManager = this.#container.resolve(tokens.ITurnManager);
                if (fallbackTurnManager && typeof fallbackTurnManager.stop === 'function') {
                    await fallbackTurnManager.stop(); // <<< TYPO CORRECTED HERE
                    this.#logger?.warn('GameEngine: Fallback - Manually stopped TurnManager.');
                }
            } catch (tmStopError) {
                this.#logger?.error('GameEngine: Fallback - Error stopping TurnManager directly.', tmStopError);
            }
            if (this.#container && typeof this.#container.disposeSingletons === 'function') {
                try {
                    this.#container.disposeSingletons();
                    this.#logger?.warn('GameEngine: Fallback - Manually disposed container singletons.');
                } catch (disposeError) {
                    this.#logger?.error('GameEngine: Fallback - Error disposing container singletons.', disposeError);
                }
            }
        } finally {
            this.#isInitialized = false;
            console.log('GameEngine: Engine stop sequence finished, internal state reset.');
            this.#logger?.info('GameEngine: Engine stop sequence finished, internal state reset.');
        }
    }

    /**
     * Checks if the game is currently in a state where saving is allowed.
     * @returns {boolean} True if saving is currently allowed, false otherwise.
     */
    isSavingAllowed() {
        if (!this.isInitialized) {
            this.#logger?.warn('isSavingAllowed: Save attempt while engine not initialized.');
            return false;
        }
        this.#logger?.debug('isSavingAllowed: Check returned true (stubbed).');
        return true;
    }

    /**
     * Captures the current, comprehensive game state into a structured object.
     * @returns {object} The structured game state object.
     * @private
     */
    #captureCurrentGameState() {
        this.#logger?.info('Capturing current game state...');
        const entitiesData = [];
        if (this.#entityManager) {
            for (const entity of this.#entityManager.activeEntities.values()) {
                const components = {};
                for (const [componentTypeId, componentData] of entity.componentEntries) {
                    components[componentTypeId] = JSON.parse(JSON.stringify(componentData));
                }
                entitiesData.push({
                    instanceId: entity.id,
                    definitionId: entity.definitionId || 'unknown:definition',
                    components: components,
                });
            }
        } else {
            this.#logger?.warn('EntityManager not available for state capture.');
        }

        let activeModsManifest = [];
        if (this.#dataRegistry && typeof this.#dataRegistry.getLoadedModManifests === 'function') {
            activeModsManifest = this.#dataRegistry.getLoadedModManifests().map(mod => ({
                modId: mod.modId,
                version: mod.version,
            }));
        } else {
            this.#logger?.warn('DataRegistry not available or getLoadedModManifests not implemented for mod manifest capture.');
            activeModsManifest = [{modId: 'core', version: 'unknown'}];
        }

        const worldLoader = this.#container.resolve(tokens.WorldLoader);
        const turnManager = this.#container.resolve(tokens.ITurnManager);

        const gameStateObject = {
            metadata: {
                saveFormatVersion: '1.0.0',
                engineVersion: '0.1.0-stub',
                gameTitle: worldLoader?.getActiveWorldName() || 'Unknown Game',
                timestamp: new Date().toISOString(),
                playtimeSeconds: this.#accumulatedPlaytimeSeconds + (this.#sessionStartTime > 0 ? Math.floor((Date.now() - this.#sessionStartTime) / 1000) : 0),
                saveName: '',
            },
            modManifest: {
                activeMods: activeModsManifest,
            },
            gameState: {
                entities: entitiesData,
                playerState: {
                    currentLocationId: 'stub:player_location',
                    globalFlags: {'stub_flag': true},
                },
                worldState: {
                    timeOfDay: 'stub_noon',
                    weather: 'stub_clear',
                },
                engineInternals: {
                    currentTurn: turnManager?.currentTurn ?? 0,
                },
            },
            integrityChecks: {
                gameStateChecksum: 'PENDING_CALCULATION',
            },
        };
        this.#logger?.info('Game state capture complete (placeholder implementation).');
        return gameStateObject;
    }

    /**
     * Triggers a manual save operation.
     * @param {string} saveName - The desired name for the save file.
     * @returns {Promise<{success: boolean, message?: string, error?: string, filePath?: string}>}
     */
    async triggerManualSave(saveName) {
        this.#logger?.info(`Manual save triggered with name: "${saveName}"`);

        if (!this.#saveLoadService) {
            const errorMsg = 'SaveLoadService is not available. Cannot save game.';
            this.#logger?.error(errorMsg);
            return {success: false, error: errorMsg};
        }

        if (!this.isSavingAllowed()) {
            const errorMsg = 'Saving is not currently allowed (e.g., critical moment in game).';
            this.#logger?.warn(errorMsg);
            return {success: false, error: errorMsg};
        }

        try {
            const gameStateObject = this.#captureCurrentGameState();
            gameStateObject.metadata.saveName = saveName;

            const result = await this.#saveLoadService.saveManualGame(saveName, gameStateObject);

            if (result.success) {
                this.#logger?.info(`Manual save successful: ${result.message}`);
            } else {
                this.#logger?.error(`Manual save failed: ${result.error}`);
            }
            return result;

        } catch (error) {
            this.#logger?.error('An unexpected error occurred during triggerManualSave:', error);
            return {success: false, error: `Unexpected error during save: ${error.message}`};
        }
    }
}

export default GameEngine;