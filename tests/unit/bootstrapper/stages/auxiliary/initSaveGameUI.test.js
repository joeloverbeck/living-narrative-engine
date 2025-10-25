import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { initSaveGameUI } from '../../../../../src/bootstrapper/stages/auxiliary/initSaveGameUI.js';
import { resolveAndInitialize } from '../../../../../src/utils/bootstrapperHelpers.js';
import GameEngineSaveAdapter from '../../../../../src/adapters/GameEngineSaveAdapter.js';

jest.mock('../../../../../src/utils/bootstrapperHelpers.js', () => ({
  __esModule: true,
  resolveAndInitialize: jest.fn(async () => ({ success: true })),
}));

jest.mock('../../../../../src/adapters/GameEngineSaveAdapter.js', () => ({
  __esModule: true,
  default: jest.fn(() => ({ mock: 'adapter' })),
}));

/**
 * Builds a minimal logger mock consistent with bootstrapper expectations.
 *
 * @returns {{debug: jest.Mock, info: jest.Mock, warn: jest.Mock, error: jest.Mock}}
 */
function createLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

const tokens = { SaveGameUI: 'SaveGameUI' };

describe('initSaveGameUI', () => {
  afterEach(() => {
    jest.clearAllMocks();
    GameEngineSaveAdapter.mockImplementation(() => ({ mock: 'adapter' }));
    resolveAndInitialize.mockImplementation(async () => ({ success: true }));
  });

  it('creates a GameEngineSaveAdapter and resolves the UI with it', async () => {
    const container = { id: 'container' };
    const logger = createLogger();
    const gameEngine = { id: 'engine-001' };
    const adapterInstances = [];

    GameEngineSaveAdapter.mockImplementation((engine) => {
      const instance = { engine };
      adapterInstances.push(instance);
      return instance;
    });

    const result = await initSaveGameUI({
      container,
      logger,
      gameEngine,
      tokens,
    });

    expect(adapterInstances).toHaveLength(1);
    expect(adapterInstances[0].engine).toBe(gameEngine);
    expect(resolveAndInitialize).toHaveBeenCalledWith(
      container,
      tokens.SaveGameUI,
      'init',
      logger,
      adapterInstances[0]
    );
    expect(result).toEqual({ success: true });
  });

  it('returns the value produced by resolveAndInitialize verbatim', async () => {
    const failure = { success: false, error: new Error('init failed') };
    resolveAndInitialize.mockResolvedValueOnce(failure);

    const container = {};
    const logger = createLogger();
    const gameEngine = {};

    const result = await initSaveGameUI({
      container,
      logger,
      gameEngine,
      tokens,
    });

    expect(result).toBe(failure);
    expect(GameEngineSaveAdapter).toHaveBeenCalledTimes(1);
  });

  it('creates a fresh adapter for each invocation to avoid shared state', async () => {
    const container = {};
    const logger = createLogger();
    const firstEngine = { id: 'engine-unique' };
    const secondEngine = { id: 'engine-two' };

    GameEngineSaveAdapter.mockImplementation(({ id }) => ({ adapterFor: id }));

    await initSaveGameUI({
      container,
      logger,
      gameEngine: firstEngine,
      tokens,
    });
    await initSaveGameUI({
      container,
      logger,
      gameEngine: secondEngine,
      tokens,
    });

    expect(GameEngineSaveAdapter).toHaveBeenNthCalledWith(1, firstEngine);
    expect(GameEngineSaveAdapter).toHaveBeenNthCalledWith(2, secondEngine);

    const firstCallAdapter = resolveAndInitialize.mock.calls[0][4];
    const secondCallAdapter = resolveAndInitialize.mock.calls[1][4];

    expect(firstCallAdapter).toEqual({ adapterFor: 'engine-unique' });
    expect(secondCallAdapter).toEqual({ adapterFor: 'engine-two' });
    expect(firstCallAdapter).not.toBe(secondCallAdapter);
  });
});
