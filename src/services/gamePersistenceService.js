// src/services/gamePersistenceService.js

import { IGamePersistenceService } from '../interfaces/IGamePersistenceService.js';

// --- JSDoc Type Imports ---
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/ISaveLoadService.js').ISaveLoadService} ISaveLoadService */
/** @typedef {import('../interfaces/ISaveLoadService.js').SaveGameStructure} SaveGameStructure */
/** @typedef {import('../interfaces/ISaveLoadService.js').LoadGameResult} LoadGameResult */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('./playtimeTracker.js').default} PlaytimeTracker */
/** @typedef {import('../core/config/appContainer.js').default} AppContainer */
/** @typedef {import('../turns/interfaces/ITurnManager.js').ITurnManager} ITurnManager */
// WorldLoader import is no longer strictly needed here if activeWorldName is passed in
/** @typedef {import('../core/services/worldLoader.js').default} WorldLoader */
/** @typedef {import('../../data/schemas/mod.manifest.schema.json').ModManifest} ModManifest */

// --- Import Tokens ---
import { tokens } from '../config/tokens.js';
// --- MODIFICATION START: Import the component ID constant ---
import { CURRENT_ACTOR_COMPONENT_ID } from '../constants/componentIds.js'; // Assuming path is correct relative to this file
// --- MODIFICATION END ---

class GamePersistenceService extends IGamePersistenceService {
     * @private
  #logger;
     * @private
  #saveLoadService;
     * @private
  #entityManager;
     * @private
  #dataRegistry;
     * @private
  #playtimeTracker;
     * @private
  #container; // Still needed if other services are resolved for restoration/capture

  constructor({
    logger,
    saveLoadService,
    entityManager,
    dataRegistry,
    playtimeTracker,
    container,
  }) {
    super();
    const missingDependencies = [];
    if (!logger) missingDependencies.push('logger');
    if (!saveLoadService) missingDependencies.push('saveLoadService');
    if (!entityManager) missingDependencies.push('entityManager');
    if (!dataRegistry) missingDependencies.push('dataRegistry');
    if (!playtimeTracker) missingDependencies.push('playtimeTracker');
    if (!container) missingDependencies.push('container'); // Keep if other resolutions are needed

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

  /**
   * @param obj
   * @private
   */
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

  /**
   * Captures the current game state.
   * @param {string | null | undefined} activeWorldName - The name of the currently active world, passed from GameEngine.
   * @returns {SaveGameStructure} The captured game state object.
   */
  captureCurrentGameState(activeWorldName) {
    this.#logger.info(
      'GamePersistenceService: Capturing current game state...'
    );

    if (!this.#entityManager)
      throw new Error('EntityManager not available for capturing game state.');
    if (!this.#dataRegistry)
      throw new Error('DataRegistry not available for capturing mod manifest.');
    if (!this.#playtimeTracker)
      throw new Error(
        'PlaytimeTracker not available for capturing game state.'
      );
    // AppContainer might still be needed if other parts of gameState.engineInternals are resolved.

    const entitiesData = [];
    for (const entity of this.#entityManager.activeEntities.values()) {
      const components = {};
      for (const [componentTypeId, componentData] of entity.componentEntries) {
        // --- MODIFICATION START: Filter out core:current_actor component ---
        if (componentTypeId === CURRENT_ACTOR_COMPONENT_ID) {
          this.#logger.debug(
            `GamePersistenceService.captureCurrentGameState: Skipping component '${CURRENT_ACTOR_COMPONENT_ID}' for entity '${entity.id}' during save.`
          );
          continue; // Skip this component, do not add to save data
        }
        // --- MODIFICATION END ---
        components[componentTypeId] = this.#deepClone(componentData);
      }
      entitiesData.push({
        instanceId: entity.id,
        definitionId: entity.definitionId,
        components: components,
      });
    }
    this.#logger.debug(
      `GamePersistenceService: Captured ${entitiesData.length} entities.`
    );

    let activeModsManifest = [];
    /** @type {ModManifest[]} */
    const loadedManifestObjects = this.#dataRegistry.getAll('mod_manifests');

    if (loadedManifestObjects && loadedManifestObjects.length > 0) {
      activeModsManifest = loadedManifestObjects.map((manifest) => ({
        modId: manifest.id,
        version: manifest.version,
      }));
      this.#logger.debug(
        `GamePersistenceService: Captured ${activeModsManifest.length} active mods from 'mod_manifests' type in registry.`
      );
    } else {
      this.#logger.warn(
        'GamePersistenceService: No mod manifests found in registry under "mod_manifests" type. Mod manifest may be incomplete. Using fallback.'
      );
      const coreModManifest = loadedManifestObjects?.find(
        (m) => m.id === 'core'
      );
      if (coreModManifest) {
        activeModsManifest = [
          { modId: 'core', version: coreModManifest.version },
        ];
      } else {
        activeModsManifest = [{ modId: 'core', version: 'unknown_fallback' }];
      }
      this.#logger.debug(
        'GamePersistenceService: Used fallback for mod manifest.'
      );
    }

    // REMOVED: Attempt to get currentTurn from TurnManager as it's not restored.
    // let currentTurn = 0; // Default if not saving turn state related to TurnManager

    const currentWorldNameForMeta = activeWorldName || 'Unknown Game';
    if (!activeWorldName) {
      this.#logger.warn(
        `GamePersistenceService.captureCurrentGameState: No activeWorldName was provided by the caller. Defaulting gameTitle to 'Unknown Game'.`
      );
    }

    const currentTotalPlaytime = this.#playtimeTracker.getTotalPlaytime();
    this.#logger.debug(
      `GamePersistenceService: Fetched total playtime: ${currentTotalPlaytime}s.`
    );

    const gameStateObject = {
      metadata: {
        saveFormatVersion: '1.0.0',
        engineVersion: '0.1.0-stub',
        gameTitle: currentWorldNameForMeta,
        timestamp: new Date().toISOString(),
        playtimeSeconds: currentTotalPlaytime,
        saveName: '',
      },
      modManifest: {
        activeMods: activeModsManifest,
      },
      gameState: {
        entities: entitiesData,
        playerState: {},
        worldState: {},
        engineInternals: {
          // currentTurn: currentTurn, // Property removed
          // Other engine internals that *should* be persisted can go here.
          // If currentTurn was the only property, engineInternals can be an empty object.
        },
      },
      integrityChecks: {
        gameStateChecksum: 'PENDING_CALCULATION',
      },
    };

    this.#logger.info(
      `GamePersistenceService: Game state capture complete. Game Title: ${currentWorldNameForMeta}, ${entitiesData.length} entities captured. Playtime: ${currentTotalPlaytime}s.`
    );
    return gameStateObject;
  }

  isSavingAllowed(isEngineInitialized) {
    if (!isEngineInitialized) {
      this.#logger.warn(
        'GamePersistenceService.isSavingAllowed: Save attempt while engine not initialized.'
      );
      return false;
    }
    this.#logger.debug(
      'GamePersistenceService.isSavingAllowed: Check returned true (currently a basic stub).'
    );
    return true;
  }

  async saveGame(saveName, isEngineInitialized, activeWorldName) {
    this.#logger.info(
      `GamePersistenceService: Manual save triggered with name: "${saveName}". Active world hint: "${activeWorldName || 'N/A'}".`
    );

    if (!this.#saveLoadService) {
      const errorMsg = 'SaveLoadService is not available. Cannot save game.';
      this.#logger.error(`GamePersistenceService.saveGame: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    if (!this.isSavingAllowed(isEngineInitialized)) {
      const errorMsg = 'Saving is not currently allowed.';
      this.#logger.warn(
        `GamePersistenceService.saveGame: Saving is not currently allowed.`
      );
      return { success: false, error: errorMsg };
    }

    try {
      this.#logger.debug(
        `GamePersistenceService.saveGame: Capturing current game state for save "${saveName}".`
      );
      const gameStateObject = this.captureCurrentGameState(activeWorldName);
      if (!gameStateObject.metadata) gameStateObject.metadata = {};
      gameStateObject.metadata.saveName = saveName;
      this.#logger.debug(
        `GamePersistenceService.saveGame: Set saveName "${saveName}" in gameStateObject.metadata.`
      );

      this.#logger.info(
        `GamePersistenceService.saveGame: Delegating to ISaveLoadService.saveManualGame for "${saveName}".`
      );
      const result = await this.#saveLoadService.saveManualGame(
        saveName,
        gameStateObject
      );

      if (result.success) {
        this.#logger.info(
          `GamePersistenceService.saveGame: Manual save successful: ${result.message || `Save "${saveName}" completed.`}`
        );
      } else {
        this.#logger.error(
          `GamePersistenceService.saveGame: Manual save failed: ${result.error || 'Unknown error from SaveLoadService.'}`
        );
      }
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred.';
      this.#logger.error(
        `GamePersistenceService.saveGame: An unexpected error occurred during saveGame for "${saveName}": ${errorMessage}`,
        error
      );
      return {
        success: false,
        error: `Unexpected error during save: ${errorMessage}`,
      };
    }
  }

  async restoreGameState(deserializedSaveData) {
    this.#logger.info(
      'GamePersistenceService.restoreGameState: Starting game state restoration...'
    );

    if (!deserializedSaveData?.gameState) {
      const errorMsg =
        'Invalid save data structure provided (missing gameState).';
      this.#logger.error(
        `GamePersistenceService.restoreGameState: ${errorMsg}`
      );
      return { success: false, error: errorMsg };
    }
    if (!this.#entityManager)
      return { success: false, error: 'EntityManager not available.' };
    if (!this.#playtimeTracker)
      return { success: false, error: 'PlaytimeTracker not available.' };

    try {
      this.#entityManager.clearAll();
      this.#logger.debug(
        'GamePersistenceService.restoreGameState: Existing entity state cleared.'
      );
    } catch (error) {
      const errorMsg = `Failed to clear existing entity state: ${error.message}`;
      this.#logger.error(
        `GamePersistenceService.restoreGameState: ${errorMsg}`,
        error
      );
      return {
        success: false,
        error: `Critical error during state clearing: ${errorMsg}`,
      };
    }

    this.#logger.info(
      'GamePersistenceService.restoreGameState: Restoring entities...'
    );
    const entitiesToRestore = deserializedSaveData.gameState.entities;

    if (!Array.isArray(entitiesToRestore)) {
      this.#logger.warn(
        'GamePersistenceService.restoreGameState: entitiesToRestore is not an array. No entities will be restored.'
      );
    } else {
      for (const savedEntityData of entitiesToRestore) {
        if (!savedEntityData?.instanceId || !savedEntityData?.definitionId) {
          this.#logger.warn(
            `GamePersistenceService.restoreGameState: Invalid entity data in save (missing instanceId or definitionId). Skipping. Data: ${JSON.stringify(savedEntityData)}`
          );
          continue;
        }
        try {
          const restoredEntity =
            this.#entityManager.reconstructEntity(savedEntityData);
          if (!restoredEntity) {
            this.#logger.warn(
              `GamePersistenceService.restoreGameState: Failed to restore entity with instanceId: ${savedEntityData.instanceId} (Def: ${savedEntityData.definitionId}). reconstructEntity indicated failure.`
            );
          }
        } catch (entityError) {
          this.#logger.warn(
            `GamePersistenceService.restoreGameState: Error during reconstructEntity for instanceId: ${savedEntityData.instanceId}. Error: ${entityError.message}. Skipping.`,
            entityError
          );
        }
      }
    }
    this.#logger.info(
      'GamePersistenceService.restoreGameState: Entity restoration complete.'
    );

    if (
      deserializedSaveData.metadata &&
      typeof deserializedSaveData.metadata.playtimeSeconds === 'number'
    ) {
      try {
        this.#playtimeTracker.setAccumulatedPlaytime(
          deserializedSaveData.metadata.playtimeSeconds
        );
        this.#logger.info(
          `GamePersistenceService.restoreGameState: Restored accumulated playtime: ${deserializedSaveData.metadata.playtimeSeconds}s.`
        );
      } catch (playtimeError) {
        this.#logger.error(
          `GamePersistenceService.restoreGameState: Error setting accumulated playtime: ${playtimeError.message}. Resetting.`,
          playtimeError
        );
        this.#playtimeTracker.setAccumulatedPlaytime(0);
      }
    } else {
      this.#logger.warn(
        'GamePersistenceService.restoreGameState: Playtime data not found/invalid. Resetting playtime.'
      );
      this.#playtimeTracker.setAccumulatedPlaytime(0);
    }

    // --- MODIFICATION START ---
    // Removed the entire block that attempted to resolve ITurnManager
    // and call setCurrentTurn. This is because:
    // 1. The user does not want to persist or restore turn count.
    // 2. The GameEngine already stops and restarts the TurnManager during load,
    //    effectively resetting its state.
    // 3. The TurnManager did not have a setCurrentTurn method, causing the warning.
    this.#logger.info(
      'GamePersistenceService.restoreGameState: Skipping turn count restoration as TurnManager is restarted on load.'
    );
    // --- MODIFICATION END ---

    this.#logger.debug(
      'GamePersistenceService.restoreGameState: Placeholder for PlayerState/WorldState restoration.'
    );
    this.#logger.info(
      'GamePersistenceService.restoreGameState: Game state restoration process complete.'
    );
    return { success: true };
  }

  async loadAndRestoreGame(saveIdentifier) {
    this.#logger.info(
      `GamePersistenceService: Attempting to load and restore game from: ${saveIdentifier}.`
    );
    if (!this.#saveLoadService) {
      return {
        success: false,
        error: 'SaveLoadService is not available.',
        data: null,
      };
    }

    let loadResult;
    try {
      loadResult = await this.#saveLoadService.loadGameData(saveIdentifier);
    } catch (serviceError) {
      const errorMsg = `Unexpected error calling SaveLoadService.loadGameData for "${saveIdentifier}": ${serviceError.message}`;
      this.#logger.error(
        `GamePersistenceService.loadAndRestoreGame: ${errorMsg}`,
        serviceError
      );
      return {
        success: false,
        error: `Unexpected error during data loading: ${serviceError.message}`,
        data: null,
      };
    }

    if (!loadResult?.success || !loadResult?.data) {
      const reason = loadResult?.error || 'Load failed or no data returned.';
      this.#logger.error(
        `GamePersistenceService.loadAndRestoreGame: Failed to load raw game data from ${saveIdentifier}. Reason: ${reason}`
      );
      return {
        success: false,
        error: loadResult?.error || 'Failed to load raw game data.',
        data: null,
      };
    }

    this.#logger.info(
      `GamePersistenceService.loadAndRestoreGame: Raw game data loaded from ${saveIdentifier}. Restoring state.`
    );
    const gameDataToRestore = /** @type {SaveGameStructure} */ (
      loadResult.data
    );
    const restoreResult = await this.restoreGameState(gameDataToRestore);

    if (restoreResult.success) {
      this.#logger.info(
        `GamePersistenceService.loadAndRestoreGame: Game state restored successfully for ${saveIdentifier}.`
      );
      return { success: true, data: gameDataToRestore };
    } else {
      this.#logger.error(
        `GamePersistenceService.loadAndRestoreGame: Failed to restore game state for ${saveIdentifier}. Error: ${restoreResult.error}`
      );
      return {
        success: false,
        error: restoreResult.error || 'Failed to restore game state.',
        data: null,
      };
    }
  }
}

export default GamePersistenceService;
