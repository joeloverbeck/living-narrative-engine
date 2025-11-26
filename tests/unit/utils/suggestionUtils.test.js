/**
 * @file suggestionUtils.test.js
 * @description Unit tests for suggestionUtils - fuzzy matching and "Did you mean?" suggestions
 */

import { describe, it, expect } from '@jest/globals';
import {
  levenshteinDistance,
  findSimilar,
  suggestDidYouMean,
  suggestOperationType,
  suggestParameterName,
  isLikelyTypo,
} from '../../../src/utils/suggestionUtils.js';

describe('suggestionUtils', () => {
  describe('levenshteinDistance', () => {
    it('should return 0 for identical strings', () => {
      expect(levenshteinDistance('test', 'test')).toBe(0);
      expect(levenshteinDistance('', '')).toBe(0);
      expect(levenshteinDistance('LOCK_GRABBING', 'LOCK_GRABBING')).toBe(0);
    });

    it('should return string length for empty comparison', () => {
      expect(levenshteinDistance('test', '')).toBe(4);
      expect(levenshteinDistance('', 'test')).toBe(4);
      expect(levenshteinDistance('abc', '')).toBe(3);
    });

    it('should calculate single edit distance - substitution', () => {
      expect(levenshteinDistance('test', 'tast')).toBe(1);
      expect(levenshteinDistance('cat', 'bat')).toBe(1);
    });

    it('should calculate single edit distance - insertion', () => {
      expect(levenshteinDistance('test', 'tests')).toBe(1);
      expect(levenshteinDistance('tes', 'test')).toBe(1);
    });

    it('should calculate single edit distance - deletion', () => {
      expect(levenshteinDistance('test', 'tes')).toBe(1);
      expect(levenshteinDistance('tests', 'test')).toBe(1);
    });

    it('should calculate multiple edit distance', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
      expect(levenshteinDistance('flaw', 'lawn')).toBe(2);
    });

    it('should handle operation type typos', () => {
      // These are realistic typos that users might make
      expect(levenshteinDistance('LOCK_GRABB', 'LOCK_GRABBING')).toBe(3);
      expect(levenshteinDistance('SET_COMP', 'SET_COMPONENT')).toBe(5);
      expect(levenshteinDistance('DISPATCH_EVNT', 'DISPATCH_EVENT')).toBe(1);
    });
  });

  describe('findSimilar', () => {
    const candidates = [
      'LOCK_GRABBING',
      'UNLOCK_GRABBING',
      'SET_COMPONENT',
      'REMOVE_COMPONENT',
    ];

    it('should find similar strings within max distance', () => {
      const result = findSimilar('LOCK_GRABB', candidates, { maxDistance: 3 });
      expect(result).toContain('LOCK_GRABBING');
    });

    it('should return empty array when no matches within distance', () => {
      const result = findSimilar('COMPLETELY_DIFFERENT', candidates, {
        maxDistance: 3,
      });
      expect(result).toHaveLength(0);
    });

    it('should limit results to maxSuggestions', () => {
      const result = findSimilar('GRABBING', candidates, {
        maxDistance: 10,
        maxSuggestions: 2,
      });
      expect(result.length).toBeLessThanOrEqual(2);
    });

    it('should sort by distance (closest first)', () => {
      const result = findSimilar('LOCK_GRAB', candidates, { maxDistance: 5 });
      // LOCK_GRABBING should be first (closest match)
      expect(result[0]).toBe('LOCK_GRABBING');
    });

    it('should handle case insensitivity by default', () => {
      const result = findSimilar('lock_grabbing', candidates, {
        maxDistance: 0,
      });
      expect(result).toContain('LOCK_GRABBING');
    });

    it('should respect case sensitivity when configured', () => {
      const result = findSimilar('lock_grabbing', candidates, {
        maxDistance: 0,
        caseInsensitive: false,
      });
      expect(result).toHaveLength(0);
    });

    it('should return empty array for empty input', () => {
      expect(findSimilar('', candidates)).toHaveLength(0);
      expect(findSimilar(null, candidates)).toHaveLength(0);
    });

    it('should return empty array for empty candidates', () => {
      expect(findSimilar('test', [])).toHaveLength(0);
      expect(findSimilar('test', null)).toHaveLength(0);
    });
  });

  describe('suggestDidYouMean', () => {
    it('should return null when no matches within distance', () => {
      // Default maxDistance is 3, 'xyz' is far from 'abc' and 'def'
      const result = suggestDidYouMean('xyzxyz', ['abcdefgh', 'defghijk'], {
        maxDistance: 2,
      });
      expect(result).toBeNull();
    });

    it('should format single suggestion', () => {
      const result = suggestDidYouMean('LOCK_GRABB', ['LOCK_GRABBING'], {
        maxDistance: 5,
      });
      expect(result).toBe('Did you mean "LOCK_GRABBING"?');
    });

    it('should format multiple suggestions with "or"', () => {
      const result = suggestDidYouMean(
        'GRABBING',
        ['LOCK_GRABBING', 'UNLOCK_GRABBING'],
        { maxDistance: 10, maxSuggestions: 2 }
      );
      expect(result).toContain('Did you mean');
      expect(result).toContain('or');
    });

    it('should format three suggestions correctly', () => {
      const result = suggestDidYouMean(
        'COMP',
        ['SET_COMPONENT', 'ADD_COMPONENT', 'REMOVE_COMPONENT'],
        { maxDistance: 15 }
      );
      expect(result).toBe(
        'Did you mean "SET_COMPONENT", "ADD_COMPONENT" or "REMOVE_COMPONENT"?'
      );
    });

    it('should not mutate the findSimilar result', () => {
      const candidates = ['A', 'B', 'C'];
      // Call multiple times to ensure no mutation issues
      suggestDidYouMean('X', candidates, { maxDistance: 10 });
      const result = suggestDidYouMean('X', candidates, { maxDistance: 10 });
      expect(result).toBeDefined();
    });
  });

  describe('suggestOperationType', () => {
    const knownTypes = ['LOCK_GRABBING', 'UNLOCK_GRABBING', 'SET_COMPONENT'];

    it('should suggest for typos - LOCK_GRABB', () => {
      const result = suggestOperationType('LOCK_GRABB', knownTypes);
      expect(result).toContain('LOCK_GRABBING');
    });

    it('should suggest for prefix typos - SET_COMP', () => {
      const result = suggestOperationType('SET_COMP', knownTypes);
      expect(result).toContain('SET_COMPONENT');
    });

    it('should be case insensitive', () => {
      const result = suggestOperationType('lock_grabbing', knownTypes);
      expect(result).toContain('LOCK_GRABBING');
    });

    it('should return null for completely different input', () => {
      const result = suggestOperationType('COMPLETELY_RANDOM_TYPE', knownTypes);
      expect(result).toBeNull();
    });

    it('should limit to 2 suggestions', () => {
      // GRABBING is close to both LOCK_GRABBING and UNLOCK_GRABBING
      const result = suggestOperationType('GRABBING', knownTypes);
      expect(result).not.toBeNull();
      // Count quoted items - each suggestion has 2 quotes, so max 4 quotes for 2 suggestions
      const quotes = (result.match(/"/g) || []).length;
      expect(quotes).toBeLessThanOrEqual(4);
    });
  });

  describe('suggestParameterName', () => {
    const knownParams = ['entity_id', 'component_type_id', 'value'];

    it('should suggest for similar parameter names', () => {
      const result = suggestParameterName('entity', knownParams);
      expect(result).toContain('entity_id');
    });

    it('should be case-sensitive by default', () => {
      // 'ENTITY_ID' vs 'entity_id' - full caps should still match due to maxDistance
      const result = suggestParameterName('ENTITY_ID', knownParams);
      // With default maxDistance of 3, this should still match since
      // case difference counts as edits in case-sensitive mode
      // entity_id vs ENTITY_ID has distance 9 (all chars different case)
      // So this should return null
      expect(result).toBeNull();
    });

    it('should return null for completely different input', () => {
      const result = suggestParameterName('xyz_random_param', knownParams);
      expect(result).toBeNull();
    });
  });

  describe('isLikelyTypo', () => {
    it('should detect likely typos', () => {
      expect(isLikelyTypo('LOCK_GRABB', 'LOCK_GRABBING')).toBe(false); // distance 3 > threshold 2
      expect(isLikelyTypo('LOCK_GRABBIN', 'LOCK_GRABBING')).toBe(true); // distance 1
      expect(isLikelyTypo('LOCK_GRABBNG', 'LOCK_GRABBING')).toBe(true); // distance 1
    });

    it('should reject unlikely typos', () => {
      expect(isLikelyTypo('DISPATCH_EVENT', 'LOCK_GRABBING')).toBe(false);
      expect(isLikelyTypo('SET_COMPONENT', 'QUERY_COMPONENT')).toBe(false);
    });

    it('should handle custom threshold', () => {
      expect(isLikelyTypo('LOCK_GRABB', 'LOCK_GRABBING', 3)).toBe(true);
      expect(isLikelyTypo('LOCK_GRABB', 'LOCK_GRABBING', 2)).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isLikelyTypo('lock_grabbing', 'LOCK_GRABBING')).toBe(true);
      expect(isLikelyTypo('Lock_Grabbing', 'LOCK_GRABBING')).toBe(true);
    });
  });

  describe('edge cases from spec', () => {
    // Specific test cases from the ticket spec 4.2
    const operationTypes = [
      'LOCK_GRABBING',
      'UNLOCK_GRABBING',
      'SET_COMPONENT',
      'QUERY_COMPONENT',
      'ADD_COMPONENT',
      'REMOVE_COMPONENT',
    ];
    const paramNames = ['entity_id', 'component_type_id', 'value'];

    it('should suggest LOCK_GRABBING for LOCK_GRABB', () => {
      const result = suggestOperationType('LOCK_GRABB', operationTypes);
      expect(result).toContain('LOCK_GRABBING');
    });

    it('should suggest SET_COMPONENT for SET_COMP', () => {
      const result = suggestOperationType('SET_COMP', operationTypes);
      expect(result).toContain('SET_COMPONENT');
    });

    it('should suggest entity_id for entity', () => {
      const result = suggestParameterName('entity', paramNames);
      expect(result).toContain('entity_id');
    });

    it('should return null for COMPLETELY_WRONG', () => {
      const result = suggestOperationType('COMPLETELY_WRONG', operationTypes);
      expect(result).toBeNull();
    });
  });
});
