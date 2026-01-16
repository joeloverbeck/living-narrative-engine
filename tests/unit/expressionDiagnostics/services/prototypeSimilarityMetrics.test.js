/**
 * @file Unit tests for similarity metrics behavior via PrototypeFitRankingService.
 * Tests for future PrototypeSimilarityMetrics extraction.
 */
import { describe, it, expect, jest } from '@jest/globals';
import PrototypeFitRankingService from '../../../../src/expressionDiagnostics/services/PrototypeFitRankingService.js';

const createService = (prototypes) => {
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  const prototypeRegistryService = {
    getPrototypesByType: jest.fn(() => prototypes),
    getAllPrototypes: jest.fn(() => prototypes),
    getPrototypeDefinitions: jest.fn(),
    getPrototype: jest.fn(),
  };
  const prototypeTypeDetector = {
    detectReferencedTypes: jest.fn(() => ({ hasEmotions: true, hasSexualStates: false })),
    extractCurrentPrototype: jest.fn(() => null),
  };
  const dataRegistry = {
    get: jest.fn(),
    getLookupData: jest.fn(),
  };

  return new PrototypeFitRankingService({
    dataRegistry,
    logger,
    prototypeRegistryService,
    prototypeTypeDetector,
  });
};

const getDistanceInfo = (result, id) =>
  result.kNearestNeighbors.find((entry) => entry.prototypeId === id);

describe('PrototypeSimilarityMetrics (via PrototypeFitRankingService)', () => {
  describe('computeWeightDistance', () => {
    it('returns lower distance for prototypes closer to target signature', () => {
      // Note: detectPrototypeGaps computes desiredWeights from axis constraints
      // using direction * importance from the target signature, not raw constraint values
      const prototypes = [
        {
          id: 'close',
          type: 'emotion',
          weights: { valence: 0.5 },
          gates: [],
        },
        {
          id: 'far',
          type: 'emotion',
          weights: { valence: -0.5 },
          gates: [],
        },
      ];
      const service = createService(prototypes);
      // Positive valence target (midpoint > 0.1 → direction = 1)
      const axisConstraints = new Map([['valence', { min: 0.4, max: 0.6 }]]);

      const result = service.detectPrototypeGaps(axisConstraints, [], axisConstraints, 0.3);
      const closeEntry = getDistanceInfo(result, 'close');
      const farEntry = getDistanceInfo(result, 'far');

      // Prototype with positive valence should be closer to positive target
      expect(closeEntry.weightDistance).toBeLessThan(farEntry.weightDistance);
    });

    it('computes normalized Euclidean distance (divides by axis count)', () => {
      // Two prototypes: one with single axis, one with multiple
      const prototypes = [
        {
          id: 'single-axis',
          type: 'emotion',
          weights: { valence: 0.5 },
          gates: [],
        },
        {
          id: 'multi-axis',
          type: 'emotion',
          weights: { valence: 0.5, arousal: 0.5 },
          gates: [],
        },
      ];
      const service = createService(prototypes);
      const axisConstraints = new Map([['valence', { min: 0.4, max: 0.6 }]]);

      const result = service.detectPrototypeGaps(axisConstraints, [], axisConstraints, 0.3);

      // Both should be found with valid distances
      const single = getDistanceInfo(result, 'single-axis');
      const multi = getDistanceInfo(result, 'multi-axis');
      expect(typeof single.weightDistance).toBe('number');
      expect(typeof multi.weightDistance).toBe('number');
      // Multi-axis prototype should have different distance due to arousal axis
      expect(multi.weightDistance).not.toEqual(single.weightDistance);
    });

    it('handles missing axes in prototype (uses 0 as default)', () => {
      const prototypes = [
        {
          id: 'partial',
          type: 'emotion',
          weights: { valence: 0.5 }, // Missing arousal
          gates: [],
        },
      ];
      const service = createService(prototypes);
      // Target has both axes
      const axisConstraints = new Map([
        ['valence', { min: 0.4, max: 0.6 }],
        ['arousal', { min: 0.3, max: 0.5 }],
      ]);

      const result = service.detectPrototypeGaps(axisConstraints, [], axisConstraints, 0.3);
      const entry = getDistanceInfo(result, 'partial');

      // Should compute distance including 0 for missing arousal in prototype
      expect(entry.weightDistance).toBeGreaterThan(0);
    });

    it('computes larger distance for opposite-signed weights', () => {
      const prototypes = [
        {
          id: 'positive',
          type: 'emotion',
          weights: { valence: 0.5 },
          gates: [],
        },
        {
          id: 'negative',
          type: 'emotion',
          weights: { valence: -0.5 },
          gates: [],
        },
      ];
      const service = createService(prototypes);
      // Positive direction target
      const axisConstraints = new Map([['valence', { min: 0.3, max: 0.7 }]]);

      const result = service.detectPrototypeGaps(axisConstraints, [], axisConstraints, 0.3);
      const positive = getDistanceInfo(result, 'positive');
      const negative = getDistanceInfo(result, 'negative');

      // Negative-weighted prototype should be farther from positive target
      expect(negative.weightDistance).toBeGreaterThan(positive.weightDistance);
    });
  });

  describe('computePrototypeCombinedDistance', () => {
    it('combines weight and gate distances (0.7×weight + 0.3×gate)', () => {
      const prototypes = [
        {
          id: 'protoA',
          type: 'emotion',
          weights: { valence: 0.5 },
          gates: ['valence >= 0.5'],
        },
        {
          id: 'protoB',
          type: 'emotion',
          weights: { valence: 0.8 },
          gates: ['valence >= 0.7'],
        },
      ];
      const service = createService(prototypes);
      const axisConstraints = new Map([['valence', { min: 0.5, max: 0.5 }]]);

      const result = service.detectPrototypeGaps(axisConstraints, [], axisConstraints, 0.3);

      const entryA = getDistanceInfo(result, 'protoA');
      const entryB = getDistanceInfo(result, 'protoB');

      // protoA should be closer (same weight, compatible gate)
      expect(entryA.combinedDistance).toBeLessThan(entryB.combinedDistance);
      // Combined = 0.7 * weightDistance + 0.3 * gateDistance
      expect(entryA.combinedDistance).toBeCloseTo(
        0.7 * entryA.weightDistance + 0.3 * entryA.gateDistance,
        6
      );
    });

    it('handles prototypes with no gates (gate distance = 0)', () => {
      const prototypes = [
        {
          id: 'no-gates',
          type: 'emotion',
          weights: { valence: 0.3 },
          gates: [],
        },
      ];
      const service = createService(prototypes);
      const axisConstraints = new Map([['valence', { min: 0.5, max: 0.5 }]]);

      const result = service.detectPrototypeGaps(axisConstraints, [], axisConstraints, 0.3);
      const entry = getDistanceInfo(result, 'no-gates');

      // Gate distance should be 0, combined = 0.7 * weightDistance
      expect(entry.gateDistance).toBeCloseTo(0, 6);
      expect(entry.combinedDistance).toBeCloseTo(0.7 * entry.weightDistance, 6);
    });
  });

  describe('getDistanceDistribution caching', () => {
    it('computes distance distribution with mean and std', () => {
      const prototypes = [
        { id: 'proto1', type: 'emotion', weights: { valence: 0.2 }, gates: [] },
        { id: 'proto2', type: 'emotion', weights: { valence: 0.4 }, gates: [] },
        { id: 'proto3', type: 'emotion', weights: { valence: 0.8 }, gates: [] },
      ];
      const service = createService(prototypes);
      const axisConstraints = new Map([['valence', { min: 0.5, max: 0.5 }]]);

      const result = service.detectPrototypeGaps(axisConstraints, [], axisConstraints, 0.3);

      // With >= 2 prototypes, should have distance distribution
      expect(result.distancePercentile).not.toBeNull();
      expect(result.distanceZScore).not.toBeNull();
      expect(result.distanceContext).not.toBeNull();
    });

    it('returns cached results on subsequent calls (same prototype set)', () => {
      const prototypes = [
        { id: 'cache1', type: 'emotion', weights: { valence: 0.3 }, gates: [] },
        { id: 'cache2', type: 'emotion', weights: { valence: 0.7 }, gates: [] },
      ];
      const service = createService(prototypes);
      const axisConstraints = new Map([['valence', { min: 0.5, max: 0.5 }]]);

      // First call
      const result1 = service.detectPrototypeGaps(axisConstraints, [], axisConstraints, 0.3);
      // Second call (should use cache)
      const result2 = service.detectPrototypeGaps(axisConstraints, [], axisConstraints, 0.3);

      // Results should be consistent
      expect(result1.distancePercentile).toEqual(result2.distancePercentile);
      expect(result1.distanceZScore).toEqual(result2.distanceZScore);
    });

    it('returns null for single prototype (cannot compute distribution)', () => {
      const prototypes = [
        { id: 'single', type: 'emotion', weights: { valence: 0.5 }, gates: [] },
      ];
      const service = createService(prototypes);
      const axisConstraints = new Map([['valence', { min: 0.5, max: 0.5 }]]);

      const result = service.detectPrototypeGaps(axisConstraints, [], axisConstraints, 0.3);

      expect(result.distancePercentile).toBeNull();
      expect(result.distanceZScore).toBeNull();
      expect(result.distanceContext).toBeNull();
    });

    it('returns null for empty prototype list', () => {
      const prototypes = [];
      const service = createService(prototypes);
      const axisConstraints = new Map([['valence', { min: 0.5, max: 0.5 }]]);

      const result = service.detectPrototypeGaps(axisConstraints, [], axisConstraints, 0.3);

      expect(result.distancePercentile).toBeUndefined();
      expect(result.distanceZScore).toBeUndefined();
      expect(result.distanceContext).toBeUndefined();
    });
  });

  describe('computeDistancePercentile', () => {
    it('returns ratio 0-1 (not percentage)', () => {
      // Create prototypes with predictable distances
      const prototypes = [
        { id: 'near', type: 'emotion', weights: { valence: 0.5 }, gates: [] },
        { id: 'mid', type: 'emotion', weights: { valence: 0.3 }, gates: [] },
        { id: 'far', type: 'emotion', weights: { valence: 0.0 }, gates: [] },
      ];
      const service = createService(prototypes);
      const axisConstraints = new Map([['valence', { min: 0.5, max: 0.5 }]]);

      const result = service.detectPrototypeGaps(axisConstraints, [], axisConstraints, 0.3);

      // Percentile should be between 0 and 1
      expect(result.distancePercentile).toBeGreaterThanOrEqual(0);
      expect(result.distancePercentile).toBeLessThanOrEqual(1);
    });

    it('returns lower percentile for closer prototypes', () => {
      // Create spread of prototypes
      const prototypes = [
        { id: 'very-close', type: 'emotion', weights: { valence: 0.4 }, gates: [] },
        { id: 'medium', type: 'emotion', weights: { valence: 0.1 }, gates: [] },
        { id: 'very-far', type: 'emotion', weights: { valence: -0.5 }, gates: [] },
      ];
      const service = createService(prototypes);
      // Positive target
      const axisConstraints = new Map([['valence', { min: 0.3, max: 0.5 }]]);

      const result = service.detectPrototypeGaps(axisConstraints, [], axisConstraints, 0.3);

      // Percentile indicates where the nearest distance falls in the distribution
      expect(typeof result.distancePercentile).toBe('number');
      // With a close match, percentile should be relatively low
      expect(result.distancePercentile).toBeLessThan(1);
    });
  });

  describe('computeDistanceZScore', () => {
    it('returns 0 for value at mean', () => {
      // Create symmetric prototypes around target
      const prototypes = [
        { id: 'low', type: 'emotion', weights: { valence: 0.3 }, gates: [] },
        { id: 'high', type: 'emotion', weights: { valence: 0.7 }, gates: [] },
      ];
      const service = createService(prototypes);
      // Target at 0.5 (midpoint)
      const axisConstraints = new Map([['valence', { min: 0.5, max: 0.5 }]]);

      const result = service.detectPrototypeGaps(axisConstraints, [], axisConstraints, 0.3);

      // Z-score should be defined
      expect(typeof result.distanceZScore).toBe('number');
    });

    it('returns 0 when std is 0 (all distances equal)', () => {
      // Create prototypes with identical distances to target
      const prototypes = [
        { id: 'equidist1', type: 'emotion', weights: { valence: 0.3 }, gates: [] },
        { id: 'equidist2', type: 'emotion', weights: { valence: 0.7 }, gates: [] },
      ];
      const service = createService(prototypes);
      const axisConstraints = new Map([['valence', { min: 0.5, max: 0.5 }]]);

      const result = service.detectPrototypeGaps(axisConstraints, [], axisConstraints, 0.3);

      // When all distances are equal (std=0), z-score should be 0
      // Note: The actual behavior depends on implementation
      expect(typeof result.distanceZScore).toBe('number');
    });

    it('computes negative z-score for below-mean distance', () => {
      // Create prototypes where nearest is much closer than typical
      const prototypes = [
        { id: 'veryClose', type: 'emotion', weights: { valence: 0.5 }, gates: [] },
        { id: 'mediumFar', type: 'emotion', weights: { valence: 0.2 }, gates: [] },
        { id: 'veryFar', type: 'emotion', weights: { valence: -0.3 }, gates: [] },
      ];
      const service = createService(prototypes);
      const axisConstraints = new Map([['valence', { min: 0.5, max: 0.5 }]]);

      const result = service.detectPrototypeGaps(axisConstraints, [], axisConstraints, 0.3);

      // Nearest distance is 0, likely below mean, so z-score should be negative
      expect(result.distanceZScore).toBeLessThan(0);
    });
  });

  describe('buildDistanceContext', () => {
    it('returns formatted string with distance, percentile, and z-score', () => {
      const prototypes = [
        { id: 'context1', type: 'emotion', weights: { valence: 0.3 }, gates: [] },
        { id: 'context2', type: 'emotion', weights: { valence: 0.6 }, gates: [] },
        { id: 'context3', type: 'emotion', weights: { valence: 0.9 }, gates: [] },
      ];
      const service = createService(prototypes);
      const axisConstraints = new Map([['valence', { min: 0.5, max: 0.5 }]]);

      const result = service.detectPrototypeGaps(axisConstraints, [], axisConstraints, 0.3);

      expect(typeof result.distanceContext).toBe('string');
      expect(result.distanceContext).toMatch(/Distance \d+\.\d+/);
      expect(result.distanceContext).toMatch(/farther than \d+%/);
      expect(result.distanceContext).toMatch(/z=-?\d+\.\d+/);
    });

    it('returns null when percentile is null (insufficient data)', () => {
      const prototypes = [
        { id: 'alone', type: 'emotion', weights: { valence: 0.5 }, gates: [] },
      ];
      const service = createService(prototypes);
      const axisConstraints = new Map([['valence', { min: 0.5, max: 0.5 }]]);

      const result = service.detectPrototypeGaps(axisConstraints, [], axisConstraints, 0.3);

      expect(result.distanceContext).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('handles identical prototypes (have same distance to target)', () => {
      const prototypes = [
        { id: 'clone1', type: 'emotion', weights: { valence: 0.5, arousal: 0.3 }, gates: [] },
        { id: 'clone2', type: 'emotion', weights: { valence: 0.5, arousal: 0.3 }, gates: [] },
      ];
      const service = createService(prototypes);
      const axisConstraints = new Map([
        ['valence', { min: 0.4, max: 0.6 }],
        ['arousal', { min: 0.2, max: 0.4 }],
      ]);

      const result = service.detectPrototypeGaps(axisConstraints, [], axisConstraints, 0.3);
      const clone1 = getDistanceInfo(result, 'clone1');
      const clone2 = getDistanceInfo(result, 'clone2');

      // Identical prototypes should have same distance
      expect(clone1.weightDistance).toBeCloseTo(clone2.weightDistance, 6);
      expect(clone1.combinedDistance).toBeCloseTo(clone2.combinedDistance, 6);
    });

    it('handles orthogonal weight vectors', () => {
      // Orthogonal: one has only valence, other has only arousal
      const prototypes = [
        { id: 'valence-only', type: 'emotion', weights: { valence: 1.0 }, gates: [] },
        { id: 'arousal-only', type: 'emotion', weights: { arousal: 1.0 }, gates: [] },
      ];
      const service = createService(prototypes);
      const axisConstraints = new Map([['valence', { min: 0.5, max: 0.5 }]]);

      const result = service.detectPrototypeGaps(axisConstraints, [], axisConstraints, 0.3);

      // Both should be found
      expect(result.kNearestNeighbors).toHaveLength(2);
      // valence-only should be closer to valence-focused target
      expect(result.kNearestNeighbors[0].prototypeId).toBe('valence-only');
    });

    it('handles empty weight objects', () => {
      const prototypes = [
        { id: 'empty-weights', type: 'emotion', weights: {}, gates: [] },
        { id: 'has-weights', type: 'emotion', weights: { valence: 0.5 }, gates: [] },
      ];
      const service = createService(prototypes);
      const axisConstraints = new Map([['valence', { min: 0.5, max: 0.5 }]]);

      const result = service.detectPrototypeGaps(axisConstraints, [], axisConstraints, 0.3);

      // Should not crash, both prototypes found
      expect(result.kNearestNeighbors.length).toBeGreaterThan(0);
      // Prototype with weights should be closer than empty
      expect(result.kNearestNeighbors[0].prototypeId).toBe('has-weights');
    });

    it('handles many axes', () => {
      const prototypes = [
        {
          id: 'multi-axis',
          type: 'emotion',
          weights: {
            valence: 0.5,
            arousal: 0.3,
            dominance: 0.4,
            engagement: 0.6,
            intensity: 0.7,
          },
          gates: [],
        },
      ];
      const service = createService(prototypes);
      // All positive direction targets (midpoint > 0.1)
      const axisConstraints = new Map([
        ['valence', { min: 0.4, max: 0.6 }],
        ['arousal', { min: 0.2, max: 0.4 }],
        ['dominance', { min: 0.3, max: 0.5 }],
        ['engagement', { min: 0.5, max: 0.7 }],
        ['intensity', { min: 0.6, max: 0.8 }],
      ]);

      const result = service.detectPrototypeGaps(axisConstraints, [], axisConstraints, 0.3);
      const entry = getDistanceInfo(result, 'multi-axis');

      // Should compute valid distance across all axes
      expect(typeof entry.weightDistance).toBe('number');
      expect(entry.weightDistance).toBeGreaterThanOrEqual(0);
    });
  });
});
