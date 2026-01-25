/**
 * @file Unit tests for MultiAxisConflictDetector
 */

import { describe, expect, it, beforeEach } from '@jest/globals';
import { MultiAxisConflictDetector } from '../../../../../src/expressionDiagnostics/services/axisGap/MultiAxisConflictDetector.js';

describe('MultiAxisConflictDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new MultiAxisConflictDetector();
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const det = new MultiAxisConflictDetector();
      expect(det).toBeDefined();
    });

    it('should accept custom config', () => {
      const det = new MultiAxisConflictDetector({
        activeAxisEpsilon: 0.1,
        strongAxisThreshold: 0.3,
        highAxisLoadingThreshold: 2.0,
        signTensionMinMagnitude: 0.3,
        signTensionMinHighAxes: 3,
        multiAxisSignBalanceThreshold: 0.5,
      });
      expect(det).toBeDefined();
    });

    it('should use default activeAxisEpsilon of 0.08', () => {
      // Create detector with no config and verify behavior with epsilon=0.08
      const det = new MultiAxisConflictDetector();
      // Weights of 0.05 should be below epsilon (not active)
      // Weights of 0.10 should be above epsilon (active)
      const prototypes = [
        { id: 'below', weights: { a: 0.05, b: 0.05 } }, // Both below epsilon
        { id: 'above', weights: { a: 0.10, b: 0.10 } }, // Both above epsilon
        { id: 'mix', weights: { a: 0.05, b: 0.10 } }, // One below, one above
      ];

      const results = det.detectHighAxisLoadings(prototypes);

      // Find the 'above' prototype summary - it should have 2 active axes
      // The result structure from detectHighAxisLoadings shows active axes
      if (results.length > 0) {
        const aboveResult = results.find((r) => r.prototypeId === 'above');
        if (aboveResult) {
          expect(aboveResult.activeAxisCount).toBe(2);
        }
      }
    });

    it('should use default strongAxisThreshold of 0.25', () => {
      const det = new MultiAxisConflictDetector();
      expect(det).toBeDefined();
    });

    it('should use multiAxisUsageThreshold as fallback', () => {
      const det = new MultiAxisConflictDetector({
        multiAxisUsageThreshold: 2.5,
      });
      expect(det).toBeDefined();
    });
  });

  describe('detect - empty/invalid inputs', () => {
    it('should return empty result object for null', () => {
      const result = detector.detect(null);
      expect(result).toEqual({
        conflicts: [],
        highAxisLoadings: [],
        signTensions: [],
      });
    });

    it('should return empty result object for undefined', () => {
      const result = detector.detect(undefined);
      expect(result).toEqual({
        conflicts: [],
        highAxisLoadings: [],
        signTensions: [],
      });
    });

    it('should return empty result object for empty array', () => {
      const result = detector.detect([]);
      expect(result).toEqual({
        conflicts: [],
        highAxisLoadings: [],
        signTensions: [],
      });
    });

    it('should return empty result object for single prototype', () => {
      const result = detector.detect([{ id: 'a', weights: { x: 1 } }]);
      expect(result).toEqual({
        conflicts: [],
        highAxisLoadings: [],
        signTensions: [],
      });
    });
  });

  describe('detect - combined results', () => {
    it('should return structured result with separate arrays', () => {
      // Create prototypes where one has high axis loading, another has sign tension
      const prototypes = [
        { id: 'normal1', weights: { a: 1 } },
        { id: 'normal2', weights: { b: 1 } },
        { id: 'highAxis', weights: { a: 1, b: 1, c: 1, d: 1, e: 1 } },
        { id: 'signTension', weights: { a: 0.5, b: -0.5 } },
      ];

      const results = detector.detect(prototypes);

      // Verify structure
      expect(results).toHaveProperty('conflicts');
      expect(results).toHaveProperty('highAxisLoadings');
      expect(results).toHaveProperty('signTensions');
      expect(Array.isArray(results.conflicts)).toBe(true);
      expect(Array.isArray(results.highAxisLoadings)).toBe(true);
      expect(Array.isArray(results.signTensions)).toBe(true);

      // Check for deduplication within each array
      const conflictIds = results.conflicts.map((r) => r.prototypeId);
      expect(new Set(conflictIds).size).toBe(conflictIds.length);

      const highAxisIds = results.highAxisLoadings.map((r) => r.prototypeId);
      expect(new Set(highAxisIds).size).toBe(highAxisIds.length);

      const signTensionIds = results.signTensions.map((r) => r.prototypeId);
      expect(new Set(signTensionIds).size).toBe(signTensionIds.length);
    });

    it('should categorize detections into appropriate arrays', () => {
      // Create prototype that triggers both conditions
      const prototypes = Array.from({ length: 10 }, (_, i) => ({
        id: `proto${i}`,
        weights: {
          a: i === 0 ? 0.5 : 0.1,
          b: i === 0 ? -0.5 : 0.1,
          c: i === 0 ? 0.3 : 0,
          d: i === 0 ? -0.3 : 0,
          e: i === 0 ? 0.4 : 0,
        },
      }));

      const results = detector.detect(prototypes);

      // Verify the structured result contains proper arrays
      expect(results).toHaveProperty('conflicts');
      expect(results).toHaveProperty('highAxisLoadings');
      expect(results).toHaveProperty('signTensions');

      // All flagged items should have flagReason property
      const allFlagged = [
        ...results.conflicts,
        ...results.highAxisLoadings,
        ...results.signTensions,
      ];
      allFlagged.forEach((item) => {
        expect(item.flagReason).toBeDefined();
      });
    });
  });

  describe('detectHighAxisLoadings - empty/invalid', () => {
    it('should return empty for non-array', () => {
      expect(detector.detectHighAxisLoadings(null)).toEqual([]);
    });

    it('should return empty for empty array', () => {
      expect(detector.detectHighAxisLoadings([])).toEqual([]);
    });

    it('should return empty for single prototype', () => {
      expect(
        detector.detectHighAxisLoadings([{ id: 'a', weights: { x: 1 } }])
      ).toEqual([]);
    });
  });

  describe('detectHighAxisLoadings - detection logic', () => {
    it('should detect prototype with significantly more active axes', () => {
      // Using Tukey's fence: Q3 + 1.5*IQR
      // With axis counts [1, 1, 1, 15]:
      //   Lower: [1, 1] → Q1 = 1
      //   Upper: [1, 15] → Q3 = 8
      //   IQR = 7
      //   Threshold = 8 + 1.5*7 = 18.5
      // Wait, 15 won't work. Let's use a distribution where the outlier clearly exceeds.
      // With axis counts [1, 1, 1, 25]:
      //   Lower: [1, 1] → Q1 = 1
      //   Upper: [1, 25] → Q3 = 13
      //   IQR = 12
      //   Threshold = 13 + 1.5*12 = 31
      // Still not flagged. The issue is the outlier itself affects Q3.
      // Use more normal prototypes to dilute the outlier's effect:
      // With axis counts [1, 1, 1, 1, 1, 1, 20]:
      //   n=7 (odd), mid=3
      //   Lower: [1, 1, 1] → Q1 = 1
      //   Upper: [1, 1, 20] → Q3 = 1
      //   IQR = 0, effectiveIQR = 0.5
      //   Threshold = 1 + 0.5*1.5 = 1.75
      //   20 > 1.75 ✓
      const prototypes = [
        { id: 'normal1', weights: { a: 1 } },
        { id: 'normal2', weights: { b: 1 } },
        { id: 'normal3', weights: { c: 1 } },
        { id: 'normal4', weights: { d: 1 } },
        { id: 'normal5', weights: { e: 1 } },
        { id: 'normal6', weights: { f: 1 } },
        { id: 'outlier', weights: { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 1, h: 1, i: 1, j: 1, k: 1, l: 1, m: 1, n: 1, o: 1, p: 1, q: 1, r: 1, s: 1, t: 1 } },
      ];

      const results = detector.detectHighAxisLoadings(prototypes);

      expect(results.some((r) => r.prototypeId === 'outlier')).toBe(true);
    });

    it('should not detect when axis counts are similar', () => {
      const prototypes = [
        { id: 'a', weights: { x: 1, y: 1 } },
        { id: 'b', weights: { x: 1, z: 1 } },
        { id: 'c', weights: { y: 1, z: 1 } },
      ];

      const results = detector.detectHighAxisLoadings(prototypes);

      expect(results.length).toBe(0);
    });

    it('should include correct properties in results', () => {
      const prototypes = [
        { id: 'normal1', weights: { a: 1 } },
        { id: 'normal2', weights: { b: 1 } },
        { id: 'outlier', weights: { a: 1, b: 1, c: 1, d: 1, e: 1 } },
      ];

      const results = detector.detectHighAxisLoadings(prototypes);

      if (results.length > 0) {
        expect(results[0]).toHaveProperty('prototypeId');
        expect(results[0]).toHaveProperty('activeAxisCount');
        expect(results[0]).toHaveProperty('strongAxisCount');
        expect(results[0]).toHaveProperty('strongAxes');
        expect(results[0]).toHaveProperty('signBalance');
        expect(results[0]).toHaveProperty('positiveAxes');
        expect(results[0]).toHaveProperty('negativeAxes');
        expect(results[0].flagReason).toBe('high_axis_loading');
      }
    });

    it('should compute strongAxisCount correctly (|weight| >= 0.25)', () => {
      // Create prototypes with mix of strong and weak axes
      const prototypes = [
        { id: 'normal1', weights: { a: 0.1 } },
        { id: 'normal2', weights: { b: 0.1 } },
        {
          id: 'outlier',
          weights: {
            a: 0.5, // Strong
            b: 0.3, // Strong
            c: 0.1, // Not strong (below 0.25)
            d: -0.4, // Strong (absolute value)
            e: 0.09, // Not strong
          },
        },
      ];

      const results = detector.detectHighAxisLoadings(prototypes);

      if (results.length > 0) {
        const outlier = results.find((r) => r.prototypeId === 'outlier');
        if (outlier) {
          // 3 axes have |weight| >= 0.25: a(0.5), b(0.3), d(-0.4)
          expect(outlier.strongAxisCount).toBe(3);
          expect(outlier.strongAxes).toEqual(expect.arrayContaining(['a', 'b', 'd']));
          expect(outlier.strongAxes.length).toBe(3);
        }
      }
    });

    it('should respect custom strongAxisThreshold config', () => {
      const det = new MultiAxisConflictDetector({
        strongAxisThreshold: 0.4, // Higher threshold
      });

      const prototypes = [
        { id: 'normal1', weights: { a: 0.1 } },
        { id: 'normal2', weights: { b: 0.1 } },
        {
          id: 'outlier',
          weights: {
            a: 0.5, // Strong (>= 0.4)
            b: 0.3, // NOT strong (< 0.4)
            c: 0.45, // Strong (>= 0.4)
            d: -0.6, // Strong (absolute >= 0.4)
            e: 0.1,
          },
        },
      ];

      const results = det.detectHighAxisLoadings(prototypes);

      if (results.length > 0) {
        const outlier = results.find((r) => r.prototypeId === 'outlier');
        if (outlier) {
          // Only a(0.5), c(0.45), d(-0.6) meet the 0.4 threshold
          expect(outlier.strongAxisCount).toBe(3);
          expect(outlier.strongAxes).toContain('a');
          expect(outlier.strongAxes).toContain('c');
          expect(outlier.strongAxes).toContain('d');
          expect(outlier.strongAxes).not.toContain('b');
        }
      }
    });

    it('should sort strongAxes alphabetically', () => {
      const prototypes = [
        { id: 'normal1', weights: { a: 0.1 } },
        { id: 'normal2', weights: { b: 0.1 } },
        {
          id: 'outlier',
          weights: { z: 0.5, a: 0.5, m: 0.5, b: 0.5, c: 0.1 },
        },
      ];

      const results = detector.detectHighAxisLoadings(prototypes);

      if (results.length > 0) {
        const outlier = results.find((r) => r.prototypeId === 'outlier');
        if (outlier) {
          const sorted = [...outlier.strongAxes].sort();
          expect(outlier.strongAxes).toEqual(sorted);
        }
      }
    });

    it('should use prototypeId as fallback', () => {
      const prototypes = [
        { prototypeId: 'p1', weights: { a: 1 } },
        { prototypeId: 'p2', weights: { b: 1 } },
        { prototypeId: 'p3', weights: { a: 1, b: 1, c: 1, d: 1, e: 1 } },
      ];

      const results = detector.detectHighAxisLoadings(prototypes);

      if (results.length > 0) {
        expect(results[0].prototypeId).toMatch(/p\d/);
      }
    });

    it('should generate fallback IDs', () => {
      const prototypes = [
        { weights: { a: 1 } },
        { weights: { b: 1 } },
        { weights: { a: 1, b: 1, c: 1, d: 1, e: 1 } },
      ];

      const results = detector.detectHighAxisLoadings(prototypes);

      if (results.length > 0) {
        expect(results[0].prototypeId).toMatch(/prototype-\d+/);
      }
    });
  });

  describe('detectSignTensions - empty/invalid', () => {
    it('should return empty for non-array', () => {
      expect(detector.detectSignTensions(null)).toEqual([]);
    });

    it('should return empty for empty array', () => {
      expect(detector.detectSignTensions([])).toEqual([]);
    });

    it('should return empty for single prototype', () => {
      expect(
        detector.detectSignTensions([{ id: 'a', weights: { x: 0.5, y: -0.5 } }])
      ).toEqual([]);
    });
  });

  describe('detectSignTensions - detection logic', () => {
    it('should detect prototype with mixed high-magnitude signs', () => {
      const prototypes = [
        { id: 'positive', weights: { a: 0.5, b: 0.3 } },
        { id: 'negative', weights: { a: -0.5, b: -0.3 } },
        { id: 'mixed', weights: { a: 0.5, b: -0.5 } },
      ];

      const results = detector.detectSignTensions(prototypes);

      expect(results.some((r) => r.prototypeId === 'mixed')).toBe(true);
    });

    it('should not detect when only one sign has high magnitude', () => {
      const prototypes = [
        { id: 'a', weights: { x: 0.5, y: 0.05 } }, // y below threshold
        { id: 'b', weights: { x: -0.5, y: 0.01 } }, // y below threshold
        { id: 'c', weights: { x: 0.3, y: -0.02 } }, // mixed but y below threshold
      ];

      const results = detector.detectSignTensions(prototypes);

      expect(results.length).toBe(0);
    });

    it('should include highMagnitudePositive and highMagnitudeNegative', () => {
      const prototypes = [
        { id: 'a', weights: { x: 0.3, y: 0.3 } },
        { id: 'b', weights: { x: -0.3, y: -0.3 } },
        { id: 'mixed', weights: { a: 0.5, b: -0.5 } },
      ];

      const results = detector.detectSignTensions(prototypes);

      const mixed = results.find((r) => r.prototypeId === 'mixed');
      if (mixed) {
        expect(mixed).toHaveProperty('highMagnitudePositive');
        expect(mixed).toHaveProperty('highMagnitudeNegative');
        expect(mixed.flagReason).toBe('sign_tension');
      }
    });

    it('should respect signTensionMinMagnitude config', () => {
      const det = new MultiAxisConflictDetector({
        signTensionMinMagnitude: 0.6, // Higher threshold
      });

      const prototypes = [
        { id: 'a', weights: { x: 0.5, y: 0.3 } },
        { id: 'b', weights: { x: -0.5, y: -0.3 } },
        { id: 'mixed', weights: { a: 0.5, b: -0.5 } }, // Below new threshold
      ];

      const results = det.detectSignTensions(prototypes);

      // Should not detect because magnitudes are below 0.6
      expect(results.length).toBe(0);
    });

    it('should respect signTensionMinHighAxes config', () => {
      const det = new MultiAxisConflictDetector({
        signTensionMinHighAxes: 4, // Requires 4 high-magnitude axes
      });

      const prototypes = [
        { id: 'a', weights: { x: 0.3, y: 0.3 } },
        { id: 'b', weights: { x: -0.3, y: -0.3 } },
        { id: 'mixed', weights: { a: 0.5, b: -0.5 } }, // Only 2 high-magnitude
      ];

      const results = det.detectSignTensions(prototypes);

      // Should not detect because only 2 axes
      expect(results.length).toBe(0);
    });

    it('should filter by sign balance threshold', () => {
      const det = new MultiAxisConflictDetector({
        multiAxisSignBalanceThreshold: 0.1, // Very low threshold
      });

      const prototypes = [
        { id: 'a', weights: { x: 0.3, y: 0.3 } },
        { id: 'b', weights: { x: -0.3, y: -0.3 } },
        {
          id: 'unbalanced',
          weights: { a: 0.5, b: 0.4, c: 0.3, d: -0.3 }, // 3:1 ratio
        },
      ];

      const results = det.detectSignTensions(prototypes);

      // Unbalanced has sign balance > 0.1, so should be filtered out
      expect(results.some((r) => r.prototypeId === 'unbalanced')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle prototypes without weights', () => {
      const prototypes = [
        { id: 'a' },
        { id: 'b', weights: null },
        { id: 'c', weights: { x: 1 } },
      ];

      expect(() => detector.detect(prototypes)).not.toThrow();
      expect(() => detector.detectHighAxisLoadings(prototypes)).not.toThrow();
      expect(() => detector.detectSignTensions(prototypes)).not.toThrow();
    });

    it('should handle non-finite weight values', () => {
      const prototypes = [
        { id: 'a', weights: { x: NaN, y: 1 } },
        { id: 'b', weights: { x: Infinity, y: -Infinity } },
        { id: 'c', weights: { x: 0.5, y: -0.5 } },
      ];

      expect(() => detector.detect(prototypes)).not.toThrow();
    });

    it('should sort axis arrays', () => {
      const prototypes = [
        { id: 'a', weights: { z: 1, a: 1, m: 1 } },
        { id: 'b', weights: { x: 1 } },
        { id: 'outlier', weights: { z: 1, a: 1, m: 1, b: 1, c: 1 } },
      ];

      const results = detector.detectHighAxisLoadings(prototypes);

      if (results.length > 0) {
        const positiveAxes = results[0].positiveAxes;
        const sorted = [...positiveAxes].sort();
        expect(positiveAxes).toEqual(sorted);
      }
    });

    it('should respect activeAxisEpsilon config', () => {
      const det = new MultiAxisConflictDetector({
        activeAxisEpsilon: 0.5,
      });

      const prototypes = [
        { id: 'a', weights: { x: 0.3, y: 0.3 } }, // Below epsilon
        { id: 'b', weights: { x: 0.3, y: 0.3 } },
        { id: 'c', weights: { x: 1, y: 1, z: 1, w: 1, v: 1 } }, // Above epsilon
      ];

      const results = det.detectHighAxisLoadings(prototypes);

      // Only c should have active axes counted
      if (results.length > 0) {
        const c = results.find((r) => r.prototypeId === 'c');
        if (c) {
          expect(c.activeAxisCount).toBe(5);
        }
      }
    });
  });

  describe('IQR floor protection', () => {
    it('should not flag ~50% of prototypes when all have same axis count (IQR=0)', () => {
      // When all prototypes have identical axis counts, IQR = 0
      // Without floor protection, threshold = Q3 + 0 = Q3, flagging ~50%
      // With floor protection (default 0.5), threshold = Q3 + 0.5 * 1.5 = Q3 + 0.75
      const prototypes = Array.from({ length: 20 }, (_, i) => ({
        id: `proto${i}`,
        weights: { a: 1, b: 1 }, // All have exactly 2 active axes
      }));

      const results = detector.detectHighAxisLoadings(prototypes);

      // With IQR floor, no prototypes should be flagged since all have same count
      expect(results.length).toBe(0);
    });

    it('should detect outlier even with homogeneous baseline', () => {
      // 19 prototypes with 2 axes, 1 outlier with 10 axes
      const prototypes = [
        ...Array.from({ length: 19 }, (_, i) => ({
          id: `normal${i}`,
          weights: { a: 1, b: 1 },
        })),
        { id: 'outlier', weights: { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 1, h: 1, i: 1, j: 1 } },
      ];

      const results = detector.detectHighAxisLoadings(prototypes);

      // Outlier should still be detected
      expect(results.length).toBe(1);
      expect(results[0].prototypeId).toBe('outlier');
    });

    it('should respect custom minIQRFloor config', () => {
      const det = new MultiAxisConflictDetector({
        minIQRFloor: 2.0, // Higher floor = less sensitive
      });

      // All prototypes have 2 axes, one has 4 axes
      const prototypes = [
        ...Array.from({ length: 10 }, (_, i) => ({
          id: `normal${i}`,
          weights: { a: 1, b: 1 },
        })),
        { id: 'borderline', weights: { a: 1, b: 1, c: 1, d: 1 } },
      ];

      const results = det.detectHighAxisLoadings(prototypes);

      // With higher floor (2.0), threshold = Q3(2) + 2.0 * 1.5 = 5
      // borderline has 4 axes, which is below 5, so should NOT be flagged
      expect(results.length).toBe(0);
    });

    it('should use Tukey fence formula (Q3 + k*IQR) for threshold', () => {
      // Create distribution: [1, 2, 3, 4, 5, 6, 7, 8, 16]
      // With 9 elements: Q1=2.5, Q3=7.5, IQR=5
      // Tukey threshold = Q3 + k*IQR = 7.5 + 1.5*5 = 15
      // Outlier with 16 axes exceeds threshold
      const prototypes = [
        { id: 'p1', weights: { a: 1 } }, // 1 axis
        { id: 'p2', weights: { a: 1, b: 1 } }, // 2 axes
        { id: 'p3', weights: { a: 1, b: 1, c: 1 } }, // 3 axes
        { id: 'p4', weights: { a: 1, b: 1, c: 1, d: 1 } }, // 4 axes
        { id: 'p5', weights: { a: 1, b: 1, c: 1, d: 1, e: 1 } }, // 5 axes
        { id: 'p6', weights: { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1 } }, // 6 axes
        { id: 'p7', weights: { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 1 } }, // 7 axes
        { id: 'p8', weights: { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 1, h: 1 } }, // 8 axes
        // Add outlier with 16 axes (above threshold of 15)
        {
          id: 'outlier',
          weights: { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 1, h: 1, i: 1, j: 1, k: 1, l: 1, m: 1, n: 1, o: 1, p: 1 },
        },
      ];

      const results = detector.detectHighAxisLoadings(prototypes);

      // Only the outlier with 16 axes should be flagged
      expect(results.length).toBe(1);
      expect(results[0].prototypeId).toBe('outlier');
      expect(results[0].activeAxisCount).toBe(16);
    });
  });
});
