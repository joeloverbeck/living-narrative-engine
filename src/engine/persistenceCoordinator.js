// src/engine/persistenceCoordinator.js

import {
  GAME_SAVED_ID,
  ENGINE_OPERATION_IN_PROGRESS_UI,
  ENGINE_READY_UI,
  ENGINE_OPERATION_FAILED_UI,
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
   * Dispatches UI events indicating a save is in progress.
   *
   * @private
   * @param {string} saveName - Name of the save being created.
   * @returns {Promise<void>} Resolves when the event is dispatched.
   */
  async #dispatchSavingUI(saveName) {
    this.#logger.debug(
      `GameEngine.triggerManualSave: Dispatching ENGINE_OPERATION_IN_PROGRESS_UI for save: "${saveName}".`
    );
    try {
      const progressDispatched = await this.#dispatcher.dispatch(
        ENGINE_OPERATION_IN_PROGRESS_UI,
        {
          titleMessage: 'Saving...',
          inputDisabledMessage: `Saving game "${saveName}"...`,
        }
      );

      if (!progressDispatched) {
        this.#logger.warn(
          `GameEngine.triggerManualSave: SafeEventDispatcher reported failure when dispatching ENGINE_OPERATION_IN_PROGRESS_UI for save "${saveName}".`
        );
      }
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error(String(error));
      this.#logger.error(
        `GameEngine.triggerManualSave: SafeEventDispatcher threw when dispatching ENGINE_OPERATION_IN_PROGRESS_UI for save "${saveName}". Error: ${normalizedError.message}`,
        normalizedError
      );
    }
  }

  /**
   * Performs the actual save via the persistence service.
   *
   * @private
   * @param {string} saveName - Save name.
   * @returns {Promise<SaveResult & {saveName: string}>} Result from the persistence service.
   */
  async #performSave(saveName) {
    try {
      const rawResult = await this.#persistenceService.saveGame(
        saveName,
        this.#state.isInitialized,
        this.#state.activeWorld
      );

      if (
        !rawResult ||
        typeof rawResult !== 'object' ||
        typeof rawResult.success !== 'boolean'
      ) {
        const receivedType = rawResult === null ? 'null' : typeof rawResult;
        this.#logger.error(
          `GameEngine.triggerManualSave: Persistence service returned invalid result for "${saveName}".`,
          {
            receivedType,
            receivedValue: rawResult,
          }
        );
        return {
          success: false,
          error: 'Persistence service returned an invalid save result.',
          saveName,
        };
      }

      return { ...rawResult, saveName };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.#logger.error(
        `GameEngine.triggerManualSave: Unexpected error during save operation for "${saveName}". Error: ${errorMessage}`,
        error
      );
      return {
        success: false,
        error: `Unexpected error during save: ${errorMessage}`,
        saveName,
      };
    }
  }

  /**
   * Formats persistence-layer errors so log entries remain readable.
   *
   * @private
   * @description Normalizes persistence-layer errors for log output.
   * @param {unknown} error - Error value returned by the persistence service.
   * @returns {string} Readable description of the error.
   */
  #formatSaveError(error) {
    if (error instanceof Error) {
      return error.message || 'Unknown error.';
    }

    if (typeof error === 'string') {
      const trimmed = error.trim();
      return trimmed || 'Unknown error.';
    }

    if (typeof error === 'number' || typeof error === 'boolean') {
      return String(error);
    }

    if (error && typeof error === 'object') {
      const message =
        typeof error.message === 'string' ? error.message.trim() : '';
      if (message) {
        return message;
      }

      try {
        const serialized = JSON.stringify(error);
        if (serialized && serialized !== '{}' && serialized !== '[]') {
          return serialized;
        }
      } catch (serializationError) {
        this.#logger.debug(
          'GameEngine.triggerManualSave: Failed to serialize persistence error for logging.',
          serializationError
        );
      }
    }

    return 'Unknown error.';
  }

  /**
   * Dispatches UI events corresponding to the save result and final ready state.
   *
   * @private
   * @param {SaveResult & {saveName: string}} saveResult - Result of the save operation.
   * @returns {Promise<void>} Resolves when UI updates have been dispatched.
   */
  async #dispatchSaveResult(saveResult) {
    const { saveName } = saveResult;
    if (saveResult.success) {
      this.#logger.debug(
        `GameEngine.triggerManualSave: Save successful. Name: "${saveName}", Path: ${saveResult.filePath || 'N/A'}`
      );
      let savedDispatched = true;
      try {
        savedDispatched = await this.#dispatcher.dispatch(GAME_SAVED_ID, {
          saveName,
          path: saveResult.filePath,
          type: 'manual',
        });
      } catch (error) {
        const normalizedError =
          error instanceof Error ? error : new Error(String(error));
        savedDispatched = null;
        this.#logger.error(
          `GameEngine.triggerManualSave: SafeEventDispatcher threw when dispatching GAME_SAVED_ID for save "${saveName}". Error: ${normalizedError.message}`,
          normalizedError
        );
      }
      if (savedDispatched === true) {
        this.#logger.debug(
          `GameEngine.triggerManualSave: Dispatched GAME_SAVED_ID for "${saveName}".`
        );
      }
      this.#logger.debug(
        `GameEngine.triggerManualSave: Save successful. Name: "${saveName}".`
      );

      if (savedDispatched === false) {
        this.#logger.warn(
          `GameEngine.triggerManualSave: SafeEventDispatcher reported failure when dispatching GAME_SAVED_ID for save "${saveName}".`
        );
      }
    } else {
      const formattedError = this.#formatSaveError(saveResult.error);
      this.#logger.error(
        `GameEngine.triggerManualSave: Save failed. Name: "${saveName}". Reported error: ${formattedError}`
      );
      this.#logger.debug(
        `GameEngine.triggerManualSave: Save failed. Name: "${saveName}".`
      );
      let failureDispatched = true;
      try {
        failureDispatched = await this.#dispatcher.dispatch(
          ENGINE_OPERATION_FAILED_UI,
          {
            errorMessage: `Failed to save game: ${formattedError}`,
            errorTitle: 'Save Failed',
          }
        );
      } catch (error) {
        const normalizedError =
          error instanceof Error ? error : new Error(String(error));
        failureDispatched = null;
        this.#logger.error(
          `GameEngine.triggerManualSave: SafeEventDispatcher threw when dispatching ENGINE_OPERATION_FAILED_UI for save "${saveName}". Error: ${normalizedError.message}`,
          normalizedError
        );
      }

      if (failureDispatched === false) {
        this.#logger.warn(
          `GameEngine.triggerManualSave: SafeEventDispatcher reported failure when dispatching ENGINE_OPERATION_FAILED_UI for save "${saveName}".`
        );
      }
    }

    this.#logger.debug(
      `GameEngine.triggerManualSave: Dispatching ENGINE_READY_UI after save attempt for "${saveName}".`
    );
    try {
      const readyDispatched = await this.#dispatcher.dispatch(ENGINE_READY_UI, {
        activeWorld: this.#state.activeWorld,
        message: 'Save operation finished. Ready.',
      });

      if (!readyDispatched) {
        this.#logger.warn(
          `GameEngine.triggerManualSave: SafeEventDispatcher reported failure when dispatching ENGINE_READY_UI after save "${saveName}".`
        );
      }
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error(String(error));
      this.#logger.error(
        `GameEngine.triggerManualSave: SafeEventDispatcher threw when dispatching ENGINE_READY_UI after save "${saveName}". Error: ${normalizedError.message}`,
        normalizedError
      );
    }
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
      await this.#dispatchSaveResult({
        success: false,
        error: errorMsg,
        saveName,
      });
      return { success: false, error: errorMsg };
    }

    if (!this.#persistenceService) {
      const errorMsg =
        'GamePersistenceService is not available. Cannot save game.';
      this.#logger.error(`GameEngine.triggerManualSave: ${errorMsg}`);
      await this.#dispatchSaveResult({
        success: false,
        error: errorMsg,
        saveName,
      });
      return { success: false, error: errorMsg };
    }

    await this.#dispatchSavingUI(saveName);

    const saveResultWithName = await this.#performSave(saveName);

    await this.#dispatchSaveResult(saveResultWithName);

    const { saveName: _ignored, ...result } = saveResultWithName;
    return result;
  }

  /**
   * Calls the persistence service to load and restore game data.
   *
   * @param {string} saveIdentifier - Identifier of the save to load.
   * @returns {Promise<import('../interfaces/IGamePersistenceService.js').LoadAndRestoreResult>} Outcome of the load.
   */
  async #executeLoadAndRestore(saveIdentifier) {
    this.#logger.debug(
      `GameEngine._executeLoadAndRestore: Calling IGamePersistenceService.loadAndRestoreGame for "${saveIdentifier}"...`
    );
    const restoreOutcome =
      await this.#persistenceService.loadAndRestoreGame(saveIdentifier);

    if (
      !restoreOutcome ||
      typeof restoreOutcome !== 'object' ||
      typeof restoreOutcome.success !== 'boolean'
    ) {
      const receivedType =
        restoreOutcome === null ? 'null' : typeof restoreOutcome;
      this.#logger.error(
        `GameEngine._executeLoadAndRestore: Persistence service returned invalid result for "${saveIdentifier}".`,
        {
          receivedType,
          receivedValue: restoreOutcome,
        }
      );
      return {
        success: false,
        error: 'Persistence service returned an invalid load result.',
        data: null,
      };
    }

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
      return await this.#handleLoadFailure(fullMsg, saveIdentifier);
    }

    try {
      await this.#sessionManager.prepareForLoadGameSession(saveIdentifier);
      const restoreOutcome = await this.#executeLoadAndRestore(saveIdentifier);

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
