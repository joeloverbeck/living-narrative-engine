import { describe, it, expect, jest } from '@jest/globals';
import { assertParamsObject } from '../../src/utils/handlerUtils/paramsUtils.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../src/constants/eventIds.js';

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
    expect(dispatcher.dispatch).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'TEST_OP: params missing or invalid.',
      details: { params: undefined },
    });
  });

  it('returns true and does not log when params are valid', () => {
    const logger = { warn: jest.fn() };
    const result = assertParamsObject({ ok: true }, logger, 'TEST_OP');
    expect(result).toBe(true);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
