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
        hubMaxEdgeWeight: 0.8,
        hubMinNeighborhoodDiversity: 3,
        compositeScoreGateOverlapWeight: 0.4,
        compositeScoreCorrelationWeight: 0.3,
        compositeScoreGlobalDiffWeight: 0.3,
      });
      expect(det).toBeDefined();
    });
  });

  describe('detect - empty/invalid inputs', () => {
    it('should return empty array for null pairResults', () => {
      expect(detector.detect(null)).toEqual([]);
    });

    it('should return empty array for undefined pairResults', () => {
      expect(detector.detect(undefined)).toEqual([]);
    });

    it('should return empty array for empty array', () => {
      expect(detector.detect([])).toEqual([]);
    });

    it('should return empty array when no valid edges', () => {
      const pairResults = [
        { prototypeAId: 'a', prototypeBId: 'a' }, // Self-loop
        { prototypeAId: 'b' }, // Missing B
      ];
      expect(detector.detect(pairResults)).toEqual([]);
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

      const results = detector.detect(pairResults, profiles);

      expect(results.length).toBe(1);
      expect(results[0].prototypeId).toBe('hub');
      expect(results[0].neighborhoodDiversity).toBe(2);
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

      const results = detector.detect(pairResults, profiles);
      expect(results.length).toBe(0);
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
      const results = det.detect(pairResults, profiles);
      expect(results.length).toBe(0);
    });

    it('should not detect hub with edge weight above threshold', () => {
      const pairResults = [
        { prototypeAId: 'hub', prototypeBId: 'n1', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n2', overlapScore: 0.95 }, // Above default 0.9
        { prototypeAId: 'hub', prototypeBId: 'n3', overlapScore: 0.5 },
        { prototypeAId: 'hub', prototypeBId: 'n4', overlapScore: 0.5 },
      ];

      const profiles = new Map([
        ['n1', { clusterId: 'c1' }],
        ['n2', { clusterId: 'c2' }],
        ['n3', { clusterId: 'c3' }],
        ['n4', { clusterId: 'c4' }],
      ]);

      const results = detector.detect(pairResults, profiles);
      expect(results.length).toBe(0);
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

      const results = detector.detect(pairResults, profiles);

      expect(results[0]).toHaveProperty('prototypeId');
      expect(results[0]).toHaveProperty('hubScore');
      expect(results[0]).toHaveProperty('overlappingPrototypes');
      expect(results[0]).toHaveProperty('neighborhoodDiversity');
      expect(results[0]).toHaveProperty('suggestedAxisConcept');
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

      const results = detector.detect(pairResults, profiles);

      const sorted = [...results[0].overlappingPrototypes].sort();
      expect(results[0].overlappingPrototypes).toEqual(sorted);
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

      const results = detector.detect(pairResults, profiles, prototypes);

      expect(results[0].suggestedAxisConcept).toBe('anger');
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

      const results = detector.detect(pairResults, profiles, []);

      expect(results[0].suggestedAxisConcept).toBe('shared overlap');
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

      const results = det.detect(pairResults, profiles);
      expect(results.length).toBe(1);
      expect(results[0].neighborhoodDiversity).toBe(4);
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

      const results = detector.detect(pairResults, profiles);
      expect(results[0].neighborhoodDiversity).toBe(2);
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

      const results = detector.detect(pairResults, profiles);
      expect(results[0].neighborhoodDiversity).toBe(2);
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

      const results = detector.detect(pairResults, profiles, prototypes);
      expect(results[0].suggestedAxisConcept).toBe('x');
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
      const results = detector.detect(pairResults, new Map());
      expect(results.length).toBe(0);
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
});
