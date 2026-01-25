/**
 * @file Unit tests for AxisPolarityAnalyzer
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { AxisPolarityAnalyzer } from '../../../../../src/expressionDiagnostics/services/axisGap/AxisPolarityAnalyzer.js';

describe('AxisPolarityAnalyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new AxisPolarityAnalyzer();
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      expect(analyzer).toBeDefined();
    });

    it('should accept custom config', () => {
      const customAnalyzer = new AxisPolarityAnalyzer({
        imbalanceThreshold: 0.9,
        minUsageCount: 5,
        activeWeightEpsilon: 0.01,
      });
      expect(customAnalyzer).toBeDefined();
    });
  });

  describe('analyze - empty/invalid inputs', () => {
    it('should return empty result for null prototypes', () => {
      const result = analyzer.analyze(null);

      expect(result.polarityByAxis.size).toBe(0);
      expect(result.imbalancedAxes).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.totalAxesAnalyzed).toBe(0);
      expect(result.imbalancedCount).toBe(0);
    });

    it('should return empty result for undefined prototypes', () => {
      const result = analyzer.analyze(undefined);

      expect(result.polarityByAxis.size).toBe(0);
      expect(result.imbalancedAxes).toEqual([]);
    });

    it('should return empty result for empty array', () => {
      const result = analyzer.analyze([]);

      expect(result.totalAxesAnalyzed).toBe(0);
    });

    it('should handle prototypes without weights', () => {
      const prototypes = [{ id: 'p1' }, { id: 'p2', weights: null }];

      const result = analyzer.analyze(prototypes);

      expect(result.totalAxesAnalyzed).toBe(0);
    });

    it('should handle prototypes with empty weights', () => {
      const prototypes = [
        { id: 'p1', weights: {} },
        { id: 'p2', weights: {} },
      ];

      const result = analyzer.analyze(prototypes);

      expect(result.totalAxesAnalyzed).toBe(0);
    });
  });

  describe('analyze - polarity counting', () => {
    it('should count positive weights correctly', () => {
      const prototypes = [
        { id: 'p1', weights: { valence: 0.5 } },
        { id: 'p2', weights: { valence: 0.8 } },
        { id: 'p3', weights: { valence: 0.3 } },
      ];

      const result = analyzer.analyze(prototypes);

      const stats = result.polarityByAxis.get('valence');
      expect(stats.positive).toBe(3);
      expect(stats.negative).toBe(0);
      expect(stats.zero).toBe(0);
    });

    it('should count negative weights correctly', () => {
      const prototypes = [
        { id: 'p1', weights: { arousal: -0.5 } },
        { id: 'p2', weights: { arousal: -0.8 } },
        { id: 'p3', weights: { arousal: -0.3 } },
      ];

      const result = analyzer.analyze(prototypes);

      const stats = result.polarityByAxis.get('arousal');
      expect(stats.positive).toBe(0);
      expect(stats.negative).toBe(3);
    });

    it('should count mixed polarities correctly', () => {
      const prototypes = [
        { id: 'p1', weights: { dominance: 0.5 } },
        { id: 'p2', weights: { dominance: -0.5 } },
        { id: 'p3', weights: { dominance: 0.8 } },
        { id: 'p4', weights: { dominance: -0.3 } },
      ];

      const result = analyzer.analyze(prototypes);

      const stats = result.polarityByAxis.get('dominance');
      expect(stats.positive).toBe(2);
      expect(stats.negative).toBe(2);
      expect(stats.total).toBe(4);
    });

    it('should count zero/near-zero weights correctly', () => {
      const prototypes = [
        { id: 'p1', weights: { intensity: 0 } },
        { id: 'p2', weights: { intensity: 0.0001 } }, // Below default epsilon
        { id: 'p3', weights: { intensity: 0.5 } },
      ];

      const result = analyzer.analyze(prototypes);

      const stats = result.polarityByAxis.get('intensity');
      expect(stats.zero).toBe(2); // 0 and 0.0001 are both near-zero
      expect(stats.positive).toBe(1);
    });

    it('should handle custom activeWeightEpsilon', () => {
      const customAnalyzer = new AxisPolarityAnalyzer({
        activeWeightEpsilon: 0.1,
      });

      const prototypes = [
        { id: 'p1', weights: { valence: 0.05 } }, // Below 0.1, treated as zero
        { id: 'p2', weights: { valence: 0.15 } }, // Above 0.1, treated as positive
        { id: 'p3', weights: { valence: -0.08 } }, // Below 0.1, treated as zero
      ];

      const result = customAnalyzer.analyze(prototypes);

      const stats = result.polarityByAxis.get('valence');
      expect(stats.zero).toBe(2);
      expect(stats.positive).toBe(1);
    });
  });

  describe('analyze - imbalance detection', () => {
    it('should detect heavily positive-biased axis', () => {
      const prototypes = [
        { id: 'p1', weights: { valence: 0.5 } },
        { id: 'p2', weights: { valence: 0.8 } },
        { id: 'p3', weights: { valence: 0.3 } },
        { id: 'p4', weights: { valence: 0.9 } },
      ];

      const result = analyzer.analyze(prototypes);

      expect(result.imbalancedCount).toBe(1);
      expect(result.imbalancedAxes[0].axis).toBe('valence');
      expect(result.imbalancedAxes[0].direction).toBe('positive');
      expect(result.imbalancedAxes[0].ratio).toBe(1.0);
    });

    it('should detect heavily negative-biased axis', () => {
      const prototypes = [
        { id: 'p1', weights: { arousal: -0.5 } },
        { id: 'p2', weights: { arousal: -0.8 } },
        { id: 'p3', weights: { arousal: -0.3 } },
        { id: 'p4', weights: { arousal: -0.9 } },
      ];

      const result = analyzer.analyze(prototypes);

      expect(result.imbalancedCount).toBe(1);
      expect(result.imbalancedAxes[0].axis).toBe('arousal');
      expect(result.imbalancedAxes[0].direction).toBe('negative');
    });

    it('should not flag balanced axes', () => {
      const prototypes = [
        { id: 'p1', weights: { dominance: 0.5 } },
        { id: 'p2', weights: { dominance: -0.5 } },
        { id: 'p3', weights: { dominance: 0.3 } },
        { id: 'p4', weights: { dominance: -0.3 } },
      ];

      const result = analyzer.analyze(prototypes);

      // 50/50 split is perfectly balanced
      expect(result.imbalancedCount).toBe(0);
      const stats = result.polarityByAxis.get('dominance');
      expect(stats.ratio).toBe(0.5);
      expect(stats.dominantDirection).toBe('balanced');
    });

    it('should respect custom imbalanceThreshold', () => {
      // With default threshold of 0.75, 3:1 (75%) is at the boundary
      const prototypes = [
        { id: 'p1', weights: { test: 0.5 } },
        { id: 'p2', weights: { test: 0.5 } },
        { id: 'p3', weights: { test: 0.5 } },
        { id: 'p4', weights: { test: -0.5 } },
      ];

      // Default should flag it
      const result = analyzer.analyze(prototypes);
      expect(result.imbalancedCount).toBe(1);

      // Higher threshold should not flag it
      const strictAnalyzer = new AxisPolarityAnalyzer({
        imbalanceThreshold: 0.8,
      });
      const strictResult = strictAnalyzer.analyze(prototypes);
      expect(strictResult.imbalancedCount).toBe(0);
    });

    it('should skip axes with insufficient usage', () => {
      // Only 2 prototypes use this axis, below default minUsageCount of 3
      const prototypes = [
        { id: 'p1', weights: { rare: 0.5 } },
        { id: 'p2', weights: { rare: 0.8 } },
      ];

      const result = analyzer.analyze(prototypes);

      const stats = result.polarityByAxis.get('rare');
      expect(stats.total).toBe(2);
      // Should not be flagged as imbalanced due to insufficient data
      expect(result.imbalancedCount).toBe(0);
    });

    it('should respect custom minUsageCount', () => {
      const prototypes = [
        { id: 'p1', weights: { test: 0.5 } },
        { id: 'p2', weights: { test: 0.8 } },
      ];

      const lowThresholdAnalyzer = new AxisPolarityAnalyzer({
        minUsageCount: 2,
      });
      const result = lowThresholdAnalyzer.analyze(prototypes);

      // Now should be flagged with minUsageCount of 2
      expect(result.imbalancedCount).toBe(1);
    });
  });

  describe('analyze - warnings', () => {
    it('should generate warning for imbalanced axes', () => {
      const prototypes = [
        { id: 'p1', weights: { valence: 0.5 } },
        { id: 'p2', weights: { valence: 0.8 } },
        { id: 'p3', weights: { valence: 0.3 } },
        { id: 'p4', weights: { valence: 0.9 } },
      ];

      const result = analyzer.analyze(prototypes);

      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0]).toContain('valence');
      expect(result.warnings[0]).toContain('positive');
      expect(result.warnings[0]).toContain('negative');
    });

    it('should include counts in warning message', () => {
      const prototypes = [
        { id: 'p1', weights: { arousal: -0.5 } },
        { id: 'p2', weights: { arousal: -0.8 } },
        { id: 'p3', weights: { arousal: -0.3 } },
        { id: 'p4', weights: { arousal: 0.1 } }, // 1 positive
      ];

      const result = analyzer.analyze(prototypes);

      const warning = result.warnings[0];
      expect(warning).toContain('3 prototypes use negative');
      expect(warning).toContain('only 1 use positive');
    });
  });

  describe('analyze - multiple axes', () => {
    it('should analyze multiple axes independently', () => {
      const prototypes = [
        { id: 'p1', weights: { axis1: 0.5, axis2: -0.3 } },
        { id: 'p2', weights: { axis1: 0.8, axis2: -0.5 } },
        { id: 'p3', weights: { axis1: 0.3, axis2: -0.7 } },
        { id: 'p4', weights: { axis1: 0.9, axis2: -0.2 } },
      ];

      const result = analyzer.analyze(prototypes);

      // Both axes are imbalanced but in opposite directions
      expect(result.totalAxesAnalyzed).toBe(2);
      expect(result.imbalancedCount).toBe(2);

      const axis1Info = result.imbalancedAxes.find((a) => a.axis === 'axis1');
      const axis2Info = result.imbalancedAxes.find((a) => a.axis === 'axis2');

      expect(axis1Info.direction).toBe('positive');
      expect(axis2Info.direction).toBe('negative');
    });

    it('should sort imbalanced axes by severity', () => {
      const prototypes = [
        { id: 'p1', weights: { mild: 0.5, severe: 0.8 } },
        { id: 'p2', weights: { mild: 0.5, severe: 0.8 } },
        { id: 'p3', weights: { mild: 0.5, severe: 0.8 } },
        { id: 'p4', weights: { mild: -0.5, severe: 0.8 } }, // mild: 75% positive, severe: 100%
      ];

      const result = analyzer.analyze(prototypes);

      // Severe should be first (100% vs 75%)
      expect(result.imbalancedAxes[0].axis).toBe('severe');
      expect(result.imbalancedAxes[0].ratio).toBe(1.0);
    });
  });

  describe('analyze - edge cases', () => {
    it('should handle NaN weights', () => {
      const prototypes = [
        { id: 'p1', weights: { test: NaN } },
        { id: 'p2', weights: { test: 0.5 } },
        { id: 'p3', weights: { test: 0.8 } },
        { id: 'p4', weights: { test: 0.3 } },
      ];

      const result = analyzer.analyze(prototypes);

      // NaN should be skipped
      const stats = result.polarityByAxis.get('test');
      expect(stats.positive).toBe(3);
      expect(stats.total).toBe(3);
    });

    it('should handle Infinity weights', () => {
      const prototypes = [
        { id: 'p1', weights: { test: Infinity } },
        { id: 'p2', weights: { test: -Infinity } },
        { id: 'p3', weights: { test: 0.5 } },
      ];

      const result = analyzer.analyze(prototypes);

      // Infinity values should be skipped
      const stats = result.polarityByAxis.get('test');
      expect(stats.total).toBe(1);
    });

    it('should handle non-numeric weights', () => {
      const prototypes = [
        { id: 'p1', weights: { test: 'string' } },
        { id: 'p2', weights: { test: null } },
        { id: 'p3', weights: { test: 0.5 } },
      ];

      const result = analyzer.analyze(prototypes);

      const stats = result.polarityByAxis.get('test');
      expect(stats.positive).toBe(1);
      expect(stats.total).toBe(1);
    });
  });

  describe('result structure', () => {
    it('should return Map for polarityByAxis', () => {
      const prototypes = [{ id: 'p1', weights: { test: 0.5 } }];

      const result = analyzer.analyze(prototypes);

      expect(result.polarityByAxis).toBeInstanceOf(Map);
    });

    it('should include all expected fields in stats', () => {
      const prototypes = [
        { id: 'p1', weights: { test: 0.5 } },
        { id: 'p2', weights: { test: 0.5 } },
        { id: 'p3', weights: { test: 0.5 } },
      ];

      const result = analyzer.analyze(prototypes);
      const stats = result.polarityByAxis.get('test');

      expect(stats).toHaveProperty('positive');
      expect(stats).toHaveProperty('negative');
      expect(stats).toHaveProperty('zero');
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('ratio');
      expect(stats).toHaveProperty('dominantDirection');
    });

    it('should include all expected fields in imbalanced axis info', () => {
      const prototypes = [
        { id: 'p1', weights: { test: 0.5 } },
        { id: 'p2', weights: { test: 0.5 } },
        { id: 'p3', weights: { test: 0.5 } },
      ];

      const result = analyzer.analyze(prototypes);
      const info = result.imbalancedAxes[0];

      expect(info).toHaveProperty('axis');
      expect(info).toHaveProperty('direction');
      expect(info).toHaveProperty('ratio');
      expect(info).toHaveProperty('dominant');
      expect(info).toHaveProperty('minority');
    });
  });
});
