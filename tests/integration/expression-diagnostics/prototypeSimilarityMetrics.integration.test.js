/**
 * @file Integration tests for similarity metrics with real emotion prototypes.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import PrototypeFitRankingService from '../../../src/expressionDiagnostics/services/PrototypeFitRankingService.js';

const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const createDataRegistry = (logger) => {
  const registry = new InMemoryDataRegistry({ logger });

  // Store emotion prototypes with realistic values
  registry.store('lookups', 'core:emotion_prototypes', {
    id: 'core:emotion_prototypes',
    entries: {
      joy: {
        weights: { valence: 0.8, arousal: 0.3, dominance: 0.2 },
        gates: ['valence >= 0.4'],
      },
      contentment: {
        weights: { valence: 0.6, arousal: -0.2, dominance: 0.1 },
        gates: ['valence >= 0.3', 'arousal <= 0.3'],
      },
      sadness: {
        weights: { valence: -0.7, arousal: -0.3, dominance: -0.4 },
        gates: ['valence <= 0.2'],
      },
      anger: {
        weights: { valence: -0.5, arousal: 0.7, dominance: 0.4 },
        gates: ['arousal >= 0.3'],
      },
      fear: {
        weights: { valence: -0.6, arousal: 0.5, dominance: -0.6 },
        gates: ['valence <= 0.3', 'arousal >= 0.2'],
      },
      calm: {
        weights: { valence: 0.3, arousal: -0.5, dominance: 0.0 },
        gates: ['arousal <= 0.2'],
      },
      excitement: {
        weights: { valence: 0.7, arousal: 0.8, dominance: 0.3 },
        gates: ['valence >= 0.3', 'arousal >= 0.4'],
      },
      boredom: {
        weights: { valence: -0.2, arousal: -0.6, dominance: -0.2 },
        gates: ['arousal <= 0.1'],
      },
    },
  });

  return registry;
};

const createStoredContexts = () => [
  { moodAxes: { valence: 60, arousal: 20, dominance: 15 } },
  { moodAxes: { valence: 70, arousal: 30, dominance: 20 } },
  { moodAxes: { valence: 50, arousal: 10, dominance: 10 } },
];

const createNegativeContexts = () => [
  { moodAxes: { valence: -50, arousal: -20, dominance: -30 } },
  { moodAxes: { valence: -60, arousal: -30, dominance: -40 } },
];

describe('PrototypeSimilarityMetrics Integration', () => {
  let logger;
  let service;
  let dataRegistry;

  beforeEach(() => {
    logger = createLogger();
    dataRegistry = createDataRegistry(logger);
    service = new PrototypeFitRankingService({ dataRegistry, logger });
  });

  describe('with real emotion prototypes', () => {
    it('finds positive-valence prototypes for positive-valence targets', () => {
      // Target: positive valence
      const axisConstraints = new Map([
        ['valence', { min: 0.6, max: 0.8 }],
        ['arousal', { min: 0.1, max: 0.4 }],
      ]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        createStoredContexts(),
        axisConstraints,
        0.3
      );

      // Positive-valence prototypes (joy, contentment, excitement, calm) should be in k-nearest
      const prototypeIds = result.kNearestNeighbors.map((n) => n.prototypeId);
      const positivePrototypes = ['joy', 'contentment', 'excitement', 'calm'];
      const positiveInResults = positivePrototypes.filter((p) => prototypeIds.includes(p));
      expect(positiveInResults.length).toBeGreaterThan(0);

      // Negative-valence prototypes should be farther away
      const nearestId = result.kNearestNeighbors[0].prototypeId;
      expect(['sadness', 'anger', 'fear']).not.toContain(nearestId);
    });

    it('finds negative-valence prototypes for negative-valence targets', () => {
      // Target: negative valence
      const axisConstraints = new Map([
        ['valence', { min: -0.7, max: -0.5 }],
        ['arousal', { min: -0.4, max: -0.2 }],
      ]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        createNegativeContexts(),
        axisConstraints,
        0.3
      );

      // Negative-valence prototypes should be closest
      const nearestId = result.kNearestNeighbors[0].prototypeId;
      const negativePrototypes = ['sadness', 'anger', 'fear', 'boredom'];
      expect(negativePrototypes).toContain(nearestId);

      // Positive-valence prototypes like joy/excitement should NOT be closest
      expect(['joy', 'excitement']).not.toContain(nearestId);
    });

    it('ranks prototypes by distance to target correctly', () => {
      // Target: high arousal, high valence (excitement-like)
      const axisConstraints = new Map([
        ['valence', { min: 0.6, max: 0.8 }],
        ['arousal', { min: 0.6, max: 0.9 }],
      ]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        createStoredContexts(),
        axisConstraints,
        0.3
      );

      // Excitement should be closest
      expect(result.kNearestNeighbors[0].prototypeId).toBe('excitement');

      // Distances should be sorted ascending
      const distances = result.kNearestNeighbors.map((n) => n.combinedDistance);
      for (let i = 1; i < distances.length; i++) {
        expect(distances[i]).toBeGreaterThanOrEqual(distances[i - 1]);
      }
    });
  });

  describe('distance distribution caching', () => {
    it('maintains consistent cache across multiple calls', () => {
      const axisConstraints = new Map([['valence', { min: 0.5, max: 0.7 }]]);

      // First call
      const result1 = service.detectPrototypeGaps(
        axisConstraints,
        createStoredContexts(),
        axisConstraints,
        0.3
      );

      // Second call with same prototypes
      const result2 = service.detectPrototypeGaps(
        axisConstraints,
        createStoredContexts(),
        axisConstraints,
        0.3
      );

      // Distance statistics should be identical (cached)
      expect(result1.distancePercentile).toEqual(result2.distancePercentile);
      expect(result1.distanceZScore).toEqual(result2.distanceZScore);
      expect(result1.distanceContext).toEqual(result2.distanceContext);
    });

    it('computes valid distance distribution with multiple prototypes', () => {
      const axisConstraints = new Map([
        ['valence', { min: 0.4, max: 0.6 }],
        ['arousal', { min: 0.0, max: 0.2 }],
      ]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        createStoredContexts(),
        axisConstraints,
        0.3
      );

      // With 8 prototypes, we should have valid distribution
      expect(result.distancePercentile).not.toBeNull();
      expect(result.distancePercentile).toBeGreaterThanOrEqual(0);
      expect(result.distancePercentile).toBeLessThanOrEqual(1);

      expect(result.distanceZScore).not.toBeNull();
      expect(typeof result.distanceZScore).toBe('number');
    });
  });

  describe('prototype gap analysis preparation', () => {
    it('provides distance context for gap detection', () => {
      // Target that doesn't match any prototype well
      const axisConstraints = new Map([
        ['valence', { min: 0.0, max: 0.1 }],
        ['arousal', { min: 0.0, max: 0.1 }],
        ['dominance', { min: 0.0, max: 0.1 }],
      ]);

      const result = service.detectPrototypeGaps(axisConstraints, [], axisConstraints, 0.3);

      // Should have distance context string
      expect(typeof result.distanceContext).toBe('string');
      expect(result.distanceContext).toContain('Distance');
      expect(result.distanceContext).toContain('farther than');
    });

    it('detects gap when no prototype is close enough', () => {
      // Target in extreme region not covered by any prototype
      const axisConstraints = new Map([
        ['valence', { min: 0.95, max: 1.0 }],
        ['arousal', { min: 0.95, max: 1.0 }],
        ['dominance', { min: 0.95, max: 1.0 }],
      ]);

      const result = service.detectPrototypeGaps(axisConstraints, [], axisConstraints, 0.3);

      // Should have non-trivial distance to nearest
      expect(result.nearestDistance).toBeGreaterThan(0);

      // Should provide z-score context
      expect(typeof result.distanceZScore).toBe('number');
    });

    it('returns k-nearest neighbors with complete distance breakdown', () => {
      const axisConstraints = new Map([
        ['valence', { min: 0.5, max: 0.7 }],
        ['arousal', { min: 0.2, max: 0.4 }],
      ]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        createStoredContexts(),
        axisConstraints,
        0.3
      );

      // Should have k-nearest neighbors (up to K_NEIGHBORS = 5)
      expect(result.kNearestNeighbors.length).toBeGreaterThan(0);
      expect(result.kNearestNeighbors.length).toBeLessThanOrEqual(5);

      // Each neighbor should have complete distance info
      for (const neighbor of result.kNearestNeighbors) {
        expect(neighbor).toHaveProperty('prototypeId');
        expect(neighbor).toHaveProperty('weightDistance');
        expect(neighbor).toHaveProperty('gateDistance');
        expect(neighbor).toHaveProperty('combinedDistance');
        expect(typeof neighbor.weightDistance).toBe('number');
        expect(typeof neighbor.gateDistance).toBe('number');
        expect(typeof neighbor.combinedDistance).toBe('number');
      }
    });
  });

  describe('distance metrics consistency', () => {
    it('combined distance equals 0.7×weight + 0.3×gate', () => {
      const axisConstraints = new Map([
        ['valence', { min: 0.5, max: 0.5 }],
        ['arousal', { min: 0.0, max: 0.0 }],
      ]);

      const result = service.detectPrototypeGaps(axisConstraints, [], axisConstraints, 0.3);

      for (const neighbor of result.kNearestNeighbors) {
        const expected = 0.7 * neighbor.weightDistance + 0.3 * neighbor.gateDistance;
        expect(neighbor.combinedDistance).toBeCloseTo(expected, 6);
      }
    });

    it('nearest distance matches first k-nearest neighbor', () => {
      const axisConstraints = new Map([['valence', { min: 0.6, max: 0.8 }]]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        createStoredContexts(),
        axisConstraints,
        0.3
      );

      // With 8 emotion prototypes, we should always have neighbors
      expect(result.kNearestNeighbors.length).toBeGreaterThan(0);
      expect(result.nearestDistance).toBeCloseTo(
        result.kNearestNeighbors[0].combinedDistance,
        6
      );
    });
  });

  describe('edge cases with real data', () => {
    it('handles target with very high positive values', () => {
      // Target with high positive values - should find positive prototypes
      const axisConstraints = new Map([
        ['valence', { min: 0.8, max: 0.8 }],
        ['arousal', { min: 0.8, max: 0.8 }],
        ['dominance', { min: 0.3, max: 0.3 }],
      ]);

      const result = service.detectPrototypeGaps(axisConstraints, [], axisConstraints, 0.3);

      // Nearest should be a positive-valence prototype
      const nearestId = result.kNearestNeighbors[0].prototypeId;
      expect(['joy', 'excitement', 'contentment', 'calm']).toContain(nearestId);
      // Distance should be finite and non-negative
      expect(result.nearestDistance).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(result.nearestDistance)).toBe(true);
    });

    it('handles target equidistant from multiple prototypes', () => {
      // Target between joy (valence 0.8) and contentment (valence 0.6)
      const axisConstraints = new Map([['valence', { min: 0.7, max: 0.7 }]]);

      const result = service.detectPrototypeGaps(axisConstraints, [], axisConstraints, 0.3);

      // Should have at least 2 neighbors at similar distances
      expect(result.kNearestNeighbors.length).toBeGreaterThanOrEqual(2);
    });

    it('provides numeric z-scores for all distances', () => {
      // Target at edge of typical range
      const axisConstraints = new Map([
        ['valence', { min: 0.9, max: 1.0 }],
        ['arousal', { min: 0.9, max: 1.0 }],
      ]);

      const result = service.detectPrototypeGaps(axisConstraints, [], axisConstraints, 0.3);

      // Z-score should be a finite number
      expect(typeof result.distanceZScore).toBe('number');
      expect(Number.isFinite(result.distanceZScore)).toBe(true);
    });
  });
});
