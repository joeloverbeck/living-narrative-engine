/**
 * @file HitProbabilityCalculator.test.js
 * @description Unit tests for HitProbabilityCalculator service
 */

import HitProbabilityCalculator from '../../../../src/domUI/damage-simulator/HitProbabilityCalculator.js';
import { jest } from '@jest/globals';

describe('HitProbabilityCalculator', () => {
  let mockLogger;
  let mockHitProbabilityWeightUtils;
  let calculator;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockHitProbabilityWeightUtils = {
      getEffectiveHitWeight: jest.fn((component) => {
        if (!component) return 0;
        if (typeof component.hit_probability_weight === 'number') {
          return Math.max(0, component.hit_probability_weight);
        }
        return 1.0; // DEFAULT_HIT_PROBABILITY_WEIGHT
      }),
      filterEligibleHitTargets: jest.fn((parts) =>
        parts
          .filter(({ component }) => {
            const weight = mockHitProbabilityWeightUtils.getEffectiveHitWeight(component);
            return weight > 0;
          })
          .map(({ id, component }) => ({
            id,
            weight: mockHitProbabilityWeightUtils.getEffectiveHitWeight(component),
          }))
      ),
      DEFAULT_HIT_PROBABILITY_WEIGHT: 1.0,
    };

    calculator = new HitProbabilityCalculator({
      hitProbabilityWeightUtils: mockHitProbabilityWeightUtils,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should throw if hitProbabilityWeightUtils is missing', () => {
      expect(
        () =>
          new HitProbabilityCalculator({
            logger: mockLogger,
          })
      ).toThrow();
    });

    it('should throw if hitProbabilityWeightUtils lacks getEffectiveHitWeight method', () => {
      expect(
        () =>
          new HitProbabilityCalculator({
            hitProbabilityWeightUtils: {},
            logger: mockLogger,
          })
      ).toThrow();
    });

    it('should throw if logger is missing', () => {
      expect(
        () =>
          new HitProbabilityCalculator({
            hitProbabilityWeightUtils: mockHitProbabilityWeightUtils,
          })
      ).toThrow();
    });

    it('should create calculator with all valid dependencies', () => {
      expect(calculator).toBeInstanceOf(HitProbabilityCalculator);
    });
  });

  describe('calculateProbabilities', () => {
    it('should calculate probabilities from part weights', () => {
      const parts = [
        { id: 'torso', name: 'Torso', component: { hit_probability_weight: 3 } },
        { id: 'head', name: 'Head', component: { hit_probability_weight: 1 } },
        { id: 'arm', name: 'Arm', component: { hit_probability_weight: 1 } },
      ];

      const result = calculator.calculateProbabilities(parts);

      expect(result).toHaveLength(3);
      expect(result[0].partId).toBe('torso');
      expect(result[0].probability).toBe(60); // 3/5 = 60%
      expect(result[1].probability).toBe(20); // 1/5 = 20%
      expect(result[2].probability).toBe(20); // 1/5 = 20%
    });

    it('should normalize probabilities to 100%', () => {
      const parts = [
        { id: 'torso', name: 'Torso', component: { hit_probability_weight: 2 } },
        { id: 'head', name: 'Head', component: { hit_probability_weight: 2 } },
        { id: 'arm', name: 'Arm', component: { hit_probability_weight: 1 } },
      ];

      const result = calculator.calculateProbabilities(parts);
      const totalProbability = result.reduce((sum, p) => sum + p.probability, 0);

      expect(totalProbability).toBeCloseTo(100, 1);
    });

    it('should handle parts with zero weight', () => {
      const parts = [
        { id: 'torso', name: 'Torso', component: { hit_probability_weight: 2 } },
        { id: 'internal', name: 'Internal', component: { hit_probability_weight: 0 } },
        { id: 'arm', name: 'Arm', component: { hit_probability_weight: 2 } },
      ];

      const result = calculator.calculateProbabilities(parts);

      const internalPart = result.find((p) => p.partId === 'internal');
      expect(internalPart.probability).toBe(0);
      expect(internalPart.tier).toBe('none');
    });

    it('should sort parts by probability (highest first)', () => {
      const parts = [
        { id: 'arm', name: 'Arm', component: { hit_probability_weight: 1 } },
        { id: 'torso', name: 'Torso', component: { hit_probability_weight: 5 } },
        { id: 'head', name: 'Head', component: { hit_probability_weight: 2 } },
      ];

      const result = calculator.calculateProbabilities(parts);

      expect(result[0].partId).toBe('torso');
      expect(result[1].partId).toBe('head');
      expect(result[2].partId).toBe('arm');
    });

    it('should use existing hitProbabilityWeightUtils', () => {
      const parts = [{ id: 'test', name: 'Test', component: { hit_probability_weight: 1 } }];

      calculator.calculateProbabilities(parts);

      expect(mockHitProbabilityWeightUtils.getEffectiveHitWeight).toHaveBeenCalledWith({ hit_probability_weight: 1 });
    });

    it('should handle empty parts array', () => {
      const result = calculator.calculateProbabilities([]);

      expect(result).toEqual([]);
      expect(mockLogger.debug).toHaveBeenCalledWith('[HitProbabilityCalculator] Empty parts array provided');
    });

    it('should handle single part case', () => {
      const parts = [{ id: 'torso', name: 'Torso', component: { hit_probability_weight: 1 } }];

      const result = calculator.calculateProbabilities(parts);

      expect(result).toHaveLength(1);
      expect(result[0].probability).toBe(100);
    });

    it('should handle parts with equal weights', () => {
      const parts = [
        { id: 'torso', name: 'Torso', component: { hit_probability_weight: 1 } },
        { id: 'head', name: 'Head', component: { hit_probability_weight: 1 } },
        { id: 'arm', name: 'Arm', component: { hit_probability_weight: 1 } },
        { id: 'leg', name: 'Leg', component: { hit_probability_weight: 1 } },
      ];

      const result = calculator.calculateProbabilities(parts);

      result.forEach((p) => {
        expect(p.probability).toBe(25);
      });
    });

    it('should assign correct tier classifications', () => {
      // Create parts that will result in specific probability distributions
      // 20% = high (>= 15), 10% = medium (>= 5), 2% = low (< 5)
      const parts = [
        { id: 'torso', name: 'Torso', component: { hit_probability_weight: 20 } }, // 20%
        { id: 'head', name: 'Head', component: { hit_probability_weight: 10 } }, // 10%
        { id: 'finger', name: 'Finger', component: { hit_probability_weight: 2 } }, // 2%
        { id: 'other', name: 'Other', component: { hit_probability_weight: 68 } }, // 68%
      ];

      const result = calculator.calculateProbabilities(parts);

      const torso = result.find((p) => p.partId === 'torso');
      const head = result.find((p) => p.partId === 'head');
      const finger = result.find((p) => p.partId === 'finger');
      const other = result.find((p) => p.partId === 'other');

      expect(torso.tier).toBe('high'); // 20% >= 15%
      expect(head.tier).toBe('medium'); // 10% >= 5% and < 15%
      expect(finger.tier).toBe('low'); // 2% < 5%
      expect(other.tier).toBe('high'); // 68% >= 15%
    });

    it('should handle all parts with zero weight', () => {
      const parts = [
        { id: 'a', name: 'A', component: { hit_probability_weight: 0 } },
        { id: 'b', name: 'B', component: { hit_probability_weight: 0 } },
      ];

      const result = calculator.calculateProbabilities(parts);

      expect(result).toHaveLength(2);
      result.forEach((p) => {
        expect(p.probability).toBe(0);
        expect(p.tier).toBe('none');
      });
    });

    it('should use part id as name fallback when name is missing', () => {
      const parts = [{ id: 'torso', component: { hit_probability_weight: 1 } }];

      const result = calculator.calculateProbabilities(parts);

      expect(result[0].partName).toBe('torso');
    });

    it('should handle null component gracefully', () => {
      const parts = [
        { id: 'torso', name: 'Torso', component: { hit_probability_weight: 2 } },
        { id: 'missing', name: 'Missing', component: null },
      ];

      const result = calculator.calculateProbabilities(parts);

      const missing = result.find((p) => p.partId === 'missing');
      expect(missing.weight).toBe(0);
      expect(missing.probability).toBe(0);
    });
  });

  describe('getCumulativeProbability', () => {
    it('should calculate cumulative probability correctly', () => {
      const probabilities = [
        { partId: 'torso', probability: 50 },
        { partId: 'head', probability: 30 },
        { partId: 'arm', probability: 20 },
      ];

      expect(calculator.getCumulativeProbability(probabilities, 'torso')).toBe(50);
      expect(calculator.getCumulativeProbability(probabilities, 'head')).toBe(80);
      expect(calculator.getCumulativeProbability(probabilities, 'arm')).toBe(100);
    });

    it('should return total if part not found', () => {
      const probabilities = [
        { partId: 'torso', probability: 50 },
        { partId: 'head', probability: 50 },
      ];

      const result = calculator.getCumulativeProbability(probabilities, 'nonexistent');

      expect(result).toBe(100);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "[HitProbabilityCalculator] Part ID 'nonexistent' not found in probabilities"
      );
    });

    it('should return 0 for empty array', () => {
      expect(calculator.getCumulativeProbability([], 'any')).toBe(0);
    });

    it('should return 0 for non-array input', () => {
      expect(calculator.getCumulativeProbability(null, 'any')).toBe(0);
      expect(calculator.getCumulativeProbability(undefined, 'any')).toBe(0);
    });
  });

  describe('getHighProbabilityParts', () => {
    it('should identify highest probability parts', () => {
      const probabilities = [
        { partId: 'torso', probability: 40 },
        { partId: 'head', probability: 20 },
        { partId: 'arm', probability: 10 },
        { partId: 'finger', probability: 5 },
      ];

      const result = calculator.getHighProbabilityParts(probabilities, 15);

      expect(result).toHaveLength(2);
      expect(result.map((p) => p.partId)).toEqual(['torso', 'head']);
    });

    it('should return empty for high threshold', () => {
      const probabilities = [
        { partId: 'torso', probability: 40 },
        { partId: 'head', probability: 30 },
      ];

      const result = calculator.getHighProbabilityParts(probabilities, 50);

      expect(result).toEqual([]);
    });

    it('should include parts at exact threshold', () => {
      const probabilities = [
        { partId: 'torso', probability: 50 },
        { partId: 'head', probability: 25 },
      ];

      const result = calculator.getHighProbabilityParts(probabilities, 25);

      expect(result).toHaveLength(2);
    });

    it('should handle non-array input', () => {
      expect(calculator.getHighProbabilityParts(null, 10)).toEqual([]);
      expect(calculator.getHighProbabilityParts(undefined, 10)).toEqual([]);
    });

    it('should handle non-numeric threshold', () => {
      const probabilities = [{ partId: 'torso', probability: 50 }];

      const result = calculator.getHighProbabilityParts(probabilities, 'invalid');

      expect(result).toEqual([{ partId: 'torso', probability: 50 }]); // threshold defaults to 0
    });
  });

  describe('getVisualizationData', () => {
    it('should generate visualization data correctly', () => {
      const probabilities = [
        { partId: 'torso', partName: 'Torso', weight: 3, probability: 60, tier: 'high' },
        { partId: 'arm', partName: 'Arm', weight: 2, probability: 40, tier: 'high' },
      ];

      const result = calculator.getVisualizationData(probabilities);

      expect(result.totalParts).toBe(2);
      expect(result.maxProbability).toBe(60);
      expect(result.bars).toHaveLength(2);
    });

    it('should calculate bar widths relative to max probability', () => {
      const probabilities = [
        { partId: 'torso', partName: 'Torso', weight: 3, probability: 50, tier: 'high' },
        { partId: 'arm', partName: 'Arm', weight: 1, probability: 25, tier: 'medium' },
      ];

      const result = calculator.getVisualizationData(probabilities);

      expect(result.bars[0].barWidth).toBe(100); // 50/50 * 100
      expect(result.bars[1].barWidth).toBe(50); // 25/50 * 100
    });

    it('should assign correct color classes based on tier', () => {
      const probabilities = [
        { partId: 'high', partName: 'High', weight: 1, probability: 20, tier: 'high' },
        { partId: 'med', partName: 'Med', weight: 1, probability: 10, tier: 'medium' },
        { partId: 'low', partName: 'Low', weight: 1, probability: 3, tier: 'low' },
        { partId: 'none', partName: 'None', weight: 0, probability: 0, tier: 'none' },
      ];

      const result = calculator.getVisualizationData(probabilities);

      expect(result.bars.find((b) => b.partId === 'high').colorClass).toBe('ds-prob-high');
      expect(result.bars.find((b) => b.partId === 'med').colorClass).toBe('ds-prob-medium');
      expect(result.bars.find((b) => b.partId === 'low').colorClass).toBe('ds-prob-low');
      expect(result.bars.find((b) => b.partId === 'none').colorClass).toBe('ds-prob-none');
    });

    it('should return empty visualization for empty array', () => {
      const result = calculator.getVisualizationData([]);

      expect(result).toEqual({
        bars: [],
        maxProbability: 0,
        totalParts: 0,
      });
    });

    it('should handle non-array input', () => {
      expect(calculator.getVisualizationData(null)).toEqual({
        bars: [],
        maxProbability: 0,
        totalParts: 0,
      });
    });

    it('should use partName as label', () => {
      const probabilities = [{ partId: 'torso', partName: 'Upper Body', weight: 1, probability: 100, tier: 'high' }];

      const result = calculator.getVisualizationData(probabilities);

      expect(result.bars[0].label).toBe('Upper Body');
    });

    it('should handle zero max probability', () => {
      const probabilities = [
        { partId: 'a', partName: 'A', weight: 0, probability: 0, tier: 'none' },
        { partId: 'b', partName: 'B', weight: 0, probability: 0, tier: 'none' },
      ];

      const result = calculator.getVisualizationData(probabilities);

      expect(result.maxProbability).toBe(0);
      result.bars.forEach((bar) => {
        expect(bar.barWidth).toBe(0);
      });
    });
  });

  describe('Integration - Full Calculation Flow', () => {
    it('should produce consistent end-to-end results', () => {
      const parts = [
        { id: 'torso', name: 'Torso', component: { hit_probability_weight: 5 } },
        { id: 'head', name: 'Head', component: { hit_probability_weight: 1 } },
        { id: 'arm', name: 'Left Arm', component: { hit_probability_weight: 2 } },
        { id: 'leg', name: 'Right Leg', component: { hit_probability_weight: 2 } },
      ];

      const probabilities = calculator.calculateProbabilities(parts);
      const vizData = calculator.getVisualizationData(probabilities);
      const highProb = calculator.getHighProbabilityParts(probabilities, 15);
      const cumulative = calculator.getCumulativeProbability(probabilities, 'head');

      // Verify probabilities sum to 100%
      const total = probabilities.reduce((sum, p) => sum + p.probability, 0);
      expect(total).toBeCloseTo(100, 1);

      // Verify visualization data matches probabilities
      expect(vizData.totalParts).toBe(4);
      expect(vizData.bars).toHaveLength(4);

      // Verify high probability filter works
      expect(highProb.length).toBeGreaterThan(0);
      expect(highProb.every((p) => p.probability >= 15)).toBe(true);

      // Verify cumulative includes parts up to target
      expect(cumulative).toBeGreaterThan(probabilities[0].probability);
    });
  });
});
