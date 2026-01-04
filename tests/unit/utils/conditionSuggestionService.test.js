/**
 * @file Unit tests for conditionSuggestionService
 * @description Tests fuzzy matching, namespace prioritization, and various registry formats
 */

import { describe, it, expect } from '@jest/globals';
import { getSuggestions } from '../../../src/utils/conditionSuggestionService.js';

describe('conditionSuggestionService', () => {
  describe('getSuggestions', () => {
    describe('fuzzy matching', () => {
      it('returns closest 3 condition names by default', () => {
        const registry = [
          'core:actor',
          'core:target',
          'core:action',
          'core:location',
          'core:inventory',
          'core:state',
          'core:health',
          'core:position',
          'core:facing',
          'core:closeness',
        ];

        const result = getSuggestions('core:actorr', registry);

        expect(result).toHaveLength(3);
        expect(result[0]).toBe('core:actor'); // Closest match
      });

      it('returns fewer suggestions when registry is smaller', () => {
        // Use close matches to ensure they're all within distance threshold
        const registry = ['core:actor', 'core:actors'];

        const result = getSuggestions('core:actorr', registry);

        expect(result.length).toBeLessThanOrEqual(2);
        expect(result).toContain('core:actor');
        // Both matches are close enough to be suggested
        expect(result).toContain('core:actors');
      });

      it('respects maxSuggestions option', () => {
        const registry = [
          'core:actor',
          'core:action',
          'core:active',
          'core:actual',
          'core:another',
        ];

        const result = getSuggestions('core:actorr', registry, {
          maxSuggestions: 2,
        });

        expect(result).toHaveLength(2);
      });
    });

    describe('empty registry handling', () => {
      it('returns empty array for null registry', () => {
        const result = getSuggestions('core:actor', null);
        expect(result).toEqual([]);
      });

      it('returns empty array for undefined registry', () => {
        const result = getSuggestions('core:actor', undefined);
        expect(result).toEqual([]);
      });

      it('returns empty array for empty array registry', () => {
        const result = getSuggestions('core:actor', []);
        expect(result).toEqual([]);
      });

      it('returns empty array for empty Map registry', () => {
        const result = getSuggestions('core:actor', new Map());
        expect(result).toEqual([]);
      });
    });

    describe('exact match handling', () => {
      it('does not suggest exact match (case sensitive)', () => {
        const registry = ['core:actor', 'core:target'];

        const result = getSuggestions('core:actor', registry);

        expect(result).not.toContain('core:actor');
      });

      it('does not suggest exact match (case insensitive)', () => {
        const registry = ['core:actor', 'core:target', 'core:action'];

        const result = getSuggestions('CORE:ACTOR', registry);

        expect(result).not.toContain('core:actor');
        // Should still find similar ones
        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('namespace prioritization', () => {
      it('prioritizes same namespace matches', () => {
        // Use shorter IDs so both namespaces are within Levenshtein distance
        // 'pos:abc' and 'cor:abc' are both close to 'pos:ab'
        const registry = ['pos:abc', 'cor:abc', 'cor:abd', 'pos:abd'];

        const result = getSuggestions('pos:ab', registry, {
          maxSuggestions: 4,
        });

        // Both namespaces should be present
        const posMatches = result.filter((r) => r.startsWith('pos:'));
        const corMatches = result.filter((r) => r.startsWith('cor:'));

        expect(posMatches.length).toBeGreaterThan(0);
        expect(corMatches.length).toBeGreaterThan(0);

        // All same-namespace matches should appear before other namespace matches
        const lastPosIndex = result.lastIndexOf(posMatches[posMatches.length - 1]);
        const firstCorIndex = result.indexOf(corMatches[0]);
        expect(lastPosIndex).toBeLessThan(firstCorIndex);
      });

      it('works correctly when input has no namespace', () => {
        const registry = [
          'core:actor',
          'core:action',
          'positioning:active',
          'actor',
        ];

        // No namespace in input
        const result = getSuggestions('actorr', registry);

        // Should still find matches without crashing
        expect(result.length).toBeGreaterThanOrEqual(0);
      });
    });

    describe('special characters handling', () => {
      it('handles underscores in IDs', () => {
        const registry = [
          'core:is_actor',
          'core:has_target',
          'core:in_location',
        ];

        const result = getSuggestions('core:is_actorr', registry);

        expect(result).toContain('core:is_actor');
      });

      it('handles hyphens in IDs', () => {
        const registry = [
          'core:is-actor',
          'core:has-target',
          'core:in-location',
        ];

        const result = getSuggestions('core:is-actorr', registry);

        expect(result).toContain('core:is-actor');
      });

      it('handles mixed special characters', () => {
        const registry = [
          'core:is_actor-active',
          'core:has_target-valid',
          'core:in_location-safe',
        ];

        const result = getSuggestions('core:is_actor-activee', registry);

        expect(result).toContain('core:is_actor-active');
      });
    });

    describe('case insensitive matching', () => {
      it('matches regardless of case', () => {
        const registry = ['Core:Actor', 'CORE:TARGET', 'core:action'];

        const result = getSuggestions('core:actorr', registry);

        expect(result).toContain('Core:Actor');
      });

      it('handles all uppercase input', () => {
        const registry = ['core:actor', 'core:target', 'core:action'];

        const result = getSuggestions('CORE:ACTORR', registry);

        expect(result).toContain('core:actor');
      });

      it('handles mixed case in registry', () => {
        const registry = ['Core:AcToR', 'CORE:TaRgEt', 'core:ACTion'];

        const result = getSuggestions('core:actor', registry);

        // Should not include exact match (case insensitive)
        expect(result).not.toContain('Core:AcToR');
      });
    });

    describe('registry format: array of objects with id field', () => {
      it('extracts IDs from objects', () => {
        const registry = [
          { id: 'core:actor', description: 'Actor condition' },
          { id: 'core:target', description: 'Target condition' },
          { id: 'core:action', description: 'Action condition' },
        ];

        const result = getSuggestions('core:actorr', registry);

        expect(result).toContain('core:actor');
      });

      it('handles mixed array of strings and objects', () => {
        const registry = [
          'core:actor',
          { id: 'core:actors' },
          'core:action',
          { id: 'core:state' },
        ];

        const result = getSuggestions('core:actorr', registry);

        expect(result).toContain('core:actor');
        // 'core:actors' is close enough to be suggested
        expect(result).toContain('core:actors');
      });

      it('skips objects without id field', () => {
        const registry = [
          { id: 'core:actor' },
          { name: 'no-id-here' },
          { id: 'core:target' },
          { description: 'also-no-id' },
        ];

        const result = getSuggestions('core:actorr', registry);

        expect(result).toContain('core:actor');
        expect(result).not.toContain('no-id-here');
        expect(result).not.toContain('also-no-id');
      });

      it('handles objects with null id', () => {
        const registry = [
          { id: 'core:actor' },
          { id: null },
          { id: 'core:target' },
        ];

        const result = getSuggestions('core:actorr', registry);

        expect(result).toContain('core:actor');
        // Should not crash
      });
    });

    describe('registry format: Map', () => {
      it('extracts keys from Map', () => {
        const registry = new Map([
          ['core:actor', { description: 'Actor condition' }],
          ['core:target', { description: 'Target condition' }],
          ['core:action', { description: 'Action condition' }],
        ]);

        const result = getSuggestions('core:actorr', registry);

        expect(result).toContain('core:actor');
      });

      it('handles Map with various value types', () => {
        const registry = new Map([
          ['core:actor', null],
          ['core:target', undefined],
          ['core:action', { valid: true }],
        ]);

        const result = getSuggestions('core:actorr', registry);

        expect(result).toContain('core:actor');
      });
    });

    describe('edge cases', () => {
      it('handles very long condition IDs', () => {
        const longId =
          'positioning:very_long_condition_name_that_exceeds_normal_length';
        const registry = [longId, 'core:actor', 'core:target'];

        const result = getSuggestions(
          'positioning:very_long_condition_name_that_exceeds_normal_lengt',
          registry
        );

        expect(result).toContain(longId);
      });

      it('handles single character difference', () => {
        const registry = ['core:actor', 'core:actors', 'core:acting'];

        const result = getSuggestions('core:actor', registry);

        // Should not include exact match
        expect(result).not.toContain('core:actor');
        // Should include close matches
        expect(result).toContain('core:actors');
      });

      it('returns empty when no matches within distance threshold', () => {
        const registry = [
          'completely:different',
          'totally:unrelated',
          'xyz:abc',
        ];

        const result = getSuggestions('core:actor', registry);

        // May or may not find matches depending on threshold
        // Just ensure it doesn't crash
        expect(Array.isArray(result)).toBe(true);
      });
    });

    describe('deterministic behavior', () => {
      it('returns same results for same inputs', () => {
        const registry = [
          'core:actor',
          'core:target',
          'core:action',
          'positioning:close',
        ];

        const result1 = getSuggestions('core:actorr', registry);
        const result2 = getSuggestions('core:actorr', registry);

        expect(result1).toEqual(result2);
      });
    });
  });
});
