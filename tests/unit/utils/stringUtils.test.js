import { describe, test, expect } from '@jest/globals';
import {
  levenshteinDistance,
  findClosestMatches,
} from '../../../src/utils/stringUtils.js';

describe('stringUtils', () => {
  describe('levenshteinDistance', () => {
    test('should return 0 for identical strings', () => {
      expect(levenshteinDistance('test', 'test')).toBe(0);
      expect(levenshteinDistance('hello', 'hello')).toBe(0);
      expect(levenshteinDistance('', '')).toBe(0);
    });

    test('should calculate distance for completely different strings', () => {
      expect(levenshteinDistance('abc', 'xyz')).toBe(3);
      expect(levenshteinDistance('hello', 'world')).toBe(4);
    });

    test('should calculate distance for single character insertion', () => {
      expect(levenshteinDistance('cat', 'cats')).toBe(1);
      expect(levenshteinDistance('test', 'tests')).toBe(1);
    });

    test('should calculate distance for single character deletion', () => {
      expect(levenshteinDistance('cats', 'cat')).toBe(1);
      expect(levenshteinDistance('tests', 'test')).toBe(1);
    });

    test('should calculate distance for single character substitution', () => {
      expect(levenshteinDistance('cat', 'bat')).toBe(1);
      expect(levenshteinDistance('test', 'best')).toBe(1);
    });

    test('should calculate distance for multiple operations', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
      expect(levenshteinDistance('saturday', 'sunday')).toBe(3);
    });

    test('should handle empty strings correctly', () => {
      expect(levenshteinDistance('', 'abc')).toBe(3);
      expect(levenshteinDistance('abc', '')).toBe(3);
      expect(levenshteinDistance('', '')).toBe(0);
    });

    test('should handle strings with different lengths', () => {
      expect(levenshteinDistance('short', 'verylongstring')).toBe(12);
      expect(levenshteinDistance('a', 'abc')).toBe(2);
    });
  });

  describe('findClosestMatches', () => {
    test('should return exact match first', () => {
      const candidates = ['apple', 'apples', 'pear'];
      const matches = findClosestMatches('apple', candidates);
      expect(matches[0]).toBe('apple');
      expect(matches.length).toBeGreaterThan(0);
    });

    test('should filter by max distance', () => {
      const candidates = ['test', 'best', 'rest', 'hello', 'world'];
      const matches = findClosestMatches('test', candidates, 1);
      expect(matches).toContain('test');
      expect(matches).toContain('best');
      expect(matches).toContain('rest');
      expect(matches).not.toContain('hello');
      expect(matches).not.toContain('world');
    });

    test('should sort by edit distance', () => {
      const candidates = ['fest', 'best', 'test', 'rest'];
      const matches = findClosestMatches('test', candidates, 2);
      expect(matches[0]).toBe('test'); // distance 0
      expect(matches.slice(1)).toEqual(
        expect.arrayContaining(['best', 'rest', 'fest'])
      );
      // Verify sorting - distance 0 should be first
      const distances = matches.map((m) => levenshteinDistance('test', m));
      expect(distances[0]).toBe(0);
    });

    test('should return empty array when no matches within distance', () => {
      const candidates = ['hello', 'world', 'goodbye'];
      const matches = findClosestMatches('test', candidates, 2);
      expect(matches).toEqual([]);
    });

    test('should use default max distance of 3', () => {
      const candidates = ['test', 'testing', 'tester', 'verydifferent'];
      const matches = findClosestMatches('test', candidates);
      expect(matches).toContain('test');
      expect(matches).toContain('testing'); // distance 3
      expect(matches).toContain('tester'); // distance 2
      expect(matches).not.toContain('verydifferent'); // distance > 3
    });

    test('should handle empty candidates array', () => {
      const matches = findClosestMatches('test', []);
      expect(matches).toEqual([]);
    });

    test('should handle single candidate', () => {
      const matches = findClosestMatches('test', ['test'], 1);
      expect(matches).toEqual(['test']);
    });

    test('should respect custom max distance threshold', () => {
      const candidates = ['a', 'ab', 'abc', 'abcd', 'abcde'];
      const matches = findClosestMatches('', candidates, 2);
      expect(matches).toEqual(['a', 'ab']);
    });
  });
});
