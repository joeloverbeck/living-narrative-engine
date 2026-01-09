/**
 * @file Unit tests for IntensityBoundsCalculator ceiling constraint handling
 * @description Tests that intensity bounds are calculated correctly when
 * ceiling constraints don't impose gate restrictions on axis intervals.
 *
 * Bug context: The static analyzer incorrectly reports jealousy max as ~0.48
 * when ChatGPT demonstrated jealousy can reach ~0.805. This test validates
 * that after fixing GateConstraintAnalyzer, the IntensityBoundsCalculator
 * correctly calculates achievable intensities.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import IntensityBoundsCalculator from '../../../../src/expressionDiagnostics/services/IntensityBoundsCalculator.js';
import GateConstraintAnalyzer from '../../../../src/expressionDiagnostics/services/GateConstraintAnalyzer.js';
import { AxisInterval } from '../../../../src/expressionDiagnostics/models/index.js';

describe('IntensityBoundsCalculator - Ceiling Constraint Integration', () => {
  let mockLogger;
  let mockDataRegistry;

  // Mock emotion prototypes matching real data
  const mockEmotionPrototypes = {
    entries: {
      jealousy: {
        weights: {
          threat: 0.6,
          arousal: 0.6,
          valence: -0.6,
          agency_control: -0.2,
          engagement: 0.4,
          self_evaluation: -0.25,
        },
        gates: ['threat >= 0.20', 'valence <= -0.05', 'engagement >= 0.15'],
      },
      freeze: {
        weights: {
          threat: 1.0,
          agency_control: -1.0,
          valence: -0.35,
          arousal: -0.15,
          engagement: 0.25,
        },
        gates: [
          'threat >= 0.35',
          'agency_control <= -0.30',
          'valence <= -0.05',
          'arousal >= -0.10',
          'arousal <= 0.40',
          'engagement >= 0.05',
        ],
      },
      panic: {
        weights: {
          threat: 1.0,
          arousal: 1.0,
          agency_control: -1.0,
          valence: -0.7,
          engagement: 0.55,
          future_expectancy: -0.35,
        },
        gates: [
          'threat >= 0.50',
          'arousal >= 0.55',
          'agency_control <= -0.10',
          'valence <= -0.15',
          'engagement >= 0.10',
        ],
      },
      rage: {
        weights: {
          valence: -0.9,
          arousal: 1.0,
          agency_control: 0.8,
          threat: 0.4,
        },
        gates: ['valence <= -0.25', 'arousal >= 0.25'],
      },
    },
  };

  const mockSexualPrototypes = {
    entries: {},
  };

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockDataRegistry = {
      get: jest.fn((category, lookupId) => {
        if (category === 'lookups') {
          if (lookupId === 'core:emotion_prototypes') {
            return mockEmotionPrototypes;
          }
          if (lookupId === 'core:sexual_prototypes') {
            return mockSexualPrototypes;
          }
        }
        return null;
      }),
    };
  });

  describe('Jealousy max intensity calculation', () => {
    it('should calculate jealousy max correctly without artificial ceiling constraints', () => {
      const calculator = new IntensityBoundsCalculator({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
      });

      // With unconstrained axes (default mood bounds [-1, 1])
      // jealousy weights: threat=0.6, arousal=0.6, valence=-0.6,
      //                   agency_control=-0.2, engagement=0.4, self_evaluation=-0.25
      // sumAbsWeights = 0.6 + 0.6 + 0.6 + 0.2 + 0.4 + 0.25 = 2.65
      // maxRawSum = 0.6*1 + 0.6*1 + (-0.6)*(-1) + (-0.2)*(-1) + 0.4*1 + (-0.25)*(-1)
      //           = 0.6 + 0.6 + 0.6 + 0.2 + 0.4 + 0.25 = 2.65
      // max = 2.65 / 2.65 = 1.0

      const result = calculator.calculateBounds('jealousy', 'emotion');

      expect(result.max).toBe(1.0);
    });

    it('should calculate jealousy max correctly with only jealousy gate constraints', () => {
      const calculator = new IntensityBoundsCalculator({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
      });

      // Jealousy gates: threat >= 0.20, valence <= -0.05, engagement >= 0.15
      // These constrain:
      //   threat: [0.20, 1.0]
      //   valence: [-1.0, -0.05]
      //   engagement: [0.15, 1.0]
      // Other axes remain at default [-1, 1] or [0, 1]

      const axisConstraints = new Map([
        ['threat', new AxisInterval(0.2, 1)],
        ['valence', new AxisInterval(-1, -0.05)],
        ['engagement', new AxisInterval(0.15, 1)],
      ]);

      const result = calculator.calculateBounds(
        'jealousy',
        'emotion',
        axisConstraints
      );

      // With these constraints, jealousy can still reach close to 1.0
      // because the constraints only set floors/ceilings on some axes
      // but don't severely limit the optimal values

      // Let's calculate:
      // threat=0.6: optimal = max(0.2, 1) = 1.0 → contribution = 0.6 * 1.0 = 0.6
      // arousal=0.6: unconstrained, optimal = 1.0 → contribution = 0.6 * 1.0 = 0.6
      // valence=-0.6: optimal = min(-1, -0.05) for negative weight = -1.0 → contribution = -0.6 * -1.0 = 0.6
      // agency_control=-0.2: unconstrained, optimal = -1.0 → contribution = -0.2 * -1.0 = 0.2
      // engagement=0.4: optimal = max(0.15, 1) = 1.0 → contribution = 0.4 * 1.0 = 0.4
      // self_evaluation=-0.25: unconstrained, optimal = -1.0 → contribution = -0.25 * -1.0 = 0.25
      // maxRawSum = 0.6 + 0.6 + 0.6 + 0.2 + 0.4 + 0.25 = 2.65
      // max = 2.65 / 2.65 = 1.0

      expect(result.max).toBe(1.0);
    });

    it('should NOT have jealousy max artificially limited by freeze gate constraints', () => {
      // This test verifies the bug fix:
      // If freeze's gates (including arousal <= 0.40) are incorrectly applied,
      // jealousy max would be limited because jealousy has arousal weight 0.6

      const calculator = new IntensityBoundsCalculator({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
      });

      // Bug scenario: freeze's gates are wrongly applied, constraining arousal <= 0.40
      // This would limit jealousy's max

      // First, let's show what the WRONG calculation would be:
      const wrongConstraints = new Map([
        ['threat', new AxisInterval(0.2, 1)], // from jealousy
        ['valence', new AxisInterval(-1, -0.05)], // from jealousy & freeze
        ['engagement', new AxisInterval(0.15, 1)], // from jealousy & freeze
        ['arousal', new AxisInterval(-0.1, 0.4)], // WRONGLY from freeze
        ['agency_control', new AxisInterval(-1, -0.3)], // from freeze
      ]);

      const wrongResult = calculator.calculateBounds(
        'jealousy',
        'emotion',
        wrongConstraints
      );

      // With arousal constrained to [-0.1, 0.4], jealousy max is limited:
      // arousal contribution = 0.6 * 0.4 = 0.24 instead of 0.6 * 1.0 = 0.6
      // This is approximately 0.36 less in raw sum
      // So max ≈ (2.65 - 0.36) / 2.65 ≈ 0.86

      // Actually let's calculate properly:
      // threat=0.6: optimal = 1.0 → 0.6
      // arousal=0.6: optimal = 0.4 (constrained) → 0.24
      // valence=-0.6: optimal = -1.0 → 0.6
      // agency_control=-0.2: optimal = -1.0 (constrained to [-1, -0.3]) → 0.2
      // engagement=0.4: optimal = 1.0 → 0.4
      // self_evaluation=-0.25: optimal = -1.0 → 0.25
      // maxRawSum = 0.6 + 0.24 + 0.6 + 0.2 + 0.4 + 0.25 = 2.29
      // max = 2.29 / 2.65 ≈ 0.864

      expect(wrongResult.max).toBeLessThan(0.9);

      // Now let's verify that with CORRECT constraints (no freeze gates),
      // jealousy max is higher
      const correctConstraints = new Map([
        ['threat', new AxisInterval(0.2, 1)], // from jealousy only
        ['valence', new AxisInterval(-1, -0.05)], // from jealousy only
        ['engagement', new AxisInterval(0.15, 1)], // from jealousy only
        // arousal and agency_control are NOT constrained by freeze
      ]);

      const correctResult = calculator.calculateBounds(
        'jealousy',
        'emotion',
        correctConstraints
      );

      // With correct constraints, jealousy max should be 1.0
      expect(correctResult.max).toBe(1.0);

      // The fix should result in max being significantly higher
      expect(correctResult.max).toBeGreaterThan(wrongResult.max);
    });
  });

  describe('Full expression analysis with ceiling constraints', () => {
    it('should report jealousy >= 0.55 as reachable when ceiling constraints are handled correctly', () => {
      const gateAnalyzer = new GateConstraintAnalyzer({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
      });

      const boundsCalculator = new IntensityBoundsCalculator({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
      });

      // Simplified flustered_jealousy pattern
      const expression = {
        id: 'test:flustered_jealousy',
        prerequisites: [
          {
            logic: {
              and: [
                { '<': [{ var: 'emotions.rage' }, 0.55] },
                { '>=': [{ var: 'emotions.jealousy' }, 0.55] },
                { '<=': [{ var: 'emotions.freeze' }, 0.55] },
                { '<=': [{ var: 'emotions.panic' }, 0.2] },
              ],
            },
          },
        ],
      };

      // Analyze gates
      const gateResult = gateAnalyzer.analyze(expression);

      // Analyze intensity bounds
      const thresholdIssues = boundsCalculator.analyzeExpression(
        expression,
        gateResult.axisIntervals
      );

      // Key assertion: jealousy >= 0.55 should be REACHABLE
      // If the bug is fixed, there should be no unreachable threshold issues
      const jealousyIssue = thresholdIssues.find(
        (issue) => issue.prototypeId === 'jealousy'
      );

      // The fix should make jealousy reachable
      expect(jealousyIssue).toBeUndefined();
    });

    it('should correctly calculate max possible for ChatGPT counterexample scenario', () => {
      const gateAnalyzer = new GateConstraintAnalyzer({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
      });

      const boundsCalculator = new IntensityBoundsCalculator({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
      });

      const expression = {
        id: 'test:chatgpt_scenario',
        prerequisites: [
          {
            logic: {
              and: [
                { '>=': [{ var: 'emotions.jealousy' }, 0.55] },
                { '<=': [{ var: 'emotions.panic' }, 0.2] },
                { '<=': [{ var: 'emotions.freeze' }, 0.55] },
                { '<': [{ var: 'emotions.rage' }, 0.55] },
              ],
            },
          },
        ],
      };

      const gateResult = gateAnalyzer.analyze(expression);
      const bounds = boundsCalculator.calculateBounds(
        'jealousy',
        'emotion',
        gateResult.axisIntervals
      );

      // ChatGPT showed jealousy can reach ~0.805 with:
      // threat=1.0, arousal=1.0, valence=-0.14, agency_control=-1.0,
      // engagement=1.0, self_evaluation=-1.0
      //
      // But max theoretical is higher (1.0 with valence=-1.0)
      // The key is that max should be >= 0.80, definitely not 0.48

      expect(bounds.max).toBeGreaterThanOrEqual(0.8);
    });
  });

  describe('Verify ChatGPT example calculation', () => {
    it('should validate jealousy intensity from specific axis values', () => {
      const calculator = new IntensityBoundsCalculator({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
      });

      // ChatGPT's example axis values (normalized):
      // threat=1.0, arousal=1.0, valence=-0.14, agency_control=-1.0,
      // engagement=1.0, self_evaluation=-1.0
      //
      // Manual calculation:
      // rawSum = 0.6*1.0 + 0.6*1.0 + (-0.6)*(-0.14) + (-0.2)*(-1.0) + 0.4*1.0 + (-0.25)*(-1.0)
      //        = 0.6 + 0.6 + 0.084 + 0.2 + 0.4 + 0.25
      //        = 2.134
      // sumAbsWeights = 2.65
      // intensity = 2.134 / 2.65 ≈ 0.805

      // Create constraints that exactly match ChatGPT's point
      // (a single point where all axes are set to their example values)
      const pointConstraints = new Map([
        ['threat', new AxisInterval(1.0, 1.0)],
        ['arousal', new AxisInterval(1.0, 1.0)],
        ['valence', new AxisInterval(-0.14, -0.14)],
        ['agency_control', new AxisInterval(-1.0, -1.0)],
        ['engagement', new AxisInterval(1.0, 1.0)],
        ['self_evaluation', new AxisInterval(-1.0, -1.0)],
      ]);

      const result = calculator.calculateBounds(
        'jealousy',
        'emotion',
        pointConstraints
      );

      // At this specific point, min = max = the intensity at that point
      expect(result.max).toBeCloseTo(0.805, 2);
      expect(result.min).toBeCloseTo(0.805, 2);
    });
  });
});
