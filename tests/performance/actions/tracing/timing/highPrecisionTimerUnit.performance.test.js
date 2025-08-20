import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  HighPrecisionTimer,
  highPrecisionTimer,
} from '../../../../../src/actions/tracing/timing/highPrecisionTimer.js';

describe('HighPrecisionTimer - Performance Tests (Extracted from Unit Suite)', () => {
  let timer;

  beforeEach(() => {
    timer = new HighPrecisionTimer();
  });

  describe('Timing Precision Performance', () => {
    it('should provide timestamps with sub-millisecond precision when available', () => {
      const time1 = timer.now();
      const time2 = timer.now();

      expect(time2).toBeGreaterThan(time1);
      expect(time2 - time1).toBeLessThan(1); // Should be very fast
    });

    it('should measure async function duration with timing validation', async () => {
      const result = await timer.measureAsync(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'completed';
      });

      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThanOrEqual(8); // Allow for timing variations
      expect(result.result).toBe('completed');
    });
  });

  describe('Workload Measurement Performance', () => {
    it('should measure synchronous function duration with workload', () => {
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
  });

  describe('Marker Timing Performance', () => {
    it('should calculate duration between markers with intentional delay', () => {
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
  });

  describe('Performance Overhead Benchmarks', () => {
    it('should have minimal overhead for timer.now() calls', () => {
      const iterations = 1000;
      const start = timer.now();

      for (let i = 0; i < iterations; i++) {
        timer.now();
      }

      const total = timer.now() - start;
      const averageOverhead = total / iterations;

      // Should be much less than 0.1ms per call
      expect(averageOverhead).toBeLessThan(0.01);
    });

    it('should maintain consistency across multiple timestamp calls', () => {
      const timestamps = [];
      for (let i = 0; i < 100; i++) {
        timestamps.push(timer.now());
      }

      // All timestamps should be increasing
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
      }
    });

    it('should have minimal marker creation overhead', () => {
      const iterations = 500;
      const start = timer.now();

      for (let i = 0; i < iterations; i++) {
        timer.createMarker(`test_marker_${i}`);
      }

      const total = timer.now() - start;
      const averageOverhead = total / iterations;

      // Marker creation should be fast
      expect(averageOverhead).toBeLessThan(0.1);
    });
  });
});