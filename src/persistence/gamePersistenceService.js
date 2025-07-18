import { BaseService } from '../utils/serviceBase.js';

/** @typedef {import('../interfaces/IGamePersistenceService.js').IGamePersistenceService} IGamePersistenceService */

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
/** @typedef {import('../loaders/modsLoader.js').default} ModsLoader */
/** @typedef {import('./gameStateCaptureService.js').default} GameStateCaptureService */
/** @typedef {import('./manualSaveCoordinator.js').default} ManualSaveCoordinator */

// --- Import Tokens ---
// tokens import removed as not used after refactor

import { PersistenceErrorCodes } from './persistenceErrors.js';
import {
  createPersistenceFailure,
  createPersistenceSuccess,
  normalizePersistenceFailure,
} from '../utils/persistenceResultUtils.js';
import { executePersistenceOp } from '../utils/persistenceErrorUtils.js';
/** @typedef {import('./gameStateRestorer.js').default} GameStateRestorer */

/**
 * @class GamePersistenceService
 * @description Handles capturing, saving, and restoring game state.
 * @implements {IGamePersistenceService}
 */
class GamePersistenceService extends BaseService {
  #logger;
  #saveLoadService;
  #gameStateRestorer;
  #manualSaveCoordinator;

  /**
   * Creates a new GamePersistenceService instance.
   *
   * @param {object} dependencies - Service dependencies.
   * @param {ILogger} dependencies.logger - Logging service.
   * @param {ISaveLoadService} dependencies.saveLoadService - Save/load service.
   * @param {EntityManager} dependencies.entityManager - Entity manager.
   * @param {PlaytimeTracker} dependencies.playtimeTracker - Playtime tracker.
   * @param {GameStateCaptureService} dependencies.gameStateCaptureService - Service capturing current game state.
   * @param {ManualSaveCoordinator} dependencies.manualSaveCoordinator - Coordinator for manual saves.
   * @param {GameStateRestorer} dependencies.gameStateRestorer - Game state restorer.
   */
  constructor({
    logger,
    saveLoadService,
    entityManager,
    playtimeTracker,
    gameStateCaptureService,
    manualSaveCoordinator,
    gameStateRestorer,
  }) {
    super();
    this.#logger = this._init('GamePersistenceService', logger, {
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
      manualSaveCoordinator: {
        value: manualSaveCoordinator,
        requiredMethods: ['saveGame'],
      },
      gameStateRestorer: {
        value: gameStateRestorer,
        requiredMethods: ['restoreGameState'],
      },
    });
    this.#saveLoadService = saveLoadService;
    // captureService dependencies validated via BaseService
    this.#manualSaveCoordinator = manualSaveCoordinator;
    this.#gameStateRestorer = gameStateRestorer;
    this.#logger.debug('GamePersistenceService: Instance created.');
  }

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

  /**
   * Determines whether a save operation can proceed.
   *
   * @description Checks dependencies and saving policy before attempting to save.
   * @param {boolean} isEngineInitialized - Whether the engine is fully initialized.
   * @returns {import('./persistenceTypes.js').PersistenceResult<boolean>} Result indicating permission.
   */
  #canSave(isEngineInitialized) {
    if (!this.#saveLoadService) {
      const errorMsg = 'SaveLoadService is not available. Cannot save game.';
      this.#logger.error(`GamePersistenceService.canSave: ${errorMsg}`);
      return createPersistenceFailure(
        PersistenceErrorCodes.UNEXPECTED_ERROR,
        errorMsg
      );
    }

    if (!this.isSavingAllowed(isEngineInitialized)) {
      const errorMsg = 'Saving is not currently allowed.';
      this.#logger.warn(
        'GamePersistenceService.canSave: Saving is not currently allowed.'
      );
      return createPersistenceFailure(
        PersistenceErrorCodes.UNEXPECTED_ERROR,
        errorMsg
      );
    }

    return createPersistenceSuccess(true);
  }

  async saveGame(saveName, isEngineInitialized, activeWorldName) {
    this.#logger.debug(
      `GamePersistenceService: Manual save triggered with name: "${saveName}". Active world hint: "${activeWorldName || 'N/A'}".`
    );

    const canSaveResult = this.#canSave(isEngineInitialized);
    if (!canSaveResult.success) {
      return canSaveResult;
    }

    return executePersistenceOp({
      asyncOperation: async () => {
        this.#logger.debug(
          `GamePersistenceService.saveGame: Delegating to ManualSaveCoordinator for "${saveName}".`
        );
        const result = await this.#manualSaveCoordinator.saveGame(
          saveName,
          activeWorldName
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
      },
      logger: this.#logger,
    });
  }

  async restoreGameState(deserializedSaveData) {
    return this.#gameStateRestorer.restoreGameState(deserializedSaveData);
  }

  async loadAndRestoreGame(saveIdentifier) {
    this.#logger.debug(
      `GamePersistenceService: Attempting to load and restore game from: ${saveIdentifier}.`
    );
    if (!this.#saveLoadService) {
      return {
        ...createPersistenceFailure(
          PersistenceErrorCodes.UNEXPECTED_ERROR,
          'SaveLoadService is not available.'
        ),
        data: null,
      };
    }

    const loadResult = await executePersistenceOp({
      asyncOperation: async () =>
        this.#saveLoadService.loadGameData(saveIdentifier),
      logger: this.#logger,
      context: 'GamePersistenceService.loadAndRestoreGame',
    });

    if (!loadResult?.success || !loadResult?.data) {
      const reason = loadResult?.error || 'Load failed or no data returned.';
      this.#logger.error(
        `GamePersistenceService.loadAndRestoreGame: Failed to load raw game data from ${saveIdentifier}. Reason: ${reason}`
      );
      return normalizePersistenceFailure(
        loadResult,
        PersistenceErrorCodes.UNEXPECTED_ERROR,
        loadResult?.error || 'Failed to load raw game data.'
      );
    }

    this.#logger.debug(
      `GamePersistenceService.loadAndRestoreGame: Raw game data loaded from ${saveIdentifier}. Restoring state.`
    );
    const gameDataToRestore = /** @type {SaveGameStructure} */ (
      loadResult.data
    );

    return this.#restoreAfterLoad(gameDataToRestore, saveIdentifier);
  }

  /**
   * Handles restoration of game data after a successful load.
   *
   * @private
   * @async
   * @param {SaveGameStructure} gameDataToRestore - The loaded save data.
   * @param {string} saveIdentifier - Identifier used for logging.
   * @returns {Promise<import('./persistenceTypes.js').PersistenceResult<SaveGameStructure>>}
   *   Result of the restoration process.
   */
  async #restoreAfterLoad(gameDataToRestore, saveIdentifier) {
    const restoreResult = await this.restoreGameState(gameDataToRestore);

    if (!restoreResult.success) {
      this.#logger.error(
        `GamePersistenceService.loadAndRestoreGame: Failed to restore game state for ${saveIdentifier}. Error: ${restoreResult.error}`
      );
      return normalizePersistenceFailure(
        restoreResult,
        PersistenceErrorCodes.UNEXPECTED_ERROR,
        restoreResult.error || 'Failed to restore game state.'
      );
    }

    this.#logger.debug(
      `GamePersistenceService.loadAndRestoreGame: Game state restored successfully for ${saveIdentifier}.`
    );
    return createPersistenceSuccess(gameDataToRestore);
  }
}

export default GamePersistenceService;
