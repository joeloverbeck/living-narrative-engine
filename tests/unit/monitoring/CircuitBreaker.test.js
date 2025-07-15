import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import CircuitBreaker from '../../../src/entities/monitoring/CircuitBreaker.js';
import { createMockLogger } from '../../common/mockFactories/index.js';

jest.mock('../../../src/utils/dependencyUtils.js', () => ({
  validateDependency: jest.fn(),
}));

jest.mock('../../../src/utils/loggerUtils.js', () => ({
  ensureValidLogger: (logger) => logger,
}));

jest.mock('../../../src/entities/utils/configUtils.js', () => ({
  getGlobalConfig: jest.fn(() => ({
    isFeatureEnabled: jest.fn().mockReturnValue(true),
    getValue: jest.fn().mockReturnValue(undefined),
  })),
  isConfigInitialized: jest.fn(() => false),
}));

/** @type {import('../../../src/entities/monitoring/CircuitBreaker.js').default} */
let breaker;
let logger;

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(0);
  logger = createMockLogger();
  breaker = new CircuitBreaker({
    logger,
    options: { failureThreshold: 2, timeout: 1000, successThreshold: 2 },
  });
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  jest.clearAllMocks();
});

describe('CircuitBreaker core behavior', () => {
  it('bypasses execution when disabled', async () => {
    breaker.setEnabled(false);
    const fn = jest.fn().mockResolvedValue('ok');
    await expect(breaker.execute(fn)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalled();
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('opens after failures and closes again after timeout and successes', () => {
    const failing = jest.fn(() => {
      throw new Error('fail');
    });
    expect(() => breaker.executeSync(failing)).toThrow('fail');
    expect(breaker.getState()).toBe('CLOSED');
    expect(() => breaker.executeSync(failing)).toThrow('fail');
    expect(breaker.getState()).toBe('OPEN');
    expect(() => breaker.executeSync(() => 'x')).toThrow(/Circuit breaker/);
    jest.advanceTimersByTime(1000);
    const success = jest.fn(() => 'ok');
    expect(breaker.executeSync(success)).toBe('ok');
    expect(breaker.getState()).toBe('HALF_OPEN');
    expect(breaker.executeSync(success)).toBe('ok');
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('supports manual open/close and status reporting', () => {
    breaker.open();
    expect(breaker.isOpen()).toBe(true);
    const report = breaker.getStatusReport();
    expect(report).toContain('State: OPEN');
    breaker.close();
    expect(breaker.isClosed()).toBe(true);
    breaker.reset();
    expect(breaker.getState()).toBe('CLOSED');
  });
});
