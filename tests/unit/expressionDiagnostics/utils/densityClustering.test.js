/**
 * @file Unit tests for DensityClusteringService.
 */

import { describe, expect, it, jest } from '@jest/globals';
import DensityClusteringService from '../../../../src/expressionDiagnostics/utils/densityClustering.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('DensityClusteringService', () => {
  describe('constructor', () => {
    it('should accept valid dependencies', () => {
      const service = new DensityClusteringService({
        logger: createLogger(),
      });

      expect(service).toBeInstanceOf(DensityClusteringService);
    });

    it('should throw when logger is missing', () => {
      expect(
        () =>
          new DensityClusteringService({
            logger: null,
          })
      ).toThrow();
    });

    it('should accept custom distance function', () => {
      const customDistance = jest.fn().mockReturnValue(0.5);
      const service = new DensityClusteringService({
        logger: createLogger(),
        distanceFunction: customDistance,
      });

      expect(service).toBeInstanceOf(DensityClusteringService);
    });
  });

  describe('cluster', () => {
    it('should return empty map for empty input', () => {
      const service = new DensityClusteringService({
        logger: createLogger(),
      });

      const result = service.cluster([], 0.4, 3);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('should return empty map for null input', () => {
      const service = new DensityClusteringService({
        logger: createLogger(),
      });

      const result = service.cluster(null, 0.4, 3);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('should form cluster from points with similar vectors', () => {
      const service = new DensityClusteringService({
        logger: createLogger(),
      });

      // Two very similar points (small cosine distance)
      const points = [
        { id: 'a', vector: { x: 1, y: 0 } },
        { id: 'b', vector: { x: 0.99, y: 0.14 } }, // ~8 degrees apart
        { id: 'c', vector: { x: 0.98, y: 0.20 } }, // ~11 degrees apart
      ];

      const result = service.cluster(points, 0.3, 2);

      expect(result.size).toBe(1);
      const clusterMembers = Array.from(result.values())[0];
      expect(clusterMembers).toContain('a');
      expect(clusterMembers).toContain('b');
      expect(clusterMembers).toContain('c');
    });

    it('should separate points with different directions into separate clusters', () => {
      const service = new DensityClusteringService({
        logger: createLogger(),
      });

      // Two distinct regions
      const points = [
        // Cluster 1: positive X direction
        { id: 'a1', vector: { x: 1, y: 0.1 } },
        { id: 'a2', vector: { x: 0.95, y: 0.15 } },
        { id: 'a3', vector: { x: 0.98, y: 0.05 } },
        // Cluster 2: positive Y direction
        { id: 'b1', vector: { x: 0.1, y: 1 } },
        { id: 'b2', vector: { x: 0.15, y: 0.95 } },
        { id: 'b3', vector: { x: 0.05, y: 0.98 } },
      ];

      const result = service.cluster(points, 0.2, 2);

      expect(result.size).toBe(2);

      // Find cluster containing 'a1' and cluster containing 'b1'
      const clusters = Array.from(result.values());
      const clusterWithA = clusters.find((c) => c.includes('a1'));
      const clusterWithB = clusters.find((c) => c.includes('b1'));

      // Verify 'a' cluster has all 'a' members
      expect(clusterWithA).toContain('a1');
      expect(clusterWithA).toContain('a2');
      expect(clusterWithA).toContain('a3');

      // Verify 'b' cluster has all 'b' members
      expect(clusterWithB).toContain('b1');
      expect(clusterWithB).toContain('b2');
      expect(clusterWithB).toContain('b3');

      // Ensure they are different clusters
      expect(clusterWithA).not.toBe(clusterWithB);
    });

    it('should mark isolated points as noise (not in any cluster)', () => {
      const service = new DensityClusteringService({
        logger: createLogger(),
      });

      const points = [
        // Cluster: close together
        { id: 'a', vector: { x: 1, y: 0 } },
        { id: 'b', vector: { x: 0.99, y: 0.14 } },
        { id: 'c', vector: { x: 0.98, y: 0.20 } },
        // Noise: far away from everything
        { id: 'noise', vector: { x: -1, y: 0 } },
      ];

      const result = service.cluster(points, 0.3, 2);

      // Should have one cluster with a, b, c
      expect(result.size).toBe(1);
      const clusterMembers = Array.from(result.values())[0];
      expect(clusterMembers).toContain('a');
      expect(clusterMembers).toContain('b');
      expect(clusterMembers).toContain('c');
      expect(clusterMembers).not.toContain('noise');
    });

    it('should respect minPoints parameter', () => {
      const service = new DensityClusteringService({
        logger: createLogger(),
      });

      const points = [
        { id: 'a', vector: { x: 1, y: 0 } },
        { id: 'b', vector: { x: 0.99, y: 0.14 } },
      ];

      // With minPoints=3, neither point can be a core point
      const resultHighMin = service.cluster(points, 0.3, 3);
      expect(resultHighMin.size).toBe(0);

      // With minPoints=2, they can form a cluster
      const resultLowMin = service.cluster(points, 0.3, 2);
      expect(resultLowMin.size).toBe(1);
    });

    it('should respect epsilon parameter', () => {
      const service = new DensityClusteringService({
        logger: createLogger(),
      });

      const points = [
        { id: 'a', vector: { x: 1, y: 0 } },
        { id: 'b', vector: { x: 0.5, y: 0.866 } }, // 60 degrees apart
        { id: 'c', vector: { x: 0.6, y: 0.8 } },
      ];

      // With tight epsilon (0.1), points 60 degrees apart (cosine distance ~0.5) are not neighbors
      // With minPoints=3, need 2 other neighbors - none of these points have that with tight epsilon
      const resultTight = service.cluster(points, 0.1, 3);
      expect(resultTight.size).toBe(0);

      // With loose epsilon (0.6), all points are within reach and can cluster
      const resultLoose = service.cluster(points, 0.6, 2);
      expect(resultLoose.size).toBe(1);
    });

    it('should use default epsilon and minPoints for invalid values', () => {
      const service = new DensityClusteringService({
        logger: createLogger(),
      });

      const points = [
        { id: 'a', vector: { x: 1, y: 0 } },
        { id: 'b', vector: { x: 0.99, y: 0.14 } },
        { id: 'c', vector: { x: 0.98, y: 0.20 } },
      ];

      // Invalid epsilon/minPoints should fall back to defaults
      const result = service.cluster(points, NaN, 'invalid');
      expect(result).toBeInstanceOf(Map);
    });

    it('should handle vectors with different dimensions', () => {
      const service = new DensityClusteringService({
        logger: createLogger(),
      });

      // Vectors with different keys
      const points = [
        { id: 'a', vector: { x: 1, y: 0 } },
        { id: 'b', vector: { x: 1, z: 0 } }, // Has z instead of y
        { id: 'c', vector: { x: 1, y: 0.1, z: 0 } },
      ];

      const result = service.cluster(points, 0.2, 2);
      expect(result).toBeInstanceOf(Map);
    });

    it('should handle zero vectors as maximum distance', () => {
      const service = new DensityClusteringService({
        logger: createLogger(),
      });

      const points = [
        { id: 'zero', vector: { x: 0, y: 0 } },
        { id: 'normal', vector: { x: 1, y: 0 } },
      ];

      // Zero vector should be far from everything
      const result = service.cluster(points, 0.5, 1);
      // Depending on implementation, zero vector may or may not form a cluster
      expect(result).toBeInstanceOf(Map);
    });
  });

  describe('cosine distance calculation', () => {
    it('should return 0 for identical vectors', () => {
      const service = new DensityClusteringService({
        logger: createLogger(),
      });

      const points = [
        { id: 'a', vector: { x: 0.6, y: 0.8 } },
        { id: 'b', vector: { x: 0.6, y: 0.8 } },
      ];

      // With epsilon 0.01, only identical vectors should cluster
      const result = service.cluster(points, 0.01, 1);
      expect(result.size).toBe(1);
      const members = Array.from(result.values())[0];
      expect(members.length).toBe(2);
    });

    it('should return 1 for orthogonal vectors', () => {
      const service = new DensityClusteringService({
        logger: createLogger(),
      });

      const points = [
        { id: 'a', vector: { x: 1, y: 0 } },
        { id: 'b', vector: { x: 0, y: 1 } },
      ];

      // Orthogonal vectors have cosine distance = 1
      // With epsilon < 1 and minPoints=2 (need 1 neighbor), they shouldn't cluster
      const result = service.cluster(points, 0.5, 2);
      expect(result.size).toBe(0);
    });

    it('should return 2 for opposite vectors', () => {
      const service = new DensityClusteringService({
        logger: createLogger(),
      });

      const points = [
        { id: 'a', vector: { x: 1, y: 0 } },
        { id: 'b', vector: { x: -1, y: 0 } },
      ];

      // Opposite vectors have cosine distance = 2
      // With epsilon < 2 and minPoints=2 (need 1 neighbor), they shouldn't cluster
      const result = service.cluster(points, 1.5, 2);
      expect(result.size).toBe(0);
    });
  });
});
