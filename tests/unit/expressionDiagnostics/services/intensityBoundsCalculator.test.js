/**
 * @file Unit tests for IntensityBoundsCalculator service
 * @description Tests intensity bounds calculation for emotion/sexual prototypes.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import IntensityBoundsCalculator from '../../../../src/expressionDiagnostics/services/IntensityBoundsCalculator.js';
import { AxisInterval } from '../../../../src/expressionDiagnostics/models/index.js';

describe('IntensityBoundsCalculator', () => {
  let mockLogger;
  let mockDataRegistry;

  // Mock emotion prototypes
  const mockEmotionPrototypes = {
    entries: {
      // Simple prototype with positive weights only
      joy: {
        weights: { valence: 1.0, arousal: 0.5 },
        gates: ['valence >= 0.35'],
      },
      // Prototype with negative weights
      calm: {
        weights: { valence: 0.2, arousal: -1.0, threat: -1.0 },
        gates: ['threat <= 0.20'],
      },
      // Prototype with all zero weights (edge case)
      empty_emotion: {
        weights: {},
      },
      // Prototype with mixed weights for complex bounds calculation
      anxiety: {
        weights: { threat: 0.8, arousal: 0.6, future_expectancy: -0.4 },
        gates: ['threat >= 0.20'],
      },
      // High threshold test prototype
      ecstasy: {
        weights: { valence: 0.6, arousal: 0.4 },
        gates: ['valence >= 0.60', 'arousal >= 0.50'],
      },
    },
  };

  // Mock sexual prototypes
  const mockSexualPrototypes = {
    entries: {
      aroused: {
        weights: { sexual_arousal: 1.0, sex_excitation: 0.5 },
        gates: ['sexual_arousal >= 0.40'],
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

  describe('Constructor', () => {
    it('should create instance with valid dependencies', () => {
      const calculator = new IntensityBoundsCalculator({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
      });
      expect(calculator).toBeInstanceOf(IntensityBoundsCalculator);
    });

    it('should throw if dataRegistry is missing', () => {
      expect(
        () =>
          new IntensityBoundsCalculator({
            logger: mockLogger,
          })
      ).toThrow();
    });

    it('should throw if logger is missing', () => {
      expect(
        () =>
          new IntensityBoundsCalculator({
            dataRegistry: mockDataRegistry,
          })
      ).toThrow();
    });

    it('should throw if dataRegistry lacks get method', () => {
      expect(
        () =>
          new IntensityBoundsCalculator({
            dataRegistry: {},
            logger: mockLogger,
          })
      ).toThrow();
    });
  });

  describe('calculateBounds()', () => {
    let calculator;

    beforeEach(() => {
      calculator = new IntensityBoundsCalculator({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
      });
    });

    it('should return {min: 0, max: 0} for prototype with no weights', () => {
      const result = calculator.calculateBounds('empty_emotion', 'emotion');

      expect(result.min).toBe(0);
      expect(result.max).toBe(0);
      expect(result.isUnbounded).toBe(false);
    });

    it('should correctly compute max for positive weights', () => {
      // joy: valence=1.0, arousal=0.5
      // Default mood bounds: [-1, 1]
      // Max: (1.0*1 + 0.5*1) / (1.0+0.5) = 1.5 / 1.5 = 1.0
      const result = calculator.calculateBounds('joy', 'emotion');

      expect(result.max).toBe(1.0);
      expect(result.isUnbounded).toBe(true);
    });

    it('should correctly compute min for positive weights', () => {
      // joy: valence=1.0, arousal=0.5
      // Default mood bounds: [-1, 1]
      // Min: (1.0*(-1) + 0.5*(-1)) / (1.0+0.5) = -1.5 / 1.5 = -1.0
      // Clamped to 0
      const result = calculator.calculateBounds('joy', 'emotion');

      expect(result.min).toBe(0);
    });

    it('should correctly handle negative weights', () => {
      // calm: valence=0.2, arousal=-1.0, threat=-1.0
      // For negative weights: max uses min value, min uses max value
      // sumAbsWeights = 0.2 + 1.0 + 1.0 = 2.2
      // maxRawSum = 0.2*1 + (-1.0)*(-1) + (-1.0)*(-1) = 0.2 + 1.0 + 1.0 = 2.2
      // max = 2.2 / 2.2 = 1.0
      const result = calculator.calculateBounds('calm', 'emotion');

      expect(result.max).toBe(1.0);
    });

    it('should respect axis constraints when provided', () => {
      // joy: valence=1.0, arousal=0.5
      // Constrain valence to [0.3, 0.5] and arousal to [0, 0.3]
      const constraints = new Map([
        ['valence', new AxisInterval(0.3, 0.5)],
        ['arousal', new AxisInterval(0, 0.3)],
      ]);

      const result = calculator.calculateBounds('joy', 'emotion', constraints);

      // Max: (1.0*0.5 + 0.5*0.3) / 1.5 = 0.65 / 1.5 = 0.4333...
      // Min: (1.0*0.3 + 0.5*0) / 1.5 = 0.3 / 1.5 = 0.2
      expect(result.max).toBeCloseTo(0.4333, 3);
      expect(result.min).toBeCloseTo(0.2, 5);
      expect(result.isUnbounded).toBe(false);
    });

    it('should clamp results to [0, 1] range', () => {
      // The clamping is already tested indirectly above (min clamped to 0)
      // This test ensures negative raw values get clamped
      const result = calculator.calculateBounds('joy', 'emotion');

      expect(result.min).toBeGreaterThanOrEqual(0);
      expect(result.min).toBeLessThanOrEqual(1);
      expect(result.max).toBeGreaterThanOrEqual(0);
      expect(result.max).toBeLessThanOrEqual(1);
    });

    it('should return {min: 0, max: 0} for missing prototype', () => {
      const result = calculator.calculateBounds('nonexistent', 'emotion');

      expect(result.min).toBe(0);
      expect(result.max).toBe(0);
      expect(result.isUnbounded).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Prototype not found: nonexistent')
      );
    });

    it('should use sexual axis defaults for sexual prototypes', () => {
      // aroused: sexual_arousal=1.0, sex_excitation=0.5
      // Sexual axes default to [0, 1]
      // Max: (1.0*1 + 0.5*1) / 1.5 = 1.0
      // Min: (1.0*0 + 0.5*0) / 1.5 = 0
      const result = calculator.calculateBounds('aroused', 'sexual');

      expect(result.max).toBe(1.0);
      expect(result.min).toBe(0);
    });

    it('should not modify input axis constraints map', () => {
      const constraints = new Map([
        ['valence', new AxisInterval(0.3, 0.5)],
      ]);
      const originalSize = constraints.size;

      calculator.calculateBounds('joy', 'emotion', constraints);

      expect(constraints.size).toBe(originalSize);
      expect(constraints.get('valence').min).toBe(0.3);
      expect(constraints.get('valence').max).toBe(0.5);
    });
  });

  describe('checkThresholdReachability()', () => {
    let calculator;

    beforeEach(() => {
      calculator = new IntensityBoundsCalculator({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
      });
    });

    it('should return isReachable=true when max >= threshold', () => {
      // joy has max intensity of 1.0
      const result = calculator.checkThresholdReachability(
        'joy',
        'emotion',
        0.6
      );

      expect(result.isReachable).toBe(true);
      expect(result.threshold).toBe(0.6);
      expect(result.maxPossible).toBe(1.0);
      expect(result.gap).toBe(0);
    });

    it('should return isReachable=false when max < threshold', () => {
      // Create tight constraints so max is below threshold
      const constraints = new Map([
        ['valence', new AxisInterval(0, 0.3)],
        ['arousal', new AxisInterval(0, 0.2)],
      ]);

      // joy: valence=1.0, arousal=0.5, sumAbsWeights=1.5
      // Max with constraints: (1.0*0.3 + 0.5*0.2) / 1.5 = 0.4/1.5 = 0.2666...
      const result = calculator.checkThresholdReachability(
        'joy',
        'emotion',
        0.5,
        constraints
      );

      expect(result.isReachable).toBe(false);
      expect(result.threshold).toBe(0.5);
      expect(result.maxPossible).toBeCloseTo(0.2667, 3);
    });

    it('should calculate correct gap when threshold unreachable', () => {
      const constraints = new Map([
        ['valence', new AxisInterval(0, 0.3)],
        ['arousal', new AxisInterval(0, 0.2)],
      ]);

      const result = calculator.checkThresholdReachability(
        'joy',
        'emotion',
        0.5,
        constraints
      );

      // gap = threshold - maxPossible = 0.5 - 0.2667 = 0.2333
      expect(result.gap).toBeCloseTo(0.2333, 3);
    });

    it('should return gap of 0 when threshold is reachable', () => {
      const result = calculator.checkThresholdReachability(
        'joy',
        'emotion',
        0.3
      );

      expect(result.gap).toBe(0);
    });
  });

  describe('analyzeExpression()', () => {
    let calculator;

    beforeEach(() => {
      calculator = new IntensityBoundsCalculator({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
      });
    });

    it('should return empty array for null expression', () => {
      const result = calculator.analyzeExpression(null);
      expect(result).toEqual([]);
    });

    it('should return empty array for expression without prerequisites', () => {
      const result = calculator.analyzeExpression({ id: 'test' });
      expect(result).toEqual([]);
    });

    it('should return empty array for reachable expressions', () => {
      const expression = {
        prerequisites: [
          {
            logic: { '>=': [{ var: 'emotions.joy' }, 0.5] },
          },
        ],
      };

      const result = calculator.analyzeExpression(expression);

      // joy can reach 1.0, so 0.5 is reachable
      expect(result).toEqual([]);
    });

    it('should identify unreachable thresholds', () => {
      // Constrain so joy max is below threshold
      const constraints = new Map([
        ['valence', new AxisInterval(0, 0.2)],
        ['arousal', new AxisInterval(0, 0.1)],
      ]);

      const expression = {
        prerequisites: [
          {
            logic: { '>=': [{ var: 'emotions.joy' }, 0.8] },
          },
        ],
      };

      const result = calculator.analyzeExpression(expression, constraints);

      expect(result).toHaveLength(1);
      expect(result[0].prototypeId).toBe('joy');
      expect(result[0].type).toBe('emotion');
      expect(result[0].isReachable).toBe(false);
      expect(result[0].threshold).toBe(0.8);
    });

    it('should handle nested AND logic', () => {
      const constraints = new Map([
        ['valence', new AxisInterval(0, 0.2)],
        ['arousal', new AxisInterval(0, 0.1)],
      ]);

      const expression = {
        prerequisites: [
          {
            logic: {
              and: [
                { '>=': [{ var: 'emotions.joy' }, 0.9] },
                { '>=': [{ var: 'emotions.calm' }, 0.3] },
              ],
            },
          },
        ],
      };

      const result = calculator.analyzeExpression(expression, constraints);

      // Should find at least joy as unreachable (calm might also be unreachable)
      const joyResult = result.find((r) => r.prototypeId === 'joy');
      expect(joyResult).toBeDefined();
      expect(joyResult.isReachable).toBe(false);
    });

    it('should handle nested OR logic', () => {
      const constraints = new Map([
        ['valence', new AxisInterval(0, 0.2)],
        ['arousal', new AxisInterval(0, 0.1)],
      ]);

      const expression = {
        prerequisites: [
          {
            logic: {
              or: [
                { '>=': [{ var: 'emotions.joy' }, 0.9] },
                { '>=': [{ var: 'emotions.calm' }, 0.3] },
              ],
            },
          },
        ],
      };

      const result = calculator.analyzeExpression(expression, constraints);

      // Should find joy as unreachable (OR means both are checked independently)
      const joyResult = result.find((r) => r.prototypeId === 'joy');
      expect(joyResult).toBeDefined();
    });

    it('should handle sexual state thresholds', () => {
      const constraints = new Map([
        ['sexual_arousal', new AxisInterval(0, 0.2)],
        ['sex_excitation', new AxisInterval(0, 0.1)],
      ]);

      const expression = {
        prerequisites: [
          {
            logic: { '>=': [{ var: 'sexualStates.aroused' }, 0.8] },
          },
        ],
      };

      const result = calculator.analyzeExpression(expression, constraints);

      expect(result).toHaveLength(1);
      expect(result[0].prototypeId).toBe('aroused');
      expect(result[0].type).toBe('sexual');
      expect(result[0].isReachable).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    let calculator;

    beforeEach(() => {
      calculator = new IntensityBoundsCalculator({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
      });
    });

    it('should handle prototype with single weight', () => {
      // Temporarily add a single-weight prototype
      mockEmotionPrototypes.entries.single_weight = {
        weights: { valence: 0.5 },
      };

      const result = calculator.calculateBounds('single_weight', 'emotion');

      // valence weight 0.5, default bounds [-1, 1]
      // max = 0.5 * 1 / 0.5 = 1.0
      // min = 0.5 * (-1) / 0.5 = -1.0 -> clamped to 0
      expect(result.max).toBe(1.0);
      expect(result.min).toBe(0);
    });

    it('should handle expression with multiple prerequisites', () => {
      const constraints = new Map([
        ['valence', new AxisInterval(0, 0.2)],
        ['arousal', new AxisInterval(0, 0.1)],
      ]);

      const expression = {
        prerequisites: [
          { logic: { '>=': [{ var: 'emotions.joy' }, 0.9] } },
          { logic: { '>=': [{ var: 'emotions.calm' }, 0.9] } },
        ],
      };

      const result = calculator.analyzeExpression(expression, constraints);

      // Both should be identified as unreachable
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('should ignore non-emotion/sexual var paths', () => {
      const expression = {
        prerequisites: [
          { logic: { '>=': [{ var: 'moodAxes.valence' }, 0.5] } },
          { logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } },
        ],
      };

      const result = calculator.analyzeExpression(expression);

      // moodAxes.valence should be ignored, only emotions.* processed
      // joy is reachable, so result should be empty
      expect(result).toEqual([]);
    });
  });
});
