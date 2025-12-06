/**
 * @file Additional edge case coverage tests for GameSessionManager.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
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

  it('should return the trimmed identifier when decoding consistently yields whitespace', async () => {
    extractSaveNameMock.mockImplementation((value) => value);

    const originalDecode = global.decodeURIComponent;
    global.decodeURIComponent = jest.fn(() => '   ');

    const { manager, safeEventDispatcher } = createManager();

    try {
      await manager.prepareForLoadGameSession('ghost-slot');
    } finally {
      global.decodeURIComponent = originalDecode;
    }

    expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
      ENGINE_OPERATION_IN_PROGRESS_UI,
      {
        titleMessage: 'Loading ghost-slot...',
        inputDisabledMessage: 'Loading game from ghost-slot...',
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

  it('should record reset failures when stopFn already failed with an existing cause', async () => {
    const deps = createDependencies();
    deps.engineState.setStarted('ExistingWorld');

    const stopFailure = new Error('Stop failed');
    stopFailure.cause = new Error('Existing cause');
    deps.stopFn.mockRejectedValue(stopFailure);

    const resetFailure = new Error('Reset failed');
    deps.resetCoreGameStateFn.mockRejectedValue(resetFailure);

    const manager = new GameSessionManager({
      logger: deps.logger,
      turnManager: deps.turnManager,
      playtimeTracker: deps.playtimeTracker,
      safeEventDispatcher: deps.safeEventDispatcher,
      engineState: deps.engineState,
      stopFn: deps.stopFn,
      resetCoreGameStateFn: deps.resetCoreGameStateFn,
      startEngineFn: deps.startEngineFn,
      anatomyInitializationService: deps.anatomyInitializationService,
    });

    await expect(
      manager.prepareForNewGameSession('RecoveryWorld')
    ).rejects.toBe(stopFailure);

    expect(stopFailure.resetErrors).toEqual([resetFailure]);
  });

  it('should derive trimmed identifiers when percent decoding removes visible characters', async () => {
    const originalDecode = global.decodeURIComponent;
    global.decodeURIComponent = jest.fn((value) => {
      if (value === 'Alpha') {
        return '   ';
      }
      return originalDecode(value);
    });

    const { manager, safeEventDispatcher } = createManager();

    try {
      await manager.prepareForLoadGameSession('Alpha');
    } finally {
      global.decodeURIComponent = originalDecode;
    }

    expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
      ENGINE_OPERATION_IN_PROGRESS_UI,
      {
        titleMessage: 'Loading Alpha...',
        inputDisabledMessage: 'Loading game from Alpha...',
      }
    );
  });

  it('should safely handle manual save names that normalize to empty output', async () => {
    extractSaveNameMock.mockImplementation((value) => {
      if (value === 'manual_case.sav') {
        return undefined;
      }
      return value;
    });

    const { manager, safeEventDispatcher } = createManager();

    await manager.prepareForLoadGameSession('manual_case.sav');

    expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
      ENGINE_OPERATION_IN_PROGRESS_UI,
      {
        titleMessage: 'Loading manual case...',
        inputDisabledMessage: 'Loading game from manual case...',
      }
    );
  });

  it('should default to a generic label when only the base save directory is provided', async () => {
    extractSaveNameMock.mockImplementation((value) => {
      if (value === 'saves') {
        return '';
      }
      return value;
    });

    const { manager, safeEventDispatcher } = createManager();

    await manager.prepareForLoadGameSession('saves/');

    expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
      ENGINE_OPERATION_IN_PROGRESS_UI,
      {
        titleMessage: 'Loading saves...',
        inputDisabledMessage: 'Loading game from saves...',
      }
    );
  });

  it('should normalize metadata world names that look like file paths after empty titles', async () => {
    const { manager, engineState, startEngineFn } = createManager();

    const saveData = {
      metadata: {
        gameTitle: { toString: () => '' },
        worldName: 'C\\\\worlds\\\\archive',
      },
      entities: [],
      gameState: {},
    };

    const result = await manager.finalizeLoadSuccess(saveData, 'slot-path');

    expect(result.success).toBe(true);
    expect(engineState.activeWorld).toBe('slot-path');
    expect(startEngineFn).toHaveBeenCalledWith('slot-path');
  });

  it('should treat null extraction results as empty segments', async () => {
    extractSaveNameMock.mockImplementation((value) => {
      if (value === 'manual_save_null.sav') {
        return null;
      }
      return value;
    });

    const { manager, safeEventDispatcher } = createManager();

    await manager.prepareForLoadGameSession('manual_save_null.sav');

    expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
      ENGINE_OPERATION_IN_PROGRESS_UI,
      {
        titleMessage: 'Loading null...',
        inputDisabledMessage: 'Loading game from null...',
      }
    );
  });

  it('should support bigint metadata values when resolving world names', async () => {
    const { manager, engineState, startEngineFn } = createManager();

    const saveData = {
      metadata: {
        gameTitle: 42n,
      },
      entities: [],
      gameState: {},
    };

    await manager.finalizeLoadSuccess(saveData, 'slot-bigint');

    expect(engineState.activeWorld).toBe('42');
    expect(startEngineFn).toHaveBeenCalledWith('42');
  });

  it('should coerce symbol metadata to readable world names', async () => {
    const { manager, engineState, startEngineFn } = createManager();

    const saveData = {
      metadata: {
        gameTitle: '',
        worldName: Symbol('legends'),
      },
      entities: [],
      gameState: {},
    };

    await manager.finalizeLoadSuccess(saveData, 'slot-symbol');

    expect(engineState.activeWorld).toBe('Symbol(legends)');
    expect(startEngineFn).toHaveBeenCalledWith('Symbol(legends)');
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
