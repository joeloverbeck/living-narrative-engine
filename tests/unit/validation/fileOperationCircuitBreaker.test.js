import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import FileOperationCircuitBreaker, {
  CircuitBreakerState,
  CircuitBreakerError,
} from '../../../src/validation/fileOperationCircuitBreaker.js';
import { createMockLogger } from '../../common/mockFactories/index.js';

const advanceTimers = async (ms) => {
  await jest.advanceTimersByTimeAsync(ms);
  // allow any pending microtasks triggered by timers to run
  await Promise.resolve();
};

describe('FileOperationCircuitBreaker', () => {
  let logger;
  let breaker;

  const createBreaker = (config = {}) =>
    new FileOperationCircuitBreaker({
      config: {
        failureThreshold: 2,
        recoveryTimeout: 1000,
        monitoringWindow: 500,
        successThreshold: 2,
        halfOpenTimeout: 200,
        ...config,
      },
      logger,
    });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
    logger = createMockLogger();
    breaker = createBreaker();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('initializes with default configuration and logs setup details', () => {
    const localLogger = createMockLogger();
    const defaultBreaker = new FileOperationCircuitBreaker({
      config: {},
      logger: localLogger,
    });

    expect(defaultBreaker.failureThreshold).toBe(5);
    expect(defaultBreaker.recoveryTimeout).toBe(60000);
    expect(defaultBreaker.monitoringWindow).toBe(300000);
    expect(defaultBreaker.successThreshold).toBe(3);
    expect(defaultBreaker.halfOpenTimeout).toBe(30000);
    expect(localLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Circuit breaker initialized'),
      expect.objectContaining({ failureThreshold: 5, recoveryTimeout: 60000 })
    );

    const consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});

    try {
      const fallbackBreaker = new FileOperationCircuitBreaker({});

      expect(fallbackBreaker.failureThreshold).toBe(5);
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining('Circuit breaker initialized'),
        expect.objectContaining({ failureThreshold: 5, recoveryTimeout: 60000 })
      );
    } finally {
      consoleDebugSpy.mockRestore();
    }
  });

  it('resets cleanly when invoked without any pending timers', () => {
    breaker.reset();

    expect(breaker.state).toBe(CircuitBreakerState.CLOSED);
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Circuit breaker manually reset'),
      expect.objectContaining({
        previousState: CircuitBreakerState.CLOSED,
        newState: CircuitBreakerState.CLOSED,
      })
    );
  });

  it('executes operations successfully when closed', async () => {
    const operation = jest.fn().mockResolvedValue('ok');

    const result = await breaker.executeOperation(operation, { id: 'success-case' });

    expect(result).toBe('ok');
    expect(operation).toHaveBeenCalledTimes(1);

    const stats = breaker.getStats();
    expect(stats.state).toBe(CircuitBreakerState.CLOSED);
    expect(stats.successCount).toBe(1);
    expect(stats.failureCount).toBe(0);
    expect(stats.lastFailureTime).toBeNull();
    expect(stats.canAttempt).toBe(true);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Circuit breaker operation succeeded'),
      expect.objectContaining({ successCount: 1 })
    );
  });

  it('opens after reaching failure threshold and rejects new attempts', async () => {
    const failure = jest.fn().mockRejectedValue(new Error('disk full'));

    await expect(breaker.executeOperation(failure, { attempt: 1 })).rejects.toThrow(
      'disk full'
    );
    await expect(breaker.executeOperation(failure, { attempt: 2 })).rejects.toThrow(
      'disk full'
    );

    expect(breaker.state).toBe(CircuitBreakerState.OPEN);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Circuit breaker opened'),
      expect.objectContaining({ reason: 'Failure threshold exceeded' })
    );

    await expect(
      breaker.executeOperation(() => Promise.resolve('should-not-run'), {
        attempt: 3,
      })
    ).rejects.toBeInstanceOf(CircuitBreakerError);

    const stats = breaker.getStats();
    expect(stats.canAttempt).toBe(false);
    expect(stats.recentFailures).toBeGreaterThanOrEqual(2);
    expect(stats.timeSinceLastFailure).toBeGreaterThanOrEqual(0);
  });

  it('provides retry metadata when rejecting while open', async () => {
    const failure = jest.fn().mockRejectedValue(new Error('bad read'));
    await expect(breaker.executeOperation(failure)).rejects.toThrow('bad read');
    await expect(breaker.executeOperation(failure)).rejects.toThrow('bad read');

    try {
      await breaker.executeOperation(() => Promise.resolve('nope'));
      throw new Error('Expected rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(CircuitBreakerError);
      expect(error.state).toBe(CircuitBreakerState.OPEN);
      expect(error.context.timeUntilRetry).toBeGreaterThan(0);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Circuit breaker rejecting operation'),
        expect.objectContaining({ failureCount: 2 })
      );
    }
  });

  it('clears failure history after successful recovery in closed state', async () => {
    const failure = async () => {
      throw new Error('transient blip');
    };

    await expect(breaker.executeOperation(failure)).rejects.toThrow('transient blip');

    const midStats = breaker.getStats();
    expect(midStats.failureCount).toBe(1);
    expect(midStats.recentFailures).toBe(1);

    await breaker.executeOperation(async () => 'ok');

    const finalStats = breaker.getStats();
    expect(finalStats.state).toBe(CircuitBreakerState.CLOSED);
    expect(finalStats.failureCount).toBe(0);
    expect(finalStats.recentFailures).toBe(0);
  });

  it('transitions to half-open after recovery timeout and closes after successes', async () => {
    const failure = async () => {
      throw new Error('temporary');
    };
    await expect(breaker.executeOperation(failure)).rejects.toThrow('temporary');
    await expect(breaker.executeOperation(failure)).rejects.toThrow('temporary');

    await advanceTimers(1000);
    expect(breaker.state).toBe(CircuitBreakerState.HALF_OPEN);

    const success = jest.fn().mockResolvedValue('recovered');
    await breaker.executeOperation(success, { phase: 'first-success' });
    expect(breaker.state).toBe(CircuitBreakerState.HALF_OPEN);

    await breaker.executeOperation(success, { phase: 'second-success' });
    expect(breaker.state).toBe(CircuitBreakerState.CLOSED);
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Circuit breaker closed'),
      expect.objectContaining({ reason: 'Success threshold reached' })
    );
  });

  it('reopens when a half-open attempt fails', async () => {
    const failure = async () => {
      throw new Error('transient');
    };
    await expect(breaker.executeOperation(failure)).rejects.toThrow('transient');
    await expect(breaker.executeOperation(failure)).rejects.toThrow('transient');
    await advanceTimers(1000);
    expect(breaker.state).toBe(CircuitBreakerState.HALF_OPEN);

    await expect(breaker.executeOperation(failure, { phase: 'retry' })).rejects.toThrow(
      'transient'
    );
    expect(breaker.state).toBe(CircuitBreakerState.OPEN);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Circuit breaker opened'),
      expect.objectContaining({ reason: 'Failure in half-open state' })
    );
  });

  it('reset closes the breaker and clears counts', async () => {
    const failure = async () => {
      throw new Error('fail');
    };
    await expect(breaker.executeOperation(failure)).rejects.toThrow('fail');
    await expect(breaker.executeOperation(failure)).rejects.toThrow('fail');
    expect(breaker.state).toBe(CircuitBreakerState.OPEN);

    breaker.reset();
    const stats = breaker.getStats();
    expect(breaker.state).toBe(CircuitBreakerState.CLOSED);
    expect(stats.failureCount).toBe(0);
    expect(stats.successCount).toBe(0);
    expect(stats.lastFailureTime).toBeNull();
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Circuit breaker manually reset'),
      expect.objectContaining({ newState: CircuitBreakerState.CLOSED })
    );
  });

  it('supports manual open with reason', async () => {
    breaker.open('Manual maintenance');
    expect(breaker.state).toBe(CircuitBreakerState.OPEN);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Circuit breaker opened'),
      expect.objectContaining({ reason: 'Manual maintenance' })
    );

    await advanceTimers(1000);
    expect(breaker.state).toBe(CircuitBreakerState.HALF_OPEN);
  });

  it('returns null retry metadata when opened manually', async () => {
    breaker.open('Manual maintenance');

    await expect(
      breaker.executeOperation(async () => 'blocked')
    ).rejects.toMatchObject({
      context: expect.objectContaining({ timeUntilRetry: null }),
    });
  });

  it('uses the default reason when manually opened without arguments', () => {
    breaker.open();

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Circuit breaker opened'),
      expect.objectContaining({ reason: 'Manual open' })
    );
  });

  it('cleans failures outside monitoring window', async () => {
    const shortWindowBreaker = createBreaker({ monitoringWindow: 100, recoveryTimeout: 500 });
    await expect(
      shortWindowBreaker.executeOperation(async () => {
        throw new Error('first');
      })
    ).rejects.toThrow('first');

    await advanceTimers(200);

    await expect(
      shortWindowBreaker.executeOperation(async () => {
        throw new Error('second');
      })
    ).rejects.toThrow('second');

    const stats = shortWindowBreaker.getStats();
    expect(stats.recentFailures).toBe(1);
  });

  it('reports attempt availability through stats', async () => {
    const failure = async () => {
      throw new Error('fail');
    };
    await expect(breaker.executeOperation(failure)).rejects.toThrow('fail');
    await expect(breaker.executeOperation(failure)).rejects.toThrow('fail');

    const openStats = breaker.getStats();
    expect(openStats.canAttempt).toBe(false);

    await advanceTimers(1000);
    const halfOpenStats = breaker.getStats();
    expect(halfOpenStats.state).toBe(CircuitBreakerState.HALF_OPEN);
    expect(halfOpenStats.canAttempt).toBe(true);
  });

  it('returns null retry time once the open interval has fully elapsed', async () => {
    const failure = async () => {
      throw new Error('delayed transition');
    };

    await expect(breaker.executeOperation(failure)).rejects.toThrow('delayed transition');
    await expect(breaker.executeOperation(failure)).rejects.toThrow('delayed transition');

    const initialStats = breaker.getStats();
    expect(initialStats.timeUntilRetry).toBeGreaterThan(0);

    const currentTime = Date.now();
    jest.setSystemTime(new Date(currentTime + breaker.recoveryTimeout + 5));

    const postTimeoutStats = breaker.getStats();
    expect(postTimeoutStats.timeUntilRetry).toBeNull();
    expect(breaker.state).toBe(CircuitBreakerState.HALF_OPEN);
  });

  it('reopens automatically when the half-open evaluation period times out', async () => {
    const failure = async () => {
      throw new Error('no response');
    };

    await expect(breaker.executeOperation(failure)).rejects.toThrow('no response');
    await expect(breaker.executeOperation(failure)).rejects.toThrow('no response');

    await advanceTimers(breaker.recoveryTimeout);
    expect(breaker.state).toBe(CircuitBreakerState.HALF_OPEN);

    logger.error.mockClear();

    await advanceTimers(breaker.halfOpenTimeout);

    expect(breaker.state).toBe(CircuitBreakerState.OPEN);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Circuit breaker opened'),
      expect.objectContaining({ reason: 'Half-open timeout' })
    );
  });

  it('ignores stale half-open timers once the breaker has closed again', async () => {
    const failure = async () => {
      throw new Error('stale timer');
    };

    await expect(breaker.executeOperation(failure)).rejects.toThrow('stale timer');
    await expect(breaker.executeOperation(failure)).rejects.toThrow('stale timer');

    await advanceTimers(breaker.recoveryTimeout);
    expect(breaker.state).toBe(CircuitBreakerState.HALF_OPEN);

    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout').mockImplementation(() => {});
    const success = jest.fn().mockResolvedValue('ok');

    try {
      await breaker.executeOperation(success);
      await breaker.executeOperation(success);

      expect(breaker.state).toBe(CircuitBreakerState.CLOSED);

      logger.error.mockClear();

      await advanceTimers(breaker.halfOpenTimeout);

      expect(breaker.state).toBe(CircuitBreakerState.CLOSED);
      expect(logger.error).not.toHaveBeenCalledWith(
        expect.stringContaining('Circuit breaker opened'),
        expect.objectContaining({ reason: 'Half-open timeout' })
      );
    } finally {
      clearTimeoutSpy.mockRestore();
    }
  });

  it('uses time-based transition checks when timers are not advanced', async () => {
    const failure = async () => {
      throw new Error('transient glitch');
    };

    await expect(breaker.executeOperation(failure)).rejects.toThrow('transient glitch');
    await expect(breaker.executeOperation(failure)).rejects.toThrow('transient glitch');

    // Move system time forward beyond the recovery timeout without running scheduled timers
    const current = Date.now();
    jest.setSystemTime(new Date(current + 2000));

    const stats = breaker.getStats();
    expect(breaker.state).toBe(CircuitBreakerState.HALF_OPEN);
    expect(stats.canAttempt).toBe(true);
  });

  it('reports null retry metadata while closed and idle', () => {
    const stats = breaker.getStats();

    expect(stats.state).toBe(CircuitBreakerState.CLOSED);
    expect(stats.timeUntilRetry).toBeNull();
  });
});
