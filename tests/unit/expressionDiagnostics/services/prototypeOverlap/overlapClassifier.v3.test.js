/**
 * @file Unit tests for OverlapClassifier V3 classification methods
 * Tests V3 classification logic using agreement-based metrics and Wilson CI bounds.
 */

import { describe, it, expect } from '@jest/globals';
import OverlapClassifier from '../../../../../src/expressionDiagnostics/services/prototypeOverlap/OverlapClassifier.js';

describe('OverlapClassifier V3', () => {
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
   * Create a test config with V3 thresholds.
   *
   * @param {object} [overrides] - Override specific threshold values
   * @returns {object} Config object
   */
  const createConfig = (overrides = {}) => ({
    // V2 thresholds (for backward compatibility)
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
    // V3 thresholds
    maxMaeGlobalForMerge: 0.08,
    minActivationJaccardForMerge: 0.85,
    symmetryTolerance: 0.05,
    minConditionalProbCILowerForNesting: 0.9,
    asymmetryRequired: 0.1,
    maxMaeDeltaForExpression: 0.05,
    maxExclusiveForSubsumption: 0.05,
    enableConvertToExpression: true,
    ...overrides,
  });

  /**
   * Create agreement metrics (V3 metrics from AgreementMetricsCalculator).
   *
   * @param {object} [overrides] - Override specific values
   * @returns {object} Agreement metrics
   */
  const createAgreementMetrics = (overrides = {}) => ({
    maeCoPass: 0.03,
    maeGlobal: 0.05,
    activationJaccard: 0.9,
    pA_given_B: 0.95,
    pB_given_A: 0.94,
    pA_given_B_lower: 0.92,
    pA_given_B_upper: 0.98,
    pB_given_A_lower: 0.91,
    pB_given_A_upper: 0.97,
    pearsonCoPass: 0.98,
    pearsonGlobal: 0.95,
    coPassCount: 1000,
    correlationReliable: true,
    ...overrides,
  });

  /**
   * Create prototype profile (V3 profile from PrototypeProfileCalculator).
   *
   * @param {object} [overrides] - Override specific values
   * @returns {object} Prototype profile
   */
  const createProfile = (overrides = {}) => ({
    prototypeId: 'test:prototype',
    gateVolume: 0.3,
    weightEntropy: 0.5,
    weightConcentration: 0.7,
    deltaFromNearestCenter: 0.1,
    nearestClusterId: 'cluster1',
    isExpressionCandidate: false,
    ...overrides,
  });

  /**
   * Create V3 evaluation result.
   *
   * @param {object} [options] - Options for creating evaluation result
   * @returns {object} Evaluation result
   */
  const createEvaluationResult = (options = {}) => ({
    agreementMetrics: createAgreementMetrics(options.agreementMetrics || {}),
    profileA: createProfile({ prototypeId: 'test:prototypeA', ...options.profileA }),
    profileB: createProfile({ prototypeId: 'test:prototypeB', ...options.profileB }),
    prototypeA: options.prototypeA || { id: 'test:prototypeA' },
    prototypeB: options.prototypeB || { id: 'test:prototypeB' },
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

  describe('classifyV3()', () => {
    describe('MERGE_RECOMMENDED', () => {
      it('should return merge_recommended when all agreement thresholds are met', () => {
        const { classifier } = createClassifier();
        const evaluationResult = createEvaluationResult({
          agreementMetrics: {
            maeGlobal: 0.05, // < maxMaeGlobalForMerge (0.08)
            activationJaccard: 0.9, // >= minActivationJaccardForMerge (0.85)
            pA_given_B: 0.95,
            pB_given_A: 0.94, // |0.95 - 0.94| = 0.01 < symmetryTolerance (0.05)
          },
          profileA: { gateVolume: 0.3 }, // > 0.01 (not dead)
          profileB: { gateVolume: 0.35 }, // > 0.01 (not dead)
        });

        const result = classifier.classifyV3(evaluationResult);

        expect(result.type).toBe('merge_recommended');
        expect(result.metrics).toBeDefined();
        expect(result.thresholds).toBeDefined();
      });

      it('should return merge_recommended with symmetric conditional probabilities', () => {
        const { classifier } = createClassifier();
        const evaluationResult = createEvaluationResult({
          agreementMetrics: {
            maeGlobal: 0.07,
            activationJaccard: 0.88,
            pA_given_B: 0.92,
            pB_given_A: 0.93, // symmetric within tolerance
          },
          profileA: { gateVolume: 0.25 },
          profileB: { gateVolume: 0.28 },
        });

        const result = classifier.classifyV3(evaluationResult);

        expect(result.type).toBe('merge_recommended');
      });

      it('should reject MERGE when maeGlobal exceeds threshold', () => {
        const { classifier } = createClassifier();
        const evaluationResult = createEvaluationResult({
          agreementMetrics: {
            maeGlobal: 0.12, // > maxMaeGlobalForMerge (0.08)
            activationJaccard: 0.9,
            pA_given_B: 0.95,
            pB_given_A: 0.94,
          },
          profileA: { gateVolume: 0.3 },
          profileB: { gateVolume: 0.35 },
        });

        const result = classifier.classifyV3(evaluationResult);

        expect(result.type).not.toBe('merge_recommended');
      });

      it('should reject MERGE when activationJaccard is too low', () => {
        const { classifier } = createClassifier();
        const evaluationResult = createEvaluationResult({
          agreementMetrics: {
            maeGlobal: 0.05,
            activationJaccard: 0.6, // < minActivationJaccardForMerge (0.85)
            pA_given_B: 0.95,
            pB_given_A: 0.94,
          },
          profileA: { gateVolume: 0.3 },
          profileB: { gateVolume: 0.35 },
        });

        const result = classifier.classifyV3(evaluationResult);

        expect(result.type).not.toBe('merge_recommended');
      });

      it('should reject MERGE when prototype A is dead', () => {
        const { classifier } = createClassifier();
        const evaluationResult = createEvaluationResult({
          agreementMetrics: {
            maeGlobal: 0.05,
            activationJaccard: 0.9,
            pA_given_B: 0.95,
            pB_given_A: 0.94,
          },
          profileA: { gateVolume: 0.005 }, // < 0.01 (dead)
          profileB: { gateVolume: 0.35 },
        });

        const result = classifier.classifyV3(evaluationResult);

        expect(result.type).not.toBe('merge_recommended');
      });

      it('should reject MERGE when conditional probs are asymmetric', () => {
        const { classifier } = createClassifier();
        const evaluationResult = createEvaluationResult({
          agreementMetrics: {
            maeGlobal: 0.05,
            activationJaccard: 0.9,
            pA_given_B: 0.95,
            pB_given_A: 0.7, // |0.95 - 0.7| = 0.25 > symmetryTolerance (0.05)
          },
          profileA: { gateVolume: 0.3 },
          profileB: { gateVolume: 0.35 },
        });

        const result = classifier.classifyV3(evaluationResult);

        expect(result.type).not.toBe('merge_recommended');
      });
    });

    describe('SUBSUMED_RECOMMENDED', () => {
      it('should return subsumed_recommended when A is subsumed by B with CI lower bound', () => {
        const { classifier } = createClassifier();
        const evaluationResult = createEvaluationResult({
          agreementMetrics: {
            maeGlobal: 0.1, // Doesn't qualify for merge
            activationJaccard: 0.7,
            pA_given_B: 0.5, // When B fires, A fires 50% (asymmetric)
            pB_given_A: 0.98, // When A fires, B almost always fires
            pA_given_B_lower: 0.45,
            pB_given_A_lower: 0.95, // >= minConditionalProbCILowerForNesting (0.9)
          },
          profileA: { gateVolume: 0.2 }, // Narrower
          profileB: { gateVolume: 0.4 }, // Wider
        });

        const result = classifier.classifyV3(evaluationResult);

        expect(result.type).toBe('subsumed_recommended');
        expect(result.subsumedPrototype).toBe('a');
      });

      it('should identify correct subsumed prototype when B is subsumed by A', () => {
        const { classifier } = createClassifier();
        const evaluationResult = createEvaluationResult({
          agreementMetrics: {
            maeGlobal: 0.1,
            activationJaccard: 0.7,
            pA_given_B: 0.98, // When B fires, A almost always fires
            pB_given_A: 0.5, // When A fires, B fires 50%
            pA_given_B_lower: 0.95, // >= minConditionalProbCILowerForNesting
            pB_given_A_lower: 0.45,
          },
          profileA: { gateVolume: 0.4 }, // Wider
          profileB: { gateVolume: 0.2 }, // Narrower
        });

        const result = classifier.classifyV3(evaluationResult);

        expect(result.type).toBe('subsumed_recommended');
        expect(result.subsumedPrototype).toBe('b');
      });

      it('should reject SUBSUMPTION when asymmetry is insufficient', () => {
        const { classifier } = createClassifier();
        const evaluationResult = createEvaluationResult({
          agreementMetrics: {
            maeGlobal: 0.1,
            activationJaccard: 0.7,
            pA_given_B: 0.92, // Too symmetric - doesn't meet 1 - asymmetryRequired
            pB_given_A: 0.95,
            pA_given_B_lower: 0.88,
            pB_given_A_lower: 0.92,
          },
          profileA: { gateVolume: 0.2 },
          profileB: { gateVolume: 0.4 },
        });

        const result = classifier.classifyV3(evaluationResult);

        expect(result.type).not.toBe('subsumed_recommended');
      });
    });

    describe('CONVERT_TO_EXPRESSION', () => {
      it('should return convert_to_expression when narrower profile is expression candidate', () => {
        const { classifier } = createClassifier({ enableConvertToExpression: true });
        // Set up nesting detection but fail subsumption by having high pA_given_B (no asymmetry)
        const evaluationResult = createEvaluationResult({
          agreementMetrics: {
            maeGlobal: 0.1,
            maeCoPass: 0.03, // <= maxMaeDeltaForExpression (0.05)
            activationJaccard: 0.7,
            pA_given_B: 0.92, // >= 0.9, fails subsumption asymmetry check
            pB_given_A: 0.98,
            pA_given_B_lower: 0.88,
            pB_given_A_lower: 0.95, // Nesting detected
          },
          profileA: {
            gateVolume: 0.2,
            isExpressionCandidate: true, // A is narrower and is expression candidate
          },
          profileB: { gateVolume: 0.4, isExpressionCandidate: false },
        });

        const result = classifier.classifyV3(evaluationResult);

        expect(result.type).toBe('convert_to_expression');
        expect(result.narrowerPrototype).toBe('a');
      });

      it('should not return convert_to_expression when feature is disabled', () => {
        const { classifier } = createClassifier({ enableConvertToExpression: false });
        const evaluationResult = createEvaluationResult({
          agreementMetrics: {
            maeGlobal: 0.1,
            maeCoPass: 0.03,
            activationJaccard: 0.7,
            pA_given_B: 0.5,
            pB_given_A: 0.98,
            pA_given_B_lower: 0.45,
            pB_given_A_lower: 0.95,
          },
          profileA: { gateVolume: 0.2, isExpressionCandidate: true },
          profileB: { gateVolume: 0.4, isExpressionCandidate: false },
        });

        const result = classifier.classifyV3(evaluationResult);

        // Should fall through to SUBSUMED_RECOMMENDED since nesting exists
        expect(result.type).not.toBe('convert_to_expression');
      });

      it('should not return convert_to_expression when narrower profile is not expression candidate', () => {
        const { classifier } = createClassifier({ enableConvertToExpression: true });
        const evaluationResult = createEvaluationResult({
          agreementMetrics: {
            maeGlobal: 0.1,
            maeCoPass: 0.03,
            activationJaccard: 0.7,
            pA_given_B: 0.5,
            pB_given_A: 0.98,
            pA_given_B_lower: 0.45,
            pB_given_A_lower: 0.95,
          },
          profileA: { gateVolume: 0.2, isExpressionCandidate: false }, // Not a candidate
          profileB: { gateVolume: 0.4, isExpressionCandidate: false },
        });

        const result = classifier.classifyV3(evaluationResult);

        expect(result.type).not.toBe('convert_to_expression');
      });
    });

    describe('NESTED_SIBLINGS', () => {
      it('should return nested_siblings with asymmetric CI bounds', () => {
        const { classifier } = createClassifier();
        const evaluationResult = createEvaluationResult({
          agreementMetrics: {
            maeGlobal: 0.1,
            maeCoPass: 0.08, // > maxMaeDeltaForExpression, rules out CONVERT
            activationJaccard: 0.6, // < 0.7, rules out NEEDS_SEPARATION
            pA_given_B: 0.5,
            pB_given_A: 0.95,
            pA_given_B_lower: 0.45,
            pB_given_A_lower: 0.92, // >= threshold, nesting detected
          },
          profileA: {
            gateVolume: 0.35, // Not narrower enough for subsumption
            isExpressionCandidate: false,
          },
          profileB: { gateVolume: 0.4, isExpressionCandidate: false },
        });

        const result = classifier.classifyV3(evaluationResult);

        expect(result.type).toBe('nested_siblings');
      });
    });

    describe('NEEDS_SEPARATION', () => {
      it('should return needs_separation for high overlap with different outputs', () => {
        const { classifier } = createClassifier();
        const evaluationResult = createEvaluationResult({
          agreementMetrics: {
            maeGlobal: 0.1,
            maeCoPass: 0.15, // > maxMaeDeltaForExpression
            activationJaccard: 0.75, // >= 0.7
            pA_given_B: 0.8,
            pB_given_A: 0.8, // Symmetric-ish, no nesting
            pA_given_B_lower: 0.75,
            pB_given_A_lower: 0.75, // Both below nesting threshold
          },
          profileA: { gateVolume: 0.3 },
          profileB: { gateVolume: 0.32 },
        });

        const result = classifier.classifyV3(evaluationResult);

        expect(result.type).toBe('needs_separation');
      });
    });

    describe('KEEP_DISTINCT fallback', () => {
      it('should return keep_distinct when no other classification matches', () => {
        const { classifier } = createClassifier();
        const evaluationResult = createEvaluationResult({
          agreementMetrics: {
            maeGlobal: 0.2, // Too high for merge
            maeCoPass: 0.15,
            activationJaccard: 0.4, // Too low for merge or separation
            pA_given_B: 0.5,
            pB_given_A: 0.5, // Symmetric, no nesting
            pA_given_B_lower: 0.45,
            pB_given_A_lower: 0.45, // Below nesting threshold
          },
          profileA: { gateVolume: 0.3 },
          profileB: { gateVolume: 0.35 },
        });

        const result = classifier.classifyV3(evaluationResult);

        expect(result.type).toBe('keep_distinct');
      });
    });

    describe('Classification priority order', () => {
      it('should prioritize merge_recommended over subsumed_recommended when both could match', () => {
        const { classifier } = createClassifier();
        // Create a scenario that could technically satisfy both merge and subsumption
        const evaluationResult = createEvaluationResult({
          agreementMetrics: {
            maeGlobal: 0.05, // Qualifies for merge
            activationJaccard: 0.9, // Qualifies for merge
            pA_given_B: 0.94, // Symmetric (merge) but high enough for nesting check
            pB_given_A: 0.95,
            pA_given_B_lower: 0.91,
            pB_given_A_lower: 0.92,
          },
          profileA: { gateVolume: 0.3 },
          profileB: { gateVolume: 0.35 },
        });

        const result = classifier.classifyV3(evaluationResult);

        // MERGE has higher priority
        expect(result.type).toBe('merge_recommended');
      });

      it('should prioritize subsumed_recommended over convert_to_expression when narrower is not expression candidate', () => {
        const { classifier } = createClassifier({ enableConvertToExpression: true });
        const evaluationResult = createEvaluationResult({
          agreementMetrics: {
            maeGlobal: 0.1,
            maeCoPass: 0.03, // Would qualify for convert
            activationJaccard: 0.7,
            pA_given_B: 0.5,
            pB_given_A: 0.98,
            pA_given_B_lower: 0.45,
            pB_given_A_lower: 0.95, // Nesting detected
          },
          profileA: {
            gateVolume: 0.2, // Narrower
            isExpressionCandidate: false, // But not expression candidate
          },
          profileB: { gateVolume: 0.4, isExpressionCandidate: false },
        });

        const result = classifier.classifyV3(evaluationResult);

        expect(result.type).toBe('subsumed_recommended');
      });
    });

    describe('Edge cases', () => {
      it('should handle missing agreementMetrics gracefully', () => {
        const { classifier } = createClassifier();
        const evaluationResult = {
          agreementMetrics: null,
          profileA: createProfile(),
          profileB: createProfile(),
        };

        const result = classifier.classifyV3(evaluationResult);

        expect(result.type).toBe('keep_distinct');
      });

      it('should handle missing profiles gracefully', () => {
        const { classifier } = createClassifier();
        const evaluationResult = {
          agreementMetrics: createAgreementMetrics(),
          profileA: null,
          profileB: null,
        };

        const result = classifier.classifyV3(evaluationResult);

        // Should still classify based on agreement metrics alone
        expect(result).toHaveProperty('type');
      });

      it('should handle dead prototypes (both dead)', () => {
        const { classifier } = createClassifier();
        const evaluationResult = createEvaluationResult({
          agreementMetrics: {
            maeGlobal: 0.05,
            activationJaccard: 0.9,
            pA_given_B: 0.95,
            pB_given_A: 0.94,
          },
          profileA: { gateVolume: 0.005 }, // Dead
          profileB: { gateVolume: 0.008 }, // Dead
        });

        const result = classifier.classifyV3(evaluationResult);

        // Dead prototypes should not be recommended for merge
        expect(result.type).not.toBe('merge_recommended');
      });

      it('should handle NaN values in metrics', () => {
        const { classifier } = createClassifier();
        const evaluationResult = createEvaluationResult({
          agreementMetrics: {
            maeGlobal: NaN,
            activationJaccard: 0.9,
            pA_given_B: 0.95,
            pB_given_A: 0.94,
          },
          profileA: { gateVolume: 0.3 },
          profileB: { gateVolume: 0.35 },
        });

        const result = classifier.classifyV3(evaluationResult);

        // Should handle gracefully without throwing
        expect(result).toHaveProperty('type');
        expect(result.type).not.toBe('merge_recommended');
      });

      it('should handle undefined values in conditional probabilities', () => {
        const { classifier } = createClassifier();
        const evaluationResult = createEvaluationResult({
          agreementMetrics: {
            maeGlobal: 0.05,
            activationJaccard: 0.9,
            pA_given_B: undefined,
            pB_given_A: undefined,
          },
          profileA: { gateVolume: 0.3 },
          profileB: { gateVolume: 0.35 },
        });

        const result = classifier.classifyV3(evaluationResult);

        // Should handle gracefully
        expect(result).toHaveProperty('type');
      });

      it('should return result with expected structure', () => {
        const { classifier } = createClassifier();
        const evaluationResult = createEvaluationResult();

        const result = classifier.classifyV3(evaluationResult);

        expect(result).toHaveProperty('type');
        expect(result).toHaveProperty('metrics');
        expect(result).toHaveProperty('thresholds');
        expect(typeof result.type).toBe('string');
        expect(typeof result.metrics).toBe('object');
        expect(typeof result.thresholds).toBe('object');
      });
    });
  });
});
