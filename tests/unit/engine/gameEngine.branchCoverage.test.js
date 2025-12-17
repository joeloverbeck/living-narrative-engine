import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
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
  const defaults = {
    [tokens.TurnActionChoicePipeline]: { buildChoices: jest.fn() },
    [tokens.IAIPromptPipeline]: { generatePrompt: jest.fn() },
    [tokens.LLMAdapter]: { getCurrentActiveLlmId: jest.fn() },
    [tokens.EntityDisplayDataProvider]: { getEntityName: jest.fn() },
  };
  const map = { ...defaults, ...resolutionMap };
  const resolve = jest.fn((token) => {
    if (!Object.prototype.hasOwnProperty.call(map, token)) {
      throw new Error(`Unexpected token resolution request: ${String(token)}`);
    }
    return map[token];
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
});
