import { describe, it, expect, jest } from '@jest/globals';
import PersistenceCoordinator from '../../../src/engine/persistenceCoordinator.js';
import EngineState from '../../../src/engine/engineState.js';
import {
  createMockLogger,
  createMockGamePersistenceService,
  createMockSafeEventDispatcher,
} from '../../common/mockFactories/index.js';
import {
  expectDispatchSequence,
  buildSaveDispatches,
  buildFailedSaveDispatches,
  buildLoadFailureDispatches,
} from '../../common/engine/dispatchTestUtils.js';
import {
  DEFAULT_ACTIVE_WORLD_FOR_SAVE,
  DEFAULT_SAVE_NAME,
  DEFAULT_SAVE_ID,
  SAVE_OPERATION_FINISHED_MESSAGE,
} from '../../common/constants.js';
import {
  ENGINE_OPERATION_IN_PROGRESS_UI,
  ENGINE_OPERATION_FAILED_UI,
  ENGINE_READY_UI,
  GAME_SAVED_ID,
} from '../../../src/constants/eventIds.js';
import {
  PersistenceError,
  PersistenceErrorCodes,
} from '../../../src/persistence/persistenceErrors.js';
import { extractSaveName } from '../../../src/utils/savePathUtils.js';

/**
 * Helper to instantiate PersistenceCoordinator with mocks
 *
 * @param {object} overrides - Override values for dependencies
 * @returns {object} Test coordinator and its dependencies
 */
function createCoordinator(overrides = {}) {
  const {
    engineState: providedState,
    logger: providedLogger,
    safeEventDispatcher: providedDispatcher,
    gamePersistenceService: providedPersistenceService,
    sessionManager: providedSessionManager,
    handleLoadFailure: providedHandleLoadFailure,
    ...additionalOverrides
  } = overrides;

  const logger = providedLogger ?? createMockLogger();
  const dispatcher = providedDispatcher ?? createMockSafeEventDispatcher();
  const persistenceService =
    providedPersistenceService !== undefined
      ? providedPersistenceService
      : createMockGamePersistenceService();
  const sessionManager =
    providedSessionManager !== undefined
      ? providedSessionManager
      : {
          prepareForLoadGameSession: jest.fn(async (saveIdentifier) => {
            const displayName = extractSaveName(saveIdentifier);
            await dispatcher.dispatch(ENGINE_OPERATION_IN_PROGRESS_UI, {
              titleMessage: `Loading ${displayName}...`,
              inputDisabledMessage: `Loading game from ${displayName}...`,
            });
          }),
          finalizeLoadSuccess: jest.fn(),
        };
  const state = providedState ?? new EngineState();
  if (!providedState) {
    state.setStarted(DEFAULT_ACTIVE_WORLD_FOR_SAVE);
  }
  const handleLoadFailure =
    providedHandleLoadFailure ??
    jest.fn(async (err) => {
      state.reset();
      await dispatcher.dispatch(ENGINE_OPERATION_FAILED_UI, {
        errorMessage: `Failed to load game: ${err instanceof Error ? err.message : err}`,
        errorTitle: 'Load Failed',
      });
      return {
        success: false,
        error: err instanceof Error ? err.message : err,
        data: null,
      };
    });
  const coordinator = new PersistenceCoordinator({
    logger,
    gamePersistenceService: persistenceService,
    safeEventDispatcher: dispatcher,
    sessionManager,
    engineState: state,
    handleLoadFailure,
    ...additionalOverrides,
  });
  return {
    coordinator,
    logger,
    dispatcher,
    persistenceService,
    sessionManager,
    state,
    handleLoadFailure,
  };
}

describe('PersistenceCoordinator', () => {
  it('triggerManualSave dispatches events in order and returns success', async () => {
    const { coordinator, dispatcher, persistenceService, state } =
      createCoordinator();
    const filePath = 'path/to.sav';
    persistenceService.saveGame.mockResolvedValue({ success: true, filePath });

    const result = await coordinator.triggerManualSave(DEFAULT_SAVE_NAME);

    expect(persistenceService.saveGame).toHaveBeenCalledWith(
      DEFAULT_SAVE_NAME,
      state.isInitialized,
      DEFAULT_ACTIVE_WORLD_FOR_SAVE
    );
    expect(result).toEqual({ success: true, filePath });
    expectDispatchSequence(
      dispatcher.dispatch,
      ...buildSaveDispatches(DEFAULT_SAVE_NAME, filePath)
    );
  });

  it('triggerManualSave logs warnings when dispatcher fails during success notifications', async () => {
    const { coordinator, dispatcher, persistenceService, logger } =
      createCoordinator();
    const filePath = 'path/to.sav';
    persistenceService.saveGame.mockResolvedValue({ success: true, filePath });

    dispatcher.dispatch
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false);

    await coordinator.triggerManualSave(DEFAULT_SAVE_NAME);

    expect(logger.warn).toHaveBeenCalledTimes(3);
    expect(logger.warn).toHaveBeenCalledWith(
      `GameEngine.triggerManualSave: SafeEventDispatcher reported failure when dispatching ENGINE_OPERATION_IN_PROGRESS_UI for save "${DEFAULT_SAVE_NAME}".`
    );
    expect(logger.warn).toHaveBeenCalledWith(
      `GameEngine.triggerManualSave: SafeEventDispatcher reported failure when dispatching GAME_SAVED_ID for save "${DEFAULT_SAVE_NAME}".`
    );
    expect(logger.warn).toHaveBeenCalledWith(
      `GameEngine.triggerManualSave: SafeEventDispatcher reported failure when dispatching ENGINE_READY_UI after save "${DEFAULT_SAVE_NAME}".`
    );
    expect(
      logger.debug.mock.calls.some(([message]) =>
        message.includes('Dispatched GAME_SAVED_ID')
      )
    ).toBe(false);
  });

  it('triggerManualSave logs saved notification dispatch success only when dispatcher succeeds', async () => {
    const { coordinator, dispatcher, persistenceService, logger } =
      createCoordinator();
    const filePath = 'path/to.sav';
    persistenceService.saveGame.mockResolvedValue({ success: true, filePath });

    dispatcher.dispatch
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    await coordinator.triggerManualSave(DEFAULT_SAVE_NAME);

    expect(
      logger.debug.mock.calls.some(([message]) =>
        message.includes(
          `Dispatched GAME_SAVED_ID for "${DEFAULT_SAVE_NAME}"`
        )
      )
    ).toBe(true);
  });

  it('triggerManualSave avoids saved notification dispatch log when dispatcher reports failure', async () => {
    const { coordinator, dispatcher, persistenceService, logger } =
      createCoordinator();
    const filePath = 'path/to.sav';
    persistenceService.saveGame.mockResolvedValue({ success: true, filePath });

    dispatcher.dispatch
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await coordinator.triggerManualSave(DEFAULT_SAVE_NAME);

    expect(logger.warn).toHaveBeenCalledWith(
      `GameEngine.triggerManualSave: SafeEventDispatcher reported failure when dispatching GAME_SAVED_ID for save "${DEFAULT_SAVE_NAME}".`
    );
    expect(
      logger.debug.mock.calls.some(([message]) =>
        message.includes('Dispatched GAME_SAVED_ID')
      )
    ).toBe(false);
  });

  it('triggerManualSave continues when dispatcher throws and logs errors', async () => {
    const { coordinator, dispatcher, persistenceService, logger, state } =
      createCoordinator();
    const filePath = 'path/to.sav';
    const progressError = new Error('progress dispatch failed');
    const readyError = new Error('ready dispatch failed');

    persistenceService.saveGame.mockResolvedValue({ success: true, filePath });
    dispatcher.dispatch
      .mockRejectedValueOnce(progressError)
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(readyError);

    const result = await coordinator.triggerManualSave(DEFAULT_SAVE_NAME);

    expect(result).toEqual({ success: true, filePath });
    expect(persistenceService.saveGame).toHaveBeenCalledWith(
      DEFAULT_SAVE_NAME,
      state.isInitialized,
      DEFAULT_ACTIVE_WORLD_FOR_SAVE
    );
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(3);
    expect(dispatcher.dispatch.mock.calls[0][0]).toBe(
      ENGINE_OPERATION_IN_PROGRESS_UI
    );
    expect(dispatcher.dispatch.mock.calls[1][0]).toBe(GAME_SAVED_ID);
    expect(dispatcher.dispatch.mock.calls[2][0]).toBe(ENGINE_READY_UI);

    expect(logger.error).toHaveBeenCalledWith(
      `GameEngine.triggerManualSave: SafeEventDispatcher threw when dispatching ENGINE_OPERATION_IN_PROGRESS_UI for save "${DEFAULT_SAVE_NAME}". Error: ${progressError.message}`,
      progressError
    );
    expect(logger.error).toHaveBeenCalledWith(
      `GameEngine.triggerManualSave: SafeEventDispatcher threw when dispatching ENGINE_READY_UI after save "${DEFAULT_SAVE_NAME}". Error: ${readyError.message}`,
      readyError
    );
  });

  it('triggerManualSave dispatches failure UI when engine is not initialized', async () => {
    const customState = new EngineState();
    const { coordinator, dispatcher, logger } = createCoordinator({
      engineState: customState,
    });

    const result = await coordinator.triggerManualSave(DEFAULT_SAVE_NAME);

    const expectedError = 'Game engine is not initialized. Cannot save game.';
    expect(result).toEqual({ success: false, error: expectedError });
    expect(logger.error).toHaveBeenCalledWith(
      `GameEngine.triggerManualSave: ${expectedError}`
    );
    expect(dispatcher.dispatch.mock.calls).toEqual([
      [
        ENGINE_OPERATION_FAILED_UI,
        {
          errorMessage: `Failed to save game: ${expectedError}`,
          errorTitle: 'Save Failed',
        },
      ],
      [
        ENGINE_READY_UI,
        { activeWorld: null, message: SAVE_OPERATION_FINISHED_MESSAGE },
      ],
    ]);
  });

  it('triggerManualSave dispatches failure UI when persistence service is missing', async () => {
    const { coordinator, dispatcher, logger, state } = createCoordinator({
      gamePersistenceService: null,
    });

    const result = await coordinator.triggerManualSave(DEFAULT_SAVE_NAME);

    const expectedError =
      'GamePersistenceService is not available. Cannot save game.';
    expect(result).toEqual({ success: false, error: expectedError });
    expect(logger.error).toHaveBeenCalledWith(
      `GameEngine.triggerManualSave: ${expectedError}`
    );
    expect(dispatcher.dispatch.mock.calls).toEqual([
      [
        ENGINE_OPERATION_FAILED_UI,
        {
          errorMessage: `Failed to save game: ${expectedError}`,
          errorTitle: 'Save Failed',
        },
      ],
      [
        ENGINE_READY_UI,
        {
          activeWorld: state.activeWorld,
          message: SAVE_OPERATION_FINISHED_MESSAGE,
        },
      ],
    ]);
  });

  it('triggerManualSave forwards the latest engine state to the persistence service', async () => {
    const { coordinator, dispatcher, persistenceService, state } =
      createCoordinator();
    const filePath = 'path/to.sav';
    persistenceService.saveGame.mockResolvedValue({ success: true, filePath });

    dispatcher.dispatch.mockImplementationOnce(async () => {
      state.reset();
    });

    const result = await coordinator.triggerManualSave(DEFAULT_SAVE_NAME);

    expect(result).toEqual({ success: true, filePath });
    expect(persistenceService.saveGame).toHaveBeenCalledWith(
      DEFAULT_SAVE_NAME,
      false,
      null
    );
    const readyDispatch = dispatcher.dispatch.mock.calls.find(
      ([eventId]) => eventId === ENGINE_READY_UI
    );
    expect(readyDispatch).toEqual([
      ENGINE_READY_UI,
      { activeWorld: null, message: SAVE_OPERATION_FINISHED_MESSAGE },
    ]);
  });

  it('loadGame handles persistence failure and dispatches failure UI', async () => {
    const {
      coordinator,
      dispatcher,
      persistenceService,
      sessionManager,
      handleLoadFailure,
    } = createCoordinator();
    const errorMsg = 'restore failed';
    persistenceService.loadAndRestoreGame.mockResolvedValue({
      success: false,
      error: errorMsg,
      data: null,
    });
    sessionManager.prepareForLoadGameSession.mockImplementation(async (id) => {
      const shortName = extractSaveName(id);
      await dispatcher.dispatch(ENGINE_OPERATION_IN_PROGRESS_UI, {
        titleMessage: `Loading ${shortName}...`,
        inputDisabledMessage: `Loading game from ${shortName}...`,
      });
    });

    const result = await coordinator.loadGame(DEFAULT_SAVE_ID);

    expect(sessionManager.prepareForLoadGameSession).toHaveBeenCalledWith(
      DEFAULT_SAVE_ID
    );
    expect(handleLoadFailure).toHaveBeenCalledWith(errorMsg, DEFAULT_SAVE_ID);
    expect(result).toEqual({ success: false, error: errorMsg, data: null });
    expectDispatchSequence(
      dispatcher.dispatch,
      ...buildLoadFailureDispatches(DEFAULT_SAVE_ID, errorMsg)
    );
  });

  it('triggerManualSave handles persistence service exceptions', async () => {
    const { coordinator, dispatcher, persistenceService } = createCoordinator();
    const saveError = new Error('Save operation failed');
    persistenceService.saveGame.mockRejectedValue(saveError);

    const result = await coordinator.triggerManualSave(DEFAULT_SAVE_NAME);

    expect(result).toEqual({
      success: false,
      error: 'Unexpected error during save: Save operation failed',
    });
    expectDispatchSequence(
      dispatcher.dispatch,
      ...buildFailedSaveDispatches(
        DEFAULT_SAVE_NAME,
        'Unexpected error during save: Save operation failed'
      )
    );
  });

  it('triggerManualSave avoids duplicating failure prefix in dispatched message', async () => {
    const { coordinator, dispatcher, persistenceService } = createCoordinator();
    const prefixedMessage = 'Failed to save game: Not enough disk space.';
    persistenceService.saveGame.mockResolvedValue({
      success: false,
      error: prefixedMessage,
    });

    await coordinator.triggerManualSave(DEFAULT_SAVE_NAME);

    const failureDispatch = dispatcher.dispatch.mock.calls.find(
      ([eventId]) => eventId === ENGINE_OPERATION_FAILED_UI
    );

    expect(failureDispatch).toBeDefined();
    expect(failureDispatch[1]).toEqual({
      errorMessage: prefixedMessage,
      errorTitle: 'Save Failed',
    });
  });

  it('triggerManualSave handles save failure results', async () => {
    const { coordinator, dispatcher, persistenceService } = createCoordinator();
    const errorMessage = 'Disk full';
    persistenceService.saveGame.mockResolvedValue({
      success: false,
      error: errorMessage,
    });

    const result = await coordinator.triggerManualSave(DEFAULT_SAVE_NAME);

    expect(result).toEqual({ success: false, error: errorMessage });
    expectDispatchSequence(
      dispatcher.dispatch,
      ...buildFailedSaveDispatches(DEFAULT_SAVE_NAME, errorMessage)
    );
  });

  it('triggerManualSave surfaces persistence message when error detail is missing', async () => {
    const { coordinator, dispatcher, persistenceService, logger } =
      createCoordinator();
    const failureMessage = 'Disk quota exceeded';
    persistenceService.saveGame.mockResolvedValue({
      success: false,
      message: failureMessage,
    });

    const result = await coordinator.triggerManualSave(DEFAULT_SAVE_NAME);

    expect(result).toEqual({
      success: false,
      message: failureMessage,
      error: failureMessage,
    });
    expectDispatchSequence(
      dispatcher.dispatch,
      ...buildFailedSaveDispatches(DEFAULT_SAVE_NAME, failureMessage)
    );

    const errorLogCall = logger.error.mock.calls.find(([message]) =>
      message.includes('Reported error:')
    );

    expect(errorLogCall).toBeDefined();
    expect(errorLogCall[0]).toContain(
      `Reported error: ${failureMessage}`
    );
  });

  it('triggerManualSave prefers userFriendlyError for UI messaging while retaining detailed logs', async () => {
    const { coordinator, dispatcher, persistenceService, logger } =
      createCoordinator();
    const userFriendlyError = 'Not enough disk space available.';
    const rawErrorMessage = 'EIO: disk write failure';
    const rawError = new PersistenceError(
      PersistenceErrorCodes.WRITE_ERROR,
      rawErrorMessage
    );
    persistenceService.saveGame.mockResolvedValue({
      success: false,
      error: rawError,
      userFriendlyError,
    });

    const result = await coordinator.triggerManualSave(DEFAULT_SAVE_NAME);

    expect(result).toEqual({
      success: false,
      error: rawErrorMessage,
      userFriendlyError,
      errorCode: PersistenceErrorCodes.WRITE_ERROR,
    });
    expectDispatchSequence(
      dispatcher.dispatch,
      ...buildFailedSaveDispatches(DEFAULT_SAVE_NAME, userFriendlyError)
    );

    const errorLogCall = logger.error.mock.calls.find(([message]) =>
      message.includes('Reported error:')
    );

    expect(errorLogCall).toBeDefined();
    expect(errorLogCall[0]).toContain(
      `Reported error: ${rawErrorMessage}`
    );
  });

  it('triggerManualSave normalizes PersistenceError failures to readable strings', async () => {
    const { coordinator, persistenceService } = createCoordinator();
    const persistenceError = new PersistenceError(
      PersistenceErrorCodes.INVALID_SAVE_NAME,
      'Invalid save name provided. Please enter a valid name.'
    );
    persistenceService.saveGame.mockResolvedValue({
      success: false,
      error: persistenceError,
    });

    const result = await coordinator.triggerManualSave(DEFAULT_SAVE_NAME);

    expect(result).toEqual({
      success: false,
      error: persistenceError.message,
      errorCode: PersistenceErrorCodes.INVALID_SAVE_NAME,
    });
  });

  it('triggerManualSave logs warnings when dispatcher fails during failure notifications', async () => {
    const { coordinator, dispatcher, persistenceService, logger } =
      createCoordinator();
    const errorMessage = 'Disk full';
    persistenceService.saveGame.mockResolvedValue({
      success: false,
      error: errorMessage,
    });

    dispatcher.dispatch
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false);

    await coordinator.triggerManualSave(DEFAULT_SAVE_NAME);

    expect(logger.warn).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith(
      `GameEngine.triggerManualSave: SafeEventDispatcher reported failure when dispatching ENGINE_OPERATION_FAILED_UI for save "${DEFAULT_SAVE_NAME}".`
    );
    expect(logger.warn).toHaveBeenCalledWith(
      `GameEngine.triggerManualSave: SafeEventDispatcher reported failure when dispatching ENGINE_READY_UI after save "${DEFAULT_SAVE_NAME}".`
    );
  });

  it('triggerManualSave treats invalid persistence results as failure', async () => {
    const { coordinator, dispatcher, persistenceService, logger } =
      createCoordinator();
    persistenceService.saveGame.mockResolvedValue(undefined);

    const result = await coordinator.triggerManualSave(DEFAULT_SAVE_NAME);

    expect(result).toEqual({
      success: false,
      error: 'Persistence service returned an invalid save result.',
    });
    expect(logger.error).toHaveBeenCalledWith(
      `GameEngine.triggerManualSave: Persistence service returned invalid result for "${DEFAULT_SAVE_NAME}".`,
      {
        receivedType: 'undefined',
        receivedValue: undefined,
      }
    );
    expectDispatchSequence(
      dispatcher.dispatch,
      ...buildFailedSaveDispatches(
        DEFAULT_SAVE_NAME,
        'Persistence service returned an invalid save result.'
      )
    );
  });

  it('triggerManualSave returns error when engine not initialized', async () => {
    const { coordinator, state } = createCoordinator();
    state.reset(); // This sets isInitialized to false

    const result = await coordinator.triggerManualSave(DEFAULT_SAVE_NAME);

    expect(result).toEqual({
      success: false,
      error: 'Game engine is not initialized. Cannot save game.',
    });
  });

  it('triggerManualSave returns error when persistence service unavailable', async () => {
    const { coordinator } = createCoordinator({
      gamePersistenceService: null,
    });

    const result = await coordinator.triggerManualSave(DEFAULT_SAVE_NAME);

    expect(result).toEqual({
      success: false,
      error: 'GamePersistenceService is not available. Cannot save game.',
    });
  });

  it('loadGame returns error when persistence service unavailable', async () => {
    const {
      coordinator,
      state,
      handleLoadFailure,
      dispatcher,
      sessionManager,
    } = createCoordinator({
      gamePersistenceService: null,
    });

    const result = await coordinator.loadGame(DEFAULT_SAVE_ID);

    const expectedErrorMsg =
      'GameEngine.loadGame: GamePersistenceService is not available. Cannot load game.';

    expect(result).toEqual({
      success: false,
      error: expectedErrorMsg,
      data: null,
    });
    expect(handleLoadFailure).toHaveBeenCalledWith(
      expectedErrorMsg,
      DEFAULT_SAVE_ID
    );
    expect(sessionManager.prepareForLoadGameSession).not.toHaveBeenCalled();
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      ENGINE_OPERATION_FAILED_UI,
      {
        errorMessage: `Failed to load game: ${expectedErrorMsg}`,
        errorTitle: 'Load Failed',
      }
    );
    // Verify state gets reset when persistence service unavailable
    expect(state.isInitialized).toBe(false);
  });

  it('loadGame handles successful load path', async () => {
    const { coordinator, persistenceService, sessionManager } =
      createCoordinator();
    const saveData = { world: 'test-world', entities: [] };
    const finalResult = { success: true, data: saveData };

    persistenceService.loadAndRestoreGame.mockResolvedValue({
      success: true,
      data: saveData,
    });
    sessionManager.prepareForLoadGameSession.mockResolvedValue();
    sessionManager.finalizeLoadSuccess.mockResolvedValue(finalResult);

    const result = await coordinator.loadGame(DEFAULT_SAVE_ID);

    expect(sessionManager.prepareForLoadGameSession).toHaveBeenCalledWith(
      DEFAULT_SAVE_ID
    );
    expect(sessionManager.finalizeLoadSuccess).toHaveBeenCalledWith(
      saveData,
      DEFAULT_SAVE_ID
    );
    expect(result).toEqual(finalResult);
  });

  it('loadGame handles exceptions during load process', async () => {
    const { coordinator, sessionManager, handleLoadFailure } =
      createCoordinator();
    const loadError = new Error('Session preparation failed');
    sessionManager.prepareForLoadGameSession.mockRejectedValue(loadError);

    const result = await coordinator.loadGame(DEFAULT_SAVE_ID);

    expect(handleLoadFailure).toHaveBeenCalledWith(loadError, DEFAULT_SAVE_ID);
    expect(result).toEqual({
      success: false,
      error: loadError.message,
      data: null,
    });
  });

  it('triggerManualSave handles non-Error exceptions', async () => {
    const { coordinator, persistenceService } = createCoordinator();
    const stringError = 'String error message';
    persistenceService.saveGame.mockRejectedValue(stringError);

    const result = await coordinator.triggerManualSave(DEFAULT_SAVE_NAME);

    expect(result).toEqual({
      success: false,
      error: 'Unexpected error during save: String error message',
    });
  });

  it('loadGame handles load failure without error message', async () => {
    const {
      coordinator,
      persistenceService,
      sessionManager,
      handleLoadFailure,
    } = createCoordinator();

    persistenceService.loadAndRestoreGame.mockResolvedValue({
      success: false,
      data: null,
      // No error message provided
    });
    sessionManager.prepareForLoadGameSession.mockResolvedValue();

    await coordinator.loadGame(DEFAULT_SAVE_ID);

    expect(handleLoadFailure).toHaveBeenCalledWith(
      'Restored data was missing or load operation failed.',
      DEFAULT_SAVE_ID
    );
  });

  it('loadGame treats invalid load result as failure', async () => {
    const {
      coordinator,
      persistenceService,
      handleLoadFailure,
      dispatcher,
      logger,
      sessionManager,
    } = createCoordinator();

    persistenceService.loadAndRestoreGame.mockResolvedValue(undefined);
    sessionManager.prepareForLoadGameSession.mockImplementation(async (id) => {
      const shortName = extractSaveName(id);
      await dispatcher.dispatch(ENGINE_OPERATION_IN_PROGRESS_UI, {
        titleMessage: `Loading ${shortName}...`,
        inputDisabledMessage: `Loading game from ${shortName}...`,
      });
    });

    const result = await coordinator.loadGame(DEFAULT_SAVE_ID);

    expect(logger.error).toHaveBeenCalledWith(
      `GameEngine._executeLoadAndRestore: Persistence service returned invalid result for "${DEFAULT_SAVE_ID}".`,
      {
        receivedType: 'undefined',
        receivedValue: undefined,
      }
    );
    expect(handleLoadFailure).toHaveBeenCalledWith(
      'Persistence service returned an invalid load result.',
      DEFAULT_SAVE_ID
    );
    expect(result).toEqual({
      success: false,
      error: 'Persistence service returned an invalid load result.',
      data: null,
    });
    expectDispatchSequence(
      dispatcher.dispatch,
      ...buildLoadFailureDispatches(
        DEFAULT_SAVE_ID,
        'Persistence service returned an invalid load result.'
      )
    );
  });

  it('loadGame handles non-Error exceptions during load process', async () => {
    const { coordinator, sessionManager, handleLoadFailure } =
      createCoordinator();
    const stringError = 'String error during load';
    sessionManager.prepareForLoadGameSession.mockRejectedValue(stringError);

    await coordinator.loadGame(DEFAULT_SAVE_ID);

    // Should convert string error to Error object
    const expectedError = new Error(stringError);
    expect(handleLoadFailure).toHaveBeenCalledWith(
      expectedError,
      DEFAULT_SAVE_ID
    );
  });
});
