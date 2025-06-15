import { IGamePersistenceService } from '../interfaces/IGamePersistenceService.js';
import { setupService } from '../utils/serviceInitializer.js';

// --- JSDoc Type Imports ---
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/ISaveLoadService.js').ISaveLoadService} ISaveLoadService */
/** @typedef {import('../interfaces/ISaveLoadService.js').SaveGameStructure} SaveGameStructure */
/** @typedef {import('../interfaces/ISaveLoadService.js').LoadGameResult} LoadGameResult */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../engine/playtimeTracker.js').default} PlaytimeTracker */
/** @typedef {import('../dependencyInjection/appContainer.js').default} AppContainer */
/** @typedef {import('../turns/interfaces/ITurnManager.js').ITurnManager} ITurnManager */
/** @typedef {import('../loaders/worldLoader.js').default} WorldLoader */

// --- Import Tokens ---
// tokens import removed as not used after refactor

// --- MODIFICATION START: Import component IDs for cleaning logic ---
import {
  PersistenceError,
  PersistenceErrorCodes,
} from './persistenceErrors.js';
// --- MODIFICATION END ---

/**
 * @class GamePersistenceService
 * @description Handles capturing, saving, and restoring game state.
 * @implements {IGamePersistenceService}
 */
class GamePersistenceService extends IGamePersistenceService {
  #logger;
  #saveLoadService;
  #entityManager;
  #playtimeTracker;
  #gameStateCaptureService;

  /**
   * Creates a new GamePersistenceService instance.
   *
   * @param {object} dependencies - Service dependencies.
   * @param {ILogger} dependencies.logger - Logging service.
   * @param {ISaveLoadService} dependencies.saveLoadService - Save/load service.
   * @param {EntityManager} dependencies.entityManager - Entity manager.
   * @param {PlaytimeTracker} dependencies.playtimeTracker - Playtime tracker.
   * @param {GameStateCaptureService} dependencies.gameStateCaptureService - Service capturing current game state.
   */
  constructor({
    logger,
    saveLoadService,
    entityManager,
    playtimeTracker,
    gameStateCaptureService,
  }) {
    super();
    this.#logger = setupService('GamePersistenceService', logger, {
      saveLoadService: {
        value: saveLoadService,
        requiredMethods: ['saveManualGame', 'loadGameData'],
      },
      entityManager: {
        value: entityManager,
        requiredMethods: ['clearAll', 'reconstructEntity'],
      },
      playtimeTracker: {
        value: playtimeTracker,
        requiredMethods: ['getTotalPlaytime', 'setAccumulatedPlaytime'],
      },
      gameStateCaptureService: {
        value: gameStateCaptureService,
        requiredMethods: ['captureCurrentGameState'],
      },
    });
    this.#saveLoadService = saveLoadService;
    this.#entityManager = entityManager;
    this.#playtimeTracker = playtimeTracker;
    this.#gameStateCaptureService = gameStateCaptureService;
    this.#logger.debug('GamePersistenceService: Instance created.');
  }

  /**
   * @description Restores a single serialized entity via the EntityManager.
   * @param {{instanceId: string, definitionId: string, components: Record<string, any>}} savedEntityData
   *   - Serialized entity data from the save file.
   * @returns {void}
   * @private
   */
  #restoreEntity(savedEntityData) {
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

  /**
   * @description Validates restore data and required dependencies.
   * @param {SaveGameStructure | any} data - Parsed save data object.
   * @returns {{success: false, error: PersistenceError} | null} Failure object or null if validation passes.
   * @private
   */
  #validateRestoreData(data) {
    if (!data?.gameState) {
      const errorMsg =
        'Invalid save data structure provided (missing gameState).';
      this.#logger.error(
        `GamePersistenceService.restoreGameState: ${errorMsg}`
      );
      return {
        success: false,
        error: new PersistenceError(
          PersistenceErrorCodes.INVALID_GAME_STATE,
          errorMsg
        ),
      };
    }
    if (!this.#entityManager)
      return {
        success: false,
        error: new PersistenceError(
          PersistenceErrorCodes.UNEXPECTED_ERROR,
          'EntityManager not available.'
        ),
      };
    if (!this.#playtimeTracker)
      return {
        success: false,
        error: new PersistenceError(
          PersistenceErrorCodes.UNEXPECTED_ERROR,
          'PlaytimeTracker not available.'
        ),
      };
    return null;
  }

  /**
   * @description Clears existing entities before restoration.
   * @returns {{success: false, error: PersistenceError} | null} Failure object or null on success.
   * @private
   */
  #clearExistingEntities() {
    try {
      this.#entityManager.clearAll();
      this.#logger.debug(
        'GamePersistenceService.restoreGameState: Existing entity state cleared.'
      );
      return null;
    } catch (error) {
      const errorMsg = `Failed to clear existing entity state: ${error.message}`;
      this.#logger.error(
        `GamePersistenceService.restoreGameState: ${errorMsg}`,
        error
      );
      return {
        success: false,
        error: new PersistenceError(
          PersistenceErrorCodes.UNEXPECTED_ERROR,
          `Critical error during state clearing: ${errorMsg}`
        ),
      };
    }
  }

  /**
   * @description Restores all serialized entities from save data.
   * @param {any[]} entitiesArray - Array of serialized entity records.
   * @returns {void}
   * @private
   */
  #restoreEntities(entitiesArray) {
    const entitiesToRestore = entitiesArray;
    if (!Array.isArray(entitiesToRestore)) {
      this.#logger.warn(
        'GamePersistenceService.restoreGameState: entitiesToRestore is not an array. No entities will be restored.'
      );
      return;
    }
    for (const savedEntityData of entitiesToRestore) {
      if (!savedEntityData?.instanceId || !savedEntityData?.definitionId) {
        this.#logger.warn(
          `GamePersistenceService.restoreGameState: Invalid entity data in save (missing instanceId or definitionId). Skipping. Data: ${JSON.stringify(savedEntityData)}`
        );
        continue;
      }
      this.#restoreEntity(savedEntityData);
    }
    this.#logger.debug(
      'GamePersistenceService.restoreGameState: Entity restoration complete.'
    );
  }

  /**
   * @description Restores accumulated playtime via PlaytimeTracker.
   * @param {number | undefined} playtimeSeconds - Total playtime from metadata.
   * @returns {void}
   * @private
   */
  #restorePlaytime(playtimeSeconds) {
    if (typeof playtimeSeconds === 'number') {
      try {
        this.#playtimeTracker.setAccumulatedPlaytime(playtimeSeconds);
        this.#logger.debug(
          `GamePersistenceService.restoreGameState: Restored accumulated playtime: ${playtimeSeconds}s.`
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
  }

  /**
   * Builds the active mods manifest section for the save data.
   *
   * @returns {{modId: string, version: string}[]} Array of active mod info.
   * @private
   */

  /**
   * Captures the current game state.
   *
   * @param {string | null | undefined} activeWorldName - The name of the currently active world, passed from GameEngine.
   * @returns {SaveGameStructure} The captured game state object.
   */

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
    this.#logger.debug(
      `GamePersistenceService: Manual save triggered with name: "${saveName}". Active world hint: "${activeWorldName || 'N/A'}".`
    );

    if (!this.#saveLoadService) {
      const errorMsg = 'SaveLoadService is not available. Cannot save game.';
      this.#logger.error(`GamePersistenceService.saveGame: ${errorMsg}`);
      return {
        success: false,
        error: new PersistenceError(
          PersistenceErrorCodes.UNEXPECTED_ERROR,
          errorMsg
        ),
      };
    }

    if (!this.isSavingAllowed(isEngineInitialized)) {
      const errorMsg = 'Saving is not currently allowed.';
      this.#logger.warn(
        `GamePersistenceService.saveGame: Saving is not currently allowed.`
      );
      return {
        success: false,
        error: new PersistenceError(
          PersistenceErrorCodes.UNEXPECTED_ERROR,
          errorMsg
        ),
      };
    }

    try {
      this.#logger.debug(
        `GamePersistenceService.saveGame: Capturing current game state for save "${saveName}".`
      );
      const gameStateObject =
        this.#gameStateCaptureService.captureCurrentGameState(activeWorldName);
      if (!gameStateObject.metadata) gameStateObject.metadata = {};
      gameStateObject.metadata.saveName = saveName;
      this.#logger.debug(
        `GamePersistenceService.saveGame: Set saveName "${saveName}" in gameStateObject.metadata.`
      );

      this.#logger.debug(
        `GamePersistenceService.saveGame: Delegating to ISaveLoadService.saveManualGame for "${saveName}".`
      );
      const result = await this.#saveLoadService.saveManualGame(
        saveName,
        gameStateObject
      );

      if (result.success) {
        this.#logger.debug(
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
        error:
          error instanceof PersistenceError
            ? error
            : new PersistenceError(
                PersistenceErrorCodes.UNEXPECTED_ERROR,
                `Unexpected error during save: ${errorMessage}`
              ),
      };
    }
  }

  async restoreGameState(deserializedSaveData) {
    this.#logger.debug(
      'GamePersistenceService.restoreGameState: Starting game state restoration...'
    );

    const validationError = this.#validateRestoreData(deserializedSaveData);
    if (validationError) return validationError;

    const clearingResult = this.#clearExistingEntities();
    if (clearingResult) return clearingResult;

    this.#logger.debug(
      'GamePersistenceService.restoreGameState: Restoring entities...'
    );

    this.#restoreEntities(deserializedSaveData.gameState.entities);
    this.#restorePlaytime(deserializedSaveData.metadata?.playtimeSeconds);

    this.#logger.debug(
      'GamePersistenceService.restoreGameState: Skipping turn count restoration as TurnManager is restarted on load.'
    );

    this.#logger.debug(
      'GamePersistenceService.restoreGameState: Placeholder for PlayerState/WorldState restoration.'
    );
    this.#logger.debug(
      'GamePersistenceService.restoreGameState: Game state restoration process complete.'
    );
    return { success: true };
  }

  async loadAndRestoreGame(saveIdentifier) {
    this.#logger.debug(
      `GamePersistenceService: Attempting to load and restore game from: ${saveIdentifier}.`
    );
    if (!this.#saveLoadService) {
      return {
        success: false,
        error: new PersistenceError(
          PersistenceErrorCodes.UNEXPECTED_ERROR,
          'SaveLoadService is not available.'
        ),
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
        error: new PersistenceError(
          PersistenceErrorCodes.UNEXPECTED_ERROR,
          `Unexpected error during data loading: ${serviceError.message}`
        ),
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
        error:
          loadResult?.error instanceof PersistenceError
            ? loadResult.error
            : new PersistenceError(
                PersistenceErrorCodes.UNEXPECTED_ERROR,
                loadResult?.error || 'Failed to load raw game data.'
              ),
        data: null,
      };
    }

    this.#logger.debug(
      `GamePersistenceService.loadAndRestoreGame: Raw game data loaded from ${saveIdentifier}. Restoring state.`
    );
    const gameDataToRestore = /** @type {SaveGameStructure} */ (
      loadResult.data
    );
    const restoreResult = await this.restoreGameState(gameDataToRestore);

    if (restoreResult.success) {
      this.#logger.debug(
        `GamePersistenceService.loadAndRestoreGame: Game state restored successfully for ${saveIdentifier}.`
      );
      return { success: true, data: gameDataToRestore };
    } else {
      this.#logger.error(
        `GamePersistenceService.loadAndRestoreGame: Failed to restore game state for ${saveIdentifier}. Error: ${restoreResult.error}`
      );
      return {
        success: false,
        error:
          restoreResult.error instanceof PersistenceError
            ? restoreResult.error
            : new PersistenceError(
                PersistenceErrorCodes.UNEXPECTED_ERROR,
                restoreResult.error || 'Failed to restore game state.'
              ),
        data: null,
      };
    }
  }
}

export default GamePersistenceService;
