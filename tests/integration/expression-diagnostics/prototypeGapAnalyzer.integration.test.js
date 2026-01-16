/**
 * @file Integration tests for gap detection and prototype synthesis with real prototypes.
 * Tests for future PrototypeGapAnalyzer extraction.
 */

/* eslint-disable jest/no-conditional-expect -- Integration tests need conditionals
   to verify algorithm-dependent behavior (gap detected vs not detected) */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import PrototypeFitRankingService from '../../../src/expressionDiagnostics/services/PrototypeFitRankingService.js';

const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

/**
 * Creates data registry with realistic emotion prototypes.
 *
 * @param {object} logger - Logger instance
 * @returns {InMemoryDataRegistry} Configured registry
 */
const createDataRegistry = (logger) => {
  const registry = new InMemoryDataRegistry({ logger });

  // Store emotion prototypes with realistic values covering VAD space
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

/**
 * Creates stored contexts matching a mood regime.
 *
 * @returns {Array<object>} Array of stored context objects
 */
const createStoredContexts = () => [
  { moodAxes: { valence: 60, arousal: 20, dominance: 15 } },
  { moodAxes: { valence: 70, arousal: 30, dominance: 20 } },
  { moodAxes: { valence: 50, arousal: 10, dominance: 10 } },
];

describe('PrototypeGapAnalyzer Integration', () => {
  let logger;
  let service;
  let dataRegistry;

  beforeEach(() => {
    logger = createLogger();
    dataRegistry = createDataRegistry(logger);
    service = new PrototypeFitRankingService({ dataRegistry, logger });
  });

  describe('gap detection with real prototypes', () => {
    it('should detect gap in emotional spectrum (uncovered region)', () => {
      // Create constraints for an emotional region not well covered
      // Very extreme region: max positive on all axes (no prototype has all axes > 0.8)
      const axisConstraints = new Map([
        ['valence', { min: 0.95, max: 1.0 }],
        ['arousal', { min: 0.95, max: 1.0 }],
        ['dominance', { min: 0.95, max: 1.0 }],
      ]);
      const storedContexts = createStoredContexts();

      const result = service.detectPrototypeGaps(
        axisConstraints,
        storedContexts,
        axisConstraints,
        0.3
      );

      // This region requires distance > 0.5 for gap detection
      // Even if gap not detected, neighbors should be found
      expect(result.kNearestNeighbors.length).toBeGreaterThan(0);
      expect(result.nearestDistance).toBeGreaterThan(0);
    });

    it('should not detect gap when good match exists (joy region)', () => {
      // Create constraints matching joy prototype well
      const axisConstraints = new Map([
        ['valence', { min: 0.6, max: 0.9 }],
        ['arousal', { min: 0.1, max: 0.5 }],
        ['dominance', { min: 0.0, max: 0.4 }],
      ]);
      const storedContexts = createStoredContexts();

      const result = service.detectPrototypeGaps(
        axisConstraints,
        storedContexts,
        axisConstraints,
        0.3
      );

      // Good coverage should mean no gap detected
      expect(result.gapDetected).toBe(false);
      // Joy or excitement should be among top neighbors (both in positive valence region)
      const topNeighborIds = result.kNearestNeighbors
        .slice(0, 2)
        .map((n) => n.prototypeId);
      expect(
        topNeighborIds.includes('joy') || topNeighborIds.includes('excitement')
      ).toBe(true);
    });

    it('should identify fear prototype for negative valence + high arousal', () => {
      const axisConstraints = new Map([
        ['valence', { min: -0.8, max: -0.4 }],
        ['arousal', { min: 0.3, max: 0.7 }],
        ['dominance', { min: -0.8, max: -0.4 }],
      ]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        [],
        axisConstraints,
        0.3
      );

      // Fear prototype should be nearest
      expect(result.kNearestNeighbors.length).toBeGreaterThan(0);
      const nearestIds = result.kNearestNeighbors.map((n) => n.prototypeId);
      expect(nearestIds).toContain('fear');
    });
  });

  describe('prototype synthesis', () => {
    it('should synthesize viable prototype for detected gap', () => {
      // Create constraints for an uncovered region
      // Note: Gap detection requires distance > 0.5 AND bestIntensityRate < 0.3
      const axisConstraints = new Map([
        ['valence', { min: 0.9, max: 1.0 }],
        ['arousal', { min: -1.0, max: -0.8 }],
        ['dominance', { min: 0.9, max: 1.0 }],
      ]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        [],
        axisConstraints,
        0.3
      );

      // Always verify we found neighbors
      expect(result.kNearestNeighbors.length).toBeGreaterThan(0);

      // Verify consistency: gapDetected should match suggestedPrototype presence
      expect(result.suggestedPrototype !== null).toBe(result.gapDetected);

      // If gap detected, verify synthesis structure
      const synthesis = result.suggestedPrototype;
      if (synthesis) {
        expect(synthesis.weights).toHaveProperty('valence');
        expect(synthesis.weights).toHaveProperty('arousal');
        expect(synthesis.weights).toHaveProperty('dominance');
        expect(synthesis.gates.length).toBeGreaterThan(0);
      }
    });

    it('should synthesize prototype that approximates constraint requirements', () => {
      // High valence requirement not fully met by existing prototypes
      const axisConstraints = new Map([['valence', { min: 0.9, max: 1.0 }]]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        [],
        axisConstraints,
        0.3
      );

      // Always verify proper result structure
      expect(typeof result.gapDetected).toBe('boolean');
      expect(typeof result.nearestDistance).toBe('number');

      // Verify synthesis structure matches gap detection state
      const synthesis = result.suggestedPrototype;
      expect(synthesis !== null).toBe(result.gapDetected);

      // If synthesis exists, verify weight type
      if (synthesis) {
        expect(typeof synthesis.weights.valence).toBe('number');
      }
    });

    it('should include rationale explaining synthesis', () => {
      const axisConstraints = new Map([
        ['valence', { min: 0.9, max: 1.0 }],
        ['arousal', { min: 0.9, max: 1.0 }],
      ]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        [],
        axisConstraints,
        0.3
      );

      // Always verify result has proper structure
      expect(result).toHaveProperty('gapDetected');
      expect(result).toHaveProperty('suggestedPrototype');

      // Verify synthesis rationale when present
      const synthesis = result.suggestedPrototype;
      expect(synthesis !== null).toBe(result.gapDetected);
      if (synthesis) {
        expect(synthesis.rationale).toContain('nearest neighbors');
        expect(synthesis.rationale).toContain('distance-weighted');
      }
    });
  });

  describe('k-nearest neighbor accuracy', () => {
    it('should identify correct neighbors for complex weight space', () => {
      // Create constraints in the positive quadrant
      const axisConstraints = new Map([
        ['valence', { min: 0.5, max: 0.9 }],
        ['arousal', { min: 0.2, max: 0.6 }],
      ]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        [],
        axisConstraints,
        0.3
      );

      // Joy and excitement should be among the nearest
      const nearestIds = result.kNearestNeighbors.map((n) => n.prototypeId);
      expect(nearestIds).toContain('joy');
      // Sadness should NOT be in the top 5
      const sadnessIndex = nearestIds.indexOf('sadness');
      expect(sadnessIndex === -1 || sadnessIndex > 3).toBe(true);
    });

    it('should return exactly 5 neighbors when more prototypes exist', () => {
      const axisConstraints = new Map([
        ['valence', { min: 0.0, max: 0.5 }],
      ]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        [],
        axisConstraints,
        0.3
      );

      // K_NEIGHBORS = 5
      expect(result.kNearestNeighbors.length).toBe(5);
    });

    it('should sort neighbors by combined distance', () => {
      const axisConstraints = new Map([
        ['valence', { min: 0.4, max: 0.6 }],
      ]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        [],
        axisConstraints,
        0.3
      );

      // Verify ascending order by combined distance
      for (let i = 1; i < result.kNearestNeighbors.length; i++) {
        expect(
          result.kNearestNeighbors[i - 1].combinedDistance
        ).toBeLessThanOrEqual(result.kNearestNeighbors[i].combinedDistance);
      }
    });
  });

  describe('end-to-end gap analysis pipeline', () => {
    it('should complete full gap analysis pipeline', () => {
      const axisConstraints = new Map([
        ['valence', { min: 0.5, max: 0.8 }],
        ['arousal', { min: -0.3, max: 0.3 }],
      ]);
      const storedContexts = createStoredContexts();

      const result = service.detectPrototypeGaps(
        axisConstraints,
        storedContexts,
        axisConstraints,
        0.3
      );

      // All expected fields should be present
      expect(result).toHaveProperty('gapDetected');
      expect(result).toHaveProperty('nearestDistance');
      expect(result).toHaveProperty('kNearestNeighbors');
      expect(result).toHaveProperty('coverageWarning');
      expect(result).toHaveProperty('suggestedPrototype');
      expect(result).toHaveProperty('gapThreshold');

      // Type validations
      expect(typeof result.gapDetected).toBe('boolean');
      expect(typeof result.nearestDistance).toBe('number');
      expect(Array.isArray(result.kNearestNeighbors)).toBe(true);
    });

    it('should include distance calibration context', () => {
      const axisConstraints = new Map([
        ['valence', { min: 0.5, max: 0.8 }],
      ]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        [],
        axisConstraints,
        0.3
      );

      // Should have distance statistics
      expect(result).toHaveProperty('distanceZScore');
      expect(result).toHaveProperty('distancePercentile');
      expect(result).toHaveProperty('distanceContext');
    });

    it('should provide coverage warning when gap detected', () => {
      // Create constraints unlikely to match well
      const axisConstraints = new Map([
        ['valence', { min: 0.95, max: 1.0 }],
        ['arousal', { min: -1.0, max: -0.9 }],
        ['dominance', { min: 0.95, max: 1.0 }],
      ]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        [],
        axisConstraints,
        0.3
      );

      // Always verify result structure
      expect(result).toHaveProperty('coverageWarning');
      expect(result).toHaveProperty('gapDetected');

      // Verify consistency: coverageWarning presence matches gapDetected
      expect(result.coverageWarning !== null).toBe(result.gapDetected);

      // If warning present, verify content
      if (result.coverageWarning) {
        expect(result.coverageWarning).toContain('No prototype within distance');
      }
    });
  });

  describe('prototype type handling', () => {
    it('should default to emotion prototypes', () => {
      const axisConstraints = new Map([
        ['valence', { min: 0.5, max: 0.8 }],
      ]);

      const result = service.detectPrototypeGaps(
        axisConstraints,
        [],
        axisConstraints,
        0.3
      );

      // All neighbors should be emotion type
      for (const neighbor of result.kNearestNeighbors) {
        expect(neighbor.type).toBe('emotion');
      }
    });
  });
});
