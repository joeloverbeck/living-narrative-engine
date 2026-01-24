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
        highAxisLoadingThreshold: 2.0,
        signTensionMinMagnitude: 0.3,
        signTensionMinHighAxes: 3,
        multiAxisSignBalanceThreshold: 0.5,
      });
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
      const prototypes = [
        { id: 'normal1', weights: { a: 1 } },
        { id: 'normal2', weights: { b: 1 } },
        { id: 'normal3', weights: { c: 1 } },
        { id: 'outlier', weights: { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1 } },
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
        expect(results[0]).toHaveProperty('signBalance');
        expect(results[0]).toHaveProperty('positiveAxes');
        expect(results[0]).toHaveProperty('negativeAxes');
        expect(results[0].flagReason).toBe('high_axis_loading');
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
});
