/**
 * @file Additional edge case coverage tests for GameSessionManager.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import EngineState from '../../../src/engine/engineState.js';
import {
  createMockLogger,
  createMockSafeEventDispatcher,
  createMockTurnManager,
  createMockPlaytimeTracker,
} from '../../common/mockFactories/index.js';
import {
  ENGINE_OPERATION_IN_PROGRESS_UI,
  ENGINE_READY_UI,
} from '../../../src/constants/eventIds.js';

/** @type {import('../../../src/engine/gameSessionManager.js').default} */
let GameSessionManager;

let extractSaveNameMock;

const createDependencies = () => {
  const engineState = new EngineState();
  const logger = createMockLogger();
  const turnManager = createMockTurnManager();
  const playtimeTracker = createMockPlaytimeTracker();
  const safeEventDispatcher = createMockSafeEventDispatcher();
  const stopFn = jest.fn().mockResolvedValue();
  const resetCoreGameStateFn = jest.fn();
  const startEngineFn = jest.fn((worldName) => {
    engineState.setStarted(worldName);
  });
  const anatomyInitializationService = {
    getPendingGenerationCount: jest.fn().mockReturnValue(0),
    waitForAllGenerationsToComplete: jest.fn().mockResolvedValue(),
  };

  return {
    engineState,
    logger,
    turnManager,
    playtimeTracker,
    safeEventDispatcher,
    stopFn,
    resetCoreGameStateFn,
    startEngineFn,
    anatomyInitializationService,
  };
};

const createManager = () => {
  const deps = createDependencies();
  return {
    ...deps,
    manager: new GameSessionManager({
      logger: deps.logger,
      turnManager: deps.turnManager,
      playtimeTracker: deps.playtimeTracker,
      safeEventDispatcher: deps.safeEventDispatcher,
      engineState: deps.engineState,
      stopFn: deps.stopFn,
      resetCoreGameStateFn: deps.resetCoreGameStateFn,
      startEngineFn: deps.startEngineFn,
      anatomyInitializationService: deps.anatomyInitializationService,
    }),
  };
};

describe('GameSessionManager edge case coverage', () => {
  beforeEach(async () => {
    jest.resetModules();
    extractSaveNameMock = jest.fn((value) => value);
    jest.unstable_mockModule('../../../src/utils/savePathUtils.js', () => ({
      BASE_SAVE_DIRECTORY: 'saves',
      MANUAL_SAVES_SUBDIRECTORY: 'manual_saves',
      MANUAL_SAVE_PATTERN: /^manual_save_.*\.sav$/i,
      extractSaveName: extractSaveNameMock,
    }));
    ({ default: GameSessionManager } = await import(
      '../../../src/engine/gameSessionManager.js'
    ));
  });

  afterEach(() => {
    jest.resetModules();
  });

  it('should skip base directory segments when no formatted name is available', async () => {
    extractSaveNameMock.mockImplementation((value) => {
      if (value === 'slot.sav' || value === 'saves') {
        return '';
      }
      return value;
    });

    const { manager, safeEventDispatcher } = createManager();

    await manager.prepareForLoadGameSession('saves/slot.sav');

    expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
      ENGINE_OPERATION_IN_PROGRESS_UI,
      expect.objectContaining({
        titleMessage: 'Loading slot...',
        inputDisabledMessage: 'Loading game from slot...',
      })
    );
  });

  it('should fall back to trimmed candidates when decoded values contain only whitespace', async () => {
    extractSaveNameMock.mockImplementation((value) => value);

    const originalDecode = global.decodeURIComponent;
    let decodeCalls = 0;
    global.decodeURIComponent = jest.fn((value) => {
      if (value === 'special-case') {
        decodeCalls += 1;
        if (decodeCalls === 1) {
          return '   ';
        }
        return 'Readable Value';
      }
      return originalDecode(value);
    });

    const { manager, safeEventDispatcher } = createManager();

    try {
      await manager.prepareForLoadGameSession('special-case');
    } finally {
      global.decodeURIComponent = originalDecode;
    }

    expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
      ENGINE_OPERATION_IN_PROGRESS_UI,
      {
        titleMessage: 'Loading Readable Value...',
        inputDisabledMessage: 'Loading game from Readable Value...',
      }
    );
  });

  it('should treat undefined extraction results as empty segments', async () => {
    extractSaveNameMock
      .mockImplementationOnce(() => undefined)
      .mockReturnValue('missing');

    const { manager, safeEventDispatcher } = createManager();

    await manager.prepareForLoadGameSession('manual_save_missing.sav');

    expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
      ENGINE_OPERATION_IN_PROGRESS_UI,
      {
        titleMessage: 'Loading missing...',
        inputDisabledMessage: 'Loading game from missing...',
      }
    );
  });

  it('should handle decoded metadata that collapses to empty strings when checking for file paths', async () => {
    const originalDecode = global.decodeURIComponent;
    global.decodeURIComponent = jest.fn((value) => {
      if (value === 'manual_save_marker.sav') {
        return '';
      }
      return originalDecode(value);
    });

    const { manager, engineState, startEngineFn, safeEventDispatcher } =
      createManager();

    try {
      const saveData = {
        metadata: { gameTitle: '', worldName: 'manual_save_marker.sav' },
        entities: [],
        gameState: {},
      };

      await manager.finalizeLoadSuccess(saveData, 'marker-slot');

      expect(engineState.activeWorld).toBe('marker-slot');
      expect(startEngineFn).toHaveBeenCalledWith('marker-slot');
      expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_READY_UI,
        expect.any(Object)
      );
    } finally {
      global.decodeURIComponent = originalDecode;
    }
  });
});
