// src/services/gamePersistenceService.js

import {IGamePersistenceService} from "../interfaces/IGamePersistenceService.js";

// --- JSDoc Type Imports ---
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/ISaveLoadService.js').ISaveLoadService} ISaveLoadService */
/** @typedef {import('../interfaces/ISaveLoadService.js').SaveGameStructure} SaveGameStructure */
/** @typedef {import('../interfaces/ISaveLoadService.js').LoadGameResult} LoadGameResult */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('./playtimeTracker.js').default} PlaytimeTracker */
/** @typedef {import('../core/config/appContainer.js').default} AppContainer */ // Assuming path
/** @typedef {import('../turns/interfaces/ITurnManager.js').ITurnManager} ITurnManager */ // Assuming path
/** @typedef {import('../core/services/worldLoader.js').default} WorldLoader */ // Assuming path


// --- Import Tokens ---
import {tokens} from '../config/tokens.js'; // Assuming path

/**
 * Service responsible for orchestrating the capture and restoration of game state,
 * as well as interacting with the ISaveLoadService for file operations.
 * @implements {IGamePersistenceService}
 */
class GamePersistenceService extends IGamePersistenceService {
    /** @private @type {ILogger} */
    #logger;
    /** @private @type {ISaveLoadService} */
    #saveLoadService;
    /** @private @type {EntityManager} */
    #entityManager;
    /** @private @type {IDataRegistry} */
    #dataRegistry;
    /** @private @type {PlaytimeTracker} */
    #playtimeTracker;
    /** @private @type {AppContainer} */
    #container;

    constructor({
                    logger,
                    saveLoadService,
                    entityManager,
                    dataRegistry,
                    playtimeTracker,
                    container
                }) {
        super();
        const missingDependencies = [];
        if (!logger) missingDependencies.push('logger');
        if (!saveLoadService) missingDependencies.push('saveLoadService');
        if (!entityManager) missingDependencies.push('entityManager');
        if (!dataRegistry) missingDependencies.push('dataRegistry');
        if (!playtimeTracker) missingDependencies.push('playtimeTracker');
        if (!container) missingDependencies.push('container');

        if (missingDependencies.length > 0) {
            const errorMessage = `GamePersistenceService: Fatal - Missing required dependencies: ${missingDependencies.join(', ')}.`;
            if (logger && typeof logger.error === 'function') {
                logger.error(errorMessage);
            } else {
                console.error(errorMessage);
            }
            throw new Error(errorMessage);
        }

        this.#logger = logger;
        this.#saveLoadService = saveLoadService;
        this.#entityManager = entityManager;
        this.#dataRegistry = dataRegistry;
        this.#playtimeTracker = playtimeTracker;
        this.#container = container;
        this.#logger.info('GamePersistenceService: Instance created.');
    }

    /** @private */
    #deepClone(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        try {
            return JSON.parse(JSON.stringify(obj));
        } catch (e) {
            this.#logger.error('GamePersistenceService.#deepClone failed:', e, obj);
            throw new Error('Failed to deep clone object data.');
        }
    }

    captureCurrentGameState() {
        this.#logger.info('GamePersistenceService: Capturing current game state...');

        if (!this.#entityManager) throw new Error('EntityManager not available for capturing game state.');
        if (!this.#dataRegistry) throw new Error('DataRegistry not available for capturing mod manifest.');
        if (!this.#playtimeTracker) throw new Error('PlaytimeTracker not available for capturing game state.');
        if (!this.#container) throw new Error('AppContainer not available for resolving dependencies.');

        const entitiesData = [];
        for (const entity of this.#entityManager.activeEntities.values()) {
            const components = {};
            for (const [componentTypeId, componentData] of entity.componentEntries) {
                components[componentTypeId] = this.#deepClone(componentData);
            }
            entitiesData.push({
                instanceId: entity.id, // This is the unique instance UUID
                definitionId: entity.definitionId, // This is the original definition ID (e.g., "isekai:hero")
                components: components,
            });
        }
        this.#logger.debug(`GamePersistenceService: Captured ${entitiesData.length} entities.`);

        let activeModsManifest = [];
        if (typeof this.#dataRegistry.getLoadedModManifests === 'function') {
            activeModsManifest = this.#dataRegistry.getLoadedModManifests().map(mod => ({
                modId: mod.modId,
                version: mod.version,
            }));
            this.#logger.debug(`GamePersistenceService: Captured ${activeModsManifest.length} active mods.`);
        } else {
            this.#logger.warn('GamePersistenceService: DataRegistry does not have getLoadedModManifests. Mod manifest may be incomplete.');
            const coreModDef = this.#dataRegistry.getModDefinition?.('core'); // Optional chaining
            activeModsManifest = [{modId: 'core', version: coreModDef?.version || 'unknown_fallback'}];
            this.#logger.debug('GamePersistenceService: Used fallback for mod manifest.');
        }

        let currentTurn = 0;
        try {
            const turnManager = /** @type {ITurnManager} */ (this.#container.resolve(tokens.ITurnManager));
            currentTurn = turnManager?.currentTurn ?? 0;
        } catch (error) {
            this.#logger.warn('GamePersistenceService.captureCurrentGameState: Failed to resolve ITurnManager. Current turn will be default (0).', error);
        }

        let currentWorldName = 'Unknown Game';
        try {
            const worldLoader = /** @type {WorldLoader} */ (this.#container.resolve(tokens.WorldLoader));
            currentWorldName = worldLoader?.getActiveWorldName() || 'Unknown Game';
        } catch (error) {
            this.#logger.warn(`GamePersistenceService.captureCurrentGameState: Failed to resolve WorldLoader or get active world name. Using default ('${currentWorldName}').`, error);
        }

        const currentTotalPlaytime = this.#playtimeTracker.getTotalPlaytime();
        this.#logger.debug(`GamePersistenceService: Fetched total playtime: ${currentTotalPlaytime}s.`);

        const gameStateObject = {
            metadata: {
                saveFormatVersion: '1.0.0', // Example version
                engineVersion: '0.1.0-stub', // Example version
                gameTitle: currentWorldName,
                timestamp: new Date().toISOString(),
                playtimeSeconds: currentTotalPlaytime,
                saveName: '', // This will be set by ISaveLoadService or the save UI flow
            },
            modManifest: {
                activeMods: activeModsManifest,
            },
            gameState: {
                entities: entitiesData,
                playerState: {}, // Placeholder for actual player state
                worldState: {},  // Placeholder for actual world state
                engineInternals: {
                    currentTurn: currentTurn,
                    // Other engine-specific states can go here
                },
            },
            integrityChecks: {
                gameStateChecksum: 'PENDING_CALCULATION', // To be calculated by SaveLoadService
            },
        };

        this.#logger.info(`GamePersistenceService: Game state capture complete. ${entitiesData.length} entities captured. Playtime: ${currentTotalPlaytime}s. Current turn: ${currentTurn}.`);
        return gameStateObject;
    }

    isSavingAllowed(isEngineInitialized) {
        if (!isEngineInitialized) {
            this.#logger.warn('GamePersistenceService.isSavingAllowed: Save attempt while engine not initialized.');
            return false;
        }
        // TODO: Implement actual logic to check if game is in a "non-critical moment".
        this.#logger.debug('GamePersistenceService.isSavingAllowed: Check returned true (currently a basic stub).');
        return true;
    }

    async saveGame(saveName, isEngineInitialized) {
        this.#logger.info(`GamePersistenceService: Manual save triggered with name: "${saveName}".`);

        if (!this.#saveLoadService) {
            const errorMsg = 'SaveLoadService is not available. Cannot save game.';
            this.#logger.error(`GamePersistenceService.saveGame: ${errorMsg}`);
            return {success: false, error: errorMsg};
        }

        if (!this.isSavingAllowed(isEngineInitialized)) {
            const errorMsg = 'Saving is not currently allowed.';
            this.#logger.warn(`GamePersistenceService.saveGame: Saving is not currently allowed.`);
            return {success: false, error: errorMsg};
        }

        try {
            this.#logger.debug(`GamePersistenceService.saveGame: Capturing current game state for save "${saveName}".`);
            const gameStateObject = this.captureCurrentGameState();
            if (!gameStateObject.metadata) gameStateObject.metadata = {}; // Should be initialized by capture
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
            const errorMessage = (error instanceof Error) ? error.message : 'An unknown error occurred.';
            this.#logger.error(`GamePersistenceService.saveGame: An unexpected error occurred during saveGame for "${saveName}": ${errorMessage}`, error);
            return {success: false, error: `Unexpected error during save: ${errorMessage}`};
        }
    }

    async restoreGameState(deserializedSaveData) {
        this.#logger.info('GamePersistenceService.restoreGameState: Starting game state restoration...');

        if (!deserializedSaveData?.gameState) { // Simplified check
            const errorMsg = "Invalid save data structure provided (missing gameState).";
            this.#logger.error(`GamePersistenceService.restoreGameState: ${errorMsg}`);
            return {success: false, error: errorMsg};
        }
        if (!this.#entityManager) return {success: false, error: "EntityManager not available."};
        if (!this.#playtimeTracker) return {success: false, error: "PlaytimeTracker not available."};

        try {
            this.#entityManager.clearAll();
            this.#logger.debug('GamePersistenceService.restoreGameState: Existing entity state cleared.');
        } catch (error) {
            const errorMsg = `Failed to clear existing entity state: ${error.message}`;
            this.#logger.error(`GamePersistenceService.restoreGameState: ${errorMsg}`, error);
            return {success: false, error: `Critical error during state clearing: ${errorMsg}`};
        }

        this.#logger.info('GamePersistenceService.restoreGameState: Restoring entities...');
        const entitiesToRestore = deserializedSaveData.gameState.entities;

        if (!Array.isArray(entitiesToRestore)) {
            this.#logger.warn('GamePersistenceService.restoreGameState: entitiesToRestore is not an array. No entities will be restored.');
        } else {
            for (const savedEntityData of entitiesToRestore) {
                // EntityManager.reconstructEntity now expects definitionId to be present
                if (!savedEntityData?.instanceId || !savedEntityData?.definitionId) {
                    this.#logger.warn(`GamePersistenceService.restoreGameState: Invalid entity data in save (missing instanceId or definitionId). Skipping. Data: ${JSON.stringify(savedEntityData)}`);
                    continue;
                }
                try {
                    // reconstructEntity will handle new Entity(instanceId, definitionId)
                    const restoredEntity = this.#entityManager.reconstructEntity(savedEntityData);
                    if (!restoredEntity) {
                        this.#logger.warn(`GamePersistenceService.restoreGameState: Failed to restore entity with instanceId: ${savedEntityData.instanceId} (Def: ${savedEntityData.definitionId}). reconstructEntity indicated failure.`);
                    }
                } catch (entityError) {
                    this.#logger.warn(`GamePersistenceService.restoreGameState: Error during reconstructEntity for instanceId: ${savedEntityData.instanceId}. Error: ${entityError.message}. Skipping.`, entityError);
                }
            }
        }
        this.#logger.info('GamePersistenceService.restoreGameState: Entity restoration complete.');

        if (deserializedSaveData.metadata && typeof deserializedSaveData.metadata.playtimeSeconds === 'number') {
            try {
                this.#playtimeTracker.setAccumulatedPlaytime(deserializedSaveData.metadata.playtimeSeconds);
                this.#logger.info(`GamePersistenceService.restoreGameState: Restored accumulated playtime: ${deserializedSaveData.metadata.playtimeSeconds}s.`);
            } catch (playtimeError) {
                this.#logger.error(`GamePersistenceService.restoreGameState: Error setting accumulated playtime: ${playtimeError.message}. Resetting.`, playtimeError);
                this.#playtimeTracker.setAccumulatedPlaytime(0);
            }
        } else {
            this.#logger.warn('GamePersistenceService.restoreGameState: Playtime data not found/invalid. Resetting playtime.');
            this.#playtimeTracker.setAccumulatedPlaytime(0);
        }

        let turnManager = null;
        try {
            turnManager = /** @type {ITurnManager} */ (this.#container.resolve(tokens.ITurnManager));
        } catch (resolveError) {
            this.#logger.error(`GamePersistenceService.restoreGameState: Failed to resolve ITurnManager: ${resolveError.message}. Cannot restore turn count.`, resolveError);
        }

        if (turnManager && deserializedSaveData.gameState.engineInternals && typeof deserializedSaveData.gameState.engineInternals.currentTurn === 'number') {
            if (typeof turnManager.setCurrentTurn === 'function') {
                try {
                    turnManager.setCurrentTurn(deserializedSaveData.gameState.engineInternals.currentTurn);
                    this.#logger.info(`GamePersistenceService.restoreGameState: Restored current turn to ${deserializedSaveData.gameState.engineInternals.currentTurn}.`);
                } catch (turnError) {
                    this.#logger.error(`GamePersistenceService.restoreGameState: Error calling turnManager.setCurrentTurn: ${turnError.message}.`, turnError);
                }
            } else {
                this.#logger.warn('GamePersistenceService.restoreGameState: TurnManager does not have setCurrentTurn method.');
            }
        } else if (turnManager) {
            this.#logger.info('GamePersistenceService.restoreGameState: Current turn data not found/invalid in save.');
        }

        // TODO: Restore PlayerState, WorldState, etc.
        this.#logger.debug('GamePersistenceService.restoreGameState: Placeholder for PlayerState/WorldState restoration.');

        this.#logger.info('GamePersistenceService.restoreGameState: Game state restoration process complete.');
        return {success: true};
    }

    async loadAndRestoreGame(saveIdentifier) {
        this.#logger.info(`GamePersistenceService: Attempting to load and restore game from: ${saveIdentifier}.`);
        if (!this.#saveLoadService) {
            return {success: false, error: 'SaveLoadService is not available.', data: null};
        }

        let loadResult;
        try {
            loadResult = await this.#saveLoadService.loadGameData(saveIdentifier);
        } catch (serviceError) {
            const errorMsg = `Unexpected error calling SaveLoadService.loadGameData for "${saveIdentifier}": ${serviceError.message}`;
            this.#logger.error(`GamePersistenceService.loadAndRestoreGame: ${errorMsg}`, serviceError);
            return {success: false, error: `Unexpected error during data loading: ${serviceError.message}`, data: null};
        }

        if (!loadResult?.success || !loadResult?.data) {
            const reason = loadResult?.error || 'Load failed or no data returned.';
            this.#logger.error(`GamePersistenceService.loadAndRestoreGame: Failed to load raw game data from ${saveIdentifier}. Reason: ${reason}`);
            return {success: false, error: loadResult?.error || "Failed to load raw game data.", data: null};
        }

        this.#logger.info(`GamePersistenceService.loadAndRestoreGame: Raw game data loaded from ${saveIdentifier}. Restoring state.`);
        const gameDataToRestore = /** @type {SaveGameStructure} */ (loadResult.data);
        const restoreResult = await this.restoreGameState(gameDataToRestore);

        if (restoreResult.success) {
            this.#logger.info(`GamePersistenceService.loadAndRestoreGame: Game state restored successfully for ${saveIdentifier}.`);
            return {success: true, data: gameDataToRestore};
        } else {
            this.#logger.error(`GamePersistenceService.loadAndRestoreGame: Failed to restore game state for ${saveIdentifier}. Error: ${restoreResult.error}`);
            return {success: false, error: restoreResult.error || "Failed to restore game state.", data: null};
        }
    }
}

export default GamePersistenceService;