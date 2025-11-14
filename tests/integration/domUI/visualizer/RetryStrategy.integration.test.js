/**
 * @file Integration tests for RetryStrategy using production collaborators.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { RetryStrategy } from '../../../../src/domUI/visualizer/RetryStrategy.js';
import { createEnhancedMockLogger } from '../../../common/mockFactories/loggerMocks.js';

const NETWORK_ERROR = new Error('NETWORK_ERROR: temporary outage');
NETWORK_ERROR.name = 'NetworkError';

const TEMPORARY_ERROR = new Error('Network timeout while rendering anatomy');
TEMPORARY_ERROR.name = 'TimeoutError';

describe('RetryStrategy integration', () => {
  let logger;
  let retryStrategy;

  beforeEach(() => {
    logger = createEnhancedMockLogger();
    retryStrategy = new RetryStrategy(
      { logger },
      {
        baseDelayMs: 10,
        maxDelayMs: 500,
        jitterPercent: 0.1,
        circuitBreakerThreshold: 2,
        circuitBreakerTimeoutMs: 200,
      }
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    if (retryStrategy && !retryStrategy.isDisposed()) {
      retryStrategy.dispose();
    }
  });

  it('retries retryable operations until success and records statistics', async () => {
    jest.useFakeTimers({ now: Date.now() });
    const operation = jest
      .fn()
      .mockRejectedValueOnce(
        new Error('Network timeout while loading anatomy assets')
      )
      .mockResolvedValueOnce({ anatomyId: 'heart' });
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    const executionPromise = retryStrategy.execute('load-anatomy', operation, {
      maxAttempts: 2,
      baseDelayMs: 25,
      maxDelayMs: 25,
      jitterPercent: 0,
      strategy: RetryStrategy.STRATEGY_TYPES.EXPONENTIAL,
      context: { operation: 'load', component: 'visualizer' },
    });

    await jest.advanceTimersByTimeAsync(25);
    const result = await executionPromise;

    expect(result).toEqual({ anatomyId: 'heart' });
    expect(operation).toHaveBeenCalledTimes(2);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 25);

    const stats = retryStrategy.getRetryStatistics('load-anatomy');
    expect(stats.attempts).toBe(0);
    expect(stats.failures).toBe(0);
    expect(stats.circuitBreakerState).toBe(
      RetryStrategy.CIRCUIT_STATES.CLOSED
    );
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('succeeded on attempt 2')
    );
  });

  it('applies linear backoff with jitter when using executeSimple', async () => {
    jest.useFakeTimers({ now: Date.now() });
    const operation = jest
      .fn()
      .mockRejectedValueOnce(TEMPORARY_ERROR)
      .mockResolvedValueOnce('rendered');
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    jest.spyOn(Math, 'random').mockReturnValue(1);

    const resultPromise = retryStrategy.executeSimple(operation, 2, 40);

    await jest.advanceTimersByTimeAsync(44);
    const result = await resultPromise;

    expect(result).toBe('rendered');
    expect(operation).toHaveBeenCalledTimes(2);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 44);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('retrying in 44ms')
    );
  });

  it('opens the circuit breaker after repeated failures and recovers after timeout', async () => {
    jest.useFakeTimers({ now: 0 });
    const failingOperation = jest.fn().mockRejectedValue(NETWORK_ERROR);
    const config = {
      maxAttempts: 1,
      baseDelayMs: 5,
      strategy: RetryStrategy.STRATEGY_TYPES.IMMEDIATE,
      jitterPercent: 0,
    };

    await expect(
      retryStrategy.execute('circuit-op', failingOperation, config)
    ).rejects.toThrow('temporary outage');
    await expect(
      retryStrategy.execute('circuit-op', failingOperation, config)
    ).rejects.toThrow('temporary outage');

    const statusAfterFailures = retryStrategy.getCircuitBreakerStatus(
      'circuit-op'
    );
    expect(statusAfterFailures.state).toBe(
      RetryStrategy.CIRCUIT_STATES.OPEN
    );

    await expect(
      retryStrategy.execute('circuit-op', failingOperation, config)
    ).rejects.toThrow('Circuit breaker is open');

    jest.advanceTimersByTime(250);

    const recoveringOperation = jest.fn().mockResolvedValue('recovered');
    const result = await retryStrategy.execute(
      'circuit-op',
      recoveringOperation,
      config
    );

    expect(result).toBe('recovered');
    const statusAfterRecovery = retryStrategy.getCircuitBreakerStatus(
      'circuit-op'
    );
    expect(statusAfterRecovery.state).toBe(
      RetryStrategy.CIRCUIT_STATES.CLOSED
    );
    expect(statusAfterRecovery.failures).toBe(0);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('moved to CLOSED state after success')
    );
  });

  it('moves half-open breakers back to open when the test request fails', async () => {
    jest.useFakeTimers({ now: 0 });
    const failingOperation = jest.fn().mockRejectedValue(NETWORK_ERROR);
    const config = {
      maxAttempts: 1,
      baseDelayMs: 5,
      strategy: RetryStrategy.STRATEGY_TYPES.IMMEDIATE,
      jitterPercent: 0,
    };

    await expect(
      retryStrategy.execute('flaky-op', failingOperation, config)
    ).rejects.toThrow('temporary outage');
    await expect(
      retryStrategy.execute('flaky-op', failingOperation, config)
    ).rejects.toThrow('temporary outage');

    jest.advanceTimersByTime(250);

    await expect(
      retryStrategy.execute('flaky-op', failingOperation, config)
    ).rejects.toThrow('temporary outage');

    const statusAfterHalfOpenFailure = retryStrategy.getCircuitBreakerStatus(
      'flaky-op'
    );
    expect(statusAfterHalfOpenFailure.state).toBe(
      RetryStrategy.CIRCUIT_STATES.OPEN
    );
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('moved back to OPEN state after HALF_OPEN failure')
    );
  });

  it('supports manual resets and cleanup of stale entries', async () => {
    jest.useFakeTimers({ now: 0 });
    const failingOperation = jest.fn().mockRejectedValue(NETWORK_ERROR);
    const config = {
      maxAttempts: 1,
      strategy: RetryStrategy.STRATEGY_TYPES.IMMEDIATE,
      jitterPercent: 0,
    };

    await expect(
      retryStrategy.execute('cleanup-op', failingOperation, config)
    ).rejects.toThrow('temporary outage');

    retryStrategy.resetRetryAttempts('cleanup-op');
    retryStrategy.resetCircuitBreaker('cleanup-op');

    const resetStats = retryStrategy.getRetryStatistics('cleanup-op');
    expect(resetStats.failures).toBe(0);
    expect(resetStats.circuitBreakerState).toBe(
      RetryStrategy.CIRCUIT_STATES.CLOSED
    );

    await expect(
      retryStrategy.execute('cleanup-op', failingOperation, config)
    ).rejects.toThrow('temporary outage');

    jest.advanceTimersByTime(20);
    retryStrategy.cleanup(10);

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Cleaned up 2 old retry/circuit breaker entries')
    );
    const postCleanupStats = retryStrategy.getRetryStatistics('cleanup-op');
    expect(postCleanupStats.failures).toBe(0);
  });

  it('honors custom retry conditions and custom backoff strategies', async () => {
    jest.useFakeTimers({ now: Date.now() });
    const error = new Error('SPECIAL_CODE: transient issue');
    const operation = jest
      .fn()
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce('done');
    const customBackoff = jest
      .fn()
      .mockImplementation((attempt, baseDelay) => baseDelay * attempt * 10);
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    const promise = retryStrategy.execute('custom-op', operation, {
      maxAttempts: 3,
      baseDelayMs: 5,
      maxDelayMs: 200,
      jitterPercent: 0,
      strategy: RetryStrategy.STRATEGY_TYPES.CUSTOM,
      customBackoff,
      retryCondition: (err) => err.message.includes('SPECIAL_CODE'),
    });

    await jest.advanceTimersByTimeAsync(50);
    await jest.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result).toBe('done');
    expect(customBackoff).toHaveBeenCalledWith(1, 5);
    expect(customBackoff).toHaveBeenCalledWith(2, 5);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 50);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 100);
  });

  it('falls back to default delay calculations when strategy is unknown', async () => {
    jest.useFakeTimers({ now: Date.now() });
    const retryableError = new Error('Network timeout retrieving fallback data');
    const operation = jest
      .fn()
      .mockRejectedValueOnce(retryableError)
      .mockRejectedValueOnce(retryableError)
      .mockResolvedValueOnce('ok');
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    const resultPromise = retryStrategy.execute('fallback-op', operation, {
      maxAttempts: 3,
      baseDelayMs: 15,
      maxDelayMs: 60,
      jitterPercent: 0,
      strategy: 'unknown-strategy',
    });

    await jest.advanceTimersByTimeAsync(15);
    await jest.advanceTimersByTimeAsync(15);
    const result = await resultPromise;

    expect(result).toBe('ok');
    expect(operation).toHaveBeenCalledTimes(3);
    const observedDelays = setTimeoutSpy.mock.calls.map((call) => call[1]);
    expect(observedDelays).toEqual([15, 15]);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('retrying in 15ms')
    );
  });

  it('supports Fibonacci backoff sequences for long running retries', async () => {
    jest.useFakeTimers({ now: Date.now() });
    const fibError = new TypeError('fetch timeout while retrieving data');
    const operation = jest
      .fn()
      .mockRejectedValueOnce(fibError)
      .mockRejectedValueOnce(fibError)
      .mockRejectedValueOnce(fibError)
      .mockResolvedValueOnce('complete');
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    const fibPromise = retryStrategy.execute('fib-op', operation, {
      maxAttempts: 4,
      baseDelayMs: 5,
      maxDelayMs: 100,
      jitterPercent: 0,
      strategy: RetryStrategy.STRATEGY_TYPES.FIBONACCI,
    });

    await jest.advanceTimersByTimeAsync(5);
    await jest.advanceTimersByTimeAsync(5);
    await jest.advanceTimersByTimeAsync(10);
    const result = await fibPromise;

    expect(result).toBe('complete');
    expect(operation).toHaveBeenCalledTimes(4);
    const fibDelays = setTimeoutSpy.mock.calls.map((call) => call[1]);
    expect(fibDelays).toEqual([5, 5, 10]);
  });

  it('honors custom retry condition decisions and disposed instances', async () => {
    const operation = jest
      .fn()
      .mockRejectedValue(new Error('Network timeout while loading scene'));

    await expect(
      retryStrategy.execute('skip-retry', operation, {
        maxAttempts: 3,
        retryCondition: () => false,
      })
    ).rejects.toThrow('Network timeout while loading scene');

    retryStrategy.dispose();
    expect(retryStrategy.isDisposed()).toBe(true);
    await expect(
      retryStrategy.execute('after-dispose', async () => 'never')
    ).rejects.toThrow('RetryStrategy instance has been disposed');
    expect(() => retryStrategy.getRetryStatistics('after-dispose')).toThrow(
      'RetryStrategy instance has been disposed'
    );
  });

  it('validates operations are callable', async () => {
    await expect(
      retryStrategy.execute('invalid', null)
    ).rejects.toThrow('Operation must be a function');
  });
});
