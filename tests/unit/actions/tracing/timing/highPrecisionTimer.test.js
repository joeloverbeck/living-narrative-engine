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

  describe('Timing Accuracy', () => {
    it('should provide timestamps with sub-millisecond precision when available', () => {
      const time1 = timer.now();
      const time2 = timer.now();

      expect(time2).toBeGreaterThan(time1);
      expect(time2 - time1).toBeLessThan(1); // Should be very fast
    });

    it('should measure synchronous function duration', () => {
      const result = timer.measure(() => {
        // Small workload
        let sum = 0;
        for (let i = 0; i < 1000; i++) {
          sum += i;
        }
        return sum;
      });

      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.result).toBe(499500); // Sum of 0-999
    });

    it('should measure async function duration', async () => {
      const result = await timer.measureAsync(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'completed';
      });

      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThanOrEqual(8); // Allow for timing variations
      expect(result.result).toBe('completed');
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

      // Small delay
      for (let i = 0; i < 10000; i++) {
        // Intentional delay loop
      }

      const end = timer.createMarker('operation_end');
      const duration = timer.calculateDuration(start, end);

      expect(duration.duration).toBeGreaterThan(0);
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
});
