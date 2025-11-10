/**
 * @file Unit tests for StringSimilarityCalculator
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import StringSimilarityCalculator from '../../../src/validation/stringSimilarityCalculator.js';
import { createTestBed } from '../../common/testBed.js';

describe('StringSimilarityCalculator', () => {
  let testBed;
  let calculator;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    calculator = new StringSimilarityCalculator({ logger: mockLogger });
  });

  describe('constructor', () => {
    it('should validate logger dependency', () => {
      expect(() => {
        new StringSimilarityCalculator({ logger: null });
      }).toThrow();
    });

    it('should create instance with valid dependencies', () => {
      expect(calculator).toBeDefined();
    });
  });

  describe('calculateDistance', () => {
    it('should return 0 for identical strings', () => {
      const distance = calculator.calculateDistance('hello', 'hello');
      expect(distance).toBe(0);
    });

    it('should calculate distance for 1 substitution', () => {
      const distance = calculator.calculateDistance('hello', 'hallo');
      expect(distance).toBe(1);
    });

    it('should calculate distance for 1 insertion', () => {
      const distance = calculator.calculateDistance('hello', 'helloo');
      expect(distance).toBe(1);
    });

    it('should calculate distance for 1 deletion', () => {
      const distance = calculator.calculateDistance('hello', 'hell');
      expect(distance).toBe(1);
    });

    it('should calculate distance for multiple operations', () => {
      const distance = calculator.calculateDistance('kitten', 'sitting');
      expect(distance).toBe(3);
    });

    it('should handle empty strings', () => {
      expect(calculator.calculateDistance('', '')).toBe(0);
      expect(calculator.calculateDistance('hello', '')).toBe(5);
      expect(calculator.calculateDistance('', 'hello')).toBe(5);
    });

    it('should handle completely different strings', () => {
      const distance = calculator.calculateDistance('abc', 'xyz');
      expect(distance).toBe(3);
    });
  });

  describe('findClosest', () => {
    it('should find closest match within max distance', () => {
      const validValues = ['apple', 'banana', 'cherry'];
      const closest = calculator.findClosest('appl', validValues, 3);
      expect(closest).toBe('apple');
    });

    it('should find closest match with multiple candidates', () => {
      const validValues = ['smooth', 'rough', 'soft'];
      const closest = calculator.findClosest('smoth', validValues, 3);
      expect(closest).toBe('smooth');
    });

    it('should return null when no match within max distance', () => {
      const validValues = ['apple', 'banana', 'cherry'];
      const closest = calculator.findClosest('zebra', validValues, 2);
      expect(closest).toBe(null);
    });

    it('should handle empty inputs', () => {
      expect(calculator.findClosest('', ['apple'], 3)).toBe(null);
      expect(calculator.findClosest('apple', [], 3)).toBe(null);
      expect(calculator.findClosest(null, ['apple'], 3)).toBe(null);
      expect(calculator.findClosest('apple', null, 3)).toBe(null);
    });

    it('should perform case-insensitive matching', () => {
      const validValues = ['Apple', 'Banana', 'Cherry'];
      const closest = calculator.findClosest('apple', validValues, 3);
      expect(closest).toBe('Apple');
    });

    it('should return closest match when multiple are within max distance', () => {
      const validValues = ['cat', 'bat', 'rat'];
      const closest = calculator.findClosest('mat', validValues, 3);
      // Should return one of them (the first closest one found)
      expect(['cat', 'bat', 'rat']).toContain(closest);
    });

    it('should use default maxDistance of 3', () => {
      const validValues = ['apple', 'banana', 'cherry'];
      const closest = calculator.findClosest('appl', validValues);
      expect(closest).toBe('apple');
    });

    it('should respect custom maxDistance', () => {
      const validValues = ['apple', 'banana', 'cherry'];
      // 'ap' has distance 3 from 'apple', so it should match with maxDistance=3
      expect(calculator.findClosest('ap', validValues, 3)).toBe('apple');
      // But not with maxDistance=2
      expect(calculator.findClosest('ap', validValues, 2)).toBe(null);
    });
  });

  describe('edge cases', () => {
    it('should handle single character strings', () => {
      expect(calculator.calculateDistance('a', 'b')).toBe(1);
      expect(calculator.calculateDistance('a', 'a')).toBe(0);
    });

    it('should handle long strings efficiently', () => {
      const longStr1 = 'a'.repeat(100);
      const longStr2 = 'a'.repeat(99) + 'b';
      const distance = calculator.calculateDistance(longStr1, longStr2);
      expect(distance).toBe(1);
    });

    it('should find match with exact distance at threshold', () => {
      const validValues = ['test'];
      // 'tst' has distance exactly 1 from 'test'
      expect(calculator.findClosest('tst', validValues, 1)).toBe('test');
      // But distance 2 from 'test' to 'st'
      expect(calculator.findClosest('st', validValues, 1)).toBe(null);
      expect(calculator.findClosest('st', validValues, 2)).toBe('test');
    });
  });
});
