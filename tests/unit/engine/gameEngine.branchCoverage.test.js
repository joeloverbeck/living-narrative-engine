import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { ENGINE_STOPPED_UI } from '../../../src/constants/eventIds.js';

/**
 *
 */
function createLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

/**
 *
 * @param resolutionMap
 */
function createContainer(resolutionMap) {
  const resolve = jest.fn((token) => {
    if (!Object.prototype.hasOwnProperty.call(resolutionMap, token)) {
      throw new Error(`Unexpected token resolution request: ${String(token)}`);
    }
    return resolutionMap[token];
  });
  return {
    resolve,
    isRegistered: jest.fn(() => false),
  };
}

describe('GameEngine uncovered branches', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('logs a warning when stopping without a resolved turnManager', async () => {
    await jest.isolateModulesAsync(async () => {
      const engineStateInstance = {
        isInitialized: true,
        isGameLoopRunning: false,
        activeWorld: 'alpha',
        reset: jest.fn(),
        setStarted: jest.fn(),
      };

      jest.doMock('../../../src/engine/engineState.js', () => ({
        __esModule: true,
        default: jest.fn(() => engineStateInstance),
      }));

      const persistenceStub = {
        triggerManualSave: jest.fn(),
        loadGame: jest.fn(),
      };

      jest.doMock('../../../src/engine/persistenceCoordinator.js', () => ({
        __esModule: true,
        default: jest.fn(() => persistenceStub),
      }));

      jest.doMock('../../../src/utils/engineErrorUtils.js', () => ({
        __esModule: true,
        processOperationFailure: jest.fn(),
      }));

      const { default: GameEngine } = await import('../../../src/engine/gameEngine.js');

      const logger = createLogger();
      const entityManager = { clearAll: jest.fn() };
      const playtimeTracker = {
        endSessionAndAccumulate: jest.fn(),
        reset: jest.fn(),
      };
      const safeEventDispatcher = {
        dispatch: jest.fn().mockResolvedValue(true),
      };
      const initializationService = {
        runInitializationSequence: jest.fn(),
      };

      const container = createContainer({
        [tokens.IEntityManager]: entityManager,
        [tokens.ITurnManager]: null,
        [tokens.GamePersistenceService]: { isSavingAllowed: jest.fn() },
        [tokens.PlaytimeTracker]: playtimeTracker,
        [tokens.ISafeEventDispatcher]: safeEventDispatcher,
        [tokens.IInitializationService]: initializationService,
      });

      const engine = new GameEngine({
        container,
        logger,
        sessionManager: { stop: jest.fn() },
        persistenceCoordinator: persistenceStub,
      });

      await engine.stop();

      expect(logger.warn).toHaveBeenCalledWith(
        'GameEngine.stop: TurnManager service not available, cannot stop.'
      );
      expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_STOPPED_UI,
        { inputDisabledMessage: 'Game stopped. Engine is inactive.' }
      );
    });
  });

  it('delegates load failures through processOperationFailure', async () => {
    await jest.isolateModulesAsync(async () => {
      const engineStateInstance = {
        isInitialized: false,
        isGameLoopRunning: false,
        activeWorld: null,
        reset: jest.fn(),
        setStarted: jest.fn(),
      };

      jest.doMock('../../../src/engine/engineState.js', () => ({
        __esModule: true,
        default: jest.fn(() => engineStateInstance),
      }));

      const processOperationFailure = jest
        .fn()
        .mockResolvedValue({ success: false, error: 'boom', data: null });

      jest.doMock('../../../src/utils/engineErrorUtils.js', () => ({
        __esModule: true,
        processOperationFailure,
      }));

      let capturedOptions;
      const persistenceMock = jest.fn().mockImplementation((options) => {
        capturedOptions = options;
        return {
          triggerManualSave: jest.fn(),
          loadGame: jest.fn(),
        };
      });

      jest.doMock('../../../src/engine/persistenceCoordinator.js', () => ({
        __esModule: true,
        default: persistenceMock,
      }));

      const { default: GameEngine } = await import('../../../src/engine/gameEngine.js');

      const logger = createLogger();
      const entityManager = { clearAll: jest.fn() };
      const playtimeTracker = {
        endSessionAndAccumulate: jest.fn(),
        reset: jest.fn(),
      };
      const safeEventDispatcher = {
        dispatch: jest.fn().mockResolvedValue(true),
      };
      const initializationService = {
        runInitializationSequence: jest.fn(),
      };
      const persistenceService = { isSavingAllowed: jest.fn() };

      const container = createContainer({
        [tokens.IEntityManager]: entityManager,
        [tokens.ITurnManager]: { stop: jest.fn() },
        [tokens.GamePersistenceService]: persistenceService,
        [tokens.PlaytimeTracker]: playtimeTracker,
        [tokens.ISafeEventDispatcher]: safeEventDispatcher,
        [tokens.IInitializationService]: initializationService,
      });

      new GameEngine({
        container,
        logger,
        sessionManager: { stop: jest.fn() },
      });

      expect(capturedOptions).toBeDefined();
      const errorInfo = { reason: 'corrupted data' };
      const result = await capturedOptions.handleLoadFailure(errorInfo, 'slot-42');

      expect(processOperationFailure).toHaveBeenCalledWith(
        logger,
        safeEventDispatcher,
        '_handleLoadFailure: Handling game load failure for identifier "slot-42"',
        errorInfo,
        'Load Failed',
        'Failed to load game',
        expect.any(Function),
        true
      );

      const resetFn = processOperationFailure.mock.calls[0][6];
      await resetFn();
      expect(entityManager.clearAll).toHaveBeenCalledTimes(1);
      expect(playtimeTracker.reset).toHaveBeenCalledTimes(1);
      expect(engineStateInstance.reset).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ success: false, error: 'boom', data: null });
    });
  });
});
