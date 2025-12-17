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
        throw new Error(
          `Unexpected token resolution request: ${String(token)}`
        );
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
      };

      const engine = new GameEngine({
        container,
        logger,
        sessionManager,
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
      };

      const engine = new GameEngine({
        container,
        logger,
        sessionManager,
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
      };

      const engine = new GameEngine({
        container,
        logger,
        sessionManager,
      });

      await expect(engine.stop()).rejects.toBe(caughtErrorProxy);

      expect(caughtErrorProxy.cleanupErrors).toEqual([cleanupFailure]);
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
        thrownError = /** @type {Error & { originalResult?: unknown }} */ (
          error
        );
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
      const failureDetail = {
        message: 'Mods loader crashed.',
        code: 'INIT-77',
      };

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
        thrownError = /** @type {Error & { originalError?: unknown }} */ (
          error
        );
      } finally {
        restoreCauseSetter();
      }

      expect(thrownError).toBeInstanceOf(Error);
      expect(thrownError.message).toBe('Mods loader crashed.');
      expect(thrownError.originalError).toBe(failureDetail);
    });
  }
);
