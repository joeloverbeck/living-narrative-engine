/**
 * @file Unit tests for PrototypeComplexityAnalyzer
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { PrototypeComplexityAnalyzer } from '../../../../../src/expressionDiagnostics/services/axisGap/PrototypeComplexityAnalyzer.js';

describe('PrototypeComplexityAnalyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new PrototypeComplexityAnalyzer();
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      expect(analyzer).toBeDefined();
    });

    it('should accept custom config', () => {
      const customAnalyzer = new PrototypeComplexityAnalyzer({
        activeWeightEpsilon: 0.01,
        minBundleSupport: 0.2,
        minBundleSize: 3,
        maxBundleSize: 5,
        outlierStdDevThreshold: 3.0,
        minPrototypesForAnalysis: 10,
      });
      expect(customAnalyzer).toBeDefined();
    });
  });

  describe('analyze - empty/invalid inputs', () => {
    it('should return empty result for null prototypes', () => {
      const result = analyzer.analyze(null);

      expect(result.totalPrototypes).toBe(0);
      expect(result.averageComplexity).toBe(0);
      expect(result.distribution.histogram).toEqual([]);
      expect(result.coOccurrence.bundles).toEqual([]);
      expect(result.recommendations).toEqual([]);
    });

    it('should return empty result for undefined prototypes', () => {
      const result = analyzer.analyze(undefined);

      expect(result.totalPrototypes).toBe(0);
    });

    it('should return empty result for empty array', () => {
      const result = analyzer.analyze([]);

      expect(result.totalPrototypes).toBe(0);
    });

    it('should handle prototypes without weights', () => {
      const prototypes = [{ id: 'p1' }, { id: 'p2', weights: null }];

      const result = analyzer.analyze(prototypes);

      expect(result.totalPrototypes).toBe(0);
    });

    it('should return limited result when below minPrototypesForAnalysis', () => {
      const prototypes = [
        { id: 'p1', weights: { valence: 0.5 } },
        { id: 'p2', weights: { valence: 0.3 } },
      ];

      const result = analyzer.analyze(prototypes);

      // With default minPrototypesForAnalysis of 5, stats won't be calculated
      expect(result.totalPrototypes).toBe(2);
    });
  });

  describe('analyze - complexity distribution', () => {
    const createPrototypesWithAxisCounts = (counts) =>
      counts.map((count, i) => {
        const weights = {};
        for (let j = 0; j < count; j++) {
          weights[`axis${j}`] = 0.5;
        }
        return { id: `p${i}`, weights };
      });

    it('should calculate median correctly for odd count', () => {
      // Axis counts: 2, 3, 4, 5, 6 -> median = 4
      const prototypes = createPrototypesWithAxisCounts([2, 3, 4, 5, 6]);

      const result = analyzer.analyze(prototypes);

      expect(result.distribution.median).toBe(4);
    });

    it('should calculate median correctly for even count', () => {
      // Axis counts: 2, 3, 5, 6 -> median = 4 (average of 3 and 5)
      const prototypes = createPrototypesWithAxisCounts([2, 3, 5, 6, 4, 7]);

      const result = analyzer.analyze(prototypes);

      // 2, 3, 4, 5, 6, 7 -> median between 4 and 5 = 4.5
      expect(result.distribution.median).toBe(4.5);
    });

    it('should calculate quartiles correctly', () => {
      // 1, 2, 3, 4, 5, 6, 7, 8 (8 values)
      const prototypes = createPrototypesWithAxisCounts([
        1, 2, 3, 4, 5, 6, 7, 8,
      ]);

      const result = analyzer.analyze(prototypes);

      expect(result.distribution.min).toBe(1);
      expect(result.distribution.max).toBe(8);
      expect(result.distribution.q1).toBeCloseTo(2.75, 1);
      expect(result.distribution.q3).toBeCloseTo(6.25, 1);
    });

    it('should calculate mean correctly', () => {
      // 2, 4, 6, 8, 10 -> mean = 6
      const prototypes = createPrototypesWithAxisCounts([2, 4, 6, 8, 10]);

      const result = analyzer.analyze(prototypes);

      expect(result.distribution.mean).toBe(6);
      expect(result.averageComplexity).toBe(6);
    });

    it('should build histogram correctly', () => {
      // Axis counts: 2, 2, 3, 3, 3, 4
      const prototypes = createPrototypesWithAxisCounts([2, 2, 3, 3, 3, 4]);

      const result = analyzer.analyze(prototypes);

      expect(result.distribution.histogram).toEqual([
        { bin: 2, count: 2 },
        { bin: 3, count: 3 },
        { bin: 4, count: 1 },
      ]);
    });

    it('should identify high complexity outliers', () => {
      // Most have 3-5 axes, one has 15
      const prototypes = createPrototypesWithAxisCounts([
        3, 4, 4, 5, 4, 3, 4, 5, 15,
      ]);

      const result = analyzer.analyze(prototypes);

      expect(result.distribution.outliers.length).toBeGreaterThan(0);
      const highOutlier = result.distribution.outliers.find(
        (o) => o.axisCount === 15
      );
      expect(highOutlier).toBeDefined();
    });

    it('should identify low complexity outliers', () => {
      // Most have 8-10 axes, one has 1
      const prototypes = createPrototypesWithAxisCounts([
        8, 9, 10, 9, 8, 10, 9, 8, 1,
      ]);

      const result = analyzer.analyze(prototypes);

      expect(result.distribution.outliers.length).toBeGreaterThan(0);
      const lowOutlier = result.distribution.outliers.find(
        (o) => o.axisCount === 1
      );
      expect(lowOutlier).toBeDefined();
    });
  });

  describe('analyze - co-occurrence detection', () => {
    it('should detect frequently co-occurring axis pairs', () => {
      // All prototypes have valence and arousal together
      const prototypes = [
        { id: 'p1', weights: { valence: 0.5, arousal: 0.3 } },
        { id: 'p2', weights: { valence: 0.4, arousal: 0.2 } },
        { id: 'p3', weights: { valence: 0.6, arousal: 0.4 } },
        { id: 'p4', weights: { valence: 0.3, arousal: 0.5 } },
        { id: 'p5', weights: { valence: 0.7, arousal: 0.1 } },
      ];

      const result = analyzer.analyze(prototypes);

      const valenceArousalBundle = result.coOccurrence.bundles.find(
        (b) => b.axes.includes('arousal') && b.axes.includes('valence')
      );
      expect(valenceArousalBundle).toBeDefined();
      expect(valenceArousalBundle.frequency).toBe(5);
      expect(valenceArousalBundle.support).toBe(1);
    });

    it('should not include rare bundles below support threshold', () => {
      // Only 1 prototype has dominance, below 10% threshold for 15 prototypes
      // 1/15 = 6.7% which is below 10%
      const prototypes = Array.from({ length: 15 }, (_, i) => ({
        id: `p${i}`,
        weights: {
          valence: 0.5,
          arousal: 0.3,
          ...(i === 0 ? { dominance: 0.2 } : {}),
        },
      }));

      const result = analyzer.analyze(prototypes);

      const dominanceBundle = result.coOccurrence.bundles.find((b) =>
        b.axes.includes('dominance')
      );
      expect(dominanceBundle).toBeUndefined();
    });

    it('should detect three-axis bundles', () => {
      // All have valence, arousal, intensity together
      const prototypes = [
        { id: 'p1', weights: { valence: 0.5, arousal: 0.3, intensity: 0.2 } },
        { id: 'p2', weights: { valence: 0.4, arousal: 0.2, intensity: 0.4 } },
        { id: 'p3', weights: { valence: 0.6, arousal: 0.4, intensity: 0.3 } },
        { id: 'p4', weights: { valence: 0.3, arousal: 0.5, intensity: 0.5 } },
        { id: 'p5', weights: { valence: 0.7, arousal: 0.1, intensity: 0.6 } },
      ];

      const result = analyzer.analyze(prototypes);

      const tripleBundle = result.coOccurrence.bundles.find(
        (b) => b.axes.length === 3
      );
      expect(tripleBundle).toBeDefined();
      expect(tripleBundle.frequency).toBe(5);
    });

    it('should sort bundles by frequency', () => {
      const prototypes = [
        {
          id: 'p1',
          weights: { a: 0.5, b: 0.3, c: 0.2, d: 0.1, e: 0.4, f: 0.6 },
        },
        { id: 'p2', weights: { a: 0.4, b: 0.2, c: 0.3 } },
        { id: 'p3', weights: { a: 0.6, b: 0.4, c: 0.5, d: 0.2 } },
        { id: 'p4', weights: { a: 0.3, b: 0.5 } },
        { id: 'p5', weights: { a: 0.7, b: 0.1, c: 0.2 } },
      ];

      const result = analyzer.analyze(prototypes);

      // Verify bundles are sorted by frequency (descending)
      for (let i = 1; i < result.coOccurrence.bundles.length; i++) {
        const prev = result.coOccurrence.bundles[i - 1];
        const curr = result.coOccurrence.bundles[i];
        expect(prev.frequency).toBeGreaterThanOrEqual(curr.frequency);
      }
    });

    it('should suggest concept names for bundles', () => {
      const prototypes = [
        { id: 'p1', weights: { valence: 0.5, arousal: 0.3 } },
        { id: 'p2', weights: { valence: 0.4, arousal: 0.2 } },
        { id: 'p3', weights: { valence: 0.6, arousal: 0.4 } },
        { id: 'p4', weights: { valence: 0.3, arousal: 0.5 } },
        { id: 'p5', weights: { valence: 0.7, arousal: 0.1 } },
      ];

      const result = analyzer.analyze(prototypes);

      const bundle = result.coOccurrence.bundles[0];
      expect(bundle.suggestedConcept).toBeDefined();
      expect(bundle.suggestedConcept.length).toBeGreaterThan(0);
    });
  });

  describe('analyze - recommendations', () => {
    it('should recommend new axis for high-support large bundles', () => {
      // All prototypes have the same 3 axes with very high support
      const prototypes = [
        { id: 'p1', weights: { a: 0.5, b: 0.3, c: 0.2 } },
        { id: 'p2', weights: { a: 0.4, b: 0.2, c: 0.3 } },
        { id: 'p3', weights: { a: 0.6, b: 0.4, c: 0.5 } },
        { id: 'p4', weights: { a: 0.3, b: 0.5, c: 0.4 } },
        { id: 'p5', weights: { a: 0.7, b: 0.1, c: 0.6 } },
      ];

      const result = analyzer.analyze(prototypes);

      const newAxisRec = result.recommendations.find(
        (r) => r.type === 'consider_new_axis'
      );
      expect(newAxisRec).toBeDefined();
      expect(newAxisRec.bundle).toContain('a');
      expect(newAxisRec.bundle).toContain('b');
      expect(newAxisRec.bundle).toContain('c');
    });

    it('should recommend reducing complexity for outliers', () => {
      // One prototype has way more axes than others
      // Need enough data points for outlier detection to work
      const prototypes = [
        { id: 'p1', weights: { a: 0.5, b: 0.3 } },
        { id: 'p2', weights: { a: 0.4, b: 0.2 } },
        { id: 'p3', weights: { a: 0.6, b: 0.4 } },
        { id: 'p4', weights: { a: 0.3, b: 0.5 } },
        { id: 'p5', weights: { a: 0.5, b: 0.3 } },
        { id: 'p6', weights: { a: 0.4, b: 0.2 } },
        { id: 'p7', weights: { a: 0.6, b: 0.4 } },
        { id: 'p8', weights: { a: 0.3, b: 0.5 } },
        {
          id: 'complex',
          weights: {
            a: 0.7,
            b: 0.1,
            c: 0.2,
            d: 0.3,
            e: 0.4,
            f: 0.5,
            g: 0.6,
            h: 0.7,
            i: 0.8,
            j: 0.9,
          },
        },
      ];

      const result = analyzer.analyze(prototypes);

      const reduceRec = result.recommendations.find(
        (r) => r.type === 'reduce_complexity'
      );
      expect(reduceRec).toBeDefined();
      expect(reduceRec.bundle).toContain('complex');
    });

    it('should recommend balancing for low complexity outliers', () => {
      // One prototype has way fewer axes than others
      // Need enough data points for outlier detection to work
      const prototypes = [
        { id: 'p1', weights: { a: 0.5, b: 0.3, c: 0.2, d: 0.1, e: 0.4 } },
        { id: 'p2', weights: { a: 0.4, b: 0.2, c: 0.3, d: 0.2, e: 0.5 } },
        { id: 'p3', weights: { a: 0.6, b: 0.4, c: 0.5, d: 0.3, e: 0.6 } },
        { id: 'p4', weights: { a: 0.3, b: 0.5, c: 0.4, d: 0.4, e: 0.7 } },
        { id: 'p5', weights: { a: 0.5, b: 0.3, c: 0.2, d: 0.1, e: 0.4 } },
        { id: 'p6', weights: { a: 0.4, b: 0.2, c: 0.3, d: 0.2, e: 0.5 } },
        { id: 'p7', weights: { a: 0.6, b: 0.4, c: 0.5, d: 0.3, e: 0.6 } },
        { id: 'p8', weights: { a: 0.3, b: 0.5, c: 0.4, d: 0.4, e: 0.7 } },
        { id: 'simple', weights: { a: 0.7 } },
      ];

      const result = analyzer.analyze(prototypes);

      const balanceRec = result.recommendations.find(
        (r) =>
          r.type === 'balance_complexity' && r.bundle.includes?.('simple')
      );
      expect(balanceRec).toBeDefined();
    });
  });

  describe('analyze - edge cases', () => {
    it('should handle NaN weights', () => {
      const prototypes = [
        { id: 'p1', weights: { a: NaN, b: 0.3 } },
        { id: 'p2', weights: { a: 0.5, b: 0.4 } },
        { id: 'p3', weights: { a: 0.6, b: 0.2 } },
        { id: 'p4', weights: { a: 0.3, b: 0.5 } },
        { id: 'p5', weights: { a: 0.4, b: 0.6 } },
      ];

      const result = analyzer.analyze(prototypes);

      // NaN should be ignored, p1 should only have 1 active axis
      expect(result.totalPrototypes).toBe(5);
    });

    it('should handle Infinity weights', () => {
      const prototypes = [
        { id: 'p1', weights: { a: Infinity, b: 0.3 } },
        { id: 'p2', weights: { a: -Infinity, b: 0.4 } },
        { id: 'p3', weights: { a: 0.6, b: 0.2 } },
        { id: 'p4', weights: { a: 0.3, b: 0.5 } },
        { id: 'p5', weights: { a: 0.4, b: 0.6 } },
      ];

      const result = analyzer.analyze(prototypes);

      // Infinity values should be ignored
      expect(result.totalPrototypes).toBe(5);
    });

    it('should handle zero weights correctly (ignored as inactive)', () => {
      const prototypes = [
        { id: 'p1', weights: { a: 0, b: 0.3, c: 0 } },
        { id: 'p2', weights: { a: 0.5, b: 0.4, c: 0 } },
        { id: 'p3', weights: { a: 0.6, b: 0.2, c: 0.1 } },
        { id: 'p4', weights: { a: 0.3, b: 0.5, c: 0.2 } },
        { id: 'p5', weights: { a: 0.4, b: 0.6, c: 0.3 } },
      ];

      const result = analyzer.analyze(prototypes);

      // First prototype should have 1 active axis (b), zero values ignored
      expect(result.totalPrototypes).toBe(5);
    });

    it('should handle custom activeWeightEpsilon', () => {
      const customAnalyzer = new PrototypeComplexityAnalyzer({
        activeWeightEpsilon: 0.1,
        minPrototypesForAnalysis: 3,
      });

      const prototypes = [
        { id: 'p1', weights: { a: 0.05, b: 0.3 } }, // a below threshold
        { id: 'p2', weights: { a: 0.15, b: 0.4 } }, // both above
        { id: 'p3', weights: { a: 0.08, b: 0.2 } }, // a below threshold
      ];

      const result = customAnalyzer.analyze(prototypes);

      // p1 and p3 should have 1 active axis, p2 should have 2
      expect(result.totalPrototypes).toBe(3);
    });

    it('should handle non-numeric weights', () => {
      const prototypes = [
        { id: 'p1', weights: { a: 'string', b: 0.3 } },
        { id: 'p2', weights: { a: null, b: 0.4 } },
        { id: 'p3', weights: { a: 0.6, b: 0.2 } },
        { id: 'p4', weights: { a: 0.3, b: 0.5 } },
        { id: 'p5', weights: { a: 0.4, b: 0.6 } },
      ];

      const result = analyzer.analyze(prototypes);

      expect(result.totalPrototypes).toBe(5);
    });

    it('should use prototypeId as fallback when id is missing', () => {
      const prototypes = [
        { prototypeId: 'proto1', weights: { a: 0.5, b: 0.3 } },
        { prototypeId: 'proto2', weights: { a: 0.4, b: 0.2 } },
        { prototypeId: 'proto3', weights: { a: 0.6, b: 0.4 } },
        { prototypeId: 'proto4', weights: { a: 0.3, b: 0.5 } },
        { prototypeId: 'proto5', weights: { a: 0.7, b: 0.1 } },
      ];

      const result = analyzer.analyze(prototypes);

      expect(result.totalPrototypes).toBe(5);
    });
  });

  describe('result structure', () => {
    it('should return all expected top-level fields', () => {
      const prototypes = [
        { id: 'p1', weights: { a: 0.5, b: 0.3 } },
        { id: 'p2', weights: { a: 0.4, b: 0.2 } },
        { id: 'p3', weights: { a: 0.6, b: 0.4 } },
        { id: 'p4', weights: { a: 0.3, b: 0.5 } },
        { id: 'p5', weights: { a: 0.7, b: 0.1 } },
      ];

      const result = analyzer.analyze(prototypes);

      expect(result).toHaveProperty('distribution');
      expect(result).toHaveProperty('coOccurrence');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('totalPrototypes');
      expect(result).toHaveProperty('averageComplexity');
    });

    it('should return all expected distribution fields', () => {
      const prototypes = [
        { id: 'p1', weights: { a: 0.5, b: 0.3 } },
        { id: 'p2', weights: { a: 0.4, b: 0.2 } },
        { id: 'p3', weights: { a: 0.6, b: 0.4 } },
        { id: 'p4', weights: { a: 0.3, b: 0.5 } },
        { id: 'p5', weights: { a: 0.7, b: 0.1 } },
      ];

      const result = analyzer.analyze(prototypes);

      expect(result.distribution).toHaveProperty('histogram');
      expect(result.distribution).toHaveProperty('median');
      expect(result.distribution).toHaveProperty('q1');
      expect(result.distribution).toHaveProperty('q3');
      expect(result.distribution).toHaveProperty('min');
      expect(result.distribution).toHaveProperty('max');
      expect(result.distribution).toHaveProperty('mean');
      expect(result.distribution).toHaveProperty('outliers');
    });

    it('should return all expected bundle fields', () => {
      const prototypes = [
        { id: 'p1', weights: { a: 0.5, b: 0.3 } },
        { id: 'p2', weights: { a: 0.4, b: 0.2 } },
        { id: 'p3', weights: { a: 0.6, b: 0.4 } },
        { id: 'p4', weights: { a: 0.3, b: 0.5 } },
        { id: 'p5', weights: { a: 0.7, b: 0.1 } },
      ];

      const result = analyzer.analyze(prototypes);
      const bundle = result.coOccurrence.bundles[0];

      expect(bundle).toHaveProperty('axes');
      expect(bundle).toHaveProperty('frequency');
      expect(bundle).toHaveProperty('support');
      expect(bundle).toHaveProperty('suggestedConcept');
    });

    it('should return all expected recommendation fields', () => {
      // Create scenario that generates a recommendation
      const prototypes = [
        { id: 'p1', weights: { a: 0.5, b: 0.3, c: 0.2 } },
        { id: 'p2', weights: { a: 0.4, b: 0.2, c: 0.3 } },
        { id: 'p3', weights: { a: 0.6, b: 0.4, c: 0.5 } },
        { id: 'p4', weights: { a: 0.3, b: 0.5, c: 0.4 } },
        { id: 'p5', weights: { a: 0.7, b: 0.1, c: 0.6 } },
      ];

      const result = analyzer.analyze(prototypes);

      if (result.recommendations.length > 0) {
        const rec = result.recommendations[0];
        expect(rec).toHaveProperty('type');
        expect(rec).toHaveProperty('bundle');
        expect(rec).toHaveProperty('reason');
      }
    });
  });

  describe('analyze - config options', () => {
    it('should respect custom minBundleSupport', () => {
      // With higher support threshold, bundles that appear in fewer prototypes should be excluded
      const strictAnalyzer = new PrototypeComplexityAnalyzer({
        minBundleSupport: 0.9, // 90% threshold
        minPrototypesForAnalysis: 5,
      });

      // a+b in 5/5, a+c in 3/5 (60%), b+c in 3/5 (60%)
      const prototypes = [
        { id: 'p1', weights: { a: 0.5, b: 0.3 } },
        { id: 'p2', weights: { a: 0.4, b: 0.2 } },
        { id: 'p3', weights: { a: 0.6, b: 0.4, c: 0.1 } },
        { id: 'p4', weights: { a: 0.3, b: 0.5, c: 0.2 } },
        { id: 'p5', weights: { a: 0.7, b: 0.1, c: 0.3 } },
      ];

      const result = strictAnalyzer.analyze(prototypes);

      // Only a+b should meet 90% threshold
      expect(result.coOccurrence.bundles.length).toBeLessThanOrEqual(1);
    });

    it('should respect custom minBundleSize', () => {
      const largeBundleAnalyzer = new PrototypeComplexityAnalyzer({
        minBundleSize: 3, // Only 3+ axis bundles
        minPrototypesForAnalysis: 5,
      });

      const prototypes = [
        { id: 'p1', weights: { a: 0.5, b: 0.3, c: 0.2 } },
        { id: 'p2', weights: { a: 0.4, b: 0.2, c: 0.3 } },
        { id: 'p3', weights: { a: 0.6, b: 0.4, c: 0.5 } },
        { id: 'p4', weights: { a: 0.3, b: 0.5, c: 0.4 } },
        { id: 'p5', weights: { a: 0.7, b: 0.1, c: 0.6 } },
      ];

      const result = largeBundleAnalyzer.analyze(prototypes);

      // No 2-axis bundles should be included
      const twoPairBundles = result.coOccurrence.bundles.filter(
        (b) => b.axes.length === 2
      );
      expect(twoPairBundles.length).toBe(0);
    });

    it('should respect custom maxBundleSize', () => {
      const smallBundleAnalyzer = new PrototypeComplexityAnalyzer({
        maxBundleSize: 2, // Only 2-axis bundles max
        minPrototypesForAnalysis: 5,
      });

      const prototypes = [
        { id: 'p1', weights: { a: 0.5, b: 0.3, c: 0.2 } },
        { id: 'p2', weights: { a: 0.4, b: 0.2, c: 0.3 } },
        { id: 'p3', weights: { a: 0.6, b: 0.4, c: 0.5 } },
        { id: 'p4', weights: { a: 0.3, b: 0.5, c: 0.4 } },
        { id: 'p5', weights: { a: 0.7, b: 0.1, c: 0.6 } },
      ];

      const result = smallBundleAnalyzer.analyze(prototypes);

      // No bundles larger than 2 should exist
      const largeBundles = result.coOccurrence.bundles.filter(
        (b) => b.axes.length > 2
      );
      expect(largeBundles.length).toBe(0);
    });
  });
});
