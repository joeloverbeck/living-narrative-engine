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
    const mockNumericEvaluator = testBed.createMock('NumericConstraintEvaluator', [
      'isNumericConstraint',
      'calculateDistance',
    ]);
    const mockPlanningSimulator = testBed.createMock('IPlanningEffectsSimulator', [
      'simulateEffects',
    ]);

    heuristic = new GoalDistanceHeuristic({
      jsonLogicEvaluator: mockEvaluator,
      numericConstraintEvaluator: mockNumericEvaluator,
      planningEffectsSimulator: mockPlanningSimulator,
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

describe('GoalDistanceHeuristic - Numeric Constraints', () => {
  let testBed;
  let heuristic;
  let mockEvaluator;
  let mockNumericEvaluator;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockEvaluator = testBed.createMock('JsonLogicEvaluationService', ['evaluate']);
    mockNumericEvaluator = testBed.createMock('NumericConstraintEvaluator', [
      'isNumericConstraint',
      'calculateDistance',
    ]);
    const mockPlanningSimulator = testBed.createMock('IPlanningEffectsSimulator', [
      'simulateEffects',
    ]);

    heuristic = new GoalDistanceHeuristic({
      jsonLogicEvaluator: mockEvaluator,
      numericConstraintEvaluator: mockNumericEvaluator,
      planningEffectsSimulator: mockPlanningSimulator,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Numeric Distance Calculation', () => {
    it('should calculate numeric distance for goalState format', () => {
      const state = {
        'actor:core:needs': { hunger: 80 },
      };

      const goal = {
        goalState: { '<=': [{ var: 'state.actor:core:needs.hunger' }, 30] },
      };

      mockNumericEvaluator.isNumericConstraint.mockReturnValue(true);
      mockNumericEvaluator.calculateDistance.mockReturnValue(50);

      const result = heuristic.calculate(state, goal);

      expect(result).toBe(50);
      expect(mockNumericEvaluator.isNumericConstraint).toHaveBeenCalledWith(goal.goalState);
      expect(mockNumericEvaluator.calculateDistance).toHaveBeenCalledWith(goal.goalState, state);
      expect(mockEvaluator.evaluate).not.toHaveBeenCalled();
    });

    it('should return 0 when numeric constraint is already satisfied', () => {
      const state = {
        'actor:core:needs': { hunger: 20 },
      };

      const goal = {
        goalState: { '<=': [{ var: 'state.actor:core:needs.hunger' }, 30] },
      };

      mockNumericEvaluator.isNumericConstraint.mockReturnValue(true);
      mockNumericEvaluator.calculateDistance.mockReturnValue(0);

      const result = heuristic.calculate(state, goal);

      expect(result).toBe(0);
      expect(mockNumericEvaluator.isNumericConstraint).toHaveBeenCalled();
      expect(mockNumericEvaluator.calculateDistance).toHaveBeenCalled();
    });

    it('should handle >= numeric constraints correctly', () => {
      const state = {
        'actor:core:health': 40,
      };

      const goal = {
        goalState: { '>=': [{ var: 'state.actor:core:health' }, 80] },
      };

      mockNumericEvaluator.isNumericConstraint.mockReturnValue(true);
      mockNumericEvaluator.calculateDistance.mockReturnValue(40);

      const result = heuristic.calculate(state, goal);

      expect(result).toBe(40);
      expect(mockNumericEvaluator.calculateDistance).toHaveBeenCalledWith(goal.goalState, state);
    });
  });

  describe('Fallback Behavior', () => {
    it('should fall back to boolean evaluation when calculateDistance returns null', () => {
      const state = {
        'actor:core:needs': { hunger: 80 },
      };

      const goal = {
        goalState: { '<=': [{ var: 'state.actor:core:needs.hunger' }, 30] },
      };

      mockNumericEvaluator.isNumericConstraint.mockReturnValue(true);
      mockNumericEvaluator.calculateDistance.mockReturnValue(null);
      mockEvaluator.evaluate.mockReturnValue(false);

      const result = heuristic.calculate(state, goal);

      expect(result).toBe(1);
      expect(mockNumericEvaluator.isNumericConstraint).toHaveBeenCalled();
      expect(mockNumericEvaluator.calculateDistance).toHaveBeenCalled();
      expect(mockEvaluator.evaluate).toHaveBeenCalledWith(goal.goalState, { state });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('falling back to boolean evaluation')
      );
    });

    it('should fall back to boolean evaluation when calculateDistance returns undefined', () => {
      const state = {
        'actor:core:needs': { hunger: 80 },
      };

      const goal = {
        goalState: { '<=': [{ var: 'state.actor:core:needs.hunger' }, 30] },
      };

      mockNumericEvaluator.isNumericConstraint.mockReturnValue(true);
      mockNumericEvaluator.calculateDistance.mockReturnValue(undefined);
      mockEvaluator.evaluate.mockReturnValue(false);

      const result = heuristic.calculate(state, goal);

      expect(result).toBe(1);
      expect(mockEvaluator.evaluate).toHaveBeenCalled();
    });

    it('should return 0 when falling back to boolean and condition is satisfied', () => {
      const state = {
        'actor:core:needs': { hunger: 20 },
      };

      const goal = {
        goalState: { '<=': [{ var: 'state.actor:core:needs.hunger' }, 30] },
      };

      mockNumericEvaluator.isNumericConstraint.mockReturnValue(true);
      mockNumericEvaluator.calculateDistance.mockReturnValue(null);
      mockEvaluator.evaluate.mockReturnValue(true);

      const result = heuristic.calculate(state, goal);

      expect(result).toBe(0);
      expect(mockEvaluator.evaluate).toHaveBeenCalled();
    });
  });

  describe('Non-Numeric Goals', () => {
    it('should handle non-numeric goalState with existing boolean behavior', () => {
      const state = {
        'actor:core:fed': true,
      };

      const goal = {
        goalState: { has_component: ['actor', 'core:fed'] },
      };

      mockNumericEvaluator.isNumericConstraint.mockReturnValue(false);
      mockEvaluator.evaluate.mockReturnValue(true);

      const result = heuristic.calculate(state, goal);

      expect(result).toBe(0);
      expect(mockNumericEvaluator.isNumericConstraint).toHaveBeenCalledWith(goal.goalState);
      expect(mockNumericEvaluator.calculateDistance).not.toHaveBeenCalled();
      expect(mockEvaluator.evaluate).toHaveBeenCalledWith(goal.goalState, { state });
    });

    it('should return 1 for unsatisfied non-numeric goalState', () => {
      const state = {
        'actor:core:fed': false,
      };

      const goal = {
        goalState: { has_component: ['actor', 'core:fed'] },
      };

      mockNumericEvaluator.isNumericConstraint.mockReturnValue(false);
      mockEvaluator.evaluate.mockReturnValue(false);

      const result = heuristic.calculate(state, goal);

      expect(result).toBe(1);
      expect(mockEvaluator.evaluate).toHaveBeenCalled();
    });
  });

  describe('Legacy Conditions Format', () => {
    it('should handle conditions array format without numeric evaluation', () => {
      const state = {
        'actor:core:health': 40,
      };

      const goal = {
        conditions: [{ condition: { '>=': [{ var: 'state.actor:core:health' }, 80] } }],
      };

      mockEvaluator.evaluate.mockReturnValue(false);

      const result = heuristic.calculate(state, goal);

      expect(result).toBe(1);
      expect(mockNumericEvaluator.isNumericConstraint).not.toHaveBeenCalled();
      expect(mockNumericEvaluator.calculateDistance).not.toHaveBeenCalled();
      expect(mockEvaluator.evaluate).toHaveBeenCalled();
    });

    it('should count unsatisfied conditions in array format', () => {
      const state = {
        'actor:core:health': 40,
        'actor:core:needs': { hunger: 80 },
      };

      const goal = {
        conditions: [
          { condition: { '>=': [{ var: 'state.actor:core:health' }, 80] } },
          { condition: { '<=': [{ var: 'state.actor:core:needs.hunger' }, 30] } },
        ],
      };

      mockEvaluator.evaluate.mockReturnValue(false);

      const result = heuristic.calculate(state, goal);

      expect(result).toBe(2);
      expect(mockNumericEvaluator.isNumericConstraint).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle evaluation errors gracefully', () => {
      const state = {
        'actor:core:needs': { hunger: 80 },
      };

      const goal = {
        goalState: { '<=': [{ var: 'state.actor:core:needs.hunger' }, 30] },
      };

      mockNumericEvaluator.isNumericConstraint.mockReturnValue(true);
      mockNumericEvaluator.calculateDistance.mockImplementation(() => {
        throw new Error('Calculation error');
      });

      const result = heuristic.calculate(state, goal);

      expect(result).toBe(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to evaluate'));
    });

    it('should handle missing state properties', () => {
      const state = {};

      const goal = {
        goalState: { '<=': [{ var: 'state.actor:core:needs.hunger' }, 30] },
      };

      mockNumericEvaluator.isNumericConstraint.mockReturnValue(true);
      mockNumericEvaluator.calculateDistance.mockReturnValue(null);
      mockEvaluator.evaluate.mockReturnValue(false);

      const result = heuristic.calculate(state, goal);

      expect(result).toBe(1);
    });

    it('should handle extreme numeric values', () => {
      const state = {
        'actor:core:needs': { hunger: 1000 },
      };

      const goal = {
        goalState: { '<=': [{ var: 'state.actor:core:needs.hunger' }, 30] },
      };

      mockNumericEvaluator.isNumericConstraint.mockReturnValue(true);
      mockNumericEvaluator.calculateDistance.mockReturnValue(970);

      const result = heuristic.calculate(state, goal);

      expect(result).toBe(970);
    });

    it('should handle zero distance correctly', () => {
      const state = {
        'actor:core:needs': { hunger: 30 },
      };

      const goal = {
        goalState: { '<=': [{ var: 'state.actor:core:needs.hunger' }, 30] },
      };

      mockNumericEvaluator.isNumericConstraint.mockReturnValue(true);
      mockNumericEvaluator.calculateDistance.mockReturnValue(0);

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
    const mockNumericEvaluator = testBed.createMock('NumericConstraintEvaluator', [
      'isNumericConstraint',
      'calculateDistance',
    ]);
    const mockPlanningSimulator = testBed.createMock('IPlanningEffectsSimulator', [
      'simulateEffects',
    ]);

    expect(() => {
      new GoalDistanceHeuristic({
        jsonLogicEvaluator: null,
        numericConstraintEvaluator: mockNumericEvaluator,
        planningEffectsSimulator: mockPlanningSimulator,
        logger: mockLogger,
      });
    }).toThrow();

    expect(() => {
      new GoalDistanceHeuristic({
        jsonLogicEvaluator: {},
        numericConstraintEvaluator: mockNumericEvaluator,
        planningEffectsSimulator: mockPlanningSimulator,
        logger: mockLogger,
      });
    }).toThrow();
  });

  it('should validate numericConstraintEvaluator dependency', () => {
    const mockLogger = testBed.createMockLogger();
    const mockEvaluator = testBed.createMock('JsonLogicEvaluationService', ['evaluate']);
    const mockPlanningSimulator = testBed.createMock('IPlanningEffectsSimulator', [
      'simulateEffects',
    ]);

    expect(() => {
      new GoalDistanceHeuristic({
        jsonLogicEvaluator: mockEvaluator,
        numericConstraintEvaluator: null,
        planningEffectsSimulator: mockPlanningSimulator,
        logger: mockLogger,
      });
    }).toThrow();

    expect(() => {
      new GoalDistanceHeuristic({
        jsonLogicEvaluator: mockEvaluator,
        numericConstraintEvaluator: {},
        planningEffectsSimulator: mockPlanningSimulator,
        logger: mockLogger,
      });
    }).toThrow();
  });

  it('should use fallback logger if invalid logger provided', () => {
    const mockEvaluator = testBed.createMock('JsonLogicEvaluationService', ['evaluate']);
    const mockNumericEvaluator = testBed.createMock('NumericConstraintEvaluator', [
      'isNumericConstraint',
      'calculateDistance',
    ]);
    const mockPlanningSimulator = testBed.createMock('IPlanningEffectsSimulator', [
      'simulateEffects',
    ]);

    // ensureValidLogger creates a fallback instead of throwing
    const heuristic = new GoalDistanceHeuristic({
      jsonLogicEvaluator: mockEvaluator,
      numericConstraintEvaluator: mockNumericEvaluator,
      planningEffectsSimulator: mockPlanningSimulator,
      logger: null,
    });
    expect(heuristic).toBeDefined();
  });

  it('should construct successfully with valid dependencies', () => {
    const mockLogger = testBed.createMockLogger();
    const mockEvaluator = testBed.createMock('JsonLogicEvaluationService', ['evaluate']);
    const mockNumericEvaluator = testBed.createMock('NumericConstraintEvaluator', [
      'isNumericConstraint',
      'calculateDistance',
    ]);
    const mockPlanningSimulator = testBed.createMock('IPlanningEffectsSimulator', [
      'simulateEffects',
    ]);

    expect(() => {
      new GoalDistanceHeuristic({
        jsonLogicEvaluator: mockEvaluator,
        numericConstraintEvaluator: mockNumericEvaluator,
        planningEffectsSimulator: mockPlanningSimulator,
        logger: mockLogger,
      });
    }).not.toThrow();
  });
});

describe('GoalDistanceHeuristic - Enhanced Multi-Action Estimation', () => {
  let testBed;
  let heuristic;
  let mockEvaluator;
  let mockNumericEvaluator;
  let mockPlanningSimulator;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockEvaluator = testBed.createMock('JsonLogicEvaluationService', ['evaluate']);
    mockNumericEvaluator = testBed.createMock('NumericConstraintEvaluator', [
      'isNumericConstraint',
      'calculateDistance',
    ]);
    mockPlanningSimulator = testBed.createMock('IPlanningEffectsSimulator', [
      'simulateEffects',
    ]);

    heuristic = new GoalDistanceHeuristic({
      jsonLogicEvaluator: mockEvaluator,
      numericConstraintEvaluator: mockNumericEvaluator,
      planningEffectsSimulator: mockPlanningSimulator,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('calculate() with task context', () => {
    it('should estimate action count for single task', () => {
      // Scenario: hunger = 100, goal: ≤ 10, task: -60 hunger (cost 5)
      // Expected: ⌈90/60⌉ × 5 = 2 × 5 = 10
      const state = { 'actor:core:needs': { hunger: 100 } };
      const goal = {
        goalState: { '<=': [{ var: 'state.actor:core:needs.hunger' }, 10] },
      };
      const tasks = [
        {
          id: 'eat',
          cost: 5,
          planningEffects: [
            { op: 'MODIFY_COMPONENT', path: 'actor:core:needs', field: 'hunger' },
          ],
        },
      ];

      mockNumericEvaluator.isNumericConstraint.mockReturnValue(true);

      // Mock implementation that returns values based on call count
      // Note: #estimateTaskEffect is called TWICE - once in #findBestTaskForGoal, once after
      let callCount = 0;
      mockNumericEvaluator.calculateDistance.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return 90; // #calculateDistanceForGoalState (base distance)
        if (callCount === 2) return 90; // #findBestTaskForGoal → #estimateTaskEffect beforeDistance
        if (callCount === 3) return 30; // #findBestTaskForGoal → #estimateTaskEffect afterDistance
        if (callCount === 4) return 90; // #estimateTaskEffect (line 153) beforeDistance
        if (callCount === 5) return 30; // #estimateTaskEffect (line 153) afterDistance
        return 0; // Fallback
      });

      mockPlanningSimulator.simulateEffects.mockReturnValue({
        success: true,
        state: { 'actor:core:needs': { hunger: 40 } },
      });

      const result = heuristic.calculate(state, goal, tasks);

      expect(mockNumericEvaluator.calculateDistance).toHaveBeenCalledTimes(5);
      expect(mockPlanningSimulator.simulateEffects).toHaveBeenCalledTimes(2);
      expect(mockPlanningSimulator.simulateEffects).toHaveBeenCalledWith(
        state,
        tasks[0].planningEffects,
        expect.any(Object)
      );
      expect(result).toBe(10); // 2 actions × cost 5
    });

    it('should handle exact divisibility', () => {
      // Scenario: hunger = 100, goal: ≤ 0, task: -25 hunger (cost 5)
      // Expected: ⌈100/25⌉ × 5 = 4 × 5 = 20
      const state = { 'actor:core:needs': { hunger: 100 } };
      const goal = {
        goalState: { '<=': [{ var: 'state.actor:core:needs.hunger' }, 0] },
      };
      const tasks = [
        {
          id: 'eat_small',
          cost: 5,
          planningEffects: [
            { op: 'MODIFY_COMPONENT', path: 'actor:core:needs', field: 'hunger' },
          ],
        },
      ];

      mockNumericEvaluator.isNumericConstraint.mockReturnValue(true);

      // Mock implementation that returns values based on call count
      // Note: #estimateTaskEffect is called TWICE - once in #findBestTaskForGoal, once after
      let callCount = 0;
      mockNumericEvaluator.calculateDistance.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return 100; // #calculateDistanceForGoalState (base distance)
        if (callCount === 2) return 100; // #findBestTaskForGoal → #estimateTaskEffect beforeDistance
        if (callCount === 3) return 75; // #findBestTaskForGoal → #estimateTaskEffect afterDistance
        if (callCount === 4) return 100; // #estimateTaskEffect (line 153) beforeDistance
        if (callCount === 5) return 75; // #estimateTaskEffect (line 153) afterDistance
        return 0; // Fallback
      });

      mockPlanningSimulator.simulateEffects.mockReturnValue({
        success: true,
        state: { 'actor:core:needs': { hunger: 75 } },
      });

      const result = heuristic.calculate(state, goal, tasks);

      expect(mockNumericEvaluator.calculateDistance).toHaveBeenCalledTimes(5);
      expect(mockPlanningSimulator.simulateEffects).toHaveBeenCalledTimes(2);
      expect(result).toBe(20); // 4 actions × cost 5
    });

    it('should select most effective task', () => {
      // Two tasks: eat (-60), nibble (-10)
      // Should choose eat (more effective)
      const state = { 'actor:core:needs': { hunger: 100 } };
      const goal = {
        goalState: { '<=': [{ var: 'state.actor:core:needs.hunger' }, 10] },
      };
      const tasks = [
        {
          id: 'nibble',
          cost: 2,
          planningEffects: [{ op: 'MODIFY_COMPONENT' }],
        },
        {
          id: 'eat',
          cost: 5,
          planningEffects: [{ op: 'MODIFY_COMPONENT' }],
        },
      ];

      mockNumericEvaluator.isNumericConstraint.mockReturnValue(true);

      // Mock implementation for 2 tasks: 1 base + (2 tasks × 2 for finding) + 2 final = 7 calls
      let callCount = 0;
      mockNumericEvaluator.calculateDistance.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return 90; // #calculateDistanceForGoalState (base distance)
        if (callCount === 2) return 90; // #findBestTaskForGoal → nibble beforeDistance
        if (callCount === 3) return 80; // #findBestTaskForGoal → nibble afterDistance
        if (callCount === 4) return 90; // #findBestTaskForGoal → eat beforeDistance
        if (callCount === 5) return 30; // #findBestTaskForGoal → eat afterDistance
        if (callCount === 6) return 90; // #estimateTaskEffect (final) beforeDistance
        if (callCount === 7) return 30; // #estimateTaskEffect (final) afterDistance
        return 0; // Fallback
      });

      mockPlanningSimulator.simulateEffects
        .mockReturnValueOnce({
          success: true,
          state: { 'actor:core:needs': { hunger: 90 } },
        })
        .mockReturnValueOnce({
          success: true,
          state: { 'actor:core:needs': { hunger: 40 } },
        })
        .mockReturnValueOnce({
          success: true,
          state: { 'actor:core:needs': { hunger: 40 } },
        });

      const result = heuristic.calculate(state, goal, tasks);

      // Best task is 'eat' with effect 60
      // ⌈90/60⌉ × 5 = 2 × 5 = 10
      expect(mockNumericEvaluator.calculateDistance).toHaveBeenCalledTimes(7);
      expect(mockPlanningSimulator.simulateEffects).toHaveBeenCalledTimes(3);
      expect(result).toBe(10);
    });

    it('should fall back to distance when no tasks available', () => {
      const state = { 'actor:core:needs': { hunger: 100 } };
      const goal = {
        goalState: { '<=': [{ var: 'state.actor:core:needs.hunger' }, 10] },
      };
      const tasks = [];

      mockNumericEvaluator.isNumericConstraint.mockReturnValue(true);
      mockNumericEvaluator.calculateDistance.mockReturnValue(90);

      const result = heuristic.calculate(state, goal, tasks);

      expect(result).toBe(90); // Base distance
      expect(mockPlanningSimulator.simulateEffects).not.toHaveBeenCalled();
    });

    it('should be admissible (never overestimate)', () => {
      // Verify: heuristic ≤ actual optimal cost
      const state = { 'actor:core:needs': { hunger: 100 } };
      const goal = {
        goalState: { '<=': [{ var: 'state.actor:core:needs.hunger' }, 10] },
      };
      const tasks = [
        {
          id: 'eat',
          cost: 5,
          planningEffects: [{ op: 'MODIFY_COMPONENT' }],
        },
      ];

      mockNumericEvaluator.isNumericConstraint.mockReturnValue(true);

      // Mock implementation that returns values based on call count
      let callCount = 0;
      mockNumericEvaluator.calculateDistance.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return 90; // #calculateDistanceForGoalState (base distance)
        if (callCount === 2) return 90; // #findBestTaskForGoal → #estimateTaskEffect beforeDistance
        if (callCount === 3) return 30; // #findBestTaskForGoal → #estimateTaskEffect afterDistance
        if (callCount === 4) return 90; // #estimateTaskEffect (final) beforeDistance
        if (callCount === 5) return 30; // #estimateTaskEffect (final) afterDistance
        return 0; // Fallback
      });

      mockPlanningSimulator.simulateEffects.mockReturnValue({
        success: true,
        state: { 'actor:core:needs': { hunger: 40 } },
      });

      const heuristicCost = heuristic.calculate(state, goal, tasks);

      // Actual optimal: 2 actions × 5 = 10
      const actualOptimalCost = 10;

      expect(mockNumericEvaluator.calculateDistance).toHaveBeenCalledTimes(5);
      expect(mockPlanningSimulator.simulateEffects).toHaveBeenCalledTimes(2);
      expect(heuristicCost).toBeLessThanOrEqual(actualOptimalCost);
    });
  });

  describe('#findBestTaskForGoal()', () => {
    it('should return task with largest effect', () => {
      const state = { 'actor:core:needs': { hunger: 100 } };
      const goal = {
        goalState: { '<=': [{ var: 'state.actor:core:needs.hunger' }, 10] },
      };
      const tasks = [
        { id: 'nibble', cost: 2, planningEffects: [{ op: 'MODIFY_COMPONENT' }] },
        { id: 'eat', cost: 5, planningEffects: [{ op: 'MODIFY_COMPONENT' }] },
        { id: 'feast', cost: 10, planningEffects: [{ op: 'MODIFY_COMPONENT' }] },
      ];

      mockNumericEvaluator.isNumericConstraint.mockReturnValue(true);

      // Mock implementation for 3 tasks: 1 base + (3 tasks × 2 for finding) + 2 final = 9 calls
      let callCount = 0;
      mockNumericEvaluator.calculateDistance.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return 90; // #calculateDistanceForGoalState (base distance)
        if (callCount === 2) return 90; // #findBestTaskForGoal → nibble beforeDistance
        if (callCount === 3) return 80; // #findBestTaskForGoal → nibble afterDistance
        if (callCount === 4) return 90; // #findBestTaskForGoal → eat beforeDistance
        if (callCount === 5) return 30; // #findBestTaskForGoal → eat afterDistance
        if (callCount === 6) return 90; // #findBestTaskForGoal → feast beforeDistance
        if (callCount === 7) return 0; // #findBestTaskForGoal → feast afterDistance
        if (callCount === 8) return 90; // #estimateTaskEffect (final) beforeDistance
        if (callCount === 9) return 0; // #estimateTaskEffect (final) afterDistance
        return 0; // Fallback
      });

      mockPlanningSimulator.simulateEffects
        .mockReturnValueOnce({ success: true, state: {} })
        .mockReturnValueOnce({ success: true, state: {} })
        .mockReturnValueOnce({ success: true, state: {} })
        .mockReturnValueOnce({ success: true, state: {} });

      const result = heuristic.calculate(state, goal, tasks);

      // Best task is 'feast' with effect 90
      // ⌈90/90⌉ × 10 = 1 × 10 = 10
      expect(mockNumericEvaluator.calculateDistance).toHaveBeenCalledTimes(9);
      expect(mockPlanningSimulator.simulateEffects).toHaveBeenCalledTimes(4);
      expect(result).toBe(10);
    });

    it('should return null when no task reduces distance', () => {
      const state = { 'actor:core:needs': { hunger: 10 } };
      const goal = {
        goalState: { '<=': [{ var: 'state.actor:core:needs.hunger' }, 10] },
      };
      const tasks = [
        {
          id: 'make_hungrier',
          cost: 5,
          planningEffects: [{ op: 'MODIFY_COMPONENT' }],
        },
      ];

      mockNumericEvaluator.isNumericConstraint.mockReturnValue(true);
      mockNumericEvaluator.calculateDistance
        .mockReturnValueOnce(0) // Already satisfied
        .mockReturnValueOnce(50); // Task increases distance (wrong direction)

      mockPlanningSimulator.simulateEffects.mockReturnValue({
        success: true,
        state: { 'actor:core:needs': { hunger: 60 } },
      });

      const result = heuristic.calculate(state, goal, tasks);

      // Goal already satisfied, returns 0
      expect(result).toBe(0);
    });
  });

  describe('#estimateTaskEffect()', () => {
    it('should calculate distance reduction correctly', () => {
      const state = { 'actor:core:needs': { hunger: 100 } };
      const goal = {
        goalState: { '<=': [{ var: 'state.actor:core:needs.hunger' }, 10] },
      };
      const tasks = [
        {
          id: 'eat',
          cost: 5,
          planningEffects: [{ op: 'MODIFY_COMPONENT' }],
        },
      ];

      mockNumericEvaluator.isNumericConstraint.mockReturnValue(true);

      // Mock implementation that returns values based on call count
      let callCount = 0;
      mockNumericEvaluator.calculateDistance.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return 90; // #calculateDistanceForGoalState (base distance)
        if (callCount === 2) return 90; // #findBestTaskForGoal → #estimateTaskEffect beforeDistance
        if (callCount === 3) return 30; // #findBestTaskForGoal → #estimateTaskEffect afterDistance
        if (callCount === 4) return 90; // #estimateTaskEffect (final) beforeDistance
        if (callCount === 5) return 30; // #estimateTaskEffect (final) afterDistance
        return 0; // Fallback
      });

      mockPlanningSimulator.simulateEffects.mockReturnValue({
        success: true,
        state: { 'actor:core:needs': { hunger: 40 } },
      });

      const result = heuristic.calculate(state, goal, tasks);

      // Effect = 90 - 30 = 60
      // ⌈90/60⌉ × 5 = 2 × 5 = 10
      expect(mockNumericEvaluator.calculateDistance).toHaveBeenCalledTimes(5);
      expect(mockPlanningSimulator.simulateEffects).toHaveBeenCalledTimes(2);
      expect(result).toBe(10);
    });

    it('should handle zero effect', () => {
      const state = { 'actor:core:needs': { hunger: 100 } };
      const goal = {
        goalState: { '<=': [{ var: 'state.actor:core:needs.hunger' }, 10] },
      };
      const tasks = [
        {
          id: 'no_effect',
          cost: 5,
          planningEffects: [{ op: 'MODIFY_COMPONENT' }],
        },
      ];

      mockNumericEvaluator.isNumericConstraint.mockReturnValue(true);
      mockNumericEvaluator.calculateDistance
        .mockReturnValueOnce(90)
        .mockReturnValueOnce(90); // No change

      mockPlanningSimulator.simulateEffects.mockReturnValue({
        success: true,
        state: { 'actor:core:needs': { hunger: 100 } },
      });

      const result = heuristic.calculate(state, goal, tasks);

      // Task has no effect, fall back to base distance
      expect(result).toBe(90);
    });

    it('should handle wrong direction (negative effect)', () => {
      const state = { 'actor:core:needs': { hunger: 50 } };
      const goal = {
        goalState: { '<=': [{ var: 'state.actor:core:needs.hunger' }, 10] },
      };
      const tasks = [
        {
          id: 'make_hungrier',
          cost: 5,
          planningEffects: [{ op: 'MODIFY_COMPONENT' }],
        },
      ];

      mockNumericEvaluator.isNumericConstraint.mockReturnValue(true);
      mockNumericEvaluator.calculateDistance
        .mockReturnValueOnce(40) // Before
        .mockReturnValueOnce(80); // After (worse!)

      mockPlanningSimulator.simulateEffects.mockReturnValue({
        success: true,
        state: { 'actor:core:needs': { hunger: 90 } },
      });

      const result = heuristic.calculate(state, goal, tasks);

      // Task increases distance, effect = max(0, 40 - 80) = 0
      // Fall back to base distance
      expect(result).toBe(40);
    });

    it('should skip tasks without planning effects', () => {
      const state = { 'actor:core:needs': { hunger: 100 } };
      const goal = {
        goalState: { '<=': [{ var: 'state.actor:core:needs.hunger' }, 10] },
      };
      const tasks = [
        { id: 'no_effects', cost: 5 }, // No planningEffects field
      ];

      mockNumericEvaluator.isNumericConstraint.mockReturnValue(true);
      mockNumericEvaluator.calculateDistance.mockReturnValue(90);

      const result = heuristic.calculate(state, goal, tasks);

      // No task can reduce distance, fall back to base distance
      expect(result).toBe(90);
      expect(mockPlanningSimulator.simulateEffects).not.toHaveBeenCalled();
    });

    it('should handle simulation failure', () => {
      const state = { 'actor:core:needs': { hunger: 100 } };
      const goal = {
        goalState: { '<=': [{ var: 'state.actor:core:needs.hunger' }, 10] },
      };
      const tasks = [
        {
          id: 'eat',
          cost: 5,
          planningEffects: [{ op: 'MODIFY_COMPONENT' }],
        },
      ];

      mockNumericEvaluator.isNumericConstraint.mockReturnValue(true);
      mockNumericEvaluator.calculateDistance.mockReturnValue(90);

      mockPlanningSimulator.simulateEffects.mockReturnValue({
        success: false,
        errors: ['Simulation error'],
      });

      const result = heuristic.calculate(state, goal, tasks);

      // Simulation failed, fall back to base distance
      expect(result).toBe(90);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Task simulation failed during effect estimation',
        expect.any(Object)
      );
    });
  });

  describe('Non-numeric constraints', () => {
    it('should use base distance for boolean constraints', () => {
      const state = { 'actor:core:fed': false };
      const goal = {
        goalState: { has_component: ['actor', 'core:fed'] },
      };
      const tasks = [
        {
          id: 'eat',
          cost: 5,
          planningEffects: [{ op: 'ADD_COMPONENT' }],
        },
      ];

      mockNumericEvaluator.isNumericConstraint.mockReturnValue(false);
      mockEvaluator.evaluate.mockReturnValue(false);

      const result = heuristic.calculate(state, goal, tasks);

      // Boolean constraint, no enhanced estimation
      expect(result).toBe(1);
      expect(mockPlanningSimulator.simulateEffects).not.toHaveBeenCalled();
    });
  });

  describe('Default task cost', () => {
    it('should use cost 1 when task has no cost field', () => {
      const state = { 'actor:core:needs': { hunger: 100 } };
      const goal = {
        goalState: { '<=': [{ var: 'state.actor:core:needs.hunger' }, 10] },
      };
      const tasks = [
        {
          id: 'eat',
          // No cost field
          planningEffects: [{ op: 'MODIFY_COMPONENT' }],
        },
      ];

      mockNumericEvaluator.isNumericConstraint.mockReturnValue(true);

      // Mock implementation that returns values based on call count
      let callCount = 0;
      mockNumericEvaluator.calculateDistance.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return 90; // #calculateDistanceForGoalState (base distance)
        if (callCount === 2) return 90; // #findBestTaskForGoal → #estimateTaskEffect beforeDistance
        if (callCount === 3) return 30; // #findBestTaskForGoal → #estimateTaskEffect afterDistance
        if (callCount === 4) return 90; // #estimateTaskEffect (final) beforeDistance
        if (callCount === 5) return 30; // #estimateTaskEffect (final) afterDistance
        return 0; // Fallback
      });

      mockPlanningSimulator.simulateEffects.mockReturnValue({
        success: true,
        state: { 'actor:core:needs': { hunger: 40 } },
      });

      const result = heuristic.calculate(state, goal, tasks);

      // ⌈90/60⌉ × 1 = 2 × 1 = 2 (default cost is 1)
      expect(mockNumericEvaluator.calculateDistance).toHaveBeenCalledTimes(5);
      expect(mockPlanningSimulator.simulateEffects).toHaveBeenCalledTimes(2);
      expect(result).toBe(2);
    });
  });

  describe('Constructor validation', () => {
    it('should validate planningEffectsSimulator dependency', () => {
      const mockLogger = testBed.createMockLogger();
      const mockEvaluator = testBed.createMock('JsonLogicEvaluationService', ['evaluate']);
      const mockNumericEvaluator = testBed.createMock('NumericConstraintEvaluator', [
        'isNumericConstraint',
        'calculateDistance',
      ]);

      expect(() => {
        new GoalDistanceHeuristic({
          jsonLogicEvaluator: mockEvaluator,
          numericConstraintEvaluator: mockNumericEvaluator,
          planningEffectsSimulator: null,
          logger: mockLogger,
        });
      }).toThrow();

      expect(() => {
        new GoalDistanceHeuristic({
          jsonLogicEvaluator: mockEvaluator,
          numericConstraintEvaluator: mockNumericEvaluator,
          planningEffectsSimulator: {},
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should construct successfully with all dependencies', () => {
      const mockLogger = testBed.createMockLogger();
      const mockEvaluator = testBed.createMock('JsonLogicEvaluationService', ['evaluate']);
      const mockNumericEvaluator = testBed.createMock('NumericConstraintEvaluator', [
        'isNumericConstraint',
        'calculateDistance',
      ]);
      const mockSimulator = testBed.createMock('IPlanningEffectsSimulator', [
        'simulateEffects',
      ]);

      expect(() => {
        new GoalDistanceHeuristic({
          jsonLogicEvaluator: mockEvaluator,
          numericConstraintEvaluator: mockNumericEvaluator,
          planningEffectsSimulator: mockSimulator,
          logger: mockLogger,
        });
      }).not.toThrow();
    });
  });
});
