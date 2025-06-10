// tests for additional bootstrapper stages

import { jest, describe, it, expect, afterEach } from '@jest/globals';

// Mock GameEngine before importing stages
jest.mock('../../src/engine/gameEngine.js', () => {
  return { __esModule: true, default: jest.fn(() => ({ mocked: true })) };
});

import GameEngine from '../../src/engine/gameEngine.js';
import {
  setupDIContainerStage,
  resolveCoreServicesStage,
  initializeGameEngineStage,
  setupGlobalEventListenersStage,
  startGameStage,
} from '../../src/bootstrapper/stages.js';
import AppContainer from '../../src/dependencyInjection/appContainer.js';

const createLogger = () => ({
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('setupDIContainerStage', () => {
  it('configures the container using provided function', async () => {
    const configFn = jest.fn();
    const container = await setupDIContainerStage({}, configFn);
    expect(configFn).toHaveBeenCalledWith(container, {});
    expect(container).toBeInstanceOf(AppContainer);
  });

  it('wraps errors with phase', async () => {
    const configFn = jest.fn(() => {
      throw new Error('fail');
    });
    await expect(setupDIContainerStage({}, configFn)).rejects.toMatchObject({
      phase: 'DI Container Setup',
    });
  });
});

describe('resolveCoreServicesStage', () => {
  it('resolves logger from container', async () => {
    const logger = createLogger();
    const container = { resolve: jest.fn().mockReturnValue(logger) };
    const tokens = { ILogger: 'LOGGER' };
    const result = await resolveCoreServicesStage(container, tokens);
    expect(container.resolve).toHaveBeenCalledWith(tokens.ILogger);
    expect(result.logger).toBe(logger);
  });

  it('wraps errors with phase', async () => {
    const container = {
      resolve: jest.fn(() => {
        throw new Error('boom');
      }),
    };
    const tokens = { ILogger: 'LOGGER' };
    await expect(
      resolveCoreServicesStage(container, tokens)
    ).rejects.toMatchObject({ phase: 'Core Services Resolution' });
  });
});

describe('initializeGameEngineStage', () => {
  it('instantiates GameEngine with container', async () => {
    const logger = createLogger();
    const container = {};
    const result = await initializeGameEngineStage(container, logger);
    expect(GameEngine).toHaveBeenCalledWith({ container });
    expect(result).toEqual({ mocked: true });
  });

  it('wraps constructor errors with phase', async () => {
    GameEngine.mockImplementation(() => {
      throw new Error('bad');
    });
    const logger = createLogger();
    await expect(initializeGameEngineStage({}, logger)).rejects.toMatchObject({
      phase: 'GameEngine Initialization',
    });
  });
});

describe('setupGlobalEventListenersStage', () => {
  it('attaches beforeunload listener that stops engine', async () => {
    let cb;
    const windowRef = {
      addEventListener: jest.fn((event, fn) => {
        cb = fn;
      }),
    };
    const stop = jest.fn().mockResolvedValue();
    const gameEngine = {
      getEngineStatus: () => ({ isLoopRunning: true }),
      stop,
    };
    const logger = createLogger();
    await setupGlobalEventListenersStage(gameEngine, logger, windowRef);
    expect(windowRef.addEventListener).toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function)
    );
    await cb();
    expect(stop).toHaveBeenCalled();
  });

  it('throws when windowRef missing', async () => {
    const logger = createLogger();
    await expect(
      setupGlobalEventListenersStage({}, logger, null)
    ).rejects.toMatchObject({ phase: 'Global Event Listeners Setup' });
  });
});

describe('startGameStage', () => {
  it('calls startNewGame on the engine', async () => {
    const logger = createLogger();
    const startNewGame = jest.fn().mockResolvedValue();
    const gameEngine = { startNewGame };
    await startGameStage(gameEngine, 'world1', logger);
    expect(startNewGame).toHaveBeenCalledWith('world1');
  });

  it('throws when engine is missing', async () => {
    const logger = createLogger();
    await expect(startGameStage(null, 'w', logger)).rejects.toMatchObject({
      phase: 'Start Game',
    });
  });

  it('throws when world name invalid', async () => {
    const logger = createLogger();
    await expect(startGameStage({}, '', logger)).rejects.toMatchObject({
      phase: 'Start Game',
    });
  });

  it('wraps errors from startNewGame', async () => {
    const logger = createLogger();
    const gameEngine = {
      startNewGame: jest.fn(() => Promise.reject(new Error('oops'))),
    };
    await expect(startGameStage(gameEngine, 'w', logger)).rejects.toMatchObject(
      { phase: 'Start Game' }
    );
  });
});
