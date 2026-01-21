/**
 * @file Unit tests for A/B direction invariant in prototype overlap analysis
 *
 * This test suite verifies that the system correctly identifies which prototype
 * is "narrower" when one prototype has a strict superset of another's gates.
 *
 * Mathematical Background:
 * - If prototype B has all of A's gates PLUS extra gates, then B is "narrower"
 * - P(A passes | B passes) should be ≈1.0 (B passing implies A passing)
 * - P(B passes | A passes) should be <1.0 (A passing doesn't guarantee B)
 *
 * The bug reported by ChatGPT suggested these conditionals might be swapped,
 * leading to incorrect "narrower prototype" identification.
 *
 * @see src/expressionDiagnostics/services/prototypeOverlap/OverlapClassifier.js
 * @see src/expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js
 */

import { describe, it, expect, jest } from '@jest/globals';
import BehavioralOverlapEvaluator from '../../../../../src/expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js';
import OverlapClassifier from '../../../../../src/expressionDiagnostics/services/prototypeOverlap/OverlapClassifier.js';

describe('A/B Direction Invariant', () => {
  // ============================================================================
  // Test Helpers
  // ============================================================================

  const createMockLogger = () => ({
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  });

  /**
   * Creates a deterministic state generator that produces states where
   * the specified axis value follows a predictable pattern.
   *
   * @param {number} sampleCount - Number of samples
   * @param {string} axisName - Name of the axis to vary (e.g., 'threat')
   * @param {number[]} values - Array of axis values to cycle through
   * @returns {object} Mock state generator
   */
  const createDeterministicStateGenerator = (
    sampleCount,
    axisName,
    values
  ) => {
    let callIndex = 0;
    return {
      generate: jest.fn(() => {
        const valueIndex = callIndex % values.length;
        const axisValue = values[valueIndex];
        callIndex++;

        return {
          current: {
            mood: {
              engagement: 0.5, // Always passes engagement >= 0.20
              threat: axisName === 'threat' ? axisValue : 0.2,
            },
            sexual: {},
          },
          previous: { mood: {}, sexual: {} },
          affectTraits: {},
        };
      }),
    };
  };

  /**
   * Creates a context builder that maps state to context.
   */
  const createMockContextBuilder = () => ({
    buildContext: jest.fn((current) => ({
      moodAxes: current.mood,
      sexualAxes: current.sexual || {},
      affectTraits: {},
      emotions: {},
      sexualStates: {},
    })),
  });

  /**
   * Creates a gate checker that evaluates simple comparison gates.
   * Supports gates like "engagement >= 0.20" and "threat <= 0.40"
   */
  const createRealisticGateChecker = () => ({
    checkAllGatesPass: jest.fn((gates, context) => {
      if (!gates || gates.length === 0) return true;

      for (const gate of gates) {
        // Parse gate: "axis >= value" or "axis <= value"
        const geMatch = gate.match(/(\w+)\s*>=\s*([\d.]+)/);
        const leMatch = gate.match(/(\w+)\s*<=\s*([\d.]+)/);

        if (geMatch) {
          const [, axis, threshold] = geMatch;
          const value = context.moodAxes?.[axis] ?? 0;
          if (value < parseFloat(threshold)) return false;
        } else if (leMatch) {
          const [, axis, threshold] = leMatch;
          const value = context.moodAxes?.[axis] ?? 0;
          if (value > parseFloat(threshold)) return false;
        }
      }
      return true;
    }),
  });

  /**
   * Creates an intensity calculator that returns consistent values.
   */
  const createMockIntensityCalculator = () => ({
    computeIntensity: jest.fn(() => 0.5),
  });

  /**
   * Creates gate constraint extractor mock.
   */
  const createMockGateConstraintExtractor = () => ({
    extract: jest.fn((gates) => ({
      parseStatus: 'complete',
      intervals: {},
      gateCount: gates?.length ?? 0,
    })),
  });

  /**
   * Creates gate implication evaluator mock.
   * Can be configured to return specific implication results.
   */
  const createMockGateImplicationEvaluator = (aImpliesB, bImpliesA) => ({
    evaluate: jest.fn(() => ({
      A_implies_B: aImpliesB,
      B_implies_A: bImpliesA,
      counterExampleAxes: [],
      evidence: [],
      relation: aImpliesB !== bImpliesA ? 'subsumption' : 'overlapping',
    })),
  });

  // ============================================================================
  // Core Invariant Tests
  // ============================================================================

  describe('Conditional probability direction', () => {
    it('should compute P(A|B) ≈ 1.0 when B has all of A gates plus extras', async () => {
      // Setup: B = A + extra gate
      // A (broad): engagement >= 0.20 (always passes with our 0.5 engagement)
      // B (narrow): engagement >= 0.20 AND threat <= 0.40
      //
      // With threat values cycling through [0.1, 0.3, 0.5, 0.7]:
      // - 0.1: A passes, B passes (threat <= 0.40)
      // - 0.3: A passes, B passes (threat <= 0.40)
      // - 0.5: A passes, B fails (threat > 0.40)
      // - 0.7: A passes, B fails (threat > 0.40)
      //
      // Expected: P(A|B) = 1.0 (when B passes, A always passes)
      // Expected: P(B|A) = 0.5 (when A passes, B passes 50% of time)

      const prototypeA = {
        id: 'broad',
        gates: ['engagement >= 0.20'],
        weights: { engagement: 1.0 },
      };

      const prototypeB = {
        id: 'narrow',
        gates: ['engagement >= 0.20', 'threat <= 0.40'],
        weights: { engagement: 1.0, threat: -0.2 },
      };

      const threatValues = [0.1, 0.3, 0.5, 0.7]; // 50% pass threat <= 0.40
      const sampleCount = 100;

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: createMockIntensityCalculator(),
        randomStateGenerator: createDeterministicStateGenerator(
          sampleCount,
          'threat',
          threatValues
        ),
        contextBuilder: createMockContextBuilder(),
        prototypeGateChecker: createRealisticGateChecker(),
        gateConstraintExtractor: createMockGateConstraintExtractor(),
        gateImplicationEvaluator: createMockGateImplicationEvaluator(
          false,
          true
        ), // B implies A (narrow implies broad)
        config: {
          sampleCountPerPair: sampleCount,
          divergenceExamplesK: 5,
          dominanceDelta: 0.05,
          minPassSamplesForConditional: 1,
        },
        logger: createMockLogger(),
      });

      const result = await evaluator.evaluate(
        prototypeA,
        prototypeB,
        sampleCount
      );

      // Verify the core invariant:
      // P(A|B) should be 1.0 (when B passes, A always passes)
      expect(result.passRates.pA_given_B).toBeCloseTo(1.0, 2);

      // P(B|A) should be 0.5 (when A passes, B passes 50% of time)
      expect(result.passRates.pB_given_A).toBeCloseTo(0.5, 1);

      // Verify the asymmetry
      expect(result.passRates.pA_given_B).toBeGreaterThan(
        result.passRates.pB_given_A
      );
    });

    it('should identify correct narrower prototype in hasNesting logic', () => {
      // Test the classifier's hasNesting logic directly via classify()
      // Scenario: pA_given_B ≈ 1.0, pB_given_A ≈ 0.5
      // This means: when B fires, A almost always fires
      // Therefore: B is narrower (B implies A behaviorally)

      const classifier = new OverlapClassifier({
        config: {
          minOnEitherRateForMerge: 0.05,
          minGateOverlapRatio: 0.9,
          minCorrelationForMerge: 0.98,
          maxMeanAbsDiffForMerge: 0.03,
          maxExclusiveRateForSubsumption: 0.01,
          minCorrelationForSubsumption: 0.95,
          minDominanceForSubsumption: 0.95,
          nestedConditionalThreshold: 0.97,
        },
        logger: createMockLogger(),
      });

      const candidateMetrics = {
        activeAxisOverlap: 0.9,
        signAgreement: 0.95,
        weightCosineSimilarity: 0.98,
      };

      // P(A|B) = 0.98 (high), P(B|A) = 0.5 (low)
      // Interpretation: B implies A, so B is narrower
      const behaviorMetrics = {
        gateOverlap: {
          onEitherRate: 0.4,
          onBothRate: 0.2,
          pOnlyRate: 0.2, // A fires alone often
          qOnlyRate: 0.0, // B never fires alone
        },
        intensity: {
          pearsonCorrelation: 0.8,
          meanAbsDiff: 0.1,
          dominanceP: 0.4,
          dominanceQ: 0.4,
        },
        passRates: {
          passARate: 0.4,
          passBRate: 0.2,
          pA_given_B: 0.98, // High: when B fires, A almost always fires
          pB_given_A: 0.5, // Low: when A fires, B fires only half the time
          coPassCount: 500,
        },
      };

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      // B should be identified as narrower
      expect(result.type).toBe('nested_siblings');
      expect(result.narrowerPrototype).toBe('b');
    });

    it('should identify A as narrower when pB_given_A is high and pA_given_B is low', () => {
      // Reverse scenario: A is narrower (A implies B)
      // P(B|A) = 0.98 (high), P(A|B) = 0.5 (low)

      const classifier = new OverlapClassifier({
        config: {
          minOnEitherRateForMerge: 0.05,
          minGateOverlapRatio: 0.9,
          minCorrelationForMerge: 0.98,
          maxMeanAbsDiffForMerge: 0.03,
          maxExclusiveRateForSubsumption: 0.01,
          minCorrelationForSubsumption: 0.95,
          minDominanceForSubsumption: 0.95,
          nestedConditionalThreshold: 0.97,
        },
        logger: createMockLogger(),
      });

      const candidateMetrics = {
        activeAxisOverlap: 0.9,
        signAgreement: 0.95,
        weightCosineSimilarity: 0.98,
      };

      // P(B|A) = 0.98 (high), P(A|B) = 0.5 (low)
      // Interpretation: A implies B, so A is narrower
      const behaviorMetrics = {
        gateOverlap: {
          onEitherRate: 0.4,
          onBothRate: 0.2,
          pOnlyRate: 0.0, // A never fires alone
          qOnlyRate: 0.2, // B fires alone often
        },
        intensity: {
          pearsonCorrelation: 0.8,
          meanAbsDiff: 0.1,
          dominanceP: 0.4,
          dominanceQ: 0.4,
        },
        passRates: {
          passARate: 0.2,
          passBRate: 0.4,
          pA_given_B: 0.5, // Low: when B fires, A fires only half the time
          pB_given_A: 0.98, // High: when A fires, B almost always fires
          coPassCount: 500,
        },
      };

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      // A should be identified as narrower
      expect(result.type).toBe('nested_siblings');
      expect(result.narrowerPrototype).toBe('a');
    });
  });

  // ============================================================================
  // Real Prototype Simulation (interest/curiosity)
  // ============================================================================

  describe('Interest/Curiosity direction (simulated)', () => {
    // Real gates from emotion_prototypes.lookup.json:
    // interest: engagement >= 0.20 (1 gate)
    // curiosity: engagement >= 0.20 AND threat <= 0.40 (2 gates)
    //
    // Curiosity is narrower (has all interest gates + extra)
    // So: P(interest | curiosity) ≈ 1.0
    //     P(curiosity | interest) < 1.0

    it('should correctly identify curiosity as narrower than interest', async () => {
      const interestPrototype = {
        id: 'interest',
        gates: ['engagement >= 0.20'],
        weights: { engagement: 1.0, arousal: 0.4, valence: 0.2 },
      };

      const curiosityPrototype = {
        id: 'curiosity',
        gates: ['engagement >= 0.20', 'threat <= 0.40'],
        weights: { engagement: 1.0, arousal: 0.6, threat: -0.2, valence: 0.2 },
      };

      // Threat values: 25% low, 25% medium-low, 25% medium, 25% high
      // Only low and medium-low (50%) pass threat <= 0.40
      const threatValues = [0.2, 0.35, 0.5, 0.7];
      const sampleCount = 200;

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: createMockIntensityCalculator(),
        randomStateGenerator: createDeterministicStateGenerator(
          sampleCount,
          'threat',
          threatValues
        ),
        contextBuilder: createMockContextBuilder(),
        prototypeGateChecker: createRealisticGateChecker(),
        gateConstraintExtractor: createMockGateConstraintExtractor(),
        gateImplicationEvaluator: createMockGateImplicationEvaluator(
          false,
          true
        ), // curiosity implies interest
        config: {
          sampleCountPerPair: sampleCount,
          divergenceExamplesK: 5,
          dominanceDelta: 0.05,
          minPassSamplesForConditional: 1,
        },
        logger: createMockLogger(),
      });

      // Note: Order matters! A = interest, B = curiosity
      const result = await evaluator.evaluate(
        interestPrototype,
        curiosityPrototype,
        sampleCount
      );

      // When curiosity (B) passes, interest (A) should always pass
      // P(A|B) = P(interest|curiosity) should be 1.0
      expect(result.passRates.pA_given_B).toBeCloseTo(1.0, 2);

      // When interest (A) passes, curiosity (B) passes only when threat <= 0.40
      // P(B|A) = P(curiosity|interest) should be ~0.5
      expect(result.passRates.pB_given_A).toBeCloseTo(0.5, 1);
    });

    it('should identify curiosity as narrower via classifier when A=interest, B=curiosity', () => {
      const classifier = new OverlapClassifier({
        config: {
          minOnEitherRateForMerge: 0.05,
          minGateOverlapRatio: 0.9,
          minCorrelationForMerge: 0.98,
          maxMeanAbsDiffForMerge: 0.03,
          maxExclusiveRateForSubsumption: 0.01,
          minCorrelationForSubsumption: 0.95,
          minDominanceForSubsumption: 0.95,
          nestedConditionalThreshold: 0.97,
        },
        logger: createMockLogger(),
      });

      const candidateMetrics = {
        activeAxisOverlap: 0.9,
        signAgreement: 0.95,
        weightCosineSimilarity: 0.95,
      };

      // Simulating A = interest, B = curiosity
      // P(A|B) = P(interest|curiosity) = 1.0 (high)
      // P(B|A) = P(curiosity|interest) = 0.5 (low)
      const behaviorMetrics = {
        gateOverlap: {
          onEitherRate: 0.5,
          onBothRate: 0.25,
          pOnlyRate: 0.25, // interest fires alone when threat > 0.40
          qOnlyRate: 0.0, // curiosity never fires alone
        },
        intensity: {
          pearsonCorrelation: 0.85,
          meanAbsDiff: 0.1,
          dominanceP: 0.3,
          dominanceQ: 0.3,
        },
        passRates: {
          passARate: 0.5, // interest fires 50% of time
          passBRate: 0.25, // curiosity fires 25% of time
          pA_given_B: 0.99, // interest given curiosity ≈ 1.0
          pB_given_A: 0.5, // curiosity given interest ≈ 0.5
          coPassCount: 500,
        },
      };

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      // B (curiosity) should be identified as narrower
      expect(result.type).toBe('nested_siblings');
      expect(result.narrowerPrototype).toBe('b');
    });

    it('should identify curiosity as narrower via classifier when A=curiosity, B=interest (reversed order)', () => {
      // Test with reversed pair order to ensure direction is correctly determined
      // regardless of which prototype is A vs B

      const classifier = new OverlapClassifier({
        config: {
          minOnEitherRateForMerge: 0.05,
          minGateOverlapRatio: 0.9,
          minCorrelationForMerge: 0.98,
          maxMeanAbsDiffForMerge: 0.03,
          maxExclusiveRateForSubsumption: 0.01,
          minCorrelationForSubsumption: 0.95,
          minDominanceForSubsumption: 0.95,
          nestedConditionalThreshold: 0.97,
        },
        logger: createMockLogger(),
      });

      const candidateMetrics = {
        activeAxisOverlap: 0.9,
        signAgreement: 0.95,
        weightCosineSimilarity: 0.95,
      };

      // Simulating A = curiosity, B = interest (reversed from above)
      // P(A|B) = P(curiosity|interest) = 0.5 (low)
      // P(B|A) = P(interest|curiosity) = 1.0 (high)
      const behaviorMetrics = {
        gateOverlap: {
          onEitherRate: 0.5,
          onBothRate: 0.25,
          pOnlyRate: 0.0, // curiosity never fires alone
          qOnlyRate: 0.25, // interest fires alone when threat > 0.40
        },
        intensity: {
          pearsonCorrelation: 0.85,
          meanAbsDiff: 0.1,
          dominanceP: 0.3,
          dominanceQ: 0.3,
        },
        passRates: {
          passARate: 0.25, // curiosity fires 25% of time
          passBRate: 0.5, // interest fires 50% of time
          pA_given_B: 0.5, // curiosity given interest ≈ 0.5
          pB_given_A: 0.99, // interest given curiosity ≈ 1.0
          coPassCount: 500,
        },
      };

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      // A (curiosity) should be identified as narrower
      // Because when A fires, B almost always fires (pB_given_A = 0.99)
      expect(result.type).toBe('nested_siblings');
      expect(result.narrowerPrototype).toBe('a');
    });
  });

  // ============================================================================
  // Mathematical Invariant Verification
  // ============================================================================

  describe('Mathematical invariants', () => {
    it('should satisfy: pA_given_B = coPass / passBCount', async () => {
      // Verify the formula: P(A|B) = P(A ∧ B) / P(B) = coPassCount / passBCount

      const prototypeA = {
        id: 'A',
        gates: ['engagement >= 0.20'],
        weights: { engagement: 1.0 },
      };

      const prototypeB = {
        id: 'B',
        gates: ['engagement >= 0.20', 'threat <= 0.40'],
        weights: { engagement: 1.0 },
      };

      const threatValues = [0.1, 0.3, 0.5, 0.7];
      const sampleCount = 100;

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: createMockIntensityCalculator(),
        randomStateGenerator: createDeterministicStateGenerator(
          sampleCount,
          'threat',
          threatValues
        ),
        contextBuilder: createMockContextBuilder(),
        prototypeGateChecker: createRealisticGateChecker(),
        gateConstraintExtractor: createMockGateConstraintExtractor(),
        gateImplicationEvaluator: createMockGateImplicationEvaluator(
          false,
          true
        ),
        config: {
          sampleCountPerPair: sampleCount,
          divergenceExamplesK: 5,
          dominanceDelta: 0.05,
          minPassSamplesForConditional: 1,
        },
        logger: createMockLogger(),
      });

      const result = await evaluator.evaluate(
        prototypeA,
        prototypeB,
        sampleCount
      );

      // Manual verification of formula
      const { passRates } = result;
      const coPassCount = passRates.coPassCount;
      const passBCount = passRates.passBRate * sampleCount;

      // pA_given_B should equal coPassCount / passBCount
      const expectedPAGivenB = coPassCount / passBCount;
      expect(passRates.pA_given_B).toBeCloseTo(expectedPAGivenB, 5);
    });

    it('should satisfy: pB_given_A = coPass / passACount', async () => {
      // Verify the formula: P(B|A) = P(A ∧ B) / P(A) = coPassCount / passACount

      const prototypeA = {
        id: 'A',
        gates: ['engagement >= 0.20'],
        weights: { engagement: 1.0 },
      };

      const prototypeB = {
        id: 'B',
        gates: ['engagement >= 0.20', 'threat <= 0.40'],
        weights: { engagement: 1.0 },
      };

      const threatValues = [0.1, 0.3, 0.5, 0.7];
      const sampleCount = 100;

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: createMockIntensityCalculator(),
        randomStateGenerator: createDeterministicStateGenerator(
          sampleCount,
          'threat',
          threatValues
        ),
        contextBuilder: createMockContextBuilder(),
        prototypeGateChecker: createRealisticGateChecker(),
        gateConstraintExtractor: createMockGateConstraintExtractor(),
        gateImplicationEvaluator: createMockGateImplicationEvaluator(
          false,
          true
        ),
        config: {
          sampleCountPerPair: sampleCount,
          divergenceExamplesK: 5,
          dominanceDelta: 0.05,
          minPassSamplesForConditional: 1,
        },
        logger: createMockLogger(),
      });

      const result = await evaluator.evaluate(
        prototypeA,
        prototypeB,
        sampleCount
      );

      // Manual verification of formula
      const { passRates } = result;
      const coPassCount = passRates.coPassCount;
      const passACount = passRates.passARate * sampleCount;

      // pB_given_A should equal coPassCount / passACount
      const expectedPBGivenA = coPassCount / passACount;
      expect(passRates.pB_given_A).toBeCloseTo(expectedPBGivenA, 5);
    });

    it('should satisfy invariant: if B ⊂ A deterministically, then pA_given_B = 1.0', async () => {
      // When B is a strict subset of A (B has all of A's gates plus more),
      // P(A|B) must equal 1.0 (any state passing B must pass A)

      const prototypeA = {
        id: 'broad',
        gates: ['engagement >= 0.20'],
        weights: { engagement: 1.0 },
      };

      const prototypeB = {
        id: 'narrow',
        gates: ['engagement >= 0.20', 'threat <= 0.40'],
        weights: { engagement: 1.0 },
      };

      // Use varied threat values
      const threatValues = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
      const sampleCount = 200;

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: createMockIntensityCalculator(),
        randomStateGenerator: createDeterministicStateGenerator(
          sampleCount,
          'threat',
          threatValues
        ),
        contextBuilder: createMockContextBuilder(),
        prototypeGateChecker: createRealisticGateChecker(),
        gateConstraintExtractor: createMockGateConstraintExtractor(),
        gateImplicationEvaluator: createMockGateImplicationEvaluator(
          false,
          true
        ), // B implies A
        config: {
          sampleCountPerPair: sampleCount,
          divergenceExamplesK: 5,
          dominanceDelta: 0.05,
          minPassSamplesForConditional: 1,
        },
        logger: createMockLogger(),
      });

      const result = await evaluator.evaluate(
        prototypeA,
        prototypeB,
        sampleCount
      );

      // The invariant: P(A|B) must be exactly 1.0
      expect(result.passRates.pA_given_B).toBe(1.0);

      // P(B|A) should be less than 1.0 (approximately 0.5 with these threat values)
      expect(result.passRates.pB_given_A).toBeLessThan(1.0);
    });
  });

  // ============================================================================
  // Gate Implication Evaluator Direction
  // ============================================================================

  describe('Gate implication direction', () => {
    it('should prefer deterministic nesting over behavioral when available', () => {
      // When gateImplication indicates deterministic nesting, it should
      // take precedence over behavioral (probabilistic) nesting

      const classifier = new OverlapClassifier({
        config: {
          minOnEitherRateForMerge: 0.05,
          minGateOverlapRatio: 0.9,
          minCorrelationForMerge: 0.98,
          maxMeanAbsDiffForMerge: 0.03,
          maxExclusiveRateForSubsumption: 0.01,
          minCorrelationForSubsumption: 0.95,
          minDominanceForSubsumption: 0.95,
          nestedConditionalThreshold: 0.97,
        },
        logger: createMockLogger(),
      });

      const candidateMetrics = {
        activeAxisOverlap: 0.9,
        signAgreement: 0.95,
        weightCosineSimilarity: 0.98,
      };

      // Behavioral says B is narrower (pA_given_B high, pB_given_A low)
      // But deterministic implication says A implies B (A is narrower)
      const behaviorMetrics = {
        gateOverlap: {
          onEitherRate: 0.4,
          onBothRate: 0.2,
          pOnlyRate: 0.2,
          qOnlyRate: 0.0,
        },
        intensity: {
          pearsonCorrelation: 0.8,
          meanAbsDiff: 0.1,
          dominanceP: 0.4,
          dominanceQ: 0.4,
        },
        passRates: {
          passARate: 0.4,
          passBRate: 0.2,
          pA_given_B: 0.98, // Behavioral: B implies A
          pB_given_A: 0.5,
          coPassCount: 500,
        },
        gateImplication: {
          A_implies_B: true, // Deterministic: A implies B
          B_implies_A: false,
          relation: 'subsumption',
        },
        // Required for deterministic nesting to be used (Phase 3 guards)
        gateParseInfo: {
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
        },
      };

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      // Deterministic should win: A is narrower (A implies B)
      expect(result.type).toBe('nested_siblings');
      expect(result.narrowerPrototype).toBe('a');
    });

    it('should fall back to behavioral nesting when deterministic is symmetric', () => {
      // When gateImplication is symmetric (neither implies the other),
      // should use behavioral nesting

      const classifier = new OverlapClassifier({
        config: {
          minOnEitherRateForMerge: 0.05,
          minGateOverlapRatio: 0.9,
          minCorrelationForMerge: 0.98,
          maxMeanAbsDiffForMerge: 0.03,
          maxExclusiveRateForSubsumption: 0.01,
          minCorrelationForSubsumption: 0.95,
          minDominanceForSubsumption: 0.95,
          nestedConditionalThreshold: 0.97,
        },
        logger: createMockLogger(),
      });

      const candidateMetrics = {
        activeAxisOverlap: 0.9,
        signAgreement: 0.95,
        weightCosineSimilarity: 0.98,
      };

      // No deterministic implication
      // Behavioral says B is narrower
      const behaviorMetrics = {
        gateOverlap: {
          onEitherRate: 0.4,
          onBothRate: 0.2,
          pOnlyRate: 0.2,
          qOnlyRate: 0.0,
        },
        intensity: {
          pearsonCorrelation: 0.8,
          meanAbsDiff: 0.1,
          dominanceP: 0.4,
          dominanceQ: 0.4,
        },
        passRates: {
          passARate: 0.4,
          passBRate: 0.2,
          pA_given_B: 0.98, // High: B implies A
          pB_given_A: 0.5, // Low
          coPassCount: 500,
        },
        gateImplication: {
          A_implies_B: false, // Neither implies the other
          B_implies_A: false,
          relation: 'overlapping',
        },
      };

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      // Behavioral should determine: B is narrower
      expect(result.type).toBe('nested_siblings');
      expect(result.narrowerPrototype).toBe('b');
    });
  });
});
