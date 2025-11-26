import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ProbabilityCalculatorService from '../../../../src/combat/services/ProbabilityCalculatorService.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

/**
 * Creates minimal mocks for dependencies
 *
 * @returns {object} Object containing mocked dependencies
 */
function createMocks() {
  return {
    logger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
  };
}

describe('ProbabilityCalculatorService', () => {
  let service;
  let mockLogger;

  beforeEach(() => {
    ({ logger: mockLogger } = createMocks());
    service = new ProbabilityCalculatorService({ logger: mockLogger });
  });

  describe('constructor', () => {
    it('should create instance with valid dependencies', () => {
      expect(service).toBeInstanceOf(ProbabilityCalculatorService);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ProbabilityCalculatorService: Initialized'
      );
    });

    it('should throw error when logger is missing', () => {
      expect(() => {
        new ProbabilityCalculatorService({});
      }).toThrow(InvalidArgumentError);
    });

    it('should throw error when logger is null', () => {
      expect(() => {
        new ProbabilityCalculatorService({ logger: null });
      }).toThrow(InvalidArgumentError);
    });

    it('should throw error when logger is undefined', () => {
      expect(() => {
        new ProbabilityCalculatorService({ logger: undefined });
      }).toThrow(InvalidArgumentError);
    });

    it('should throw error when logger missing required methods', () => {
      expect(() => {
        new ProbabilityCalculatorService({
          logger: { debug: jest.fn() }, // Missing warn, error, info
        });
      }).toThrow(InvalidArgumentError);
    });

    it('should throw error when no params provided', () => {
      expect(() => {
        new ProbabilityCalculatorService();
      }).toThrow();
    });
  });

  describe('calculate - ratio formula', () => {
    it('should return 50% for equal skills (50 vs 50)', () => {
      const result = service.calculate({
        actorSkill: 50,
        targetSkill: 50,
      });

      expect(result.baseChance).toBe(50);
      expect(result.finalChance).toBe(50);
      expect(result.breakdown.formula).toBe('ratio');
    });

    it('should return 75% for 75 vs 25 skills', () => {
      const result = service.calculate({
        actorSkill: 75,
        targetSkill: 25,
      });

      expect(result.baseChance).toBe(75);
      expect(result.finalChance).toBe(75);
    });

    it('should return 25% for 25 vs 75 skills', () => {
      const result = service.calculate({
        actorSkill: 25,
        targetSkill: 75,
      });

      expect(result.baseChance).toBe(25);
      expect(result.finalChance).toBe(25);
    });

    it('should clamp to min (5%) for 0 vs 100 skills', () => {
      const result = service.calculate({
        actorSkill: 0,
        targetSkill: 100,
      });

      expect(result.baseChance).toBe(0);
      expect(result.finalChance).toBe(5); // Clamped to min
    });

    it('should clamp to max (95%) for 100 vs 0 skills', () => {
      const result = service.calculate({
        actorSkill: 100,
        targetSkill: 0,
      });

      expect(result.baseChance).toBe(100);
      expect(result.finalChance).toBe(95); // Clamped to max
    });

    it('should return 50% when both skills are 0', () => {
      const result = service.calculate({
        actorSkill: 0,
        targetSkill: 0,
      });

      expect(result.baseChance).toBe(50);
      expect(result.finalChance).toBe(50);
    });

    it('should use ratio formula by default', () => {
      const result = service.calculate({
        actorSkill: 60,
        targetSkill: 40,
      });

      expect(result.breakdown.formula).toBe('ratio');
      expect(result.baseChance).toBe(60);
    });
  });

  describe('calculate - logistic formula', () => {
    it('should return approximately 50% for equal skills', () => {
      const result = service.calculate({
        actorSkill: 50,
        targetSkill: 50,
        formula: 'logistic',
      });

      expect(result.baseChance).toBeCloseTo(50, 1);
      expect(result.breakdown.formula).toBe('logistic');
    });

    it('should approach 95% for large positive skill difference', () => {
      const result = service.calculate({
        actorSkill: 80,
        targetSkill: 20,
        formula: 'logistic',
      });

      // With diff = 60, logistic gives ~99.75, clamped to 95
      expect(result.baseChance).toBeGreaterThan(90);
      expect(result.finalChance).toBe(95); // Clamped
    });

    it('should approach 5% for large negative skill difference', () => {
      const result = service.calculate({
        actorSkill: 20,
        targetSkill: 80,
        formula: 'logistic',
      });

      // With diff = -60, logistic gives ~0.25, clamped to 5
      expect(result.baseChance).toBeLessThan(10);
      expect(result.finalChance).toBe(5); // Clamped
    });

    it('should use difficulty when targetSkill is 0', () => {
      const result = service.calculate({
        actorSkill: 50,
        targetSkill: 0,
        difficulty: 50,
        formula: 'logistic',
      });

      expect(result.baseChance).toBeCloseTo(50, 1);
    });
  });

  describe('calculate - linear formula', () => {
    it('should return 50% when actor equals difficulty', () => {
      const result = service.calculate({
        actorSkill: 50,
        difficulty: 50,
        formula: 'linear',
      });

      expect(result.baseChance).toBe(50);
      expect(result.finalChance).toBe(50);
      expect(result.breakdown.formula).toBe('linear');
    });

    it('should return 60% when actor is 10 above difficulty', () => {
      const result = service.calculate({
        actorSkill: 60,
        difficulty: 50,
        formula: 'linear',
      });

      expect(result.baseChance).toBe(60);
      expect(result.finalChance).toBe(60);
    });

    it('should return 40% when actor is 10 below difficulty', () => {
      const result = service.calculate({
        actorSkill: 40,
        difficulty: 50,
        formula: 'linear',
      });

      expect(result.baseChance).toBe(40);
      expect(result.finalChance).toBe(40);
    });

    it('should clamp to bounds for extreme differences', () => {
      const result = service.calculate({
        actorSkill: 100,
        difficulty: 0,
        formula: 'linear',
      });

      // 50 + (100 - 0) = 150, clamped to 95
      expect(result.baseChance).toBe(150);
      expect(result.finalChance).toBe(95);
    });
  });

  describe('calculate - bounds', () => {
    it('should apply default bounds (5-95)', () => {
      const result = service.calculate({
        actorSkill: 100,
        targetSkill: 0,
      });

      expect(result.breakdown.bounds).toEqual({ min: 5, max: 95 });
      expect(result.finalChance).toBe(95);
    });

    it('should apply custom bounds { min: 10, max: 90 }', () => {
      const result = service.calculate({
        actorSkill: 100,
        targetSkill: 0,
        bounds: { min: 10, max: 90 },
      });

      expect(result.breakdown.bounds).toEqual({ min: 10, max: 90 });
      expect(result.finalChance).toBe(90); // Clamped to custom max
    });

    it('should apply custom min bound correctly', () => {
      const result = service.calculate({
        actorSkill: 0,
        targetSkill: 100,
        bounds: { min: 10, max: 90 },
      });

      expect(result.finalChance).toBe(10); // Clamped to custom min
    });

    it('should throw error when min > max', () => {
      expect(() => {
        service.calculate({
          actorSkill: 50,
          targetSkill: 50,
          bounds: { min: 90, max: 10 },
        });
      }).toThrow('min (90) cannot be greater than max (10)');

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should use default values for missing bound properties', () => {
      const result = service.calculate({
        actorSkill: 50,
        targetSkill: 50,
        bounds: { min: 10 }, // max missing
      });

      expect(result.breakdown.bounds).toEqual({ min: 10, max: 95 });
    });

    it('should use default values for non-numeric bound properties', () => {
      const result = service.calculate({
        actorSkill: 50,
        targetSkill: 50,
        bounds: { min: 'invalid', max: 'invalid' },
      });

      expect(result.breakdown.bounds).toEqual({ min: 5, max: 95 });
    });
  });

  describe('calculate - modifiers', () => {
    it('should apply flat modifiers to base chance', () => {
      const result = service.calculate({
        actorSkill: 50,
        targetSkill: 50,
        modifiers: { totalFlat: 10 },
      });

      expect(result.baseChance).toBe(50);
      expect(result.breakdown.afterModifiers).toBe(60);
      expect(result.finalChance).toBe(60);
    });

    it('should apply percentage modifiers multiplicatively', () => {
      const result = service.calculate({
        actorSkill: 50,
        targetSkill: 50,
        modifiers: { totalPercentage: 1.2 },
      });

      expect(result.baseChance).toBe(50);
      expect(result.breakdown.afterModifiers).toBe(60); // 50 * 1.2
      expect(result.finalChance).toBe(60);
    });

    it('should apply both flat and percentage modifiers', () => {
      const result = service.calculate({
        actorSkill: 50,
        targetSkill: 50,
        modifiers: { totalFlat: 10, totalPercentage: 1.2 },
      });

      // (50 + 10) * 1.2 = 72
      expect(result.baseChance).toBe(50);
      expect(result.breakdown.afterModifiers).toBe(72);
      expect(result.finalChance).toBe(72);
    });

    it('should clamp modified result to bounds', () => {
      const result = service.calculate({
        actorSkill: 80,
        targetSkill: 20,
        modifiers: { totalFlat: 20, totalPercentage: 1.5 },
      });

      // (80 + 20) * 1.5 = 150, clamped to 95
      expect(result.finalChance).toBe(95);
    });

    it('should ignore invalid modifier values', () => {
      const result = service.calculate({
        actorSkill: 50,
        targetSkill: 50,
        modifiers: { totalFlat: 'invalid', totalPercentage: null },
      });

      expect(result.breakdown.afterModifiers).toBe(50);
      expect(result.finalChance).toBe(50);
    });

    it('should handle negative flat modifiers', () => {
      const result = service.calculate({
        actorSkill: 50,
        targetSkill: 50,
        modifiers: { totalFlat: -20 },
      });

      expect(result.breakdown.afterModifiers).toBe(30);
      expect(result.finalChance).toBe(30);
    });

    it('should handle percentage modifiers less than 1', () => {
      const result = service.calculate({
        actorSkill: 50,
        targetSkill: 50,
        modifiers: { totalPercentage: 0.5 },
      });

      expect(result.breakdown.afterModifiers).toBe(25);
      expect(result.finalChance).toBe(25);
    });
  });

  describe('calculate - edge cases', () => {
    it('should handle zero actor skill gracefully', () => {
      const result = service.calculate({
        actorSkill: 0,
        targetSkill: 50,
      });

      expect(result.baseChance).toBe(0);
      expect(result.finalChance).toBe(5); // Clamped to min
    });

    it('should handle zero target skill gracefully', () => {
      const result = service.calculate({
        actorSkill: 50,
        targetSkill: 0,
      });

      expect(result.baseChance).toBe(100);
      expect(result.finalChance).toBe(95); // Clamped to max
    });

    it('should handle negative actor skill', () => {
      const result = service.calculate({
        actorSkill: -10,
        targetSkill: 50,
      });

      // Negative values normalized to 0 in ratio formula
      expect(result.baseChance).toBe(0);
      expect(result.finalChance).toBe(5);
    });

    it('should handle negative target skill', () => {
      const result = service.calculate({
        actorSkill: 50,
        targetSkill: -10,
      });

      // Negative values normalized to 0 in ratio formula
      expect(result.baseChance).toBe(100);
      expect(result.finalChance).toBe(95);
    });

    it('should throw error for invalid formula', () => {
      expect(() => {
        service.calculate({
          actorSkill: 50,
          targetSkill: 50,
          formula: 'invalid',
        });
      }).toThrow("Invalid formula 'invalid'");

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle undefined params gracefully', () => {
      const result = service.calculate(undefined);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid actorSkill')
      );
      expect(result.baseChance).toBe(0);
      expect(result.finalChance).toBe(5);
    });

    it('should handle null params gracefully', () => {
      const result = service.calculate(null);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid actorSkill')
      );
      expect(result.baseChance).toBe(0);
    });

    it('should handle NaN actorSkill gracefully', () => {
      const result = service.calculate({
        actorSkill: NaN,
        targetSkill: 50,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid actorSkill')
      );
      expect(result.baseChance).toBe(0);
    });

    it('should handle decimal skill values', () => {
      const result = service.calculate({
        actorSkill: 55.5,
        targetSkill: 44.5,
      });

      // 55.5 / (55.5 + 44.5) * 100 = 55.5 (accounting for floating point precision)
      expect(result.baseChance).toBeCloseTo(55.5, 10);
      expect(result.finalChance).toBeCloseTo(55.5, 10);
    });

    it('should handle very large skill values', () => {
      const result = service.calculate({
        actorSkill: 1000000,
        targetSkill: 1,
      });

      expect(result.baseChance).toBeGreaterThan(99);
      expect(result.finalChance).toBe(95); // Clamped
    });

    it('should handle empty modifiers object', () => {
      const result = service.calculate({
        actorSkill: 50,
        targetSkill: 50,
        modifiers: {},
      });

      expect(result.breakdown.afterModifiers).toBe(50);
    });

    it('should handle empty bounds object', () => {
      const result = service.calculate({
        actorSkill: 100,
        targetSkill: 0,
        bounds: {},
      });

      expect(result.breakdown.bounds).toEqual({ min: 5, max: 95 });
      expect(result.finalChance).toBe(95);
    });
  });

  describe('calculate - breakdown structure', () => {
    it('should include all breakdown fields', () => {
      const result = service.calculate({
        actorSkill: 60,
        targetSkill: 40,
        modifiers: { totalFlat: 5 },
      });

      expect(result.breakdown).toHaveProperty('formula', 'ratio');
      expect(result.breakdown).toHaveProperty('rawCalculation', 60);
      expect(result.breakdown).toHaveProperty('afterModifiers', 65);
      expect(result.breakdown).toHaveProperty('bounds');
      expect(result.breakdown.bounds).toHaveProperty('min', 5);
      expect(result.breakdown.bounds).toHaveProperty('max', 95);
    });

    it('should log debug message with calculation details', () => {
      service.calculate({
        actorSkill: 50,
        targetSkill: 50,
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('formula=ratio')
      );
    });
  });
});
