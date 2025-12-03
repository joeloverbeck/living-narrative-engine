/**
 * @file Unit tests for hit probability weight utilities
 * @see src/anatomy/utils/hitProbabilityWeightUtils.js
 */

import { describe, it, expect } from '@jest/globals';
import {
  DEFAULT_HIT_PROBABILITY_WEIGHT,
  getEffectiveHitWeight,
  filterEligibleHitTargets,
} from '../../../../src/anatomy/utils/hitProbabilityWeightUtils.js';

describe('hitProbabilityWeightUtils', () => {
  describe('DEFAULT_HIT_PROBABILITY_WEIGHT', () => {
    it('should be 1.0', () => {
      expect(DEFAULT_HIT_PROBABILITY_WEIGHT).toBe(1.0);
    });
  });

  describe('getEffectiveHitWeight', () => {
    describe('when partComponent is null or undefined', () => {
      it('should return 0 for null', () => {
        expect(getEffectiveHitWeight(null)).toBe(0);
      });

      it('should return 0 for undefined', () => {
        expect(getEffectiveHitWeight(undefined)).toBe(0);
      });
    });

    describe('when hit_probability_weight is explicitly set', () => {
      it('should return the explicit weight when set to a positive number', () => {
        const partComponent = { hit_probability_weight: 5.5 };
        expect(getEffectiveHitWeight(partComponent)).toBe(5.5);
      });

      it('should return 0 when weight is explicitly set to 0 (internal organs)', () => {
        const partComponent = { hit_probability_weight: 0 };
        expect(getEffectiveHitWeight(partComponent)).toBe(0);
      });

      it('should return 0 for negative weights (clamped to minimum)', () => {
        const partComponent = { hit_probability_weight: -5 };
        expect(getEffectiveHitWeight(partComponent)).toBe(0);
      });

      it('should handle very small positive weights', () => {
        const partComponent = { hit_probability_weight: 0.001 };
        expect(getEffectiveHitWeight(partComponent)).toBe(0.001);
      });

      it('should handle large weights', () => {
        const partComponent = { hit_probability_weight: 100 };
        expect(getEffectiveHitWeight(partComponent)).toBe(100);
      });
    });

    describe('when hit_probability_weight is not set or invalid type', () => {
      it('should return default weight when property is missing', () => {
        const partComponent = { subType: 'torso' };
        expect(getEffectiveHitWeight(partComponent)).toBe(
          DEFAULT_HIT_PROBABILITY_WEIGHT
        );
      });

      it('should return default weight when property is undefined', () => {
        const partComponent = { hit_probability_weight: undefined };
        expect(getEffectiveHitWeight(partComponent)).toBe(
          DEFAULT_HIT_PROBABILITY_WEIGHT
        );
      });

      it('should return default weight when property is a string', () => {
        const partComponent = { hit_probability_weight: '5' };
        expect(getEffectiveHitWeight(partComponent)).toBe(
          DEFAULT_HIT_PROBABILITY_WEIGHT
        );
      });

      it('should return default weight when property is null', () => {
        const partComponent = { hit_probability_weight: null };
        expect(getEffectiveHitWeight(partComponent)).toBe(
          DEFAULT_HIT_PROBABILITY_WEIGHT
        );
      });

      it('should return default weight for empty object', () => {
        const partComponent = {};
        expect(getEffectiveHitWeight(partComponent)).toBe(
          DEFAULT_HIT_PROBABILITY_WEIGHT
        );
      });
    });
  });

  describe('filterEligibleHitTargets', () => {
    it('should return empty array for empty input', () => {
      expect(filterEligibleHitTargets([])).toEqual([]);
    });

    it('should filter out parts with weight 0 (internal organs)', () => {
      const parts = [
        { id: 'torso', component: { hit_probability_weight: 45 } },
        { id: 'heart', component: { hit_probability_weight: 0 } },
        { id: 'head', component: { hit_probability_weight: 18 } },
      ];

      const result = filterEligibleHitTargets(parts);

      expect(result).toEqual([
        { id: 'torso', weight: 45 },
        { id: 'head', weight: 18 },
      ]);
    });

    it('should filter out parts with null component', () => {
      const parts = [
        { id: 'torso', component: { hit_probability_weight: 45 } },
        { id: 'missing', component: null },
        { id: 'head', component: { hit_probability_weight: 18 } },
      ];

      const result = filterEligibleHitTargets(parts);

      expect(result).toEqual([
        { id: 'torso', weight: 45 },
        { id: 'head', weight: 18 },
      ]);
    });

    it('should filter out parts with undefined component', () => {
      const parts = [
        { id: 'arm', component: { hit_probability_weight: 8 } },
        { id: 'phantom', component: undefined },
      ];

      const result = filterEligibleHitTargets(parts);

      expect(result).toEqual([{ id: 'arm', weight: 8 }]);
    });

    it('should apply default weight for parts without explicit weight', () => {
      const parts = [
        { id: 'torso', component: { hit_probability_weight: 45 } },
        { id: 'unknown', component: { subType: 'custom' } }, // No weight set
      ];

      const result = filterEligibleHitTargets(parts);

      expect(result).toEqual([
        { id: 'torso', weight: 45 },
        { id: 'unknown', weight: DEFAULT_HIT_PROBABILITY_WEIGHT },
      ]);
    });

    it('should filter out parts with negative weights', () => {
      const parts = [
        { id: 'torso', component: { hit_probability_weight: 45 } },
        { id: 'broken', component: { hit_probability_weight: -10 } },
      ];

      const result = filterEligibleHitTargets(parts);

      expect(result).toEqual([{ id: 'torso', weight: 45 }]);
    });

    it('should handle mixed valid and invalid parts', () => {
      const parts = [
        { id: 'torso', component: { hit_probability_weight: 45 } },
        { id: 'heart', component: { hit_probability_weight: 0 } },
        { id: 'brain', component: { hit_probability_weight: 0 } },
        { id: 'head', component: { hit_probability_weight: 18 } },
        { id: 'missing', component: null },
        { id: 'arm', component: { subType: 'arm' } }, // defaults to 1.0
        { id: 'equipment_mount', component: { hit_probability_weight: 0 } },
      ];

      const result = filterEligibleHitTargets(parts);

      expect(result).toEqual([
        { id: 'torso', weight: 45 },
        { id: 'head', weight: 18 },
        { id: 'arm', weight: 1.0 },
      ]);
    });

    it('should preserve order of eligible parts', () => {
      const parts = [
        { id: 'foot', component: { hit_probability_weight: 3 } },
        { id: 'torso', component: { hit_probability_weight: 45 } },
        { id: 'head', component: { hit_probability_weight: 18 } },
      ];

      const result = filterEligibleHitTargets(parts);

      expect(result.map((p) => p.id)).toEqual(['foot', 'torso', 'head']);
    });

    it('should return empty array when all parts are ineligible', () => {
      const parts = [
        { id: 'heart', component: { hit_probability_weight: 0 } },
        { id: 'brain', component: { hit_probability_weight: 0 } },
        { id: 'spine', component: { hit_probability_weight: 0 } },
        { id: 'missing', component: null },
      ];

      const result = filterEligibleHitTargets(parts);

      expect(result).toEqual([]);
    });
  });
});
