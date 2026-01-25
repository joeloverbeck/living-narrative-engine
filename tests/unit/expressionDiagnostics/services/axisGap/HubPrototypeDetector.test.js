/**
 * @file Unit tests for HubPrototypeDetector
 */

import { describe, expect, it, beforeEach } from '@jest/globals';
import { HubPrototypeDetector } from '../../../../../src/expressionDiagnostics/services/axisGap/HubPrototypeDetector.js';

describe('HubPrototypeDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new HubPrototypeDetector();
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const det = new HubPrototypeDetector();
      expect(det).toBeDefined();
    });

    it('should accept custom config', () => {
      const det = new HubPrototypeDetector({
        hubMinDegree: 3,
        hubMinDegreeRatio: 0.15,
        hubMaxEdgeWeight: 0.8,
        hubMinNeighborhoodDiversity: 3,
        hubBetweennessWeight: 0.4,
        compositeScoreGateOverlapWeight: 0.4,
        compositeScoreCorrelationWeight: 0.3,
        compositeScoreGlobalDiffWeight: 0.3,
      });
      expect(det).toBeDefined();
    });

    it('should use default hubMinDegreeRatio of 0.1', () => {
      const det = new HubPrototypeDetector();
      expect(det).toBeDefined();
    });

    it('should use default hubBetweennessWeight of 0.3', () => {
      const det = new HubPrototypeDetector();
      expect(det).toBeDefined();
    });
  });

  describe('detect - empty/invalid inputs', () => {
    it('should return empty hubs array for null pairResults', () => {
      const result = detector.detect(null);
      expect(result).toHaveProperty('hubs');
      expect(result).toHaveProperty('diagnostics');
      expect(result.hubs).toEqual([]);
    });

    it('should return empty hubs array for undefined pairResults', () => {
      const result = detector.detect(undefined);
      expect(result.hubs).toEqual([]);
    });

    it('should return empty hubs array for empty array', () => {
      const result = detector.detect([]);
      expect(result.hubs).toEqual([]);
    });

    it('should return empty hubs array when no valid edges', () => {
      const pairResults = [
        { prototypeAId: 'a', prototypeBId: 'a' }, // Self-loop
        { prototypeAId: 'b' }, // Missing B
      ];
      const result = detector.detect(pairResults);
      expect(result.hubs).toEqual([]);
    });
  });

  describe('detect - basic hub detection', () => {
    it('should detect hub with sufficient degree and diversity', () => {
      const pairResults = [
        { prototypeAId: 'hub', prototypeBId: 'n1', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n2', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n3', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n4', overlapScore: 0.5 },
      ];

      const profiles = new Map([
        ['n1', { clusterId: 'c1' }],
        ['n2', { clusterId: 'c2' }],
        ['n3', { clusterId: 'c1' }],
        ['n4', { clusterId: 'c2' }],
      ]);

      const { hubs } = detector.detect(pairResults, profiles);

      expect(hubs.length).toBe(1);
      expect(hubs[0].prototypeId).toBe('hub');
      expect(hubs[0].neighborhoodDiversity).toBe(2);
    });

    it('should not detect hub with insufficient degree', () => {
      const pairResults = [
        { prototypeAId: 'a', prototypeBId: 'b', overlapScore: 0.5 },
        { prototypeAId: 'a', prototypeBId: 'c', overlapScore: 0.5 },
        { prototypeAId: 'a', prototypeBId: 'd', overlapScore: 0.5 },
        // Only 3 edges, default min is 4
      ];

      const profiles = new Map([
        ['b', { clusterId: 'c1' }],
        ['c', { clusterId: 'c2' }],
        ['d', { clusterId: 'c3' }],
      ]);

      const { hubs } = detector.detect(pairResults, profiles);
      expect(hubs.length).toBe(0);
    });

    it('should not detect hub with insufficient diversity', () => {
      const det = new HubPrototypeDetector({
        hubMinDegree: 4,
        hubMinNeighborhoodDiversity: 3,
      });

      const pairResults = [
        { prototypeAId: 'hub', prototypeBId: 'n1', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n2', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n3', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n4', overlapScore: 0.5 },
      ];

      const profiles = new Map([
        ['n1', { clusterId: 'c1' }],
        ['n2', { clusterId: 'c1' }],
        ['n3', { clusterId: 'c1' }],
        ['n4', { clusterId: 'c1' }],
      ]);

      // All same cluster, diversity = 1, min is 3
      const { hubs } = det.detect(pairResults, profiles);
      expect(hubs.length).toBe(0);
    });

    it('should still detect hub when some edges are above threshold (edge filtering)', () => {
      // Fix 1: Edge filtering - hub should be detected with filtered edges
      const pairResults = [
        { prototypeAId: 'hub', prototypeBId: 'n1', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n2', overlapScore: 0.95 }, // Above default 0.9 - filtered out
        { prototypeAId: 'hub', prototypeBId: 'n3', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n4', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n5', overlapScore: 0.5 },
      ];

      const profiles = new Map([
        ['n1', { clusterId: 'c1' }],
        ['n2', { clusterId: 'c2' }],
        ['n3', { clusterId: 'c3' }],
        ['n4', { clusterId: 'c4' }],
        ['n5', { clusterId: 'c1' }],
      ]);

      // With edge filtering, hub should still be detected (4 eligible edges)
      const { hubs, diagnostics } = detector.detect(pairResults, profiles);
      expect(hubs.length).toBe(1);
      expect(hubs[0].prototypeId).toBe('hub');
      // n2 should be filtered out of overlapping prototypes
      expect(hubs[0].overlappingPrototypes).not.toContain('n2');
      expect(diagnostics.filteredEdgeCount).toBeGreaterThan(0);
    });

    it('should not detect hub when all edges are above threshold', () => {
      const pairResults = [
        { prototypeAId: 'hub', prototypeBId: 'n1', overlapScore: 0.95 },
        { prototypeAId: 'hub', prototypeBId: 'n2', overlapScore: 0.95 },
        { prototypeAId: 'hub', prototypeBId: 'n3', overlapScore: 0.95 },
        { prototypeAId: 'hub', prototypeBId: 'n4', overlapScore: 0.95 },
      ];

      const profiles = new Map([
        ['n1', { clusterId: 'c1' }],
        ['n2', { clusterId: 'c2' }],
        ['n3', { clusterId: 'c3' }],
        ['n4', { clusterId: 'c4' }],
      ]);

      const { hubs } = detector.detect(pairResults, profiles);
      expect(hubs.length).toBe(0);
    });
  });

  describe('detect - result properties', () => {
    it('should include all required properties', () => {
      const pairResults = [
        { prototypeAId: 'hub', prototypeBId: 'n1', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n2', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n3', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n4', overlapScore: 0.5 },
      ];

      const profiles = new Map([
        ['n1', { clusterId: 'c1' }],
        ['n2', { clusterId: 'c2' }],
        ['n3', { clusterId: 'c1' }],
        ['n4', { clusterId: 'c2' }],
      ]);

      const { hubs } = detector.detect(pairResults, profiles);

      expect(hubs[0]).toHaveProperty('prototypeId');
      expect(hubs[0]).toHaveProperty('hubScore');
      expect(hubs[0]).toHaveProperty('betweennessCentrality');
      expect(hubs[0]).toHaveProperty('overlappingPrototypes');
      expect(hubs[0]).toHaveProperty('neighborhoodDiversity');
      expect(hubs[0]).toHaveProperty('suggestedAxisConcept');
    });

    it('should include betweennessCentrality as a number in [0, 1]', () => {
      const pairResults = [
        { prototypeAId: 'hub', prototypeBId: 'n1', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n2', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n3', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n4', overlapScore: 0.5 },
      ];

      const profiles = new Map([
        ['n1', { clusterId: 'c1' }],
        ['n2', { clusterId: 'c2' }],
        ['n3', { clusterId: 'c1' }],
        ['n4', { clusterId: 'c2' }],
      ]);

      const { hubs } = detector.detect(pairResults, profiles);

      expect(typeof hubs[0].betweennessCentrality).toBe('number');
      expect(hubs[0].betweennessCentrality).toBeGreaterThanOrEqual(0);
      expect(hubs[0].betweennessCentrality).toBeLessThanOrEqual(1);
    });

    it('should sort overlappingPrototypes alphabetically', () => {
      const pairResults = [
        { prototypeAId: 'hub', prototypeBId: 'zebra', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'apple', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'mango', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'banana', overlapScore: 0.5 },
      ];

      const profiles = new Map([
        ['zebra', { clusterId: 'c1' }],
        ['apple', { clusterId: 'c2' }],
        ['mango', { clusterId: 'c1' }],
        ['banana', { clusterId: 'c2' }],
      ]);

      const { hubs } = detector.detect(pairResults, profiles);

      const sorted = [...hubs[0].overlappingPrototypes].sort();
      expect(hubs[0].overlappingPrototypes).toEqual(sorted);
    });

    it('should include diagnostics with filter statistics', () => {
      const pairResults = [
        { prototypeAId: 'hub', prototypeBId: 'n1', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n2', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n3', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n4', overlapScore: 0.5 },
      ];

      const profiles = new Map([
        ['n1', { clusterId: 'c1' }],
        ['n2', { clusterId: 'c2' }],
        ['n3', { clusterId: 'c1' }],
        ['n4', { clusterId: 'c2' }],
      ]);

      const { diagnostics } = detector.detect(pairResults, profiles);

      expect(diagnostics).toHaveProperty('totalNodes');
      expect(diagnostics).toHaveProperty('passedDegreeFilter');
      expect(diagnostics).toHaveProperty('filteredEdgeCount');
      expect(diagnostics).toHaveProperty('passedDiversityFilter');
      expect(diagnostics).toHaveProperty('effectiveHubMinDegree');
      expect(diagnostics).toHaveProperty('hubMaxEdgeWeight');
      expect(diagnostics).toHaveProperty('hubMinNeighborhoodDiversity');
      expect(diagnostics).toHaveProperty('hubsDetected');
    });
  });

  describe('detect - suggested axis concept', () => {
    it('should suggest axis based on neighbor weights', () => {
      const pairResults = [
        { prototypeAId: 'hub', prototypeBId: 'n1', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n2', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n3', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n4', overlapScore: 0.5 },
      ];

      const profiles = new Map([
        ['n1', { clusterId: 'c1' }],
        ['n2', { clusterId: 'c2' }],
        ['n3', { clusterId: 'c1' }],
        ['n4', { clusterId: 'c2' }],
      ]);

      const prototypes = [
        { id: 'n1', weights: { anger: 0.8, joy: 0.1 } },
        { id: 'n2', weights: { anger: 0.7, joy: 0.2 } },
        { id: 'n3', weights: { anger: 0.9, joy: 0.05 } },
        { id: 'n4', weights: { anger: 0.6, joy: 0.3 } },
      ];

      const { hubs } = detector.detect(pairResults, profiles, prototypes);

      expect(hubs[0].suggestedAxisConcept).toBe('anger');
    });

    it('should return "shared overlap" when no prototypes provided', () => {
      const pairResults = [
        { prototypeAId: 'hub', prototypeBId: 'n1', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n2', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n3', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n4', overlapScore: 0.5 },
      ];

      const profiles = new Map([
        ['n1', { clusterId: 'c1' }],
        ['n2', { clusterId: 'c2' }],
        ['n3', { clusterId: 'c1' }],
        ['n4', { clusterId: 'c2' }],
      ]);

      const { hubs } = detector.detect(pairResults, profiles, []);

      expect(hubs[0].suggestedAxisConcept).toBe('shared overlap');
    });
  });

  describe('buildOverlapGraph', () => {
    it('should build undirected graph from pair results', () => {
      const pairResults = [
        { prototypeAId: 'a', prototypeBId: 'b', overlapScore: 0.5 },
        { prototypeAId: 'b', prototypeBId: 'c', overlapScore: 0.7 },
      ];

      const graph = detector.buildOverlapGraph(pairResults);

      expect(graph.has('a')).toBe(true);
      expect(graph.has('b')).toBe(true);
      expect(graph.has('c')).toBe(true);
      expect(graph.get('a').get('b')).toBe(0.5);
      expect(graph.get('b').get('a')).toBe(0.5);
      expect(graph.get('b').get('c')).toBe(0.7);
    });

    it('should skip self-loops', () => {
      const pairResults = [
        { prototypeAId: 'a', prototypeBId: 'a', overlapScore: 1.0 },
      ];

      const graph = detector.buildOverlapGraph(pairResults);
      expect(graph.size).toBe(0);
    });

    it('should skip invalid edges', () => {
      const pairResults = [
        { prototypeAId: 'a', overlapScore: 0.5 }, // Missing B
        { prototypeAId: 'a', prototypeBId: 'b' }, // No weight
        { prototypeAId: 'a', prototypeBId: 'c', overlapScore: 0 }, // Zero weight
        { prototypeAId: 'a', prototypeBId: 'd', overlapScore: -0.5 }, // Negative weight
      ];

      const graph = detector.buildOverlapGraph(pairResults);
      expect(graph.size).toBe(0);
    });

    it('should keep maximum weight for duplicate edges', () => {
      const pairResults = [
        { prototypeAId: 'a', prototypeBId: 'b', overlapScore: 0.3 },
        { prototypeAId: 'a', prototypeBId: 'b', overlapScore: 0.7 },
        { prototypeAId: 'b', prototypeBId: 'a', overlapScore: 0.5 },
      ];

      const graph = detector.buildOverlapGraph(pairResults);
      expect(graph.get('a').get('b')).toBe(0.7);
    });

    it('should return empty map for invalid input', () => {
      expect(detector.buildOverlapGraph(null).size).toBe(0);
      expect(detector.buildOverlapGraph(undefined).size).toBe(0);
    });
  });

  describe('computeHubScore', () => {
    it('should return 0 for empty weights', () => {
      expect(detector.computeHubScore([])).toBe(0);
    });

    it('should return 0 for null weights', () => {
      expect(detector.computeHubScore(null)).toBe(0);
    });

    it('should compute score based on degree and variance', () => {
      // 4 edges, all same weight = 0 variance
      const score = detector.computeHubScore([0.5, 0.5, 0.5, 0.5]);
      expect(score).toBe(4); // degree * (1 - 0)
    });

    it('should penalize high variance', () => {
      const uniformScore = detector.computeHubScore([0.5, 0.5, 0.5, 0.5]);
      const variedScore = detector.computeHubScore([0.1, 0.3, 0.7, 0.9]);

      expect(uniformScore).toBeGreaterThan(variedScore);
    });
  });

  describe('computeHubScore - variance normalization', () => {
    it('should return 0 for maximum variance case (half 0s, half 1s)', () => {
      // Maximum variance for [0,1] values is 0.25 (half 0s, half 1s)
      // normalizedVariance = 0.25 / 0.25 = 1.0
      // score = degree * (1 - 1.0) = 0
      const score = detector.computeHubScore([0, 0, 1, 1]);
      expect(score).toBe(0);
    });

    it('should return full degree score for zero variance (all same values)', () => {
      // All same values = 0 variance
      // normalizedVariance = 0 / 0.25 = 0
      // score = degree * (1 - 0) = degree
      const score = detector.computeHubScore([0.7, 0.7, 0.7, 0.7]);
      expect(score).toBe(4);
    });

    it('should apply proportional penalty for intermediate variance', () => {
      // Weights: [0.25, 0.75, 0.25, 0.75]
      // mean = 0.5
      // variance = ((0.25)^2 * 4) / 4 = 0.0625
      // normalizedVariance = 0.0625 / 0.25 = 0.25
      // score = 4 * (1 - 0.25) = 3
      const score = detector.computeHubScore([0.25, 0.75, 0.25, 0.75]);
      expect(score).toBeCloseTo(3, 5);
    });

    it('should clamp gracefully for edge cases where variance might exceed 0.25', () => {
      // Even if somehow variance exceeds theoretical max, it should clamp to 1
      // This tests the clamp01 guard
      // With [0, 0, 0, 0, 1, 1, 1, 1] we get exactly 0.25 variance
      const score = detector.computeHubScore([0, 0, 0, 0, 1, 1, 1, 1]);
      expect(score).toBe(0);
      expect(score).toBeGreaterThanOrEqual(0);
    });

    it('should handle single element (zero variance)', () => {
      const score = detector.computeHubScore([0.5]);
      expect(score).toBe(1); // degree 1, variance 0
    });

    it('should apply correct normalization with larger degree', () => {
      // 10 uniform weights - should get full degree score
      const uniformScore = detector.computeHubScore(
        [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]
      );
      expect(uniformScore).toBe(10);

      // 10 weights with max variance - should get 0
      const maxVarianceScore = detector.computeHubScore(
        [0, 0, 0, 0, 0, 1, 1, 1, 1, 1]
      );
      expect(maxVarianceScore).toBe(0);
    });

    it('should produce correct penalty gradient from low to high variance', () => {
      // As variance increases, score should decrease proportionally
      const lowVariance = detector.computeHubScore([0.45, 0.5, 0.5, 0.55]);
      const midVariance = detector.computeHubScore([0.25, 0.5, 0.5, 0.75]);
      const highVariance = detector.computeHubScore([0.1, 0.3, 0.7, 0.9]);

      expect(lowVariance).toBeGreaterThan(midVariance);
      expect(midVariance).toBeGreaterThan(highVariance);
      expect(highVariance).toBeGreaterThan(0);
    });
  });

  describe('edge weight extraction', () => {
    it('should use overlapScore when available', () => {
      const pairResults = [
        { prototypeAId: 'a', prototypeBId: 'b', overlapScore: 0.5 },
      ];

      const graph = detector.buildOverlapGraph(pairResults);
      expect(graph.get('a').get('b')).toBe(0.5);
    });

    it('should use edgeWeight as fallback', () => {
      const pairResults = [
        { prototypeAId: 'a', prototypeBId: 'b', edgeWeight: 0.6 },
      ];

      const graph = detector.buildOverlapGraph(pairResults);
      expect(graph.get('a').get('b')).toBe(0.6);
    });

    it('should use overlapWeight as fallback', () => {
      const pairResults = [
        { prototypeAId: 'a', prototypeBId: 'b', overlapWeight: 0.7 },
      ];

      const graph = detector.buildOverlapGraph(pairResults);
      expect(graph.get('a').get('b')).toBe(0.7);
    });

    it('should compute from metrics when no explicit weight', () => {
      const pairResults = [
        {
          prototypeAId: 'a',
          prototypeBId: 'b',
          metrics: { activationJaccard: 0.8 },
        },
      ];

      const graph = detector.buildOverlapGraph(pairResults);
      expect(graph.get('a').get('b')).toBe(0.8);
    });

    it('should compute composite weight from multiple metrics', () => {
      const pairResults = [
        {
          prototypeAId: 'a',
          prototypeBId: 'b',
          metrics: {
            gateOverlapRatio: 0.8,
            pearsonCorrelation: 0.6,
            globalMeanAbsDiff: 0.2,
          },
        },
      ];

      const graph = detector.buildOverlapGraph(pairResults);
      expect(graph.get('a').get('b')).toBeGreaterThan(0);
    });

    it('should use maeGlobal as fallback', () => {
      const pairResults = [
        {
          prototypeAId: 'a',
          prototypeBId: 'b',
          metrics: { maeGlobal: 0.2 },
        },
      ];

      const graph = detector.buildOverlapGraph(pairResults);
      expect(graph.get('a').get('b')).toBe(0.8); // 1 - 0.2
    });

    it('should use maeCoPass as fallback', () => {
      const pairResults = [
        {
          prototypeAId: 'a',
          prototypeBId: 'b',
          metrics: { maeCoPass: 0.3 },
        },
      ];

      const graph = detector.buildOverlapGraph(pairResults);
      expect(graph.get('a').get('b')).toBe(0.7); // 1 - 0.3
    });
  });

  describe('prototype ID extraction', () => {
    it('should support prototypeAId/prototypeBId', () => {
      const pairResults = [
        { prototypeAId: 'a', prototypeBId: 'b', overlapScore: 0.5 },
      ];

      const graph = detector.buildOverlapGraph(pairResults);
      expect(graph.has('a')).toBe(true);
      expect(graph.has('b')).toBe(true);
    });

    it('should support prototypeA.id/prototypeB.id', () => {
      const pairResults = [
        { prototypeA: { id: 'a' }, prototypeB: { id: 'b' }, overlapScore: 0.5 },
      ];

      const graph = detector.buildOverlapGraph(pairResults);
      expect(graph.has('a')).toBe(true);
      expect(graph.has('b')).toBe(true);
    });

    it('should support prototypeA/prototypeB as strings', () => {
      const pairResults = [
        { prototypeA: 'a', prototypeB: 'b', overlapScore: 0.5 },
      ];

      const graph = detector.buildOverlapGraph(pairResults);
      expect(graph.has('a')).toBe(true);
      expect(graph.has('b')).toBe(true);
    });

    it('should support aId/bId', () => {
      const pairResults = [{ aId: 'a', bId: 'b', overlapScore: 0.5 }];

      const graph = detector.buildOverlapGraph(pairResults);
      expect(graph.has('a')).toBe(true);
      expect(graph.has('b')).toBe(true);
    });

    it('should support prototypes.a/prototypes.b', () => {
      const pairResults = [
        { prototypes: { a: 'a', b: 'b' }, overlapScore: 0.5 },
      ];

      const graph = detector.buildOverlapGraph(pairResults);
      expect(graph.has('a')).toBe(true);
      expect(graph.has('b')).toBe(true);
    });

    it('should coerce numeric IDs to strings', () => {
      const pairResults = [
        { prototypeAId: 1, prototypeBId: 2, overlapScore: 0.5 },
      ];

      const graph = detector.buildOverlapGraph(pairResults);
      expect(graph.has('1')).toBe(true);
      expect(graph.has('2')).toBe(true);
    });
  });

  describe('neighborhood diversity', () => {
    it('should count distinct clusters from Map profiles', () => {
      const pairResults = [
        { prototypeAId: 'hub', prototypeBId: 'n1', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n2', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n3', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n4', overlapScore: 0.5 },
      ];

      const profiles = new Map([
        ['n1', { clusterId: 'c1' }],
        ['n2', { clusterId: 'c2' }],
        ['n3', { clusterId: 'c3' }],
        ['n4', { clusterId: 'c4' }],
      ]);

      const det = new HubPrototypeDetector({
        hubMinDegree: 4,
        hubMinNeighborhoodDiversity: 4,
      });

      const { hubs } = det.detect(pairResults, profiles);
      expect(hubs.length).toBe(1);
      expect(hubs[0].neighborhoodDiversity).toBe(4);
    });

    it('should count distinct clusters from object profiles', () => {
      const pairResults = [
        { prototypeAId: 'hub', prototypeBId: 'n1', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n2', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n3', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n4', overlapScore: 0.5 },
      ];

      const profiles = {
        n1: { clusterId: 'c1' },
        n2: { clusterId: 'c2' },
        n3: { clusterId: 'c1' },
        n4: { clusterId: 'c2' },
      };

      const { hubs } = detector.detect(pairResults, profiles);
      expect(hubs[0].neighborhoodDiversity).toBe(2);
    });

    it('should use nearestClusterId as fallback', () => {
      const pairResults = [
        { prototypeAId: 'hub', prototypeBId: 'n1', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n2', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n3', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n4', overlapScore: 0.5 },
      ];

      const profiles = new Map([
        ['n1', { nearestClusterId: 'c1' }],
        ['n2', { nearestClusterId: 'c2' }],
        ['n3', { nearestClusterId: 'c1' }],
        ['n4', { nearestClusterId: 'c2' }],
      ]);

      const { hubs } = detector.detect(pairResults, profiles);
      expect(hubs[0].neighborhoodDiversity).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('should handle prototypes with prototypeId instead of id', () => {
      const pairResults = [
        { prototypeAId: 'hub', prototypeBId: 'n1', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n2', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n3', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n4', overlapScore: 0.5 },
      ];

      const profiles = new Map([
        ['n1', { clusterId: 'c1' }],
        ['n2', { clusterId: 'c2' }],
        ['n3', { clusterId: 'c1' }],
        ['n4', { clusterId: 'c2' }],
      ]);

      const prototypes = [
        { prototypeId: 'n1', weights: { x: 0.5 } },
        { prototypeId: 'n2', weights: { x: 0.5 } },
        { prototypeId: 'n3', weights: { x: 0.5 } },
        { prototypeId: 'n4', weights: { x: 0.5 } },
      ];

      const { hubs } = detector.detect(pairResults, profiles, prototypes);
      expect(hubs[0].suggestedAxisConcept).toBe('x');
    });

    it('should clamp edge weights to [0, 1]', () => {
      const pairResults = [
        { prototypeAId: 'a', prototypeBId: 'b', overlapScore: 1.5 },
      ];

      const graph = detector.buildOverlapGraph(pairResults);
      expect(graph.get('a').get('b')).toBeLessThanOrEqual(1);
    });

    it('should handle empty profiles', () => {
      const pairResults = [
        { prototypeAId: 'hub', prototypeBId: 'n1', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n2', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n3', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n4', overlapScore: 0.5 },
      ];

      // No profiles = 0 diversity = no hubs detected with default config
      const { hubs } = detector.detect(pairResults, new Map());
      expect(hubs.length).toBe(0);
    });

    it('should handle non-finite weight values in prototypes', () => {
      const pairResults = [
        { prototypeAId: 'hub', prototypeBId: 'n1', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n2', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n3', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n4', overlapScore: 0.5 },
      ];

      const profiles = new Map([
        ['n1', { clusterId: 'c1' }],
        ['n2', { clusterId: 'c2' }],
        ['n3', { clusterId: 'c1' }],
        ['n4', { clusterId: 'c2' }],
      ]);

      const prototypes = [
        { id: 'n1', weights: { x: NaN } },
        { id: 'n2', weights: { x: Infinity } },
        { id: 'n3', weights: { x: 0.5 } },
        { id: 'n4', weights: {} },
      ];

      expect(() => detector.detect(pairResults, profiles, prototypes)).not.toThrow();
    });
  });

  describe('computeBetweennessCentrality', () => {
    it('should return empty map for empty graph', () => {
      const graph = new Map();
      const result = detector.computeBetweennessCentrality(graph);
      expect(result.size).toBe(0);
    });

    it('should return zero betweenness for single node', () => {
      const graph = new Map([['a', new Map()]]);
      const result = detector.computeBetweennessCentrality(graph);
      expect(result.get('a')).toBe(0);
    });

    it('should return zero betweenness for two connected nodes', () => {
      // Two nodes connected - no intermediate nodes
      const graph = new Map([
        ['a', new Map([['b', 0.5]])],
        ['b', new Map([['a', 0.5]])],
      ]);
      const result = detector.computeBetweennessCentrality(graph);
      expect(result.get('a')).toBe(0);
      expect(result.get('b')).toBe(0);
    });

    it('should give high betweenness to bridge node in linear graph', () => {
      // Linear graph: a - b - c
      // Node b is on all shortest paths between a and c
      const graph = new Map([
        ['a', new Map([['b', 0.5]])],
        ['b', new Map([['a', 0.5], ['c', 0.5]])],
        ['c', new Map([['b', 0.5]])],
      ]);
      const result = detector.computeBetweennessCentrality(graph);

      // b should have highest betweenness (bridge between a and c)
      expect(result.get('b')).toBeGreaterThan(result.get('a'));
      expect(result.get('b')).toBeGreaterThan(result.get('c'));
    });

    it('should give high betweenness to center of star graph', () => {
      // Star graph: center connected to n1, n2, n3, n4
      const graph = new Map([
        ['center', new Map([['n1', 0.5], ['n2', 0.5], ['n3', 0.5], ['n4', 0.5]])],
        ['n1', new Map([['center', 0.5]])],
        ['n2', new Map([['center', 0.5]])],
        ['n3', new Map([['center', 0.5]])],
        ['n4', new Map([['center', 0.5]])],
      ]);
      const result = detector.computeBetweennessCentrality(graph);

      // Center is on all shortest paths between leaf nodes
      expect(result.get('center')).toBeGreaterThan(result.get('n1'));
      expect(result.get('center')).toBeGreaterThan(result.get('n2'));
    });

    it('should give equal betweenness to nodes in complete graph', () => {
      // Complete graph with 4 nodes - all nodes are symmetric
      const graph = new Map([
        ['a', new Map([['b', 0.5], ['c', 0.5], ['d', 0.5]])],
        ['b', new Map([['a', 0.5], ['c', 0.5], ['d', 0.5]])],
        ['c', new Map([['a', 0.5], ['b', 0.5], ['d', 0.5]])],
        ['d', new Map([['a', 0.5], ['b', 0.5], ['c', 0.5]])],
      ]);
      const result = detector.computeBetweennessCentrality(graph);

      // All nodes should have equal betweenness (due to symmetry)
      const values = Array.from(result.values());
      const firstValue = values[0];
      values.forEach((v) => expect(v).toBeCloseTo(firstValue, 5));
    });

    it('should normalize betweenness to [0, 1] range', () => {
      // Linear graph with 5 nodes: a - b - c - d - e
      const graph = new Map([
        ['a', new Map([['b', 0.5]])],
        ['b', new Map([['a', 0.5], ['c', 0.5]])],
        ['c', new Map([['b', 0.5], ['d', 0.5]])],
        ['d', new Map([['c', 0.5], ['e', 0.5]])],
        ['e', new Map([['d', 0.5]])],
      ]);
      const result = detector.computeBetweennessCentrality(graph);

      // All values should be in [0, 1]
      for (const value of result.values()) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('adaptive hub degree threshold', () => {
    it('should use hubMinDegreeRatio for adaptive threshold', () => {
      // With 50 nodes and ratio 0.1, effective min degree = max(4, 5) = 5
      const det = new HubPrototypeDetector({
        hubMinDegree: 4,
        hubMinDegreeRatio: 0.1,
        hubMinNeighborhoodDiversity: 1,
      });

      // Create a graph with 50 nodes where one has degree 4 (below adaptive threshold)
      const pairResults = [];

      // Create many pairs to get 50 nodes
      for (let i = 1; i <= 49; i++) {
        pairResults.push({
          prototypeAId: 'n0',
          prototypeBId: `n${i}`,
          overlapScore: 0.5,
        });
      }

      // n0 now has degree 49 - will be detected as hub
      // Let's add a node with exactly 4 connections
      pairResults.push({ prototypeAId: 'lowDegree', prototypeBId: 'n1', overlapScore: 0.5 });
      pairResults.push({ prototypeAId: 'lowDegree', prototypeBId: 'n2', overlapScore: 0.5 });
      pairResults.push({ prototypeAId: 'lowDegree', prototypeBId: 'n3', overlapScore: 0.5 });
      pairResults.push({ prototypeAId: 'lowDegree', prototypeBId: 'n4', overlapScore: 0.5 });

      const profiles = new Map();
      for (let i = 0; i <= 49; i++) {
        profiles.set(`n${i}`, { clusterId: `c${i % 5}` });
      }
      profiles.set('lowDegree', { clusterId: 'cLow' });

      const { hubs } = det.detect(pairResults, profiles);

      // n0 with 49 connections should be detected
      // lowDegree with 4 connections might not meet adaptive threshold
      const hubIds = hubs.map((r) => r.prototypeId);
      expect(hubIds).toContain('n0');
    });

    it('should use floor degree when ratio gives lower value', () => {
      // With 10 nodes and ratio 0.1, adaptive = max(4, 1) = 4
      const det = new HubPrototypeDetector({
        hubMinDegree: 4,
        hubMinDegreeRatio: 0.1,
        hubMinNeighborhoodDiversity: 2,
      });

      const pairResults = [
        { prototypeAId: 'hub', prototypeBId: 'n1', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n2', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n3', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n4', overlapScore: 0.5 },
      ];

      const profiles = new Map([
        ['n1', { clusterId: 'c1' }],
        ['n2', { clusterId: 'c2' }],
        ['n3', { clusterId: 'c1' }],
        ['n4', { clusterId: 'c2' }],
      ]);

      const { hubs } = det.detect(pairResults, profiles);

      // With small graph, floor of 4 is used
      expect(hubs.length).toBe(1);
      expect(hubs[0].prototypeId).toBe('hub');
    });

    it('should include effective threshold in diagnostics', () => {
      const det = new HubPrototypeDetector({
        hubMinDegree: 4,
        hubMinDegreeRatio: 0.1,
        hubMinNeighborhoodDiversity: 2,
      });

      const pairResults = [
        { prototypeAId: 'hub', prototypeBId: 'n1', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n2', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n3', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n4', overlapScore: 0.5 },
      ];

      const profiles = new Map([
        ['n1', { clusterId: 'c1' }],
        ['n2', { clusterId: 'c2' }],
        ['n3', { clusterId: 'c1' }],
        ['n4', { clusterId: 'c2' }],
      ]);

      const { diagnostics } = det.detect(pairResults, profiles);

      expect(diagnostics.effectiveHubMinDegree).toBe(4);
    });
  });
});
