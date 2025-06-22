import { describe, test, expect } from '@jest/globals';
import {
  dedupe,
  merge,
  repair,
} from '../../../../src/logic/services/closenessCircleService.js';

describe('ClosenessCircleService', () => {
  describe('dedupe', () => {
    test('should return an empty array if input is empty', () => {
      expect(dedupe([])).toEqual([]);
    });

    test('should return the same array if no duplicates exist', () => {
      expect(dedupe(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
    });

    test('should remove duplicate string values', () => {
      expect(dedupe(['a', 'b', 'a', 'c', 'b'])).toEqual(['a', 'b', 'c']);
    });

    test('should handle arrays with a single element', () => {
      expect(dedupe(['a'])).toEqual(['a']);
    });

    test('should handle arrays where all elements are the same', () => {
      expect(dedupe(['a', 'a', 'a'])).toEqual(['a']);
    });

    test('should return an empty array for non-array inputs', () => {
      expect(dedupe(null)).toEqual([]);
      expect(dedupe(undefined)).toEqual([]);
      expect(dedupe({})).toEqual([]);
    });
  });

  describe('merge (poly merge)', () => {
    test('should merge two disjoint arrays', () => {
      const result = merge(['a', 'b'], ['c', 'd']);
      expect(result).toEqual(['a', 'b', 'c', 'd']);
    });

    test('should merge two arrays with overlapping elements and dedupe them', () => {
      const result = merge(['a', 'b'], ['b', 'c']);
      expect(result).toEqual(['a', 'b', 'c']);
    });

    test('should merge multiple arrays with overlaps', () => {
      const result = merge(['a', 'b'], ['c', 'd'], ['a', 'd', 'e']);
      expect(result).toEqual(['a', 'b', 'c', 'd', 'e']);
    });

    test('should return a single deduped array if only one is provided', () => {
      const result = merge(['a', 'b', 'a']);
      expect(result).toEqual(['a', 'b']);
    });

    test('should handle empty arrays correctly', () => {
      const result = merge(['a', 'b'], [], ['c']);
      expect(result).toEqual(['a', 'b', 'c']);
    });

    test('should return an empty array if all input arrays are empty', () => {
      expect(merge([], [])).toEqual([]);
    });
  });

  describe('repair', () => {
    test('should deduplicate and sort an array of strings', () => {
      const result = repair(['c', 'a', 'c', 'b']);
      // sort() sorts alphabetically by default for strings
      expect(result).toEqual(['a', 'b', 'c']);
    });

    test('should handle an already sorted and unique array', () => {
      const result = repair(['a', 'b', 'c']);
      expect(result).toEqual(['a', 'b', 'c']);
    });

    test('should handle an empty array', () => {
      expect(repair([])).toEqual([]);
    });

    test('should handle an array with one element', () => {
      expect(repair(['a'])).toEqual(['a']);
    });
  });

  describe('Usage Scenarios', () => {
    test('Symmetry: should correctly calculate partner lists for a new triad', () => {
      // Arrange: C approaches B, who is already close with A.
      const actorA = { id: 'A', partners: ['B'] };
      const actorB = { id: 'B', partners: ['A'] };
      const actorC = { id: 'C', partners: [] };

      // Act: The rule logic merges all participants into a single circle.
      const allPartners = merge(
        [actorA.id, actorB.id, actorC.id],
        actorA.partners,
        actorB.partners,
        actorC.partners
      );
      allPartners.sort(); // For consistent comparison

      // Assert: The full circle contains all three, with no duplicates.
      expect(allPartners).toEqual(['A', 'B', 'C']);

      // Act: The rule then builds the new partner list for each member.
      const newPartnersForA = allPartners.filter((p) => p !== 'A').sort();
      const newPartnersForB = allPartners.filter((p) => p !== 'B').sort();
      const newPartnersForC = allPartners.filter((p) => p !== 'C').sort();

      // Assert: Each member's list is symmetrical.
      expect(newPartnersForA).toEqual(['B', 'C']);
      expect(newPartnersForB).toEqual(['A', 'C']);
      expect(newPartnersForC).toEqual(['A', 'B']);
    });

    test('Break-up: should correctly model a member leaving a triad', () => {
      // Arrange: A, B, and C are in a triad.
      const circle = {
        A: { id: 'A', partners: ['B', 'C'] },
        B: { id: 'B', partners: ['A', 'C'] },
        C: { id: 'C', partners: ['A', 'B'] },
      };

      // Act: A decides to 'step_back'.
      const actorLeaving = 'A';
      const formerPartners = circle[actorLeaving].partners; // ['B', 'C']
      delete circle[actorLeaving]; // A's component is removed.

      // Act: The rule logic updates the remaining partners.
      for (const partnerId of formerPartners) {
        if (circle[partnerId]) {
          // Remove the leaving actor from the partner's list.
          circle[partnerId].partners = circle[partnerId].partners.filter(
            (p) => p !== actorLeaving
          );
        }
      }

      // Assert: B and C remain, forming a pair. Their lists are symmetrical.
      expect(circle.A).toBeUndefined();
      expect(circle.B.partners).toEqual(['C']);
      expect(circle.C.partners).toEqual(['B']);

      // We can use the service to verify the remaining partner lists are clean.
      expect(repair(circle.B.partners)).toEqual(['C']);
      expect(repair(circle.C.partners)).toEqual(['B']);
    });
  });
});
