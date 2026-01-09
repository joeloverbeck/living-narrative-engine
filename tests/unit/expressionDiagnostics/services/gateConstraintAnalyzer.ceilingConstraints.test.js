/**
 * @file Unit tests for GateConstraintAnalyzer ceiling constraint handling
 * @description Tests that ceiling constraints (<=, <) on emotions don't impose
 * gate restrictions on axis intervals, because gate failure trivially satisfies
 * ceiling constraints (emotion = 0 satisfies emotion <= X for any positive X).
 *
 * Bug context: ChatGPT identified that the static analyzer incorrectly reports
 * jealousy max as ~0.48 when in fact jealousy >= 0.55 should be reachable.
 * The root cause is that the analyzer applies gate constraints from emotions
 * that have ceiling constraints, but ceiling constraints can be satisfied by
 * gate failure (emotion = 0).
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GateConstraintAnalyzer from '../../../../src/expressionDiagnostics/services/GateConstraintAnalyzer.js';

describe('GateConstraintAnalyzer - Ceiling Constraint Handling', () => {
  let mockLogger;
  let mockDataRegistry;

  // Mock emotion prototypes matching the real bug scenario
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
          'arousal <= 0.40', // This ceiling gate limits arousal when applied
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
      anxiety: {
        weights: {
          threat: 0.8,
          arousal: 0.6,
          future_expectancy: -0.4,
        },
        gates: ['threat >= 0.20', 'agency_control <= 0.20'],
      },
    },
  };

  // Mock sexual prototypes
  const mockSexualPrototypes = {
    entries: {
      romantic_yearning: {
        weights: { sex_excitation: 0.5, engagement: 0.3 },
        gates: ['sex_excitation >= 0.20'],
      },
    },
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

  describe('Ceiling constraints should not impose gate restrictions', () => {
    let analyzer;

    beforeEach(() => {
      analyzer = new GateConstraintAnalyzer({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
      });
    });

    it('should NOT apply gates from emotions with only ceiling constraints', () => {
      // Expression has only `panic <= 0.2` - a ceiling constraint
      // Since gate failure makes panic = 0, which satisfies panic <= 0.2,
      // the panic gates should NOT be applied to constrain axis intervals
      const expression = {
        id: 'test:ceiling_only',
        prerequisites: [
          {
            logic: {
              and: [
                { '<=': [{ var: 'emotions.panic' }, 0.2] },
                { '>=': [{ var: 'emotions.jealousy' }, 0.55] },
              ],
            },
          },
        ],
      };

      const result = analyzer.analyze(expression);

      // Panic's gates should NOT be applied (ceiling constraint)
      // Only jealousy's gates should be applied
      expect(result.hasConflict).toBe(false);

      // The arousal axis should NOT be constrained by panic's gate (arousal >= 0.55)
      // It should only have jealousy's constraints or be at default bounds
      // Jealousy doesn't have an arousal gate, so arousal should not be in axisIntervals
      // (only axes with gate constraints are added)
      const arousalInterval = result.axisIntervals.get('arousal');
      // If arousal is not set, it means no constraints were applied (correct behavior)
      // If arousal IS set, it shouldn't require arousal >= 0.55 from panic
      expect(arousalInterval === undefined || arousalInterval.min < 0.55).toBe(
        true
      );
    });

    it('should NOT apply gates when emotion has both floor and ceiling constraints if ceiling allows gate failure', () => {
      // This is the flustered_jealousy scenario:
      // - `freeze >= 0.14` (floor constraint - would normally extract freeze)
      // - `freeze <= 0.55` (ceiling constraint - satisfied by freeze = 0)
      //
      // Since freeze <= 0.55 is satisfied when freeze = 0 (gate failure),
      // the floor constraint should NOT cause freeze's gates to be applied
      const expression = {
        id: 'test:floor_and_ceiling',
        prerequisites: [
          {
            logic: {
              and: [
                { '>=': [{ var: 'emotions.jealousy' }, 0.55] },
                { '<=': [{ var: 'emotions.freeze' }, 0.55] },
                { '>=': [{ var: 'emotions.freeze' }, 0.14] },
              ],
            },
          },
        ],
      };

      const result = analyzer.analyze(expression);

      // Freeze's gates should NOT be applied because the ceiling constraint
      // can be satisfied by gate failure (freeze = 0)
      expect(result.hasConflict).toBe(false);

      // The arousal axis should NOT have freeze's ceiling gate (arousal <= 0.40)
      const arousalInterval = result.axisIntervals.get('arousal');
      // If arousal is not set, freeze's gates weren't applied (correct behavior)
      // If arousal IS set, it should allow values > 0.40 (not limited by freeze's gate)
      expect(arousalInterval === undefined || arousalInterval.max > 0.4).toBe(
        true
      );
    });

    it('should still apply gates from floor constraints without ceiling constraints', () => {
      // When there's only a floor constraint and no ceiling, gates should apply
      const expression = {
        id: 'test:floor_only',
        prerequisites: [
          {
            logic: {
              and: [
                { '>=': [{ var: 'emotions.jealousy' }, 0.55] },
                { '>=': [{ var: 'emotions.anxiety' }, 0.30] },
              ],
            },
          },
        ],
      };

      const result = analyzer.analyze(expression);

      // Both jealousy and anxiety gates should be applied
      // Anxiety has gate: threat >= 0.20 and agency_control <= 0.20
      const threatInterval = result.axisIntervals.get('threat');
      expect(threatInterval).toBeDefined();
      // Should be constrained by both jealousy (>= 0.20) and anxiety (>= 0.20)
      expect(threatInterval.min).toBeGreaterThanOrEqual(0.2);
    });

    it('should handle the flustered_jealousy expression pattern correctly', () => {
      // Simplified version of flustered_jealousy.expression.json pattern
      // Key constraints:
      // - jealousy >= 0.45 (floor)
      // - freeze <= 0.55 (ceiling)
      // - panic <= 0.2 (ceiling)
      // - OR branch with freeze >= 0.14
      const expression = {
        id: 'test:flustered_jealousy_simplified',
        prerequisites: [
          {
            logic: {
              and: [
                { '<': [{ var: 'emotions.rage' }, 0.55] },
                { '>=': [{ var: 'emotions.jealousy' }, 0.45] },
                { '<=': [{ var: 'emotions.freeze' }, 0.55] },
                {
                  or: [
                    { '>=': [{ var: 'emotions.freeze' }, 0.14] },
                    { '>=': [{ var: 'emotions.anxiety' }, 0.25] },
                  ],
                },
                { '<=': [{ var: 'emotions.panic' }, 0.2] },
              ],
            },
          },
        ],
      };

      const result = analyzer.analyze(expression);

      // Should not have conflicts
      expect(result.hasConflict).toBe(false);

      // The arousal axis should NOT be constrained by freeze's gate (arousal <= 0.40)
      // because freeze has a ceiling constraint that's satisfied by gate failure
      const arousalInterval = result.axisIntervals.get('arousal');

      // Critical assertion: arousal should be able to reach 1.0
      // If freeze's gates are incorrectly applied, arousal.max would be <= 0.40
      // If arousal isn't constrained at all, that's also correct behavior
      expect(arousalInterval === undefined || arousalInterval.max === 1).toBe(
        true
      );
    });
  });

  describe('ChatGPT counterexample validation', () => {
    let analyzer;

    beforeEach(() => {
      analyzer = new GateConstraintAnalyzer({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
      });
    });

    it('should allow axis values from ChatGPT counterexample', () => {
      // ChatGPT's counterexample showed these axis values are valid:
      // threat = 1.0, arousal = 1.0, valence = -0.14, agency_control = -1.0
      // engagement = 1.0, self_evaluation = -1.0
      //
      // With these values:
      // - jealousy ≈ 0.805 ✓
      // - panic = 0 (valence gate fails: -0.14 > -0.15) ✓
      // - freeze = 0 (arousal gate fails: 1.0 > 0.40) ✓
      //
      // The analyzer should NOT constrain arousal to <= 0.40 from freeze's gates

      const expression = {
        id: 'test:chatgpt_counterexample',
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

      const result = analyzer.analyze(expression);

      expect(result.hasConflict).toBe(false);

      // The key insight: arousal should NOT be limited by freeze's gate
      // because freeze = 0 (gate failure) satisfies freeze <= 0.55
      const arousalInterval = result.axisIntervals.get('arousal');

      // If the bug is fixed, arousal can reach 1.0
      // If the bug exists, arousal would be limited to 0.40
      // If arousal isn't constrained at all, that's also correct behavior
      expect(arousalInterval === undefined || arousalInterval.max === 1).toBe(
        true
      );

      // Valence should NOT be limited to <= -0.15 by panic's gate
      // because panic = 0 (gate failure) satisfies panic <= 0.2
      const valenceInterval = result.axisIntervals.get('valence');
      // If valence isn't constrained at all, that's also correct behavior
      // If valence IS constrained, it should allow values like -0.14
      expect(
        valenceInterval === undefined || valenceInterval.max > -0.15
      ).toBe(true);
    });
  });

  describe('Ceiling constraint with < operator', () => {
    let analyzer;

    beforeEach(() => {
      analyzer = new GateConstraintAnalyzer({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
      });
    });

    it('should NOT apply gates from emotions with < ceiling constraints', () => {
      // `rage < 0.55` is a ceiling constraint
      // Gate failure makes rage = 0, which satisfies rage < 0.55
      const expression = {
        id: 'test:less_than_ceiling',
        prerequisites: [
          {
            logic: {
              and: [
                { '<': [{ var: 'emotions.rage' }, 0.55] },
                { '>=': [{ var: 'emotions.jealousy' }, 0.55] },
              ],
            },
          },
        ],
      };

      const result = analyzer.analyze(expression);

      expect(result.hasConflict).toBe(false);

      // Rage's gates should NOT be applied
      // Rage has gate: arousal >= 0.25, but that shouldn't constrain our intervals
      const arousalInterval = result.axisIntervals.get('arousal');
      // If rage's gates were incorrectly applied, arousal.min would be >= 0.25
      // But since rage < 0.55 is a ceiling, rage's gates shouldn't apply
      // If arousal isn't constrained at all, that's also correct behavior
      expect(arousalInterval === undefined || arousalInterval.min < 0.25).toBe(
        true
      );
    });
  });

  describe('Edge cases', () => {
    let analyzer;

    beforeEach(() => {
      analyzer = new GateConstraintAnalyzer({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
      });
    });

    it('should handle emotion with ceiling constraint at 0', () => {
      // emotion <= 0 means emotion must be exactly 0, which is gate failure
      const expression = {
        id: 'test:ceiling_at_zero',
        prerequisites: [
          {
            logic: {
              and: [
                { '<=': [{ var: 'emotions.panic' }, 0] },
                { '>=': [{ var: 'emotions.jealousy' }, 0.55] },
              ],
            },
          },
        ],
      };

      const result = analyzer.analyze(expression);

      // panic <= 0 requires gate failure, so panic's gates shouldn't apply
      expect(result.hasConflict).toBe(false);
    });

    it('should handle multiple ceiling constraints on different emotions', () => {
      const expression = {
        id: 'test:multiple_ceilings',
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

      const result = analyzer.analyze(expression);

      expect(result.hasConflict).toBe(false);

      // None of panic, freeze, or rage gates should be applied
      // Only jealousy's gates should constrain the intervals
    });
  });
});
