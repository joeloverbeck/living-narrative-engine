// tests for additional bootstrapper stages

import { jest, describe, it, expect, afterEach } from '@jest/globals';

// Mock GameEngine before importing stages
jest.mock('../../src/engine/gameEngine.js', () => {
  return { __esModule: true, default: jest.fn(() => ({ mocked: true })) };
});

import GameEngine from '../../src/engine/gameEngine.js';
import {
  setupDIContainerStage,
  resolveLoggerStage,
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
    const result = await setupDIContainerStage({}, configFn);
    expect(result.success).toBe(true);
    expect(configFn).toHaveBeenCalledWith(result.payload, {});
    expect(result.payload).toBeInstanceOf(AppContainer);
  });

  it('wraps errors with phase', async () => {
    const configFn = jest.fn(() => {
      throw new Error('fail');
    });
    const result = await setupDIContainerStage({}, configFn);
    expect(result.success).toBe(false);
    expect(result.error.phase).toBe('DI Container Setup');
  });

  it('uses provided factory for container creation', async () => {
    const configFn = jest.fn();
    const cont = new AppContainer();
    const factory = jest.fn(() => cont);

    const result = await setupDIContainerStage({}, configFn, factory);

    expect(factory).toHaveBeenCalled();
    expect(configFn).toHaveBeenCalledWith(cont, {});
    expect(result).toBe(cont);
  });
});

describe('resolveLoggerStage', () => {
  it('resolves logger from container', async () => {
    const logger = createLogger();
    const container = { resolve: jest.fn().mockReturnValue(logger) };
    const tokens = { ILogger: 'LOGGER' };
    const result = await resolveLoggerStage(container, tokens);
    expect(container.resolve).toHaveBeenCalledWith(tokens.ILogger);
    expect(result.success).toBe(true);
    expect(result.payload.logger).toBe(logger);
  });

  it('wraps errors with phase', async () => {
    const container = {
      resolve: jest.fn(() => {
        throw new Error('boom');
      }),
    };
    const tokens = { ILogger: 'LOGGER' };
    const result = await resolveLoggerStage(container, tokens);
    expect(result.success).toBe(false);
    expect(result.error.phase).toBe('Core Services Resolution');
  });

  it('fails when logger resolves to null', async () => {
    const container = { resolve: jest.fn().mockReturnValue(null) };
    const tokens = { ILogger: 'LOGGER' };

    await expect(resolveLoggerStage(container, tokens)).rejects.toMatchObject({
      phase: 'Core Services Resolution',
    });
  });
});

describe('initializeGameEngineStage', () => {
  it('instantiates GameEngine with container', async () => {
    const logger = createLogger();
    const container = {};
    const result = await initializeGameEngineStage(container, logger);
    expect(GameEngine).toHaveBeenCalledWith({ container });
    expect(result.success).toBe(true);
    expect(result.payload).toEqual({ mocked: true });
  });

  it('wraps constructor errors with phase', async () => {
    GameEngine.mockImplementation(() => {
      throw new Error('bad');
    });
    const logger = createLogger();
    const result = await initializeGameEngineStage({}, logger);
    expect(result.success).toBe(false);
    expect(result.error.phase).toBe('GameEngine Initialization');
  });

  it('supports custom factory function', async () => {
    const logger = createLogger();
    const container = {};
    const engine = { custom: true };
    const factory = jest.fn(() => engine);

    const result = await initializeGameEngineStage(container, logger, factory);

    expect(factory).toHaveBeenCalledWith({ container });
    expect(result).toBe(engine);
  });

  it('throws when factory returns null', async () => {
    const logger = createLogger();
    const factory = jest.fn(() => null);
    factory.prototype = undefined;

    await expect(
      initializeGameEngineStage({}, logger, factory)
    ).rejects.toMatchObject({ phase: 'GameEngine Initialization' });
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
    const result = await setupGlobalEventListenersStage(gameEngine, logger, windowRef);
    expect(windowRef.addEventListener).toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function)
    );
    await cb();
    expect(stop).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('throws when windowRef missing', async () => {
    const logger = createLogger();
    const result = await setupGlobalEventListenersStage({}, logger, null);
    expect(result.success).toBe(false);
    expect(result.error.phase).toBe('Global Event Listeners Setup');
  });

  it('does not stop engine when loop not running', async () => {
    let cb;
    const windowRef = {
      addEventListener: jest.fn((evt, fn) => {
        cb = fn;
      }),
    };
    const stop = jest.fn();
    const gameEngine = {
      getEngineStatus: () => ({ isLoopRunning: false }),
      stop,
    };
    const logger = createLogger();

    await setupGlobalEventListenersStage(gameEngine, logger, windowRef);
    await cb();

    expect(stop).not.toHaveBeenCalled();
  });
});

describe('startGameStage', () => {
  it('calls startNewGame on the engine', async () => {
    const logger = createLogger();
    const startNewGame = jest.fn().mockResolvedValue();
    const gameEngine = { startNewGame };
    const result = await startGameStage(gameEngine, 'world1', logger);
    expect(startNewGame).toHaveBeenCalledWith('world1');
    expect(result.success).toBe(true);
  });

  it('throws when engine is missing', async () => {
    const logger = createLogger();
    const resultMissing = await startGameStage(null, 'w', logger);
    expect(resultMissing.success).toBe(false);
    expect(resultMissing.error.phase).toBe('Start Game');
  });

  it('throws when world name invalid', async () => {
    const logger = createLogger();
    const resultInvalid = await startGameStage({}, '', logger);
    expect(resultInvalid.success).toBe(false);
    expect(resultInvalid.error.phase).toBe('Start Game');
  });

  it('wraps errors from startNewGame', async () => {
    const logger = createLogger();
    const gameEngine = {
      startNewGame: jest.fn(() => Promise.reject(new Error('oops'))),
    };
    const resultError = await startGameStage(gameEngine, 'w', logger);
    expect(resultError.success).toBe(false);
    expect(resultError.error.phase).toBe('Start Game');
  });
});
