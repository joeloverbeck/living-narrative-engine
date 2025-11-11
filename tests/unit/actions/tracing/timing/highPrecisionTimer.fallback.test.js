import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { HighPrecisionTimer } from '../../../../../src/actions/tracing/timing/highPrecisionTimer.js';

describe('HighPrecisionTimer - Fallback behavior', () => {
  let originalPerformance;
  let originalProcess;

  beforeEach(() => {
    originalPerformance = globalThis.performance;
    originalProcess = globalThis.process;
  });

  afterEach(() => {
    globalThis.performance = originalPerformance;
    globalThis.process = originalProcess;
  });

  it('should use Date.now() fallback when performance API is removed at runtime', () => {
    // Create timer with performance API available
    const timer = new HighPrecisionTimer();

    // Verify performance API is being used initially
    expect(timer.isHighPrecisionAvailable()).toBe(true);
    const precisionInfo1 = timer.getPrecisionInfo();
    expect(precisionInfo1.api).toBe('performance.now()');

    // Get initial timestamp
    const timestamp1 = timer.now();
    expect(typeof timestamp1).toBe('number');
    expect(timestamp1).toBeGreaterThan(0);

    // Remove performance API at runtime
    globalThis.performance = undefined;

    // Timer should fall back to Date.now() without throwing
    const timestamp2 = timer.now();
    expect(typeof timestamp2).toBe('number');

    // Timestamps should still be valid and increasing
    const timestamp3 = timer.now();
    expect(timestamp3).toBeGreaterThanOrEqual(timestamp2);
  });

  it('should use Date.now() fallback when performance.now is not a function', () => {
    // Create timer with performance API available
    const timer = new HighPrecisionTimer();

    // Break performance.now by making it not a function
    globalThis.performance = { now: null };

    // Timer should fall back to Date.now() without throwing
    const timestamp = timer.now();
    expect(typeof timestamp).toBe('number');
    expect(timestamp).toBeGreaterThanOrEqual(0);
  });

  it('should handle performance API removal during measure operations', () => {
    const timer = new HighPrecisionTimer();

    // Remove performance API mid-measurement
    globalThis.performance = undefined;

    // Should complete measurement without error
    const result = timer.measure(() => {
      let sum = 0;
      for (let i = 0; i < 100; i++) {
        sum += i;
      }
      return sum;
    });

    expect(result.success).toBe(true);
    expect(result.result).toBe(4950);
    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(typeof result.startTime).toBe('number');
    expect(typeof result.endTime).toBe('number');
  });

  it('should handle performance API removal during marker operations', () => {
    const timer = new HighPrecisionTimer();

    // Create marker with performance API
    const marker1 = timer.createMarker('start');
    expect(marker1.label).toBe('start');
    expect(typeof marker1.timestamp).toBe('number');

    // Remove performance API
    globalThis.performance = undefined;

    // Create another marker - should still work
    const marker2 = timer.createMarker('end');
    expect(marker2.label).toBe('end');
    expect(typeof marker2.timestamp).toBe('number');

    // Calculate duration - should still work
    const duration = timer.calculateDuration(marker1, marker2);
    expect(duration.duration).toBeGreaterThanOrEqual(0);
    expect(typeof duration.humanReadable).toBe('string');
  });

  it('should initialize with Date.now() fallback when performance is never available', () => {
    // Note: In jsdom environment, performance object is provided by the test setup,
    // so we can't fully test initialization without it. However, we can test that
    // the timer handles the case where performance becomes unavailable after construction.

    const timer = new HighPrecisionTimer();

    // Remove performance after construction
    globalThis.performance = undefined;

    // Even though performance was available at construction, runtime checks should detect it's gone
    // Note: isHighPrecisionAvailable() checks cached constructor values AND runtime availability,
    // so it may still report true based on cached values, but now() will use the fallback
    const timestamp1 = timer.now();
    expect(typeof timestamp1).toBe('number');

    const timestamp2 = timer.now();
    expect(timestamp2).toBeGreaterThanOrEqual(timestamp1);

    // Restore for other tests
    globalThis.performance = originalPerformance;

    // Create a new timer without performance to test pure fallback behavior
    globalThis.performance = undefined;
    delete globalThis.process;

    const fallbackTimer = new HighPrecisionTimer();

    // Now verify fallback is being used
    // In some test environments, performance might still be available on window or global
    // So we primarily verify that the timer works, not which API it uses
    const timestamp3 = fallbackTimer.now();
    expect(typeof timestamp3).toBe('number');
    expect(timestamp3).toBeGreaterThanOrEqual(0);
  });

  it('should format durations correctly regardless of timing API', () => {
    const timer = new HighPrecisionTimer();

    // Test with performance API
    const formatted1 = timer.formatDuration(0.5);
    expect(formatted1).toContain('μs');

    // Remove performance API
    globalThis.performance = undefined;

    // Formatting should still work
    const formatted2 = timer.formatDuration(1.5);
    expect(formatted2).toContain('ms');

    const formatted3 = timer.formatDuration(1500);
    expect(formatted3).toContain('s');

    const formatted4 = timer.formatDuration(75000);
    expect(formatted4).toMatch(/\d+m \d+\.\d+s/);
  });

  it('should handle process.hrtime removal at runtime', () => {
    // Remove performance to force hrtime usage
    globalThis.performance = undefined;

    // Mock process.hrtime
    const mockHrtime = () => [1, 500000000]; // 1.5 seconds
    globalThis.process = { hrtime: mockHrtime };

    const timer = new HighPrecisionTimer();

    // Verify hrtime is being used
    expect(timer.isHighPrecisionAvailable()).toBe(true);

    // Get timestamp with hrtime
    const timestamp1 = timer.now();
    expect(typeof timestamp1).toBe('number');

    // Remove process at runtime
    delete globalThis.process;

    // Should fall back to Date.now()
    const timestamp2 = timer.now();
    expect(typeof timestamp2).toBe('number');
  });
});
