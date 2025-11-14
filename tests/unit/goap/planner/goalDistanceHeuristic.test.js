/**
 * @file Unit tests for GoalDistanceHeuristic
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import GoalDistanceHeuristic from '../../../../src/goap/planner/goalDistanceHeuristic.js';

describe('GoalDistanceHeuristic - Calculation', () => {
  let testBed;
  let heuristic;
  let mockEvaluator;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockEvaluator = testBed.createMock('JsonLogicEvaluationService', ['evaluate']);

    heuristic = new GoalDistanceHeuristic({
      jsonLogicEvaluator: mockEvaluator,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Satisfied Goals', () => {
    it('should return 0 when all goal conditions are satisfied', () => {
      const state = {
        'entity-1:core:hungry': false,
        'entity-1:core:health': 100,
      };

      const goal = {
        conditions: [
          { condition: { '!': { has_component: ['entity-1', 'core:hungry'] } } },
          { condition: { '>=': [{ var: 'state.entity-1:core:health' }, 80] } },
        ],
      };

      // Both conditions satisfied
      mockEvaluator.evaluate.mockReturnValueOnce(true).mockReturnValueOnce(true);

      const result = heuristic.calculate(state, goal);

      expect(result).toBe(0);
      expect(mockEvaluator.evaluate).toHaveBeenCalledTimes(2);
    });

    it('should return 0 for empty goal conditions', () => {
      const state = { 'entity-1:core:hungry': true };
      const goal = { conditions: [] };

      const result = heuristic.calculate(state, goal);

      expect(result).toBe(0);
      expect(mockEvaluator.evaluate).not.toHaveBeenCalled();
    });
  });

  describe('Partially Satisfied Goals', () => {
    it('should count only unsatisfied conditions', () => {
      const state = {
        'entity-1:core:hungry': true,
        'entity-1:core:health': 90,
      };

      const goal = {
        conditions: [
          { condition: { has_component: ['entity-1', 'core:hungry'] } }, // satisfied
          { condition: { '>=': [{ var: 'state.entity-1:core:health' }, 80] } }, // satisfied
          { condition: { has_component: ['entity-1', 'core:shelter'] } }, // unsatisfied
        ],
      };

      mockEvaluator.evaluate
        .mockReturnValueOnce(true) // hungry satisfied
        .mockReturnValueOnce(true) // health satisfied
        .mockReturnValueOnce(false); // shelter unsatisfied

      const result = heuristic.calculate(state, goal);

      expect(result).toBe(1);
      expect(mockEvaluator.evaluate).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed satisfaction across multiple conditions', () => {
      const state = {
        'entity-1:core:hungry': true,
        'entity-1:core:thirsty': true,
        'entity-1:core:tired': false,
      };

      const goal = {
        conditions: [
          { condition: { has_component: ['entity-1', 'core:hungry'] } }, // satisfied
          { condition: { has_component: ['entity-1', 'core:thirsty'] } }, // satisfied
          { condition: { '!': { has_component: ['entity-1', 'core:tired'] } } }, // satisfied
          { condition: { has_component: ['entity-1', 'core:rested'] } }, // unsatisfied
          { condition: { has_component: ['entity-1', 'core:safe'] } }, // unsatisfied
        ],
      };

      mockEvaluator.evaluate
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false);

      const result = heuristic.calculate(state, goal);

      expect(result).toBe(2);
    });
  });

  describe('Unsatisfied Goals', () => {
    it('should return count when all conditions are unsatisfied', () => {
      const state = {
        'entity-1:core:hungry': true,
        'entity-1:core:health': 30,
      };

      const goal = {
        conditions: [
          { condition: { '!': { has_component: ['entity-1', 'core:hungry'] } } },
          { condition: { '>=': [{ var: 'state.entity-1:core:health' }, 80] } },
          { condition: { has_component: ['entity-1', 'core:shelter'] } },
        ],
      };

      mockEvaluator.evaluate
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false);

      const result = heuristic.calculate(state, goal);

      expect(result).toBe(3);
    });
  });

  describe('State Format Handling', () => {
    it('should handle simple component presence state format', () => {
      const state = {
        'entity-1:core:hungry': {},
        'entity-2:core:satiated': {},
      };

      const goal = {
        conditions: [
          { condition: { has_component: ['entity-1', 'core:hungry'] } },
          { condition: { has_component: ['entity-2', 'core:satiated'] } },
        ],
      };

      mockEvaluator.evaluate.mockReturnValue(true);

      const result = heuristic.calculate(state, goal);

      expect(result).toBe(0);
    });

    it('should handle nested component field state format', () => {
      const state = {
        'entity-1:core:nutrition': { hungerLevel: 0, satiation: 100 },
        'entity-1:core:health': 85,
      };

      const goal = {
        conditions: [
          { condition: { '==': [{ var: 'state.entity-1:core:nutrition.hungerLevel' }, 0] } },
          { condition: { '>': [{ var: 'state.entity-1:core:health' }, 80] } },
        ],
      };

      mockEvaluator.evaluate.mockReturnValue(true);

      const result = heuristic.calculate(state, goal);

      expect(result).toBe(0);
    });

    it('should handle boolean component state values', () => {
      const state = {
        'entity-1:core:hungry': true,
        'entity-1:core:tired': false,
      };

      const goal = {
        conditions: [
          { condition: { '==': [{ var: 'state.entity-1:core:hungry' }, false] } },
          { condition: { '==': [{ var: 'state.entity-1:core:tired' }, false] } },
        ],
      };

      mockEvaluator.evaluate.mockReturnValueOnce(false).mockReturnValueOnce(true);

      const result = heuristic.calculate(state, goal);

      expect(result).toBe(1); // Only hungry condition unsatisfied
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing components gracefully', () => {
      const state = {
        'entity-1:core:health': 50,
      };

      const goal = {
        conditions: [
          { condition: { has_component: ['entity-1', 'core:shelter'] } }, // component doesn't exist
        ],
      };

      mockEvaluator.evaluate.mockReturnValue(false);

      const result = heuristic.calculate(state, goal);

      expect(result).toBe(1);
    });

    it('should return Infinity for invalid state', () => {
      const result1 = heuristic.calculate(null, { conditions: [] });
      expect(result1).toBe(Infinity);

      const result2 = heuristic.calculate(undefined, { conditions: [] });
      expect(result2).toBe(Infinity);

      const result3 = heuristic.calculate('invalid', { conditions: [] });
      expect(result3).toBe(Infinity);

      expect(mockLogger.warn).toHaveBeenCalledTimes(3);
    });

    it('should return Infinity for invalid goal', () => {
      const state = { 'entity-1:core:health': 50 };

      const result1 = heuristic.calculate(state, null);
      expect(result1).toBe(Infinity);

      const result2 = heuristic.calculate(state, {});
      expect(result2).toBe(Infinity);

      const result3 = heuristic.calculate(state, { conditions: 'not-an-array' });
      expect(result3).toBe(Infinity);

      expect(mockLogger.warn).toHaveBeenCalledTimes(3);
    });

    it('should treat conditions missing "condition" field as unsatisfied', () => {
      const state = { 'entity-1:core:health': 50 };

      const goal = {
        conditions: [
          { condition: { has_component: ['entity-1', 'core:health'] } }, // valid
          { description: 'Missing condition field' }, // invalid, no condition field
        ],
      };

      mockEvaluator.evaluate.mockReturnValue(true);

      const result = heuristic.calculate(state, goal);

      expect(result).toBe(1); // Invalid condition treated as unsatisfied
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should treat evaluation errors as unsatisfied conditions', () => {
      const state = { 'entity-1:core:health': 50 };

      const goal = {
        conditions: [
          { condition: { has_component: ['entity-1', 'core:health'] } },
          { condition: { invalid_operator: ['entity-1', 'core:hunger'] } },
        ],
      };

      mockEvaluator.evaluate
        .mockReturnValueOnce(true) // first condition succeeds
        .mockImplementationOnce(() => {
          throw new Error('Unknown operator');
        }); // second condition throws

      const result = heuristic.calculate(state, goal);

      expect(result).toBe(1); // Error treated as unsatisfied
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('Admissibility', () => {
    it('should never overestimate (admissibility check)', () => {
      // With 3 unsatisfied conditions, actual cost is at least 3
      // Heuristic should return exactly 3 (not 4, 5, etc.)
      const state = { 'entity-1:core:health': 30 };

      const goal = {
        conditions: [
          { condition: { has_component: ['entity-1', 'core:shelter'] } },
          { condition: { has_component: ['entity-1', 'core:weapon'] } },
          { condition: { has_component: ['entity-1', 'core:food'] } },
        ],
      };

      mockEvaluator.evaluate.mockReturnValue(false);

      const result = heuristic.calculate(state, goal);

      // Each condition requires at least 1 action
      // So actual cost >= 3, and h = 3 is admissible
      expect(result).toBe(3);
      expect(result).toBeLessThanOrEqual(3); // h(n) <= h*(n)
    });
  });

  describe('Interface Compatibility', () => {
    it('should accept tasks parameter for interface compatibility (unused)', () => {
      const state = { 'entity-1:core:hungry': true };
      const goal = {
        conditions: [{ condition: { has_component: ['entity-1', 'core:hungry'] } }],
      };
      const tasks = [{ id: 'task-1' }, { id: 'task-2' }];

      mockEvaluator.evaluate.mockReturnValue(true);

      const result = heuristic.calculate(state, goal, tasks);

      expect(result).toBe(0);
      // Tasks are not used by goal-distance heuristic
    });

    it('should work without tasks parameter', () => {
      const state = { 'entity-1:core:hungry': true };
      const goal = {
        conditions: [{ condition: { has_component: ['entity-1', 'core:hungry'] } }],
      };

      mockEvaluator.evaluate.mockReturnValue(true);

      const result = heuristic.calculate(state, goal);

      expect(result).toBe(0);
    });
  });
});

describe('GoalDistanceHeuristic - Construction', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should validate jsonLogicEvaluator dependency', () => {
    const mockLogger = testBed.createMockLogger();

    expect(() => {
      new GoalDistanceHeuristic({
        jsonLogicEvaluator: null,
        logger: mockLogger,
      });
    }).toThrow();

    expect(() => {
      new GoalDistanceHeuristic({
        jsonLogicEvaluator: {},
        logger: mockLogger,
      });
    }).toThrow();
  });

  it('should use fallback logger if invalid logger provided', () => {
    const mockEvaluator = testBed.createMock('JsonLogicEvaluationService', ['evaluate']);

    // ensureValidLogger creates a fallback instead of throwing
    const heuristic = new GoalDistanceHeuristic({
      jsonLogicEvaluator: mockEvaluator,
      logger: null,
    });
    expect(heuristic).toBeDefined();
  });

  it('should construct successfully with valid dependencies', () => {
    const mockLogger = testBed.createMockLogger();
    const mockEvaluator = testBed.createMock('JsonLogicEvaluationService', ['evaluate']);

    expect(() => {
      new GoalDistanceHeuristic({
        jsonLogicEvaluator: mockEvaluator,
        logger: mockLogger,
      });
    }).not.toThrow();
  });
});
