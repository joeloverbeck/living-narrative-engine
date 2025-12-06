import { afterEach, describe, expect, it, jest } from '@jest/globals';
import {
  getPercentile,
  measureSamples,
} from '../../helpers/performancePercentiles.js';

describe('performancePercentiles helper', () => {
  let nowSpy;

  afterEach(() => {
    if (nowSpy) {
      nowSpy.mockRestore();
      nowSpy = undefined;
    }
  });

  describe('getPercentile', () => {
    it('clamps percentile values and returns the correct timing', () => {
      const sortedTimings = [1, 2, 4, 8];

      expect(getPercentile(sortedTimings, 50)).toBe(2);
      expect(getPercentile(sortedTimings, 95)).toBe(8);
      expect(getPercentile(sortedTimings, -10)).toBe(1);
      expect(getPercentile(sortedTimings, 150)).toBe(8);
      expect(getPercentile([], 50)).toBe(0);
    });
  });

  describe('measureSamples', () => {
    it('collects percentile stats while ignoring warmup time', () => {
      let currentTime = 0;
      nowSpy = jest
        .spyOn(performance, 'now')
        .mockImplementation(() => currentTime);

      const fn = () => {
        currentTime += 2; // deterministic per-iteration cost
      };

      const result = measureSamples(fn, {
        samples: 3,
        iterations: 5,
        warmupIterations: 2,
      });

      expect(result.samples).toEqual([10, 10, 10]);
      expect(result.median).toBe(10);
      expect(result.p95).toBe(10);
      expect(result.p99).toBe(10);
      expect(result.min).toBe(10);
      expect(result.max).toBe(10);
      expect(result.mean).toBe(10);
      expect(result.stdDev).toBe(0);
      expect(result.iterationsPerSample).toBe(5);

      // Warmup increments should not affect the measured durations
      expect(currentTime).toBe(34);
    });
  });
});
