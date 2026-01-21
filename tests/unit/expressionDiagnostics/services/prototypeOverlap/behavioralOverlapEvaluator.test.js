/**
 * @file Unit tests for BehavioralOverlapEvaluator
 * @see src/expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import BehavioralOverlapEvaluator from '../../../../../src/expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js';

describe('BehavioralOverlapEvaluator', () => {
  let mockLogger;
  let mockIntensityCalculator;
  let mockRandomStateGenerator;
  let mockContextBuilder;
  let mockGateChecker;
  let mockGateConstraintExtractor;
  let mockGateImplicationEvaluator;
  let mockConfig;

  /**
   * Creates a basic state generator mock with deterministic output.
   */
  function createMockStateGenerator(states = []) {
    let callIndex = 0;
    return {
      generate: jest.fn(() => {
        const state = states[callIndex] ?? {
          current: { mood: { happiness: 50 }, sexual: { sex_excitation: 30 } },
          previous: { mood: { happiness: 40 }, sexual: { sex_excitation: 20 } },
          affectTraits: { affective_empathy: 50, cognitive_empathy: 50, harm_aversion: 50 },
        };
        callIndex = (callIndex + 1) % Math.max(1, states.length);
        return state;
      }),
    };
  }

  /**
   * Creates a basic context builder mock.
   */
  function createMockContextBuilder() {
    return {
      buildContext: jest.fn((current, previous, traits) => ({
        moodAxes: current.mood,
        sexualAxes: current.sexual,
        affectTraits: traits,
        emotions: {},
        sexualStates: {},
      })),
    };
  }

  /**
   * Creates a gate checker mock with configurable pass behavior.
   */
  function createMockGateChecker(passA = true, passB = true) {
    return {
      checkAllGatesPass: jest.fn((gates) => {
        // Distinguish by gates content or use simple alternation
        if (gates.length === 0) return true;
        if (gates.includes('A_ONLY')) return passA;
        if (gates.includes('B_ONLY')) return passB;
        return passA && passB;
      }),
    };
  }

  /**
   * Creates an intensity calculator mock with configurable behavior.
   */
  function createMockIntensityCalculator(intensityA = 0.5, intensityB = 0.5) {
    let callCount = 0;
    return {
      computeIntensity: jest.fn((weights) => {
        callCount++;
        // Alternate based on weights identification
        if (weights === 'A_WEIGHTS' || weights.id === 'A') return intensityA;
        if (weights === 'B_WEIGHTS' || weights.id === 'B') return intensityB;
        // Alternate if weights aren't distinguishable
        return callCount % 2 === 1 ? intensityA : intensityB;
      }),
    };
  }

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockConfig = {
      sampleCountPerPair: 100,
      divergenceExamplesK: 5,
      dominanceDelta: 0.05,
    };

    mockRandomStateGenerator = createMockStateGenerator();
    mockContextBuilder = createMockContextBuilder();
    mockGateChecker = createMockGateChecker();
    mockIntensityCalculator = createMockIntensityCalculator();

    // Gate constraint and implication mocks (added for PROREDANAV2)
    mockGateConstraintExtractor = {
      extract: jest.fn(() => ({
        parseStatus: 'complete',
        intervals: {},
      })),
    };

    mockGateImplicationEvaluator = {
      evaluate: jest.fn(() => ({
        A_implies_B: false,
        B_implies_A: false,
        counterExampleAxes: [],
        evidence: [],
        relation: 'overlapping',
      })),
    };
  });

  // ==========================================================================
  // Constructor validation tests
  // ==========================================================================
  describe('constructor', () => {
    it('creates instance with valid dependencies', () => {
      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: mockGateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      expect(evaluator).toBeInstanceOf(BehavioralOverlapEvaluator);
    });

    it('throws when logger is missing', () => {
      expect(() => {
        new BehavioralOverlapEvaluator({
          prototypeIntensityCalculator: mockIntensityCalculator,
          randomStateGenerator: mockRandomStateGenerator,
          contextBuilder: mockContextBuilder,
          prototypeGateChecker: mockGateChecker,
          gateConstraintExtractor: mockGateConstraintExtractor,
          gateImplicationEvaluator: mockGateImplicationEvaluator,
          config: mockConfig,
          logger: null,
        });
      }).toThrow();
    });

    it('throws when prototypeIntensityCalculator is missing computeIntensity', () => {
      expect(() => {
        new BehavioralOverlapEvaluator({
          prototypeIntensityCalculator: {},
          randomStateGenerator: mockRandomStateGenerator,
          contextBuilder: mockContextBuilder,
          prototypeGateChecker: mockGateChecker,
          gateConstraintExtractor: mockGateConstraintExtractor,
          gateImplicationEvaluator: mockGateImplicationEvaluator,
          config: mockConfig,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('throws when randomStateGenerator is missing generate', () => {
      expect(() => {
        new BehavioralOverlapEvaluator({
          prototypeIntensityCalculator: mockIntensityCalculator,
          randomStateGenerator: {},
          contextBuilder: mockContextBuilder,
          prototypeGateChecker: mockGateChecker,
          gateConstraintExtractor: mockGateConstraintExtractor,
          gateImplicationEvaluator: mockGateImplicationEvaluator,
          config: mockConfig,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('throws when contextBuilder is missing buildContext', () => {
      expect(() => {
        new BehavioralOverlapEvaluator({
          prototypeIntensityCalculator: mockIntensityCalculator,
          randomStateGenerator: mockRandomStateGenerator,
          contextBuilder: {},
          prototypeGateChecker: mockGateChecker,
          gateConstraintExtractor: mockGateConstraintExtractor,
          gateImplicationEvaluator: mockGateImplicationEvaluator,
          config: mockConfig,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('throws when prototypeGateChecker is missing checkAllGatesPass', () => {
      expect(() => {
        new BehavioralOverlapEvaluator({
          prototypeIntensityCalculator: mockIntensityCalculator,
          randomStateGenerator: mockRandomStateGenerator,
          contextBuilder: mockContextBuilder,
          prototypeGateChecker: {},
          gateConstraintExtractor: mockGateConstraintExtractor,
          gateImplicationEvaluator: mockGateImplicationEvaluator,
          config: mockConfig,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('throws when config is missing required keys', () => {
      expect(() => {
        new BehavioralOverlapEvaluator({
          prototypeIntensityCalculator: mockIntensityCalculator,
          randomStateGenerator: mockRandomStateGenerator,
          contextBuilder: mockContextBuilder,
          prototypeGateChecker: mockGateChecker,
          gateConstraintExtractor: mockGateConstraintExtractor,
          gateImplicationEvaluator: mockGateImplicationEvaluator,
          config: { sampleCountPerPair: 100 }, // Missing divergenceExamplesK and dominanceDelta
          logger: mockLogger,
        });
      }).toThrow(/divergenceExamplesK/);
    });

    it('throws when config is null', () => {
      expect(() => {
        new BehavioralOverlapEvaluator({
          prototypeIntensityCalculator: mockIntensityCalculator,
          randomStateGenerator: mockRandomStateGenerator,
          contextBuilder: mockContextBuilder,
          prototypeGateChecker: mockGateChecker,
          gateConstraintExtractor: mockGateConstraintExtractor,
          gateImplicationEvaluator: mockGateImplicationEvaluator,
          config: null,
          logger: mockLogger,
        });
      }).toThrow(/valid config object/);
    });
  });

  // ==========================================================================
  // Gate overlap stats tests
  // ==========================================================================
  describe('gate overlap statistics', () => {
    it('returns onBothRate == onEitherRate for identical gates (both always pass)', async () => {
      // Both prototypes always pass
      const gateChecker = {
        checkAllGatesPass: jest.fn(() => true),
      };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { gates: [], weights: { axis1: 1.0 } };
      const protoB = { gates: [], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 50);

      expect(result.gateOverlap.onBothRate).toBe(result.gateOverlap.onEitherRate);
      expect(result.gateOverlap.onBothRate).toBe(1);
      expect(result.gateOverlap.pOnlyRate).toBe(0);
      expect(result.gateOverlap.qOnlyRate).toBe(0);
    });

    it('returns onBothRate == 0 for completely disjoint gates', async () => {
      // A passes, B fails or vice versa, but never both
      let gateCallCount = 0;
      const gateChecker = {
        checkAllGatesPass: jest.fn(() => {
          gateCallCount++;
          // Alternate: A passes on odd calls, B passes on even calls
          return gateCallCount % 2 === 1;
        }),
      };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { gates: ['A_GATE'], weights: { axis1: 1.0 } };
      const protoB = { gates: ['B_GATE'], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 50);

      expect(result.gateOverlap.onBothRate).toBe(0);
      expect(result.gateOverlap.onEitherRate).toBe(1);
    });

    it('computes correct pOnlyRate and qOnlyRate', async () => {
      // A always passes, B never passes
      const gateChecker = {
        checkAllGatesPass: jest.fn((gates) => {
          return gates.includes('A_ONLY');
        }),
      };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { gates: ['A_ONLY'], weights: { axis1: 1.0 } };
      const protoB = { gates: ['B_ONLY'], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 50);

      expect(result.gateOverlap.pOnlyRate).toBe(1);
      expect(result.gateOverlap.qOnlyRate).toBe(0);
      expect(result.gateOverlap.onBothRate).toBe(0);
    });

    it('returns correct qOnlyRate when only B passes', async () => {
      const gateChecker = {
        checkAllGatesPass: jest.fn((gates) => {
          return gates.includes('B_ONLY');
        }),
      };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { gates: ['A_ONLY'], weights: { axis1: 1.0 } };
      const protoB = { gates: ['B_ONLY'], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 50);

      expect(result.gateOverlap.qOnlyRate).toBe(1);
      expect(result.gateOverlap.pOnlyRate).toBe(0);
    });
  });

  // ==========================================================================
  // Intensity similarity tests
  // ==========================================================================
  describe('intensity similarity', () => {
    it('returns correlation ~1 for identical prototypes', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };

      // Same intensity for both
      const intensityCalc = {
        computeIntensity: jest.fn(() => 0.6),
      };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: intensityCalc,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      // Use varying states to get varying intensities
      const states = [];
      for (let i = 0; i < 100; i++) {
        states.push({
          current: { mood: { happiness: i }, sexual: { sex_excitation: i } },
          previous: { mood: { happiness: i }, sexual: { sex_excitation: i } },
          affectTraits: { affective_empathy: 50, cognitive_empathy: 50, harm_aversion: 50 },
        });
      }

      let callIdx = 0;
      intensityCalc.computeIntensity.mockImplementation(() => {
        const base = states[Math.floor(callIdx / 2) % states.length].current.mood.happiness / 100;
        callIdx++;
        return base;
      });

      const protoA = { gates: [], weights: { happiness: 1.0 } };
      const protoB = { gates: [], weights: { happiness: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 100);

      // Perfect correlation expected
      expect(result.intensity.pearsonCorrelation).toBeCloseTo(1.0, 5);
    });

    it('returns meanAbsDiff ~0 for identical prototypes', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };

      // Same intensity for both
      const intensityCalc = {
        computeIntensity: jest.fn(() => 0.5),
      };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: intensityCalc,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { gates: [], weights: { axis1: 1.0 } };
      const protoB = { gates: [], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 50);

      expect(result.intensity.meanAbsDiff).toBeCloseTo(0, 5);
    });

    it('computes dominanceP correctly when A always higher', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };

      let intensityCallCount = 0;
      const intensityCalc = {
        computeIntensity: jest.fn(() => {
          intensityCallCount++;
          // A returns 0.8, B returns 0.2
          return intensityCallCount % 2 === 1 ? 0.8 : 0.2;
        }),
      };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: intensityCalc,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: { ...mockConfig, dominanceDelta: 0.05 },
        logger: mockLogger,
      });

      const protoA = { gates: [], weights: { axis1: 1.0, id: 'A' } };
      const protoB = { gates: [], weights: { axis1: 1.0, id: 'B' } };

      const result = await evaluator.evaluate(protoA, protoB, 50);

      // A is always 0.8, B is always 0.2, diff is 0.6 > delta
      expect(result.intensity.dominanceP).toBe(1);
      expect(result.intensity.dominanceQ).toBe(0);
    });

    it('computes dominanceQ correctly when B always higher', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };

      let callCount = 0;
      const intensityCalc = {
        computeIntensity: jest.fn(() => {
          callCount++;
          // A returns 0.2, B returns 0.9
          return callCount % 2 === 1 ? 0.2 : 0.9;
        }),
      };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: intensityCalc,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: { ...mockConfig, dominanceDelta: 0.05 },
        logger: mockLogger,
      });

      const protoA = { gates: [], weights: { axis1: 1.0 } };
      const protoB = { gates: [], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 50);

      expect(result.intensity.dominanceQ).toBe(1);
      expect(result.intensity.dominanceP).toBe(0);
    });

    it('returns NaN correlation for no joint samples', async () => {
      // No samples where both pass
      let callCount = 0;
      const gateChecker = {
        checkAllGatesPass: jest.fn(() => {
          callCount++;
          return callCount % 2 === 1; // Alternating, so never both
        }),
      };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { gates: ['A'], weights: { axis1: 1.0 } };
      const protoB = { gates: ['B'], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 50);

      expect(Number.isNaN(result.intensity.pearsonCorrelation)).toBe(true);
      expect(Number.isNaN(result.intensity.meanAbsDiff)).toBe(true);
    });
  });

  // ==========================================================================
  // Divergence examples tests
  // ==========================================================================
  describe('divergence examples', () => {
    it('selects top K examples by absDiff', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };

      // Create intensities with varying differences
      let callCount = 0;
      const intensities = [
        [0.1, 0.2], // diff 0.1
        [0.5, 0.9], // diff 0.4
        [0.3, 0.35], // diff 0.05
        [0.2, 0.8], // diff 0.6 - should be in top 3
        [0.0, 0.1], // diff 0.1
        [0.4, 0.45], // diff 0.05
        [0.1, 0.9], // diff 0.8 - should be in top 3
        [0.6, 0.65], // diff 0.05
        [0.3, 0.9], // diff 0.6 - should be in top 3
        [0.5, 0.55], // diff 0.05
      ];

      const intensityCalc = {
        computeIntensity: jest.fn(() => {
          const sampleIdx = Math.floor(callCount / 2);
          const isA = callCount % 2 === 0;
          callCount++;
          const pair = intensities[sampleIdx % intensities.length];
          return isA ? pair[0] : pair[1];
        }),
      };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: intensityCalc,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: { ...mockConfig, divergenceExamplesK: 3 },
        logger: mockLogger,
      });

      const protoA = { gates: [], weights: { axis1: 1.0 } };
      const protoB = { gates: [], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 10);

      expect(result.divergenceExamples.length).toBeLessThanOrEqual(3);

      // Should be sorted descending by absDiff
      for (let i = 1; i < result.divergenceExamples.length; i++) {
        expect(result.divergenceExamples[i - 1].absDiff).toBeGreaterThanOrEqual(
          result.divergenceExamples[i].absDiff
        );
      }
    });

    it('includes context, intensityA, intensityB, absDiff in examples', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };

      let callCount = 0;
      const intensityCalc = {
        computeIntensity: jest.fn(() => {
          callCount++;
          return callCount % 2 === 1 ? 0.3 : 0.7;
        }),
      };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: intensityCalc,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { gates: [], weights: { axis1: 1.0 } };
      const protoB = { gates: [], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 10);

      expect(result.divergenceExamples.length).toBeGreaterThan(0);

      const example = result.divergenceExamples[0];
      expect(example).toHaveProperty('context');
      expect(example).toHaveProperty('intensityA');
      expect(example).toHaveProperty('intensityB');
      expect(example).toHaveProperty('absDiff');
      expect(typeof example.intensityA).toBe('number');
      expect(typeof example.intensityB).toBe('number');
      expect(typeof example.absDiff).toBe('number');
    });

    it('includes UI-compatible fields intensityDifference and contextSummary', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };

      let callCount = 0;
      const intensityCalc = {
        computeIntensity: jest.fn(() => {
          callCount++;
          return callCount % 2 === 1 ? 0.3 : 0.7;
        }),
      };

      // Context builder that returns moodAxes for contextSummary formatting
      const contextBuilder = {
        buildContext: jest.fn(() => ({
          moodAxes: {
            arousal: 0.75,
            valence: -0.3,
          },
        })),
      };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: intensityCalc,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      // Use prototypes with arousal and valence weights so they appear in contextSummary
      const protoA = { gates: [], weights: { arousal: 1.0, valence: 0.5 } };
      const protoB = { gates: [], weights: { arousal: 0.8, valence: 0.6 } };

      const result = await evaluator.evaluate(protoA, protoB, 10);

      expect(result.divergenceExamples.length).toBeGreaterThan(0);

      const example = result.divergenceExamples[0];

      // Verify UI-compatible fields exist
      expect(example).toHaveProperty('intensityDifference');
      expect(example).toHaveProperty('contextSummary');

      // intensityDifference should equal absDiff
      expect(example.intensityDifference).toBe(example.absDiff);

      // contextSummary should be a string
      expect(typeof example.contextSummary).toBe('string');

      // contextSummary should contain formatted values for relevant axes from prototype weights
      expect(example.contextSummary).toMatch(/arousal: 0\.75/);
    });

    it('produces stable examples with same random seed (deterministic inputs)', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };

      // Fixed state generator
      const fixedStates = Array(50).fill({
        current: { mood: { happiness: 50 }, sexual: { sex_excitation: 50 } },
        previous: { mood: { happiness: 40 }, sexual: { sex_excitation: 40 } },
        affectTraits: { affective_empathy: 50, cognitive_empathy: 50, harm_aversion: 50 },
      });

      let callCount1 = 0;
      const stateGen1 = {
        generate: jest.fn(() => fixedStates[callCount1++ % fixedStates.length]),
      };

      let intensityCall1 = 0;
      const intensityCalc1 = {
        computeIntensity: jest.fn(() => {
          intensityCall1++;
          return intensityCall1 % 2 === 1 ? 0.3 : 0.6;
        }),
      };

      const evaluator1 = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: intensityCalc1,
        randomStateGenerator: stateGen1,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      // Second evaluator with same setup
      let callCount2 = 0;
      const stateGen2 = {
        generate: jest.fn(() => fixedStates[callCount2++ % fixedStates.length]),
      };

      let intensityCall2 = 0;
      const intensityCalc2 = {
        computeIntensity: jest.fn(() => {
          intensityCall2++;
          return intensityCall2 % 2 === 1 ? 0.3 : 0.6;
        }),
      };

      const evaluator2 = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: intensityCalc2,
        randomStateGenerator: stateGen2,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { gates: [], weights: { axis1: 1.0 } };
      const protoB = { gates: [], weights: { axis1: 1.0 } };

      const result1 = await evaluator1.evaluate(protoA, protoB, 50);
      const result2 = await evaluator2.evaluate(protoA, protoB, 50);

      // Same number of divergence examples
      expect(result1.divergenceExamples.length).toBe(result2.divergenceExamples.length);

      // Same absDiff values
      for (let i = 0; i < result1.divergenceExamples.length; i++) {
        expect(result1.divergenceExamples[i].absDiff).toBeCloseTo(
          result2.divergenceExamples[i].absDiff,
          10
        );
      }
    });
  });

  // ==========================================================================
  // Progress callback tests
  // ==========================================================================
  describe('progress callback', () => {
    it('invokes onProgress during sampling', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };
      const onProgress = jest.fn();

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { gates: [], weights: { axis1: 1.0 } };
      const protoB = { gates: [], weights: { axis1: 1.0 } };

      // With CHUNK_SIZE=500, a 1200 sample run will call progress at 500, 1000, 1200
      await evaluator.evaluate(protoA, protoB, 1200, onProgress);

      expect(onProgress).toHaveBeenCalled();
      expect(onProgress.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('passes completed count and total to onProgress', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };
      const onProgress = jest.fn();

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { gates: [], weights: { axis1: 1.0 } };
      const protoB = { gates: [], weights: { axis1: 1.0 } };

      // Use a sample count larger than CHUNK_SIZE (500) to test chunked progress
      const sampleCount = 1000;
      await evaluator.evaluate(protoA, protoB, sampleCount, onProgress);

      // With CHUNK_SIZE=500, progress is called at 500 and 1000
      expect(onProgress.mock.calls.length).toBeGreaterThanOrEqual(2);

      // Check the first call (after first chunk of 500)
      const firstCall = onProgress.mock.calls[0];
      expect(firstCall[0]).toBe(500); // completed
      expect(firstCall[1]).toBe(1000); // total

      // Check that final call reports completion
      const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1];
      expect(lastCall[0]).toBe(1000); // completed
      expect(lastCall[1]).toBe(1000); // total
    });

    it('calls progress once for sample counts less than chunk size', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };
      const onProgress = jest.fn();

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { gates: [], weights: { axis1: 1.0 } };
      const protoB = { gates: [], weights: { axis1: 1.0 } };

      // 250 samples is less than CHUNK_SIZE (500), so processed in one chunk
      await evaluator.evaluate(protoA, protoB, 250, onProgress);

      // Should be called once at completion
      expect(onProgress).toHaveBeenCalledTimes(1);
      expect(onProgress).toHaveBeenCalledWith(250, 250);
    });
  });

  // ==========================================================================
  // Invariant tests
  // ==========================================================================
  describe('invariants', () => {
    it('all rates are in [0, 1]', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => Math.random() > 0.5) };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { gates: [], weights: { axis1: 1.0 } };
      const protoB = { gates: [], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 100);

      expect(result.gateOverlap.onEitherRate).toBeGreaterThanOrEqual(0);
      expect(result.gateOverlap.onEitherRate).toBeLessThanOrEqual(1);
      expect(result.gateOverlap.onBothRate).toBeGreaterThanOrEqual(0);
      expect(result.gateOverlap.onBothRate).toBeLessThanOrEqual(1);
      expect(result.gateOverlap.pOnlyRate).toBeGreaterThanOrEqual(0);
      expect(result.gateOverlap.pOnlyRate).toBeLessThanOrEqual(1);
      expect(result.gateOverlap.qOnlyRate).toBeGreaterThanOrEqual(0);
      expect(result.gateOverlap.qOnlyRate).toBeLessThanOrEqual(1);
    });

    it('correlation is in [-1, 1] or NaN', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };

      const intensityCalc = {
        computeIntensity: jest.fn(() => {
          return Math.random();
        }),
      };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: intensityCalc,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { gates: [], weights: { axis1: 1.0 } };
      const protoB = { gates: [], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 100);

      // Correlation must be NaN or in [-1, 1]
      const corr = result.intensity.pearsonCorrelation;
      const isValidCorrelation =
        Number.isNaN(corr) || (corr >= -1 && corr <= 1);
      expect(isValidCorrelation).toBe(true);
    });

    it('meanAbsDiff >= 0 or NaN', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { gates: [], weights: { axis1: 1.0 } };
      const protoB = { gates: [], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 50);

      // meanAbsDiff must be NaN or >= 0
      const meanDiff = result.intensity.meanAbsDiff;
      const isValidMeanAbsDiff = Number.isNaN(meanDiff) || meanDiff >= 0;
      expect(isValidMeanAbsDiff).toBe(true);
    });

    it('divergenceExamples.length <= config.divergenceExamplesK', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };
      const k = 3;

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: { ...mockConfig, divergenceExamplesK: k },
        logger: mockLogger,
      });

      const protoA = { gates: [], weights: { axis1: 1.0 } };
      const protoB = { gates: [], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 100);

      expect(result.divergenceExamples.length).toBeLessThanOrEqual(k);
    });

    it('for each example: absDiff === |intensityA - intensityB|', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };

      let callCount = 0;
      const intensityCalc = {
        computeIntensity: jest.fn(() => {
          callCount++;
          return callCount % 2 === 1 ? 0.3 : 0.7;
        }),
      };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: intensityCalc,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { gates: [], weights: { axis1: 1.0 } };
      const protoB = { gates: [], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 50);

      for (const example of result.divergenceExamples) {
        const expectedAbsDiff = Math.abs(example.intensityA - example.intensityB);
        expect(example.absDiff).toBeCloseTo(expectedAbsDiff, 10);
      }
    });
  });

  // ==========================================================================
  // Edge cases
  // ==========================================================================
  describe('edge cases', () => {
    it('handles zero sample count by using default from config', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: { ...mockConfig, sampleCountPerPair: 10 },
        logger: mockLogger,
      });

      const protoA = { gates: [], weights: { axis1: 1.0 } };
      const protoB = { gates: [], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 0);

      // Should use config default
      expect(mockRandomStateGenerator.generate).toHaveBeenCalledTimes(10);
      expect(result.gateOverlap.onEitherRate).toBeDefined();
    });

    it('handles negative sample count by using default from config', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: { ...mockConfig, sampleCountPerPair: 5 },
        logger: mockLogger,
      });

      const protoA = { gates: [], weights: { axis1: 1.0 } };
      const protoB = { gates: [], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, -10);

      expect(mockRandomStateGenerator.generate).toHaveBeenCalledTimes(5);
      expect(result.gateOverlap).toBeDefined();
    });

    it('handles prototype with no gates', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { weights: { axis1: 1.0 } }; // No gates property
      const protoB = { gates: [], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 10);

      expect(result.gateOverlap.onBothRate).toBe(1);
    });

    it('handles prototype with no weights', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };

      const intensityCalc = {
        computeIntensity: jest.fn(() => 0),
      };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: intensityCalc,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { gates: [] }; // No weights property
      const protoB = { gates: [], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 10);

      expect(result.intensity.meanAbsDiff).toBeDefined();
    });

    it('handles null onProgress callback gracefully', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { gates: [], weights: { axis1: 1.0 } };
      const protoB = { gates: [], weights: { axis1: 1.0 } };

      // Should not throw
      await expect(evaluator.evaluate(protoA, protoB, 50, null)).resolves.toBeDefined();
    });

    it('handles divergenceExamplesK of 0', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: { ...mockConfig, divergenceExamplesK: 0 },
        logger: mockLogger,
      });

      const protoA = { gates: [], weights: { axis1: 1.0 } };
      const protoB = { gates: [], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 50);

      expect(result.divergenceExamples.length).toBe(0);
    });
  });

  // ==========================================================================
  // Integration-style tests (uses mock services but tests full flow)
  // ==========================================================================
  describe('full evaluation flow', () => {
    it('computes complete metrics for varied prototype behaviors', async () => {
      // Setup: A passes 80% of time, B passes 60% of time
      let sampleIdx = 0;
      const gateChecker = {
        checkAllGatesPass: jest.fn((gates) => {
          const isA = gates.length === 0 || gates[0] === 'A';
          sampleIdx++;

          if (isA) {
            return sampleIdx % 5 !== 0; // 80% pass rate
          } else {
            return sampleIdx % 5 < 3; // 60% pass rate
          }
        }),
      };

      let intensityIdx = 0;
      const intensityCalc = {
        computeIntensity: jest.fn(() => {
          intensityIdx++;
          // Varying intensities
          return (intensityIdx % 10) / 10;
        }),
      };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: intensityCalc,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { gates: ['A'], weights: { axis1: 1.0 } };
      const protoB = { gates: ['B'], weights: { axis1: 0.8 } };

      const result = await evaluator.evaluate(protoA, protoB, 100);

      // Verify structure
      expect(result).toHaveProperty('gateOverlap');
      expect(result).toHaveProperty('intensity');
      expect(result).toHaveProperty('divergenceExamples');

      expect(result.gateOverlap).toHaveProperty('onEitherRate');
      expect(result.gateOverlap).toHaveProperty('onBothRate');
      expect(result.gateOverlap).toHaveProperty('pOnlyRate');
      expect(result.gateOverlap).toHaveProperty('qOnlyRate');

      expect(result.intensity).toHaveProperty('pearsonCorrelation');
      expect(result.intensity).toHaveProperty('meanAbsDiff');
      expect(result.intensity).toHaveProperty('dominanceP');
      expect(result.intensity).toHaveProperty('dominanceQ');

      // Debug logging should have been called
      expect(mockLogger.debug).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // formatContextSummary relevance filtering tests (bug fix verification)
  // ==========================================================================
  describe('formatContextSummary relevance filtering', () => {
    it('contextSummary only includes axes from prototype weights', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };

      let callCount = 0;
      const intensityCalc = {
        computeIntensity: jest.fn(() => {
          callCount++;
          return callCount % 2 === 1 ? 0.3 : 0.7;
        }),
      };

      // Context with sexualArousal, previousSexualArousal, AND mood axes
      const contextBuilder = {
        buildContext: jest.fn(() => ({
          sexualArousal: 0.95,
          previousSexualArousal: 0.90,
          moodAxes: {
            valence: 0.5,
            arousal: 0.6,
          },
        })),
      };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: intensityCalc,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      // Emotion prototypes with only mood weights - no sexual axes
      const protoA = { gates: [], weights: { valence: 0.8, arousal: 0.6 } };
      const protoB = { gates: [], weights: { valence: 0.7, arousal: 0.5 } };

      const result = await evaluator.evaluate(protoA, protoB, 10);

      expect(result.divergenceExamples.length).toBeGreaterThan(0);
      const example = result.divergenceExamples[0];

      // contextSummary should contain valence/arousal, NOT sexualArousal
      expect(example.contextSummary).toMatch(/valence/);
      expect(example.contextSummary).toMatch(/arousal/);
      expect(example.contextSummary).not.toMatch(/sexualArousal/);
      expect(example.contextSummary).not.toMatch(/previousSexualArousal/);
    });

    it('contextSummary includes gate axes even without weights', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };

      let callCount = 0;
      const intensityCalc = {
        computeIntensity: jest.fn(() => {
          callCount++;
          return callCount % 2 === 1 ? 0.3 : 0.7;
        }),
      };

      const contextBuilder = {
        buildContext: jest.fn(() => ({
          moodAxes: {
            threat: 0.15,
            valence: 0.4,
          },
        })),
      };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: intensityCalc,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      // Prototype A has threat gate but no threat weight
      const protoA = { gates: ['threat <= 0.20'], weights: { valence: 0.5 } };
      const protoB = { gates: [], weights: { valence: 0.6 } };

      const result = await evaluator.evaluate(protoA, protoB, 10);

      expect(result.divergenceExamples.length).toBeGreaterThan(0);
      const example = result.divergenceExamples[0];

      // threat should appear because it's a gate axis
      expect(example.contextSummary).toMatch(/threat/);
      expect(example.contextSummary).toMatch(/valence/);
    });

    it('contextSummary handles union of axes from both prototypes', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };

      let callCount = 0;
      const intensityCalc = {
        computeIntensity: jest.fn(() => {
          callCount++;
          return callCount % 2 === 1 ? 0.3 : 0.7;
        }),
      };

      const contextBuilder = {
        buildContext: jest.fn(() => ({
          moodAxes: {
            valence: 0.5,
            arousal: 0.6,
            engagement: 0.7,
            threat: 0.15,
          },
        })),
      };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: intensityCalc,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      // Different weights and gates between prototypes
      const protoA = { gates: ['arousal >= -0.20'], weights: { valence: 0.5 } };
      const protoB = { gates: ['threat <= 0.30'], weights: { engagement: 0.7 } };

      const result = await evaluator.evaluate(protoA, protoB, 10);

      expect(result.divergenceExamples.length).toBeGreaterThan(0);
      const example = result.divergenceExamples[0];

      // Summary can contain any of the four relevant axes (valence, arousal, engagement, threat)
      // At least some should appear (top 3 by absolute value)
      expect(example.contextSummary.length).toBeGreaterThan(0);
      expect(typeof example.contextSummary).toBe('string');
    });

    it('contextSummary excludes sexualArousal for emotion prototypes (bug fix verification)', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };

      let callCount = 0;
      const intensityCalc = {
        computeIntensity: jest.fn(() => {
          callCount++;
          return callCount % 2 === 1 ? 0.3 : 0.7;
        }),
      };

      // Context mimicking real ContextBuilder output with sexual state
      const contextBuilder = {
        buildContext: jest.fn(() => ({
          sexualArousal: 0.0,
          previousSexualArousal: 0.0,
          moodAxes: {
            valence: 0.2,
            arousal: 0.8,
            threat: 0.1,
          },
          sexualAxes: {
            sex_excitation: 0.3,
            sex_inhibition: 0.5,
          },
        })),
      };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: intensityCalc,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      // Emotion-like prototypes (rage vs wrath) - only mood weights
      const protoA = { gates: ['arousal >= 0.5'], weights: { valence: -0.8, arousal: 0.9 } };
      const protoB = { gates: ['arousal >= 0.6'], weights: { valence: -0.9, arousal: 0.85 } };

      const result = await evaluator.evaluate(protoA, protoB, 10);

      expect(result.divergenceExamples.length).toBeGreaterThan(0);
      const example = result.divergenceExamples[0];

      // THE BUG FIX: sexualArousal should NOT appear for emotion prototypes
      expect(example.contextSummary).not.toMatch(/sexualArousal/);
      expect(example.contextSummary).not.toMatch(/previousSexualArousal/);
      expect(example.contextSummary).not.toMatch(/sex_excitation/);
      expect(example.contextSummary).not.toMatch(/sex_inhibition/);

      // Should show mood axes instead
      expect(example.contextSummary).toMatch(/arousal/);
    });

    it('contextSummary includes sexual axes for sexual prototypes', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };

      let callCount = 0;
      const intensityCalc = {
        computeIntensity: jest.fn(() => {
          callCount++;
          return callCount % 2 === 1 ? 0.3 : 0.7;
        }),
      };

      const contextBuilder = {
        buildContext: jest.fn(() => ({
          sexualArousal: 0.8,
          moodAxes: {
            valence: 0.5,
          },
          sexualAxes: {
            sex_excitation: 0.7,
          },
        })),
      };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: intensityCalc,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      // Sexual prototypes with sexual_arousal weight
      const protoA = { gates: [], weights: { sexual_arousal: 0.9, valence: 0.3 } };
      const protoB = { gates: [], weights: { sexual_arousal: 0.8, valence: 0.2 } };

      const result = await evaluator.evaluate(protoA, protoB, 10);

      expect(result.divergenceExamples.length).toBeGreaterThan(0);
      const example = result.divergenceExamples[0];

      // Sexual axes should appear for sexual prototypes
      expect(example.contextSummary).toMatch(/sexual_arousal|valence/);
    });

    it('contextSummary handles empty weights gracefully', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };

      const intensityCalc = {
        computeIntensity: jest.fn(() => 0.5),
      };

      const contextBuilder = {
        buildContext: jest.fn(() => ({
          moodAxes: { valence: 0.5 },
        })),
      };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: intensityCalc,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      // Both prototypes have empty weights and no gates
      const protoA = { gates: [], weights: {} };
      const protoB = { gates: [], weights: {} };

      const result = await evaluator.evaluate(protoA, protoB, 10);

      // Should not throw, divergenceExamples should have empty contextSummary
      for (const example of result.divergenceExamples) {
        expect(example.contextSummary).toBe('');
      }
    });

    it('contextSummary handles unparseable gates gracefully', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };

      let callCount = 0;
      const intensityCalc = {
        computeIntensity: jest.fn(() => {
          callCount++;
          return callCount % 2 === 1 ? 0.3 : 0.7;
        }),
      };

      const contextBuilder = {
        buildContext: jest.fn(() => ({
          moodAxes: {
            valence: 0.5,
          },
        })),
      };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: intensityCalc,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      // Malformed gates that can't be parsed
      const protoA = { gates: ['invalid gate format', 'also bad'], weights: { valence: 0.5 } };
      const protoB = { gates: [], weights: { valence: 0.6 } };

      // Should not throw
      const result = await evaluator.evaluate(protoA, protoB, 10);

      expect(result.divergenceExamples.length).toBeGreaterThan(0);
      const example = result.divergenceExamples[0];

      // Should still include valence from weights
      expect(example.contextSummary).toMatch(/valence/);
    });
  });
});
