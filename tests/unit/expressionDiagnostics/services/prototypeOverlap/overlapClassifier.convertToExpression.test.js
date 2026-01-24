/**
 * @file Unit tests for OverlapClassifier convert_to_expression classification
 * PROREDANAV2-012: Tests GateImplicationEvaluator integration and structural heuristic.
 */

import { describe, it, expect } from '@jest/globals';
import OverlapClassifier from '../../../../../src/expressionDiagnostics/services/prototypeOverlap/OverlapClassifier.js';

describe('OverlapClassifier - convert_to_expression', () => {
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
    nestedConditionalThreshold: 0.97,
    enableConvertToExpression: true, // Feature flag
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
      onBothRate: 0.15,
      pOnlyRate: 0.08,
      qOnlyRate: 0.07,
      ...(overrides.gateOverlap || {}),
    };
    const intensity = {
      pearsonCorrelation: 0.85,
      meanAbsDiff: 0.05,
      dominanceP: 0.3,
      dominanceQ: 0.3,
      ...(overrides.intensity || {}),
    };
    const passRates = overrides.passRates ?? null;
    const gateImplication = overrides.gateImplication ?? null;
    // Include gateParseInfo for deterministic nesting tests (Phase 3 guards)
    const gateParseInfo = overrides.gateParseInfo ?? null;

    return { gateOverlap, intensity, passRates, gateImplication, gateParseInfo };
  };

  /**
   * Create complete gateParseInfo for deterministic nesting tests.
   *
   * @returns {object} gateParseInfo with complete parseStatus
   */
  const createCompleteGateParseInfo = () => ({
    prototypeA: {
      parseStatus: 'complete',
      parsedGateCount: 2,
      totalGateCount: 2,
      unparsedGates: [],
    },
    prototypeB: {
      parseStatus: 'complete',
      parsedGateCount: 2,
      totalGateCount: 2,
      unparsedGates: [],
    },
  });

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

  /**
   * Create gateImplication object with A→B relationship (A is narrower).
   *
   * @param {object} [overrides] - Override specific values
   * @returns {object} GateImplication result
   */
  const createAImpliesBGateImplication = (overrides = {}) => ({
    A_implies_B: true,
    B_implies_A: false,
    counterExampleAxes: [],
    relation: 'narrower',
    evidence: [
      {
        axis: 'threat',
        intervalA: { lower: null, upper: 0.15, unsatisfiable: false },
        intervalB: { lower: null, upper: null, unsatisfiable: false },
        A_subset_B: true,
        B_subset_A: false,
      },
    ],
    ...overrides,
  });

  /**
   * Create gateImplication object with B→A relationship (B is narrower).
   *
   * @param {object} [overrides] - Override specific values
   * @returns {object} GateImplication result
   */
  const createBImpliesAGateImplication = (overrides = {}) => ({
    A_implies_B: false,
    B_implies_A: true,
    counterExampleAxes: [],
    relation: 'wider',
    evidence: [
      {
        axis: 'threat',
        intervalA: { lower: null, upper: null, unsatisfiable: false },
        intervalB: { lower: null, upper: 0.18, unsatisfiable: false },
        A_subset_B: false,
        B_subset_A: true,
      },
    ],
    ...overrides,
  });

  describe('Feature flag gating', () => {
    it('returns no match when feature flag is disabled', () => {
      const { classifier } = createClassifier({
        enableConvertToExpression: false,
      });

      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics({
        gateImplication: createAImpliesBGateImplication(),
        passRates: { pA_given_B: 0.5, pB_given_A: 0.99 },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      // Should not be convert_to_expression since feature is disabled
      expect(result.type).not.toBe('convert_to_expression');
    });

    it('processes convert_to_expression when feature flag is enabled', () => {
      const { classifier } = createClassifier({
        enableConvertToExpression: true,
      });

      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics({
        gateImplication: createAImpliesBGateImplication(),
        passRates: { pA_given_B: 0.5, pB_given_A: 0.99 },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      // With proper nesting and low-threat, should classify as convert_to_expression
      expect(result.type).toBe('convert_to_expression');
    });
  });

  describe('Nesting detection', () => {
    it('returns no match when no nesting exists (symmetric implication)', () => {
      const { classifier } = createClassifier();

      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics({
        gateImplication: {
          A_implies_B: true,
          B_implies_A: true, // Symmetric - no nesting
          counterExampleAxes: [],
          relation: 'equal',
          evidence: [
            {
              axis: 'threat',
              intervalA: { lower: null, upper: 0.15, unsatisfiable: false },
              intervalB: { lower: null, upper: 0.15, unsatisfiable: false },
              A_subset_B: true,
              B_subset_A: true,
            },
          ],
        },
        passRates: { pA_given_B: 0.5, pB_given_A: 0.5 }, // Symmetric behavioral
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).not.toBe('convert_to_expression');
    });

    it('returns no match when no nesting and no gateImplication data', () => {
      const { classifier } = createClassifier();

      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics({
        gateImplication: null,
        passRates: { pA_given_B: 0.5, pB_given_A: 0.5 },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).not.toBe('convert_to_expression');
    });
  });

  describe('Deterministic A→B with low-threat', () => {
    it('classifies as convert_to_expression when A implies B with threat <= 0.20', () => {
      const { classifier } = createClassifier();

      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics({
        gateImplication: createAImpliesBGateImplication({
          evidence: [
            {
              axis: 'threat',
              intervalA: { lower: null, upper: 0.15, unsatisfiable: false },
              intervalB: { lower: null, upper: null, unsatisfiable: false },
              A_subset_B: true,
              B_subset_A: false,
            },
          ],
        }),
        passRates: { pA_given_B: 0.5, pB_given_A: 0.99 },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('convert_to_expression');
      expect(result.narrowerPrototype).toBe('a');
    });

    it('includes narrowerPrototype = a in result', () => {
      const { classifier } = createClassifier();

      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics({
        gateImplication: createAImpliesBGateImplication(),
        passRates: { pA_given_B: 0.5, pB_given_A: 0.99 },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.narrowerPrototype).toBe('a');
    });
  });

  describe('Deterministic B→A with low-threat', () => {
    it('classifies as convert_to_expression when B implies A with threat <= 0.20', () => {
      const { classifier } = createClassifier();

      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics({
        gateImplication: createBImpliesAGateImplication({
          evidence: [
            {
              axis: 'threat',
              intervalA: { lower: null, upper: null, unsatisfiable: false },
              intervalB: { lower: null, upper: 0.18, unsatisfiable: false },
              A_subset_B: false,
              B_subset_A: true,
            },
          ],
        }),
        passRates: { pA_given_B: 0.99, pB_given_A: 0.5 },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('convert_to_expression');
      expect(result.narrowerPrototype).toBe('b');
    });
  });

  describe('Missing or high threat threshold', () => {
    it('returns no match when no threat axis in evidence', () => {
      const { classifier } = createClassifier();

      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics({
        gateImplication: {
          A_implies_B: true,
          B_implies_A: false,
          counterExampleAxes: [],
          relation: 'narrower',
          evidence: [
            {
              axis: 'arousal', // Not threat
              intervalA: { lower: -0.5, upper: 0.5, unsatisfiable: false },
              intervalB: { lower: null, upper: null, unsatisfiable: false },
              A_subset_B: true,
              B_subset_A: false,
            },
          ],
        },
        passRates: { pA_given_B: 0.5, pB_given_A: 0.99 },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      // Should not match convert_to_expression without threat axis
      expect(result.type).not.toBe('convert_to_expression');
    });

    it('returns no match when threat upper bound > 0.20', () => {
      const { classifier } = createClassifier();

      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics({
        gateImplication: {
          A_implies_B: true,
          B_implies_A: false,
          counterExampleAxes: [],
          relation: 'narrower',
          evidence: [
            {
              axis: 'threat',
              intervalA: { lower: null, upper: 0.5, unsatisfiable: false }, // > 0.20
              intervalB: { lower: null, upper: null, unsatisfiable: false },
              A_subset_B: true,
              B_subset_A: false,
            },
          ],
        },
        passRates: { pA_given_B: 0.5, pB_given_A: 0.99 },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      // Should not match because threat > 0.20
      expect(result.type).not.toBe('convert_to_expression');
    });

    it('returns no match when threat upper bound is null (unbounded)', () => {
      const { classifier } = createClassifier();

      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics({
        gateImplication: {
          A_implies_B: true,
          B_implies_A: false,
          counterExampleAxes: [],
          relation: 'narrower',
          evidence: [
            {
              axis: 'threat',
              intervalA: { lower: 0.1, upper: null, unsatisfiable: false }, // Unbounded upper
              intervalB: { lower: null, upper: null, unsatisfiable: false },
              A_subset_B: true,
              B_subset_A: false,
            },
          ],
        },
        passRates: { pA_given_B: 0.5, pB_given_A: 0.99 },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      // Unbounded upper means no low-threat constraint
      expect(result.type).not.toBe('convert_to_expression');
    });
  });

  describe('Classification priority', () => {
    it('convert_to_expression takes priority over nested_siblings', () => {
      const { classifier } = createClassifier();

      const candidateMetrics = createCandidateMetrics();
      // Pair that qualifies for both nested_siblings AND convert_to_expression
      const behaviorMetrics = createBehaviorMetrics({
        gateImplication: createAImpliesBGateImplication(),
        passRates: {
          pA_given_B: 0.5,
          pB_given_A: 0.99, // Would trigger nested_siblings (A narrower)
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      // convert_to_expression has higher priority than nested_siblings
      expect(result.type).toBe('convert_to_expression');
    });
  });

  describe('Behavioral nesting alone', () => {
    it('behavioral nesting without structural match does not classify as convert_to_expression', () => {
      const { classifier } = createClassifier();

      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics({
        // No gateImplication data at all
        gateImplication: null,
        passRates: {
          pA_given_B: 0.5,
          pB_given_A: 0.99, // Behavioral nesting present
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      // Without gateImplication, can't match structural heuristic
      expect(result.type).not.toBe('convert_to_expression');
    });

    it('behavioral nesting with gateImplication but no threat axis does not match', () => {
      const { classifier } = createClassifier();

      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics({
        gateImplication: {
          A_implies_B: true,
          B_implies_A: false,
          counterExampleAxes: [],
          relation: 'narrower',
          evidence: [], // Empty evidence - no threat axis
        },
        passRates: {
          pA_given_B: 0.5,
          pB_given_A: 0.99,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      // Nesting exists but structural heuristic fails (no threat axis)
      expect(result.type).not.toBe('convert_to_expression');
    });
  });

  describe('Edge cases', () => {
    it('handles threat upper bound exactly at 0.20 threshold', () => {
      const { classifier } = createClassifier();

      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics({
        gateImplication: {
          A_implies_B: true,
          B_implies_A: false,
          counterExampleAxes: [],
          relation: 'narrower',
          evidence: [
            {
              axis: 'threat',
              intervalA: { lower: null, upper: 0.2, unsatisfiable: false }, // Exactly 0.20
              intervalB: { lower: null, upper: null, unsatisfiable: false },
              A_subset_B: true,
              B_subset_A: false,
            },
          ],
        },
        passRates: { pA_given_B: 0.5, pB_given_A: 0.99 },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      // 0.20 <= 0.20 should pass the threshold check
      expect(result.type).toBe('convert_to_expression');
    });

    it('handles NaN passRates gracefully with deterministic nesting', () => {
      const { classifier } = createClassifier();

      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics({
        gateImplication: createAImpliesBGateImplication(),
        passRates: { pA_given_B: NaN, pB_given_A: NaN },
        gateParseInfo: createCompleteGateParseInfo(), // Required for deterministic nesting
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      // Deterministic nesting should still work even with NaN passRates
      expect(result.type).toBe('convert_to_expression');
      expect(result.narrowerPrototype).toBe('a');
    });

    it('handles missing passRates with deterministic nesting', () => {
      const { classifier } = createClassifier();

      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics({
        gateImplication: createAImpliesBGateImplication(),
        passRates: null,
        gateParseInfo: createCompleteGateParseInfo(), // Required for deterministic nesting
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      // Deterministic nesting should work without behavioral data
      expect(result.type).toBe('convert_to_expression');
      expect(result.narrowerPrototype).toBe('a');
    });

    it('logs debug message when classifying as convert_to_expression', () => {
      const { classifier, logger } = createClassifier();

      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics({
        gateImplication: createAImpliesBGateImplication(),
        passRates: { pA_given_B: 0.5, pB_given_A: 0.99 },
      });

      classifier.classify(candidateMetrics, behaviorMetrics);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('CONVERT_TO_EXPRESSION')
      );
    });
  });

  describe('Multi-label evidence', () => {
    it('includes convert_to_expression as secondary evidence when merge is primary', () => {
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
        passRates: { pA_given_B: 0.5, pB_given_A: 0.99, coPassCount: 800 },
        gateImplication: createAImpliesBGateImplication(),
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      expect(result.type).toBe('merge_recommended');
      const convertMatch = result.allMatchingClassifications.find(
        (entry) => entry.type === 'convert_to_expression'
      );
      expect(convertMatch).toBeDefined();
      expect(convertMatch.isPrimary).toBe(false);
    });
  });
});
