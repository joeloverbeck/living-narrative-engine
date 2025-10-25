import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { initEngineUIManager } from '../../../../../src/bootstrapper/stages/auxiliary/initEngineUIManager.js';
import { resolveAndInitialize } from '../../../../../src/utils/bootstrapperHelpers.js';

jest.mock('../../../../../src/utils/bootstrapperHelpers.js', () => ({
  __esModule: true,
  resolveAndInitialize: jest.fn(async () => ({ success: true })),
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

  it('calls resolveAndInitialize with correct arguments', async () => {
    const container = {};
    const logger = createLogger();

    const result = await initEngineUIManager({ container, logger, tokens });

    expect(resolveAndInitialize).toHaveBeenCalledWith(
      container,
      tokens.EngineUIManager,
      'initialize',
      logger
    );
    expect(result).toEqual({ success: true });
  });

  it('returns whatever resolveAndInitialize returns', async () => {
    const ret = { success: false, error: new Error('boom') };
    resolveAndInitialize.mockResolvedValueOnce(ret);
    const container = {};
    const logger = createLogger();

    const result = await initEngineUIManager({ container, logger, tokens });
    expect(result).toBe(ret);
  });
});
