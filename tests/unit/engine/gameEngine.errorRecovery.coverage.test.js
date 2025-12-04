import { describe, it, expect, jest } from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { describeEngineSuite } from '../../common/engine/gameEngineTestBed.js';
import { DEFAULT_TEST_WORLD } from '../../common/constants.js';

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
 * @param root0
 * @param root0.isRegistered
 */
function createContainer(resolutionMap, { isRegistered = () => false } = {}) {
  const defaults = {
    [tokens.TurnActionChoicePipeline]: { buildChoices: jest.fn() },
    [tokens.IAIPromptPipeline]: { generatePrompt: jest.fn() },
    [tokens.LLMAdapter]: { getCurrentActiveLlmId: jest.fn() },
    [tokens.EntityDisplayDataProvider]: { getEntityName: jest.fn() },
  };
  const map = { ...defaults, ...resolutionMap };
  return {
    resolve: jest.fn((token) => {
      if (!Object.prototype.hasOwnProperty.call(map, token)) {
        throw new Error(`Unexpected token resolution request: ${String(token)}`);
      }
      return map[token];
    }),
    isRegistered: jest.fn(isRegistered),
  };
}

/**
 *
 */
function installFailingCauseSetter() {
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    Error.prototype,
    'cause'
  );

  Object.defineProperty(Error.prototype, 'cause', {
    configurable: true,
    set() {
      throw new Error('cause assignment blocked for test coverage');
    },
  });

  return () => {
    if (originalDescriptor) {
      Object.defineProperty(Error.prototype, 'cause', originalDescriptor);
    } else {
      delete Error.prototype.cause;
    }
  };
}

describe('GameEngine additional error recovery coverage', () => {
  it('propagates cleanup errors and accumulates reset errors during stop()', async () => {
    await jest.isolateModulesAsync(async () => {
      const engineStateInstance = {
        isInitialized: true,
        isGameLoopRunning: true,
        activeWorld: 'alpha',
        reset: jest.fn(() => {
          throw 'engine reset fail';
        }),
      };

      jest.doMock('../../../src/engine/engineState.js', () => ({
        __esModule: true,
        default: jest.fn(() => engineStateInstance),
      }));

      jest.doMock('../../../src/engine/persistenceCoordinator.js', () => ({
        __esModule: true,
        default: jest.fn(() => ({
          triggerManualSave: jest.fn(),
          loadGame: jest.fn(),
        })),
      }));

      const { default: GameEngine } = await import(
        '../../../src/engine/gameEngine.js'
      );

      const logger = createLogger();
      const playtimeEndError = new Error('playtime session failed');
      const entityResetError = new Error('entity reset failed');
      entityResetError.cause = { existing: true };
      entityResetError.resetErrors = [];
      const playtimeResetError = new Error('playtime reset failed');

      const entityManager = {
        clearAll: jest.fn(() => {
          throw entityResetError;
        }),
      };
      const turnManager = { stop: jest.fn() };
      const playtimeTracker = {
        endSessionAndAccumulate: jest.fn(() => {
          throw playtimeEndError;
        }),
        reset: jest.fn(() => {
          throw playtimeResetError;
        }),
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
        [tokens.ITurnManager]: turnManager,
        [tokens.GamePersistenceService]: persistenceService,
        [tokens.PlaytimeTracker]: playtimeTracker,
        [tokens.ISafeEventDispatcher]: safeEventDispatcher,
        [tokens.IInitializationService]: initializationService,
      });

      const sessionManager = {
        prepareForNewGameSession: jest.fn(),
        finalizeNewGameSuccess: jest.fn(),
        prepareForLoadGameSession: jest.fn(),
        finalizeLoadSuccess: jest.fn(),
      };

      const persistenceCoordinator = {
        triggerManualSave: jest.fn(),
        loadGame: jest.fn(),
      };

      const engine = new GameEngine({
        container,
        logger,
        sessionManager,
        persistenceCoordinator,
      });

      await expect(engine.stop()).rejects.toBe(playtimeEndError);

      expect(entityResetError.resetErrors).toContain(playtimeResetError);
      expect(playtimeEndError.cleanupErrors).toHaveLength(2);
      expect(playtimeEndError.cleanupErrors[0]).toBe(entityResetError);
      expect(playtimeEndError.cleanupErrors[1]).toBeInstanceOf(Error);
      expect(playtimeEndError.cleanupErrors[1].message).toBe(
        'engine reset fail'
      );
    });
  });

  it('recovers when attaching resetErrors array fails during stop()', async () => {
    await jest.isolateModulesAsync(async () => {
      const engineStateInstance = {
        isInitialized: true,
        isGameLoopRunning: false,
        activeWorld: 'omega',
        reset: jest.fn(),
      };

      jest.doMock('../../../src/engine/engineState.js', () => ({
        __esModule: true,
        default: jest.fn(() => engineStateInstance),
      }));

      jest.doMock('../../../src/engine/persistenceCoordinator.js', () => ({
        __esModule: true,
        default: jest.fn(() => ({
          triggerManualSave: jest.fn(),
          loadGame: jest.fn(),
        })),
      }));

      const { default: GameEngine } = await import(
        '../../../src/engine/gameEngine.js'
      );

      const logger = createLogger();
      const entityResetError = new Error('entity reset failed');
      entityResetError.cause = { existing: true };
      let firstAssignment = true;
      let storedValue;
      Object.defineProperty(entityResetError, 'resetErrors', {
        configurable: true,
        get() {
          return storedValue;
        },
        set(value) {
          if (firstAssignment) {
            firstAssignment = false;
            throw new Error('initial resetErrors assignment failed');
          }
          storedValue = value;
        },
      });

      const playtimeResetError = new Error('playtime reset failed');

      const entityManager = {
        clearAll: jest.fn(() => {
          throw entityResetError;
        }),
      };
      const turnManager = { stop: jest.fn() };
      const playtimeTracker = {
        endSessionAndAccumulate: jest.fn(),
        reset: jest.fn(() => {
          throw playtimeResetError;
        }),
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
        [tokens.ITurnManager]: turnManager,
        [tokens.GamePersistenceService]: persistenceService,
        [tokens.PlaytimeTracker]: playtimeTracker,
        [tokens.ISafeEventDispatcher]: safeEventDispatcher,
        [tokens.IInitializationService]: initializationService,
      });

      const sessionManager = {
        prepareForNewGameSession: jest.fn(),
        finalizeNewGameSuccess: jest.fn(),
        prepareForLoadGameSession: jest.fn(),
        finalizeLoadSuccess: jest.fn(),
      };

      const persistenceCoordinator = {
        triggerManualSave: jest.fn(),
        loadGame: jest.fn(),
      };

      const engine = new GameEngine({
        container,
        logger,
        sessionManager,
        persistenceCoordinator,
      });

      await expect(engine.stop()).rejects.toBe(entityResetError);

      expect(storedValue).toEqual([playtimeResetError]);
    });
  });

  it('falls back when cleanupErrors attachment throws during stop()', async () => {
    await jest.isolateModulesAsync(async () => {
      const engineStateInstance = {
        isInitialized: true,
        isGameLoopRunning: false,
        activeWorld: 'beta',
        reset: jest.fn(),
      };

      jest.doMock('../../../src/engine/engineState.js', () => ({
        __esModule: true,
        default: jest.fn(() => engineStateInstance),
      }));

      jest.doMock('../../../src/engine/persistenceCoordinator.js', () => ({
        __esModule: true,
        default: jest.fn(() => ({
          triggerManualSave: jest.fn(),
          loadGame: jest.fn(),
        })),
      }));

      const { default: GameEngine } = await import(
        '../../../src/engine/gameEngine.js'
      );

      const logger = createLogger();
      const baseCaughtError = new Error('playtime end failed');
      let firstCleanupAssignment = true;
      const caughtErrorProxy = new Proxy(baseCaughtError, {
        has(target, prop) {
          if (prop === 'cleanupErrors') {
            return false;
          }
          return prop in target;
        },
        set(target, prop, value) {
          if (prop === 'cleanupErrors' && firstCleanupAssignment) {
            firstCleanupAssignment = false;
            throw new Error('cleanupErrors setter rejected');
          }
          target[prop] = value;
          return true;
        },
        get(target, prop) {
          return target[prop];
        },
      });

      const cleanupFailure = new Error('core reset failed');

      const entityManager = {
        clearAll: jest.fn(() => {
          throw cleanupFailure;
        }),
      };
      const turnManager = { stop: jest.fn() };
      const playtimeTracker = {
        endSessionAndAccumulate: jest.fn(() => {
          throw caughtErrorProxy;
        }),
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
        [tokens.ITurnManager]: turnManager,
        [tokens.GamePersistenceService]: persistenceService,
        [tokens.PlaytimeTracker]: playtimeTracker,
        [tokens.ISafeEventDispatcher]: safeEventDispatcher,
        [tokens.IInitializationService]: initializationService,
      });

      const sessionManager = {
        prepareForNewGameSession: jest.fn(),
        finalizeNewGameSuccess: jest.fn(),
        prepareForLoadGameSession: jest.fn(),
        finalizeLoadSuccess: jest.fn(),
      };

      const persistenceCoordinator = {
        triggerManualSave: jest.fn(),
        loadGame: jest.fn(),
      };

      const engine = new GameEngine({
        container,
        logger,
        sessionManager,
        persistenceCoordinator,
      });

      await expect(engine.stop()).rejects.toBe(caughtErrorProxy);

      expect(caughtErrorProxy.cleanupErrors).toEqual([cleanupFailure]);
    });
  });

  it('attaches engine reset errors to core failures during load failure handling', async () => {
    await jest.isolateModulesAsync(async () => {
      const engineResetError = new Error('engine reset failed');
      const engineStateInstance = {
        isInitialized: false,
        isGameLoopRunning: false,
        activeWorld: null,
        reset: jest.fn(() => {
          throw engineResetError;
        }),
      };

      jest.doMock('../../../src/engine/engineState.js', () => ({
        __esModule: true,
        default: jest.fn(() => engineStateInstance),
      }));

      let capturedOptions;
      jest.doMock('../../../src/engine/persistenceCoordinator.js', () => ({
        __esModule: true,
        default: jest.fn((options) => {
          capturedOptions = options;
          return {
            triggerManualSave: jest.fn(),
            loadGame: jest.fn(),
          };
        }),
      }));

      const { default: GameEngine } = await import(
        '../../../src/engine/gameEngine.js'
      );

      const logger = createLogger();
      const baseCoreError = new Error('core reset failed');
      baseCoreError.cause = { existing: true };
      let firstEngineResetAssignment = true;
      const coreResetError = new Proxy(baseCoreError, {
        has(target, prop) {
          if (prop === 'engineResetError') {
            return false;
          }
          return prop in target;
        },
        set(target, prop, value) {
          if (prop === 'engineResetError' && firstEngineResetAssignment) {
            firstEngineResetAssignment = false;
            throw new Error('engineResetError assignment failed');
          }
          target[prop] = value;
          return true;
        },
        get(target, prop) {
          return target[prop];
        },
      });
      const playtimeResetError = new Error('playtime reset failed');

      const entityManager = {
        clearAll: jest.fn(() => {
          throw coreResetError;
        }),
      };
      const turnManager = { stop: jest.fn() };
      const playtimeTracker = {
        endSessionAndAccumulate: jest.fn(),
        reset: jest.fn(() => {
          throw playtimeResetError;
        }),
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
        [tokens.ITurnManager]: turnManager,
        [tokens.GamePersistenceService]: persistenceService,
        [tokens.PlaytimeTracker]: playtimeTracker,
        [tokens.ISafeEventDispatcher]: safeEventDispatcher,
        [tokens.IInitializationService]: initializationService,
      });

      const sessionManager = {
        prepareForNewGameSession: jest.fn(),
        finalizeNewGameSuccess: jest.fn(),
        prepareForLoadGameSession: jest.fn(),
        finalizeLoadSuccess: jest.fn(),
      };

      new GameEngine({
        container,
        logger,
        sessionManager,
      });

      expect(capturedOptions).toBeDefined();

      await expect(
        capturedOptions.handleLoadFailure(new Error('load failed'), 'slot-7')
      ).rejects.toBe(coreResetError);

      expect(coreResetError.engineResetError).toBe(engineResetError);
      expect(entityManager.clearAll).toHaveBeenCalledTimes(1);
      expect(playtimeTracker.reset).toHaveBeenCalledTimes(1);
      expect(engineStateInstance.reset).toHaveBeenCalledTimes(1);
    });
  });

  it('surfaces engine reset failures when no core reset error occurs', async () => {
    await jest.isolateModulesAsync(async () => {
      const engineStateInstance = {
        isInitialized: false,
        isGameLoopRunning: false,
        activeWorld: null,
        reset: jest.fn(() => {
          throw 'engine failure';
        }),
      };

      jest.doMock('../../../src/engine/engineState.js', () => ({
        __esModule: true,
        default: jest.fn(() => engineStateInstance),
      }));

      let capturedOptions;
      jest.doMock('../../../src/engine/persistenceCoordinator.js', () => ({
        __esModule: true,
        default: jest.fn((options) => {
          capturedOptions = options;
          return {
            triggerManualSave: jest.fn(),
            loadGame: jest.fn(),
          };
        }),
      }));

      const { default: GameEngine } = await import(
        '../../../src/engine/gameEngine.js'
      );

      const logger = createLogger();

      const entityManager = { clearAll: jest.fn() };
      const turnManager = { stop: jest.fn() };
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
        [tokens.ITurnManager]: turnManager,
        [tokens.GamePersistenceService]: persistenceService,
        [tokens.PlaytimeTracker]: playtimeTracker,
        [tokens.ISafeEventDispatcher]: safeEventDispatcher,
        [tokens.IInitializationService]: initializationService,
      });

      const sessionManager = {
        prepareForNewGameSession: jest.fn(),
        finalizeNewGameSuccess: jest.fn(),
        prepareForLoadGameSession: jest.fn(),
        finalizeLoadSuccess: jest.fn(),
      };

      new GameEngine({
        container,
        logger,
        sessionManager,
      });

      expect(capturedOptions).toBeDefined();

      await expect(
        capturedOptions.handleLoadFailure(new Error('load failed'), 'slot-19')
      ).rejects.toThrow('engine failure');

      const thrown = await capturedOptions
        .handleLoadFailure(new Error('load failed'), 'slot-20')
        .catch((error) => error);

      expect(thrown).toBeInstanceOf(Error);
      expect(thrown.message).toBe('engine failure');
      expect(entityManager.clearAll).toHaveBeenCalledTimes(2);
      expect(playtimeTracker.reset).toHaveBeenCalledTimes(2);
      expect(engineStateInstance.reset).toHaveBeenCalledTimes(2);
    });
  });
});

describeEngineSuite(
  'GameEngine initialization error metadata coverage',
  (context) => {
    it('records the original initialization result when cause assignment fails', async () => {
      const restoreCauseSetter = installFailingCauseSetter();
      const invalidResult = { unexpected: true };

      context.bed
        .getInitializationService()
        .runInitializationSequence.mockResolvedValueOnce(invalidResult);

      /** @type {Error & { originalResult?: unknown }} */
      let thrownError;
      try {
        await context.engine.startNewGame(DEFAULT_TEST_WORLD);
      } catch (error) {
        thrownError = /** @type {Error & { originalResult?: unknown }} */ (error);
      } finally {
        restoreCauseSetter();
      }

      expect(thrownError).toBeInstanceOf(Error);
      expect(thrownError.message).toBe(
        'InitializationService returned an invalid result.'
      );
      expect(thrownError.originalResult).toBe(invalidResult);
    });

    it('stores the original initialization error when cause assignment fails', async () => {
      const restoreCauseSetter = installFailingCauseSetter();
      const failureDetail = { message: 'Mods loader crashed.', code: 'INIT-77' };

      context.bed
        .getInitializationService()
        .runInitializationSequence.mockResolvedValueOnce({
          success: false,
          error: failureDetail,
        });

      /** @type {Error & { originalError?: unknown }} */
      let thrownError;
      try {
        await context.engine.startNewGame(DEFAULT_TEST_WORLD);
      } catch (error) {
        thrownError = /** @type {Error & { originalError?: unknown }} */ (error);
      } finally {
        restoreCauseSetter();
      }

      expect(thrownError).toBeInstanceOf(Error);
      expect(thrownError.message).toBe('Mods loader crashed.');
      expect(thrownError.originalError).toBe(failureDetail);
    });
  }
);
