import { describe, it, expect, jest } from '@jest/globals';

// Mock safeDispatchError so we can verify it's invoked
jest.mock('../../../src/utils/safeDispatchErrorUtils.js', () => ({
  safeDispatchError: jest.fn(),
}));

import { assertParamsObject } from '../../../src/utils/handlerUtils/paramsUtils.js';
import { safeDispatchError } from '../../../src/utils/safeDispatchErrorUtils.js';

describe('assertParamsObject', () => {
  it('logs a warning and returns false when params are invalid', () => {
    const logger = { warn: jest.fn() };
    const result = assertParamsObject(null, logger, 'TEST_OP');
    expect(result).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      'TEST_OP: params missing or invalid.',
      { params: null }
    );
  });

  it('dispatches an error event when logger has dispatch', () => {
    const dispatcher = { dispatch: jest.fn() };
    const result = assertParamsObject(undefined, dispatcher, 'TEST_OP');
    expect(result).toBe(false);
    expect(safeDispatchError).toHaveBeenCalledWith(
      dispatcher,
      'TEST_OP: params missing or invalid.',
      { params: undefined }
    );
  });

  it('returns true and does not log when params are valid', () => {
    const logger = { warn: jest.fn() };
    const result = assertParamsObject({ ok: true }, logger, 'TEST_OP');
    expect(result).toBe(true);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('falls back to console.warn when logger lacks warn or dispatch', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const result = assertParamsObject(null, {}, 'TEST_OP');
    expect(result).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith(
      'TEST_OP: params missing or invalid.',
      {
        params: null,
      }
    );
    consoleSpy.mockRestore();
  });
});
