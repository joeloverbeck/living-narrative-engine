import { describe, test, expect, jest } from '@jest/globals';
import {
  safeCall,
  safeExecute,
} from '../../../src/utils/safeExecutionUtils.js';

describe('safeCall', () => {
  test('returns success result when function executes without error', () => {
    const logger = { debug: jest.fn() };
    const result = safeCall(() => 42, logger, 'ctx');
    expect(result).toEqual({ success: true, result: 42 });
    expect(logger.debug).not.toHaveBeenCalled();
  });

  test('captures error and logs when function throws', () => {
    const logger = { debug: jest.fn() };
    const err = new Error('boom');
    const result = safeCall(
      () => {
        throw err;
      },
      logger,
      'ctx'
    );
    expect(result).toEqual({ success: false, error: err });
    expect(logger.debug).toHaveBeenCalledWith('ctx: operation failed', err);
  });

  test('handles missing logger gracefully', () => {
    const err = new Error('oops');
    const result = safeCall(() => {
      throw err;
    });
    expect(result).toEqual({ success: false, error: err });
  });

  test('ignores logger when debug is not a function', () => {
    const logger = { debug: true };
    const err = new Error('bad');
    const result = safeCall(
      () => {
        throw err;
      },
      logger,
      'ctx'
    );
    expect(result).toEqual({ success: false, error: err });
  });
});

describe('safeExecute', () => {
  test('handles synchronous success', () => {
    const logger = { debug: jest.fn() };
    const result = safeExecute(() => 99, logger, 'sync');
    expect(result).toEqual({ success: true, result: 99 });
  });

  test('handles synchronous failure with logging', () => {
    const logger = { debug: jest.fn() };
    const err = new Error('whoops');
    const result = safeExecute(
      () => {
        throw err;
      },
      logger,
      'sync'
    );
    expect(result).toEqual({ success: false, error: err });
    expect(logger.debug).toHaveBeenCalledWith('sync: operation failed', err);
  });

  test('resolves asynchronous success', async () => {
    const logger = { debug: jest.fn() };
    const result = await safeExecute(async () => 5, logger, 'async');
    expect(result).toEqual({ success: true, result: 5 });
  });

  test('resolves asynchronous failure', async () => {
    const logger = { debug: jest.fn() };
    const err = new Error('async boom');
    const result = await safeExecute(
      async () => {
        throw err;
      },
      logger,
      'async'
    );
    expect(result).toEqual({ success: false, error: err });
    expect(logger.debug).toHaveBeenCalledWith('async: operation failed', err);
  });
});
