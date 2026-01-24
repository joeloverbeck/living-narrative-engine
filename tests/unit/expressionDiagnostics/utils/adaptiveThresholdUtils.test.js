/**
 * @file Unit tests for adaptiveThresholdUtils.js
 */

import { describe, expect, it } from '@jest/globals';
import {
  createSeededRNG,
  fisherYatesShuffle,
  computeAdaptiveThresholdCacheKey,
  collectWeightsForAxes,
  computeAdaptiveDistanceThreshold,
} from '../../../../src/expressionDiagnostics/utils/adaptiveThresholdUtils.js';

describe('adaptiveThresholdUtils', () => {
  describe('createSeededRNG', () => {
    it('should create reproducible random sequences with same seed', () => {
      const rng1 = createSeededRNG(42);
      const rng2 = createSeededRNG(42);

      const seq1 = [rng1(), rng1(), rng1(), rng1(), rng1()];
      const seq2 = [rng2(), rng2(), rng2(), rng2(), rng2()];

      expect(seq1).toEqual(seq2);
    });

    it('should produce different sequences with different seeds', () => {
      const rng1 = createSeededRNG(42);
      const rng2 = createSeededRNG(123);

      expect(rng1()).not.toBe(rng2());
    });

    it('should produce values in [0, 1) range', () => {
      const rng = createSeededRNG(42);

      for (let i = 0; i < 100; i++) {
        const value = rng();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });

    it('should default to seed 42 for non-finite input', () => {
      const rngDefault = createSeededRNG(NaN);
      const rng42 = createSeededRNG(42);

      expect(rngDefault()).toBe(rng42());
    });

    it('should handle negative seeds', () => {
      const rng = createSeededRNG(-100);
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    });

    it('should handle zero seed', () => {
      const rng = createSeededRNG(0);
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    });
  });

  describe('fisherYatesShuffle', () => {
    it('should shuffle array in place', () => {
      const rng = createSeededRNG(42);
      const array = [1, 2, 3, 4, 5];
      const original = [...array];

      const result = fisherYatesShuffle(array, rng);

      expect(result).toBe(array); // Same reference
      expect(array).not.toEqual(original); // Modified
    });

    it('should produce reproducible shuffles with same seed', () => {
      const array1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const array2 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      fisherYatesShuffle(array1, createSeededRNG(42));
      fisherYatesShuffle(array2, createSeededRNG(42));

      expect(array1).toEqual(array2);
    });

    it('should handle empty array', () => {
      const array = [];
      fisherYatesShuffle(array, createSeededRNG(42));
      expect(array).toEqual([]);
    });

    it('should handle single-element array', () => {
      const array = [1];
      fisherYatesShuffle(array, createSeededRNG(42));
      expect(array).toEqual([1]);
    });

    it('should preserve all elements', () => {
      const rng = createSeededRNG(42);
      const array = [1, 2, 3, 4, 5];
      fisherYatesShuffle(array, rng);

      expect(array.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('computeAdaptiveThresholdCacheKey', () => {
    it('should create consistent cache key for same prototypes', () => {
      const prototypes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

      const key1 = computeAdaptiveThresholdCacheKey(prototypes, 42);
      const key2 = computeAdaptiveThresholdCacheKey(prototypes, 42);

      expect(key1).toBe(key2);
    });

    it('should create different keys for different seeds', () => {
      const prototypes = [{ id: 'a' }, { id: 'b' }];

      const key1 = computeAdaptiveThresholdCacheKey(prototypes, 42);
      const key2 = computeAdaptiveThresholdCacheKey(prototypes, 123);

      expect(key1).not.toBe(key2);
    });

    it('should sort prototype IDs for order independence', () => {
      const proto1 = [{ id: 'a' }, { id: 'b' }];
      const proto2 = [{ id: 'b' }, { id: 'a' }];

      const key1 = computeAdaptiveThresholdCacheKey(proto1, 42);
      const key2 = computeAdaptiveThresholdCacheKey(proto2, 42);

      expect(key1).toBe(key2);
    });

    it('should use prototypeId as fallback', () => {
      const prototypes = [{ prototypeId: 'x' }, { id: 'y' }];
      const key = computeAdaptiveThresholdCacheKey(prototypes, 42);

      expect(key).toContain('x');
      expect(key).toContain('y');
    });

    it('should handle non-array input', () => {
      const key = computeAdaptiveThresholdCacheKey(null, 42);
      expect(key).toBe('|42|0');
    });

    it('should include prototype count in key', () => {
      const proto1 = [{ id: 'a' }];
      const proto2 = [{ id: 'a' }, { id: 'a' }]; // Duplicate IDs

      const key1 = computeAdaptiveThresholdCacheKey(proto1, 42);
      const key2 = computeAdaptiveThresholdCacheKey(proto2, 42);

      expect(key1).not.toBe(key2); // Different counts
    });
  });

  describe('collectWeightsForAxes', () => {
    it('should collect weights for all prototypes and axes', () => {
      const prototypes = [
        { weights: { x: 1, y: 2 } },
        { weights: { x: 3, y: 4 } },
      ];
      const axes = ['x', 'y'];

      const weights = collectWeightsForAxes(prototypes, axes);

      expect(weights).toEqual([1, 2, 3, 4]);
    });

    it('should use 0 for missing axis values', () => {
      const prototypes = [
        { weights: { x: 1 } },
        { weights: { y: 2 } },
      ];
      const axes = ['x', 'y'];

      const weights = collectWeightsForAxes(prototypes, axes);

      expect(weights).toEqual([1, 0, 0, 2]);
    });

    it('should use 0 for non-finite values', () => {
      const prototypes = [
        { weights: { x: NaN, y: Infinity } },
        { weights: { x: 1, y: 2 } },
      ];
      const axes = ['x', 'y'];

      const weights = collectWeightsForAxes(prototypes, axes);

      expect(weights).toEqual([0, 0, 1, 2]);
    });

    it('should handle prototypes without weights', () => {
      const prototypes = [{}, { weights: null }, { weights: { x: 1 } }];
      const axes = ['x'];

      const weights = collectWeightsForAxes(prototypes, axes);

      expect(weights).toEqual([0, 0, 1]);
    });

    it('should return empty array for empty prototypes', () => {
      const weights = collectWeightsForAxes([], ['x', 'y']);
      expect(weights).toEqual([]);
    });

    it('should return empty array for empty axes', () => {
      const prototypes = [{ weights: { x: 1 } }];
      const weights = collectWeightsForAxes(prototypes, []);
      expect(weights).toEqual([]);
    });
  });

  describe('computeAdaptiveDistanceThreshold', () => {
    const createMinimalPrototypes = (count = 15) => {
      return Array.from({ length: count }, (_, i) => ({
        id: `proto${i}`,
        weights: { axisA: i * 0.1, axisB: (count - i) * 0.1 },
      }));
    };

    it('should return null for fewer than 10 prototypes', () => {
      const prototypes = createMinimalPrototypes(5);
      const result = computeAdaptiveDistanceThreshold({
        prototypes,
        axes: ['axisA', 'axisB'],
      });
      expect(result).toBeNull();
    });

    it('should return null for non-array prototypes', () => {
      const result = computeAdaptiveDistanceThreshold({
        prototypes: null,
        axes: ['axisA'],
      });
      expect(result).toBeNull();
    });

    it('should return null for empty axes', () => {
      const prototypes = createMinimalPrototypes(15);
      const result = computeAdaptiveDistanceThreshold({
        prototypes,
        axes: [],
      });
      expect(result).toBeNull();
    });

    it('should return null for non-array axes', () => {
      const prototypes = createMinimalPrototypes(15);
      const result = computeAdaptiveDistanceThreshold({
        prototypes,
        axes: null,
      });
      expect(result).toBeNull();
    });

    it('should compute threshold for valid inputs', () => {
      const prototypes = createMinimalPrototypes(15);
      const result = computeAdaptiveDistanceThreshold({
        prototypes,
        axes: ['axisA', 'axisB'],
        iterations: 20,
        percentile: 95,
        seed: 42,
      });

      expect(result).not.toBeNull();
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it('should produce reproducible results with same seed', () => {
      const prototypes = createMinimalPrototypes(15);
      const params = {
        prototypes,
        axes: ['axisA', 'axisB'],
        iterations: 50,
        percentile: 90,
        seed: 12345,
      };

      const result1 = computeAdaptiveDistanceThreshold(params);
      const result2 = computeAdaptiveDistanceThreshold(params);

      expect(result1).toBe(result2);
    });

    it('should produce different results with different seeds', () => {
      const prototypes = createMinimalPrototypes(20);
      const baseParams = {
        prototypes,
        axes: ['axisA', 'axisB'],
        iterations: 50,
        percentile: 90,
      };

      const result1 = computeAdaptiveDistanceThreshold({ ...baseParams, seed: 42 });
      const result2 = computeAdaptiveDistanceThreshold({ ...baseParams, seed: 999 });

      // Results should differ (though there's a small chance they're equal)
      expect(result1).not.toBe(result2);
    });

    it('should clamp iterations to valid range', () => {
      const prototypes = createMinimalPrototypes(15);
      const params = {
        prototypes,
        axes: ['axisA', 'axisB'],
        percentile: 50,
        seed: 42,
      };

      // Very low iterations - should be clamped to 10
      const result1 = computeAdaptiveDistanceThreshold({ ...params, iterations: 1 });
      expect(result1).not.toBeNull();

      // Very high iterations - should be clamped to 1000
      const result2 = computeAdaptiveDistanceThreshold({ ...params, iterations: 5000 });
      expect(result2).not.toBeNull();
    });

    it('should clamp percentile to valid range', () => {
      const prototypes = createMinimalPrototypes(15);
      const params = {
        prototypes,
        axes: ['axisA', 'axisB'],
        iterations: 20,
        seed: 42,
      };

      // Negative percentile
      const result1 = computeAdaptiveDistanceThreshold({ ...params, percentile: -10 });
      expect(result1).not.toBeNull();

      // Over 100 percentile
      const result2 = computeAdaptiveDistanceThreshold({ ...params, percentile: 150 });
      expect(result2).not.toBeNull();
    });

    it('should use default values when not specified', () => {
      const prototypes = createMinimalPrototypes(15);
      const result = computeAdaptiveDistanceThreshold({
        prototypes,
        axes: ['axisA', 'axisB'],
      });

      expect(result).not.toBeNull();
    });

    it('should handle prototypes with zero weights', () => {
      const prototypes = Array.from({ length: 15 }, (_, i) => ({
        id: `proto${i}`,
        weights: { axisA: 0, axisB: 0 },
      }));

      const result = computeAdaptiveDistanceThreshold({
        prototypes,
        axes: ['axisA', 'axisB'],
        iterations: 20,
        seed: 42,
      });

      // All zero weights means no normalized vectors, so null expected
      expect(result).toBeNull();
    });

    it('should handle single axis', () => {
      const prototypes = Array.from({ length: 15 }, (_, i) => ({
        id: `proto${i}`,
        weights: { singleAxis: (i + 1) * 0.1 },
      }));

      const result = computeAdaptiveDistanceThreshold({
        prototypes,
        axes: ['singleAxis'],
        iterations: 20,
        seed: 42,
      });

      expect(result).not.toBeNull();
      // With single axis, normalized vectors align perfectly with the axis
      expect(result).toBeCloseTo(0, 1);
    });

    it('should handle many axes', () => {
      const axes = ['a', 'b', 'c', 'd', 'e'];
      const prototypes = Array.from({ length: 15 }, (_, i) => ({
        id: `proto${i}`,
        weights: Object.fromEntries(axes.map((a, j) => [a, (i + j) * 0.1])),
      }));

      const result = computeAdaptiveDistanceThreshold({
        prototypes,
        axes,
        iterations: 30,
        seed: 42,
      });

      expect(result).not.toBeNull();
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });
});
