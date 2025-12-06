import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import CircuitBreaker from '../../../src/entities/monitoring/CircuitBreaker.js';
import { createMockLogger } from '../../common/mockFactories/index.js';
import { validateDependency } from '../../../src/utils/dependencyUtils.js';
import { ensureValidLogger } from '../../../src/utils/loggerUtils.js';

jest.mock('../../../src/utils/dependencyUtils.js', () => ({
  validateDependency: jest.fn(),
}));

jest.mock('../../../src/utils/loggerUtils.js', () => ({
  ensureValidLogger: jest.fn((logger) => logger),
}));

describe('CircuitBreaker state transitions and reporting', () => {
  /** @type {ReturnType<typeof createMockLogger>} */
  let logger;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    logger = createMockLogger();
    validateDependency.mockClear();
    ensureValidLogger.mockClear();
    ensureValidLogger.mockImplementation((value) => value);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('validates logger dependencies and uses the sanitized logger instance', () => {
    const sanitizedLogger = createMockLogger();
    ensureValidLogger.mockReturnValue(sanitizedLogger);

    const breaker = new CircuitBreaker({
      logger,
      options: {
        name: 'SanitizedBreaker',
        failureThreshold: 3,
        timeout: 5000,
        successThreshold: 4,
      },
    });

    expect(validateDependency).toHaveBeenCalledWith(
      logger,
      'ILogger',
      console,
      expect.objectContaining({
        requiredMethods: ['info', 'error', 'warn', 'debug'],
      })
    );
    expect(ensureValidLogger).toHaveBeenCalledWith(logger, 'CircuitBreaker');

    expect(sanitizedLogger.debug).toHaveBeenCalledWith(
      "CircuitBreaker 'SanitizedBreaker' initialized",
      expect.objectContaining({
        enabled: true,
        failureThreshold: 3,
        timeout: 5000,
        successThreshold: 4,
      })
    );

    const stats = breaker.getStats();
    expect(stats).toMatchObject({
      state: 'CLOSED',
      enabled: true,
      failureCount: 0,
      successCount: 0,
      name: 'SanitizedBreaker',
      totalRequests: 0,
      totalFailures: 0,
    });
  });

  it('cycles from closed to open, half-open, and back to closed around the timeout window', async () => {
    const breaker = new CircuitBreaker({
      logger,
      options: {
        name: 'CriticalOps',
        failureThreshold: 2,
        timeout: 1000,
        successThreshold: 2,
      },
    });

    const failingOperation = jest.fn().mockRejectedValue(new Error('boom'));

    jest.setSystemTime(0);
    await expect(breaker.execute(failingOperation)).rejects.toThrow('boom');
    expect(logger.debug).toHaveBeenCalledWith(
      "Circuit breaker 'CriticalOps' - Failure recorded",
      expect.objectContaining({
        failureCount: 1,
        state: 'CLOSED',
        error: 'boom',
      })
    );

    jest.setSystemTime(10);
    await expect(breaker.execute(failingOperation)).rejects.toThrow('boom');
    expect(breaker.isOpen()).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(
      "Circuit breaker 'CriticalOps' transitioned to OPEN",
      expect.objectContaining({
        state: 'OPEN',
        failureCount: 2,
        failureThreshold: 2,
        timeoutMs: 1000,
        timestamp: expect.any(String),
      })
    );

    const blockedOperation = jest.fn().mockResolvedValue('should not run');
    jest.setSystemTime(20);
    await expect(breaker.execute(blockedOperation)).rejects.toThrow(
      /Circuit breaker 'CriticalOps' is OPEN/
    );
    expect(blockedOperation).not.toHaveBeenCalled();

    const successfulOperation = jest.fn().mockResolvedValue('ok');

    jest.setSystemTime(1100);
    await expect(breaker.execute(successfulOperation)).resolves.toBe('ok');
    expect(breaker.getState()).toBe('HALF_OPEN');
    expect(logger.info).toHaveBeenCalledWith(
      "Circuit breaker 'CriticalOps' transitioned to HALF_OPEN",
      expect.objectContaining({
        state: 'HALF_OPEN',
        successThreshold: 2,
        timestamp: expect.any(String),
      })
    );
    expect(breaker.isHalfOpen()).toBe(true);

    jest.setSystemTime(1200);
    await expect(breaker.execute(successfulOperation)).resolves.toBe('ok');
    expect(breaker.isClosed()).toBe(true);
    expect(logger.info).toHaveBeenCalledWith(
      "Circuit breaker 'CriticalOps' transitioned to CLOSED",
      expect.objectContaining({
        state: 'CLOSED',
        timestamp: expect.any(String),
      })
    );

    const stats = breaker.getStats();
    expect(stats).toMatchObject({
      state: 'CLOSED',
      totalRequests: 5,
      totalFailures: 2,
      failureCount: 0,
      successCount: 0,
      lastFailureTime: 10,
      lastSuccessTime: 1200,
    });
    expect(successfulOperation).toHaveBeenCalledTimes(2);
  });

  it('re-opens immediately when a half-open execution fails', () => {
    const breaker = new CircuitBreaker({
      logger,
      options: {
        name: 'HalfOpenFailure',
        failureThreshold: 1,
        timeout: 500,
        successThreshold: 1,
      },
    });

    const syncFailure = jest.fn(() => {
      throw new Error('initial failure');
    });

    jest.setSystemTime(0);
    expect(() => breaker.executeSync(syncFailure)).toThrow('initial failure');
    expect(breaker.isOpen()).toBe(true);

    jest.setSystemTime(600);
    const halfOpenFailure = jest.fn(() => {
      throw new Error('half-open failure');
    });

    expect(() => breaker.executeSync(halfOpenFailure)).toThrow(
      'half-open failure'
    );
    expect(logger.info).toHaveBeenCalledWith(
      "Circuit breaker 'HalfOpenFailure' transitioned to HALF_OPEN",
      expect.objectContaining({ state: 'HALF_OPEN' })
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "Circuit breaker 'HalfOpenFailure' transitioned to OPEN",
      expect.objectContaining({ state: 'OPEN', failureCount: 1 })
    );
    expect(breaker.isOpen()).toBe(true);

    const stats = breaker.getStats();
    expect(stats.totalFailures).toBe(2);
    expect(stats.failureCount).toBe(2);
    expect(stats.totalRequests).toBe(2);
  });

  it('produces detailed status reports for open breakers with varying recovery windows', () => {
    const breaker = new CircuitBreaker({
      logger,
      options: {
        name: 'Reporter',
        failureThreshold: 1,
        timeout: 1000,
        successThreshold: 1,
      },
    });

    const syncFailure = jest.fn(() => {
      throw new Error('fail');
    });

    jest.setSystemTime(500);
    expect(() => breaker.executeSync(syncFailure)).toThrow('fail');
    expect(breaker.isOpen()).toBe(true);

    jest.setSystemTime(700);
    const nearReport = breaker.getStatusReport();
    expect(nearReport).toContain('Circuit Breaker: Reporter');
    expect(nearReport).toContain('State: OPEN');
    expect(nearReport).toContain('Half-Open In: 1s');

    jest.setSystemTime(2000);
    const readyReport = breaker.getStatusReport();
    expect(readyReport).toContain('Ready for Half-Open');
    expect(readyReport).toContain('Last Failure: 2s ago');
    expect(readyReport).toContain('Failure Rate: 100%');
  });

  it('respects manual enable toggles and synchronous bypass behaviour', () => {
    const breaker = new CircuitBreaker({
      logger,
      options: { name: 'ToggleBreaker' },
    });

    breaker.setEnabled(false);
    expect(logger.info).toHaveBeenCalledWith(
      "Circuit breaker 'ToggleBreaker' disabled"
    );
    const directResult = breaker.executeSync(() => 'direct');
    expect(directResult).toBe('direct');
    expect(breaker.getStats()).toMatchObject({
      enabled: false,
      totalRequests: 0,
    });

    breaker.setEnabled(true);
    expect(logger.info).toHaveBeenCalledWith(
      "Circuit breaker 'ToggleBreaker' enabled"
    );
    const wrappedResult = breaker.executeSync(() => 'wrapped');
    expect(wrappedResult).toBe('wrapped');
    expect(breaker.getStats().totalRequests).toBe(1);
  });
});
