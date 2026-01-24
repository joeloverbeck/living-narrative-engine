/**
 * @file Unit tests for vectorMathUtils.js
 */

import { describe, expect, it } from '@jest/globals';
import {
  clamp01,
  computeVectorMagnitude,
  normalizeVector,
  computeCosineDistance,
  collectAxes,
  buildPrototypeLookup,
  getAxisUnitVectors,
  computeNearestAxisDistance,
} from '../../../../src/expressionDiagnostics/utils/vectorMathUtils.js';

describe('vectorMathUtils', () => {
  describe('clamp01', () => {
    it('should return value unchanged when within [0, 1]', () => {
      expect(clamp01(0.5)).toBe(0.5);
      expect(clamp01(0)).toBe(0);
      expect(clamp01(1)).toBe(1);
    });

    it('should clamp values below 0 to 0', () => {
      expect(clamp01(-0.5)).toBe(0);
      expect(clamp01(-100)).toBe(0);
    });

    it('should clamp values above 1 to 1', () => {
      expect(clamp01(1.5)).toBe(1);
      expect(clamp01(100)).toBe(1);
    });
  });

  describe('computeVectorMagnitude', () => {
    it('should compute magnitude of simple vector', () => {
      const magnitude = computeVectorMagnitude({ x: 3, y: 4 });
      expect(magnitude).toBe(5);
    });

    it('should return 0 for zero vector', () => {
      const magnitude = computeVectorMagnitude({ x: 0, y: 0 });
      expect(magnitude).toBe(0);
    });

    it('should return 0 for null/undefined', () => {
      expect(computeVectorMagnitude(null)).toBe(0);
      expect(computeVectorMagnitude(undefined)).toBe(0);
    });

    it('should handle negative values', () => {
      const magnitude = computeVectorMagnitude({ x: -3, y: -4 });
      expect(magnitude).toBe(5);
    });

    it('should ignore non-finite values', () => {
      const magnitude = computeVectorMagnitude({ x: 3, y: NaN, z: 4 });
      expect(magnitude).toBe(5);
    });

    it('should handle single-dimension vectors', () => {
      expect(computeVectorMagnitude({ x: 5 })).toBe(5);
      expect(computeVectorMagnitude({ x: -5 })).toBe(5);
    });

    it('should handle multi-dimensional vectors', () => {
      // sqrt(1 + 1 + 1 + 1) = 2
      const magnitude = computeVectorMagnitude({ a: 1, b: 1, c: 1, d: 1 });
      expect(magnitude).toBe(2);
    });
  });

  describe('normalizeVector', () => {
    it('should normalize a non-zero vector', () => {
      const normalized = normalizeVector({ x: 3, y: 4 });
      expect(normalized.x).toBeCloseTo(0.6);
      expect(normalized.y).toBeCloseTo(0.8);
    });

    it('should return null for zero vector', () => {
      expect(normalizeVector({ x: 0, y: 0 })).toBeNull();
    });

    it('should return null for null/undefined', () => {
      expect(normalizeVector(null)).toBeNull();
      expect(normalizeVector(undefined)).toBeNull();
    });

    it('should handle single-dimension vectors', () => {
      const normalized = normalizeVector({ x: 5 });
      expect(normalized.x).toBe(1);
    });

    it('should handle negative values', () => {
      const normalized = normalizeVector({ x: -3, y: 4 });
      expect(normalized.x).toBeCloseTo(-0.6);
      expect(normalized.y).toBeCloseTo(0.8);
    });

    it('should treat non-finite values as zero', () => {
      const normalized = normalizeVector({ x: 3, y: NaN });
      expect(normalized.x).toBe(1);
      expect(normalized.y).toBe(0);
    });
  });

  describe('computeCosineDistance', () => {
    it('should return 0 for identical vectors', () => {
      const distance = computeCosineDistance({ x: 1, y: 0 }, { x: 1, y: 0 });
      expect(distance).toBeCloseTo(0);
    });

    it('should return 1 for orthogonal vectors', () => {
      const distance = computeCosineDistance({ x: 1, y: 0 }, { x: 0, y: 1 });
      expect(distance).toBeCloseTo(1);
    });

    it('should return value close to 1 for opposite vectors without useAbsolute', () => {
      const distance = computeCosineDistance({ x: 1, y: 0 }, { x: -1, y: 0 });
      // similarity = -1, distance = 1 - (-1) = 2, clamped to 1
      expect(distance).toBe(1);
    });

    it('should return 0 for opposite vectors with useAbsolute', () => {
      const distance = computeCosineDistance(
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { useAbsolute: true }
      );
      expect(distance).toBeCloseTo(0);
    });

    it('should return 1 for null/undefined vectors', () => {
      expect(computeCosineDistance(null, { x: 1 })).toBe(1);
      expect(computeCosineDistance({ x: 1 }, null)).toBe(1);
    });

    it('should return 1 for zero-length vectors', () => {
      expect(computeCosineDistance({ x: 0 }, { x: 1 })).toBe(1);
      expect(computeCosineDistance({ x: 1 }, { x: 0 })).toBe(1);
    });

    it('should handle vectors with different keys', () => {
      const distance = computeCosineDistance({ x: 1 }, { y: 1 });
      // Orthogonal since no shared non-zero dimensions
      expect(distance).toBeCloseTo(1);
    });
  });

  describe('collectAxes', () => {
    it('should collect unique axis names from prototypes', () => {
      const prototypes = [
        { id: 'a', weights: { axisA: 1, axisB: 0.5 } },
        { id: 'b', weights: { axisB: -0.5, axisC: 1 } },
      ];
      const axes = collectAxes(prototypes);
      expect(axes).toEqual(['axisA', 'axisB', 'axisC']);
    });

    it('should return empty array for empty input', () => {
      expect(collectAxes([])).toEqual([]);
    });

    it('should return empty array for non-array input', () => {
      expect(collectAxes(null)).toEqual([]);
      expect(collectAxes(undefined)).toEqual([]);
    });

    it('should skip prototypes without weights', () => {
      const prototypes = [
        { id: 'a', weights: { axisA: 1 } },
        { id: 'b' },
        { id: 'c', weights: null },
      ];
      const axes = collectAxes(prototypes);
      expect(axes).toEqual(['axisA']);
    });

    it('should skip non-finite weight values', () => {
      const prototypes = [
        { id: 'a', weights: { axisA: 1, axisB: NaN, axisC: Infinity } },
      ];
      const axes = collectAxes(prototypes);
      expect(axes).toEqual(['axisA']);
    });

    it('should return sorted axes', () => {
      const prototypes = [
        { id: 'a', weights: { z: 1, a: 1, m: 1 } },
      ];
      const axes = collectAxes(prototypes);
      expect(axes).toEqual(['a', 'm', 'z']);
    });
  });

  describe('buildPrototypeLookup', () => {
    it('should build lookup map from prototypes', () => {
      const prototypes = [
        { id: 'proto1', weights: { a: 1 } },
        { id: 'proto2', weights: { b: 2 } },
      ];
      const lookup = buildPrototypeLookup(prototypes);
      expect(lookup.size).toBe(2);
      expect(lookup.get('proto1')).toEqual({ id: 'proto1', weights: { a: 1 } });
      expect(lookup.get('proto2')).toEqual({ id: 'proto2', weights: { b: 2 } });
    });

    it('should handle prototypeId field', () => {
      const prototypes = [{ prototypeId: 'proto1', weights: { a: 1 } }];
      const lookup = buildPrototypeLookup(prototypes);
      expect(lookup.get('proto1')).toBeDefined();
    });

    it('should prefer id over prototypeId', () => {
      const prototypes = [{ id: 'idValue', prototypeId: 'protoIdValue' }];
      const lookup = buildPrototypeLookup(prototypes);
      expect(lookup.get('idValue')).toBeDefined();
      expect(lookup.get('protoIdValue')).toBeUndefined();
    });

    it('should return empty map for non-array input', () => {
      expect(buildPrototypeLookup(null).size).toBe(0);
      expect(buildPrototypeLookup(undefined).size).toBe(0);
    });

    it('should skip prototypes without id', () => {
      const prototypes = [
        { id: 'proto1', weights: { a: 1 } },
        { weights: { b: 2 } },
      ];
      const lookup = buildPrototypeLookup(prototypes);
      expect(lookup.size).toBe(1);
    });
  });

  describe('getAxisUnitVectors', () => {
    it('should create unit vectors for each axis', () => {
      const vectors = getAxisUnitVectors(['x', 'y', 'z']);

      expect(vectors.get('x')).toEqual({ x: 1, y: 0, z: 0 });
      expect(vectors.get('y')).toEqual({ x: 0, y: 1, z: 0 });
      expect(vectors.get('z')).toEqual({ x: 0, y: 0, z: 1 });
    });

    it('should handle single axis', () => {
      const vectors = getAxisUnitVectors(['only']);
      expect(vectors.get('only')).toEqual({ only: 1 });
    });

    it('should handle empty axis array', () => {
      const vectors = getAxisUnitVectors([]);
      expect(vectors.size).toBe(0);
    });
  });

  describe('computeNearestAxisDistance', () => {
    it('should return 0 for vector aligned with an axis', () => {
      const vector = { x: 1, y: 0, z: 0 };
      const unitVectors = getAxisUnitVectors(['x', 'y', 'z']);
      const distance = computeNearestAxisDistance(vector, unitVectors);
      expect(distance).toBeCloseTo(0);
    });

    it('should return distance to nearest axis for diagonal vectors', () => {
      // A normalized [1,1,0] vector
      const vector = normalizeVector({ x: 1, y: 1, z: 0 });
      const unitVectors = getAxisUnitVectors(['x', 'y', 'z']);
      const distance = computeNearestAxisDistance(vector, unitVectors);
      // Cosine similarity with x-axis: 1/sqrt(2) ≈ 0.707
      // Distance = 1 - 0.707 ≈ 0.293
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(0.5);
    });

    it('should return 1 for empty axis unit vectors', () => {
      const vector = { x: 1 };
      const unitVectors = new Map();
      const distance = computeNearestAxisDistance(vector, unitVectors);
      expect(distance).toBe(1);
    });

    it('should use absolute cosine distance', () => {
      // Negative direction should still be close to the axis
      const vector = { x: -1, y: 0, z: 0 };
      const unitVectors = getAxisUnitVectors(['x', 'y', 'z']);
      const distance = computeNearestAxisDistance(vector, unitVectors);
      expect(distance).toBeCloseTo(0);
    });
  });
});
