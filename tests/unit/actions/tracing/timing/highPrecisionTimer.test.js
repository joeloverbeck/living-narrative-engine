import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  HighPrecisionTimer,
  highPrecisionTimer,
} from '../../../../../src/actions/tracing/timing/highPrecisionTimer.js';

describe('HighPrecisionTimer', () => {
  let timer;

  beforeEach(() => {
    timer = new HighPrecisionTimer();
  });

  describe('Functional Correctness', () => {
    it('should measure synchronous function execution', () => {
      const result = timer.measure(() => {
        return 'test-result';
      });

      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.result).toBe('test-result');
    });

    it('should measure async function execution', async () => {
      const result = await timer.measureAsync(async () => {
        return 'async-result';
      });

      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.result).toBe('async-result');
    });

    it('should handle synchronous function errors', () => {
      const result = timer.measure(() => {
        throw new Error('Test error');
      });

      expect(result.success).toBe(false);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.result).toBeNull();
      expect(result.error.message).toBe('Test error');
    });

    it('should handle async function errors', async () => {
      const result = await timer.measureAsync(async () => {
        throw new Error('Async test error');
      });

      expect(result.success).toBe(false);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.result).toBeNull();
      expect(result.error.message).toBe('Async test error');
    });
  });

  describe('Markers and Duration Calculation', () => {
    it('should create timing markers', () => {
      const marker1 = timer.createMarker('start');
      const marker2 = timer.createMarker('end');

      expect(marker1.label).toBe('start');
      expect(marker2.label).toBe('end');
      expect(marker2.timestamp).toBeGreaterThan(marker1.timestamp);
      expect(marker1.id).toBeTruthy();
      expect(marker2.id).toBeTruthy();
      expect(marker1.id).not.toBe(marker2.id);
    });

    it('should calculate duration between markers', () => {
      const start = timer.createMarker('operation_start');
      const end = timer.createMarker('operation_end');
      const duration = timer.calculateDuration(start, end);

      expect(duration.duration).toBeGreaterThanOrEqual(0);
      expect(duration.startMarker).toBe(start);
      expect(duration.endMarker).toBe(end);
      expect(duration.label).toBe('operation_start → operation_end');
      expect(duration.humanReadable).toBeTruthy();
    });

    it('should throw error for invalid markers', () => {
      const marker = timer.createMarker('test');

      expect(() => timer.calculateDuration(null, marker)).toThrow(
        'Both start and end markers are required'
      );
      expect(() => timer.calculateDuration(marker, null)).toThrow(
        'Both start and end markers are required'
      );
    });
  });

  describe('Duration Formatting', () => {
    it('should format microseconds', () => {
      expect(timer.formatDuration(0.5)).toBe('500.0μs');
    });

    it('should format milliseconds', () => {
      expect(timer.formatDuration(5.123)).toBe('5.12ms');
    });

    it('should format seconds', () => {
      expect(timer.formatDuration(1500)).toBe('1.50s');
    });

    it('should format minutes', () => {
      expect(timer.formatDuration(125000)).toBe('2m 5.00s');
    });

    it('should handle edge cases', () => {
      expect(timer.formatDuration(0)).toBe('0.0μs');
      expect(timer.formatDuration(1)).toBe('1.00ms');
      expect(timer.formatDuration(1000)).toBe('1.00s');
      expect(timer.formatDuration(60000)).toBe('1m 0.00s');
    });
  });

  describe('Precision Information', () => {
    it('should provide timing precision info', () => {
      const info = timer.getPrecisionInfo();

      expect(info).toHaveProperty('api');
      expect(info).toHaveProperty('resolution');
      expect(info).toHaveProperty('baseline');
      expect(info.resolution).toBeGreaterThan(0);
      expect(info.baseline).toBeGreaterThan(0);
    });

    it('should detect high-precision availability', () => {
      const isAvailable = timer.isHighPrecisionAvailable();
      expect(typeof isAvailable).toBe('boolean');

      // Test singleton instance too
      const singletonAvailable = highPrecisionTimer.isHighPrecisionAvailable();
      expect(typeof singletonAvailable).toBe('boolean');
    });

    it('should report correct API being used', () => {
      const info = timer.getPrecisionInfo();
      const expectedApis = [
        'performance.now()',
        'process.hrtime()',
        'Date.now()',
      ];
      expect(expectedApis).toContain(info.api);
    });
  });

  describe('Environment-Specific Timing APIs', () => {
    let originalPerformance;
    let originalProcess;

    beforeEach(() => {
      // Store original globals
      originalPerformance = global.performance;
      originalProcess = global.process;
    });

    afterEach(() => {
      // Restore original globals
      global.performance = originalPerformance;
      global.process = originalProcess;
    });

    describe('Node.js process.hrtime() environment', () => {
      beforeEach(() => {
        // Mock environment with no performance API but with process.hrtime
        delete global.performance;
        global.process = {
          hrtime: jest.fn(() => [1, 500000000]), // 1.5 seconds
        };
      });

      it('should use process.hrtime() when performance API is unavailable', () => {
        const timer = new HighPrecisionTimer();

        // Call now() to trigger hrtime path
        const result = timer.now();

        expect(global.process.hrtime).toHaveBeenCalled();
        expect(result).toBe(1500); // 1 second * 1000 + 500000000 nanoseconds / 1000000
      });

      it('should report process.hrtime() API in precision info', () => {
        const timer = new HighPrecisionTimer();
        const info = timer.getPrecisionInfo();

        expect(info.api).toBe('process.hrtime()');
      });

      it('should report nanosecond resolution for process.hrtime()', () => {
        const timer = new HighPrecisionTimer();
        const info = timer.getPrecisionInfo();

        expect(info.resolution).toBe(0.000001); // 1 nanosecond
      });

      it('should detect high precision as available with process.hrtime()', () => {
        const timer = new HighPrecisionTimer();

        expect(timer.isHighPrecisionAvailable()).toBe(true);
      });
    });

    describe('Date.now() fallback environment', () => {
      let originalDateNow;

      beforeEach(() => {
        // Mock environment with no performance API and no process.hrtime
        delete global.performance;
        delete global.process;

        // Mock Date.now to return predictable values
        originalDateNow = Date.now;
        let callCount = 0;
        Date.now = jest.fn(() => {
          callCount++;
          return 1000000 + callCount * 10; // Incremental timestamps
        });
      });

      afterEach(() => {
        Date.now = originalDateNow;
      });

      it('should use Date.now() when neither performance nor hrtime available', () => {
        const timer = new HighPrecisionTimer();

        // Reset call count for predictable results
        Date.now.mockClear();
        Date.now.mockReturnValueOnce(1000100).mockReturnValueOnce(1000150);

        const result = timer.now();

        expect(Date.now).toHaveBeenCalled();
        // Should return relative time from base timestamp
        expect(typeof result).toBe('number');
      });

      it('should report Date.now() API in precision info', () => {
        const timer = new HighPrecisionTimer();
        const info = timer.getPrecisionInfo();

        expect(info.api).toBe('Date.now()');
      });

      it('should report millisecond resolution for Date.now()', () => {
        const timer = new HighPrecisionTimer();
        const info = timer.getPrecisionInfo();

        expect(info.resolution).toBe(1); // 1 millisecond
      });

      it('should detect high precision as unavailable with Date.now()', () => {
        const timer = new HighPrecisionTimer();

        expect(timer.isHighPrecisionAvailable()).toBe(false);
      });
    });
  });
});
