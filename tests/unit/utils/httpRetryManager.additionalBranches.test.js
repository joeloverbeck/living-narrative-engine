import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { RetryManager } from '../../../src/utils/httpRetryManager.js';

/** @type {ReturnType<import('../../common/mockFactories/loggerMocks.js').createMockLogger>} */
let logger;

beforeEach(() => {
  jest.useFakeTimers();
  const {
    createMockLogger,
  } = require('../../common/mockFactories/loggerMocks.js');
  logger = createMockLogger();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

describe('RetryManager additional branches', () => {
  it('returns false when error is not a network error', async () => {
    const manager = new RetryManager(2, 50, 200, logger);
    const timeoutSpy = jest.spyOn(global, 'setTimeout');
    const result = await manager.handleNetworkError(new Error('boom'), 1);
    expect(result).toEqual({ retried: false });
    expect(timeoutSpy).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('returns false when attempt exceeds maxRetries', async () => {
    const manager = new RetryManager(1, 50, 200, logger);
    const timeoutSpy = jest.spyOn(global, 'setTimeout');
    const err = new TypeError('network request failed');
    const result = await manager.handleNetworkError(err, 1);
    expect(result).toEqual({ retried: false });
    expect(timeoutSpy).not.toHaveBeenCalled();
  });

  it('retries when Node fetch emits "fetch failed" message', async () => {
    const manager = new RetryManager(2, 50, 200, logger);
    const timeoutSpy = jest.spyOn(global, 'setTimeout');
    const err = new TypeError('fetch failed');
    const promise = manager.handleNetworkError(err, 1);
    await jest.runOnlyPendingTimersAsync();
    const result = await promise;

    expect(result).toEqual({ retried: true });
    expect(timeoutSpy).toHaveBeenCalled();
    timeoutSpy.mockRestore();
  });

  it('calculates retry delay with jitter within bounds', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const delayLow = RetryManager.calculateRetryDelay(2, 100, 500);
    jest.spyOn(Math, 'random').mockReturnValue(1);
    const delayHigh = RetryManager.calculateRetryDelay(2, 100, 500);
    expect(delayLow).toBeGreaterThanOrEqual(0);
    expect(delayHigh).toBeLessThanOrEqual(500);
    expect(delayHigh).toBeGreaterThan(delayLow);
    Math.random.mockRestore();
  });
});
