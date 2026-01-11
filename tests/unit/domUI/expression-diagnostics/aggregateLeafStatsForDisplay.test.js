/**
 * @file Unit tests for aggregateLeafStatsForDisplay logic
 *
 * These tests verify that the "most tunable" clause selection uses impact-weighted
 * scoring (nearMissRate × lastMileFailRate) to match the report's algorithm.
 *
 * Bug reproduction: Non-report UI was selecting based on highest near-miss rate only,
 * while the report correctly weighs by last-mile impact.
 *
 * Since #aggregateLeafStatsForDisplay is a private method, we test the pure algorithm
 * logic directly using an extracted version of the algorithm.
 */

import { describe, it, expect } from '@jest/globals';

/**
 * This is the FIXED algorithm that should be used in both:
 * - ExpressionDiagnosticsController#aggregateLeafStatsForDisplay
 * - MonteCarloReportGenerator#findMostTunableLeaf
 *
 * It uses impact-weighted scoring: impactScore = nearMissRate × lastMileRate
 *
 * @param {Array} leaves - Array of leaf nodes from the hierarchical breakdown
 * @returns {object} Aggregated stats including tunableRate, tunableDescription, tunableImpact
 */
function aggregateLeafStatsForDisplay(leaves) {
  let worstViolation = 0;
  let worstDescription = '';
  let tunableRate = null;
  let tunableDescription = '';
  let tunableEpsilon = 0;
  let tunableImpact = null;

  for (const leaf of leaves) {
    const avgViol = leaf.averageViolation ?? 0;
    const nearMissRate = leaf.nearMissRate;

    // Track worst violator
    if (avgViol > worstViolation) {
      worstViolation = avgViol;
      worstDescription = leaf.description ?? 'Unknown condition';
    }

    // Track most tunable (weighted by last-mile impact - consistent with report)
    if (typeof nearMissRate === 'number' && nearMissRate > 0) {
      // Weight tunability by last-mile impact (consistent with MonteCarloReportGenerator)
      const lastMileRate =
        leaf.siblingConditionedFailRate ??
        leaf.lastMileFailRate ??
        leaf.failureRate ??
        0;
      const impactScore = nearMissRate * lastMileRate;

      if (tunableImpact === null || impactScore > tunableImpact) {
        tunableRate = nearMissRate;
        tunableDescription = leaf.description ?? 'Unknown condition';
        tunableEpsilon = leaf.nearMissEpsilon ?? 0;
        tunableImpact = impactScore;
      }
    }
  }

  return {
    worstViolation,
    worstDescription,
    tunableRate,
    tunableDescription,
    tunableEpsilon,
    tunableImpact,
  };
}

/**
 * This is the BUGGY algorithm (original behavior) that selects
 * based on highest near-miss rate only, ignoring last-mile impact.
 */
function aggregateLeafStatsForDisplayBuggy(leaves) {
  let worstViolation = 0;
  let worstDescription = '';
  let tunableRate = null;
  let tunableDescription = '';
  let tunableEpsilon = 0;

  for (const leaf of leaves) {
    const avgViol = leaf.averageViolation ?? 0;
    const nearMissRate = leaf.nearMissRate;

    // Track worst violator
    if (avgViol > worstViolation) {
      worstViolation = avgViol;
      worstDescription = leaf.description ?? 'Unknown condition';
    }

    // BUG: Selects based on highest near-miss rate only
    if (typeof nearMissRate === 'number' && nearMissRate > 0) {
      if (tunableRate === null || nearMissRate > tunableRate) {
        tunableRate = nearMissRate;
        tunableDescription = leaf.description ?? 'Unknown condition';
        tunableEpsilon = leaf.nearMissEpsilon ?? 0;
      }
    }
  }

  return {
    worstViolation,
    worstDescription,
    tunableRate,
    tunableDescription,
    tunableEpsilon,
  };
}

describe('aggregateLeafStatsForDisplay algorithm', () => {
  /**
   * Creates a mock leaf node for testing.
   */
  const createMockLeaf = (overrides = {}) => ({
    nodeType: 'leaf',
    isCompound: false,
    description: 'test condition',
    averageViolation: 0.1,
    nearMissRate: 0,
    nearMissEpsilon: 0.05,
    siblingConditionedFailRate: null,
    lastMileFailRate: 0,
    failureRate: 0.5,
    ...overrides,
  });

  describe('Bug reproduction: hurt_anger scenario', () => {
    // This is the bug scenario from hurt_anger expression:
    // - emotions.disgust <= 0.4: 5.30% near-miss, 0% last-mile (low impact)
    // - emotions.anger >= 0.4: 3.50% near-miss, 100% last-mile (high impact)

    const lowImpactHighNearMiss = {
      nodeType: 'leaf',
      isCompound: false,
      description: 'emotions.disgust <= 0.4',
      averageViolation: 0.12,
      nearMissRate: 0.053, // 5.30%
      nearMissEpsilon: 0.05,
      siblingConditionedFailRate: 0, // Never the bottleneck
      lastMileFailRate: 0,
      failureRate: 0.0848,
    };

    const highImpactLowNearMiss = {
      nodeType: 'leaf',
      isCompound: false,
      description: 'emotions.anger >= 0.4',
      averageViolation: 0.37,
      nearMissRate: 0.035, // 3.50%
      nearMissEpsilon: 0.05,
      siblingConditionedFailRate: 1.0, // 100% last-mile failure
      lastMileFailRate: 1.0,
      failureRate: 0.9352,
    };

    const leaves = [lowImpactHighNearMiss, highImpactLowNearMiss];

    it('BUGGY algorithm selects emotions.disgust (higher near-miss rate)', () => {
      const result = aggregateLeafStatsForDisplayBuggy(leaves);

      // Buggy behavior: selects emotions.disgust because 5.30% > 3.50%
      expect(result.tunableDescription).toBe('emotions.disgust <= 0.4');
      expect(result.tunableRate).toBe(0.053);
    });

    it('FIXED algorithm selects emotions.anger (higher impact score)', () => {
      const result = aggregateLeafStatsForDisplay(leaves);

      // Fixed behavior: selects emotions.anger because impact is higher
      // emotions.disgust impact: 0.053 * 0 = 0
      // emotions.anger impact: 0.035 * 1.0 = 0.035
      expect(result.tunableDescription).toBe('emotions.anger >= 0.4');
      expect(result.tunableRate).toBe(0.035);
      expect(result.tunableImpact).toBe(0.035);
    });
  });

  describe('Impact-weighted tunability selection', () => {
    it('should select leaf with higher impact score over leaf with higher near-miss rate', () => {
      const leaves = [
        createMockLeaf({
          description: 'high near-miss, low impact',
          nearMissRate: 0.1,
          siblingConditionedFailRate: 0.1,
        }),
        createMockLeaf({
          description: 'low near-miss, high impact',
          nearMissRate: 0.05,
          siblingConditionedFailRate: 0.9,
        }),
      ];

      const result = aggregateLeafStatsForDisplay(leaves);

      // leaf1 impact: 0.1 * 0.1 = 0.01
      // leaf2 impact: 0.05 * 0.9 = 0.045
      expect(result.tunableDescription).toBe('low near-miss, high impact');
      expect(result.tunableImpact).toBeCloseTo(0.045, 10);
    });

    it('should fall back to failureRate when last-mile rates are null', () => {
      const leaves = [
        createMockLeaf({
          description: 'condition with failureRate fallback',
          nearMissRate: 0.04,
          siblingConditionedFailRate: null,
          lastMileFailRate: null,
          failureRate: 0.8,
        }),
        createMockLeaf({
          description: 'condition with low failureRate',
          nearMissRate: 0.06,
          siblingConditionedFailRate: null,
          lastMileFailRate: null,
          failureRate: 0.1,
        }),
      ];

      const result = aggregateLeafStatsForDisplay(leaves);

      // leaf1 impact: 0.04 * 0.8 = 0.032
      // leaf2 impact: 0.06 * 0.1 = 0.006
      expect(result.tunableDescription).toBe(
        'condition with failureRate fallback'
      );
      expect(result.tunableImpact).toBe(0.032);
    });

    it('should use lastMileFailRate over failureRate when available', () => {
      const leaves = [
        createMockLeaf({
          description: 'uses lastMileFailRate',
          nearMissRate: 0.05,
          siblingConditionedFailRate: null,
          lastMileFailRate: 0.9,
          failureRate: 0.1, // Should be ignored
        }),
      ];

      const result = aggregateLeafStatsForDisplay(leaves);

      expect(result.tunableImpact).toBe(0.05 * 0.9); // 0.045
    });

    it('should prefer siblingConditionedFailRate over lastMileFailRate', () => {
      const leaves = [
        createMockLeaf({
          description: 'uses siblingConditionedFailRate',
          nearMissRate: 0.05,
          siblingConditionedFailRate: 0.8,
          lastMileFailRate: 0.5, // Should be ignored
          failureRate: 0.1, // Should be ignored
        }),
      ];

      const result = aggregateLeafStatsForDisplay(leaves);

      expect(result.tunableImpact).toBe(0.05 * 0.8); // 0.04
    });
  });

  describe('Edge cases', () => {
    it('should return null tunableRate when no leaves have near-miss data', () => {
      const leaves = [
        createMockLeaf({ description: 'A', nearMissRate: 0 }),
        createMockLeaf({ description: 'B', nearMissRate: null }),
      ];

      const result = aggregateLeafStatsForDisplay(leaves);

      expect(result.tunableRate).toBeNull();
      expect(result.tunableDescription).toBe('');
      expect(result.tunableImpact).toBeNull();
    });

    it('should handle empty leaves array', () => {
      const result = aggregateLeafStatsForDisplay([]);

      expect(result.worstViolation).toBe(0);
      expect(result.worstDescription).toBe('');
      expect(result.tunableRate).toBeNull();
      expect(result.tunableImpact).toBeNull();
    });

    it('should correctly track worst violation separately from tunability', () => {
      const leaves = [
        createMockLeaf({
          description: 'large violation, no near-miss',
          averageViolation: 0.9,
          nearMissRate: 0,
        }),
        createMockLeaf({
          description: 'small violation, has near-miss',
          averageViolation: 0.1,
          nearMissRate: 0.05,
          siblingConditionedFailRate: 0.8,
        }),
      ];

      const result = aggregateLeafStatsForDisplay(leaves);

      expect(result.worstViolation).toBe(0.9);
      expect(result.worstDescription).toBe('large violation, no near-miss');
      expect(result.tunableDescription).toBe('small violation, has near-miss');
    });

    it('should handle all last-mile rates being zero', () => {
      const leaves = [
        createMockLeaf({
          description: 'A',
          nearMissRate: 0.05,
          siblingConditionedFailRate: 0,
          lastMileFailRate: 0,
          failureRate: 0,
        }),
        createMockLeaf({
          description: 'B',
          nearMissRate: 0.08,
          siblingConditionedFailRate: 0,
          lastMileFailRate: 0,
          failureRate: 0,
        }),
      ];

      const result = aggregateLeafStatsForDisplay(leaves);

      // When all impact scores are 0, the first one encountered wins
      expect(result.tunableRate).toBe(0.05);
      expect(result.tunableDescription).toBe('A');
      expect(result.tunableImpact).toBe(0);
    });
  });

  describe('Return value structure', () => {
    it('should include all required fields in return value', () => {
      const leaves = [
        createMockLeaf({
          description: 'test',
          nearMissRate: 0.05,
          nearMissEpsilon: 0.025,
          siblingConditionedFailRate: 0.8,
          averageViolation: 0.3,
        }),
      ];

      const result = aggregateLeafStatsForDisplay(leaves);

      expect(result).toHaveProperty('worstViolation');
      expect(result).toHaveProperty('worstDescription');
      expect(result).toHaveProperty('tunableRate');
      expect(result).toHaveProperty('tunableDescription');
      expect(result).toHaveProperty('tunableEpsilon');
      expect(result).toHaveProperty('tunableImpact');
    });

    it('should preserve epsilon from the selected tunable leaf', () => {
      const leaves = [
        createMockLeaf({
          description: 'test',
          nearMissRate: 0.05,
          nearMissEpsilon: 0.025,
          siblingConditionedFailRate: 0.8,
        }),
      ];

      const result = aggregateLeafStatsForDisplay(leaves);

      expect(result.tunableEpsilon).toBe(0.025);
    });
  });
});
