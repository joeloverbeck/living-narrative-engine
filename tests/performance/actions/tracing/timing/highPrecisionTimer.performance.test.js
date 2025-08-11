import { describe, it, expect, beforeEach } from '@jest/globals';
import { HighPrecisionTimer } from '../../../../../src/actions/tracing/timing/highPrecisionTimer.js';

describe('HighPrecisionTimer Performance', () => {
  let timer;

  beforeEach(() => {
    timer = new HighPrecisionTimer();
  });

  describe('Performance Requirements', () => {
    it('should have minimal overhead', () => {
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

    it('should maintain consistency across multiple calls', () => {
      const timestamps = [];
      for (let i = 0; i < 100; i++) {
        timestamps.push(timer.now());
      }

      // All timestamps should be increasing
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
      }
    });
  });
});
