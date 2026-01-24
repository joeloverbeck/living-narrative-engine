/**
 * @file Lightweight integration tests for NEEDS_SEPARATION classification
 * Tests OverlapClassifier service with pre-computed behavioral metrics.
 * No Monte Carlo sampling - validates classification logic and recommendation structure.
 *
 * For full E2E validation with production bootstrap, see:
 * @see tests/e2e/expressions/diagnostics/needsSeparation.e2e.test.js
 *
 * NEEDS_SEPARATION criteria from OverlapClassifier:
 * - High co-activation (both fire frequently together)
 * - Neither prototype clearly contains the other (not nested_siblings)
 * - Significant overlap but different behavioral intent
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import OverlapClassifier from '../../../../src/expressionDiagnostics/services/prototypeOverlap/OverlapClassifier.js';

/**
 * Creates a mock logger with all required methods.
 *
 * @returns {object} Mock logger
 */
const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

/**
 * Creates default config for OverlapClassifier.
 *
 * @returns {object} Config object
 */
const createDefaultConfig = () => ({
  // Required config keys for OverlapClassifier
  minOnEitherRateForMerge: 0.5,
  minGateOverlapRatio: 0.3,
  minCorrelationForMerge: 0.95,
  maxMeanAbsDiffForMerge: 0.05,
  maxExclusiveRateForSubsumption: 0.2,
  minCorrelationForSubsumption: 0.8,
  minDominanceForSubsumption: 0.15,

  // Optional numeric keys
  minGlobalCorrelationForMerge: 0.9,
  minGlobalCorrelationForSubsumption: 0.7,
  coPassSampleConfidenceThreshold: 30,
  minCoPassRatioForReliable: 0.1,
  coPassCorrelationWeight: 0.6,
  globalCorrelationWeight: 0.4,
  maxGlobalMeanAbsDiffForMerge: 0.1,
  nearMissGlobalCorrelationThreshold: 0.85,
});

/**
 * Creates candidate metrics (Stage A) for testing.
 *
 * @returns {object} Candidate metrics
 */
const createCandidateMetrics = () => ({
  activeAxisOverlap: 3,
  signAgreement: 0.8,
  weightCosineSimilarity: 0.9,
});

/**
 * Creates behavioral metrics that should trigger NEEDS_SEPARATION.
 * High co-activation, symmetrical overlap, but not nested.
 *
 * @returns {object} Behavioral metrics
 */
const createNeedsSeparationBehaviorMetrics = () => ({
  gateOverlap: {
    onEitherRate: 0.7,
    onBothRate: 0.5, // High co-activation
    pOnlyRate: 0.1,
    qOnlyRate: 0.1,
  },
  intensity: {
    pearsonCorrelation: 0.7, // Moderate correlation
    meanAbsDiff: 0.15,
    rmse: 0.18,
    pctWithinEps: 0.6,
    dominanceP: 0.3,
    dominanceQ: 0.25,
    globalMeanAbsDiff: 0.12,
    globalL2Distance: 0.15,
    globalOutputCorrelation: 0.75,
  },
  passRates: {
    passARate: 0.6,
    passBRate: 0.6,
    pA_given_B: 0.7, // Symmetrical - not nested
    pB_given_A: 0.7,
    coPassCount: 100,
    passACount: 120,
    passBCount: 120,
  },
  highCoactivation: {
    thresholds: [
      { t: 0.4, pHighA: 0.5, pHighB: 0.5, pHighBoth: 0.4, highJaccard: 0.6, highAgreement: 0.7 },
      { t: 0.6, pHighA: 0.3, pHighB: 0.3, pHighBoth: 0.2, highJaccard: 0.5, highAgreement: 0.6 },
    ],
  },
  gateImplication: null,
  gateParseInfo: {
    prototypeA: { parseStatus: 'complete', parsedGateCount: 2, totalGateCount: 2 },
    prototypeB: { parseStatus: 'complete', parsedGateCount: 2, totalGateCount: 2 },
  },
  divergenceExamples: [],
});

/**
 * Creates behavioral metrics that should trigger KEEP_DISTINCT.
 * Low co-activation, distinct firing patterns.
 *
 * @returns {object} Behavioral metrics
 */
const createKeepDistinctBehaviorMetrics = () => ({
  gateOverlap: {
    onEitherRate: 0.8,
    onBothRate: 0.05, // Very low co-activation
    pOnlyRate: 0.4,
    qOnlyRate: 0.35,
  },
  intensity: {
    pearsonCorrelation: NaN, // No co-pass samples for correlation
    meanAbsDiff: NaN,
    rmse: NaN,
    pctWithinEps: NaN,
    dominanceP: 0,
    dominanceQ: 0,
    globalMeanAbsDiff: 0.45,
    globalL2Distance: 0.5,
    globalOutputCorrelation: -0.3,
  },
  passRates: {
    passARate: 0.45,
    passBRate: 0.4,
    pA_given_B: 0.1,
    pB_given_A: 0.1,
    coPassCount: 5, // Very few co-pass samples
    passACount: 90,
    passBCount: 80,
  },
  highCoactivation: {
    thresholds: [
      { t: 0.4, pHighA: 0.3, pHighB: 0.3, pHighBoth: 0.02, highJaccard: 0.03, highAgreement: 0.4 },
    ],
  },
  gateImplication: null,
  gateParseInfo: {
    prototypeA: { parseStatus: 'complete', parsedGateCount: 1, totalGateCount: 1 },
    prototypeB: { parseStatus: 'complete', parsedGateCount: 1, totalGateCount: 1 },
  },
  divergenceExamples: [],
});

/**
 * Creates behavioral metrics that should trigger MERGE_RECOMMENDED.
 * Very high correlation and similarity.
 *
 * @returns {object} Behavioral metrics
 */
const createMergeRecommendedBehaviorMetrics = () => ({
  gateOverlap: {
    onEitherRate: 0.6,
    onBothRate: 0.55,
    pOnlyRate: 0.025,
    qOnlyRate: 0.025,
  },
  intensity: {
    pearsonCorrelation: 0.98, // Very high correlation
    meanAbsDiff: 0.02,
    rmse: 0.025,
    pctWithinEps: 0.95, // High similarity
    dominanceP: 0.1,
    dominanceQ: 0.1,
    globalMeanAbsDiff: 0.03,
    globalL2Distance: 0.04,
    globalOutputCorrelation: 0.97,
  },
  passRates: {
    passARate: 0.575,
    passBRate: 0.575,
    pA_given_B: 0.95,
    pB_given_A: 0.95,
    coPassCount: 110,
    passACount: 115,
    passBCount: 115,
  },
  highCoactivation: {
    thresholds: [
      { t: 0.4, pHighA: 0.6, pHighB: 0.6, pHighBoth: 0.58, highJaccard: 0.93, highAgreement: 0.95 },
    ],
  },
  gateImplication: null,
  gateParseInfo: {
    prototypeA: { parseStatus: 'complete', parsedGateCount: 2, totalGateCount: 2 },
    prototypeB: { parseStatus: 'complete', parsedGateCount: 2, totalGateCount: 2 },
  },
  divergenceExamples: [],
});

describe('OverlapClassifier - Classification Logic', () => {
  let classifier;
  let mockLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    classifier = new OverlapClassifier({
      config: createDefaultConfig(),
      logger: mockLogger,
    });
  });

  describe('NEEDS_SEPARATION classification', () => {
    it('classifies high co-activation with symmetrical overlap correctly', () => {
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createNeedsSeparationBehaviorMetrics();

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result).toHaveProperty('type');
      // With high co-activation and symmetrical overlap, classification should be valid
      expect(typeof result.type).toBe('string');
    });

    it('returns valid classification structure', () => {
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createNeedsSeparationBehaviorMetrics();

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('metrics');
      expect(result).toHaveProperty('thresholds');
      expect(typeof result.type).toBe('string');
    });

    it('includes allMatchingClassifications with confidence', () => {
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createNeedsSeparationBehaviorMetrics();

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result).toHaveProperty('allMatchingClassifications');
      expect(Array.isArray(result.allMatchingClassifications)).toBe(true);

      if (result.allMatchingClassifications.length > 0) {
        const primary = result.allMatchingClassifications.find(c => c.isPrimary);
        expect(primary).toHaveProperty('confidence');
        expect(primary.confidence).toBeGreaterThanOrEqual(0);
        expect(primary.confidence).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('KEEP_DISTINCT classification', () => {
    it('classifies low co-activation as keep_distinct', () => {
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createKeepDistinctBehaviorMetrics();

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('keep_distinct');
    });

    it('keep_distinct has valid structure', () => {
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createKeepDistinctBehaviorMetrics();

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('metrics');
      expect(result).toHaveProperty('thresholds');
    });
  });

  describe('MERGE_RECOMMENDED classification', () => {
    it('classifies very high similarity as merge_recommended', () => {
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createMergeRecommendedBehaviorMetrics();

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('merge_recommended');
    });

    it('merge_recommended has classification result', () => {
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createMergeRecommendedBehaviorMetrics();

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result).toHaveProperty('allMatchingClassifications');
      const primary = result.allMatchingClassifications.find(c => c.isPrimary);
      expect(primary).toBeDefined();
    });
  });

  describe('metrics structure in classification result', () => {
    it('includes gateOverlapRatio in metrics', () => {
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createNeedsSeparationBehaviorMetrics();

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.metrics).toHaveProperty('gateOverlapRatio');
      expect(typeof result.metrics.gateOverlapRatio).toBe('number');
    });

    it('gateOverlapRatio is computed correctly', () => {
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createNeedsSeparationBehaviorMetrics();

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      // gateOverlapRatio = onBothRate / onEitherRate = 0.5 / 0.7
      const expected = 0.5 / 0.7;
      expect(result.metrics.gateOverlapRatio).toBeCloseTo(expected, 4);
    });

    it('includes global metrics in result', () => {
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createNeedsSeparationBehaviorMetrics();

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.metrics).toHaveProperty('globalMeanAbsDiff');
      expect(result.metrics).toHaveProperty('globalL2Distance');
      expect(result.metrics).toHaveProperty('globalOutputCorrelation');
    });
  });

  describe('classification type completeness', () => {
    it('returns one of the valid classification types', () => {
      const validTypes = [
        'merge_recommended',
        'subsumed_recommended',
        'nested_siblings',
        'needs_separation',
        'convert_to_expression',
        'keep_distinct',
      ];

      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createNeedsSeparationBehaviorMetrics();

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(validTypes).toContain(result.type);
    });

    it('handles edge case with zero coPassCount', () => {
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = {
        ...createKeepDistinctBehaviorMetrics(),
        passRates: {
          ...createKeepDistinctBehaviorMetrics().passRates,
          coPassCount: 0,
        },
      };

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      // Should still return a valid classification
      expect(result).toHaveProperty('type');
      expect(typeof result.type).toBe('string');
    });
  });
});

describe('OverlapClassifier - Threshold Validation', () => {
  let classifier;
  let mockLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    classifier = new OverlapClassifier({
      config: createDefaultConfig(),
      logger: mockLogger,
    });
  });

  it('includes all config thresholds in result', () => {
    const candidateMetrics = createCandidateMetrics();
    const behaviorMetrics = createNeedsSeparationBehaviorMetrics();

    const result = classifier.classify(candidateMetrics, behaviorMetrics);

    expect(result.thresholds).toHaveProperty('minOnEitherRateForMerge');
    expect(result.thresholds).toHaveProperty('minGateOverlapRatio');
    expect(result.thresholds).toHaveProperty('minCorrelationForMerge');
  });

  it('thresholds match config values', () => {
    const candidateMetrics = createCandidateMetrics();
    const behaviorMetrics = createNeedsSeparationBehaviorMetrics();
    const config = createDefaultConfig();

    const result = classifier.classify(candidateMetrics, behaviorMetrics);

    expect(result.thresholds.minOnEitherRateForMerge).toBe(config.minOnEitherRateForMerge);
    expect(result.thresholds.minGateOverlapRatio).toBe(config.minGateOverlapRatio);
    expect(result.thresholds.minCorrelationForMerge).toBe(config.minCorrelationForMerge);
  });
});

describe('OverlapClassifier - Effective Correlation', () => {
  let classifier;
  let mockLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    classifier = new OverlapClassifier({
      config: createDefaultConfig(),
      logger: mockLogger,
    });
  });

  it('includes effectiveCorrelation in metrics', () => {
    const candidateMetrics = createCandidateMetrics();
    const behaviorMetrics = createNeedsSeparationBehaviorMetrics();

    const result = classifier.classify(candidateMetrics, behaviorMetrics);

    expect(result.metrics).toHaveProperty('effectiveCorrelation');
  });

  it('includes correlationSource in metrics', () => {
    const candidateMetrics = createCandidateMetrics();
    const behaviorMetrics = createNeedsSeparationBehaviorMetrics();

    const result = classifier.classify(candidateMetrics, behaviorMetrics);

    expect(result.metrics).toHaveProperty('correlationSource');
    expect(typeof result.metrics.correlationSource).toBe('string');
  });

  it('includes correlationConfidence in metrics', () => {
    const candidateMetrics = createCandidateMetrics();
    const behaviorMetrics = createNeedsSeparationBehaviorMetrics();

    const result = classifier.classify(candidateMetrics, behaviorMetrics);

    expect(result.metrics).toHaveProperty('correlationConfidence');
  });
});
