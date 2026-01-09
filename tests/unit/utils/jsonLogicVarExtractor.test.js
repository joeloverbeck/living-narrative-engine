/**
 * @file Unit tests for JSON Logic variable path extraction utilities.
 */

import { describe, it, expect } from '@jest/globals';
import {
  extractVarPath,
  collectVarPaths,
} from '../../../src/utils/jsonLogicVarExtractor.js';

describe('jsonLogicVarExtractor', () => {
  describe('extractVarPath', () => {
    it('extracts var path from string format', () => {
      const node = { var: 'emotions.joy' };
      expect(extractVarPath(node)).toBe('emotions.joy');
    });

    it('extracts var path from array format with default', () => {
      const node = { var: ['emotions.joy', 0] };
      expect(extractVarPath(node)).toBe('emotions.joy');
    });

    it('returns null for null input', () => {
      expect(extractVarPath(null)).toBeNull();
    });

    it('returns null for undefined input', () => {
      expect(extractVarPath(undefined)).toBeNull();
    });

    it('returns null for primitive input', () => {
      expect(extractVarPath(42)).toBeNull();
      expect(extractVarPath('string')).toBeNull();
      expect(extractVarPath(true)).toBeNull();
    });

    it('returns null for array input', () => {
      expect(extractVarPath([1, 2, 3])).toBeNull();
    });

    it('returns null for object without var property', () => {
      expect(extractVarPath({ foo: 'bar' })).toBeNull();
      expect(extractVarPath({ '>=': [1, 2] })).toBeNull();
    });

    it('returns null for var with non-string, non-array value', () => {
      expect(extractVarPath({ var: 42 })).toBeNull();
      expect(extractVarPath({ var: null })).toBeNull();
      expect(extractVarPath({ var: {} })).toBeNull();
    });

    it('returns null for array format with non-string first element', () => {
      expect(extractVarPath({ var: [42, 'default'] })).toBeNull();
      expect(extractVarPath({ var: [null, 'default'] })).toBeNull();
    });

    it('extracts simple root-level var path', () => {
      const node = { var: 'sexualArousal' };
      expect(extractVarPath(node)).toBe('sexualArousal');
    });

    it('extracts deeply nested var path', () => {
      const node = { var: 'actor.components.mood.valence' };
      expect(extractVarPath(node)).toBe('actor.components.mood.valence');
    });
  });

  describe('collectVarPaths', () => {
    it('extracts simple var path from comparison', () => {
      const logic = { '>=': [{ var: 'emotions.joy' }, 0.5] };
      expect(collectVarPaths(logic)).toEqual(['emotions.joy']);
    });

    it('extracts var path with default value array format', () => {
      const logic = { '>=': [{ var: ['emotions.joy', 0] }, 0.5] };
      expect(collectVarPaths(logic)).toEqual(['emotions.joy']);
    });

    it('extracts multiple var paths from AND logic', () => {
      const logic = {
        and: [
          { '>=': [{ var: 'emotions.joy' }, 0.5] },
          { '<=': [{ var: 'moodAxes.threat' }, 30] },
        ],
      };
      expect(collectVarPaths(logic)).toEqual([
        'emotions.joy',
        'moodAxes.threat',
      ]);
    });

    it('extracts var paths from nested OR within AND', () => {
      const logic = {
        and: [
          { '>=': [{ var: 'sexualArousal' }, 0.5] },
          {
            or: [
              { '>=': [{ var: 'emotions.thrill' }, 0.35] },
              { '>=': [{ var: 'emotions.anticipation' }, 0.4] },
            ],
          },
        ],
      };
      expect(collectVarPaths(logic)).toEqual([
        'sexualArousal',
        'emotions.thrill',
        'emotions.anticipation',
      ]);
    });

    it('extracts var paths from arithmetic expressions', () => {
      const logic = {
        '>=': [
          {
            '-': [
              { var: 'sexualStates.erotic_thrill' },
              { var: 'previousSexualStates.erotic_thrill' },
            ],
          },
          0.06,
        ],
      };
      expect(collectVarPaths(logic)).toEqual([
        'sexualStates.erotic_thrill',
        'previousSexualStates.erotic_thrill',
      ]);
    });

    it('returns empty array for null input', () => {
      expect(collectVarPaths(null)).toEqual([]);
    });

    it('returns empty array for undefined input', () => {
      expect(collectVarPaths(undefined)).toEqual([]);
    });

    it('returns empty array for empty object', () => {
      expect(collectVarPaths({})).toEqual([]);
    });

    it('returns empty array for primitive input', () => {
      expect(collectVarPaths(42)).toEqual([]);
      expect(collectVarPaths('string')).toEqual([]);
      expect(collectVarPaths(true)).toEqual([]);
    });

    it('handles deeply nested structures', () => {
      const logic = {
        and: [
          {
            and: [
              {
                or: [
                  { '>=': [{ var: 'a.b.c' }, 1] },
                  { '<=': [{ var: 'd.e.f' }, 2] },
                ],
              },
              { '==': [{ var: 'g.h' }, 3] },
            ],
          },
          { '!=': [{ var: 'i' }, 4] },
        ],
      };
      expect(collectVarPaths(logic)).toEqual(['a.b.c', 'd.e.f', 'g.h', 'i']);
    });

    it('handles logic without any var references', () => {
      const logic = { '>=': [5, 3] };
      expect(collectVarPaths(logic)).toEqual([]);
    });

    it('handles mixed operators with vars and literals', () => {
      const logic = {
        and: [
          { '>=': [{ var: 'emotions.joy' }, 0.5] },
          { '<=': [100, 200] }, // No var here
          { '==': [{ var: 'moodAxes.valence' }, 50] },
        ],
      };
      expect(collectVarPaths(logic)).toEqual([
        'emotions.joy',
        'moodAxes.valence',
      ]);
    });

    it('accumulates to provided paths array', () => {
      const existingPaths = ['existing.path'];
      const logic = { var: 'new.path' };
      const result = collectVarPaths(logic, existingPaths);
      expect(result).toEqual(['existing.path', 'new.path']);
      expect(result).toBe(existingPaths); // Same array reference
    });

    it('extracts var path from multiplication expression', () => {
      const logic = {
        '>=': [{ '*': [{ var: 'emotions.joy' }, 100] }, 50],
      };
      expect(collectVarPaths(logic)).toEqual(['emotions.joy']);
    });

    it('extracts var path from division expression', () => {
      const logic = {
        '>=': [{ '/': [{ var: 'moodAxes.valence' }, 100] }, 0.5],
      };
      expect(collectVarPaths(logic)).toEqual(['moodAxes.valence']);
    });

    it('extracts var paths from complex real-world expression', () => {
      // Based on erotic_thrill.expression.json structure
      const logic = {
        and: [
          { '>=': [{ var: 'sexualStates.erotic_thrill' }, 0.6] },
          { '>=': [{ var: 'sexualArousal' }, 0.5] },
          { '>=': [{ var: 'moodAxes.threat' }, 20] },
          { '<=': [{ var: 'moodAxes.threat' }, 80] },
          { '>=': [{ var: 'moodAxes.valence' }, 10] },
          { '<=': [{ var: 'emotions.freeze' }, 0.45] },
          {
            or: [
              { '>=': [{ var: 'emotions.thrill' }, 0.35] },
              { '>=': [{ var: 'emotions.anticipation' }, 0.4] },
              { '>=': [{ var: 'emotions.curiosity' }, 0.35] },
            ],
          },
        ],
      };

      const paths = collectVarPaths(logic);
      expect(paths).toContain('sexualStates.erotic_thrill');
      expect(paths).toContain('sexualArousal');
      expect(paths).toContain('moodAxes.threat');
      expect(paths).toContain('moodAxes.valence');
      expect(paths).toContain('emotions.freeze');
      expect(paths).toContain('emotions.thrill');
      expect(paths).toContain('emotions.anticipation');
      expect(paths).toContain('emotions.curiosity');
      // Note: moodAxes.threat appears twice in input, but collectVarPaths doesn't deduplicate
      expect(paths.filter((p) => p === 'moodAxes.threat')).toHaveLength(2);
    });
  });
});
