// src/engine/persistenceCoordinator.js

import {
  GAME_SAVED_ID,
  ENGINE_OPERATION_IN_PROGRESS_UI,
  ENGINE_READY_UI,
} from '../constants/eventIds.js';

/**
 * @typedef {import('./engineState.js').default} EngineState
 * @typedef {import('../interfaces/IGamePersistenceService.js').IGamePersistenceService} IGamePersistenceService
 * @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('./gameSessionManager.js').default} GameSessionManager
 * @typedef {import('../interfaces/ISaveLoadService.js').SaveGameStructure} SaveGameStructure
 * @typedef {import('../interfaces/IGamePersistenceService.js').SaveResult} SaveResult
 */

/**
 * Handles persistence operations such as saving and loading the game.
 *
 * @class PersistenceCoordinator
 */
class PersistenceCoordinator {
  /** @type {ILogger} */
  #logger;
  /** @type {IGamePersistenceService} */
  #persistenceService;
  /** @type {ISafeEventDispatcher} */
  #dispatcher;
  /** @type {GameSessionManager} */
  #sessionManager;
  /** @type {EngineState} */
  #state;
  /** @type {(err: string | Error, id: string) => Promise<{success: false, error: string, data: null}>} */
  #handleLoadFailure;

  /**
   * Creates a new PersistenceCoordinator instance.
   *
   * @param {object} deps - Constructor dependencies.
   * @param {ILogger} deps.logger - Logger instance.
   * @param {IGamePersistenceService} deps.gamePersistenceService - Persistence service.
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher - Dispatcher for UI events.
   * @param {GameSessionManager} deps.sessionManager - Session manager instance.
   * @param {EngineState} deps.engineState - Engine state reference.
   * @param {(err: string | Error, id: string) => Promise<{success: false, error: string, data: null}>} deps.handleLoadFailure - Handler for load failures.
   */
  constructor({
    logger,
    gamePersistenceService,
    safeEventDispatcher,
    sessionManager,
    engineState,
    handleLoadFailure,
  }) {
    this.#logger = logger;
    this.#persistenceService = gamePersistenceService;
    this.#dispatcher = safeEventDispatcher;
    this.#sessionManager = sessionManager;
    this.#state = engineState;
    this.#handleLoadFailure = handleLoadFailure;
  }

  /**
   * Triggers a manual save of the current game state.
   *
   * @param {string} saveName - Desired save name.
   * @returns {Promise<SaveResult>} Result of the save operation.
   */
  async triggerManualSave(saveName) {
    this.#logger.debug(
      `GameEngine.triggerManualSave: Manual save process initiated with name: "${saveName}"`
    );

    if (!this.#state.isInitialized) {
      const errorMsg = 'Game engine is not initialized. Cannot save game.';
      this.#logger.error(`GameEngine.triggerManualSave: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    if (!this.#persistenceService) {
      const errorMsg =
        'GamePersistenceService is not available. Cannot save game.';
      this.#logger.error(`GameEngine.triggerManualSave: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    /** @type {SaveResult} */
    let saveResult;

    try {
      this.#logger.debug(
        `GameEngine.triggerManualSave: Dispatching ENGINE_OPERATION_IN_PROGRESS_UI for save: "${saveName}".`
      );
      await this.#dispatcher.dispatch(ENGINE_OPERATION_IN_PROGRESS_UI, {
        titleMessage: 'Saving...',
        inputDisabledMessage: `Saving game "${saveName}"...`,
      });

      saveResult = await this.#persistenceService.saveGame(
        saveName,
        true,
        this.#state.activeWorld
      );

      if (saveResult.success) {
        this.#logger.debug(
          `GameEngine.triggerManualSave: Save successful. Name: "${saveName}", Path: ${saveResult.filePath || 'N/A'}`
        );

        await this.#dispatcher.dispatch(GAME_SAVED_ID, {
          saveName: saveName,
          path: saveResult.filePath,
          type: 'manual',
        });
        this.#logger.debug(
          `GameEngine.triggerManualSave: Dispatched GAME_SAVED_ID for "${saveName}".`
        );

        this.#logger.debug(
          `GameEngine.triggerManualSave: Save successful. Name: "${saveName}".`
        );
      } else {
        this.#logger.error(
          `GameEngine.triggerManualSave: Save failed. Name: "${saveName}". Reported error: ${saveResult.error}`
        );
        this.#logger.debug(
          `GameEngine.triggerManualSave: Save failed. Name: "${saveName}".`
        );
      }
    } catch (error) {
      const caughtErrorMsg =
        error instanceof Error ? error.message : String(error);
      this.#logger.error(
        `GameEngine.triggerManualSave: Unexpected error during save operation for "${saveName}". Error: ${caughtErrorMsg}`,
        error
      );

      saveResult = {
        success: false,
        error: `Unexpected error during save: ${caughtErrorMsg}`,
      };
    } finally {
      this.#logger.debug(
        `GameEngine.triggerManualSave: Dispatching ENGINE_READY_UI after save attempt for "${saveName}".`
      );
      await this.#dispatcher.dispatch(ENGINE_READY_UI, {
        activeWorld: this.#state.activeWorld,
        message: 'Save operation finished. Ready.',
      });
    }
    return saveResult;
  }

  /**
   * Calls the persistence service to load and restore game data.
   *
   * @param {string} saveIdentifier - Identifier of the save to load.
   * @returns {Promise<import('../interfaces/IGamePersistenceService.js').LoadAndRestoreResult>} Outcome of the load.
   */
  async _executeLoadAndRestore(saveIdentifier) {
    this.#logger.debug(
      `GameEngine._executeLoadAndRestore: Calling IGamePersistenceService.loadAndRestoreGame for "${saveIdentifier}"...`
    );
    const restoreOutcome =
      await this.#persistenceService.loadAndRestoreGame(saveIdentifier);
    this.#logger.debug(
      `GameEngine._executeLoadAndRestore: Load and restore call completed for "${saveIdentifier}". Success: ${restoreOutcome.success}`
    );
    return restoreOutcome;
  }

  /**
   * Loads a game from a save identifier.
   *
   * @param {string} saveIdentifier - Identifier of the save.
   * @returns {Promise<{success: boolean, error?: string, data?: SaveGameStructure | null}>} Result of the load attempt.
   */
  async loadGame(saveIdentifier) {
    this.#logger.debug(
      `GameEngine: loadGame called for identifier: ${saveIdentifier}`
    );

    if (!this.#persistenceService) {
      const errorMsg =
        'GamePersistenceService is not available. Cannot load game.';
      const fullMsg = `GameEngine.loadGame: ${errorMsg}`;
      this.#logger.error(fullMsg);
      this.#state.reset();
      return { success: false, error: fullMsg, data: null };
    }

    try {
      await this.#sessionManager.prepareForLoadGameSession(saveIdentifier);
      const restoreOutcome = await this._executeLoadAndRestore(saveIdentifier);

      if (restoreOutcome.success && restoreOutcome.data) {
        const loadedSaveData = /** @type {SaveGameStructure} */ (
          restoreOutcome.data
        );
        return await this.#sessionManager.finalizeLoadSuccess(
          loadedSaveData,
          saveIdentifier
        );
      } else {
        const loadError =
          restoreOutcome.error ||
          'Restored data was missing or load operation failed.';
        this.#logger.warn(
          `GameEngine: Load/restore operation reported failure for "${saveIdentifier}".`
        );
        return await this.#handleLoadFailure(loadError, saveIdentifier);
      }
    } catch (error) {
      const caughtError =
        error instanceof Error ? error : new Error(String(error));
      this.#logger.error(
        `GameEngine: Overall catch in loadGame for identifier "${saveIdentifier}". Error: ${caughtError.message || String(caughtError)}`,
        caughtError
      );
      return await this.#handleLoadFailure(caughtError, saveIdentifier);
    }
  }
}

export default PersistenceCoordinator;
