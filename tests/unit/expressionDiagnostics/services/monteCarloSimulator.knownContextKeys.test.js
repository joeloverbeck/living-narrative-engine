/**
 * @file Unit tests for MonteCarloSimulator known context keys validation
 * @description Tests that the MonteCarloSimulator correctly recognizes all mood axes
 * and affect traits, including inhibitory_control and self_control.
 * These tests ensure the simulator's #buildKnownContextKeys() method uses the
 * centralized constants from moodAffectConstants.js.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import MonteCarloSimulator from '../../../../src/expressionDiagnostics/services/MonteCarloSimulator.js';
import EmotionCalculatorAdapter from '../../../../src/expressionDiagnostics/adapters/EmotionCalculatorAdapter.js';
import EmotionCalculatorService from '../../../../src/emotions/emotionCalculatorService.js';
import RandomStateGenerator from '../../../../src/expressionDiagnostics/services/RandomStateGenerator.js';
import {
  MOOD_AXES,
  AFFECT_TRAITS,
} from '../../../../src/constants/moodAffectConstants.js';

const buildEmotionCalculatorAdapter = (dataRegistry, logger) =>
  new EmotionCalculatorAdapter({
    emotionCalculatorService: new EmotionCalculatorService({
      dataRegistry,
      logger,
    }),
    logger,
  });

describe('MonteCarloSimulator - Known Context Keys Validation', () => {
  let mockLogger;
  let mockDataRegistry;
  let mockEmotionCalculatorAdapter;
  let randomStateGenerator;
  let simulator;

  // Mock emotion prototypes matching real data structure
  const mockEmotionPrototypes = {
    entries: {
      joy: {
        weights: { valence: 1.0 },
        gates: ['valence >= 0.35'],
      },
    },
  };

  // Mock sexual prototypes
  const mockSexualPrototypes = {
    entries: {
      aroused: {
        weights: { sex_excitation: 1.0 },
        gates: ['sex_excitation >= 0.40'],
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

  describe('inhibitory_control axis support', () => {
    it('should accept moodAxes.inhibitory_control as valid path', async () => {
      const expression = {
        id: 'test:inhibitory_control_moodAxes',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'moodAxes.inhibitory_control' }, 0] },
          },
        ],
      };

      const result = await simulator.simulate(expression, { sampleCount: 10 });

      expect(result.unseededVarWarnings).toEqual([]);
    });

    it('should accept mood.inhibitory_control as valid path', async () => {
      const expression = {
        id: 'test:inhibitory_control_mood',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'mood.inhibitory_control' }, -50] },
          },
        ],
      };

      const result = await simulator.simulate(expression, { sampleCount: 10 });

      expect(result.unseededVarWarnings).toEqual([]);
    });

    it('should accept previousMoodAxes.inhibitory_control as valid path', async () => {
      const expression = {
        id: 'test:inhibitory_control_previous',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'previousMoodAxes.inhibitory_control' }, -100] },
          },
        ],
      };

      const result = await simulator.simulate(expression, { sampleCount: 10 });

      expect(result.unseededVarWarnings).toEqual([]);
    });
  });

  describe('self_control trait support', () => {
    it('should accept affectTraits.self_control as valid path', async () => {
      const expression = {
        id: 'test:self_control_trait',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'affectTraits.self_control' }, 50] },
          },
        ],
      };

      const result = await simulator.simulate(expression, { sampleCount: 10 });

      expect(result.unseededVarWarnings).toEqual([]);
    });

    it('should not warn when self_control is used in complex logic', async () => {
      const expression = {
        id: 'test:self_control_complex',
        prerequisites: [
          {
            logic: {
              and: [
                { '>=': [{ var: 'affectTraits.self_control' }, 30] },
                { '<=': [{ var: 'affectTraits.self_control' }, 80] },
              ],
            },
          },
        ],
      };

      const result = await simulator.simulate(expression, { sampleCount: 10 });

      expect(result.unseededVarWarnings).toEqual([]);
    });
  });

  describe('all axes and traits completeness', () => {
    it('should accept all 9 mood axes without warnings', async () => {
      // Build logic that references all 9 mood axes
      const allAxesLogic = MOOD_AXES.map((axis) => ({
        '>=': [{ var: `moodAxes.${axis}` }, -100],
      }));

      const expression = {
        id: 'test:all_mood_axes',
        prerequisites: [
          {
            logic: { and: allAxesLogic },
          },
        ],
      };

      const result = await simulator.simulate(expression, { sampleCount: 10 });

      expect(result.unseededVarWarnings).toEqual([]);
    });

    it('should accept all 4 affect traits without warnings', async () => {
      // Build logic that references all 4 affect traits
      const allTraitsLogic = AFFECT_TRAITS.map((trait) => ({
        '>=': [{ var: `affectTraits.${trait}` }, 0],
      }));

      const expression = {
        id: 'test:all_affect_traits',
        prerequisites: [
          {
            logic: { and: allTraitsLogic },
          },
        ],
      };

      const result = await simulator.simulate(expression, { sampleCount: 10 });

      expect(result.unseededVarWarnings).toEqual([]);
    });

    it('should verify MOOD_AXES has 9 entries including inhibitory_control', () => {
      expect(MOOD_AXES).toHaveLength(9);
      expect(MOOD_AXES).toContain('inhibitory_control');
    });

    it('should verify AFFECT_TRAITS has 4 entries including self_control', () => {
      expect(AFFECT_TRAITS).toHaveLength(4);
      expect(AFFECT_TRAITS).toContain('self_control');
    });
  });

  describe('combined axes and traits usage', () => {
    it('should accept expression using both inhibitory_control and self_control', async () => {
      const expression = {
        id: 'test:combined_new_keys',
        prerequisites: [
          {
            logic: {
              and: [
                { '>=': [{ var: 'moodAxes.inhibitory_control' }, -25] },
                { '>=': [{ var: 'affectTraits.self_control' }, 40] },
              ],
            },
          },
        ],
      };

      const result = await simulator.simulate(expression, { sampleCount: 10 });

      expect(result.unseededVarWarnings).toEqual([]);
    });

    it('should accept expression mixing old and new keys', async () => {
      const expression = {
        id: 'test:mixed_old_new_keys',
        prerequisites: [
          {
            logic: {
              and: [
                { '>=': [{ var: 'moodAxes.valence' }, -50] },
                { '>=': [{ var: 'moodAxes.inhibitory_control' }, -25] },
                { '>=': [{ var: 'affectTraits.harm_aversion' }, 30] },
                { '>=': [{ var: 'affectTraits.self_control' }, 40] },
              ],
            },
          },
        ],
      };

      const result = await simulator.simulate(expression, { sampleCount: 10 });

      expect(result.unseededVarWarnings).toEqual([]);
    });
  });

  describe('invalid keys still produce warnings', () => {
    it('should still warn on unknown moodAxes key', async () => {
      const expression = {
        id: 'test:unknown_mood_axis',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'moodAxes.nonexistent_axis' }, 0] },
          },
        ],
      };

      const result = await simulator.simulate(expression, { sampleCount: 10 });

      expect(result.unseededVarWarnings).toHaveLength(1);
      expect(result.unseededVarWarnings[0].path).toBe(
        'moodAxes.nonexistent_axis'
      );
      expect(result.unseededVarWarnings[0].reason).toBe('unknown_nested_key');
    });

    it('should still warn on unknown affectTraits key', async () => {
      const expression = {
        id: 'test:unknown_affect_trait',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'affectTraits.made_up_trait' }, 50] },
          },
        ],
      };

      const result = await simulator.simulate(expression, { sampleCount: 10 });

      expect(result.unseededVarWarnings).toHaveLength(1);
      expect(result.unseededVarWarnings[0].path).toBe(
        'affectTraits.made_up_trait'
      );
      expect(result.unseededVarWarnings[0].reason).toBe('unknown_nested_key');
    });
  });
});
