// src/core/gameEngine.js

// --- Type Imports ---
/** @typedef {import('./config/appContainer.js').default} AppContainer */
/** @typedef {import('./interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('./turns/interfaces/ITurnManager.js').ITurnManager} ITurnManager */
/** @typedef {import('../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('./initializers/services/initializationService.js').default} InitializationService */
/** @typedef {import('./initializers/services/initializationService.js').InitializationResult} InitializationResult */
/** @typedef {import('./shutdown/services/shutdownService.js').default} ShutdownService */
// ISaveLoadService import will be removed as per ticket if no longer used
// /** @typedef {import('../interfaces/ISaveLoadService.js').ISaveLoadService} ISaveLoadService */
/** @typedef {import('../interfaces/ISaveLoadService.js').SaveGameStructure} SaveGameStructure */
/** @typedef {import('./interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../services/playtimeTracker.js').default} PlaytimeTracker */
/** @typedef {import('../services/gamePersistenceService.js').default} GamePersistenceService */


// --- Import Tokens ---
import {tokens} from './config/tokens.js';
import OriginalEntity from '../entities/entity.js'; // Assuming Entity class is default export

/**
 * Encapsulates the core game engine, managing state, coordinating initialization
 * via InitializationService, starting the game via TurnManager, and coordinating shutdown
 * via ShutdownService. Also handles triggering save operations via GamePersistenceService.
 */
class GameEngine {
    /** @private @type {AppContainer} */
    #container;
    /** @private @type {boolean} */
    #isInitialized = false;
    /** @private @type {ILogger | null} */
    #logger = null;
    /** @private @type {IDataRegistry | null} */
    #dataRegistry = null;
    /** @private @type {EntityManager | null} */
    #entityManager = null;
    /** @private @type {PlaytimeTracker | null} */
    #playtimeTracker = null;
    /** @private @type {GamePersistenceService | null} */
    #gamePersistenceService = null;


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
            this.#playtimeTracker = /** @type {PlaytimeTracker} */ (this.#container.resolve(tokens.PlaytimeTracker));
        } catch (error) {
            this.#logger.error('GameEngine Constructor: CRITICAL - Could not resolve PlaytimeTracker. Playtime features and save/load will fail.', error);
            throw new Error('GameEngine failed to initialize PlaytimeTracker.'); // Make it fatal
        }

        try {
            this.#gamePersistenceService = /** @type {GamePersistenceService} */ (this.#container.resolve(tokens.GamePersistenceService));
            this.#logger.info('GameEngine Constructor: GamePersistenceService resolved successfully.');
        } catch (error) {
            this.#logger.error('GameEngine Constructor: CRITICAL - Could not resolve GamePersistenceService. Manual save operations will fail.', error);
            throw new Error('GameEngine failed to initialize GamePersistenceService.'); // Make it fatal
        }

        try {
            this.#dataRegistry = this.#container.resolve(tokens.IDataRegistry);
        } catch (error) {
            this.#logger.warn('GameEngine Constructor: Could not resolve IDataRegistry. Mod manifest capture will fail.', error);
        }
        try {
            this.#entityManager = this.#container.resolve(tokens.EntityManager); // Assuming concrete EntityManager token for now
        } catch (error) {
            this.#logger.warn('GameEngine Constructor: Could not resolve EntityManager. Game state capture/restore will fail.', error);
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
     * @async
     * @private
     * @method #onGameReady
     * @description Centralizes the common final steps required to make the game engine active and playable
     * after either a new game has been initialized or a saved game has been successfully loaded and restored.
     * Sets the engine to initialized, resolves and starts the TurnManager.
     * @throws {Error} If ITurnManager cannot be resolved or fails to start.
     */
    async #onGameReady() {
        this.#isInitialized = true;
        this.#logger?.info("GameEngine: Game data processed. Engine is now initialized.");

        let turnManager = null;
        try {
            turnManager = /** @type {ITurnManager} */ (this.#container.resolve(tokens.ITurnManager));
        } catch (error) {
            this.#logger?.error("GameEngine.#onGameReady: Failed to resolve ITurnManager. Cannot start turns.", error);
            this.#isInitialized = false;
            throw new Error('Failed to resolve ITurnManager in #onGameReady.');
        }

        try {
            this.#logger?.info("GameEngine.#onGameReady: Starting TurnManager...");
            await turnManager.start(); // Assuming start() is general enough for new/resume
            this.#logger?.info("GameEngine.#onGameReady: TurnManager started successfully.");
        } catch (error) {
            this.#logger?.error("GameEngine.#onGameReady: CRITICAL ERROR starting TurnManager.", error);
            this.#isInitialized = false;
            if (turnManager && typeof turnManager.stop === 'function') {
                try {
                    await turnManager.stop();
                    this.#logger?.warn("GameEngine.#onGameReady: Attempted to stop TurnManager after startup error.");
                } catch (stopError) {
                    this.#logger?.error("GameEngine.#onGameReady: Error stopping TurnManager during error handling.", stopError);
                }
            }
            throw error; // Re-throw the original error from turnManager.start()
        }
    }


    /**
     * Initializes the game using InitializationService and then starts the turn processing via TurnManager.
     * This is for starting a NEW game.
     * @param {string} worldName - The identifier of the world to load and start.
     * @returns {Promise<void>} A promise that resolves when the turn manager has successfully started, or rejects if initialization or startup fails.
     */
    async startNewGame(worldName) {
        if (!worldName || typeof worldName !== 'string' || worldName.trim() === '') {
            this.#logger?.error('GameEngine: Fatal Error - startNewGame() called without a valid worldName.');
            throw new Error('GameEngine.startNewGame requires a valid non-empty worldName argument.');
        }

        if (this.isInitialized) {
            this.#logger?.warn(`GameEngine: startNewGame('${worldName}') called, but engine is already initialized. Please stop the engine first.`);
            return; // Or throw an error
        }

        this.#logger?.info(`GameEngine: Starting NEW GAME initialization sequence for world: ${worldName}...`);

        try {
            if (this.#entityManager) {
                this.#logger?.debug('GameEngine: Clearing EntityManager before new game initialization.');
                this.#entityManager.clearAll();
            } else {
                this.#logger?.error('GameEngine: EntityManager is not available. Cannot clear before new game.');
                throw new Error('EntityManager not available for new game start.');
            }

            const initializationService = /** @type {InitializationService} */ (
                this.#container.resolve(tokens.InitializationService)
            );
            this.#logger?.debug('GameEngine: InitializationService resolved for new game.');
            const initResult = await initializationService.runInitializationSequence(worldName);

            if (!initResult.success) {
                const failureReason = initResult.error?.message || 'Unknown initialization error';
                this.#logger?.error(`GameEngine: New game initialization sequence failed for world '${worldName}'. Reason: ${failureReason}`, initResult.error);
                this.#isInitialized = false; // Ensure state is false if init failed before #onGameReady
                throw initResult.error || new Error(`Game engine new game initialization failed: ${failureReason}`);
            }

            this.#logger?.info('GameEngine: New game initialization sequence reported success.');
            // Centralize final steps to make engine playable
            await this.#onGameReady();

        } catch (error) {
            this.#logger?.error(`GameEngine: CRITICAL ERROR during new game initialization or TurnManager startup for world '${worldName}'.`, error);
            // #onGameReady and initializationService path should handle setting #isInitialized to false.
            // If #onGameReady threw, it also attempts to stop its turnManager.
            // We re-set it here just in case error occurred before #onGameReady was called or if #onGameReady failed to set it.
            this.#isInitialized = false;
            throw error; // Re-throw the error to be handled by the caller
        }
    }

    /**
     * Restores the game state from a deserialized save game object.
     * This method assumes mod definitions have already been loaded into DataRegistry
     * based on the save file's mod manifest *before* this method is called.
     * The actual restoration of game data components (entities, playtime, turn number etc.)
     * is expected to be handled by GamePersistenceService.loadAndRestoreGame, which then
     * provides the deserializedSaveData. This method applies that data.
     * @param {SaveGameStructure} deserializedSaveData - The full save game object.
     * @returns {Promise<void>}
     * @throws {Error} If restoration fails or if #onGameReady fails.
     */
    async restoreState(deserializedSaveData) {
        this.#logger?.info('GameEngine: Restoring game state from save data...');

        if (!deserializedSaveData || typeof deserializedSaveData !== 'object') {
            this.#logger?.error('GameEngine.restoreState: Invalid or null deserializedSaveData provided.');
            throw new Error('Invalid save data provided for state restoration.');
        }
        if (!this.#entityManager) {
            this.#logger?.error('GameEngine.restoreState: EntityManager is not available. Cannot restore entities.');
            throw new Error('EntityManager not available for state restoration.');
        }
        // DataRegistry is not strictly critical here as entity definitions should already be in components by this stage.
        if (!this.#dataRegistry) {
            this.#logger?.warn('GameEngine.restoreState: DataRegistry is not available. This might be an issue if further definition lookups were needed.');
        }

        // Clear existing state (though GamePersistenceService.restoreGameState might also do this)
        this.#logger?.debug('GameEngine.restoreState: Clearing existing entity state via EntityManager.clearAll() before applying loaded state.');
        this.#entityManager.clearAll();

        // Entity Restoration
        this.#logger?.info(`GameEngine.restoreState: Restoring ${deserializedSaveData.gameState.entities?.length || 0} entities.`);
        if (deserializedSaveData.gameState?.entities) {
            for (const savedEntityData of deserializedSaveData.gameState.entities) {
                if (!savedEntityData.instanceId || !savedEntityData.definitionId || typeof savedEntityData.components !== 'object') {
                    this.#logger?.warn('GameEngine.restoreState: Skipping invalid entity data in save:', savedEntityData);
                    continue;
                }
                // OriginalEntity is assumed to be the class for game entities.
                // This is a simplified reconstruction; a more robust system might use EntityManager.reconstructEntity.
                // However, the ticket context implies GamePersistenceService.restoreGameState already did this,
                // and GameEngine.restoreState is more about applying it to the live engine state if not already done.
                // For now, following the existing pattern in this method, but noting that
                // GamePersistenceService.restoreGameState does more detailed reconstruction.
                // This block might become redundant if GamePersistenceService fully populates EntityManager.
                const entity = new OriginalEntity(savedEntityData.instanceId);
                // Manually set definitionId if your Entity class needs it post-construction and it's not part of constructor
                // entity.definitionId = savedEntityData.definitionId; // Example if needed
                this.#logger?.debug(`GameEngine.restoreState: Re-registering entity instance ${entity.id} (definition: ${savedEntityData.definitionId}).`);
                this.#entityManager.activeEntities.set(entity.id, entity); // Ensure it's in activeEntities

                for (const [componentTypeId, componentData] of Object.entries(savedEntityData.components)) {
                    try {
                        // This assumes addComponent correctly re-attaches/re-initializes components from data.
                        this.#entityManager.addComponent(entity.id, componentTypeId, componentData);
                        this.#logger?.debug(`GameEngine.restoreState: Added/Restored component ${componentTypeId} to entity ${entity.id}.`);
                    } catch (compError) {
                        this.#logger?.error(`GameEngine.restoreState: Failed to add/restore component ${componentTypeId} to entity ${entity.id}. Error: ${compError.message}. Skipping component.`, compError);
                    }
                }
                this.#logger?.debug(`GameEngine.restoreState: Finished restoring components for entity ${entity.id}.`);
            }
        }
        this.#logger?.info('GameEngine.restoreState: Entity restoration process in GameEngine scope complete.');

        // Playtime and TurnManager state (like currentTurn) should have been restored by GamePersistenceService.
        // Log what GamePersistenceService should have done.
        if (deserializedSaveData.metadata && typeof deserializedSaveData.metadata.playtimeSeconds === 'number') {
            this.#logger?.info(`GameEngine.restoreState: PlaytimeTracker should have been updated by GamePersistenceService to ${deserializedSaveData.metadata.playtimeSeconds}s.`);
        } else {
            this.#logger?.warn('GameEngine.restoreState: Playtime data not found or invalid in save data; PlaytimeTracker state depends on GamePersistenceService.');
        }

        // Resolve TurnManager to set current turn, as per original logic.
        // This should happen BEFORE #onGameReady calls turnManager.start().
        try {
            const turnManager = /** @type {ITurnManager} */ (this.#container.resolve(tokens.ITurnManager));
            if (turnManager && deserializedSaveData.gameState?.engineInternals && typeof deserializedSaveData.gameState.engineInternals.currentTurn === 'number') {
                if (typeof turnManager.setCurrentTurn === 'function') {
                    turnManager.setCurrentTurn(deserializedSaveData.gameState.engineInternals.currentTurn);
                    this.#logger?.info(`GameEngine.restoreState: Set current turn on TurnManager to ${deserializedSaveData.gameState.engineInternals.currentTurn}.`);
                } else {
                    this.#logger?.warn('GameEngine.restoreState: TurnManager does not have setCurrentTurn method. Cannot restore turn count directly here.');
                }
            } else {
                this.#logger?.info('GameEngine.restoreState: Current turn data not found in save or TurnManager not resolved for setCurrentTurn.');
            }
        } catch (error) {
            this.#logger?.error('GameEngine.restoreState: Failed to resolve ITurnManager for setting current turn. Turn state may not be fully restored.', error);
        }


        if (deserializedSaveData.gameState?.playerState) {
            this.#logger?.debug('GameEngine.restoreState: PlayerState data was present in save. Restoration depends on GamePersistenceService/other services.');
        }

        if (deserializedSaveData.gameState?.worldState) {
            this.#logger?.debug('GameEngine.restoreState: WorldState data was present in save. Restoration depends on GamePersistenceService/other services.');
        }

        // this.#isInitialized = true; // Moved to #onGameReady
        // this.#logger?.info('GameEngine: State restoration complete. Engine is initialized with loaded data.'); // Moved to #onGameReady

        // Centralize final steps to make engine playable
        try {
            await this.#onGameReady();
            this.#logger?.info('GameEngine: State restoration and engine readiness complete.');
        } catch (error) {
            this.#logger?.error('GameEngine.restoreState: CRITICAL ERROR during #onGameReady after state restoration.', error);
            this.#isInitialized = false; // Ensure this is false if #onGameReady fails
            throw error; // Propagate error
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
                    await fallbackTurnManager.stop();
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
            this.#logger?.info('GameEngine: Engine stop sequence finished, internal state reset (isInitialized = false).');
        }
    }

    /**
     * Triggers a manual save operation by delegating to GamePersistenceService.
     * @param {string} saveName - The desired name for the save file.
     * @returns {Promise<{success: boolean, message?: string, error?: string, filePath?: string}>}
     * A promise resolving to the outcome of the save operation.
     */
    async triggerManualSave(saveName) {
        this.#logger?.info(`GameEngine: Manual save triggered for name: "${saveName}"`);

        if (!this.#gamePersistenceService) {
            const errorMsg = 'GamePersistenceService is not available. Cannot save game.';
            this.#logger?.error(`GameEngine.triggerManualSave: ${errorMsg}`);
            return {success: false, error: errorMsg};
        }

        try {
            return await this.#gamePersistenceService.saveGame(saveName, this.isInitialized);
        } catch (error) {
            const errorMessage = (error && error.message) ? error.message : 'An unknown error occurred.';
            this.#logger?.error(`GameEngine.triggerManualSave: An unexpected error occurred while calling GamePersistenceService.saveGame for "${saveName}": ${errorMessage}`, error);
            return {success: false, error: `Unexpected error during save delegation: ${errorMessage}`};
        }
    }
}

export default GameEngine;