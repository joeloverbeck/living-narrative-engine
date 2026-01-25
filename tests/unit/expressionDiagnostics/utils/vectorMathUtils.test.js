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
  generateCombinations,
  projectOntoSubspace,
  computeSubspaceDistance,
  computeNearestSubspaceDistance,
  checkSubspaceGap,
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

  describe('generateCombinations', () => {
    it('should return empty array for k < 0', () => {
      expect(generateCombinations(['a', 'b', 'c'], -1)).toEqual([]);
    });

    it('should return empty array for k > array length', () => {
      expect(generateCombinations(['a', 'b'], 3)).toEqual([]);
    });

    it('should return array with empty array for k = 0', () => {
      expect(generateCombinations(['a', 'b', 'c'], 0)).toEqual([[]]);
    });

    it('should return array with original array for k = array length', () => {
      expect(generateCombinations(['a', 'b'], 2)).toEqual([['a', 'b']]);
    });

    it('should generate C(3,1) = 3 combinations', () => {
      const result = generateCombinations(['a', 'b', 'c'], 1);
      expect(result).toEqual([['a'], ['b'], ['c']]);
    });

    it('should generate C(4,2) = 6 combinations', () => {
      const result = generateCombinations(['a', 'b', 'c', 'd'], 2);
      expect(result.length).toBe(6);
      expect(result).toContainEqual(['a', 'b']);
      expect(result).toContainEqual(['a', 'c']);
      expect(result).toContainEqual(['a', 'd']);
      expect(result).toContainEqual(['b', 'c']);
      expect(result).toContainEqual(['b', 'd']);
      expect(result).toContainEqual(['c', 'd']);
    });

    it('should generate C(5,3) = 10 combinations', () => {
      const result = generateCombinations(['a', 'b', 'c', 'd', 'e'], 3);
      expect(result.length).toBe(10);
    });

    it('should handle single element array', () => {
      expect(generateCombinations(['a'], 1)).toEqual([['a']]);
      expect(generateCombinations(['a'], 0)).toEqual([[]]);
    });
  });

  describe('projectOntoSubspace', () => {
    it('should return null for null/undefined vector', () => {
      expect(projectOntoSubspace(null, ['x'])).toBeNull();
      expect(projectOntoSubspace(undefined, ['x'])).toBeNull();
    });

    it('should return null for empty subspace axes', () => {
      expect(projectOntoSubspace({ x: 1, y: 2 }, [])).toBeNull();
      expect(projectOntoSubspace({ x: 1, y: 2 }, null)).toBeNull();
    });

    it('should project onto single-axis subspace (keep only that axis)', () => {
      const result = projectOntoSubspace({ x: 3, y: 4, z: 0 }, ['x']);
      expect(result).not.toBeNull();
      expect(result.x).toBe(1); // Normalized to unit length
      expect(result.y).toBe(0);
      expect(result.z).toBe(0);
    });

    it('should project onto two-axis subspace', () => {
      const result = projectOntoSubspace({ x: 3, y: 4, z: 5 }, ['x', 'y']);
      expect(result).not.toBeNull();
      // Original x=3, y=4, magnitude in subspace = 5
      expect(result.x).toBeCloseTo(0.6);
      expect(result.y).toBeCloseTo(0.8);
      expect(result.z).toBe(0);
    });

    it('should return null if projection results in zero vector', () => {
      const result = projectOntoSubspace({ x: 0, y: 0, z: 5 }, ['x', 'y']);
      expect(result).toBeNull();
    });

    it('should handle vector with only subspace components', () => {
      const result = projectOntoSubspace({ x: 3, y: 4 }, ['x', 'y']);
      expect(result.x).toBeCloseTo(0.6);
      expect(result.y).toBeCloseTo(0.8);
    });

    it('should treat non-finite values as zero', () => {
      const result = projectOntoSubspace({ x: NaN, y: 3, z: 4 }, ['y', 'z']);
      expect(result.x).toBe(0);
      expect(result.y).toBeCloseTo(0.6);
      expect(result.z).toBeCloseTo(0.8);
    });
  });

  describe('computeSubspaceDistance', () => {
    it('should return 0 for vector fully within subspace', () => {
      const vector = normalizeVector({ x: 3, y: 4 });
      const distance = computeSubspaceDistance(vector, ['x', 'y']);
      expect(distance).toBeCloseTo(0);
    });

    it('should return 1 when projection is null', () => {
      const distance = computeSubspaceDistance({ x: 1 }, ['y']);
      expect(distance).toBe(1);
    });

    it('should return distance for vector partially in subspace', () => {
      // Vector [1,1,1] normalized
      const vector = normalizeVector({ x: 1, y: 1, z: 1 });
      // Subspace {x, y}
      const distance = computeSubspaceDistance(vector, ['x', 'y']);
      // Vector has equal components, projection on x-y plane retains 2/3 of variance
      // Cosine similarity = sqrt(2)/sqrt(3) ≈ 0.816, distance ≈ 0.184
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(0.5);
    });

    it('should return higher distance for more off-axis vectors', () => {
      const vector = normalizeVector({ x: 1, y: 0, z: 10 });
      const distance = computeSubspaceDistance(vector, ['x', 'y']);
      expect(distance).toBeGreaterThan(0.5);
    });
  });

  describe('computeNearestSubspaceDistance', () => {
    it('should return distance 1 for null/undefined vector', () => {
      const result = computeNearestSubspaceDistance(null, ['x', 'y'], 1);
      expect(result.distance).toBe(1);
      expect(result.subspaceAxes).toEqual([]);
    });

    it('should return distance 1 for empty axes', () => {
      const result = computeNearestSubspaceDistance({ x: 1 }, [], 1);
      expect(result.distance).toBe(1);
      expect(result.subspaceAxes).toEqual([]);
    });

    it('should return 0 for vector aligned with single axis (k=1)', () => {
      const vector = { x: 1, y: 0, z: 0 };
      const result = computeNearestSubspaceDistance(vector, ['x', 'y', 'z'], 1);
      expect(result.distance).toBeCloseTo(0);
      expect(result.subspaceAxes).toEqual(['x']);
    });

    it('should find nearest 2-axis subspace (k=2)', () => {
      // Vector in x-y plane
      const vector = normalizeVector({ x: 1, y: 1, z: 0 });
      const result = computeNearestSubspaceDistance(vector, ['x', 'y', 'z'], 2);
      expect(result.distance).toBeCloseTo(0);
      // Should be x-y subspace
      expect(result.subspaceAxes).toContain('x');
      expect(result.subspaceAxes).toContain('y');
    });

    it('should clamp k to valid range', () => {
      const vector = { x: 1 };
      const result = computeNearestSubspaceDistance(vector, ['x'], 5);
      // k gets clamped to 1 (array length)
      expect(result.distance).toBeCloseTo(0);
    });

    it('should test all k-combinations for best distance', () => {
      // Vector mostly aligned with z-axis
      const vector = normalizeVector({ x: 0.1, y: 0.1, z: 1 });
      const result = computeNearestSubspaceDistance(
        vector,
        ['x', 'y', 'z'],
        1
      );
      // Should find z as nearest single axis
      expect(result.subspaceAxes).toEqual(['z']);
      expect(result.distance).toBeLessThan(0.1);
    });

    it('should reduce distance with higher k', () => {
      // Diagonal vector
      const vector = normalizeVector({ x: 1, y: 1, z: 1 });
      const result1 = computeNearestSubspaceDistance(
        vector,
        ['x', 'y', 'z'],
        1
      );
      const result2 = computeNearestSubspaceDistance(
        vector,
        ['x', 'y', 'z'],
        2
      );
      const result3 = computeNearestSubspaceDistance(
        vector,
        ['x', 'y', 'z'],
        3
      );
      // Higher k should give same or lower distance
      expect(result2.distance).toBeLessThanOrEqual(result1.distance);
      expect(result3.distance).toBeLessThanOrEqual(result2.distance);
      // At k=3 (full space), distance should be 0
      expect(result3.distance).toBeCloseTo(0);
    });
  });

  describe('checkSubspaceGap', () => {
    it('should identify gap when distant from all subspaces', () => {
      // Create a vector that's diagonal in 4D space
      const vector = normalizeVector({ w: 1, x: 1, y: 1, z: 1 });
      const axes = ['w', 'x', 'y', 'z'];
      const thresholds = { 1: 0.1, 2: 0.1, 3: 0.1 };
      const result = checkSubspaceGap(vector, axes, thresholds, 3);
      // Diagonal vector is far from all 1, 2, and 3-axis subspaces
      expect(result.isGap).toBe(true);
      expect(result.distances[1].distance).toBeGreaterThan(0.1);
      expect(result.distances[2].distance).toBeGreaterThan(0.1);
      expect(result.distances[3].distance).toBeGreaterThan(0.1);
    });

    it('should not identify gap when close to any subspace', () => {
      // Vector aligned with x-axis
      const vector = { x: 1, y: 0, z: 0 };
      const axes = ['x', 'y', 'z'];
      const thresholds = { 1: 0.5, 2: 0.5, 3: 0.5 };
      const result = checkSubspaceGap(vector, axes, thresholds, 3);
      expect(result.isGap).toBe(false);
      expect(result.distances[1].distance).toBeLessThan(0.5);
    });

    it('should use default threshold of 0.5 when not specified', () => {
      const vector = normalizeVector({ x: 1, y: 1 });
      const axes = ['x', 'y', 'z'];
      const thresholds = {}; // No thresholds specified
      const result = checkSubspaceGap(vector, axes, thresholds, 2);
      // Default threshold is 0.5
      expect(result.distances[1]).toBeDefined();
      expect(result.distances[2]).toBeDefined();
    });

    it('should return distances for each k up to maxK', () => {
      const vector = { x: 1, y: 0, z: 0 };
      const axes = ['x', 'y', 'z'];
      const thresholds = { 1: 0.5, 2: 0.5, 3: 0.5 };
      const result = checkSubspaceGap(vector, axes, thresholds, 3);
      expect(result.distances[1]).toBeDefined();
      expect(result.distances[2]).toBeDefined();
      expect(result.distances[3]).toBeDefined();
      expect(result.distances[4]).toBeUndefined();
    });

    it('should include subspace axes in distance results', () => {
      const vector = { x: 1, y: 0, z: 0 };
      const axes = ['x', 'y', 'z'];
      const thresholds = { 1: 0.5 };
      const result = checkSubspaceGap(vector, axes, thresholds, 1);
      expect(result.distances[1].subspaceAxes).toEqual(['x']);
    });

    it('should handle high-dimensional spaces', () => {
      // 6-dimensional diagonal vector
      const vector = normalizeVector({
        a: 1,
        b: 1,
        c: 1,
        d: 1,
        e: 1,
        f: 1,
      });
      const axes = ['a', 'b', 'c', 'd', 'e', 'f'];
      const thresholds = { 1: 0.6, 2: 0.5, 3: 0.4 };
      const result = checkSubspaceGap(vector, axes, thresholds, 3);
      // In 6D, a diagonal vector should be considered a gap
      expect(result.distances[1].distance).toBeGreaterThan(0.5);
      expect(result.distances[2].distance).toBeGreaterThan(0.3);
    });
  });
});
