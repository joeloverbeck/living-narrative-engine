import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { initEngineUIManager } from '../../../../../src/bootstrapper/stages/auxiliary/initEngineUIManager.js';
import { resolveAndInitialize } from '../../../../../src/bootstrapper/helpers.js';

jest.mock('../../../../../src/bootstrapper/helpers.js', () => ({
  __esModule: true,
  resolveAndInitialize: jest.fn(() => ({ success: true })),
}));

/**
 * Create a simple logger mock used for testing.
 *
 * @returns {{debug: jest.Mock, warn: jest.Mock, error: jest.Mock}} Mock logger
 *   implementing the expected methods.
 */
function createLogger() {
  return { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

const tokens = { EngineUIManager: 'EngineUIManager' };

describe('initEngineUIManager', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('calls resolveAndInitialize with correct arguments', () => {
    const container = {};
    const logger = createLogger();

    const result = initEngineUIManager({ container, logger, tokens });

    expect(resolveAndInitialize).toHaveBeenCalledWith(
      container,
      tokens.EngineUIManager,
      'initialize',
      logger
    );
    expect(result).toEqual({ success: true });
  });

  it('returns whatever resolveAndInitialize returns', () => {
    const ret = { success: false, error: new Error('boom') };
    resolveAndInitialize.mockReturnValueOnce(ret);
    const container = {};
    const logger = createLogger();

    const result = initEngineUIManager({ container, logger, tokens });
    expect(result).toBe(ret);
  });
});
