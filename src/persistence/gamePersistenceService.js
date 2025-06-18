import { IGamePersistenceService } from '../interfaces/IGamePersistenceService.js';
import { setupService } from '../utils/serviceInitializerUtils.js';

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
import { wrapPersistenceOperation } from '../utils/persistenceErrorUtils.js';
import GameStateRestorer from './gameStateRestorer.js';

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
   * @param {GameStateRestorer} [dependencies.gameStateRestorer] - Optional game state restorer.
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
      manualSaveCoordinator: {
        value: manualSaveCoordinator,
        requiredMethods: ['saveGame'],
      },
      gameStateRestorer: gameStateRestorer
        ? { value: gameStateRestorer, requiredMethods: ['restoreGameState'] }
        : undefined,
    });
    this.#saveLoadService = saveLoadService;
    this.#entityManager = entityManager;
    this.#playtimeTracker = playtimeTracker;
    this.#gameStateCaptureService = gameStateCaptureService;
    this.#manualSaveCoordinator = manualSaveCoordinator;
    this.#gameStateRestorer =
      gameStateRestorer ||
      new GameStateRestorer({
        logger: this.#logger,
        entityManager: this.#entityManager,
        playtimeTracker: this.#playtimeTracker,
      });
    this.#logger.debug('GamePersistenceService: Instance created.');
  }

  /**
   * @description Captures the current game state via GameStateCaptureService.
   * @param {string | null | undefined} activeWorldName - Name of the currently active world.
   * @returns {SaveGameStructure} Captured game state object.
   * @private
   */
  _captureGameState(activeWorldName) {
    return this.#gameStateCaptureService.captureCurrentGameState(
      activeWorldName
    );
  }

  /**
   * @description Ensures metadata is present and sets the save name.
   * @param {SaveGameStructure} state - Game state object to update.
   * @param {string} saveName - Desired save name.
   * @returns {void}
   * @private
   */
  _setSaveMetadata(state, saveName) {
    if (!state.metadata) state.metadata = {};
    state.metadata.saveName = saveName;
  }

  /**
   * @description Persists game state via SaveLoadService.
   * @param {string} saveName - Name of the save slot.
   * @param {SaveGameStructure} state - Game state to persist.
   * @returns {Promise<{success: boolean, message?: string, error?: string, filePath?: string}>}
   *   Result from SaveLoadService.
   * @private
   */
  async _delegateManualSave(saveName, state) {
    return this.#saveLoadService.saveManualGame(saveName, state);
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
      return createPersistenceFailure(
        PersistenceErrorCodes.UNEXPECTED_ERROR,
        errorMsg
      );
    }

    if (!this.isSavingAllowed(isEngineInitialized)) {
      const errorMsg = 'Saving is not currently allowed.';
      this.#logger.warn(
        `GamePersistenceService.saveGame: Saving is not currently allowed.`
      );
      return createPersistenceFailure(
        PersistenceErrorCodes.UNEXPECTED_ERROR,
        errorMsg
      );
    }

    return wrapPersistenceOperation(this.#logger, async () => {
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

    const loadResult = await wrapPersistenceOperation(this.#logger, async () =>
      this.#saveLoadService.loadGameData(saveIdentifier)
    );

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
    const restoreResult = await this.restoreGameState(gameDataToRestore);

    if (restoreResult.success) {
      this.#logger.debug(
        `GamePersistenceService.loadAndRestoreGame: Game state restored successfully for ${saveIdentifier}.`
      );
      return createPersistenceSuccess(gameDataToRestore);
    } else {
      this.#logger.error(
        `GamePersistenceService.loadAndRestoreGame: Failed to restore game state for ${saveIdentifier}. Error: ${restoreResult.error}`
      );
      return normalizePersistenceFailure(
        restoreResult,
        PersistenceErrorCodes.UNEXPECTED_ERROR,
        restoreResult.error || 'Failed to restore game state.'
      );
    }
  }
}

export default GamePersistenceService;
