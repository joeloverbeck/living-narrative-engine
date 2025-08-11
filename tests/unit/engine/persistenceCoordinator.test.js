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
  buildLoadFailureDispatches,
} from '../../common/engine/dispatchTestUtils.js';
import {
  DEFAULT_ACTIVE_WORLD_FOR_SAVE,
  DEFAULT_SAVE_NAME,
  DEFAULT_SAVE_ID,
} from '../../common/constants.js';
import {
  ENGINE_OPERATION_IN_PROGRESS_UI,
  ENGINE_OPERATION_FAILED_UI,
  ENGINE_READY_UI,
} from '../../../src/constants/eventIds.js';

/**
 * Helper to instantiate PersistenceCoordinator with mocks
 *
 * @param {object} overrides - Override values for dependencies
 * @returns {object} Test coordinator and its dependencies
 */
function createCoordinator(overrides = {}) {
  const logger = createMockLogger();
  const dispatcher = createMockSafeEventDispatcher();
  dispatcher.dispatch.mockResolvedValue(undefined);
  const persistenceService = createMockGamePersistenceService();
  const sessionManager = {
    prepareForLoadGameSession: jest.fn(),
    finalizeLoadSuccess: jest.fn(),
  };
  const state = new EngineState();
  state.setStarted(DEFAULT_ACTIVE_WORLD_FOR_SAVE);
  const handleLoadFailure = jest.fn(async (err) => {
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
    ...overrides,
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
    const { coordinator, dispatcher, persistenceService } = createCoordinator();
    const filePath = 'path/to.sav';
    persistenceService.saveGame.mockResolvedValue({ success: true, filePath });

    const result = await coordinator.triggerManualSave(DEFAULT_SAVE_NAME);

    expect(persistenceService.saveGame).toHaveBeenCalledWith(
      DEFAULT_SAVE_NAME,
      true,
      DEFAULT_ACTIVE_WORLD_FOR_SAVE
    );
    expect(result).toEqual({ success: true, filePath });
    expectDispatchSequence(
      dispatcher.dispatch,
      ...buildSaveDispatches(DEFAULT_SAVE_NAME, filePath)
    );
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
      const shortName = id.split(/[/\\]/).pop() || id;
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
    // Should still dispatch UI events even when save fails
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      ENGINE_OPERATION_IN_PROGRESS_UI,
      expect.any(Object)
    );
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
    // Verify UI dispatches for failed saves
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      ENGINE_OPERATION_IN_PROGRESS_UI,
      expect.any(Object)
    );
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      ENGINE_READY_UI,
      expect.any(Object)
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
    const { coordinator, state } = createCoordinator({
      gamePersistenceService: null,
    });

    const result = await coordinator.loadGame(DEFAULT_SAVE_ID);

    expect(result).toEqual({
      success: false,
      error:
        'GameEngine.loadGame: GamePersistenceService is not available. Cannot load game.',
      data: null,
    });
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
