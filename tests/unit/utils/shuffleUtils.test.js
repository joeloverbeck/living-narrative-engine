/**
 * @file Unit tests for shuffle utilities
 * @see src/utils/shuffleUtils.js
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  shuffleInPlace,
  shuffle,
  createSeededRandom,
} from '../../../src/utils/shuffleUtils.js';

describe('shuffleUtils', () => {
  describe('shuffleInPlace', () => {
    it('should return same array reference', () => {
      const array = [1, 2, 3, 4, 5];
      const result = shuffleInPlace(array);

      expect(result).toBe(array);
    });

    it('should shuffle array in place', () => {
      // Use seeded random for deterministic test
      const seededRandom = createSeededRandom(42);
      const array = [1, 2, 3, 4, 5];
      const original = [...array];

      shuffleInPlace(array, seededRandom);

      // Array should be different from original (with this seed)
      expect(array).not.toEqual(original);
      // But should contain same elements
      expect(array.sort()).toEqual(original.sort());
    });

    it('should preserve all original elements', () => {
      const array = ['a', 'b', 'c', 'd', 'e'];
      const originalElements = [...array];

      shuffleInPlace(array);

      expect(array.sort()).toEqual(originalElements.sort());
      expect(array).toHaveLength(originalElements.length);
    });

    it('should handle empty array', () => {
      const array = [];
      const result = shuffleInPlace(array);

      expect(result).toEqual([]);
      expect(result).toBe(array);
    });

    it('should handle single element array', () => {
      const array = [42];
      const result = shuffleInPlace(array);

      expect(result).toEqual([42]);
      expect(result).toBe(array);
    });

    it('should handle two element array', () => {
      const array = [1, 2];
      const originalElements = [...array];

      shuffleInPlace(array);

      expect(array.sort()).toEqual(originalElements.sort());
    });

    it('should produce different results with different random functions', () => {
      const array1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const array2 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      const seededRandom1 = createSeededRandom(123);
      const seededRandom2 = createSeededRandom(456);

      shuffleInPlace(array1, seededRandom1);
      shuffleInPlace(array2, seededRandom2);

      // Different seeds should produce different shuffles (very likely)
      expect(array1).not.toEqual(array2);
    });

    it('should return non-array values unchanged', () => {
      expect(shuffleInPlace(null)).toBeNull();
      expect(shuffleInPlace(undefined)).toBeUndefined();
      expect(shuffleInPlace('string')).toBe('string');
      expect(shuffleInPlace(42)).toBe(42);
      expect(shuffleInPlace({ a: 1 })).toEqual({ a: 1 });
    });
  });

  describe('shuffle', () => {
    it('should return new array', () => {
      const array = [1, 2, 3, 4, 5];
      const result = shuffle(array);

      expect(result).not.toBe(array);
    });

    it('should not modify original array', () => {
      const array = [1, 2, 3, 4, 5];
      const original = [...array];

      shuffle(array);

      expect(array).toEqual(original);
    });

    it('should contain all original elements', () => {
      const array = [1, 2, 3, 4, 5];
      const result = shuffle(array);

      expect(result.sort()).toEqual(array.sort());
      expect(result).toHaveLength(array.length);
    });

    it('should produce shuffled result', () => {
      const seededRandom = createSeededRandom(42);
      const array = [1, 2, 3, 4, 5];

      const result = shuffle(array, seededRandom);

      // With seeded random, result should be shuffled (different from original order)
      expect(result).not.toEqual([1, 2, 3, 4, 5]);
      expect(result.sort()).toEqual([1, 2, 3, 4, 5]);
    });

    it('should handle empty array', () => {
      const array = [];
      const result = shuffle(array);

      expect(result).toEqual([]);
      expect(result).not.toBe(array);
    });

    it('should handle single element array', () => {
      const array = [42];
      const result = shuffle(array);

      expect(result).toEqual([42]);
      expect(result).not.toBe(array);
    });

    it('should return non-array values unchanged', () => {
      expect(shuffle(null)).toBeNull();
      expect(shuffle(undefined)).toBeUndefined();
      expect(shuffle('string')).toBe('string');
      expect(shuffle(42)).toBe(42);
    });
  });

  describe('createSeededRandom', () => {
    it('should produce deterministic sequence with same seed', () => {
      const random1 = createSeededRandom(42);
      const random2 = createSeededRandom(42);

      const sequence1 = [random1(), random1(), random1(), random1(), random1()];
      const sequence2 = [random2(), random2(), random2(), random2(), random2()];

      expect(sequence1).toEqual(sequence2);
    });

    it('should produce different sequences with different seeds', () => {
      const random1 = createSeededRandom(42);
      const random2 = createSeededRandom(123);

      const sequence1 = [random1(), random1(), random1()];
      const sequence2 = [random2(), random2(), random2()];

      expect(sequence1).not.toEqual(sequence2);
    });

    it('should return values in [0, 1) range', () => {
      const random = createSeededRandom(12345);

      for (let i = 0; i < 100; i++) {
        const value = random();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });

    it('should handle seed of 0', () => {
      // Seed of 0 should be coerced to 1 to avoid degenerate sequence
      const random = createSeededRandom(0);
      const values = [random(), random(), random()];

      // All values should be valid numbers in [0, 1)
      values.forEach((value) => {
        expect(typeof value).toBe('number');
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      });
    });

    it('should handle negative seeds', () => {
      const random = createSeededRandom(-42);
      const values = [random(), random(), random()];

      values.forEach((value) => {
        expect(typeof value).toBe('number');
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      });
    });

    it('should handle float seeds (truncates to integer)', () => {
      const random1 = createSeededRandom(42.7);
      const random2 = createSeededRandom(42);

      // Both should produce same sequence since 42.7 is floored to 42
      expect(random1()).toEqual(random2());
    });

    it('should produce reproducible shuffle results', () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      const result1 = shuffle([...array], createSeededRandom(999));
      const result2 = shuffle([...array], createSeededRandom(999));

      expect(result1).toEqual(result2);
    });
  });
});
