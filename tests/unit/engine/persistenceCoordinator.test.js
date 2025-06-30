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
} from '../../../src/constants/eventIds.js';

/**
 * Helper to instantiate PersistenceCoordinator with mocks
 *
 * @param overrides
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
});
