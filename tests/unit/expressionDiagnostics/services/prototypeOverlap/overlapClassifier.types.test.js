/**
 * @file Unit tests for OverlapClassifier v2 classification infrastructure
 * Tests v2 types, priority constant, and classification behavior.
 */

import { describe, it, expect } from '@jest/globals';
import OverlapClassifier, {
  CLASSIFICATION_PRIORITY,
} from '../../../../../src/expressionDiagnostics/services/prototypeOverlap/OverlapClassifier.js';

describe('OverlapClassifier v2 infrastructure', () => {
  /**
   * Create a mock logger for testing.
   *
   * @returns {object} Mock logger
   */
  const createMockLogger = () => ({
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  });

  /**
   * Create a test config with adjustable thresholds.
   *
   * @param {object} [overrides] - Override specific threshold values
   * @returns {object} Config object
   */
  const createConfig = (overrides = {}) => ({
    minOnEitherRateForMerge: 0.05,
    minGateOverlapRatio: 0.9,
    minCorrelationForMerge: 0.98,
    maxMeanAbsDiffForMerge: 0.03,
    maxExclusiveRateForSubsumption: 0.01,
    minCorrelationForSubsumption: 0.95,
    minDominanceForSubsumption: 0.95,
    ...overrides,
  });

  /**
   * Create candidate metrics (Stage A output).
   *
   * @param {object} [overrides] - Override specific values
   * @returns {object} Candidate metrics
   */
  const createCandidateMetrics = (overrides = {}) => ({
    activeAxisOverlap: 0.9,
    signAgreement: 0.95,
    weightCosineSimilarity: 0.98,
    ...overrides,
  });

  /**
   * Create behavioral metrics (Stage B output).
   *
   * @param {object} [overrides] - Override specific values
   * @returns {object} Behavioral metrics
   */
  const createBehaviorMetrics = (overrides = {}) => {
    const gateOverlap = {
      onEitherRate: 0.3,
      onBothRate: 0.28,
      pOnlyRate: 0.01,
      qOnlyRate: 0.01,
      ...(overrides.gateOverlap || {}),
    };
    const intensity = {
      pearsonCorrelation: 0.99,
      meanAbsDiff: 0.02,
      dominanceP: 0.3,
      dominanceQ: 0.3,
      ...(overrides.intensity || {}),
    };
    return { gateOverlap, intensity };
  };

  /**
   * Create classifier instance for testing.
   *
   * @param {object} [configOverrides] - Config overrides
   * @returns {{classifier: OverlapClassifier, logger: object}} Classifier and mock logger
   */
  const createClassifier = (configOverrides = {}) => {
    const logger = createMockLogger();
    const config = createConfig(configOverrides);
    const classifier = new OverlapClassifier({ config, logger });
    return { classifier, logger };
  };

  describe('CLASSIFICATION_PRIORITY constant', () => {
    it('should export CLASSIFICATION_PRIORITY constant', () => {
      expect(CLASSIFICATION_PRIORITY).toBeDefined();
      expect(Array.isArray(CLASSIFICATION_PRIORITY)).toBe(true);
    });

    it('should have 6 classification types in correct priority order', () => {
      expect(CLASSIFICATION_PRIORITY).toEqual([
        'merge_recommended',
        'subsumed_recommended',
        'convert_to_expression',
        'nested_siblings',
        'needs_separation',
        'keep_distinct',
      ]);
    });

    it('should have merge_recommended before subsumed_recommended', () => {
      const mergeIndex = CLASSIFICATION_PRIORITY.indexOf('merge_recommended');
      const subsumedIndex = CLASSIFICATION_PRIORITY.indexOf(
        'subsumed_recommended'
      );
      expect(mergeIndex).toBeLessThan(subsumedIndex);
    });

    it('should have keep_distinct as the last priority', () => {
      const lastIndex = CLASSIFICATION_PRIORITY.length - 1;
      expect(CLASSIFICATION_PRIORITY[lastIndex]).toBe('keep_distinct');
    });
  });

  describe('classify() v2 types', () => {
    it('should return v2 type directly (merge_recommended)', () => {
      const { classifier } = createClassifier();
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics({
        gateOverlap: {
          onEitherRate: 0.3,
          onBothRate: 0.28,
          pOnlyRate: 0.01,
          qOnlyRate: 0.01,
        },
        intensity: {
          pearsonCorrelation: 0.99,
          meanAbsDiff: 0.02,
          dominanceP: 0.3,
          dominanceQ: 0.3,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('merge_recommended');
      expect(CLASSIFICATION_PRIORITY).toContain(result.type);
      expect(Array.isArray(result.allMatchingClassifications)).toBe(true);
    });

    it('should return v2 type directly (subsumed_recommended)', () => {
      const { classifier } = createClassifier();
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics({
        gateOverlap: {
          onEitherRate: 0.3,
          onBothRate: 0.2,
          pOnlyRate: 0.005,
          qOnlyRate: 0.095,
        },
        intensity: {
          pearsonCorrelation: 0.96,
          meanAbsDiff: 0.05,
          dominanceP: 0.02,
          dominanceQ: 0.96,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('subsumed_recommended');
      expect(CLASSIFICATION_PRIORITY).toContain(result.type);
    });

    it('should return v2 type directly (keep_distinct)', () => {
      const { classifier } = createClassifier();
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics({
        gateOverlap: {
          onEitherRate: 0.3,
          onBothRate: 0.1,
          pOnlyRate: 0.1,
          qOnlyRate: 0.1,
        },
        intensity: {
          pearsonCorrelation: 0.5,
          meanAbsDiff: 0.2,
          dominanceP: 0.4,
          dominanceQ: 0.4,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('keep_distinct');
      expect(CLASSIFICATION_PRIORITY).toContain(result.type);
    });

    it('should never return undefined or null type', () => {
      const { classifier } = createClassifier();

      // Test with null inputs
      const result1 = classifier.classify(null, null);
      expect(result1.type).toBeDefined();
      expect(result1.type).not.toBeNull();

      // Test with valid inputs
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics();
      const result2 = classifier.classify(candidateMetrics, behaviorMetrics);
      expect(result2.type).toBeDefined();
      expect(result2.type).not.toBeNull();

      // Verify type is always a valid v2 type
      expect(CLASSIFICATION_PRIORITY).toContain(result1.type);
      expect(CLASSIFICATION_PRIORITY).toContain(result2.type);
    });

    it('should always return a valid v2 classification type', () => {
      const { classifier } = createClassifier();
      const candidateMetrics = createCandidateMetrics();

      // Test various metric scenarios
      const scenarios = [
        // Merge scenario
        {
          gateOverlap: { onEitherRate: 0.3, onBothRate: 0.28, pOnlyRate: 0.01, qOnlyRate: 0.01 },
          intensity: { pearsonCorrelation: 0.99, meanAbsDiff: 0.02, dominanceP: 0.3, dominanceQ: 0.3 },
        },
        // Subsumed scenario
        {
          gateOverlap: { onEitherRate: 0.3, onBothRate: 0.2, pOnlyRate: 0.005, qOnlyRate: 0.095 },
          intensity: { pearsonCorrelation: 0.96, meanAbsDiff: 0.05, dominanceP: 0.02, dominanceQ: 0.96 },
        },
        // Keep distinct scenario
        {
          gateOverlap: { onEitherRate: 0.3, onBothRate: 0.1, pOnlyRate: 0.1, qOnlyRate: 0.1 },
          intensity: { pearsonCorrelation: 0.5, meanAbsDiff: 0.2, dominanceP: 0.4, dominanceQ: 0.4 },
        },
        // Edge case: all zeros
        {
          gateOverlap: { onEitherRate: 0, onBothRate: 0, pOnlyRate: 0, qOnlyRate: 0 },
          intensity: { pearsonCorrelation: NaN, meanAbsDiff: NaN, dominanceP: 0, dominanceQ: 0 },
        },
      ];

      for (const behaviorOverrides of scenarios) {
        const behaviorMetrics = createBehaviorMetrics(behaviorOverrides);
        const result = classifier.classify(candidateMetrics, behaviorMetrics);
        expect(CLASSIFICATION_PRIORITY).toContain(result.type);
      }
    });
  });

  describe('Return structure', () => {
    it('should return result with type, thresholds, and metrics', () => {
      const { classifier } = createClassifier();
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics();

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('thresholds');
      expect(result).toHaveProperty('metrics');
    });

    it('should include subsumedPrototype only for subsumed_recommended type', () => {
      const { classifier } = createClassifier();
      const candidateMetrics = createCandidateMetrics();

      // Test merge_recommended - should NOT have subsumedPrototype
      const mergeMetrics = createBehaviorMetrics({
        gateOverlap: {
          onEitherRate: 0.3,
          onBothRate: 0.28,
          pOnlyRate: 0.01,
          qOnlyRate: 0.01,
        },
        intensity: {
          pearsonCorrelation: 0.99,
          meanAbsDiff: 0.02,
          dominanceP: 0.3,
          dominanceQ: 0.3,
        },
      });
      const mergeResult = classifier.classify(candidateMetrics, mergeMetrics);
      expect(mergeResult.type).toBe('merge_recommended');
      expect(mergeResult.subsumedPrototype).toBeUndefined();

      // Test subsumed_recommended - should have subsumedPrototype
      const subsumedMetrics = createBehaviorMetrics({
        gateOverlap: {
          onEitherRate: 0.3,
          onBothRate: 0.2,
          pOnlyRate: 0.005,
          qOnlyRate: 0.095,
        },
        intensity: {
          pearsonCorrelation: 0.96,
          meanAbsDiff: 0.05,
          dominanceP: 0.02,
          dominanceQ: 0.96,
        },
      });
      const subsumedResult = classifier.classify(
        candidateMetrics,
        subsumedMetrics
      );
      expect(subsumedResult.type).toBe('subsumed_recommended');
      expect(subsumedResult.subsumedPrototype).toBeDefined();
      expect(['a', 'b']).toContain(subsumedResult.subsumedPrototype);

      // Test keep_distinct - should NOT have subsumedPrototype
      const distinctMetrics = createBehaviorMetrics({
        gateOverlap: {
          onEitherRate: 0.3,
          onBothRate: 0.1,
          pOnlyRate: 0.1,
          qOnlyRate: 0.1,
        },
        intensity: {
          pearsonCorrelation: 0.5,
          meanAbsDiff: 0.2,
          dominanceP: 0.4,
          dominanceQ: 0.4,
        },
      });
      const distinctResult = classifier.classify(
        candidateMetrics,
        distinctMetrics
      );
      expect(distinctResult.type).toBe('keep_distinct');
      expect(distinctResult.subsumedPrototype).toBeUndefined();
    });
  });

  describe('Stub methods', () => {
    it('should return keep_distinct for unimplemented types (stubs return false)', () => {
      const { classifier } = createClassifier();
      const candidateMetrics = createCandidateMetrics();

      // Behavior that doesn't match merge or subsumed criteria
      // Should fall through to keep_distinct (stubs return false)
      const behaviorMetrics = createBehaviorMetrics({
        gateOverlap: {
          onEitherRate: 0.3,
          onBothRate: 0.1,
          pOnlyRate: 0.1,
          qOnlyRate: 0.1,
        },
        intensity: {
          pearsonCorrelation: 0.5,
          meanAbsDiff: 0.2,
          dominanceP: 0.4,
          dominanceQ: 0.4,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      // Since convert_to_expression, nested_siblings, needs_separation all return false (stubs),
      // the classification should fall through to keep_distinct
      expect(result.type).toBe('keep_distinct');
    });

    it('keep_distinct should always match (true fallback)', () => {
      const { classifier } = createClassifier();

      // Even with null/empty inputs, should get keep_distinct due to fallback
      const result = classifier.classify(null, null);

      expect(result.type).toBe('keep_distinct');
    });
  });

  describe('Priority ordering', () => {
    it('should check merge_recommended before subsumed_recommended', () => {
      const { classifier, logger } = createClassifier();
      const candidateMetrics = createCandidateMetrics();

      // Metrics that satisfy merge criteria (which takes priority)
      const behaviorMetrics = createBehaviorMetrics({
        gateOverlap: {
          onEitherRate: 0.3,
          onBothRate: 0.28,
          pOnlyRate: 0.01,
          qOnlyRate: 0.01,
        },
        intensity: {
          pearsonCorrelation: 0.99,
          meanAbsDiff: 0.02,
          dominanceP: 0.3,
          dominanceQ: 0.3,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('merge_recommended');
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('MERGE_RECOMMENDED')
      );
    });

    it('should check subsumed_recommended only if merge_recommended fails', () => {
      const { classifier, logger } = createClassifier();
      const candidateMetrics = createCandidateMetrics();

      // Metrics that satisfy subsumed but not merge (due to high dominance)
      const behaviorMetrics = createBehaviorMetrics({
        gateOverlap: {
          onEitherRate: 0.3,
          onBothRate: 0.28,
          pOnlyRate: 0.01,
          qOnlyRate: 0.01,
        },
        intensity: {
          pearsonCorrelation: 0.99,
          meanAbsDiff: 0.02,
          dominanceP: 0.02,
          dominanceQ: 0.96, // High dominance prevents merge but enables subsumed
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('subsumed_recommended');
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('SUBSUMED_RECOMMENDED')
      );
    });

    it('should fall through to keep_distinct when no other criteria match', () => {
      const { classifier, logger } = createClassifier();
      const candidateMetrics = createCandidateMetrics();

      // Metrics that don't satisfy any criteria
      const behaviorMetrics = createBehaviorMetrics({
        gateOverlap: {
          onEitherRate: 0.3,
          onBothRate: 0.1,
          pOnlyRate: 0.1,
          qOnlyRate: 0.1,
        },
        intensity: {
          pearsonCorrelation: 0.5,
          meanAbsDiff: 0.2,
          dominanceP: 0.4,
          dominanceQ: 0.4,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('keep_distinct');
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('KEEP_DISTINCT')
      );
    });
  });
});
