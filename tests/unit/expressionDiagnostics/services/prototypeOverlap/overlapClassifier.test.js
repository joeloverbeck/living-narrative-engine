/**
 * @file Unit tests for OverlapClassifier
 * Tests Stage C classification logic for prototype overlap analysis.
 */

import { describe, it, expect } from '@jest/globals';
import OverlapClassifier from '../../../../../src/expressionDiagnostics/services/prototypeOverlap/OverlapClassifier.js';

describe('OverlapClassifier', () => {
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
    minGlobalCorrelationForMerge: 0.9,
    minGlobalCorrelationForSubsumption: 0.85,
    coPassSampleConfidenceThreshold: 500,
    minCoPassRatioForReliable: 0.1,
    coPassCorrelationWeight: 0.6,
    globalCorrelationWeight: 0.4,
    maxGlobalMeanAbsDiffForMerge: 0.15,
    nearMissGlobalCorrelationThreshold: 0.8,
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
      globalMeanAbsDiff: 0.08,
      globalOutputCorrelation: 0.95,
      ...(overrides.intensity || {}),
    };
    const passRates = {
      coPassCount: 800,
      ...(overrides.passRates || {}),
    };
    return { gateOverlap, intensity, passRates };
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

  describe('constructor', () => {
    it('should create instance with valid dependencies', () => {
      const { classifier } = createClassifier();
      expect(classifier).toBeInstanceOf(OverlapClassifier);
    });

    it('should throw when logger is missing', () => {
      const config = createConfig();
      expect(() => new OverlapClassifier({ config, logger: null })).toThrow();
    });

    it('should throw when logger lacks required methods', () => {
      const config = createConfig();
      const invalidLogger = { debug: jest.fn() }; // Missing warn, error
      expect(
        () => new OverlapClassifier({ config, logger: invalidLogger })
      ).toThrow();
    });

    it('should throw when config is missing', () => {
      const logger = createMockLogger();
      expect(() => new OverlapClassifier({ config: null, logger })).toThrow();
    });

    it('should throw when config lacks required thresholds', () => {
      const logger = createMockLogger();
      const incompleteConfig = { minOnEitherRateForMerge: 0.05 }; // Missing others
      expect(
        () => new OverlapClassifier({ config: incompleteConfig, logger })
      ).toThrow();
    });

    it('should log error when config threshold is invalid', () => {
      const logger = createMockLogger();
      const invalidConfig = {
        minOnEitherRateForMerge: 'not a number',
        minGateOverlapRatio: 0.9,
        minCorrelationForMerge: 0.98,
        maxMeanAbsDiffForMerge: 0.03,
        maxExclusiveRateForSubsumption: 0.01,
        minCorrelationForSubsumption: 0.95,
        minDominanceForSubsumption: 0.95,
      };
      expect(
        () => new OverlapClassifier({ config: invalidConfig, logger })
      ).toThrow();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('Merge classification', () => {
    it('classifies as merge when all merge criteria met', () => {
      const { classifier } = createClassifier();
      const candidateMetrics = createCandidateMetrics();
      // All criteria met: high onEitherRate, high gateOverlapRatio, high correlation,
      // low meanAbsDiff, neither dominates
      const behaviorMetrics = createBehaviorMetrics({
        gateOverlap: {
          onEitherRate: 0.3,
          onBothRate: 0.28, // ratio = 0.28/0.3 = 0.933 > 0.9
          pOnlyRate: 0.01,
          qOnlyRate: 0.01,
        },
        intensity: {
          pearsonCorrelation: 0.99, // > 0.98
          meanAbsDiff: 0.02, // < 0.03
          dominanceP: 0.3, // < 0.95
          dominanceQ: 0.3, // < 0.95
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('merge_recommended');
      expect(result.subsumedPrototype).toBeUndefined();
    });

    it('classifies as merge via global correlation when co-pass is unavailable', () => {
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
          pearsonCorrelation: NaN,
          globalOutputCorrelation: 0.92,
          globalMeanAbsDiff: 0.1,
          meanAbsDiff: 0.02,
          dominanceP: 0.3,
          dominanceQ: 0.3,
        },
        passRates: {
          coPassCount: 50,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('merge_recommended');
      expect(result.metrics.correlationSource).toBe('global');
    });

    it('does NOT classify as merge when global correlation is below threshold', () => {
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
          pearsonCorrelation: NaN,
          globalOutputCorrelation: 0.85,
          globalMeanAbsDiff: 0.1,
          meanAbsDiff: 0.02,
          dominanceP: 0.3,
          dominanceQ: 0.3,
        },
        passRates: {
          coPassCount: 50,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('keep_distinct');
    });

    it('does NOT classify as merge when global mean abs diff is too high', () => {
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
          pearsonCorrelation: NaN,
          globalOutputCorrelation: 0.95,
          globalMeanAbsDiff: 0.25,
          meanAbsDiff: 0.02,
          dominanceP: 0.3,
          dominanceQ: 0.3,
        },
        passRates: {
          coPassCount: 50,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('keep_distinct');
    });

    it('classifies as merge via combined correlation when co-pass is sparse', () => {
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
          pearsonCorrelation: 0.94,
          globalOutputCorrelation: 0.88,
          globalMeanAbsDiff: 0.1,
          meanAbsDiff: 0.02,
          dominanceP: 0.3,
          dominanceQ: 0.3,
        },
        passRates: {
          coPassCount: 300,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('merge_recommended');
      expect(result.metrics.correlationSource).toBe('combined');
    });

    it('uses co-pass correlation when high co-pass samples are present', () => {
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
          pearsonCorrelation: 0.985,
          globalOutputCorrelation: 0.9,
          meanAbsDiff: 0.02,
          dominanceP: 0.3,
          dominanceQ: 0.3,
        },
        passRates: {
          coPassCount: 2000,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('merge_recommended');
      expect(result.metrics.correlationSource).toBe('co-pass');
    });

    it('does NOT classify as merge when onEitherRate too low (dead prototypes)', () => {
      const { classifier } = createClassifier();
      const candidateMetrics = createCandidateMetrics();
      // Low onEitherRate (prototypes rarely trigger)
      const behaviorMetrics = createBehaviorMetrics({
        gateOverlap: {
          onEitherRate: 0.02, // < 0.05 threshold
          onBothRate: 0.018, // ratio is still high
          pOnlyRate: 0.001,
          qOnlyRate: 0.001,
        },
        intensity: {
          pearsonCorrelation: 0.99,
          meanAbsDiff: 0.02,
          dominanceP: 0.3,
          dominanceQ: 0.3,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('keep_distinct');
    });

    it('does NOT classify as merge when gateOverlapRatio too low', () => {
      const { classifier } = createClassifier();
      const candidateMetrics = createCandidateMetrics();
      // Low gate overlap ratio
      const behaviorMetrics = createBehaviorMetrics({
        gateOverlap: {
          onEitherRate: 0.3,
          onBothRate: 0.2, // ratio = 0.2/0.3 = 0.667 < 0.9
          pOnlyRate: 0.05,
          qOnlyRate: 0.05,
        },
        intensity: {
          pearsonCorrelation: 0.99,
          meanAbsDiff: 0.02,
          dominanceP: 0.3,
          dominanceQ: 0.3,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('keep_distinct');
    });

    it('does NOT classify as merge when correlation too low', () => {
      const { classifier } = createClassifier();
      const candidateMetrics = createCandidateMetrics();
      // Low correlation
      const behaviorMetrics = createBehaviorMetrics({
        gateOverlap: {
          onEitherRate: 0.3,
          onBothRate: 0.28,
          pOnlyRate: 0.01,
          qOnlyRate: 0.01,
        },
        intensity: {
          pearsonCorrelation: 0.9, // < 0.98 threshold
          meanAbsDiff: 0.02,
          dominanceP: 0.3,
          dominanceQ: 0.3,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('keep_distinct');
    });

    it('does NOT classify as merge when meanAbsDiff too high (classified as needs_separation)', () => {
      const { classifier } = createClassifier();
      const candidateMetrics = createCandidateMetrics();
      // High mean absolute difference with high correlation and gate overlap
      // This triggers needs_separation: high overlap + high correlation + high meanAbsDiff
      const behaviorMetrics = createBehaviorMetrics({
        gateOverlap: {
          onEitherRate: 0.3,
          onBothRate: 0.28,
          pOnlyRate: 0.01,
          qOnlyRate: 0.01,
        },
        intensity: {
          pearsonCorrelation: 0.99,
          meanAbsDiff: 0.1, // > 0.03 threshold
          dominanceP: 0.3,
          dominanceQ: 0.3,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      // Now correctly classified as needs_separation (high overlap + high correlation + not merge-worthy)
      expect(result.type).toBe('needs_separation');
    });

    it('does NOT classify as merge when one dominance is overwhelming', () => {
      const { classifier } = createClassifier();
      const candidateMetrics = createCandidateMetrics();
      // High dominance (one prototype dominates)
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
          dominanceP: 0.96, // >= 0.95, too much dominance
          dominanceQ: 0.02,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      // Should be subsumed_recommended instead of merge_recommended (B is subsumed by A)
      expect(result.type).toBe('subsumed_recommended');
    });
  });

  describe('Effective correlation selection', () => {
    it('uses co-pass correlation when count and ratio are reliable', () => {
      const { classifier } = createClassifier();
      const result = classifier.classify(createCandidateMetrics(), createBehaviorMetrics({
        gateOverlap: {
          onEitherRate: 0.8,
          onBothRate: 0.16, // ratio = 0.2
        },
        intensity: {
          pearsonCorrelation: 0.95,
          globalOutputCorrelation: 0.88,
        },
        passRates: {
          coPassCount: 1000,
        },
      }));

      expect(result.metrics.correlationSource).toBe('co-pass');
      expect(result.metrics.correlationConfidence).toBe('high');
    });

    it('uses global correlation when co-pass is sparse', () => {
      const { classifier } = createClassifier();
      const result = classifier.classify(createCandidateMetrics(), createBehaviorMetrics({
        gateOverlap: {
          onEitherRate: 0.8,
          onBothRate: 0.016, // ratio = 0.02
        },
        intensity: {
          pearsonCorrelation: NaN,
          globalOutputCorrelation: 0.88,
        },
        passRates: {
          coPassCount: 50,
        },
      }));

      expect(result.metrics.correlationSource).toBe('global');
      expect(result.metrics.correlationConfidence).toBe('medium');
    });

    it('combines correlations when co-pass is borderline and global is valid', () => {
      const { classifier } = createClassifier();
      const result = classifier.classify(createCandidateMetrics(), createBehaviorMetrics({
        gateOverlap: {
          onEitherRate: 0.5,
          onBothRate: 0.04, // ratio = 0.08
        },
        intensity: {
          pearsonCorrelation: 0.92,
          globalOutputCorrelation: 0.85,
        },
        passRates: {
          coPassCount: 300,
        },
      }));

      expect(result.metrics.correlationSource).toBe('combined');
      expect(result.metrics.correlationConfidence).toBe('medium');
    });

    it('falls back to sparse co-pass correlation when global is unavailable', () => {
      const { classifier } = createClassifier();
      const result = classifier.classify(createCandidateMetrics(), createBehaviorMetrics({
        gateOverlap: {
          onEitherRate: 0.5,
          onBothRate: 0.05,
        },
        intensity: {
          pearsonCorrelation: 0.9,
          globalOutputCorrelation: NaN,
        },
        passRates: {
          coPassCount: 100,
        },
      }));

      expect(result.metrics.correlationSource).toBe('co-pass-sparse');
      expect(result.metrics.correlationConfidence).toBe('low');
    });

    it('returns none when no valid correlation exists', () => {
      const { classifier } = createClassifier();
      const result = classifier.classify(createCandidateMetrics(), createBehaviorMetrics({
        intensity: {
          pearsonCorrelation: NaN,
          globalOutputCorrelation: NaN,
        },
        passRates: {
          coPassCount: 0,
        },
      }));

      expect(result.metrics.correlationSource).toBe('none');
      expect(result.metrics.correlationConfidence).toBe('none');
    });
  });

  describe('Subsumption classification', () => {
    it('classifies as subsumed when A is subset of B', () => {
      const { classifier } = createClassifier();
      const candidateMetrics = createCandidateMetrics();
      // A rarely fires alone, B dominates A
      const behaviorMetrics = createBehaviorMetrics({
        gateOverlap: {
          onEitherRate: 0.3,
          onBothRate: 0.2,
          pOnlyRate: 0.005, // A rarely fires alone
          qOnlyRate: 0.095, // B fires alone more
        },
        intensity: {
          pearsonCorrelation: 0.96, // > 0.95
          meanAbsDiff: 0.05,
          dominanceP: 0.02, // A doesn't dominate
          dominanceQ: 0.96, // B dominates A
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('subsumed_recommended');
      expect(result.subsumedPrototype).toBe('a');
    });

    it('classifies as subsumed via global correlation when co-pass is sparse', () => {
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
          pearsonCorrelation: NaN,
          globalOutputCorrelation: 0.87,
          meanAbsDiff: 0.05,
          dominanceP: 0.02,
          dominanceQ: 0.96,
        },
        passRates: {
          coPassCount: 50,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('subsumed_recommended');
      expect(result.subsumedPrototype).toBe('a');
    });

    it('does NOT classify as subsumed when global correlation is below threshold', () => {
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
          pearsonCorrelation: NaN,
          globalOutputCorrelation: 0.8,
          meanAbsDiff: 0.05,
          dominanceP: 0.02,
          dominanceQ: 0.96,
        },
        passRates: {
          coPassCount: 50,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('keep_distinct');
    });

    it('uses co-pass correlation for high co-pass subsumption', () => {
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
          globalOutputCorrelation: 0.9,
          meanAbsDiff: 0.05,
          dominanceP: 0.02,
          dominanceQ: 0.96,
        },
        passRates: {
          coPassCount: 1500,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('subsumed_recommended');
      expect(result.metrics.correlationSource).toBe('co-pass');
    });

    it('classifies as subsumed when B is subset of A', () => {
      const { classifier } = createClassifier();
      const candidateMetrics = createCandidateMetrics();
      // B rarely fires alone, A dominates B
      const behaviorMetrics = createBehaviorMetrics({
        gateOverlap: {
          onEitherRate: 0.3,
          onBothRate: 0.2,
          pOnlyRate: 0.095, // A fires alone more
          qOnlyRate: 0.005, // B rarely fires alone
        },
        intensity: {
          pearsonCorrelation: 0.96, // > 0.95
          meanAbsDiff: 0.05,
          dominanceP: 0.96, // A dominates B
          dominanceQ: 0.02, // B doesn't dominate
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('subsumed_recommended');
      expect(result.subsumedPrototype).toBe('b');
    });

    it('sets subsumedPrototype to "a" when A is subsumed', () => {
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

      expect(result.subsumedPrototype).toBe('a');
    });

    it('sets subsumedPrototype to "b" when B is subsumed', () => {
      const { classifier } = createClassifier();
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics({
        gateOverlap: {
          onEitherRate: 0.3,
          onBothRate: 0.2,
          pOnlyRate: 0.095,
          qOnlyRate: 0.005,
        },
        intensity: {
          pearsonCorrelation: 0.96,
          meanAbsDiff: 0.05,
          dominanceP: 0.96,
          dominanceQ: 0.02,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.subsumedPrototype).toBe('b');
    });

    it('does not classify as subsumed when correlation too low', () => {
      const { classifier } = createClassifier();
      const candidateMetrics = createCandidateMetrics();
      // Low correlation prevents subsumption
      const behaviorMetrics = createBehaviorMetrics({
        gateOverlap: {
          onEitherRate: 0.3,
          onBothRate: 0.2,
          pOnlyRate: 0.005,
          qOnlyRate: 0.095,
        },
        intensity: {
          pearsonCorrelation: 0.8, // < 0.95 threshold
          meanAbsDiff: 0.05,
          dominanceP: 0.02,
          dominanceQ: 0.96,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('keep_distinct');
    });
  });

  describe('Not redundant classification', () => {
    it('classifies as not_redundant when no criteria met', () => {
      const { classifier } = createClassifier();
      const candidateMetrics = createCandidateMetrics();
      // Nothing matches merge or subsumed criteria
      const behaviorMetrics = createBehaviorMetrics({
        gateOverlap: {
          onEitherRate: 0.3,
          onBothRate: 0.15, // ratio = 0.5 < 0.9
          pOnlyRate: 0.1,
          qOnlyRate: 0.05,
        },
        intensity: {
          pearsonCorrelation: 0.8, // too low for both
          meanAbsDiff: 0.1,
          dominanceP: 0.4,
          dominanceQ: 0.4,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('keep_distinct');
      expect(result.subsumedPrototype).toBeUndefined();
    });

    it('classifies similar weights but different gates as not_redundant', () => {
      const { classifier } = createClassifier();
      // Similar weight vectors
      const candidateMetrics = createCandidateMetrics({
        activeAxisOverlap: 0.95,
        signAgreement: 0.98,
        weightCosineSimilarity: 0.99,
      });
      // But different gate behavior
      const behaviorMetrics = createBehaviorMetrics({
        gateOverlap: {
          onEitherRate: 0.5,
          onBothRate: 0.1, // ratio = 0.2, gates rarely both pass
          pOnlyRate: 0.2,
          qOnlyRate: 0.2,
        },
        intensity: {
          pearsonCorrelation: 0.95,
          meanAbsDiff: 0.02,
          dominanceP: 0.4,
          dominanceQ: 0.4,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('keep_distinct');
    });
  });

  describe('Edge cases', () => {
    it('does not merge dead prototypes (low onEitherRate)', () => {
      const { classifier } = createClassifier();
      const candidateMetrics = createCandidateMetrics();
      // Perfect metrics except low onEitherRate
      const behaviorMetrics = createBehaviorMetrics({
        gateOverlap: {
          onEitherRate: 0.01, // Dead - rarely triggers
          onBothRate: 0.0095, // ratio would be 0.95
          pOnlyRate: 0.0005,
          qOnlyRate: 0.0,
        },
        intensity: {
          pearsonCorrelation: 0.999,
          meanAbsDiff: 0.001,
          dominanceP: 0.5,
          dominanceQ: 0.5,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('keep_distinct');
    });

    it('handles NaN pearsonCorrelation as failure for merge', () => {
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
          pearsonCorrelation: NaN, // Insufficient data
          globalOutputCorrelation: NaN,
          meanAbsDiff: 0.02,
          dominanceP: 0.3,
          dominanceQ: 0.3,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('keep_distinct');
    });

    it('handles NaN pearsonCorrelation as failure for subsumption', () => {
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
          pearsonCorrelation: NaN, // Insufficient data
          globalOutputCorrelation: NaN,
          meanAbsDiff: 0.05,
          dominanceP: 0.02,
          dominanceQ: 0.96,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('keep_distinct');
    });

    it('handles NaN meanAbsDiff as failure for merge', () => {
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
          meanAbsDiff: NaN, // No joint samples
          dominanceP: 0.3,
          dominanceQ: 0.3,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('keep_distinct');
    });

    it('handles zero onEitherRate safely (division by zero)', () => {
      const { classifier } = createClassifier();
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics({
        gateOverlap: {
          onEitherRate: 0, // Never triggers
          onBothRate: 0,
          pOnlyRate: 0,
          qOnlyRate: 0,
        },
        intensity: {
          pearsonCorrelation: NaN,
          meanAbsDiff: NaN,
          dominanceP: 0,
          dominanceQ: 0,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('keep_distinct');
      // Should not throw due to division by zero
    });

    it('handles missing gateOverlap gracefully', () => {
      const { classifier } = createClassifier();
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = {
        intensity: {
          pearsonCorrelation: 0.99,
          meanAbsDiff: 0.02,
          dominanceP: 0.3,
          dominanceQ: 0.3,
        },
      };

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('keep_distinct');
    });

    it('handles missing intensity gracefully', () => {
      const { classifier } = createClassifier();
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = {
        gateOverlap: {
          onEitherRate: 0.3,
          onBothRate: 0.28,
          pOnlyRate: 0.01,
          qOnlyRate: 0.01,
        },
      };

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('keep_distinct');
    });

    it('handles null candidateMetrics gracefully', () => {
      const { classifier } = createClassifier();
      // Use behavior metrics that don't qualify for merge or subsumption
      const behaviorMetrics = createBehaviorMetrics({
        gateOverlap: {
          onEitherRate: 0.3,
          onBothRate: 0.1, // Low gateOverlapRatio = 0.33 < 0.9
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

      const result = classifier.classify(null, behaviorMetrics);

      expect(result.type).toBe('keep_distinct');
      // Verify metrics were extracted safely with defaults for null candidate
      expect(result.metrics.activeAxisOverlap).toBe(0);
    });

    it('handles null behaviorMetrics gracefully', () => {
      const { classifier } = createClassifier();
      const candidateMetrics = createCandidateMetrics();

      const result = classifier.classify(candidateMetrics, null);

      expect(result.type).toBe('keep_distinct');
    });
  });

  describe('Boundary conditions', () => {
    it('classifies as merge at exact threshold boundaries', () => {
      const { classifier } = createClassifier({
        minOnEitherRateForMerge: 0.05,
        minGateOverlapRatio: 0.9,
        minCorrelationForMerge: 0.98,
        maxMeanAbsDiffForMerge: 0.03,
        minDominanceForSubsumption: 0.95,
      });
      const candidateMetrics = createCandidateMetrics();
      // At exact boundaries using values that avoid floating point precision issues
      // 0.45/0.5 = 0.9 exactly in JavaScript
      const behaviorMetrics = createBehaviorMetrics({
        gateOverlap: {
          onEitherRate: 0.5, // Well above threshold
          onBothRate: 0.45, // ratio = 0.45/0.5 = 0.9 exactly
          pOnlyRate: 0.025,
          qOnlyRate: 0.025,
        },
        intensity: {
          pearsonCorrelation: 0.98, // Exactly at threshold
          meanAbsDiff: 0.029, // Just below threshold
          dominanceP: 0.94, // Just below 0.95
          dominanceQ: 0.94,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('merge_recommended');
    });

    it('does not classify as merge when just below onEitherRate threshold', () => {
      const { classifier } = createClassifier();
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics({
        gateOverlap: {
          onEitherRate: 0.049999, // Just below 0.05
          onBothRate: 0.045,
          pOnlyRate: 0.0025,
          qOnlyRate: 0.0025,
        },
        intensity: {
          pearsonCorrelation: 0.99,
          meanAbsDiff: 0.02,
          dominanceP: 0.3,
          dominanceQ: 0.3,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('keep_distinct');
    });

    it('classifies as subsumed at exact threshold boundaries', () => {
      const { classifier } = createClassifier({
        maxExclusiveRateForSubsumption: 0.01,
        minCorrelationForSubsumption: 0.95,
        minDominanceForSubsumption: 0.95,
      });
      const candidateMetrics = createCandidateMetrics();
      // Exactly at boundaries
      const behaviorMetrics = createBehaviorMetrics({
        gateOverlap: {
          onEitherRate: 0.3,
          onBothRate: 0.2,
          pOnlyRate: 0.01, // Exactly at threshold
          qOnlyRate: 0.09,
        },
        intensity: {
          pearsonCorrelation: 0.95, // Exactly at threshold
          meanAbsDiff: 0.05,
          dominanceP: 0.02,
          dominanceQ: 0.95, // Exactly at threshold
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('subsumed_recommended');
      expect(result.subsumedPrototype).toBe('a');
    });
  });

  describe('Determinism', () => {
    it('produces same output for same inputs (deterministic)', () => {
      const { classifier } = createClassifier();
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics();

      const result1 = classifier.classify(candidateMetrics, behaviorMetrics);
      const result2 = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result1.type).toBe(result2.type);
      expect(result1.subsumedPrototype).toBe(result2.subsumedPrototype);
      expect(result1.metrics).toEqual(result2.metrics);
      expect(result1.thresholds).toEqual(result2.thresholds);
    });

    it('produces same classification with different config instances having same values', () => {
      const { classifier: classifier1 } = createClassifier();
      const { classifier: classifier2 } = createClassifier();
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics();

      const result1 = classifier1.classify(candidateMetrics, behaviorMetrics);
      const result2 = classifier2.classify(candidateMetrics, behaviorMetrics);

      expect(result1.type).toBe(result2.type);
    });
  });

  describe('Result structure', () => {
    it('includes thresholds in result', () => {
      const { classifier } = createClassifier();
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics();

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.thresholds).toBeDefined();
      expect(result.thresholds.minOnEitherRateForMerge).toBe(0.05);
      expect(result.thresholds.minGateOverlapRatio).toBe(0.9);
      expect(result.thresholds.minCorrelationForMerge).toBe(0.98);
      expect(result.thresholds.maxMeanAbsDiffForMerge).toBe(0.03);
    });

    it('includes computed metrics in result', () => {
      const { classifier } = createClassifier();
      const candidateMetrics = createCandidateMetrics({
        activeAxisOverlap: 0.85,
      });
      const behaviorMetrics = createBehaviorMetrics({
        gateOverlap: {
          onEitherRate: 0.4,
          onBothRate: 0.35,
          pOnlyRate: 0.02,
          qOnlyRate: 0.03,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.metrics).toBeDefined();
      expect(result.metrics.activeAxisOverlap).toBe(0.85);
      expect(result.metrics.onEitherRate).toBe(0.4);
      expect(result.metrics.onBothRate).toBe(0.35);
      expect(result.metrics.gateOverlapRatio).toBeCloseTo(0.875, 5);
    });

    it('subsumedPrototype is only present when type is subsumed', () => {
      const { classifier } = createClassifier();
      const candidateMetrics = createCandidateMetrics();

      // Test merge
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

      // Test not_redundant
      const notRedundantMetrics = createBehaviorMetrics({
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
      const notRedundantResult = classifier.classify(
        candidateMetrics,
        notRedundantMetrics
      );
      expect(notRedundantResult.type).toBe('keep_distinct');
      expect(notRedundantResult.subsumedPrototype).toBeUndefined();

      // Test subsumed
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
    });
  });

  describe('Logging', () => {
    it('logs debug message for merge classification', () => {
      const { classifier, logger } = createClassifier();
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

      classifier.classify(candidateMetrics, behaviorMetrics);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('MERGE_RECOMMENDED')
      );
    });

    it('logs debug message for subsumed classification', () => {
      const { classifier, logger } = createClassifier();
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

      classifier.classify(candidateMetrics, behaviorMetrics);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('SUBSUMED_RECOMMENDED')
      );
    });

    it('logs debug message for not_redundant classification', () => {
      const { classifier, logger } = createClassifier();
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

      classifier.classify(candidateMetrics, behaviorMetrics);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('KEEP_DISTINCT')
      );
    });
  });

  describe('Nested siblings classification', () => {
    /**
     * Create behavioral metrics with passRates for nested siblings tests.
     *
     * @param {object} [overrides] - Override specific values
     * @returns {object} Behavioral metrics with passRates
     */
    const createBehaviorMetricsWithPassRates = (overrides = {}) => {
      const gateOverlap = {
        onEitherRate: 0.3,
        onBothRate: 0.2,
        pOnlyRate: 0.05,
        qOnlyRate: 0.05,
        ...(overrides.gateOverlap || {}),
      };
      const intensity = {
        pearsonCorrelation: 0.8,
        meanAbsDiff: 0.1,
        dominanceP: 0.4,
        dominanceQ: 0.4,
        ...(overrides.intensity || {}),
      };
      const passRates = {
        passARate: 0.25,
        passBRate: 0.25,
        pA_given_B: 0.8,
        pB_given_A: 0.8,
        coPassCount: 500,
        ...(overrides.passRates || {}),
      };
      return { gateOverlap, intensity, passRates };
    };

    it('classifies as nested_siblings when pB_given_A is high but pA_given_B is low', () => {
      const { classifier } = createClassifier({
        nestedConditionalThreshold: 0.97,
      });
      const candidateMetrics = createCandidateMetrics();
      // A implies B: when A fires, B almost always fires too (pB_given_A high)
      // But B can fire without A (pA_given_B low)
      const behaviorMetrics = createBehaviorMetricsWithPassRates({
        passRates: {
          pA_given_B: 0.6, // Low: B fires even when A doesn't
          pB_given_A: 0.98, // High: A implies B
          coPassCount: 500,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('nested_siblings');
      expect(result.narrowerPrototype).toBe('a'); // A is narrower (implies B)
    });

    it('classifies as nested_siblings when pA_given_B is high but pB_given_A is low (reverse)', () => {
      const { classifier } = createClassifier({
        nestedConditionalThreshold: 0.97,
      });
      const candidateMetrics = createCandidateMetrics();
      // B implies A: when B fires, A almost always fires too
      const behaviorMetrics = createBehaviorMetricsWithPassRates({
        passRates: {
          pA_given_B: 0.98, // High: B implies A
          pB_given_A: 0.6, // Low: A can fire without B
          coPassCount: 500,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('nested_siblings');
      expect(result.narrowerPrototype).toBe('b'); // B is narrower (implies A)
    });

    it('does NOT classify as nested_siblings when both conditionals are high (symmetric)', () => {
      const { classifier } = createClassifier({
        nestedConditionalThreshold: 0.97,
      });
      const candidateMetrics = createCandidateMetrics();
      // Both high - they're equivalent, not nested
      const behaviorMetrics = createBehaviorMetricsWithPassRates({
        passRates: {
          pA_given_B: 0.98,
          pB_given_A: 0.98,
          coPassCount: 500,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).not.toBe('nested_siblings');
    });

    it('does NOT classify as nested_siblings when both conditionals are low', () => {
      const { classifier } = createClassifier({
        nestedConditionalThreshold: 0.97,
      });
      const candidateMetrics = createCandidateMetrics();
      // Both low - no nesting relationship
      const behaviorMetrics = createBehaviorMetricsWithPassRates({
        passRates: {
          pA_given_B: 0.6,
          pB_given_A: 0.6,
          coPassCount: 500,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).not.toBe('nested_siblings');
    });

    it('does NOT classify as nested_siblings when passRates is null', () => {
      const { classifier } = createClassifier({
        nestedConditionalThreshold: 0.97,
      });
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics(); // No passRates

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).not.toBe('nested_siblings');
    });

    it('does NOT classify as nested_siblings when conditionals are NaN', () => {
      const { classifier } = createClassifier({
        nestedConditionalThreshold: 0.97,
      });
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetricsWithPassRates({
        passRates: {
          pA_given_B: NaN,
          pB_given_A: 0.98,
          coPassCount: 0,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).not.toBe('nested_siblings');
    });

    it('classifies nested_siblings at exactly the threshold boundary', () => {
      const { classifier } = createClassifier({
        nestedConditionalThreshold: 0.97,
      });
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetricsWithPassRates({
        passRates: {
          pA_given_B: 0.5, // Low
          pB_given_A: 0.97, // Exactly at threshold
          coPassCount: 500,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('nested_siblings');
    });

    it('logs debug message for nested_siblings classification', () => {
      const { classifier, logger } = createClassifier({
        nestedConditionalThreshold: 0.97,
      });
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetricsWithPassRates({
        passRates: {
          pA_given_B: 0.5,
          pB_given_A: 0.98,
          coPassCount: 500,
        },
      });

      classifier.classify(candidateMetrics, behaviorMetrics);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('NESTED_SIBLINGS')
      );
    });
  });

  describe('Needs separation classification', () => {
    /**
     * Create behavioral metrics with passRates for needs separation tests.
     *
     * @param {object} [overrides] - Override specific values
     * @returns {object} Behavioral metrics with passRates
     */
    const createBehaviorMetricsWithPassRates = (overrides = {}) => {
      const gateOverlap = {
        onEitherRate: 0.4,
        onBothRate: 0.32, // gateOverlapRatio = 0.8
        pOnlyRate: 0.04,
        qOnlyRate: 0.04,
        ...(overrides.gateOverlap || {}),
      };
      const intensity = {
        pearsonCorrelation: 0.9,
        meanAbsDiff: 0.1, // Above merge threshold (0.03)
        dominanceP: 0.4,
        dominanceQ: 0.4,
        ...(overrides.intensity || {}),
      };
      const passRates = {
        passARate: 0.36,
        passBRate: 0.36,
        pA_given_B: 0.7, // Not nested
        pB_given_A: 0.7, // Not nested
        coPassCount: 500,
        ...(overrides.passRates || {}),
      };
      return { gateOverlap, intensity, passRates };
    };

    it('classifies as needs_separation when overlap is high, correlation is high, but meanAbsDiff is high', () => {
      const { classifier } = createClassifier();
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetricsWithPassRates({
        gateOverlap: {
          onEitherRate: 0.5,
          onBothRate: 0.4, // gateOverlapRatio = 0.8 >= 0.70
          pOnlyRate: 0.05,
          qOnlyRate: 0.05,
        },
        intensity: {
          pearsonCorrelation: 0.85, // High correlation >= 0.80
          meanAbsDiff: 0.1, // Above merge threshold (0.03)
          dominanceP: 0.4,
          dominanceQ: 0.4,
        },
        passRates: {
          pA_given_B: 0.7, // Not nested (< 0.97)
          pB_given_A: 0.7, // Not nested (< 0.97)
          coPassCount: 500,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('needs_separation');
    });

    it('does NOT classify as needs_separation when gateOverlapRatio < 0.70', () => {
      const { classifier } = createClassifier();
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetricsWithPassRates({
        gateOverlap: {
          onEitherRate: 0.5,
          onBothRate: 0.3, // gateOverlapRatio = 0.6 < 0.70
          pOnlyRate: 0.1,
          qOnlyRate: 0.1,
        },
        intensity: {
          pearsonCorrelation: 0.9,
          meanAbsDiff: 0.1,
          dominanceP: 0.4,
          dominanceQ: 0.4,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).not.toBe('needs_separation');
    });

    it('does NOT classify as needs_separation when correlation < 0.80', () => {
      const { classifier } = createClassifier();
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetricsWithPassRates({
        gateOverlap: {
          onEitherRate: 0.5,
          onBothRate: 0.4, // gateOverlapRatio = 0.8
          pOnlyRate: 0.05,
          qOnlyRate: 0.05,
        },
        intensity: {
          pearsonCorrelation: 0.7, // Too low < 0.80
          meanAbsDiff: 0.1,
          dominanceP: 0.4,
          dominanceQ: 0.4,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).not.toBe('needs_separation');
    });

    it('does NOT classify as needs_separation when correlation is NaN', () => {
      const { classifier } = createClassifier();
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetricsWithPassRates({
        gateOverlap: {
          onEitherRate: 0.5,
          onBothRate: 0.4,
          pOnlyRate: 0.05,
          qOnlyRate: 0.05,
        },
        intensity: {
          pearsonCorrelation: NaN,
          meanAbsDiff: 0.1,
          dominanceP: 0.4,
          dominanceQ: 0.4,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).not.toBe('needs_separation');
    });

    it('does NOT classify as needs_separation when meanAbsDiff is within merge threshold', () => {
      const { classifier } = createClassifier({
        maxMeanAbsDiffForMerge: 0.03,
      });
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetricsWithPassRates({
        gateOverlap: {
          onEitherRate: 0.5,
          onBothRate: 0.4,
          pOnlyRate: 0.05,
          qOnlyRate: 0.05,
        },
        intensity: {
          pearsonCorrelation: 0.9,
          meanAbsDiff: 0.02, // Within merge threshold
          dominanceP: 0.4,
          dominanceQ: 0.4,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).not.toBe('needs_separation');
    });

    it('does NOT classify as needs_separation when nested (pB_given_A >= threshold)', () => {
      const { classifier } = createClassifier({
        nestedConditionalThreshold: 0.97,
      });
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetricsWithPassRates({
        gateOverlap: {
          onEitherRate: 0.5,
          onBothRate: 0.4,
          pOnlyRate: 0.05,
          qOnlyRate: 0.05,
        },
        intensity: {
          pearsonCorrelation: 0.9,
          meanAbsDiff: 0.1,
          dominanceP: 0.4,
          dominanceQ: 0.4,
        },
        passRates: {
          pA_given_B: 0.5,
          pB_given_A: 0.98, // Nested
          coPassCount: 500,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      // Should be nested_siblings, not needs_separation
      expect(result.type).toBe('nested_siblings');
    });

    it('logs debug message for needs_separation classification', () => {
      const { classifier, logger } = createClassifier();
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetricsWithPassRates({
        gateOverlap: {
          onEitherRate: 0.5,
          onBothRate: 0.4,
          pOnlyRate: 0.05,
          qOnlyRate: 0.05,
        },
        intensity: {
          pearsonCorrelation: 0.85,
          meanAbsDiff: 0.1,
          dominanceP: 0.4,
          dominanceQ: 0.4,
        },
        passRates: {
          pA_given_B: 0.7,
          pB_given_A: 0.7,
          coPassCount: 500,
        },
      });

      classifier.classify(candidateMetrics, behaviorMetrics);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('NEEDS_SEPARATION')
      );
    });
  });

  describe('Classification priority order', () => {
    it('nested_siblings takes priority over needs_separation', () => {
      const { classifier } = createClassifier({
        nestedConditionalThreshold: 0.97,
      });
      const candidateMetrics = createCandidateMetrics();
      // Metrics that would qualify for both nested_siblings AND needs_separation
      const behaviorMetrics = {
        gateOverlap: {
          onEitherRate: 0.5,
          onBothRate: 0.4, // gateOverlapRatio = 0.8 (qualifies for needs_separation)
          pOnlyRate: 0.05,
          qOnlyRate: 0.05,
        },
        intensity: {
          pearsonCorrelation: 0.9, // High correlation (qualifies for needs_separation)
          meanAbsDiff: 0.1, // Above merge threshold
          dominanceP: 0.4,
          dominanceQ: 0.4,
        },
        passRates: {
          pA_given_B: 0.5,
          pB_given_A: 0.98, // Nested (qualifies for nested_siblings)
          coPassCount: 500,
        },
      };

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      // nested_siblings should win due to priority
      expect(result.type).toBe('nested_siblings');
    });

    it('needs_separation takes priority over keep_distinct', () => {
      const { classifier } = createClassifier();
      const candidateMetrics = createCandidateMetrics();
      // Metrics that qualify for needs_separation but not nested_siblings
      const behaviorMetrics = {
        gateOverlap: {
          onEitherRate: 0.5,
          onBothRate: 0.4, // gateOverlapRatio = 0.8
          pOnlyRate: 0.05,
          qOnlyRate: 0.05,
        },
        intensity: {
          pearsonCorrelation: 0.85,
          meanAbsDiff: 0.1,
          dominanceP: 0.4,
          dominanceQ: 0.4,
        },
        passRates: {
          pA_given_B: 0.6,
          pB_given_A: 0.6, // Not nested
          coPassCount: 500,
        },
      };

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('needs_separation');
    });

    it('keep_distinct is the fallback when no other classification matches', () => {
      const { classifier } = createClassifier();
      const candidateMetrics = createCandidateMetrics();
      // Metrics that don't qualify for any specific classification
      const behaviorMetrics = {
        gateOverlap: {
          onEitherRate: 0.3,
          onBothRate: 0.1, // Low gateOverlapRatio = 0.33
          pOnlyRate: 0.1,
          qOnlyRate: 0.1,
        },
        intensity: {
          pearsonCorrelation: 0.5, // Low correlation
          meanAbsDiff: 0.2,
          dominanceP: 0.4,
          dominanceQ: 0.4,
        },
        passRates: {
          pA_given_B: 0.5,
          pB_given_A: 0.5, // Not nested
          coPassCount: 500,
        },
      };

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('keep_distinct');
    });

    it('includes multi-label evidence with primary classification', () => {
      const { classifier } = createClassifier();
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics();

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(Array.isArray(result.allMatchingClassifications)).toBe(true);
      expect(result.allMatchingClassifications[0].type).toBe(result.type);
      expect(result.allMatchingClassifications[0].isPrimary).toBe(true);
    });
  });
});
