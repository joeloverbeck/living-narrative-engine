import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import {
  ENGINE_STOPPED_UI,
  UI_SHOW_LLM_PROMPT_PREVIEW,
} from '../../../src/constants/eventIds.js';

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
 * @param options
 */
function createContainer(resolutionMap, options = {}) {
  const defaults = {
    [tokens.TurnActionChoicePipeline]: { buildChoices: jest.fn() },
    [tokens.IAIPromptPipeline]: { generatePrompt: jest.fn() },
    [tokens.MoodUpdatePromptPipeline]: {
      generateMoodUpdatePrompt: jest.fn().mockResolvedValue(''),
    },
    [tokens.LLMAdapter]: {
      getCurrentActiveLlmId: jest.fn(),
      getAIDecision: jest.fn(),
    },
    [tokens.EntityDisplayDataProvider]: { getEntityName: jest.fn() },
    [tokens.IPerceptionLogProvider]: {
      get: jest.fn().mockResolvedValue([]),
      isEmpty: jest.fn().mockResolvedValue(true),
    },
  };
  const map = { ...defaults, ...resolutionMap };
  const resolve = jest.fn((token) => {
    if (!Object.prototype.hasOwnProperty.call(map, token)) {
      throw new Error(`Unexpected token resolution request: ${String(token)}`);
    }
    return map[token];
  });

  const container = {
    resolve,
  };

  if (options.hasIsRegistered !== false) {
    container.isRegistered = jest.fn(
      options.isRegisteredFn || (() => false)
    );
  }

  return container;
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

      jest.doMock('../../../src/utils/engineErrorUtils.js', () => ({
        __esModule: true,
        processOperationFailure: jest.fn(),
      }));

      const { default: GameEngine } = await import(
        '../../../src/engine/gameEngine.js'
      );

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

  // Constructor branches (lines 112-133)
  describe('constructor sessionManager resolution', () => {
    it('creates a default GameSessionManager when container has no isRegistered method', async () => {
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

        jest.doMock('../../../src/utils/engineErrorUtils.js', () => ({
          __esModule: true,
          processOperationFailure: jest.fn(),
        }));

        const { default: GameEngine } = await import(
          '../../../src/engine/gameEngine.js'
        );

        const logger = createLogger();
        const safeEventDispatcher = {
          dispatch: jest.fn().mockResolvedValue(true),
          setBatchMode: jest.fn(),
        };

        // Create container WITHOUT isRegistered method (line 113 branch: container.isRegistered is falsy)
        const container = createContainer(
          {
            [tokens.IEntityManager]: { clearAll: jest.fn() },
            [tokens.ITurnManager]: { stop: jest.fn() },
            [tokens.GamePersistenceService]: { isSavingAllowed: jest.fn() },
            [tokens.PlaytimeTracker]: {
              endSessionAndAccumulate: jest.fn(),
              reset: jest.fn(),
            },
            [tokens.ISafeEventDispatcher]: safeEventDispatcher,
            [tokens.IInitializationService]: {
              runInitializationSequence: jest.fn(),
            },
          },
          { hasIsRegistered: false }
        );

        // Should not throw - creates default GameSessionManager
        const engine = new GameEngine({
          container,
          logger,
        });

        expect(engine).toBeDefined();
        expect(logger.debug).toHaveBeenCalledWith(
          'GameEngine: Core services resolved.'
        );
      });
    });

    it('resolves GameSessionManager from container when isRegistered returns true', async () => {
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

        jest.doMock('../../../src/utils/engineErrorUtils.js', () => ({
          __esModule: true,
          processOperationFailure: jest.fn(),
        }));

        const { default: GameEngine } = await import(
          '../../../src/engine/gameEngine.js'
        );

        const logger = createLogger();
        const safeEventDispatcher = {
          dispatch: jest.fn().mockResolvedValue(true),
          setBatchMode: jest.fn(),
        };
        const mockSessionManager = {
          stop: jest.fn(),
          finalizeNewGameSuccess: jest.fn(),
        };

        // Container where isRegistered returns true for GameSessionManager
        const container = createContainer(
          {
            [tokens.IEntityManager]: { clearAll: jest.fn() },
            [tokens.ITurnManager]: { stop: jest.fn() },
            [tokens.GamePersistenceService]: { isSavingAllowed: jest.fn() },
            [tokens.PlaytimeTracker]: {
              endSessionAndAccumulate: jest.fn(),
              reset: jest.fn(),
            },
            [tokens.ISafeEventDispatcher]: safeEventDispatcher,
            [tokens.IInitializationService]: {
              runInitializationSequence: jest.fn(),
            },
            [tokens.GameSessionManager]: mockSessionManager,
          },
          {
            isRegisteredFn: (token) => token === tokens.GameSessionManager,
          }
        );

        const engine = new GameEngine({
          container,
          logger,
        });

        expect(engine).toBeDefined();
        expect(container.isRegistered).toHaveBeenCalledWith(
          tokens.GameSessionManager
        );
        expect(container.resolve).toHaveBeenCalledWith(
          tokens.GameSessionManager
        );
      });
    });

    it('resolves AnatomyInitializationService when registered and creating default session manager', async () => {
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

        jest.doMock('../../../src/utils/engineErrorUtils.js', () => ({
          __esModule: true,
          processOperationFailure: jest.fn(),
        }));

        const { default: GameEngine } = await import(
          '../../../src/engine/gameEngine.js'
        );

        const logger = createLogger();
        const safeEventDispatcher = {
          dispatch: jest.fn().mockResolvedValue(true),
          setBatchMode: jest.fn(),
        };
        const mockAnatomyService = { initialize: jest.fn() };

        // Container where isRegistered returns true for AnatomyInitializationService only
        const container = createContainer(
          {
            [tokens.IEntityManager]: { clearAll: jest.fn() },
            [tokens.ITurnManager]: { stop: jest.fn() },
            [tokens.GamePersistenceService]: { isSavingAllowed: jest.fn() },
            [tokens.PlaytimeTracker]: {
              endSessionAndAccumulate: jest.fn(),
              reset: jest.fn(),
            },
            [tokens.ISafeEventDispatcher]: safeEventDispatcher,
            [tokens.IInitializationService]: {
              runInitializationSequence: jest.fn(),
            },
            [tokens.AnatomyInitializationService]: mockAnatomyService,
          },
          {
            isRegisteredFn: (token) =>
              token === tokens.AnatomyInitializationService,
          }
        );

        const engine = new GameEngine({
          container,
          logger,
        });

        expect(engine).toBeDefined();
        expect(container.isRegistered).toHaveBeenCalledWith(
          tokens.AnatomyInitializationService
        );
        expect(container.resolve).toHaveBeenCalledWith(
          tokens.AnatomyInitializationService
        );
      });
    });
  });

  // Error normalization branches
  describe('error normalization (non-Error throws)', () => {
    it('normalizes non-Error throws in playtimeTracker.endSessionAndAccumulate during stop', async () => {
      await jest.isolateModulesAsync(async () => {
        const engineStateInstance = {
          isInitialized: true,
          isGameLoopRunning: true,
          activeWorld: 'test',
          reset: jest.fn(),
          setStarted: jest.fn(),
        };

        jest.doMock('../../../src/engine/engineState.js', () => ({
          __esModule: true,
          default: jest.fn(() => engineStateInstance),
        }));

        jest.doMock('../../../src/utils/engineErrorUtils.js', () => ({
          __esModule: true,
          processOperationFailure: jest.fn(),
        }));

        const { default: GameEngine } = await import(
          '../../../src/engine/gameEngine.js'
        );

        const logger = createLogger();
        const playtimeTracker = {
          endSessionAndAccumulate: jest.fn(() => {
            throw 'string error thrown'; // Non-Error value (line 544 branch)
          }),
          reset: jest.fn(),
        };
        const safeEventDispatcher = {
          dispatch: jest.fn().mockResolvedValue(true),
          setBatchMode: jest.fn(),
        };
        const turnManager = { stop: jest.fn() };

        const container = createContainer({
          [tokens.IEntityManager]: { clearAll: jest.fn() },
          [tokens.ITurnManager]: turnManager,
          [tokens.GamePersistenceService]: { isSavingAllowed: jest.fn() },
          [tokens.PlaytimeTracker]: playtimeTracker,
          [tokens.ISafeEventDispatcher]: safeEventDispatcher,
          [tokens.IInitializationService]: {
            runInitializationSequence: jest.fn(),
          },
        });

        const engine = new GameEngine({
          container,
          logger,
          sessionManager: { stop: jest.fn() },
        });

        // stop() re-throws caughtError after cleanup
        await expect(engine.stop()).rejects.toThrow('string error thrown');

        expect(logger.error).toHaveBeenCalledWith(
          'GameEngine.stop: Failed to end playtime session cleanly.',
          expect.any(Error)
        );
      });
    });

    it('normalizes non-Error throws in dispatch during stop (line 577)', async () => {
      await jest.isolateModulesAsync(async () => {
        const engineStateInstance = {
          isInitialized: true,
          isGameLoopRunning: true,
          activeWorld: 'test',
          reset: jest.fn(),
          setStarted: jest.fn(),
        };

        jest.doMock('../../../src/engine/engineState.js', () => ({
          __esModule: true,
          default: jest.fn(() => engineStateInstance),
        }));

        jest.doMock('../../../src/utils/engineErrorUtils.js', () => ({
          __esModule: true,
          processOperationFailure: jest.fn(),
        }));

        const { default: GameEngine } = await import(
          '../../../src/engine/gameEngine.js'
        );

        const logger = createLogger();
        const playtimeTracker = {
          endSessionAndAccumulate: jest.fn(),
          reset: jest.fn(),
        };
        const safeEventDispatcher = {
          dispatch: jest.fn(() => {
            throw { code: 'NON_ERROR' }; // Non-Error thrown (line 577)
          }),
          setBatchMode: jest.fn(),
        };
        const turnManager = { stop: jest.fn() };

        const container = createContainer({
          [tokens.IEntityManager]: { clearAll: jest.fn() },
          [tokens.ITurnManager]: turnManager,
          [tokens.GamePersistenceService]: { isSavingAllowed: jest.fn() },
          [tokens.PlaytimeTracker]: playtimeTracker,
          [tokens.ISafeEventDispatcher]: safeEventDispatcher,
          [tokens.IInitializationService]: {
            runInitializationSequence: jest.fn(),
          },
        });

        const engine = new GameEngine({
          container,
          logger,
          sessionManager: { stop: jest.fn() },
        });

        // stop() re-throws caughtError after cleanup
        await expect(engine.stop()).rejects.toThrow('[object Object]');

        expect(logger.error).toHaveBeenCalledWith(
          'GameEngine.stop: Encountered error while stopping engine. Engine state will be reset.',
          expect.any(Error)
        );
      });
    });

    it('normalizes non-Error throws in turnManager.stop (line 600)', async () => {
      await jest.isolateModulesAsync(async () => {
        const engineStateInstance = {
          isInitialized: true,
          isGameLoopRunning: true,
          activeWorld: 'test',
          reset: jest.fn(),
          setStarted: jest.fn(),
        };

        jest.doMock('../../../src/engine/engineState.js', () => ({
          __esModule: true,
          default: jest.fn(() => engineStateInstance),
        }));

        jest.doMock('../../../src/utils/engineErrorUtils.js', () => ({
          __esModule: true,
          processOperationFailure: jest.fn(),
        }));

        const { default: GameEngine } = await import(
          '../../../src/engine/gameEngine.js'
        );

        const logger = createLogger();
        const playtimeTracker = {
          endSessionAndAccumulate: jest.fn(),
          reset: jest.fn(),
        };
        const safeEventDispatcher = {
          dispatch: jest.fn().mockResolvedValue(true),
          setBatchMode: jest.fn(),
        };
        const turnManager = {
          stop: jest.fn(() => {
            throw 12345; // Non-Error (number) thrown (line 600)
          }),
        };

        const container = createContainer({
          [tokens.IEntityManager]: { clearAll: jest.fn() },
          [tokens.ITurnManager]: turnManager,
          [tokens.GamePersistenceService]: { isSavingAllowed: jest.fn() },
          [tokens.PlaytimeTracker]: playtimeTracker,
          [tokens.ISafeEventDispatcher]: safeEventDispatcher,
          [tokens.IInitializationService]: {
            runInitializationSequence: jest.fn(),
          },
        });

        const engine = new GameEngine({
          container,
          logger,
          sessionManager: { stop: jest.fn() },
        });

        // stop() re-throws caughtError after cleanup
        await expect(engine.stop()).rejects.toThrow('12345');

        expect(logger.error).toHaveBeenCalledWith(
          'GameEngine.stop: Encountered error while stopping engine. Engine state will be reset.',
          expect.any(Error)
        );
      });
    });

    it('normalizes non-Error throws in entityManager.clearAll (line 147)', async () => {
      await jest.isolateModulesAsync(async () => {
        const engineStateInstance = {
          isInitialized: true,
          isGameLoopRunning: true,
          activeWorld: 'test',
          reset: jest.fn(),
          setStarted: jest.fn(),
        };

        jest.doMock('../../../src/engine/engineState.js', () => ({
          __esModule: true,
          default: jest.fn(() => engineStateInstance),
        }));

        jest.doMock('../../../src/utils/engineErrorUtils.js', () => ({
          __esModule: true,
          processOperationFailure: jest.fn(),
        }));

        const { default: GameEngine } = await import(
          '../../../src/engine/gameEngine.js'
        );

        const logger = createLogger();
        const entityManager = {
          clearAll: jest.fn(() => {
            throw 'entity clear string error'; // Non-Error (line 147)
          }),
        };
        const playtimeTracker = {
          endSessionAndAccumulate: jest.fn(),
          reset: jest.fn(),
        };
        const safeEventDispatcher = {
          dispatch: jest.fn().mockResolvedValue(true),
          setBatchMode: jest.fn(),
        };
        const turnManager = { stop: jest.fn() };

        const container = createContainer({
          [tokens.IEntityManager]: entityManager,
          [tokens.ITurnManager]: turnManager,
          [tokens.GamePersistenceService]: { isSavingAllowed: jest.fn() },
          [tokens.PlaytimeTracker]: playtimeTracker,
          [tokens.ISafeEventDispatcher]: safeEventDispatcher,
          [tokens.IInitializationService]: {
            runInitializationSequence: jest.fn(),
          },
        });

        const engine = new GameEngine({
          container,
          logger,
          sessionManager: { stop: jest.fn() },
        });

        // stop() re-throws caughtError after cleanup (from resetCoreGameState)
        await expect(engine.stop()).rejects.toThrow('entity clear string error');

        expect(logger.error).toHaveBeenCalledWith(
          'GameEngine._resetCoreGameState: Failed to clear EntityManager.',
          expect.any(Error)
        );
      });
    });

    it('normalizes non-Error throws in playtimeTracker.reset (line 164)', async () => {
      await jest.isolateModulesAsync(async () => {
        const engineStateInstance = {
          isInitialized: true,
          isGameLoopRunning: true,
          activeWorld: 'test',
          reset: jest.fn(),
          setStarted: jest.fn(),
        };

        jest.doMock('../../../src/engine/engineState.js', () => ({
          __esModule: true,
          default: jest.fn(() => engineStateInstance),
        }));

        jest.doMock('../../../src/utils/engineErrorUtils.js', () => ({
          __esModule: true,
          processOperationFailure: jest.fn(),
        }));

        const { default: GameEngine } = await import(
          '../../../src/engine/gameEngine.js'
        );

        const logger = createLogger();
        const entityManager = { clearAll: jest.fn() };
        const playtimeTracker = {
          endSessionAndAccumulate: jest.fn(),
          reset: jest.fn(() => {
            throw { reason: 'object error' }; // Non-Error (line 164)
          }),
        };
        const safeEventDispatcher = {
          dispatch: jest.fn().mockResolvedValue(true),
          setBatchMode: jest.fn(),
        };
        const turnManager = { stop: jest.fn() };

        const container = createContainer({
          [tokens.IEntityManager]: entityManager,
          [tokens.ITurnManager]: turnManager,
          [tokens.GamePersistenceService]: { isSavingAllowed: jest.fn() },
          [tokens.PlaytimeTracker]: playtimeTracker,
          [tokens.ISafeEventDispatcher]: safeEventDispatcher,
          [tokens.IInitializationService]: {
            runInitializationSequence: jest.fn(),
          },
        });

        const engine = new GameEngine({
          container,
          logger,
          sessionManager: { stop: jest.fn() },
        });

        // stop() re-throws caughtError after cleanup (from resetCoreGameState)
        await expect(engine.stop()).rejects.toThrow('[object Object]');

        expect(logger.error).toHaveBeenCalledWith(
          'GameEngine._resetCoreGameState: Failed to reset PlaytimeTracker.',
          expect.any(Error)
        );
      });
    });
  });

  // Cleanup error attachment branches (lines 615-637)
  describe('cleanup error attachment in stop()', () => {
    it('attaches cleanup error to caughtError.cleanupErrors array (lines 617-621)', async () => {
      await jest.isolateModulesAsync(async () => {
        const engineStateInstance = {
          isInitialized: true,
          isGameLoopRunning: true,
          activeWorld: 'test',
          reset: jest.fn(() => {
            throw new Error('Engine reset error');
          }),
          setStarted: jest.fn(),
        };

        jest.doMock('../../../src/engine/engineState.js', () => ({
          __esModule: true,
          default: jest.fn(() => engineStateInstance),
        }));

        jest.doMock('../../../src/utils/engineErrorUtils.js', () => ({
          __esModule: true,
          processOperationFailure: jest.fn(),
        }));

        const { default: GameEngine } = await import(
          '../../../src/engine/gameEngine.js'
        );

        const logger = createLogger();
        const entityManager = {
          clearAll: jest.fn(() => {
            throw new Error('Entity clear error'); // First error becomes caughtError
          }),
        };
        const playtimeTracker = {
          endSessionAndAccumulate: jest.fn(),
          reset: jest.fn(),
        };
        const safeEventDispatcher = {
          dispatch: jest.fn().mockResolvedValue(true),
          setBatchMode: jest.fn(),
        };
        const turnManager = { stop: jest.fn() };

        const container = createContainer({
          [tokens.IEntityManager]: entityManager,
          [tokens.ITurnManager]: turnManager,
          [tokens.GamePersistenceService]: { isSavingAllowed: jest.fn() },
          [tokens.PlaytimeTracker]: playtimeTracker,
          [tokens.ISafeEventDispatcher]: safeEventDispatcher,
          [tokens.IInitializationService]: {
            runInitializationSequence: jest.fn(),
          },
        });

        const engine = new GameEngine({
          container,
          logger,
          sessionManager: { stop: jest.fn() },
        });

        // The engine.stop() will throw after cleanup - expect the first error (Entity clear error)
        await expect(engine.stop()).rejects.toThrow('Entity clear error');

        // Engine reset error should be attached as cleanupError
        expect(logger.error).toHaveBeenCalledWith(
          'GameEngine._resetCoreGameState: Failed to clear EntityManager.',
          expect.any(Error)
        );
      });
    });

    it('pushes to existing cleanupErrors array when already present (line 620-621)', async () => {
      await jest.isolateModulesAsync(async () => {
        const engineStateInstance = {
          isInitialized: true,
          isGameLoopRunning: true,
          activeWorld: 'test',
          reset: jest.fn(() => {
            throw new Error('Engine state reset error');
          }),
          setStarted: jest.fn(),
        };

        jest.doMock('../../../src/engine/engineState.js', () => ({
          __esModule: true,
          default: jest.fn(() => engineStateInstance),
        }));

        jest.doMock('../../../src/utils/engineErrorUtils.js', () => ({
          __esModule: true,
          processOperationFailure: jest.fn(),
        }));

        const { default: GameEngine } = await import(
          '../../../src/engine/gameEngine.js'
        );

        const logger = createLogger();
        // Multiple failures: entityManager, playtimeTracker.reset, and engineState.reset
        const entityManager = {
          clearAll: jest.fn(() => {
            throw new Error('Entity clear error');
          }),
        };
        const playtimeTracker = {
          endSessionAndAccumulate: jest.fn(),
          reset: jest.fn(() => {
            throw new Error('Playtime reset error');
          }),
        };
        const safeEventDispatcher = {
          dispatch: jest.fn().mockResolvedValue(true),
          setBatchMode: jest.fn(),
        };
        const turnManager = { stop: jest.fn() };

        const container = createContainer({
          [tokens.IEntityManager]: entityManager,
          [tokens.ITurnManager]: turnManager,
          [tokens.GamePersistenceService]: { isSavingAllowed: jest.fn() },
          [tokens.PlaytimeTracker]: playtimeTracker,
          [tokens.ISafeEventDispatcher]: safeEventDispatcher,
          [tokens.IInitializationService]: {
            runInitializationSequence: jest.fn(),
          },
        });

        const engine = new GameEngine({
          container,
          logger,
          sessionManager: { stop: jest.fn() },
        });

        // The engine.stop() will throw after cleanup - expect the first error (Entity clear error)
        await expect(engine.stop()).rejects.toThrow('Entity clear error');

        // Both entity and playtime errors occurred in resetCoreGameState
        expect(logger.error).toHaveBeenCalledWith(
          'GameEngine._resetCoreGameState: Failed to clear EntityManager.',
          expect.any(Error)
        );
        expect(logger.error).toHaveBeenCalledWith(
          'GameEngine._resetCoreGameState: Failed to reset PlaytimeTracker.',
          expect.any(Error)
        );
      });
    });
  });

  // Error throwing fallback (line 195)
  describe('resetCoreGameState error throwing', () => {
    it('throws playtimeResetError when entityResetError is null (line 195)', async () => {
      await jest.isolateModulesAsync(async () => {
        const engineStateInstance = {
          isInitialized: true,
          isGameLoopRunning: true,
          activeWorld: 'test',
          reset: jest.fn(),
          setStarted: jest.fn(),
        };

        jest.doMock('../../../src/engine/engineState.js', () => ({
          __esModule: true,
          default: jest.fn(() => engineStateInstance),
        }));

        jest.doMock('../../../src/utils/engineErrorUtils.js', () => ({
          __esModule: true,
          processOperationFailure: jest.fn(),
        }));

        const { default: GameEngine } = await import(
          '../../../src/engine/gameEngine.js'
        );

        const logger = createLogger();
        const entityManager = { clearAll: jest.fn() }; // No error
        const playtimeTracker = {
          endSessionAndAccumulate: jest.fn(),
          reset: jest.fn(() => {
            throw new Error('Only playtime error'); // Only this error (line 195 branch)
          }),
        };
        const safeEventDispatcher = {
          dispatch: jest.fn().mockResolvedValue(true),
          setBatchMode: jest.fn(),
        };
        const turnManager = { stop: jest.fn() };

        const container = createContainer({
          [tokens.IEntityManager]: entityManager,
          [tokens.ITurnManager]: turnManager,
          [tokens.GamePersistenceService]: { isSavingAllowed: jest.fn() },
          [tokens.PlaytimeTracker]: playtimeTracker,
          [tokens.ISafeEventDispatcher]: safeEventDispatcher,
          [tokens.IInitializationService]: {
            runInitializationSequence: jest.fn(),
          },
        });

        const engine = new GameEngine({
          container,
          logger,
          sessionManager: { stop: jest.fn() },
        });

        // Only playtime error occurs, which gets thrown (line 195 branch)
        await expect(engine.stop()).rejects.toThrow('Only playtime error');

        expect(logger.error).toHaveBeenCalledWith(
          'GameEngine._resetCoreGameState: Failed to reset PlaytimeTracker.',
          expect.objectContaining({ message: 'Only playtime error' })
        );
      });
    });
  });

  // previewLlmPromptForCurrentActor branches (lines 726-749, 764-772)
  describe('previewLlmPromptForCurrentActor branches', () => {
    it('normalizes non-Error from buildChoices and retries llmId (lines 726, 734)', async () => {
      await jest.isolateModulesAsync(async () => {
        const engineStateInstance = {
          isInitialized: true,
          isGameLoopRunning: true,
          activeWorld: 'test',
          reset: jest.fn(),
          setStarted: jest.fn(),
        };

        jest.doMock('../../../src/engine/engineState.js', () => ({
          __esModule: true,
          default: jest.fn(() => engineStateInstance),
        }));

        jest.doMock('../../../src/utils/engineErrorUtils.js', () => ({
          __esModule: true,
          processOperationFailure: jest.fn(),
        }));

        const { default: GameEngine } = await import(
          '../../../src/engine/gameEngine.js'
        );

        const logger = createLogger();
        let callCount = 0;
        const llmAdapter = {
          getCurrentActiveLlmId: jest.fn(() => {
            callCount++;
            if (callCount === 1) {
              throw 'string error on retry'; // Non-Error on retry (line 734)
            }
            return 'test-llm';
          }),
          getAIDecision: jest.fn(),
        };
        const turnActionChoicePipeline = {
          buildChoices: jest.fn(() => {
            throw 'string error in buildChoices'; // Non-Error (line 726)
          }),
        };
        const safeEventDispatcher = {
          dispatch: jest.fn().mockResolvedValue(true),
          setBatchMode: jest.fn(),
        };
        const turnManager = {
          stop: jest.fn(),
          getCurrentActor: jest.fn().mockReturnValue({ id: 'actor1' }),
          getActiveTurnHandler: jest.fn().mockReturnValue({
            getTurnContext: jest.fn().mockReturnValue({ someContext: true }),
          }),
        };
        const entityDisplayDataProvider = {
          getEntityName: jest.fn().mockReturnValue('Test Actor'),
        };

        const container = createContainer({
          [tokens.IEntityManager]: { clearAll: jest.fn() },
          [tokens.ITurnManager]: turnManager,
          [tokens.GamePersistenceService]: { isSavingAllowed: jest.fn() },
          [tokens.PlaytimeTracker]: {
            endSessionAndAccumulate: jest.fn(),
            reset: jest.fn(),
          },
          [tokens.ISafeEventDispatcher]: safeEventDispatcher,
          [tokens.IInitializationService]: {
            runInitializationSequence: jest.fn(),
          },
          [tokens.TurnActionChoicePipeline]: turnActionChoicePipeline,
          [tokens.LLMAdapter]: llmAdapter,
          [tokens.IAIPromptPipeline]: { generatePrompt: jest.fn() },
          [tokens.EntityDisplayDataProvider]: entityDisplayDataProvider,
        });

        const engine = new GameEngine({
          container,
          logger,
          sessionManager: { stop: jest.fn() },
        });

        await engine.previewLlmPromptForCurrentActor();

        expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
          UI_SHOW_LLM_PROMPT_PREVIEW,
          expect.objectContaining({
            errors: expect.arrayContaining([
              'string error in buildChoices',
              'string error on retry',
            ]),
          }),
          { allowSchemaNotFound: true }
        );
      });
    });

    it('logs warning when dispatch returns false (line 765)', async () => {
      await jest.isolateModulesAsync(async () => {
        const engineStateInstance = {
          isInitialized: true,
          isGameLoopRunning: true,
          activeWorld: 'test',
          reset: jest.fn(),
          setStarted: jest.fn(),
        };

        jest.doMock('../../../src/engine/engineState.js', () => ({
          __esModule: true,
          default: jest.fn(() => engineStateInstance),
        }));

        jest.doMock('../../../src/utils/engineErrorUtils.js', () => ({
          __esModule: true,
          processOperationFailure: jest.fn(),
        }));

        const { default: GameEngine } = await import(
          '../../../src/engine/gameEngine.js'
        );

        const logger = createLogger();
        const llmAdapter = {
          getCurrentActiveLlmId: jest.fn().mockResolvedValue('test-llm'),
          getAIDecision: jest.fn(),
        };
        const turnActionChoicePipeline = {
          buildChoices: jest.fn().mockResolvedValue([]),
        };
        const aiPromptPipeline = {
          generatePrompt: jest.fn().mockResolvedValue('test prompt'),
        };
        const safeEventDispatcher = {
          dispatch: jest.fn().mockResolvedValue(false), // Returns false (line 765)
          setBatchMode: jest.fn(),
        };
        const turnManager = {
          stop: jest.fn(),
          getCurrentActor: jest.fn().mockReturnValue({ id: 'actor1' }),
          getActiveTurnHandler: jest.fn().mockReturnValue({
            getTurnContext: jest.fn().mockReturnValue({ someContext: true }),
          }),
        };
        const entityDisplayDataProvider = {
          getEntityName: jest.fn().mockReturnValue('Test Actor'),
        };

        const container = createContainer({
          [tokens.IEntityManager]: { clearAll: jest.fn() },
          [tokens.ITurnManager]: turnManager,
          [tokens.GamePersistenceService]: { isSavingAllowed: jest.fn() },
          [tokens.PlaytimeTracker]: {
            endSessionAndAccumulate: jest.fn(),
            reset: jest.fn(),
          },
          [tokens.ISafeEventDispatcher]: safeEventDispatcher,
          [tokens.IInitializationService]: {
            runInitializationSequence: jest.fn(),
          },
          [tokens.TurnActionChoicePipeline]: turnActionChoicePipeline,
          [tokens.LLMAdapter]: llmAdapter,
          [tokens.IAIPromptPipeline]: aiPromptPipeline,
          [tokens.EntityDisplayDataProvider]: entityDisplayDataProvider,
        });

        const engine = new GameEngine({
          container,
          logger,
          sessionManager: { stop: jest.fn() },
        });

        await engine.previewLlmPromptForCurrentActor();

        expect(logger.warn).toHaveBeenCalledWith(
          'GameEngine.previewLlmPromptForCurrentActor: SafeEventDispatcher reported failure when dispatching UI_SHOW_LLM_PROMPT_PREVIEW.'
        );
      });
    });

    it('logs error when dispatch throws non-Error (line 770)', async () => {
      await jest.isolateModulesAsync(async () => {
        const engineStateInstance = {
          isInitialized: true,
          isGameLoopRunning: true,
          activeWorld: 'test',
          reset: jest.fn(),
          setStarted: jest.fn(),
        };

        jest.doMock('../../../src/engine/engineState.js', () => ({
          __esModule: true,
          default: jest.fn(() => engineStateInstance),
        }));

        jest.doMock('../../../src/utils/engineErrorUtils.js', () => ({
          __esModule: true,
          processOperationFailure: jest.fn(),
        }));

        const { default: GameEngine } = await import(
          '../../../src/engine/gameEngine.js'
        );

        const logger = createLogger();
        const llmAdapter = {
          getCurrentActiveLlmId: jest.fn().mockResolvedValue('test-llm'),
          getAIDecision: jest.fn(),
        };
        const turnActionChoicePipeline = {
          buildChoices: jest.fn().mockResolvedValue([]),
        };
        const aiPromptPipeline = {
          generatePrompt: jest.fn().mockResolvedValue('test prompt'),
        };
        const safeEventDispatcher = {
          dispatch: jest.fn(() => {
            throw 'dispatch non-Error'; // Non-Error thrown (line 770)
          }),
          setBatchMode: jest.fn(),
        };
        const turnManager = {
          stop: jest.fn(),
          getCurrentActor: jest.fn().mockReturnValue({ id: 'actor1' }),
          getActiveTurnHandler: jest.fn().mockReturnValue({
            getTurnContext: jest.fn().mockReturnValue({ someContext: true }),
          }),
        };
        const entityDisplayDataProvider = {
          getEntityName: jest.fn().mockReturnValue('Test Actor'),
        };

        const container = createContainer({
          [tokens.IEntityManager]: { clearAll: jest.fn() },
          [tokens.ITurnManager]: turnManager,
          [tokens.GamePersistenceService]: { isSavingAllowed: jest.fn() },
          [tokens.PlaytimeTracker]: {
            endSessionAndAccumulate: jest.fn(),
            reset: jest.fn(),
          },
          [tokens.ISafeEventDispatcher]: safeEventDispatcher,
          [tokens.IInitializationService]: {
            runInitializationSequence: jest.fn(),
          },
          [tokens.TurnActionChoicePipeline]: turnActionChoicePipeline,
          [tokens.LLMAdapter]: llmAdapter,
          [tokens.IAIPromptPipeline]: aiPromptPipeline,
          [tokens.EntityDisplayDataProvider]: entityDisplayDataProvider,
        });

        const engine = new GameEngine({
          container,
          logger,
          sessionManager: { stop: jest.fn() },
        });

        await engine.previewLlmPromptForCurrentActor();

        expect(logger.error).toHaveBeenCalledWith(
          'GameEngine.previewLlmPromptForCurrentActor: SafeEventDispatcher threw while dispatching UI_SHOW_LLM_PROMPT_PREVIEW.',
          expect.any(Error)
        );
      });
    });
  });

  // Error message fallback (line 448)
  describe('error message fallback', () => {
    it('uses String(error) when error.message is falsy (line 448)', async () => {
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

        jest.doMock('../../../src/utils/engineErrorUtils.js', () => ({
          __esModule: true,
          processOperationFailure: jest.fn(),
        }));

        const { default: GameEngine } = await import(
          '../../../src/engine/gameEngine.js'
        );

        const logger = createLogger();
        const initializationService = {
          runInitializationSequence: jest.fn().mockResolvedValue({
            success: true,
          }),
        };
        const sessionManager = {
          stop: jest.fn(),
          finalizeNewGameSuccess: jest.fn(() => {
            // Create an error with empty message
            const err = new Error();
            err.message = ''; // Empty message (line 448 fallback)
            throw err;
          }),
        };
        const safeEventDispatcher = {
          dispatch: jest.fn().mockResolvedValue(true),
          setBatchMode: jest.fn(),
        };

        const container = createContainer({
          [tokens.IEntityManager]: { clearAll: jest.fn() },
          [tokens.ITurnManager]: { stop: jest.fn() },
          [tokens.GamePersistenceService]: { isSavingAllowed: jest.fn() },
          [tokens.PlaytimeTracker]: {
            endSessionAndAccumulate: jest.fn(),
            reset: jest.fn(),
          },
          [tokens.ISafeEventDispatcher]: safeEventDispatcher,
          [tokens.IInitializationService]: initializationService,
        });

        const engine = new GameEngine({
          container,
          logger,
          sessionManager,
        });

        await expect(engine.startNewGame('testWorld')).rejects.toThrow();

        // The error log should contain the error using String() fallback
        expect(logger.error).toHaveBeenCalled();
      });
    });
  });

  // Additional uncovered branches
  describe('additional branch coverage', () => {
    // Line 244: Non-Error in ENGINE_INITIALIZING_UI dispatch
    it('normalizes non-Error throws in ENGINE_INITIALIZING_UI dispatch (line 244)', async () => {
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

        jest.doMock('../../../src/utils/engineErrorUtils.js', () => ({
          __esModule: true,
          processOperationFailure: jest.fn(),
        }));

        const { default: GameEngine } = await import(
          '../../../src/engine/gameEngine.js'
        );

        const logger = createLogger();
        // Dispatch throws non-Error on ENGINE_INITIALIZING_UI
        const safeEventDispatcher = {
          dispatch: jest.fn(() => {
            throw 'non-error in dispatch'; // Non-Error (line 244)
          }),
          setBatchMode: jest.fn(),
        };
        const initializationService = {
          runInitializationSequence: jest.fn().mockResolvedValue({
            success: true,
          }),
        };

        const container = createContainer({
          [tokens.IEntityManager]: { clearAll: jest.fn() },
          [tokens.ITurnManager]: { stop: jest.fn() },
          [tokens.GamePersistenceService]: { isSavingAllowed: jest.fn() },
          [tokens.PlaytimeTracker]: {
            endSessionAndAccumulate: jest.fn(),
            reset: jest.fn(),
          },
          [tokens.ISafeEventDispatcher]: safeEventDispatcher,
          [tokens.IInitializationService]: initializationService,
        });

        const engine = new GameEngine({
          container,
          logger,
          sessionManager: {
            stop: jest.fn(),
            finalizeNewGameSuccess: jest.fn(),
            prepareForNewGameSession: jest.fn().mockResolvedValue(undefined),
          },
        });

        // Should not throw - the dispatch error is caught and logged
        await engine.startNewGame('testWorld');

        expect(logger.error).toHaveBeenCalledWith(
          'GameEngine._executeInitializationSequence: SafeEventDispatcher threw when dispatching ENGINE_INITIALIZING_UI.',
          expect.any(Error)
        );
      });
    });

    // Line 578: dispatch throws when caughtError already set
    it('does not overwrite caughtError when dispatch throws and caughtError is already set (line 578)', async () => {
      await jest.isolateModulesAsync(async () => {
        const engineStateInstance = {
          isInitialized: true,
          isGameLoopRunning: true,
          activeWorld: 'test',
          reset: jest.fn(),
          setStarted: jest.fn(),
        };

        jest.doMock('../../../src/engine/engineState.js', () => ({
          __esModule: true,
          default: jest.fn(() => engineStateInstance),
        }));

        jest.doMock('../../../src/utils/engineErrorUtils.js', () => ({
          __esModule: true,
          processOperationFailure: jest.fn(),
        }));

        const { default: GameEngine } = await import(
          '../../../src/engine/gameEngine.js'
        );

        const logger = createLogger();
        const playtimeTracker = {
          endSessionAndAccumulate: jest.fn(() => {
            throw new Error('First error'); // First error sets caughtError
          }),
          reset: jest.fn(),
        };
        const safeEventDispatcher = {
          dispatch: jest.fn(() => {
            throw new Error('Dispatch error'); // Second error (line 578 branch - !caughtError is false)
          }),
          setBatchMode: jest.fn(),
        };
        const turnManager = { stop: jest.fn() };

        const container = createContainer({
          [tokens.IEntityManager]: { clearAll: jest.fn() },
          [tokens.ITurnManager]: turnManager,
          [tokens.GamePersistenceService]: { isSavingAllowed: jest.fn() },
          [tokens.PlaytimeTracker]: playtimeTracker,
          [tokens.ISafeEventDispatcher]: safeEventDispatcher,
          [tokens.IInitializationService]: {
            runInitializationSequence: jest.fn(),
          },
        });

        const engine = new GameEngine({
          container,
          logger,
          sessionManager: { stop: jest.fn() },
        });

        // First error is thrown, not the dispatch error
        await expect(engine.stop()).rejects.toThrow('First error');
      });
    });

    // Line 601: turnManager.stop throws when caughtError already set
    it('does not overwrite caughtError when turnManager.stop throws and caughtError is already set (line 601)', async () => {
      await jest.isolateModulesAsync(async () => {
        const engineStateInstance = {
          isInitialized: true,
          isGameLoopRunning: true,
          activeWorld: 'test',
          reset: jest.fn(),
          setStarted: jest.fn(),
        };

        jest.doMock('../../../src/engine/engineState.js', () => ({
          __esModule: true,
          default: jest.fn(() => engineStateInstance),
        }));

        jest.doMock('../../../src/utils/engineErrorUtils.js', () => ({
          __esModule: true,
          processOperationFailure: jest.fn(),
        }));

        const { default: GameEngine } = await import(
          '../../../src/engine/gameEngine.js'
        );

        const logger = createLogger();
        const playtimeTracker = {
          endSessionAndAccumulate: jest.fn(() => {
            throw new Error('First error from playtime');
          }),
          reset: jest.fn(),
        };
        const safeEventDispatcher = {
          dispatch: jest.fn().mockResolvedValue(true),
          setBatchMode: jest.fn(),
        };
        const turnManager = {
          stop: jest.fn(() => {
            throw new Error('TurnManager error'); // Second error (line 601 - !caughtError is false)
          }),
        };

        const container = createContainer({
          [tokens.IEntityManager]: { clearAll: jest.fn() },
          [tokens.ITurnManager]: turnManager,
          [tokens.GamePersistenceService]: { isSavingAllowed: jest.fn() },
          [tokens.PlaytimeTracker]: playtimeTracker,
          [tokens.ISafeEventDispatcher]: safeEventDispatcher,
          [tokens.IInitializationService]: {
            runInitializationSequence: jest.fn(),
          },
        });

        const engine = new GameEngine({
          container,
          logger,
          sessionManager: { stop: jest.fn() },
        });

        // First error is thrown, not the turnManager error
        await expect(engine.stop()).rejects.toThrow('First error from playtime');
      });
    });

    // Line 615: cleanupError === caughtError case
    it('does not add cleanup error when it equals caughtError (line 615)', async () => {
      await jest.isolateModulesAsync(async () => {
        const sharedError = new Error('Shared error');
        const engineStateInstance = {
          isInitialized: true,
          isGameLoopRunning: true,
          activeWorld: 'test',
          reset: jest.fn(() => {
            throw sharedError; // Same error will be attached as cleanup
          }),
          setStarted: jest.fn(),
        };

        jest.doMock('../../../src/engine/engineState.js', () => ({
          __esModule: true,
          default: jest.fn(() => engineStateInstance),
        }));

        jest.doMock('../../../src/utils/engineErrorUtils.js', () => ({
          __esModule: true,
          processOperationFailure: jest.fn(),
        }));

        const { default: GameEngine } = await import(
          '../../../src/engine/gameEngine.js'
        );

        const logger = createLogger();
        const entityManager = {
          clearAll: jest.fn(() => {
            throw sharedError; // Same error instance sets caughtError
          }),
        };
        const safeEventDispatcher = {
          dispatch: jest.fn().mockResolvedValue(true),
          setBatchMode: jest.fn(),
        };
        const turnManager = { stop: jest.fn() };

        const container = createContainer({
          [tokens.IEntityManager]: entityManager,
          [tokens.ITurnManager]: turnManager,
          [tokens.GamePersistenceService]: { isSavingAllowed: jest.fn() },
          [tokens.PlaytimeTracker]: {
            endSessionAndAccumulate: jest.fn(),
            reset: jest.fn(),
          },
          [tokens.ISafeEventDispatcher]: safeEventDispatcher,
          [tokens.IInitializationService]: {
            runInitializationSequence: jest.fn(),
          },
        });

        const engine = new GameEngine({
          container,
          logger,
          sessionManager: { stop: jest.fn() },
        });

        // The shared error is thrown
        await expect(engine.stop()).rejects.toThrow('Shared error');
      });
    });

    // Lines 620 + 623-625: cleanupErrors augmentation fails
    it('falls back to setting cleanupErrors array when augmentation fails (lines 620, 623-625)', async () => {
      await jest.isolateModulesAsync(async () => {
        const caughtError = new Error('Original error');
        // Make cleanupErrors property non-array to trigger line 620 false branch
        Object.defineProperty(caughtError, 'cleanupErrors', {
          value: 'not-an-array',
          writable: false,
          configurable: false,
        });

        const engineStateInstance = {
          isInitialized: true,
          isGameLoopRunning: true,
          activeWorld: 'test',
          reset: jest.fn(() => {
            throw new Error('Engine reset error'); // Cleanup error
          }),
          setStarted: jest.fn(),
        };

        jest.doMock('../../../src/engine/engineState.js', () => ({
          __esModule: true,
          default: jest.fn(() => engineStateInstance),
        }));

        jest.doMock('../../../src/utils/engineErrorUtils.js', () => ({
          __esModule: true,
          processOperationFailure: jest.fn(),
        }));

        const { default: GameEngine } = await import(
          '../../../src/engine/gameEngine.js'
        );

        const logger = createLogger();
        const entityManager = {
          clearAll: jest.fn(() => {
            throw caughtError; // This error has non-array cleanupErrors
          }),
        };
        const safeEventDispatcher = {
          dispatch: jest.fn().mockResolvedValue(true),
          setBatchMode: jest.fn(),
        };
        const turnManager = { stop: jest.fn() };

        const container = createContainer({
          [tokens.IEntityManager]: entityManager,
          [tokens.ITurnManager]: turnManager,
          [tokens.GamePersistenceService]: { isSavingAllowed: jest.fn() },
          [tokens.PlaytimeTracker]: {
            endSessionAndAccumulate: jest.fn(),
            reset: jest.fn(),
          },
          [tokens.ISafeEventDispatcher]: safeEventDispatcher,
          [tokens.IInitializationService]: {
            runInitializationSequence: jest.fn(),
          },
        });

        const engine = new GameEngine({
          container,
          logger,
          sessionManager: { stop: jest.fn() },
        });

        await expect(engine.stop()).rejects.toThrow('Original error');
      });
    });

    // Line 727: error.message fallback in previewLlmPromptForCurrentActor
    it('uses String(error) fallback when error.message is falsy in previewLlmPrompt (line 727)', async () => {
      await jest.isolateModulesAsync(async () => {
        const engineStateInstance = {
          isInitialized: true,
          isGameLoopRunning: true,
          activeWorld: 'test',
          reset: jest.fn(),
          setStarted: jest.fn(),
        };

        jest.doMock('../../../src/engine/engineState.js', () => ({
          __esModule: true,
          default: jest.fn(() => engineStateInstance),
        }));

        jest.doMock('../../../src/utils/engineErrorUtils.js', () => ({
          __esModule: true,
          processOperationFailure: jest.fn(),
        }));

        const { default: GameEngine } = await import(
          '../../../src/engine/gameEngine.js'
        );

        const logger = createLogger();
        const llmAdapter = {
          getCurrentActiveLlmId: jest.fn().mockResolvedValue('test-llm'),
          getAIDecision: jest.fn(),
        };
        const errorWithNoMessage = new Error();
        errorWithNoMessage.message = ''; // Empty message triggers fallback
        const turnActionChoicePipeline = {
          buildChoices: jest.fn(() => {
            throw errorWithNoMessage;
          }),
        };
        const safeEventDispatcher = {
          dispatch: jest.fn().mockResolvedValue(true),
          setBatchMode: jest.fn(),
        };
        const turnManager = {
          stop: jest.fn(),
          getCurrentActor: jest.fn().mockReturnValue({ id: 'actor1' }),
          getActiveTurnHandler: jest.fn().mockReturnValue({
            getTurnContext: jest.fn().mockReturnValue({ someContext: true }),
          }),
        };
        const entityDisplayDataProvider = {
          getEntityName: jest.fn().mockReturnValue('Test Actor'),
        };

        const container = createContainer({
          [tokens.IEntityManager]: { clearAll: jest.fn() },
          [tokens.ITurnManager]: turnManager,
          [tokens.GamePersistenceService]: { isSavingAllowed: jest.fn() },
          [tokens.PlaytimeTracker]: {
            endSessionAndAccumulate: jest.fn(),
            reset: jest.fn(),
          },
          [tokens.ISafeEventDispatcher]: safeEventDispatcher,
          [tokens.IInitializationService]: {
            runInitializationSequence: jest.fn(),
          },
          [tokens.TurnActionChoicePipeline]: turnActionChoicePipeline,
          [tokens.LLMAdapter]: llmAdapter,
          [tokens.IAIPromptPipeline]: { generatePrompt: jest.fn() },
          [tokens.EntityDisplayDataProvider]: entityDisplayDataProvider,
        });

        const engine = new GameEngine({
          container,
          logger,
          sessionManager: { stop: jest.fn() },
        });

        await engine.previewLlmPromptForCurrentActor();

        // Error should be in dispatch call
        expect(safeEventDispatcher.dispatch).toHaveBeenCalled();
      });
    });

    // Line 729: llmId already set when buildChoices throws - skip retry
    it('skips llmId retry when llmId is already set (line 729)', async () => {
      await jest.isolateModulesAsync(async () => {
        const engineStateInstance = {
          isInitialized: true,
          isGameLoopRunning: true,
          activeWorld: 'test',
          reset: jest.fn(),
          setStarted: jest.fn(),
        };

        jest.doMock('../../../src/engine/engineState.js', () => ({
          __esModule: true,
          default: jest.fn(() => engineStateInstance),
        }));

        jest.doMock('../../../src/utils/engineErrorUtils.js', () => ({
          __esModule: true,
          processOperationFailure: jest.fn(),
        }));

        const { default: GameEngine } = await import(
          '../../../src/engine/gameEngine.js'
        );

        const logger = createLogger();
        const llmAdapter = {
          getCurrentActiveLlmId: jest.fn().mockResolvedValue('test-llm'),
          getAIDecision: jest.fn(),
        };
        const turnActionChoicePipeline = {
          buildChoices: jest.fn().mockResolvedValue([]),
        };
        const aiPromptPipeline = {
          generatePrompt: jest.fn(() => {
            throw new Error('Prompt generation error'); // Throws after llmId is set
          }),
        };
        const safeEventDispatcher = {
          dispatch: jest.fn().mockResolvedValue(true),
          setBatchMode: jest.fn(),
        };
        const turnManager = {
          stop: jest.fn(),
          getCurrentActor: jest.fn().mockReturnValue({ id: 'actor1' }),
          getActiveTurnHandler: jest.fn().mockReturnValue({
            getTurnContext: jest.fn().mockReturnValue({ someContext: true }),
          }),
        };
        const entityDisplayDataProvider = {
          getEntityName: jest.fn().mockReturnValue('Test Actor'),
        };

        const container = createContainer({
          [tokens.IEntityManager]: { clearAll: jest.fn() },
          [tokens.ITurnManager]: turnManager,
          [tokens.GamePersistenceService]: { isSavingAllowed: jest.fn() },
          [tokens.PlaytimeTracker]: {
            endSessionAndAccumulate: jest.fn(),
            reset: jest.fn(),
          },
          [tokens.ISafeEventDispatcher]: safeEventDispatcher,
          [tokens.IInitializationService]: {
            runInitializationSequence: jest.fn(),
          },
          [tokens.TurnActionChoicePipeline]: turnActionChoicePipeline,
          [tokens.LLMAdapter]: llmAdapter,
          [tokens.IAIPromptPipeline]: aiPromptPipeline,
          [tokens.EntityDisplayDataProvider]: entityDisplayDataProvider,
        });

        const engine = new GameEngine({
          container,
          logger,
          sessionManager: { stop: jest.fn() },
        });

        await engine.previewLlmPromptForCurrentActor();

        // llmAdapter.getCurrentActiveLlmId called only once (not retried because llmId was set)
        expect(llmAdapter.getCurrentActiveLlmId).toHaveBeenCalledTimes(1);
      });
    });

    // Line 738: error.message fallback for llmIdError
    it('uses String(error) fallback for llmIdError message (line 738)', async () => {
      await jest.isolateModulesAsync(async () => {
        const engineStateInstance = {
          isInitialized: true,
          isGameLoopRunning: true,
          activeWorld: 'test',
          reset: jest.fn(),
          setStarted: jest.fn(),
        };

        jest.doMock('../../../src/engine/engineState.js', () => ({
          __esModule: true,
          default: jest.fn(() => engineStateInstance),
        }));

        jest.doMock('../../../src/utils/engineErrorUtils.js', () => ({
          __esModule: true,
          processOperationFailure: jest.fn(),
        }));

        const { default: GameEngine } = await import(
          '../../../src/engine/gameEngine.js'
        );

        const logger = createLogger();
        let llmCallCount = 0;
        const llmIdErrorWithNoMessage = new Error();
        llmIdErrorWithNoMessage.message = ''; // Empty message triggers fallback
        const llmAdapter = {
          getCurrentActiveLlmId: jest.fn(() => {
            llmCallCount++;
            if (llmCallCount === 1) {
              throw llmIdErrorWithNoMessage; // Retry throws error with no message
            }
            return 'test-llm';
          }),
          getAIDecision: jest.fn(),
        };
        const turnActionChoicePipeline = {
          buildChoices: jest.fn(() => {
            throw new Error('buildChoices error'); // First error triggers retry
          }),
        };
        const safeEventDispatcher = {
          dispatch: jest.fn().mockResolvedValue(true),
          setBatchMode: jest.fn(),
        };
        const turnManager = {
          stop: jest.fn(),
          getCurrentActor: jest.fn().mockReturnValue({ id: 'actor1' }),
          getActiveTurnHandler: jest.fn().mockReturnValue({
            getTurnContext: jest.fn().mockReturnValue({ someContext: true }),
          }),
        };
        const entityDisplayDataProvider = {
          getEntityName: jest.fn().mockReturnValue('Test Actor'),
        };

        const container = createContainer({
          [tokens.IEntityManager]: { clearAll: jest.fn() },
          [tokens.ITurnManager]: turnManager,
          [tokens.GamePersistenceService]: { isSavingAllowed: jest.fn() },
          [tokens.PlaytimeTracker]: {
            endSessionAndAccumulate: jest.fn(),
            reset: jest.fn(),
          },
          [tokens.ISafeEventDispatcher]: safeEventDispatcher,
          [tokens.IInitializationService]: {
            runInitializationSequence: jest.fn(),
          },
          [tokens.TurnActionChoicePipeline]: turnActionChoicePipeline,
          [tokens.LLMAdapter]: llmAdapter,
          [tokens.IAIPromptPipeline]: { generatePrompt: jest.fn() },
          [tokens.EntityDisplayDataProvider]: entityDisplayDataProvider,
        });

        const engine = new GameEngine({
          container,
          logger,
          sessionManager: { stop: jest.fn() },
        });

        await engine.previewLlmPromptForCurrentActor();

        // Dispatch should have been called with errors
        expect(safeEventDispatcher.dispatch).toHaveBeenCalled();
      });
    });

    // Line 448: caughtError with empty message uses String() fallback
    it('uses String() fallback when caughtError.message is empty string (line 448)', async () => {
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

        jest.doMock('../../../src/utils/engineErrorUtils.js', () => ({
          __esModule: true,
          processOperationFailure: jest.fn(),
        }));

        const { default: GameEngine } = await import(
          '../../../src/engine/gameEngine.js'
        );

        const logger = createLogger();
        const safeEventDispatcher = {
          dispatch: jest.fn().mockResolvedValue(true),
          setBatchMode: jest.fn(),
        };
        const initializationService = {
          runInitializationSequence: jest.fn().mockResolvedValue({
            success: true,
          }),
        };

        const container = createContainer({
          [tokens.IEntityManager]: { clearAll: jest.fn() },
          [tokens.ITurnManager]: { stop: jest.fn() },
          [tokens.GamePersistenceService]: { isSavingAllowed: jest.fn() },
          [tokens.PlaytimeTracker]: {
            endSessionAndAccumulate: jest.fn(),
            reset: jest.fn(),
          },
          [tokens.ISafeEventDispatcher]: safeEventDispatcher,
          [tokens.IInitializationService]: initializationService,
        });

        // Error with empty message
        const errorWithEmptyMessage = new Error('');
        errorWithEmptyMessage.message = ''; // Ensure empty

        const engine = new GameEngine({
          container,
          logger,
          sessionManager: {
            stop: jest.fn(),
            finalizeNewGameSuccess: jest.fn(),
            prepareForNewGameSession: jest.fn().mockRejectedValue(errorWithEmptyMessage),
          },
        });

        await expect(engine.startNewGame('testWorld')).rejects.toThrow();

        // Logger.error should have used String(caughtError) fallback
        expect(logger.error).toHaveBeenCalled();
      });
    });

    // Line 495: rawInitError is undefined (falsy path)
    it('skips cause assignment when rawInitError is undefined (line 495)', async () => {
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

        jest.doMock('../../../src/utils/engineErrorUtils.js', () => ({
          __esModule: true,
          processOperationFailure: jest.fn(),
          getReadableErrorMessage: jest.fn().mockReturnValue('Unknown error.'),
        }));

        const { default: GameEngine } = await import(
          '../../../src/engine/gameEngine.js'
        );

        const logger = createLogger();
        const safeEventDispatcher = {
          dispatch: jest.fn().mockResolvedValue(true),
          setBatchMode: jest.fn(),
        };
        // initResult.success = false with error = undefined
        const initializationService = {
          runInitializationSequence: jest.fn().mockResolvedValue({
            success: false,
            error: undefined, // undefined - line 495 branch
          }),
        };

        const container = createContainer({
          [tokens.IEntityManager]: { clearAll: jest.fn() },
          [tokens.ITurnManager]: { stop: jest.fn() },
          [tokens.GamePersistenceService]: { isSavingAllowed: jest.fn() },
          [tokens.PlaytimeTracker]: {
            endSessionAndAccumulate: jest.fn(),
            reset: jest.fn(),
          },
          [tokens.ISafeEventDispatcher]: safeEventDispatcher,
          [tokens.IInitializationService]: initializationService,
        });

        const engine = new GameEngine({
          container,
          logger,
          sessionManager: {
            stop: jest.fn(),
            finalizeNewGameSuccess: jest.fn(),
            prepareForNewGameSession: jest.fn().mockResolvedValue(undefined),
          },
        });

        await expect(engine.startNewGame('testWorld')).rejects.toThrow(
          'Unknown failure from InitializationService.'
        );
      });
    });

    // Tests that errors from #resetCoreGameState are properly caught and logged in stop()
    it('logs and propagates errors from resetCoreGameState in stop() cleanup', async () => {
      await jest.isolateModulesAsync(async () => {
        const engineStateInstance = {
          isInitialized: true,
          isGameLoopRunning: true,
          activeWorld: 'test',
          reset: jest.fn(),
          setStarted: jest.fn(),
        };

        jest.doMock('../../../src/engine/engineState.js', () => ({
          __esModule: true,
          default: jest.fn(() => engineStateInstance),
        }));

        jest.doMock('../../../src/utils/engineErrorUtils.js', () => ({
          __esModule: true,
          processOperationFailure: jest.fn(),
        }));

        const { default: GameEngine } = await import(
          '../../../src/engine/gameEngine.js'
        );

        const logger = createLogger();
        const safeEventDispatcher = {
          dispatch: jest.fn().mockResolvedValue(true),
          setBatchMode: jest.fn(),
        };

        // EntityManager.clearAll throws (normalized internally by #resetCoreGameState)
        const entityManager = {
          clearAll: jest.fn().mockImplementation(() => {
            throw 'entity clear failure';
          }),
        };

        const container = createContainer({
          [tokens.IEntityManager]: entityManager,
          [tokens.ITurnManager]: { stop: jest.fn() },
          [tokens.GamePersistenceService]: { isSavingAllowed: jest.fn() },
          [tokens.PlaytimeTracker]: {
            endSessionAndAccumulate: jest.fn(),
            reset: jest.fn(),
          },
          [tokens.ISafeEventDispatcher]: safeEventDispatcher,
          [tokens.IInitializationService]: {
            runInitializationSequence: jest.fn(),
          },
        });

        const engine = new GameEngine({
          container,
          logger,
          sessionManager: { stop: jest.fn() },
        });

        // stop() will throw because caughtError is set from the cleanup failure
        await expect(engine.stop()).rejects.toThrow('entity clear failure');

        // Error should be logged by both #resetCoreGameState and stop()
        expect(logger.error).toHaveBeenCalledWith(
          'GameEngine._resetCoreGameState: Failed to clear EntityManager.',
          expect.any(Error)
        );
        expect(logger.error).toHaveBeenCalledWith(
          'GameEngine.stop: Failed to reset core game state cleanly.',
          expect.any(Error)
        );
      });
    });

    // Line 749: availableActions is not an array
    it('returns 0 for actionCount when availableActions is not an array (line 749)', async () => {
      await jest.isolateModulesAsync(async () => {
        const engineStateInstance = {
          isInitialized: true,
          isGameLoopRunning: true,
          activeWorld: 'test',
          reset: jest.fn(),
          setStarted: jest.fn(),
        };

        jest.doMock('../../../src/engine/engineState.js', () => ({
          __esModule: true,
          default: jest.fn(() => engineStateInstance),
        }));

        jest.doMock('../../../src/utils/engineErrorUtils.js', () => ({
          __esModule: true,
          processOperationFailure: jest.fn(),
        }));

        const { default: GameEngine } = await import(
          '../../../src/engine/gameEngine.js'
        );

        const logger = createLogger();
        // buildChoices returns non-array (object, undefined, null, etc.)
        const turnActionChoicePipeline = {
          buildChoices: jest.fn().mockResolvedValue({
            availableActions: null, // Not an array
          }),
        };
        const llmAdapter = {
          getCurrentActiveLlmId: jest.fn().mockReturnValue('test-llm'),
        };
        const aiPromptPipeline = {
          generatePrompt: jest.fn().mockResolvedValue({ prompt: 'test' }),
        };
        const safeEventDispatcher = {
          dispatch: jest.fn().mockResolvedValue(true),
          setBatchMode: jest.fn(),
        };
        const turnManager = {
          stop: jest.fn(),
          getCurrentActor: jest.fn().mockReturnValue({ id: 'actor1' }),
          getActiveTurnHandler: jest.fn().mockReturnValue({
            getTurnContext: jest.fn().mockReturnValue({ someContext: true }),
          }),
        };
        const entityDisplayDataProvider = {
          getEntityName: jest.fn().mockReturnValue('Test Actor'),
        };

        const container = createContainer({
          [tokens.IEntityManager]: { clearAll: jest.fn() },
          [tokens.ITurnManager]: turnManager,
          [tokens.GamePersistenceService]: { isSavingAllowed: jest.fn() },
          [tokens.PlaytimeTracker]: {
            endSessionAndAccumulate: jest.fn(),
            reset: jest.fn(),
          },
          [tokens.ISafeEventDispatcher]: safeEventDispatcher,
          [tokens.IInitializationService]: {
            runInitializationSequence: jest.fn(),
          },
          [tokens.TurnActionChoicePipeline]: turnActionChoicePipeline,
          [tokens.LLMAdapter]: llmAdapter,
          [tokens.IAIPromptPipeline]: aiPromptPipeline,
          [tokens.EntityDisplayDataProvider]: entityDisplayDataProvider,
        });

        const engine = new GameEngine({
          container,
          logger,
          sessionManager: { stop: jest.fn() },
        });

        await engine.previewLlmPromptForCurrentActor();

        // Dispatch should include actionCount: 0 (not array fallback)
        expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            actionCount: 0, // Fallback for non-array
          }),
          expect.anything()
        );
      });
    });
  });
});
