/**
 * @file Unit tests for MonteCarloSimulator temporal state handling
 * @description Tests that verify the fix for the temporal state generation bug.
 *
 * BUG: The MonteCarloSimulator was always setting previousEmotions, previousMoodAxes,
 * and previousSexualStates to zero, making "persistence-style" expressions
 * (like lingering_guilt) mathematically impossible to trigger.
 *
 * FIX: Generate correlated previous/current state pairs where:
 * 1. previousMoodAxes is sampled randomly
 * 2. currentMoodAxes = previousMoodAxes + gaussian_delta (σ ≈ 10)
 * 3. previousEmotions is calculated from previousMoodAxes (not zeroed)
 * 4. Same pattern for sexual states
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import MonteCarloSimulator from '../../../../src/expressionDiagnostics/services/MonteCarloSimulator.js';
import EmotionCalculatorAdapter from '../../../../src/expressionDiagnostics/adapters/EmotionCalculatorAdapter.js';
import EmotionCalculatorService from '../../../../src/emotions/emotionCalculatorService.js';
import RandomStateGenerator from '../../../../src/expressionDiagnostics/services/RandomStateGenerator.js';

const buildEmotionCalculatorAdapter = (dataRegistry, logger) =>
  new EmotionCalculatorAdapter({
    emotionCalculatorService: new EmotionCalculatorService({
      dataRegistry,
      logger,
    }),
    logger,
  });

describe('MonteCarloSimulator - Temporal State Handling', () => {
  let mockLogger;
  let mockDataRegistry;
  let simulator;
  let mockEmotionCalculatorAdapter;
  let randomStateGenerator;

  // Mock emotion prototypes - must include guilt for persistence tests
  const mockEmotionPrototypes = {
    entries: {
      joy: {
        weights: { valence: 1.0, arousal: 0.5 },
        gates: [],
      },
      guilt: {
        // Guilt: negative self-evaluation, negative valence
        weights: { self_evaluation: -0.8, valence: -0.5 },
        gates: [],
      },
      fear: {
        weights: { threat: 1.0, arousal: 0.8 },
        gates: [],
      },
      confidence: {
        weights: { agency_control: 0.8, threat: -0.6 },
        gates: [],
      },
    },
  };

  // Mock sexual prototypes
  const mockSexualPrototypes = {
    entries: {
      aroused: {
        weights: { sexual_arousal: 1.0 },
        gates: [],
      },
      inhibited: {
        weights: { sex_inhibition: 1.0 },
        gates: [],
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

    mockEmotionCalculatorAdapter = buildEmotionCalculatorAdapter(
      mockDataRegistry,
      mockLogger
    );
    randomStateGenerator = new RandomStateGenerator({ logger: mockLogger });

    simulator = new MonteCarloSimulator({
      dataRegistry: mockDataRegistry,
      logger: mockLogger,
      emotionCalculatorAdapter: mockEmotionCalculatorAdapter,
      randomStateGenerator,
    });
  });

  describe('Persistence Expression Support', () => {
    it('should have non-zero trigger rate for expression requiring previousEmotions threshold', async () => {
      // This is the core test for the bug fix.
      // Expression requires: emotions.joy >= 0.3 AND previousEmotions.joy >= 0.15
      // With the bug (zeroed previous), this would NEVER trigger.
      // With the fix (correlated previous), this should trigger sometimes.
      const persistenceExpression = {
        id: 'test:persistence_previous_threshold',
        prerequisites: [
          {
            logic: {
              and: [
                { '>=': [{ var: 'emotions.joy' }, 0.3] },
                { '>=': [{ var: 'previousEmotions.joy' }, 0.15] },
              ],
            },
          },
        ],
      };

      const result = await simulator.simulate(persistenceExpression, {
        sampleCount: 2000,
      });

      // With correlated temporal state, both current AND previous joy
      // will sometimes be high enough to trigger
      expect(result.triggerRate).toBeGreaterThan(0);
    });

    it('should support delta constraints (small emotion changes)', async () => {
      // Expression like lingering_guilt: requires small delta between current and previous
      // |emotions.guilt - previousEmotions.guilt| <= 0.12
      // With zeroed previous, this only triggers if guilt is in [0, 0.12]
      // With correlated previous, this triggers when guilt is stable (small changes)
      const deltaConstraintExpression = {
        id: 'test:delta_constraint',
        prerequisites: [
          {
            logic: {
              and: [
                // Current guilt in reasonable range
                { '>=': [{ var: 'emotions.guilt' }, 0.2] },
                { '<=': [{ var: 'emotions.guilt' }, 0.8] },
                // Previous guilt was also present
                { '>=': [{ var: 'previousEmotions.guilt' }, 0.15] },
                // Small change (delta <= 0.12)
                {
                  '<=': [
                    {
                      '-': [
                        { var: 'emotions.guilt' },
                        { var: 'previousEmotions.guilt' },
                      ],
                    },
                    0.12,
                  ],
                },
                // Small change (delta >= -0.12)
                {
                  '>=': [
                    {
                      '-': [
                        { var: 'emotions.guilt' },
                        { var: 'previousEmotions.guilt' },
                      ],
                    },
                    -0.12,
                  ],
                },
              ],
            },
          },
        ],
      };

      const result = await simulator.simulate(deltaConstraintExpression, {
        sampleCount: 3000,
      });

      // With correlated states, the delta between previous and current
      // is typically small (controlled by sigma), so this should trigger
      expect(result.triggerRate).toBeGreaterThan(0);
    });

    it('should support previousMoodAxes comparisons', async () => {
      // Expression checking mood axis change
      const moodChangeExpression = {
        id: 'test:mood_axes_change',
        prerequisites: [
          {
            logic: {
              and: [
                // Current valence is positive
                { '>=': [{ var: 'moodAxes.valence' }, 0] },
                // Previous valence was also positive (or near)
                { '>=': [{ var: 'previousMoodAxes.valence' }, -20] },
              ],
            },
          },
        ],
      };

      const result = await simulator.simulate(moodChangeExpression, {
        sampleCount: 2000,
      });

      // With correlated mood axes, both conditions can be true
      expect(result.triggerRate).toBeGreaterThan(0);
    });

    it('should support previousSexualStates comparisons', async () => {
      const sexualPersistenceExpression = {
        id: 'test:sexual_persistence',
        prerequisites: [
          {
            logic: {
              and: [
                { '>=': [{ var: 'sexualStates.aroused' }, 0.2] },
                { '>=': [{ var: 'previousSexualStates.aroused' }, 0.1] },
              ],
            },
          },
        ],
      };

      const result = await simulator.simulate(sexualPersistenceExpression, {
        sampleCount: 2000,
      });

      expect(result.triggerRate).toBeGreaterThan(0);
    });
  });

  describe('Backward Compatibility', () => {
    it('should still work for simple expressions without temporal requirements', async () => {
      const simpleExpression = {
        id: 'test:simple_no_temporal',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'emotions.joy' }, 0.3] },
          },
        ],
      };

      const result = await simulator.simulate(simpleExpression, {
        sampleCount: 1000,
      });

      // Should still trigger as before
      expect(result.triggerRate).toBeGreaterThan(0);
    });

    it('should still return triggerRate of 1.0 for expressions with no prerequisites', async () => {
      const alwaysTriggerExpression = {
        id: 'test:always_trigger',
        prerequisites: [],
      };

      const result = await simulator.simulate(alwaysTriggerExpression, {
        sampleCount: 100,
      });

      expect(result.triggerRate).toBe(1);
    });

    it('should still handle moodAxes comparisons correctly', async () => {
      const moodExpression = {
        id: 'test:mood_only',
        prerequisites: [
          {
            logic: {
              and: [
                { '>=': [{ var: 'moodAxes.valence' }, 0] },
                { '<=': [{ var: 'moodAxes.arousal' }, 50] },
              ],
            },
          },
        ],
      };

      const result = await simulator.simulate(moodExpression, {
        sampleCount: 1000,
      });

      // With uniform distribution over [-100, 100]:
      // valence >= 0: ~50%, arousal <= 50: ~75%
      // Combined: ~37.5%
      expect(result.triggerRate).toBeGreaterThan(0.2);
    });
  });

  describe('Temporal Correlation Properties', () => {
    it('should produce previousEmotions that can reach moderate values', async () => {
      // If previousEmotions can reach 0.3+, this should trigger sometimes
      const highPreviousExpression = {
        id: 'test:high_previous',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'previousEmotions.joy' }, 0.3] },
          },
        ],
      };

      const result = await simulator.simulate(highPreviousExpression, {
        sampleCount: 2000,
      });

      // previousEmotions is now calculated from previousMoodAxes,
      // so it should be able to reach moderate values
      expect(result.triggerRate).toBeGreaterThan(0);
    });

    it('should have deltas centered around zero', async () => {
      // Expression that checks if delta is near zero (both positive and negative small deltas)
      // This verifies the Gaussian delta is centered properly
      const nearZeroDeltaExpression = {
        id: 'test:near_zero_delta',
        prerequisites: [
          {
            logic: {
              and: [
                // Delta between -5 and +5 for mood axes (on [-100, 100] scale)
                {
                  '<=': [
                    {
                      '-': [
                        { var: 'moodAxes.valence' },
                        { var: 'previousMoodAxes.valence' },
                      ],
                    },
                    15,
                  ],
                },
                {
                  '>=': [
                    {
                      '-': [
                        { var: 'moodAxes.valence' },
                        { var: 'previousMoodAxes.valence' },
                      ],
                    },
                    -15,
                  ],
                },
              ],
            },
          },
        ],
      };

      const result = await simulator.simulate(nearZeroDeltaExpression, {
        sampleCount: 2000,
        samplingMode: 'dynamic', // Test Gaussian delta behavior (coupled sampling)
      });

      // With σ=15, ~68% of deltas should be within ±15, so this should trigger very often
      // This should trigger very often (>70% of samples)
      expect(result.triggerRate).toBeGreaterThan(0.6);
    });

    it('should sometimes have large deltas (tails of Gaussian)', async () => {
      // Expression checking for moderate delta (outside ±10 but within ±30)
      const moderateDeltaExpression = {
        id: 'test:moderate_delta',
        prerequisites: [
          {
            logic: {
              or: [
                // Delta > 15 (positive swing)
                {
                  '>': [
                    {
                      '-': [
                        { var: 'moodAxes.valence' },
                        { var: 'previousMoodAxes.valence' },
                      ],
                    },
                    15,
                  ],
                },
                // Delta < -15 (negative swing)
                {
                  '<': [
                    {
                      '-': [
                        { var: 'moodAxes.valence' },
                        { var: 'previousMoodAxes.valence' },
                      ],
                    },
                    -15,
                  ],
                },
              ],
            },
          },
        ],
      };

      const result = await simulator.simulate(moderateDeltaExpression, {
        sampleCount: 2000,
        samplingMode: 'dynamic', // Test Gaussian delta behavior (coupled sampling)
      });

      // With σ=15, deltas >15 or <-15 should occur ~32% of time (tails)
      // But also need to account for clamping at boundaries
      expect(result.triggerRate).toBeGreaterThan(0.05);
      expect(result.triggerRate).toBeLessThan(0.5);
    });

    it('should allow gate boundary crossing with increased sigma', async () => {
      // This test verifies the fix for expressions like seductive_confidence
      // that require crossing a gate threshold (e.g., previous < 0.5, current >= 0.5).
      // With the original σ=8 for sexual states, this was mathematically near-impossible.
      // With σ=12, crossing probability increases to ~8-10%.
      //
      // We use a mock sexual_confidence prototype that has a simple gate.
      // The expression requires:
      // 1. previousSexualStates.aroused < 0.5 (below threshold)
      // 2. sexualStates.aroused >= 0.5 (crossed threshold)
      const crossingExpression = {
        id: 'gate_crossing_test',
        prerequisites: [
          {
            logic: {
              and: [
                { '<': [{ var: 'previousSexualStates.aroused' }, 0.5] },
                { '>=': [{ var: 'sexualStates.aroused' }, 0.5] },
              ],
            },
          },
        ],
      };

      const result = await simulator.simulate(crossingExpression, {
        sampleCount: 5000,
      });

      // With σ=12, crossing a 0.5 boundary should be achievable (>1% trigger rate).
      // The increased sigma enables sufficient variance in the delta to cross gates.
      expect(result.triggerRate).toBeGreaterThan(0.01);
    });
  });

  describe('Lingering Guilt Pattern (Real Expression Pattern)', () => {
    it('should support lingering_guilt-like expression pattern', async () => {
      // Simplified version of the actual lingering_guilt.expression.json
      // This is the pattern that was impossible with zeroed previous state
      const lingeringGuiltPattern = {
        id: 'test:lingering_guilt_pattern',
        prerequisites: [
          {
            logic: {
              and: [
                // Current guilt in moderate range
                { '>=': [{ var: 'emotions.guilt' }, 0.3] },
                { '<=': [{ var: 'emotions.guilt' }, 0.75] },
                // Previous guilt was already present (THE KEY CONSTRAINT)
                { '>=': [{ var: 'previousEmotions.guilt' }, 0.18] },
                // Small change - not spiking (delta <= 0.08)
                {
                  '<=': [
                    {
                      '-': [
                        { var: 'emotions.guilt' },
                        { var: 'previousEmotions.guilt' },
                      ],
                    },
                    0.08,
                  ],
                },
                // Small change - not dropping (delta >= -0.08)
                {
                  '>=': [
                    {
                      '-': [
                        { var: 'emotions.guilt' },
                        { var: 'previousEmotions.guilt' },
                      ],
                    },
                    -0.08,
                  ],
                },
              ],
            },
          },
        ],
      };

      const result = await simulator.simulate(lingeringGuiltPattern, {
        sampleCount: 5000,
      });

      // With the fix, this should now be possible to trigger:
      // - previousEmotions.guilt can reach 0.18+ (calculated from previousMoodAxes)
      // - currentEmotions.guilt can be in [0.3, 0.75]
      // - delta between them can be within ±0.08 due to correlated states
      expect(result.triggerRate).toBeGreaterThan(0);
    });
  });

  describe('Statistical Properties', () => {
    it('should provide consistent results across multiple runs', async () => {
      const testExpression = {
        id: 'test:consistency',
        prerequisites: [
          {
            logic: {
              and: [
                { '>=': [{ var: 'emotions.joy' }, 0.3] },
                { '>=': [{ var: 'previousEmotions.joy' }, 0.2] },
              ],
            },
          },
        ],
      };

      // Run simulation multiple times
      const results = [];
      for (let i = 0; i < 5; i++) {
        const result = await simulator.simulate(testExpression, {
          sampleCount: 2000,
        });
        results.push(result.triggerRate);
      }

      // All results should be in a reasonable range (not wildly different)
      // Due to random sampling, some variation is expected
      const avg = results.reduce((a, b) => a + b) / results.length;
      for (const rate of results) {
        // Each result should be within 50% of average (generous margin for randomness)
        expect(Math.abs(rate - avg)).toBeLessThan(avg * 0.5 + 0.05);
      }
    });

    it('should respect confidence interval properties', async () => {
      const testExpression = {
        id: 'test:ci_with_temporal',
        prerequisites: [
          {
            logic: {
              and: [
                { '>=': [{ var: 'emotions.guilt' }, 0.25] },
                { '>=': [{ var: 'previousEmotions.guilt' }, 0.15] },
              ],
            },
          },
        ],
      };

      const result = await simulator.simulate(testExpression, {
        sampleCount: 2000,
      });

      // CI should be valid
      expect(result.confidenceInterval.low).toBeGreaterThanOrEqual(0);
      expect(result.confidenceInterval.high).toBeLessThanOrEqual(1);
      expect(result.confidenceInterval.low).toBeLessThanOrEqual(
        result.confidenceInterval.high
      );

      // Trigger rate should be within CI
      expect(result.triggerRate).toBeGreaterThanOrEqual(
        result.confidenceInterval.low
      );
      expect(result.triggerRate).toBeLessThanOrEqual(
        result.confidenceInterval.high
      );
    });
  });

  describe('Temporal Context Shape', () => {
    const assertInRange = (value, min, max) => {
      expect(typeof value).toBe('number');
      expect(value).toBeGreaterThanOrEqual(min);
      expect(value).toBeLessThanOrEqual(max);
    };

    it('should store previousEmotions for all prototypes with normalized values', async () => {
      const expression = {
        id: 'test:context_previous_emotions',
        prerequisites: [],
      };

      const result = await simulator.simulate(expression, {
        sampleCount: 20,
        storeSamplesForSensitivity: true,
        sensitivitySampleLimit: 5,
      });

      expect(result.storedContexts.length).toBeGreaterThan(0);
      const emotionKeys = Object.keys(mockEmotionPrototypes.entries);
      for (const context of result.storedContexts) {
        for (const key of emotionKeys) {
          expect(context.previousEmotions).toHaveProperty(key);
          assertInRange(context.previousEmotions[key], 0, 1);
        }
      }
    });

    it('should store previousSexualStates for all prototypes with normalized values', async () => {
      const expression = {
        id: 'test:context_previous_sexual',
        prerequisites: [],
      };

      const result = await simulator.simulate(expression, {
        sampleCount: 20,
        storeSamplesForSensitivity: true,
        sensitivitySampleLimit: 5,
      });

      expect(result.storedContexts.length).toBeGreaterThan(0);
      const sexualKeys = Object.keys(mockSexualPrototypes.entries);
      for (const context of result.storedContexts) {
        for (const key of sexualKeys) {
          expect(context.previousSexualStates).toHaveProperty(key);
          assertInRange(context.previousSexualStates[key], 0, 1);
        }
      }
    });

    it('should expose previousMoodAxes in raw [-100, 100] range', async () => {
      const expression = {
        id: 'test:context_previous_mood_axes',
        prerequisites: [],
      };

      const result = await simulator.simulate(expression, {
        sampleCount: 20,
        storeSamplesForSensitivity: true,
        sensitivitySampleLimit: 5,
      });

      expect(result.storedContexts.length).toBeGreaterThan(0);
      for (const context of result.storedContexts) {
        for (const value of Object.values(context.previousMoodAxes)) {
          assertInRange(value, -100, 100);
        }
      }
    });
  });
});
