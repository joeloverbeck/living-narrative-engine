import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { initLoadGameUI } from '../../../../../src/bootstrapper/stages/auxiliary/initLoadGameUI.js';
import { resolveAndInitialize } from '../../../../../src/utils/bootstrapperHelpers.js';
import GameEngineLoadAdapter from '../../../../../src/adapters/GameEngineLoadAdapter.js';

jest.mock('../../../../../src/utils/bootstrapperHelpers.js', () => ({
  __esModule: true,
  resolveAndInitialize: jest.fn(async () => ({ success: true })),
}));

jest.mock('../../../../../src/adapters/GameEngineLoadAdapter.js', () => ({
  __esModule: true,
  default: jest.fn(() => ({ mock: 'adapter' })),
}));

/**
 * Create a minimal logger mock for the tests.
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

const tokens = { LoadGameUI: 'LoadGameUI' };

describe('initLoadGameUI', () => {
  afterEach(() => {
    jest.clearAllMocks();
    GameEngineLoadAdapter.mockImplementation(() => ({ mock: 'adapter' }));
    resolveAndInitialize.mockImplementation(async () => ({ success: true }));
  });

  it('creates a GameEngineLoadAdapter and resolves the UI with it', async () => {
    const container = {};
    const logger = createLogger();
    const gameEngine = { id: 'engine-123' };
    const adapterInstances = [];

    GameEngineLoadAdapter.mockImplementation((engine) => {
      const instance = { engine };
      adapterInstances.push(instance);
      return instance;
    });

    const result = await initLoadGameUI({
      container,
      logger,
      gameEngine,
      tokens,
    });

    expect(adapterInstances).toHaveLength(1);
    expect(adapterInstances[0].engine).toBe(gameEngine);
    expect(resolveAndInitialize).toHaveBeenCalledWith(
      container,
      tokens.LoadGameUI,
      'init',
      logger,
      adapterInstances[0]
    );
    expect(result).toEqual({ success: true });
  });

  it('returns the result produced by resolveAndInitialize', async () => {
    const expected = { success: false, error: new Error('failed') };
    resolveAndInitialize.mockResolvedValueOnce(expected);
    const container = {};
    const logger = createLogger();
    const gameEngine = {};

    const result = await initLoadGameUI({
      container,
      logger,
      gameEngine,
      tokens,
    });

    expect(result).toBe(expected);
    expect(GameEngineLoadAdapter).toHaveBeenCalledTimes(1);
  });
});
