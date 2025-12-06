import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { SuspiciousPatternsManager } from '../../../src/middleware/rateLimiting.js';

/**
 * Additional coverage tests for SuspiciousPatternsManager internals.
 */
describe('SuspiciousPatternsManager additional branches', () => {
  let manager;

  beforeEach(() => {
    jest.useFakeTimers();
    manager = new SuspiciousPatternsManager({
      maxSize: 10,
      maxAge: 60_000,
      cleanupInterval: 120_000,
      batchSize: 5,
      minCleanupInterval: Number.MAX_SAFE_INTEGER,
    });
  });

  afterEach(() => {
    if (manager) {
      manager.destroy();
    }
    jest.useRealTimers();
  });

  it('estimates memory usage with mixed request histories', () => {
    manager.set('client-with-history', {
      requests: [Date.now() - 1000, Date.now() - 500],
    });

    manager.set('client-without-history', {
      requests: null,
    });

    const estimate = manager.estimateMemoryUsage();

    expect(typeof estimate).toBe('number');
    expect(estimate).toBeGreaterThan(0);
  });

  it('skips cleanup for active entries with non-array trackers', () => {
    manager.set('active-with-array', {
      requests: [Date.now() - 100],
    });

    manager.set('active-without-array', {
      requests: null,
    });

    const cleaned = manager.cleanupExpired(10);

    expect(cleaned).toBe(0);
    expect(manager.patterns.get('active-without-array').requests).toBeNull();
    expect(
      Array.isArray(manager.patterns.get('active-with-array').requests)
    ).toBe(true);
  });

  it('leaves recent entries untouched during full cleanup', () => {
    manager.set('recent-client', {
      requests: [],
    });

    const cleaned = manager.fullCleanup();

    expect(cleaned).toBe(0);
    expect(manager.patterns.has('recent-client')).toBe(true);
  });

  it('handles destroy when timers have already been cleared', () => {
    const intervalId = manager.periodicCleanupInterval;
    clearInterval(intervalId);
    manager.periodicCleanupInterval = null;

    manager.destroy();

    expect(manager.patterns.size).toBe(0);
    expect(manager.accessOrder.size).toBe(0);
  });

  it('destroys active timers and clears tracked state exactly once', () => {
    const clearSpy = jest.spyOn(manager, 'clear');

    manager.cleanupTimer = setTimeout(() => {}, 10_000);
    jest.advanceTimersByTime(1); // ensure timers are registered

    expect(manager.periodicCleanupInterval).toBeTruthy();

    manager.destroy();

    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(manager.periodicCleanupInterval).toBeNull();
    expect(manager.cleanupTimer).toBeNull();
    expect(manager.patterns.size).toBe(0);
    expect(manager.accessOrder.size).toBe(0);
  });
});
