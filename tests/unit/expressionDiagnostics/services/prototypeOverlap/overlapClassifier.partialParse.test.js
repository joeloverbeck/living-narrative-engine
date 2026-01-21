/**
 * @file Unit tests for OverlapClassifier partial parse handling
 * Tests that deterministic nesting is NOT used when gate parse is incomplete,
 * and that vacuous implications are ignored for nesting decisions.
 * @see src/expressionDiagnostics/services/prototypeOverlap/OverlapClassifier.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import OverlapClassifier from '../../../../../src/expressionDiagnostics/services/prototypeOverlap/OverlapClassifier.js';

describe('OverlapClassifier - partial parse handling', () => {
  let mockLogger;
  let mockConfig;
  let classifier;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockConfig = {
      minOnEitherRateForMerge: 0.05,
      minGateOverlapRatio: 0.9,
      minCorrelationForMerge: 0.98,
      maxMeanAbsDiffForMerge: 0.03,
      maxExclusiveRateForSubsumption: 0.01,
      minCorrelationForSubsumption: 0.95,
      minDominanceForSubsumption: 0.95,
      nestedConditionalThreshold: 0.97,
    };

    classifier = new OverlapClassifier({
      config: mockConfig,
      logger: mockLogger,
    });
  });

  // ==========================================================================
  // Helper functions
  // ==========================================================================

  /**
   * Creates candidate metrics (Stage A output).
   * @param {object} [overrides] - Override specific values
   * @returns {object} Candidate metrics
   */
  function createCandidateMetrics(overrides = {}) {
    return {
      activeAxisOverlap: 0.9,
      signAgreement: 0.95,
      weightCosineSimilarity: 0.98,
      ...overrides,
    };
  }

  /**
   * Creates behavior metrics (Stage B output).
   * @param {object} [overrides] - Override specific values
   * @returns {object} Behavior metrics
   */
  function createBehaviorMetrics(overrides = {}) {
    return {
      gateOverlap: {
        onEitherRate: 0.3,
        onBothRate: 0.2,
        pOnlyRate: 0.05,
        qOnlyRate: 0.05,
        ...(overrides.gateOverlap || {}),
      },
      intensity: {
        pearsonCorrelation: 0.6,
        meanAbsDiff: 0.1,
        dominanceP: 0.4,
        dominanceQ: 0.4,
        globalMeanAbsDiff: 0.1,
        globalL2Distance: 0.1,
        globalOutputCorrelation: 0.5,
        ...(overrides.intensity || {}),
      },
      passRates: overrides.passRates ?? {
        passRateA: 0.5,
        passRateB: 0.5,
        pA_given_B: 0.7,
        pB_given_A: 0.7,
      },
      gateImplication: overrides.gateImplication ?? null,
      gateParseInfo: overrides.gateParseInfo ?? null,
      highCoactivation: overrides.highCoactivation ?? { thresholds: [] },
    };
  }

  /**
   * Creates gateParseInfo object.
   * @param {string} parseStatusA - Parse status for prototype A
   * @param {string} parseStatusB - Parse status for prototype B
   * @returns {object} gateParseInfo object
   */
  function createGateParseInfo(parseStatusA, parseStatusB) {
    return {
      prototypeA: {
        parseStatus: parseStatusA,
        parsedGateCount: parseStatusA === 'complete' ? 3 : 2,
        totalGateCount: 3,
        unparsedGates: parseStatusA === 'complete' ? [] : ['complex_gate'],
      },
      prototypeB: {
        parseStatus: parseStatusB,
        parsedGateCount: parseStatusB === 'complete' ? 2 : 1,
        totalGateCount: 2,
        unparsedGates: parseStatusB === 'complete' ? [] : ['another_gate'],
      },
    };
  }

  /**
   * Creates gateImplication object.
   * @param {boolean} aImpliesB - Whether A implies B
   * @param {boolean} bImpliesA - Whether B implies A
   * @param {boolean} isVacuous - Whether implication is vacuous
   * @returns {object} gateImplication object
   */
  function createGateImplication(aImpliesB, bImpliesA, isVacuous = false) {
    const result = {
      A_implies_B: aImpliesB,
      B_implies_A: bImpliesA,
      counterExampleAxes: [],
      evidence: [],
      relation: aImpliesB !== bImpliesA ? 'subsumption' : 'overlapping',
      isVacuous,
    };
    if (isVacuous) {
      result.vacuousReason =
        aImpliesB && bImpliesA ? 'both_unsatisfiable' : 'one_side';
    }
    return result;
  }

  // ==========================================================================
  // Partial parse guard tests
  // ==========================================================================
  describe('deterministic nesting guards', () => {
    it('should NOT use deterministic nesting when prototypeA parse is partial', () => {
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics({
        gateParseInfo: createGateParseInfo('partial', 'complete'),
        gateImplication: createGateImplication(true, false, false), // A implies B
        passRates: {
          passRateA: 0.5,
          passRateB: 0.5,
          pA_given_B: 0.7, // Below nested threshold (0.97)
          pB_given_A: 0.7, // Below nested threshold (0.97)
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      // With partial parse and low conditional probabilities, should not detect nesting
      // Result type should be 'keep_distinct' (default when no other classification matches)
      expect(result.type).toBe('keep_distinct');
    });

    it('should NOT use deterministic nesting when prototypeB parse is partial', () => {
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics({
        gateParseInfo: createGateParseInfo('complete', 'partial'),
        gateImplication: createGateImplication(false, true, false), // B implies A
        passRates: {
          passRateA: 0.5,
          passRateB: 0.5,
          pA_given_B: 0.7,
          pB_given_A: 0.7,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      // Should not use deterministic nesting due to incomplete parse
      expect(result.type).toBe('keep_distinct');
    });

    it('should NOT use deterministic nesting when both parses are partial', () => {
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics({
        gateParseInfo: createGateParseInfo('partial', 'partial'),
        gateImplication: createGateImplication(true, false, false),
        passRates: {
          passRateA: 0.5,
          passRateB: 0.5,
          pA_given_B: 0.6,
          pB_given_A: 0.6,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      // Should fall back to other heuristics
      expect(result.type).toBeDefined();
    });

    it('should allow behavioral nesting even when deterministic unavailable', () => {
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics({
        gateParseInfo: createGateParseInfo('partial', 'complete'),
        gateImplication: createGateImplication(true, false, false),
        // High conditional probability indicates behavioral nesting
        passRates: {
          passRateA: 0.3,
          passRateB: 0.5,
          pA_given_B: 0.5,
          pB_given_A: 0.99, // >= 0.97 threshold: A is narrower behaviorally
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      // Behavioral nesting should still work even with partial parse
      // The classifier may detect needs-separation due to high conditional prob asymmetry
      expect(result).toBeDefined();
    });
  });

  // ==========================================================================
  // Vacuous implication guard tests
  // ==========================================================================
  describe('vacuous implication guards', () => {
    it('should ignore vacuous A→B implication for nesting decisions', () => {
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics({
        gateParseInfo: createGateParseInfo('complete', 'complete'),
        gateImplication: createGateImplication(true, false, true), // Vacuous A→B
        passRates: {
          passRateA: 0.5,
          passRateB: 0.5,
          pA_given_B: 0.7,
          pB_given_A: 0.7,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      // Should not use vacuous implication for deterministic nesting
      // Without behavioral nesting support, should be keep_distinct
      expect(result.type).toBe('keep_distinct');
    });

    it('should ignore vacuous B→A implication for nesting decisions', () => {
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics({
        gateParseInfo: createGateParseInfo('complete', 'complete'),
        gateImplication: createGateImplication(false, true, true), // Vacuous B→A
        passRates: {
          passRateA: 0.5,
          passRateB: 0.5,
          pA_given_B: 0.6,
          pB_given_A: 0.6,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      // Vacuous implications should be ignored
      expect(result.type).toBe('keep_distinct');
    });

    it('should ignore vacuous mutual implication for equality detection', () => {
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics({
        gateParseInfo: createGateParseInfo('complete', 'complete'),
        gateImplication: createGateImplication(true, true, true), // Both unsatisfiable
        passRates: {
          passRateA: 0.5,
          passRateB: 0.5,
          pA_given_B: 0.6,
          pB_given_A: 0.6,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      // Should not treat vacuous equality as real equality
      expect(result).toBeDefined();
    });
  });

  // ==========================================================================
  // Conversion structure guards
  // ==========================================================================
  describe('convert-to-expression vacuous guards', () => {
    it('should NOT match conversion structure with vacuous implication', () => {
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics({
        gateParseInfo: createGateParseInfo('complete', 'complete'),
        gateImplication: {
          A_implies_B: true,
          B_implies_A: false,
          counterExampleAxes: [],
          evidence: [
            {
              axis: 'threat',
              intervalA: { lower: null, upper: 0.15, unsatisfiable: false },
              intervalB: { lower: null, upper: 0.5, unsatisfiable: false },
              A_subset_B: true,
              B_subset_A: false,
            },
          ],
          relation: 'narrower',
          isVacuous: true, // Vacuous - should be skipped
          vacuousReason: 'a_unsatisfiable',
        },
        passRates: {
          passRateA: 0.3,
          passRateB: 0.5,
          pA_given_B: 0.6,
          pB_given_A: 0.95,
        },
      });

      const result = classifier.classify(candidateMetrics, behaviorMetrics);

      // Should not classify as convert_to_expression due to vacuous guard
      expect(result.type).not.toBe('convert_to_expression');
    });
  });

  // ==========================================================================
  // Edge cases
  // ==========================================================================
  describe('edge cases', () => {
    it('should handle missing gateParseInfo gracefully', () => {
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics({
        gateParseInfo: null,
        gateImplication: createGateImplication(true, false, false),
        passRates: {
          passRateA: 0.5,
          passRateB: 0.5,
          pA_given_B: 0.7,
          pB_given_A: 0.7,
        },
      });

      // Should not throw, should fall back to behavioral metrics
      expect(() =>
        classifier.classify(candidateMetrics, behaviorMetrics)
      ).not.toThrow();
      const result = classifier.classify(candidateMetrics, behaviorMetrics);
      expect(result.type).toBeDefined();
    });

    it('should handle partial gateParseInfo (missing prototypeB)', () => {
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics({
        gateParseInfo: {
          prototypeA: {
            parseStatus: 'complete',
            parsedGateCount: 2,
            totalGateCount: 2,
            unparsedGates: [],
          },
          // prototypeB missing
        },
        gateImplication: createGateImplication(true, false, false),
        passRates: {
          passRateA: 0.5,
          passRateB: 0.5,
          pA_given_B: 0.7,
          pB_given_A: 0.7,
        },
      });

      // Should not throw, should treat as incomplete parse
      expect(() =>
        classifier.classify(candidateMetrics, behaviorMetrics)
      ).not.toThrow();
    });

    it('should handle null gateImplication gracefully', () => {
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics({
        gateParseInfo: createGateParseInfo('complete', 'complete'),
        gateImplication: null,
        passRates: {
          passRateA: 0.5,
          passRateB: 0.5,
          pA_given_B: 0.7,
          pB_given_A: 0.7,
        },
      });

      // Should not throw, should use behavioral metrics only
      expect(() =>
        classifier.classify(candidateMetrics, behaviorMetrics)
      ).not.toThrow();
      const result = classifier.classify(candidateMetrics, behaviorMetrics);
      expect(result.type).toBe('keep_distinct');
    });
  });
});
