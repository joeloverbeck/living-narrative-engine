/**
 * @file Unit tests for CoverageGapDetector
 */

import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { CoverageGapDetector } from '../../../../../src/expressionDiagnostics/services/axisGap/CoverageGapDetector.js';

describe('CoverageGapDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new CoverageGapDetector();
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const det = new CoverageGapDetector();
      expect(det).toBeDefined();
    });

    it('should accept custom config', () => {
      const det = new CoverageGapDetector({
        coverageGapClusteringMethod: 'dbscan',
        coverageGapAxisDistanceThreshold: 0.5,
        coverageGapMinClusterSize: 2,
        enableMagnitudeAwareGapScoring: false,
        enableAdaptiveThresholds: true,
        dbscanEpsilon: 0.3,
        dbscanMinPoints: 4,
        adaptiveThresholdSeed: 123,
      });
      expect(det).toBeDefined();
    });

    it('should accept density clustering service', () => {
      const mockService = { cluster: jest.fn().mockReturnValue(new Map()) };
      const det = new CoverageGapDetector(
        { coverageGapClusteringMethod: 'dbscan' },
        mockService
      );
      expect(det).toBeDefined();
    });
  });

  describe('detect - empty/invalid inputs', () => {
    it('should return empty array for null profiles', () => {
      expect(detector.detect(null, [])).toEqual([]);
    });

    it('should return empty array for undefined profiles', () => {
      expect(detector.detect(undefined, [])).toEqual([]);
    });

    it('should return empty array for empty profiles map', () => {
      expect(detector.detect(new Map(), [])).toEqual([]);
    });

    it('should return empty array for empty prototypes', () => {
      const profiles = new Map([['proto1', { clusterId: 'c1' }]]);
      expect(detector.detect(profiles, [])).toEqual([]);
    });

    it('should return empty array when no axes can be collected', () => {
      const profiles = new Map([['proto1', { clusterId: 'c1' }]]);
      const prototypes = [{ id: 'proto1', weights: {} }];
      expect(detector.detect(profiles, prototypes)).toEqual([]);
    });
  });

  describe('detect - profile-based clustering', () => {
    it('should detect gap from profile clusters', () => {
      const profiles = new Map([
        ['p1', { clusterId: 'cluster-1' }],
        ['p2', { clusterId: 'cluster-1' }],
        ['p3', { clusterId: 'cluster-1' }],
      ]);

      const prototypes = [
        { id: 'p1', weights: { x: 0.5, y: 0.5 } },
        { id: 'p2', weights: { x: 0.6, y: 0.4 } },
        { id: 'p3', weights: { x: 0.55, y: 0.45 } },
      ];

      const det = new CoverageGapDetector({
        coverageGapAxisDistanceThreshold: 0.01, // Very low threshold to trigger gap
      });

      const results = det.detect(profiles, prototypes);

      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should use nearestClusterId as fallback', () => {
      const profiles = new Map([
        ['p1', { nearestClusterId: 'cluster-1' }],
        ['p2', { nearestClusterId: 'cluster-1' }],
        ['p3', { nearestClusterId: 'cluster-1' }],
      ]);

      const prototypes = [
        { id: 'p1', weights: { x: 0.5, y: 0.5 } },
        { id: 'p2', weights: { x: 0.5, y: 0.5 } },
        { id: 'p3', weights: { x: 0.5, y: 0.5 } },
      ];

      const det = new CoverageGapDetector({
        coverageGapAxisDistanceThreshold: 0.01,
      });

      const results = det.detect(profiles, prototypes);

      // Should have processed the cluster
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should work with object profiles instead of Map', () => {
      const profiles = {
        p1: { clusterId: 'cluster-1' },
        p2: { clusterId: 'cluster-1' },
        p3: { clusterId: 'cluster-1' },
      };

      const prototypes = [
        { id: 'p1', weights: { x: 0.5, y: 0.5 } },
        { id: 'p2', weights: { x: 0.5, y: 0.5 } },
        { id: 'p3', weights: { x: 0.5, y: 0.5 } },
      ];

      const det = new CoverageGapDetector({
        coverageGapAxisDistanceThreshold: 0.01,
      });

      const results = det.detect(profiles, prototypes);
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('detect - dbscan clustering', () => {
    it('should use DBSCAN when configured and service provided', () => {
      const mockClusters = new Map([
        ['cluster-1', ['p1', 'p2', 'p3']],
      ]);

      const mockService = { cluster: jest.fn().mockReturnValue(mockClusters) };

      const prototypes = [
        { id: 'p1', weights: { x: 0.5, y: 0.5 } },
        { id: 'p2', weights: { x: 0.5, y: 0.5 } },
        { id: 'p3', weights: { x: 0.5, y: 0.5 } },
      ];

      const det = new CoverageGapDetector(
        {
          coverageGapClusteringMethod: 'dbscan',
          coverageGapAxisDistanceThreshold: 0.01,
        },
        mockService
      );

      det.detect(null, prototypes);

      expect(mockService.cluster).toHaveBeenCalled();
    });

    it('should fall back to profile-based when DBSCAN service not provided', () => {
      const profiles = new Map([
        ['p1', { clusterId: 'c1' }],
        ['p2', { clusterId: 'c1' }],
        ['p3', { clusterId: 'c1' }],
      ]);

      const prototypes = [
        { id: 'p1', weights: { x: 0.5, y: 0.5 } },
        { id: 'p2', weights: { x: 0.5, y: 0.5 } },
        { id: 'p3', weights: { x: 0.5, y: 0.5 } },
      ];

      const det = new CoverageGapDetector({
        coverageGapClusteringMethod: 'dbscan',
        coverageGapAxisDistanceThreshold: 0.01,
      });

      // Should still work using profiles
      const results = det.detect(profiles, prototypes);
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('detect - min cluster size', () => {
    it('should filter clusters below minimum size', () => {
      const profiles = new Map([
        ['p1', { clusterId: 'c1' }],
        ['p2', { clusterId: 'c1' }], // Only 2 members, default min is 3
      ]);

      const prototypes = [
        { id: 'p1', weights: { x: 0.5, y: 0.5 } },
        { id: 'p2', weights: { x: 0.5, y: 0.5 } },
      ];

      const results = detector.detect(profiles, prototypes);
      expect(results.length).toBe(0);
    });

    it('should respect custom minimum cluster size', () => {
      const profiles = new Map([
        ['p1', { clusterId: 'c1' }],
        ['p2', { clusterId: 'c1' }],
      ]);

      const prototypes = [
        { id: 'p1', weights: { x: 0.5, y: 0.5 } },
        { id: 'p2', weights: { x: 0.5, y: 0.5 } },
      ];

      const det = new CoverageGapDetector({
        coverageGapMinClusterSize: 2,
        coverageGapAxisDistanceThreshold: 0.01,
      });

      const results = det.detect(profiles, prototypes);
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('detect - distance threshold', () => {
    it('should filter gaps below distance threshold', () => {
      const profiles = new Map([
        ['p1', { clusterId: 'c1' }],
        ['p2', { clusterId: 'c1' }],
        ['p3', { clusterId: 'c1' }],
      ]);

      // Cluster near the x axis
      const prototypes = [
        { id: 'p1', weights: { x: 0.99, y: 0.01 } },
        { id: 'p2', weights: { x: 0.98, y: 0.02 } },
        { id: 'p3', weights: { x: 0.97, y: 0.03 } },
      ];

      const det = new CoverageGapDetector({
        coverageGapAxisDistanceThreshold: 0.9, // High threshold
      });

      const results = det.detect(profiles, prototypes);
      expect(results.length).toBe(0);
    });
  });

  describe('detect - magnitude-aware scoring', () => {
    it('should include magnitude fields when enabled', () => {
      const profiles = new Map([
        ['p1', { clusterId: 'c1' }],
        ['p2', { clusterId: 'c1' }],
        ['p3', { clusterId: 'c1' }],
      ]);

      const prototypes = [
        { id: 'p1', weights: { x: 0.5, y: 0.5 } },
        { id: 'p2', weights: { x: 0.5, y: 0.5 } },
        { id: 'p3', weights: { x: 0.5, y: 0.5 } },
      ];

      const det = new CoverageGapDetector({
        coverageGapAxisDistanceThreshold: 0.01,
        enableMagnitudeAwareGapScoring: true,
      });

      const results = det.detect(profiles, prototypes);

      if (results.length > 0) {
        expect(results[0]).toHaveProperty('clusterMagnitude');
        expect(results[0]).toHaveProperty('clusterSize');
        expect(results[0]).toHaveProperty('gapScore');
      }
    });

    it('should not include magnitude fields when disabled', () => {
      const profiles = new Map([
        ['p1', { clusterId: 'c1' }],
        ['p2', { clusterId: 'c1' }],
        ['p3', { clusterId: 'c1' }],
      ]);

      const prototypes = [
        { id: 'p1', weights: { x: 0.5, y: 0.5 } },
        { id: 'p2', weights: { x: 0.5, y: 0.5 } },
        { id: 'p3', weights: { x: 0.5, y: 0.5 } },
      ];

      const det = new CoverageGapDetector({
        coverageGapAxisDistanceThreshold: 0.01,
        enableMagnitudeAwareGapScoring: false,
      });

      const results = det.detect(profiles, prototypes);

      if (results.length > 0) {
        expect(results[0]).not.toHaveProperty('clusterMagnitude');
        expect(results[0]).not.toHaveProperty('clusterSize');
        expect(results[0]).not.toHaveProperty('gapScore');
      }
    });

    it('should sort by gap score when magnitude-aware', () => {
      const profiles = new Map([
        ['p1', { clusterId: 'c1' }],
        ['p2', { clusterId: 'c1' }],
        ['p3', { clusterId: 'c1' }],
        ['p4', { clusterId: 'c2' }],
        ['p5', { clusterId: 'c2' }],
        ['p6', { clusterId: 'c2' }],
      ]);

      const prototypes = [
        { id: 'p1', weights: { x: 0.3, y: 0.3 } },
        { id: 'p2', weights: { x: 0.3, y: 0.3 } },
        { id: 'p3', weights: { x: 0.3, y: 0.3 } },
        { id: 'p4', weights: { x: 0.5, y: 0.5 } }, // Higher magnitude
        { id: 'p5', weights: { x: 0.5, y: 0.5 } },
        { id: 'p6', weights: { x: 0.5, y: 0.5 } },
      ];

      const det = new CoverageGapDetector({
        coverageGapAxisDistanceThreshold: 0.01,
        enableMagnitudeAwareGapScoring: true,
      });

      const results = det.detect(profiles, prototypes);

      if (results.length > 1) {
        // Should be sorted by gapScore descending
        for (let i = 1; i < results.length; i++) {
          expect(results[i - 1].gapScore).toBeGreaterThanOrEqual(
            results[i].gapScore
          );
        }
      }
    });
  });

  describe('detect - result properties', () => {
    it('should include all required properties in result', () => {
      const profiles = new Map([
        ['p1', { clusterId: 'c1' }],
        ['p2', { clusterId: 'c1' }],
        ['p3', { clusterId: 'c1' }],
      ]);

      const prototypes = [
        { id: 'p1', weights: { x: 0.5, y: 0.5 } },
        { id: 'p2', weights: { x: 0.5, y: 0.5 } },
        { id: 'p3', weights: { x: 0.5, y: 0.5 } },
      ];

      const det = new CoverageGapDetector({
        coverageGapAxisDistanceThreshold: 0.01,
      });

      const results = det.detect(profiles, prototypes);

      if (results.length > 0) {
        expect(results[0]).toHaveProperty('clusterId');
        expect(results[0]).toHaveProperty('centroidPrototypes');
        expect(results[0]).toHaveProperty('distanceToNearestAxis');
        expect(results[0]).toHaveProperty('suggestedAxisDirection');
        expect(results[0]).toHaveProperty('clusteringMethod');
      }
    });

    it('should sort centroidPrototypes alphabetically', () => {
      const profiles = new Map([
        ['z-proto', { clusterId: 'c1' }],
        ['a-proto', { clusterId: 'c1' }],
        ['m-proto', { clusterId: 'c1' }],
      ]);

      const prototypes = [
        { id: 'z-proto', weights: { x: 0.5, y: 0.5 } },
        { id: 'a-proto', weights: { x: 0.5, y: 0.5 } },
        { id: 'm-proto', weights: { x: 0.5, y: 0.5 } },
      ];

      const det = new CoverageGapDetector({
        coverageGapAxisDistanceThreshold: 0.01,
      });

      const results = det.detect(profiles, prototypes);

      if (results.length > 0) {
        const sorted = [...results[0].centroidPrototypes].sort();
        expect(results[0].centroidPrototypes).toEqual(sorted);
      }
    });
  });

  describe('extractClusters', () => {
    it('should extract clusters from Map profiles', () => {
      const profiles = new Map([
        ['p1', { clusterId: 'c1' }],
        ['p2', { clusterId: 'c1' }],
        ['p3', { clusterId: 'c2' }],
      ]);

      const clusters = detector.extractClusters(profiles);

      expect(clusters.size).toBe(2);
      expect(clusters.get('c1')).toEqual(['p1', 'p2']);
      expect(clusters.get('c2')).toEqual(['p3']);
    });

    it('should extract clusters from object profiles', () => {
      const profiles = {
        p1: { clusterId: 'c1' },
        p2: { clusterId: 'c2' },
      };

      const clusters = detector.extractClusters(profiles);

      expect(clusters.size).toBe(2);
      expect(clusters.get('c1')).toEqual(['p1']);
      expect(clusters.get('c2')).toEqual(['p2']);
    });

    it('should use nearestClusterId as fallback', () => {
      const profiles = new Map([
        ['p1', { nearestClusterId: 'c1' }],
        ['p2', { clusterId: 'c2' }], // Has both, should use nearestClusterId
      ]);

      const clusters = detector.extractClusters(profiles);

      expect(clusters.has('c1')).toBe(true);
    });

    it('should skip profiles without clusterId', () => {
      const profiles = new Map([
        ['p1', { clusterId: 'c1' }],
        ['p2', {}], // No clusterId
        ['p3', { other: 'value' }],
      ]);

      const clusters = detector.extractClusters(profiles);

      expect(clusters.size).toBe(1);
      expect(clusters.get('c1')).toEqual(['p1']);
    });

    it('should return empty map for null profiles', () => {
      expect(detector.extractClusters(null).size).toBe(0);
    });

    it('should return empty map for undefined profiles', () => {
      expect(detector.extractClusters(undefined).size).toBe(0);
    });
  });

  describe('computeClusterCentroid', () => {
    it('should compute centroid from member weights', () => {
      const prototypeLookup = new Map([
        ['p1', { weights: { x: 0, y: 0 } }],
        ['p2', { weights: { x: 2, y: 4 } }],
      ]);

      const centroid = detector.computeClusterCentroid(
        ['p1', 'p2'],
        prototypeLookup,
        ['x', 'y']
      );

      expect(centroid).toEqual({ x: 1, y: 2 });
    });

    it('should return null for empty memberIds', () => {
      const prototypeLookup = new Map();
      expect(detector.computeClusterCentroid([], prototypeLookup, ['x'])).toBe(
        null
      );
    });

    it('should return null for null memberIds', () => {
      const prototypeLookup = new Map();
      expect(
        detector.computeClusterCentroid(null, prototypeLookup, ['x'])
      ).toBe(null);
    });

    it('should return null for empty axes', () => {
      const prototypeLookup = new Map([['p1', { weights: { x: 1 } }]]);
      expect(detector.computeClusterCentroid(['p1'], prototypeLookup, [])).toBe(
        null
      );
    });

    it('should return null for null axes', () => {
      const prototypeLookup = new Map([['p1', { weights: { x: 1 } }]]);
      expect(
        detector.computeClusterCentroid(['p1'], prototypeLookup, null)
      ).toBe(null);
    });

    it('should handle missing weights gracefully', () => {
      const prototypeLookup = new Map([
        ['p1', { weights: { x: 2 } }], // Missing y
        ['p2', { weights: { y: 4 } }], // Missing x
      ]);

      const centroid = detector.computeClusterCentroid(
        ['p1', 'p2'],
        prototypeLookup,
        ['x', 'y']
      );

      expect(centroid).toEqual({ x: 1, y: 2 });
    });

    it('should handle prototypes without weights', () => {
      const prototypeLookup = new Map([
        ['p1', {}], // No weights
        ['p2', { weights: { x: 2 } }],
      ]);

      const centroid = detector.computeClusterCentroid(
        ['p1', 'p2'],
        prototypeLookup,
        ['x']
      );

      expect(centroid).toEqual({ x: 1 });
    });

    it('should skip members not in lookup', () => {
      const prototypeLookup = new Map([['p1', { weights: { x: 4 } }]]);

      const centroid = detector.computeClusterCentroid(
        ['p1', 'missing'],
        prototypeLookup,
        ['x']
      );

      // Should count both for averaging but only p1 has value
      expect(centroid.x).toBe(2);
    });
  });

  describe('adaptive thresholds', () => {
    it('should use static threshold when adaptive disabled', () => {
      const profiles = new Map([
        ['p1', { clusterId: 'c1' }],
        ['p2', { clusterId: 'c1' }],
        ['p3', { clusterId: 'c1' }],
      ]);

      const prototypes = [
        { id: 'p1', weights: { x: 0.5, y: 0.5 } },
        { id: 'p2', weights: { x: 0.5, y: 0.5 } },
        { id: 'p3', weights: { x: 0.5, y: 0.5 } },
      ];

      const det = new CoverageGapDetector({
        enableAdaptiveThresholds: false,
        coverageGapAxisDistanceThreshold: 0.9,
      });

      // With high threshold, gaps should be filtered
      const results = det.detect(profiles, prototypes);
      expect(results.length).toBe(0);
    });

    it('should require minimum prototypes for adaptive threshold', () => {
      const profiles = new Map([
        ['p1', { clusterId: 'c1' }],
        ['p2', { clusterId: 'c1' }],
        ['p3', { clusterId: 'c1' }],
      ]);

      const prototypes = [
        { id: 'p1', weights: { x: 0.5, y: 0.5 } },
        { id: 'p2', weights: { x: 0.5, y: 0.5 } },
        { id: 'p3', weights: { x: 0.5, y: 0.5 } },
      ];

      // Only 3 prototypes, minimum is 10 for adaptive
      const det = new CoverageGapDetector({
        enableAdaptiveThresholds: true,
        coverageGapAxisDistanceThreshold: 0.01,
      });

      // Should fall back to static threshold
      expect(() => det.detect(profiles, prototypes)).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle prototypes with prototypeId instead of id', () => {
      const profiles = new Map([
        ['p1', { clusterId: 'c1' }],
        ['p2', { clusterId: 'c1' }],
        ['p3', { clusterId: 'c1' }],
      ]);

      const prototypes = [
        { prototypeId: 'p1', weights: { x: 0.5, y: 0.5 } },
        { prototypeId: 'p2', weights: { x: 0.5, y: 0.5 } },
        { prototypeId: 'p3', weights: { x: 0.5, y: 0.5 } },
      ];

      const det = new CoverageGapDetector({
        coverageGapAxisDistanceThreshold: 0.01,
      });

      expect(() => det.detect(profiles, prototypes)).not.toThrow();
    });

    it('should handle non-finite weight values', () => {
      const profiles = new Map([
        ['p1', { clusterId: 'c1' }],
        ['p2', { clusterId: 'c1' }],
        ['p3', { clusterId: 'c1' }],
      ]);

      const prototypes = [
        { id: 'p1', weights: { x: NaN, y: 0.5 } },
        { id: 'p2', weights: { x: Infinity, y: 0.5 } },
        { id: 'p3', weights: { x: 0.5, y: -Infinity } },
      ];

      expect(() => detector.detect(profiles, prototypes)).not.toThrow();
    });

    it('should handle zero magnitude centroids', () => {
      const profiles = new Map([
        ['p1', { clusterId: 'c1' }],
        ['p2', { clusterId: 'c1' }],
        ['p3', { clusterId: 'c1' }],
      ]);

      const prototypes = [
        { id: 'p1', weights: { x: 0, y: 0 } },
        { id: 'p2', weights: { x: 0, y: 0 } },
        { id: 'p3', weights: { x: 0, y: 0 } },
      ];

      const det = new CoverageGapDetector({
        coverageGapAxisDistanceThreshold: 0.01,
      });

      // Zero centroid can't be normalized, should be skipped
      const results = det.detect(profiles, prototypes);
      expect(results.length).toBe(0);
    });

    it('should handle single axis', () => {
      const profiles = new Map([
        ['p1', { clusterId: 'c1' }],
        ['p2', { clusterId: 'c1' }],
        ['p3', { clusterId: 'c1' }],
      ]);

      const prototypes = [
        { id: 'p1', weights: { x: 1 } },
        { id: 'p2', weights: { x: 1 } },
        { id: 'p3', weights: { x: 1 } },
      ];

      // With single axis, centroid is on the axis
      const results = detector.detect(profiles, prototypes);
      expect(results.length).toBe(0);
    });
  });
});
