/**
 * @file Unit tests for PrototypeCreateSuggestionBuilder
 * @description Tests the prototype creation suggestion logic extracted from RecommendationEngine.
 *
 * Emission logic: (A && B) || C, with spam brake.
 *   A = No usable existing prototype
 *   B = Proposed prototype materially improves fit
 *   C = Gap signal detected
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import PrototypeCreateSuggestionBuilder, {
  DEFAULT_THRESHOLD_T_STAR,
  CANDIDATE_SET_SIZE,
  USABLE_GATE_PASS_RATE_MIN,
  USABLE_P_AT_LEAST_T_MIN,
  USABLE_CONFLICT_RATE_MAX,
  IMPROVEMENT_DELTA_MIN,
  GAP_NEAREST_DISTANCE_THRESHOLD,
  GAP_PERCENTILE_THRESHOLD,
  SANITY_GATE_PASS_RATE_MIN,
  SANITY_MIN_NON_ZERO_WEIGHTS,
  SPAM_BRAKE_DISTANCE_MAX,
  SPAM_BRAKE_P_AT_LEAST_T_MIN,
} from '../../../../../src/expressionDiagnostics/services/recommendationBuilders/PrototypeCreateSuggestionBuilder.js';

describe('PrototypeCreateSuggestionBuilder', () => {
  // === TEST FIXTURES ===

  /**
   * Creates a mock synthesis service that returns a configurable result.
   *
   * @param {object} synthesizedResult - The result to return from synthesize().
   * @returns {object} Mock synthesis service.
   */
  const createMockSynthesisService = (synthesizedResult) => ({
    synthesize: jest.fn(() => synthesizedResult),
  });

  /**
   * Creates base diagnostic facts for prototype_create_suggestion tests.
   *
   * @param {object} overrides - Overrides for the default facts.
   * @returns {object} Diagnostic facts object.
   */
  const createPrototypeCreateFacts = (overrides = {}) => ({
    expressionId: 'expr:create-suggestion',
    sampleCount: 800,
    moodRegime: {
      definition: null,
      sampleCount: 400,
      bounds: { valence: { min: -0.5, max: 0.5 } },
    },
    storedMoodRegimeContexts: [{ moodAxes: { valence: 0.2 } }],
    prototypeDefinitions: {
      joy: { weights: { valence: 0.8 }, gates: [] },
    },
    prototypeFit: {
      leaderboard: [
        {
          prototypeId: 'joy',
          combinedScore: 0.5,
          gatePassRate: 0.25, // Below usable threshold
          intensityDistribution: {
            p95: 0.4,
            pAboveThreshold: [{ t: 0.55, p: 0.05 }], // Below usable threshold
          },
          moodSampleCount: 400,
        },
      ],
    },
    gapDetection: {
      nearestDistance: 0.5, // Above gap threshold
      distancePercentile: 80,
      kNearestNeighbors: [],
    },
    targetSignature: {
      valence: { dir: 'up', importance: 0.7 },
    },
    overallPassRate: 0.2,
    clauses: [
      {
        clauseId: 'var:emotions.joy:>=:0.6',
        clauseLabel: 'emotions.joy >= 0.6',
        clauseType: 'threshold',
        operator: '>=',
        prototypeId: 'joy',
        impact: 0.3,
        thresholdValue: 0.6,
      },
    ],
    prototypes: [
      {
        prototypeId: 'joy',
        moodSampleCount: 400,
        gateFailCount: 120,
        gatePassCount: 280,
        thresholdPassGivenGateCount: 120,
        thresholdPassCount: 120,
        gateFailRate: 0.3,
        gatePassRate: 0.7,
        pThreshGivenGate: 0.43,
        pThreshEffective: 0.21,
        meanValueGivenGate: 0.5,
        failedGateCounts: [],
        compatibilityScore: 0,
      },
    ],
    invariants: [{ id: 'rate:overallPassRate', ok: true, message: '' }],
    ...overrides,
  });

  /**
   * Creates a standard synthesized prototype result.
   *
   * @param {object} overrides - Overrides for the default result.
   * @returns {object} Synthesized prototype result.
   */
  const createSynthesizedResult = (overrides = {}) => ({
    name: 'up_valence_joy',
    weights: { valence: 0.9, arousal: 0.3, dominance: 0.2 },
    gates: [],
    predictedFit: {
      N: 400,
      gatePassRate: 0.8,
      mean: 0.65,
      p95: 0.85,
      pAtLeastT: [
        { t: 0.55, p: 0.35 }, // Strong improvement
        { t: 0.45, p: 0.45 },
        { t: 0.65, p: 0.25 },
      ],
    },
    ...overrides,
  });

  // === CONSTRUCTOR TESTS ===

  describe('constructor', () => {
    it('throws when prototypeSynthesisService is not provided', () => {
      expect(() => new PrototypeCreateSuggestionBuilder({})).toThrow(
        'PrototypeCreateSuggestionBuilder requires prototypeSynthesisService'
      );
    });

    it('throws when prototypeSynthesisService is null', () => {
      expect(
        () =>
          new PrototypeCreateSuggestionBuilder({
            prototypeSynthesisService: null,
          })
      ).toThrow('PrototypeCreateSuggestionBuilder requires prototypeSynthesisService');
    });

    it('creates instance with valid prototypeSynthesisService', () => {
      const mockService = createMockSynthesisService({});
      const builder = new PrototypeCreateSuggestionBuilder({
        prototypeSynthesisService: mockService,
      });
      expect(builder).toBeInstanceOf(PrototypeCreateSuggestionBuilder);
    });
  });

  // === CONSTANT EXPORTS ===

  describe('exported constants', () => {
    it('exports DEFAULT_THRESHOLD_T_STAR', () => {
      expect(DEFAULT_THRESHOLD_T_STAR).toBe(0.55);
    });

    it('exports CANDIDATE_SET_SIZE', () => {
      expect(CANDIDATE_SET_SIZE).toBe(10);
    });

    it('exports usability thresholds', () => {
      expect(USABLE_GATE_PASS_RATE_MIN).toBe(0.3);
      expect(USABLE_P_AT_LEAST_T_MIN).toBe(0.1);
      expect(USABLE_CONFLICT_RATE_MAX).toBe(0.2);
    });

    it('exports improvement thresholds', () => {
      expect(IMPROVEMENT_DELTA_MIN).toBe(0.15);
    });

    it('exports gap detection thresholds', () => {
      expect(GAP_NEAREST_DISTANCE_THRESHOLD).toBe(0.45);
      expect(GAP_PERCENTILE_THRESHOLD).toBe(95);
    });

    it('exports sanity check thresholds', () => {
      expect(SANITY_GATE_PASS_RATE_MIN).toBe(0.2);
      expect(SANITY_MIN_NON_ZERO_WEIGHTS).toBe(3);
    });

    it('exports spam brake thresholds', () => {
      expect(SPAM_BRAKE_DISTANCE_MAX).toBe(0.35);
      expect(SPAM_BRAKE_P_AT_LEAST_T_MIN).toBe(0.15);
    });
  });

  // === BUILD METHOD - NULL/EMPTY INPUT HANDLING ===

  describe('build() - input validation', () => {
    let builder;
    let mockSynthesis;

    beforeEach(() => {
      mockSynthesis = createMockSynthesisService(createSynthesizedResult());
      builder = new PrototypeCreateSuggestionBuilder({
        prototypeSynthesisService: mockSynthesis,
      });
    });

    it('returns null when prototypeFit is missing', () => {
      const facts = createPrototypeCreateFacts({ prototypeFit: null });
      expect(builder.build(facts)).toBeNull();
    });

    it('returns null when gapDetection is missing', () => {
      const facts = createPrototypeCreateFacts({ gapDetection: null });
      expect(builder.build(facts)).toBeNull();
    });

    it('returns null when targetSignature is missing', () => {
      const facts = createPrototypeCreateFacts({ targetSignature: null });
      expect(builder.build(facts)).toBeNull();
    });

    it('returns null when leaderboard is empty', () => {
      const facts = createPrototypeCreateFacts({
        prototypeFit: { leaderboard: [] },
      });
      expect(builder.build(facts)).toBeNull();
    });
  });

  // === CONDITION A TESTS (No Usable Prototype) ===

  describe('Condition A - No usable prototype', () => {
    let builder;

    beforeEach(() => {
      const mockSynthesis = createMockSynthesisService(createSynthesizedResult());
      builder = new PrototypeCreateSuggestionBuilder({
        prototypeSynthesisService: mockSynthesis,
      });
    });

    it('detects unusable prototype when gatePassRate < 0.30', () => {
      const facts = createPrototypeCreateFacts({
        prototypeFit: {
          leaderboard: [
            {
              prototypeId: 'joy',
              combinedScore: 0.5,
              gatePassRate: 0.25, // Below 0.30 threshold
              intensityDistribution: {
                p95: 0.4,
                pAboveThreshold: [{ t: 0.55, p: 0.15 }], // Above 0.10, so only gate fails
              },
              moodSampleCount: 400,
            },
          ],
        },
      });

      const result = builder.build(facts);
      expect(result).not.toBeNull();
      expect(result.why).toContain('No existing prototype meets usability');
    });

    it('detects unusable prototype when pAtLeastT < 0.10', () => {
      const facts = createPrototypeCreateFacts({
        prototypeFit: {
          leaderboard: [
            {
              prototypeId: 'joy',
              combinedScore: 0.5,
              gatePassRate: 0.40, // Above 0.30, usable
              intensityDistribution: {
                p95: 0.4,
                pAboveThreshold: [{ t: 0.55, p: 0.05 }], // Below 0.10 threshold
              },
              moodSampleCount: 400,
            },
          ],
        },
      });

      const result = builder.build(facts);
      expect(result).not.toBeNull();
      expect(result.why).toContain('No existing prototype meets usability');
    });

    it('detects unusable prototype when conflictRate > 0.20', () => {
      const facts = createPrototypeCreateFacts({
        prototypeFit: {
          leaderboard: [
            {
              prototypeId: 'joy',
              combinedScore: 0.5,
              gatePassRate: 0.40,
              conflictRate: 0.25, // Above 0.20 threshold
              intensityDistribution: {
                p95: 0.4,
                pAboveThreshold: [{ t: 0.55, p: 0.15 }],
              },
              moodSampleCount: 400,
            },
          ],
        },
      });

      const result = builder.build(facts);
      expect(result).not.toBeNull();
      expect(result.why).toContain('No existing prototype meets usability');
    });
  });

  // === CONDITION B TESTS (Improvement) ===

  describe('Condition B - Strong improvement', () => {
    it('emits when delta >= 0.15', () => {
      const mockSynthesis = createMockSynthesisService(
        createSynthesizedResult({
          predictedFit: {
            N: 400,
            gatePassRate: 0.8,
            mean: 0.65,
            p95: 0.85,
            pAtLeastT: [{ t: 0.55, p: 0.30 }], // 0.30 - 0.05 = 0.25 delta
          },
        })
      );

      const builder = new PrototypeCreateSuggestionBuilder({
        prototypeSynthesisService: mockSynthesis,
      });

      const facts = createPrototypeCreateFacts({
        prototypeFit: {
          leaderboard: [
            {
              prototypeId: 'joy',
              combinedScore: 0.5,
              gatePassRate: 0.25, // A is true (not usable)
              intensityDistribution: {
                p95: 0.4,
                pAboveThreshold: [{ t: 0.55, p: 0.05 }],
              },
              moodSampleCount: 400,
            },
          ],
        },
      });

      const result = builder.build(facts);
      expect(result).not.toBeNull();
      expect(result.confidence).toBe('high');
      expect(result.why).toContain('improves fit by at least 15 percentage points');
    });

    it('does not emit when only A is true and delta < 0.15', () => {
      const mockSynthesis = createMockSynthesisService(
        createSynthesizedResult({
          predictedFit: {
            N: 400,
            gatePassRate: 0.8,
            mean: 0.65,
            p95: 0.85,
            pAtLeastT: [{ t: 0.55, p: 0.12 }], // 0.12 - 0.05 = 0.07 delta (below 0.15)
          },
        })
      );

      const builder = new PrototypeCreateSuggestionBuilder({
        prototypeSynthesisService: mockSynthesis,
      });

      const facts = createPrototypeCreateFacts({
        gapDetection: {
          nearestDistance: 0.30, // Not triggering C
          distancePercentile: 50,
        },
        prototypeFit: {
          leaderboard: [
            {
              prototypeId: 'joy',
              combinedScore: 0.5,
              gatePassRate: 0.25, // A is true
              intensityDistribution: {
                p95: 0.4,
                pAboveThreshold: [{ t: 0.55, p: 0.05 }],
              },
              moodSampleCount: 400,
            },
          ],
        },
      });

      const result = builder.build(facts);
      expect(result).toBeNull();
    });
  });

  // === CONDITION C TESTS (Gap Signal) ===

  describe('Condition C - Gap signal', () => {
    it('detects gap when nearestDistance > 0.45', () => {
      const mockSynthesis = createMockSynthesisService(
        createSynthesizedResult({
          predictedFit: {
            N: 400,
            gatePassRate: 0.5, // Passes sanity
            mean: 0.55,
            p95: 0.7,
            pAtLeastT: [{ t: 0.55, p: 0.14 }], // B fails
          },
        })
      );

      const builder = new PrototypeCreateSuggestionBuilder({
        prototypeSynthesisService: mockSynthesis,
      });

      const facts = createPrototypeCreateFacts({
        gapDetection: {
          nearestDistance: 0.55, // > 0.45 triggers C
          distancePercentile: 80,
        },
        prototypeFit: {
          leaderboard: [
            {
              prototypeId: 'joy',
              combinedScore: 0.5,
              gatePassRate: 0.40, // Usable (A is false)
              intensityDistribution: {
                p95: 0.5,
                pAboveThreshold: [{ t: 0.55, p: 0.12 }],
              },
              moodSampleCount: 400,
            },
          ],
        },
      });

      const result = builder.build(facts);
      expect(result).not.toBeNull();
      expect(result.confidence).toBe('medium');
      expect(result.why).toContain('gap detected');
    });

    it('detects gap when distancePercentile >= 95', () => {
      const mockSynthesis = createMockSynthesisService(
        createSynthesizedResult({
          predictedFit: {
            N: 400,
            gatePassRate: 0.5,
            mean: 0.55,
            p95: 0.7,
            pAtLeastT: [{ t: 0.55, p: 0.14 }],
          },
        })
      );

      const builder = new PrototypeCreateSuggestionBuilder({
        prototypeSynthesisService: mockSynthesis,
      });

      const facts = createPrototypeCreateFacts({
        gapDetection: {
          nearestDistance: 0.30, // Below distance threshold
          distancePercentile: 96, // >= 95 triggers C
        },
        prototypeFit: {
          leaderboard: [
            {
              prototypeId: 'joy',
              combinedScore: 0.5,
              gatePassRate: 0.40,
              intensityDistribution: {
                p95: 0.5,
                pAboveThreshold: [{ t: 0.55, p: 0.12 }],
              },
              moodSampleCount: 400,
            },
          ],
        },
      });

      const result = builder.build(facts);
      expect(result).not.toBeNull();
      expect(result.why).toContain('gap detected');
    });
  });

  // === EMISSION LOGIC TESTS ===

  describe('Emission logic: (A && B) || C', () => {
    it('emits when (A && B) is true', () => {
      const mockSynthesis = createMockSynthesisService(createSynthesizedResult());

      const builder = new PrototypeCreateSuggestionBuilder({
        prototypeSynthesisService: mockSynthesis,
      });

      const facts = createPrototypeCreateFacts({
        gapDetection: {
          nearestDistance: 0.30, // C is false
          distancePercentile: 50,
        },
        prototypeFit: {
          leaderboard: [
            {
              prototypeId: 'joy',
              combinedScore: 0.5,
              gatePassRate: 0.25, // A is true
              intensityDistribution: {
                p95: 0.4,
                pAboveThreshold: [{ t: 0.55, p: 0.05 }], // B will be true due to 0.30 delta
              },
              moodSampleCount: 400,
            },
          ],
        },
      });

      const result = builder.build(facts);
      expect(result).not.toBeNull();
      expect(result.confidence).toBe('high');
    });

    it('emits when C is true with sanity pass', () => {
      const mockSynthesis = createMockSynthesisService(
        createSynthesizedResult({
          predictedFit: {
            N: 400,
            gatePassRate: 0.5, // Passes sanity >= 0.20
            mean: 0.55,
            p95: 0.7,
            pAtLeastT: [{ t: 0.55, p: 0.12 }], // B fails
          },
        })
      );

      const builder = new PrototypeCreateSuggestionBuilder({
        prototypeSynthesisService: mockSynthesis,
      });

      const facts = createPrototypeCreateFacts({
        gapDetection: {
          nearestDistance: 0.55, // C triggers
          distancePercentile: 80,
        },
        prototypeFit: {
          leaderboard: [
            {
              prototypeId: 'joy',
              combinedScore: 0.5,
              gatePassRate: 0.40, // A is false (usable)
              intensityDistribution: {
                p95: 0.5,
                pAboveThreshold: [{ t: 0.55, p: 0.12 }],
              },
              moodSampleCount: 400,
            },
          ],
        },
      });

      const result = builder.build(facts);
      expect(result).not.toBeNull();
    });

    it('does not emit when A is true but B is false and C is false', () => {
      const mockSynthesis = createMockSynthesisService(
        createSynthesizedResult({
          predictedFit: {
            N: 400,
            gatePassRate: 0.8,
            mean: 0.65,
            p95: 0.85,
            pAtLeastT: [{ t: 0.55, p: 0.12 }], // 0.12 - 0.05 = 0.07 < 0.15
          },
        })
      );

      const builder = new PrototypeCreateSuggestionBuilder({
        prototypeSynthesisService: mockSynthesis,
      });

      const facts = createPrototypeCreateFacts({
        gapDetection: {
          nearestDistance: 0.30, // C is false
          distancePercentile: 50,
        },
        prototypeFit: {
          leaderboard: [
            {
              prototypeId: 'joy',
              combinedScore: 0.5,
              gatePassRate: 0.25, // A is true
              intensityDistribution: {
                p95: 0.4,
                pAboveThreshold: [{ t: 0.55, p: 0.05 }],
              },
              moodSampleCount: 400,
            },
          ],
        },
      });

      const result = builder.build(facts);
      expect(result).toBeNull();
    });

    it('does not emit when usable prototype exists and C not triggered', () => {
      const mockSynthesis = createMockSynthesisService(createSynthesizedResult());

      const builder = new PrototypeCreateSuggestionBuilder({
        prototypeSynthesisService: mockSynthesis,
      });

      const facts = createPrototypeCreateFacts({
        gapDetection: {
          nearestDistance: 0.30, // C is false
          distancePercentile: 50,
        },
        prototypeFit: {
          leaderboard: [
            {
              prototypeId: 'joy',
              combinedScore: 0.5,
              gatePassRate: 0.50, // Usable (A is false)
              intensityDistribution: {
                p95: 0.6,
                pAboveThreshold: [{ t: 0.55, p: 0.20 }], // Usable
              },
              moodSampleCount: 400,
            },
          ],
        },
      });

      const result = builder.build(facts);
      expect(result).toBeNull();
    });
  });

  // === SPAM BRAKE TESTS ===

  describe('Spam brake', () => {
    it('blocks emission when nearestDistance <= 0.35 and bestPAtLeastT >= 0.15', () => {
      const mockSynthesis = createMockSynthesisService(createSynthesizedResult());

      const builder = new PrototypeCreateSuggestionBuilder({
        prototypeSynthesisService: mockSynthesis,
      });

      const facts = createPrototypeCreateFacts({
        gapDetection: {
          nearestDistance: 0.30, // <= 0.35
          distancePercentile: 50,
        },
        prototypeFit: {
          leaderboard: [
            {
              prototypeId: 'joy',
              combinedScore: 0.5,
              gatePassRate: 0.25, // A would be true
              intensityDistribution: {
                p95: 0.4,
                pAboveThreshold: [{ t: 0.55, p: 0.20 }], // >= 0.15 triggers spam brake
              },
              moodSampleCount: 400,
            },
          ],
        },
      });

      const result = builder.build(facts);
      expect(result).toBeNull();
    });

    it('does not block when nearestDistance > 0.35', () => {
      const mockSynthesis = createMockSynthesisService(createSynthesizedResult());

      const builder = new PrototypeCreateSuggestionBuilder({
        prototypeSynthesisService: mockSynthesis,
      });

      // Note: Spam brake triggers when nearestDistance <= 0.35 AND bestPAtLeastT >= 0.15.
      // With nearestDistance > 0.35, spam brake doesn't trigger, BUT other emission
      // conditions must still be met: (A && B) || C.
      // This test verifies A && B path with spam brake NOT blocking.
      const facts = createPrototypeCreateFacts({
        gapDetection: {
          nearestDistance: 0.40, // > 0.35, spam brake doesn't trigger
          distancePercentile: 50,
        },
        prototypeFit: {
          leaderboard: [
            {
              prototypeId: 'joy',
              combinedScore: 0.5,
              gatePassRate: 0.25, // < 0.30, so A = true (no usable prototype)
              intensityDistribution: {
                p95: 0.4,
                // pBest at t=0.6 will be 0.05 (extrapolated from last entry)
                // pNew at t=0.6 is 0.30 from synthesized result
                // delta = 0.30 - 0.05 = 0.25 >= 0.15, so B = true
                pAboveThreshold: [{ t: 0.6, p: 0.05 }],
              },
              moodSampleCount: 400,
            },
          ],
        },
      });

      const result = builder.build(facts);
      expect(result).not.toBeNull();
    });

    it('does not block when bestPAtLeastT < 0.15', () => {
      const mockSynthesis = createMockSynthesisService(createSynthesizedResult());

      const builder = new PrototypeCreateSuggestionBuilder({
        prototypeSynthesisService: mockSynthesis,
      });

      const facts = createPrototypeCreateFacts({
        gapDetection: {
          nearestDistance: 0.30, // <= 0.35
          distancePercentile: 50,
        },
        prototypeFit: {
          leaderboard: [
            {
              prototypeId: 'joy',
              combinedScore: 0.5,
              gatePassRate: 0.25,
              intensityDistribution: {
                p95: 0.4,
                pAboveThreshold: [{ t: 0.55, p: 0.10 }], // < 0.15, no spam brake
              },
              moodSampleCount: 400,
            },
          ],
        },
      });

      const result = builder.build(facts);
      expect(result).not.toBeNull();
    });
  });

  // === SANITY CHECK TESTS ===

  describe('Sanity check', () => {
    it('blocks C-triggered emission when gatePassRate < 0.20', () => {
      const mockSynthesis = createMockSynthesisService(
        createSynthesizedResult({
          predictedFit: {
            N: 400,
            gatePassRate: 0.15, // Below 0.20 sanity threshold
            mean: 0.55,
            p95: 0.7,
            pAtLeastT: [{ t: 0.55, p: 0.12 }],
          },
        })
      );

      const builder = new PrototypeCreateSuggestionBuilder({
        prototypeSynthesisService: mockSynthesis,
      });

      const facts = createPrototypeCreateFacts({
        gapDetection: {
          nearestDistance: 0.55, // C triggers
          distancePercentile: 80,
        },
        prototypeFit: {
          leaderboard: [
            {
              prototypeId: 'joy',
              combinedScore: 0.5,
              gatePassRate: 0.40, // A is false
              intensityDistribution: {
                p95: 0.5,
                pAboveThreshold: [{ t: 0.55, p: 0.12 }],
              },
              moodSampleCount: 400,
            },
          ],
        },
      });

      const result = builder.build(facts);
      expect(result).toBeNull();
    });

    it('blocks C-triggered emission when nonZeroWeights < 3', () => {
      const mockSynthesis = createMockSynthesisService(
        createSynthesizedResult({
          weights: { valence: 0.9, arousal: 0.3 }, // Only 2 non-zero weights
          predictedFit: {
            N: 400,
            gatePassRate: 0.5,
            mean: 0.55,
            p95: 0.7,
            pAtLeastT: [{ t: 0.55, p: 0.12 }],
          },
        })
      );

      const builder = new PrototypeCreateSuggestionBuilder({
        prototypeSynthesisService: mockSynthesis,
      });

      const facts = createPrototypeCreateFacts({
        gapDetection: {
          nearestDistance: 0.55,
          distancePercentile: 80,
        },
        prototypeFit: {
          leaderboard: [
            {
              prototypeId: 'joy',
              combinedScore: 0.5,
              gatePassRate: 0.40,
              intensityDistribution: {
                p95: 0.5,
                pAboveThreshold: [{ t: 0.55, p: 0.12 }],
              },
              moodSampleCount: 400,
            },
          ],
        },
      });

      const result = builder.build(facts);
      expect(result).toBeNull();
    });
  });

  // === CONFIDENCE LEVEL TESTS ===

  describe('Confidence levels', () => {
    it('returns high confidence for (A && B)', () => {
      const mockSynthesis = createMockSynthesisService(createSynthesizedResult());

      const builder = new PrototypeCreateSuggestionBuilder({
        prototypeSynthesisService: mockSynthesis,
      });

      const facts = createPrototypeCreateFacts({
        gapDetection: {
          nearestDistance: 0.50,
          distancePercentile: 80,
        },
        prototypeFit: {
          leaderboard: [
            {
              prototypeId: 'joy',
              combinedScore: 0.5,
              gatePassRate: 0.25, // A is true
              intensityDistribution: {
                p95: 0.4,
                pAboveThreshold: [{ t: 0.55, p: 0.05 }], // B will be true
              },
              moodSampleCount: 400,
            },
          ],
        },
      });

      const result = builder.build(facts);
      expect(result.confidence).toBe('high');
    });

    it('returns high confidence for (C && B)', () => {
      const mockSynthesis = createMockSynthesisService(createSynthesizedResult());

      const builder = new PrototypeCreateSuggestionBuilder({
        prototypeSynthesisService: mockSynthesis,
      });

      const facts = createPrototypeCreateFacts({
        gapDetection: {
          nearestDistance: 0.55, // C triggers
          distancePercentile: 80,
        },
        prototypeFit: {
          leaderboard: [
            {
              prototypeId: 'joy',
              combinedScore: 0.5,
              gatePassRate: 0.40, // A is false
              intensityDistribution: {
                p95: 0.5,
                pAboveThreshold: [{ t: 0.55, p: 0.12 }], // B will be true (0.35 - 0.12 > 0.15)
              },
              moodSampleCount: 400,
            },
          ],
        },
      });

      const result = builder.build(facts);
      expect(result.confidence).toBe('high');
    });

    it('returns medium confidence for C alone (without B)', () => {
      const mockSynthesis = createMockSynthesisService(
        createSynthesizedResult({
          predictedFit: {
            N: 400,
            gatePassRate: 0.5,
            mean: 0.55,
            p95: 0.7,
            pAtLeastT: [{ t: 0.55, p: 0.14 }], // B fails (0.14 - 0.12 = 0.02 < 0.15)
          },
        })
      );

      const builder = new PrototypeCreateSuggestionBuilder({
        prototypeSynthesisService: mockSynthesis,
      });

      const facts = createPrototypeCreateFacts({
        gapDetection: {
          nearestDistance: 0.55, // C triggers
          distancePercentile: 80,
        },
        prototypeFit: {
          leaderboard: [
            {
              prototypeId: 'joy',
              combinedScore: 0.5,
              gatePassRate: 0.40, // A is false
              intensityDistribution: {
                p95: 0.5,
                pAboveThreshold: [{ t: 0.55, p: 0.12 }],
              },
              moodSampleCount: 400,
            },
          ],
        },
      });

      const result = builder.build(facts);
      expect(result.confidence).toBe('medium');
    });
  });

  // === OUTPUT STRUCTURE TESTS ===

  describe('Output structure', () => {
    let builder;

    beforeEach(() => {
      const mockSynthesis = createMockSynthesisService(createSynthesizedResult());
      builder = new PrototypeCreateSuggestionBuilder({
        prototypeSynthesisService: mockSynthesis,
      });
    });

    it('includes correct type and title', () => {
      const facts = createPrototypeCreateFacts();
      const result = builder.build(facts);

      expect(result.type).toBe('prototype_create_suggestion');
      expect(result.title).toBe('Prototype creation suggested');
    });

    it('includes correct id format', () => {
      const facts = createPrototypeCreateFacts();
      const result = builder.build(facts);

      expect(result.id).toMatch(/^prototype_create_suggestion:expr:create-suggestion:/);
    });

    it('includes proposedPrototype with expected fields', () => {
      const facts = createPrototypeCreateFacts();
      const result = builder.build(facts);

      expect(result.proposedPrototype).toBeDefined();
      expect(result.proposedPrototype.name).toBe('up_valence_joy');
      expect(result.proposedPrototype.weights).toEqual({
        valence: 0.9,
        arousal: 0.3,
        dominance: 0.2,
      });
      expect(result.proposedPrototype.gates).toEqual([]);
      expect(result.proposedPrototype.derivedFrom).toBeDefined();
    });

    it('includes predictedFit with comparison', () => {
      const facts = createPrototypeCreateFacts();
      const result = builder.build(facts);

      expect(result.predictedFit).toBeDefined();
      expect(result.predictedFit.population).toBe('stored-mood-regime');
      expect(result.predictedFit.comparison).toBeDefined();
      expect(result.predictedFit.comparison.delta).toBeDefined();
    });

    it('includes evidence array', () => {
      const facts = createPrototypeCreateFacts();
      const result = builder.build(facts);

      expect(Array.isArray(result.evidence)).toBe(true);
      expect(result.evidence.length).toBeGreaterThan(0);
    });

    it('includes relatedClauseIds', () => {
      const facts = createPrototypeCreateFacts();
      const result = builder.build(facts);

      expect(Array.isArray(result.relatedClauseIds)).toBe(true);
      expect(result.relatedClauseIds).toContain('var:emotions.joy:>=:0.6');
    });
  });

  // === ANCHOR CLAUSE SELECTION TESTS ===

  describe('Anchor clause selection', () => {
    it('uses anchor clause threshold when present', () => {
      const mockSynthesis = createMockSynthesisService(
        createSynthesizedResult({
          predictedFit: {
            N: 400,
            gatePassRate: 0.8,
            mean: 0.65,
            p95: 0.85,
            pAtLeastT: [{ t: 0.7, p: 0.35 }], // Custom threshold
          },
        })
      );

      const builder = new PrototypeCreateSuggestionBuilder({
        prototypeSynthesisService: mockSynthesis,
      });

      const facts = createPrototypeCreateFacts({
        clauses: [
          {
            clauseId: 'var:emotions.joy:>=:0.7',
            clauseLabel: 'emotions.joy >= 0.7',
            clauseType: 'threshold',
            operator: '>=',
            prototypeId: 'joy',
            impact: 0.3,
            thresholdValue: 0.7, // Custom threshold
          },
        ],
        prototypeFit: {
          leaderboard: [
            {
              prototypeId: 'joy',
              combinedScore: 0.5,
              gatePassRate: 0.25,
              intensityDistribution: {
                p95: 0.4,
                pAboveThreshold: [{ t: 0.7, p: 0.05 }],
              },
              moodSampleCount: 400,
            },
          ],
        },
      });

      const result = builder.build(facts);
      expect(result).not.toBeNull();
      expect(result.evidence.some((e) => e.label.includes('0.70'))).toBe(true);
    });

    it('uses default threshold 0.55 when no anchor clause', () => {
      const mockSynthesis = createMockSynthesisService(createSynthesizedResult());

      const builder = new PrototypeCreateSuggestionBuilder({
        prototypeSynthesisService: mockSynthesis,
      });

      const facts = createPrototypeCreateFacts({
        clauses: [
          {
            clauseId: 'axis:moodAxes.valence:>=:0.2',
            clauseLabel: 'moodAxes.valence >= 0.2',
            clauseType: 'threshold',
            operator: '>=',
            prototypeId: null, // No prototype
            impact: 0.3,
            thresholdValue: 0.2,
          },
        ],
      });

      const result = builder.build(facts);
      expect(result).not.toBeNull();
      expect(result.evidence.some((e) => e.label.includes('0.55'))).toBe(true);
    });

    it('selects highest-impact clause as anchor', () => {
      const mockSynthesis = createMockSynthesisService(createSynthesizedResult());

      const builder = new PrototypeCreateSuggestionBuilder({
        prototypeSynthesisService: mockSynthesis,
      });

      const facts = createPrototypeCreateFacts({
        clauses: [
          {
            clauseId: 'var:emotions.joy:>=:0.5',
            clauseLabel: 'emotions.joy >= 0.5',
            clauseType: 'threshold',
            operator: '>=',
            prototypeId: 'joy',
            impact: 0.2, // Lower impact
            thresholdValue: 0.5,
          },
          {
            clauseId: 'var:emotions.excitement:>=:0.6',
            clauseLabel: 'emotions.excitement >= 0.6',
            clauseType: 'threshold',
            operator: '>=',
            prototypeId: 'excitement',
            impact: 0.5, // Higher impact - should be selected
            thresholdValue: 0.6,
          },
        ],
        prototypeDefinitions: {
          joy: { weights: { valence: 0.8 }, gates: [] },
          excitement: { weights: { arousal: 0.9 }, gates: [] },
        },
      });

      const result = builder.build(facts);
      expect(result).not.toBeNull();
      // The anchor clause (excitement) has thresholdValue 0.6, so evidence labels
      // should include '0.60' (the formatted threshold), not '0.55' (the default)
      expect(result.evidence.some((e) => e.label.includes('0.60'))).toBe(true);
      expect(result.relatedClauseIds).toContain('var:emotions.excitement:>=:0.6');
    });
  });

  // === SYNTHESIS SERVICE INTERACTION ===

  describe('Synthesis service interaction', () => {
    it('calls synthesize with correct parameters', () => {
      const mockSynthesis = createMockSynthesisService(createSynthesizedResult());

      const builder = new PrototypeCreateSuggestionBuilder({
        prototypeSynthesisService: mockSynthesis,
      });

      const facts = createPrototypeCreateFacts();
      builder.build(facts);

      expect(mockSynthesis.synthesize).toHaveBeenCalledWith(
        expect.objectContaining({
          targetSignature: facts.targetSignature,
          regimeBounds: facts.moodRegime.bounds,
          storedMoodRegimeContexts: facts.storedMoodRegimeContexts,
          threshold: 0.6, // From anchor clause
        })
      );
    });

    it('returns null when synthesize throws', () => {
      const mockSynthesis = {
        synthesize: jest.fn(() => {
          throw new Error('Synthesis failed');
        }),
      };

      const builder = new PrototypeCreateSuggestionBuilder({
        prototypeSynthesisService: mockSynthesis,
      });

      const facts = createPrototypeCreateFacts();
      const result = builder.build(facts);

      expect(result).toBeNull();
    });

    it('returns null when synthesize returns null', () => {
      const mockSynthesis = createMockSynthesisService(null);

      const builder = new PrototypeCreateSuggestionBuilder({
        prototypeSynthesisService: mockSynthesis,
      });

      const facts = createPrototypeCreateFacts();
      const result = builder.build(facts);

      expect(result).toBeNull();
    });
  });

  // === INTERPOLATION TESTS ===

  describe('P(I >= t*) interpolation', () => {
    it('interpolates between threshold points', () => {
      const mockSynthesis = createMockSynthesisService(
        createSynthesizedResult({
          predictedFit: {
            N: 400,
            gatePassRate: 0.8,
            mean: 0.65,
            p95: 0.85,
            pAtLeastT: [
              { t: 0.50, p: 0.40 },
              { t: 0.60, p: 0.30 },
            ],
          },
        })
      );

      const builder = new PrototypeCreateSuggestionBuilder({
        prototypeSynthesisService: mockSynthesis,
      });

      const facts = createPrototypeCreateFacts({
        clauses: [
          {
            clauseId: 'test',
            prototypeId: 'joy',
            impact: 0.3,
            thresholdValue: 0.55, // Between 0.50 and 0.60
          },
        ],
        prototypeFit: {
          leaderboard: [
            {
              prototypeId: 'joy',
              combinedScore: 0.5,
              gatePassRate: 0.25,
              intensityDistribution: {
                p95: 0.4,
                pAboveThreshold: [
                  { t: 0.50, p: 0.10 },
                  { t: 0.60, p: 0.05 },
                ],
              },
              moodSampleCount: 400,
            },
          ],
        },
      });

      const result = builder.build(facts);
      // Should interpolate and emit since synthesized shows improvement
      expect(result).not.toBeNull();
    });
  });
});
