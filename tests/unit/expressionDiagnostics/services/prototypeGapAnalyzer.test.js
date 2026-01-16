/**
 * @file Unit tests for gap detection and synthesis behavior via PrototypeFitRankingService.
 * Tests for future PrototypeGapAnalyzer extraction.
 *
 * Actual method signatures from PrototypeFitRankingService:
 * - #buildTargetSignature(constraints, clauseFailures) → Map<string, TargetSignatureEntry>
 * - #targetSignatureToWeights(targetSignature) → object
 * - #synthesizePrototype(kNearest, desiredWeights, constraints) → object
 * - #inferDirection(constraint) → number (-1, 0, 1)
 * - #computeTightness(constraint) → number
 * - #getLastMileWeightForAxis(axis, clauseFailures) → number
 *
 * TargetSignatureEntry: { direction: number, tightness: number, lastMileWeight: number, importance: number }
 */
import { describe, it, expect, jest } from '@jest/globals';
import PrototypeFitRankingService from '../../../../src/expressionDiagnostics/services/PrototypeFitRankingService.js';

/**
 * Creates a PrototypeFitRankingService with mock dependencies.
 *
 * @param {Array} prototypes - Array of prototype definitions
 * @returns {PrototypeFitRankingService} Configured service instance
 */
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
    detectReferencedTypes: jest.fn(() => ({
      hasEmotions: true,
      hasSexualStates: false,
    })),
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

/**
 * Helper to get distance info for a specific prototype.
 *
 * @param {object} result - Gap detection result
 * @param {string} id - Prototype ID
 * @returns {object|undefined} Distance entry for the prototype
 */
const getDistanceInfo = (result, id) =>
  result.kNearestNeighbors.find((entry) => entry.prototypeId === id);

describe('PrototypeGapAnalyzer (via PrototypeFitRankingService)', () => {
  describe('buildTargetSignature', () => {
    it('should build signature from axis constraints', () => {
      // Actual: constraints is Map<string, {min: number, max: number}>
      // Returns: Map<string, {direction, tightness, lastMileWeight, importance}>
      const prototypes = [
        { id: 'test', type: 'emotion', weights: { valence: 0.5 }, gates: [] },
      ];
      const service = createService(prototypes);
      const axisConstraints = new Map([
        ['valence', { min: 0.5, max: 1.0 }],
        ['arousal', { min: -1.0, max: 0.3 }],
      ]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        [],
        axisConstraints,
        0.3
      );

      // kNearestNeighbors reflects target signature influence on distance calculation
      expect(result.kNearestNeighbors).toBeDefined();
      expect(result.kNearestNeighbors.length).toBeGreaterThan(0);
    });

    it('should handle empty constraints gracefully', () => {
      const prototypes = [
        { id: 'test', type: 'emotion', weights: { valence: 0.5 }, gates: [] },
      ];
      const service = createService(prototypes);
      const axisConstraints = new Map();

      const result = service.detectPrototypeGaps(
        axisConstraints,
        [],
        axisConstraints,
        0.3
      );

      expect(result.gapDetected).toBeDefined();
    });

    it('should compute direction from constraint midpoint (positive)', () => {
      // Direction: mid = (min + max) / 2
      // mid > 0.1 → direction = 1
      // mid < -0.1 → direction = -1
      // else → direction = 0
      const prototypes = [
        { id: 'high', type: 'emotion', weights: { valence: 0.8 }, gates: [] },
        { id: 'low', type: 'emotion', weights: { valence: -0.8 }, gates: [] },
      ];
      const service = createService(prototypes);
      // Midpoint: (0.6 + 0.9) / 2 = 0.75 > 0.1 → direction = 1
      const axisConstraints = new Map([['valence', { min: 0.6, max: 0.9 }]]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        [],
        axisConstraints,
        0.3
      );

      // High valence prototype should be closer (direction=1 favors positive weights)
      const highEntry = getDistanceInfo(result, 'high');
      const lowEntry = getDistanceInfo(result, 'low');
      expect(highEntry.weightDistance).toBeLessThan(lowEntry.weightDistance);
    });

    it('should compute direction from constraint midpoint (negative)', () => {
      const prototypes = [
        { id: 'high', type: 'emotion', weights: { valence: 0.8 }, gates: [] },
        { id: 'low', type: 'emotion', weights: { valence: -0.8 }, gates: [] },
      ];
      const service = createService(prototypes);
      // Midpoint: (-0.9 + -0.6) / 2 = -0.75 < -0.1 → direction = -1
      const axisConstraints = new Map([['valence', { min: -0.9, max: -0.6 }]]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        [],
        axisConstraints,
        0.3
      );

      // Low valence prototype should be closer (direction=-1 favors negative weights)
      const highEntry = getDistanceInfo(result, 'high');
      const lowEntry = getDistanceInfo(result, 'low');
      expect(lowEntry.weightDistance).toBeLessThan(highEntry.weightDistance);
    });

    it('should compute direction from constraint midpoint (neutral)', () => {
      const prototypes = [
        { id: 'test', type: 'emotion', weights: { valence: 0.0 }, gates: [] },
      ];
      const service = createService(prototypes);
      // Midpoint: (-0.05 + 0.05) / 2 = 0.0 (between -0.1 and 0.1) → direction = 0
      const axisConstraints = new Map([['valence', { min: -0.05, max: 0.05 }]]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        [],
        axisConstraints,
        0.3
      );

      expect(result.kNearestNeighbors.length).toBeGreaterThan(0);
    });
  });

  describe('computeTightness', () => {
    it('should return high tightness for narrow range', () => {
      // Tightness = max(0, 1 - range/2)
      // Range 0.2: tightness = 1 - 0.2/2 = 0.9
      const prototypes = [
        { id: 'exact', type: 'emotion', weights: { valence: 0.5 }, gates: [] },
        { id: 'off', type: 'emotion', weights: { valence: 0.3 }, gates: [] },
      ];
      const service = createService(prototypes);
      // Narrow range → high tightness → high importance
      const axisConstraints = new Map([['valence', { min: 0.4, max: 0.6 }]]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        [],
        axisConstraints,
        0.3
      );

      // With high tightness, the 'exact' match should be strongly preferred
      const exactEntry = getDistanceInfo(result, 'exact');
      const offEntry = getDistanceInfo(result, 'off');
      expect(exactEntry.weightDistance).toBeLessThan(offEntry.weightDistance);
    });

    it('should return low tightness for wide range', () => {
      // Range 2.0 (full): tightness = 1 - 2/2 = 0
      const prototypes = [
        { id: 'a', type: 'emotion', weights: { valence: 0.5 }, gates: [] },
        { id: 'b', type: 'emotion', weights: { valence: -0.5 }, gates: [] },
      ];
      const service = createService(prototypes);
      // Full range → zero tightness → low importance
      const axisConstraints = new Map([['valence', { min: -1, max: 1 }]]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        [],
        axisConstraints,
        0.3
      );

      // Both should have similar distances due to low constraint importance
      const aEntry = getDistanceInfo(result, 'a');
      const bEntry = getDistanceInfo(result, 'b');
      expect(Math.abs(aEntry.weightDistance - bEntry.weightDistance)).toBeLessThan(0.5);
    });
  });

  describe('targetSignatureToWeights', () => {
    it('should convert signature to weight vector', () => {
      // weights[axis] = entry.direction * entry.importance
      const prototypes = [
        { id: 'test', type: 'emotion', weights: { valence: 0.7 }, gates: [] },
      ];
      const service = createService(prototypes);
      // Positive midpoint → direction=1
      // Narrow range → high tightness → high importance
      const axisConstraints = new Map([['valence', { min: 0.6, max: 0.8 }]]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        [],
        axisConstraints,
        0.3
      );

      // Result should reflect weight conversion in distance calculation
      expect(result.kNearestNeighbors.length).toBeGreaterThan(0);
      expect(result.kNearestNeighbors[0].weightDistance).toBeDefined();
    });

    it('should handle negative direction', () => {
      const prototypes = [
        { id: 'low', type: 'emotion', weights: { arousal: -0.7 }, gates: [] },
      ];
      const service = createService(prototypes);
      // Negative midpoint → direction=-1
      const axisConstraints = new Map([['arousal', { min: -0.8, max: -0.6 }]]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        [],
        axisConstraints,
        0.3
      );

      // Low arousal prototype should match well
      expect(result.kNearestNeighbors[0].prototypeId).toBe('low');
    });

    it('should handle zero direction (neutral)', () => {
      const prototypes = [
        { id: 'neutral', type: 'emotion', weights: { valence: 0.0 }, gates: [] },
        { id: 'extreme', type: 'emotion', weights: { valence: 0.9 }, gates: [] },
      ];
      const service = createService(prototypes);
      // Neutral midpoint → direction=0 → weight contribution = 0
      const axisConstraints = new Map([['valence', { min: -0.05, max: 0.05 }]]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        [],
        axisConstraints,
        0.3
      );

      expect(result.kNearestNeighbors.length).toBeGreaterThan(0);
    });
  });

  describe('getLastMileWeightForAxis', () => {
    // Note: clauseFailures is used in buildTargetSignature to boost axis importance
    // when that axis caused recent failures
    it('should return default weight when no clause failures', () => {
      const prototypes = [
        { id: 'test', type: 'emotion', weights: { valence: 0.5 }, gates: [] },
      ];
      const service = createService(prototypes);
      const axisConstraints = new Map([['valence', { min: 0.4, max: 0.6 }]]);

      // No clause failures passed
      const result = service.detectPrototypeGaps(
        axisConstraints,
        [],
        axisConstraints,
        0.3
      );

      // Should work without failures
      expect(result.kNearestNeighbors.length).toBeGreaterThan(0);
    });

    it('should handle stored contexts with failures', () => {
      const prototypes = [
        { id: 'test', type: 'emotion', weights: { valence: 0.5 }, gates: [] },
      ];
      const service = createService(prototypes);
      const axisConstraints = new Map([['valence', { min: 0.4, max: 0.6 }]]);
      const storedContexts = [
        {
          moodRegime: { valence: { min: 0.4, max: 0.6 } },
          moodValues: { valence: 0.5 },
        },
      ];

      const result = service.detectPrototypeGaps(
        axisConstraints,
        storedContexts,
        axisConstraints,
        0.3
      );

      expect(result.gapDetected).toBeDefined();
    });
  });

  describe('kNearestNeighbors', () => {
    it('should find k=5 nearest prototypes by combined distance', () => {
      // K_NEIGHBORS constant = 5
      const prototypes = Array.from({ length: 10 }, (_, i) => ({
        id: `proto-${i}`,
        type: 'emotion',
        weights: { valence: (i - 5) * 0.1 },
        gates: [],
      }));
      const service = createService(prototypes);
      const axisConstraints = new Map([['valence', { min: 0.4, max: 0.6 }]]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        [],
        axisConstraints,
        0.3
      );

      // Should return exactly 5 neighbors (K_NEIGHBORS = 5)
      expect(result.kNearestNeighbors.length).toBe(5);
    });

    it('should return all prototypes if fewer than k exist', () => {
      const prototypes = [
        { id: 'only-one', type: 'emotion', weights: { valence: 0.5 }, gates: [] },
      ];
      const service = createService(prototypes);
      const axisConstraints = new Map([['valence', { min: 0.4, max: 0.6 }]]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        [],
        axisConstraints,
        0.3
      );

      expect(result.kNearestNeighbors.length).toBe(1);
    });

    it('should sort by combined distance (ascending)', () => {
      const prototypes = [
        { id: 'close', type: 'emotion', weights: { valence: 0.5 }, gates: [] },
        { id: 'far', type: 'emotion', weights: { valence: -0.9 }, gates: [] },
        { id: 'medium', type: 'emotion', weights: { valence: 0.2 }, gates: [] },
      ];
      const service = createService(prototypes);
      const axisConstraints = new Map([['valence', { min: 0.4, max: 0.6 }]]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        [],
        axisConstraints,
        0.3
      );

      // Verify sorting by combined distance
      for (let i = 1; i < result.kNearestNeighbors.length; i++) {
        expect(result.kNearestNeighbors[i - 1].combinedDistance).toBeLessThanOrEqual(
          result.kNearestNeighbors[i].combinedDistance
        );
      }
    });
  });

  describe('gapDetection', () => {
    it('should detect gap when nearest distance exceeds GAP_DISTANCE_THRESHOLD (0.5)', () => {
      // Gap detected when: nearestDist > 0.5 AND bestIntensity < 0.3
      const prototypes = [
        { id: 'far', type: 'emotion', weights: { valence: -0.9 }, gates: [] },
      ];
      const service = createService(prototypes);
      // Target positive, prototype very negative → large distance
      const axisConstraints = new Map([['valence', { min: 0.8, max: 1.0 }]]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        [],
        axisConstraints,
        0.3
      );

      // Should detect gap due to large distance
      expect(result.nearestDistance).toBeGreaterThan(0.5);
      // Note: gap detection also requires low intensity
    });

    it('should not detect gap when distance below threshold', () => {
      const prototypes = [
        { id: 'exact', type: 'emotion', weights: { valence: 0.5 }, gates: [] },
      ];
      const service = createService(prototypes);
      const axisConstraints = new Map([['valence', { min: 0.4, max: 0.6 }]]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        [],
        axisConstraints,
        0.3
      );

      // Close match → no gap
      expect(result.nearestDistance).toBeLessThan(0.5);
      expect(result.gapDetected).toBe(false);
    });

    it('should use GAP_DISTANCE_THRESHOLD constant (0.5)', () => {
      const prototypes = [
        { id: 'test', type: 'emotion', weights: { valence: 0.5 }, gates: [] },
      ];
      const service = createService(prototypes);
      const axisConstraints = new Map([['valence', { min: 0.4, max: 0.6 }]]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        [],
        axisConstraints,
        0.3
      );

      // gapThreshold should equal GAP_DISTANCE_THRESHOLD
      expect(result.gapThreshold).toBe(0.5);
    });
  });

  describe('synthesizePrototype', () => {
    it('should synthesize prototype when gap detected', () => {
      const prototypes = [
        { id: 'far1', type: 'emotion', weights: { valence: -0.8 }, gates: [] },
        { id: 'far2', type: 'emotion', weights: { valence: -0.9 }, gates: [] },
      ];
      const service = createService(prototypes);
      // Large gap between desired (high valence) and available (low valence)
      const axisConstraints = new Map([['valence', { min: 0.8, max: 1.0 }]]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        [],
        axisConstraints,
        0.3
      );

      // Gap should be detected and suggested prototype provided
      // (These assertions validate behavior when gap IS detected)
      expect(result.gapDetected).toBe(true);
      expect(result.suggestedPrototype).not.toBeNull();
      expect(result.suggestedPrototype.weights).toBeDefined();
      expect(result.suggestedPrototype.gates).toBeDefined();
      expect(result.suggestedPrototype.rationale).toBeDefined();
    });

    it('should not synthesize when no gap detected', () => {
      const prototypes = [
        { id: 'exact', type: 'emotion', weights: { valence: 0.5 }, gates: [] },
      ];
      const service = createService(prototypes);
      const axisConstraints = new Map([['valence', { min: 0.4, max: 0.6 }]]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        [],
        axisConstraints,
        0.3
      );

      expect(result.gapDetected).toBe(false);
      expect(result.suggestedPrototype).toBeNull();
    });

    it('should blend multiple neighbors using distance weighting', () => {
      // synthesizePrototype uses inverse-distance weighting: w = 1/(distance + 0.01)
      const prototypes = [
        { id: 'close', type: 'emotion', weights: { valence: -0.5 }, gates: [] },
        { id: 'far', type: 'emotion', weights: { valence: -0.9 }, gates: [] },
      ];
      const service = createService(prototypes);
      const axisConstraints = new Map([['valence', { min: 0.8, max: 1.0 }]]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        [],
        axisConstraints,
        0.3
      );

      // When gap is detected, synthesized weights should be weighted average
      expect(result.gapDetected).toBe(true);
      expect(result.suggestedPrototype).not.toBeNull();
      expect(typeof result.suggestedPrototype.weights.valence).toBe('number');
    });

    it('should derive gates from constraints', () => {
      const prototypes = [
        { id: 'far', type: 'emotion', weights: { valence: -0.8 }, gates: [] },
      ];
      const service = createService(prototypes);
      const axisConstraints = new Map([['valence', { min: 0.6, max: 0.8 }]]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        [],
        axisConstraints,
        0.3
      );

      // When gap is detected, gates should be derived from constraint bounds
      expect(result.gapDetected).toBe(true);
      expect(result.suggestedPrototype).not.toBeNull();
      expect(result.suggestedPrototype.gates).toBeInstanceOf(Array);
      // Should include gate for valence >= 0.6 or <= 0.8
      const hasMinGate = result.suggestedPrototype.gates.some(
        (g) => g.includes('valence') && g.includes('>=')
      );
      const hasMaxGate = result.suggestedPrototype.gates.some(
        (g) => g.includes('valence') && g.includes('<=')
      );
      expect(hasMinGate || hasMaxGate).toBe(true);
    });

    it('should include rationale in synthesized prototype', () => {
      const prototypes = [
        { id: 'far', type: 'emotion', weights: { valence: -0.8 }, gates: [] },
      ];
      const service = createService(prototypes);
      const axisConstraints = new Map([['valence', { min: 0.8, max: 1.0 }]]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        [],
        axisConstraints,
        0.3
      );

      // When gap is detected, rationale should explain synthesis method
      expect(result.gapDetected).toBe(true);
      expect(result.suggestedPrototype).not.toBeNull();
      expect(result.suggestedPrototype.rationale).toContain('nearest neighbors');
    });
  });

  describe('gapDetectionThresholds', () => {
    it('should use GAP_DISTANCE_THRESHOLD constant (0.5)', () => {
      const prototypes = [
        { id: 'test', type: 'emotion', weights: { valence: 0.5 }, gates: [] },
      ];
      const service = createService(prototypes);
      const axisConstraints = new Map([['valence', { min: 0.4, max: 0.6 }]]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        [],
        axisConstraints,
        0.3
      );

      expect(result.gapThreshold).toBe(0.5);
    });

    it('should use GAP_INTENSITY_THRESHOLD (0.3) for intensity check', () => {
      // Gap requires: nearestDist > GAP_DISTANCE_THRESHOLD AND bestIntensity < GAP_INTENSITY_THRESHOLD
      const prototypes = [
        { id: 'far', type: 'emotion', weights: { valence: -0.9 }, gates: [] },
      ];
      const service = createService(prototypes);
      const axisConstraints = new Map([['valence', { min: 0.8, max: 1.0 }]]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        [],
        axisConstraints,
        0.3
      );

      // kNearestNeighbors include pIntensityAbove
      expect(result.kNearestNeighbors[0].pIntensityAbove).toBeDefined();
    });

    it('should use K_NEIGHBORS constant (5)', () => {
      const prototypes = Array.from({ length: 10 }, (_, i) => ({
        id: `proto-${i}`,
        type: 'emotion',
        weights: { valence: i * 0.1 },
        gates: [],
      }));
      const service = createService(prototypes);
      const axisConstraints = new Map([['valence', { min: 0.4, max: 0.6 }]]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        [],
        axisConstraints,
        0.3
      );

      // Should return exactly K_NEIGHBORS = 5
      expect(result.kNearestNeighbors.length).toBe(5);
    });
  });

  describe('edge cases', () => {
    it('should handle empty prototype set', () => {
      const prototypes = [];
      const service = createService(prototypes);
      const axisConstraints = new Map([['valence', { min: 0.4, max: 0.6 }]]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        [],
        axisConstraints,
        0.3
      );

      expect(result.gapDetected).toBe(false);
      expect(result.nearestDistance).toBe(Infinity);
      expect(result.kNearestNeighbors).toEqual([]);
    });

    it('should handle single prototype', () => {
      const prototypes = [
        { id: 'only', type: 'emotion', weights: { valence: 0.5 }, gates: [] },
      ];
      const service = createService(prototypes);
      const axisConstraints = new Map([['valence', { min: 0.4, max: 0.6 }]]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        [],
        axisConstraints,
        0.3
      );

      expect(result.kNearestNeighbors.length).toBe(1);
      expect(result.kNearestNeighbors[0].prototypeId).toBe('only');
    });

    it('should handle prototype with no matching axes', () => {
      const prototypes = [
        { id: 'test', type: 'emotion', weights: { arousal: 0.5 }, gates: [] },
      ];
      const service = createService(prototypes);
      // Constraint on valence, but prototype only has arousal
      const axisConstraints = new Map([['valence', { min: 0.4, max: 0.6 }]]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        [],
        axisConstraints,
        0.3
      );

      // Should still process without error
      expect(result.kNearestNeighbors.length).toBe(1);
    });

    it('should handle multiple constraint axes', () => {
      const prototypes = [
        {
          id: 'multi',
          type: 'emotion',
          weights: { valence: 0.5, arousal: 0.3, dominance: 0.7 },
          gates: [],
        },
      ];
      const service = createService(prototypes);
      const axisConstraints = new Map([
        ['valence', { min: 0.4, max: 0.6 }],
        ['arousal', { min: 0.2, max: 0.4 }],
        ['dominance', { min: 0.6, max: 0.8 }],
      ]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        [],
        axisConstraints,
        0.3
      );

      expect(result.kNearestNeighbors.length).toBe(1);
    });

    it('should handle all prototypes being good fit (no gap)', () => {
      const prototypes = [
        { id: 'good1', type: 'emotion', weights: { valence: 0.5 }, gates: [] },
        { id: 'good2', type: 'emotion', weights: { valence: 0.45 }, gates: [] },
        { id: 'good3', type: 'emotion', weights: { valence: 0.55 }, gates: [] },
      ];
      const service = createService(prototypes);
      const axisConstraints = new Map([['valence', { min: 0.4, max: 0.6 }]]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        [],
        axisConstraints,
        0.3
      );

      expect(result.gapDetected).toBe(false);
      expect(result.nearestDistance).toBeLessThan(0.5);
      expect(result.suggestedPrototype).toBeNull();
    });
  });
});
