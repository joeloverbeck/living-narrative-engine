/**
 * @file Integration tests for hit probability weight distribution
 * @description Verifies that weighted random selection produces expected distribution
 * @see src/anatomy/utils/hitProbabilityWeightUtils.js
 */

import { describe, it, expect } from '@jest/globals';
import {
  filterEligibleHitTargets,
  getEffectiveHitWeight,
} from '../../../src/anatomy/utils/hitProbabilityWeightUtils.js';

/**
 * Simulates weighted random selection matching the logic in resolveHitLocationHandler.
 * @param {Array<{id: string, weight: number}>} candidateParts
 * @returns {string} Selected part ID
 */
function selectWeightedRandom(candidateParts) {
  if (candidateParts.length === 0) return null;

  const totalWeight = candidateParts.reduce((sum, p) => sum + p.weight, 0);
  if (totalWeight <= 0) return candidateParts[0].id;

  let randomValue = Math.random() * totalWeight;
  for (const part of candidateParts) {
    randomValue -= part.weight;
    if (randomValue <= 0) return part.id;
  }
  return candidateParts[candidateParts.length - 1].id;
}

describe('Hit Probability Weight Distribution', () => {
  describe('filterEligibleHitTargets', () => {
    it('should exclude internal organs (weight=0) from hit selection', () => {
      const parts = [
        {
          id: 'torso',
          component: { subType: 'torso', hit_probability_weight: 45 },
        },
        {
          id: 'heart',
          component: { subType: 'heart', hit_probability_weight: 0 },
        },
        {
          id: 'brain',
          component: { subType: 'brain', hit_probability_weight: 0 },
        },
        {
          id: 'head',
          component: { subType: 'head', hit_probability_weight: 18 },
        },
      ];

      const eligible = filterEligibleHitTargets(parts);

      expect(eligible).toHaveLength(2);
      expect(eligible.find((p) => p.id === 'heart')).toBeUndefined();
      expect(eligible.find((p) => p.id === 'brain')).toBeUndefined();
    });
  });

  describe('Weighted random distribution', () => {
    // Simulate a humanoid body with realistic weights
    const HUMANOID_PARTS = [
      { id: 'torso', component: { hit_probability_weight: 45 } },
      { id: 'head', component: { hit_probability_weight: 18 } },
      { id: 'left_arm', component: { hit_probability_weight: 8 } },
      { id: 'right_arm', component: { hit_probability_weight: 8 } },
      { id: 'left_leg', component: { hit_probability_weight: 10 } },
      { id: 'right_leg', component: { hit_probability_weight: 10 } },
      { id: 'left_hand', component: { hit_probability_weight: 3 } },
      { id: 'right_hand', component: { hit_probability_weight: 3 } },
      { id: 'left_foot', component: { hit_probability_weight: 3 } },
      { id: 'right_foot', component: { hit_probability_weight: 3 } },
      { id: 'heart', component: { hit_probability_weight: 0 } }, // internal
      { id: 'brain', component: { hit_probability_weight: 0 } }, // internal
      { id: 'spine', component: { hit_probability_weight: 0 } }, // internal
      { id: 'left_eye', component: { hit_probability_weight: 0.5 } },
      { id: 'right_eye', component: { hit_probability_weight: 0.5 } },
      { id: 'hair', component: { hit_probability_weight: 0.25 } },
    ];

    const TOTAL_ELIGIBLE_WEIGHT = HUMANOID_PARTS.reduce(
      (sum, p) => sum + getEffectiveHitWeight(p.component),
      0
    );

    it('should never select internal organs', () => {
      const eligible = filterEligibleHitTargets(HUMANOID_PARTS);
      const iterations = 1000;
      const results = { heart: 0, brain: 0, spine: 0 };

      for (let i = 0; i < iterations; i++) {
        const selected = selectWeightedRandom(eligible);
        if (results[selected] !== undefined) {
          results[selected]++;
        }
      }

      // Internal organs should never be selected (they're filtered out)
      expect(results.heart).toBe(0);
      expect(results.brain).toBe(0);
      expect(results.spine).toBe(0);
    });

    it('should select torso approximately 35-45% of the time', () => {
      const eligible = filterEligibleHitTargets(HUMANOID_PARTS);
      const iterations = 5000;
      let torsoCount = 0;

      for (let i = 0; i < iterations; i++) {
        const selected = selectWeightedRandom(eligible);
        if (selected === 'torso') torsoCount++;
      }

      const percentage = (torsoCount / iterations) * 100;

      // Expected: 45 / 112.25 ≈ 40.1%
      // Allow margin for random variance (±7%)
      expect(percentage).toBeGreaterThan(33);
      expect(percentage).toBeLessThan(47);
    });

    it('should select head more often than individual limbs', () => {
      const eligible = filterEligibleHitTargets(HUMANOID_PARTS);
      const iterations = 5000;
      const results = {
        head: 0,
        left_arm: 0,
        right_arm: 0,
        left_leg: 0,
        right_leg: 0,
      };

      for (let i = 0; i < iterations; i++) {
        const selected = selectWeightedRandom(eligible);
        if (results[selected] !== undefined) {
          results[selected]++;
        }
      }

      // Head (weight 18) should be hit more than arms (weight 8)
      expect(results.head).toBeGreaterThan(results.left_arm);
      expect(results.head).toBeGreaterThan(results.right_arm);
    });

    it('should rarely select tiny parts like eyes and hair', () => {
      const eligible = filterEligibleHitTargets(HUMANOID_PARTS);
      const iterations = 5000;
      const results = {
        left_eye: 0,
        right_eye: 0,
        hair: 0,
        torso: 0,
      };

      for (let i = 0; i < iterations; i++) {
        const selected = selectWeightedRandom(eligible);
        if (results[selected] !== undefined) {
          results[selected]++;
        }
      }

      // Eyes (0.5 each) and hair (0.25) should be very rare
      const eyeTotal = results.left_eye + results.right_eye;
      const eyePercentage = (eyeTotal / iterations) * 100;
      const hairPercentage = (results.hair / iterations) * 100;

      // Eyes combined: ~0.9% of total weight
      // Hair: ~0.2% of total weight
      expect(eyePercentage).toBeLessThan(3);
      expect(hairPercentage).toBeLessThan(1.5);

      // Torso should be hit much more often than all tiny parts combined
      expect(results.torso).toBeGreaterThan(eyeTotal + results.hair);
    });

    it('should produce approximately expected distribution for all major parts', () => {
      const eligible = filterEligibleHitTargets(HUMANOID_PARTS);
      const iterations = 10000;
      const results = {};

      for (let i = 0; i < iterations; i++) {
        const selected = selectWeightedRandom(eligible);
        results[selected] = (results[selected] || 0) + 1;
      }

      // Calculate expected percentages based on weights
      const eligibleTotal = eligible.reduce((sum, p) => sum + p.weight, 0);

      for (const { id, weight } of eligible) {
        const expectedPercentage = (weight / eligibleTotal) * 100;
        const actualPercentage = ((results[id] || 0) / iterations) * 100;

        // Allow ±3% variance for statistical noise
        expect(actualPercentage).toBeGreaterThanOrEqual(
          Math.max(0, expectedPercentage - 3)
        );
        expect(actualPercentage).toBeLessThanOrEqual(expectedPercentage + 3);
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle a single eligible part', () => {
      const parts = [
        {
          id: 'only_part',
          component: { subType: 'torso', hit_probability_weight: 45 },
        },
        {
          id: 'organ',
          component: { subType: 'heart', hit_probability_weight: 0 },
        },
      ];

      const eligible = filterEligibleHitTargets(parts);
      expect(eligible).toHaveLength(1);

      const selected = selectWeightedRandom(eligible);
      expect(selected).toBe('only_part');
    });

    it('should handle parts without explicit weight (defaults to 1.0)', () => {
      const parts = [
        { id: 'no_weight', component: { subType: 'custom' } },
        { id: 'has_weight', component: { hit_probability_weight: 10 } },
      ];

      const eligible = filterEligibleHitTargets(parts);

      expect(eligible).toContainEqual({ id: 'no_weight', weight: 1.0 });
      expect(eligible).toContainEqual({ id: 'has_weight', weight: 10 });
    });

    it('should return empty array when all parts are ineligible', () => {
      const parts = [
        {
          id: 'heart',
          component: { subType: 'heart', hit_probability_weight: 0 },
        },
        {
          id: 'brain',
          component: { subType: 'brain', hit_probability_weight: 0 },
        },
      ];

      const eligible = filterEligibleHitTargets(parts);
      expect(eligible).toHaveLength(0);
    });
  });
});
