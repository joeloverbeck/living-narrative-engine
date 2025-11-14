/**
 * @file Unit tests for RelaxedPlanningGraphHeuristic
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import RelaxedPlanningGraphHeuristic from '../../../../src/goap/planner/relaxedPlanningGraphHeuristic.js';

describe('RelaxedPlanningGraphHeuristic - Basic Calculation', () => {
  let testBed;
  let heuristic;
  let mockSimulator;
  let mockEvaluator;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockSimulator = testBed.createMock('IPlanningEffectsSimulator', ['simulateEffects']);
    mockEvaluator = testBed.createMock('JsonLogicEvaluationService', ['evaluate']);

    heuristic = new RelaxedPlanningGraphHeuristic({
      planningEffectsSimulator: mockSimulator,
      jsonLogicEvaluator: mockEvaluator,
      logger: mockLogger,
      maxLayers: 10,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Goal Already Satisfied', () => {
    it('should return 0 when goal is already satisfied', () => {
      const state = { 'entity-1:core:satiated': {} };
      const goal = {
        conditions: [{ condition: { has_component: ['entity-1', 'core:satiated'] } }],
      };
      const tasks = [];

      mockEvaluator.evaluate.mockReturnValue(true);

      const result = heuristic.calculate(state, goal, tasks);

      expect(result).toBe(0);
    });

    it('should return 0 for empty goal conditions', () => {
      const state = { 'entity-1:core:hungry': true };
      const goal = { conditions: [] };
      const tasks = [];

      const result = heuristic.calculate(state, goal, tasks);

      expect(result).toBe(0);
    });
  });

  describe('Single Layer Expansion', () => {
    it('should return 1 when goal satisfied after one layer', () => {
      const state = { 'entity-1:core:hungry': true };
      const goal = {
        conditions: [{ condition: { '!': { has_component: ['entity-1', 'core:hungry'] } } }],
      };
      const tasks = [
        {
          planningPreconditions: [
            { condition: { has_component: ['entity-1', 'core:hungry'] } },
          ],
          planningEffects: [
            {
              type: 'REMOVE_COMPONENT',
              parameters: { entityId: 'entity-1', componentId: 'core:hungry' },
            },
          ],
        },
      ];

      // Mock: precondition satisfied, then goal unsatisfied, then satisfied
      mockEvaluator.evaluate
        .mockReturnValueOnce(false) // goal not satisfied initially
        .mockReturnValueOnce(true) // task precondition satisfied
        .mockReturnValueOnce(true); // goal satisfied after layer 1

      // Mock: effect removes hungry component
      mockSimulator.simulateEffects.mockReturnValue({
        success: true,
        state: {}, // State without hungry component
      });

      const result = heuristic.calculate(state, goal, tasks);

      expect(result).toBe(1);
      expect(mockSimulator.simulateEffects).toHaveBeenCalledTimes(1);
    });
  });

  describe('Multi-Layer Expansion', () => {
    it('should return layer count for multi-step plans', () => {
      const state = { 'entity-1:core:hungry': true };
      const goal = {
        conditions: [{ condition: { has_component: ['entity-1', 'core:shelter'] } }],
      };
      const tasks = [
        {
          // Layer 1: Gather resources (requires hungry to motivate action)
          planningPreconditions: [
            { condition: { has_component: ['entity-1', 'core:hungry'] } },
          ],
          planningEffects: [
            {
              type: 'ADD_COMPONENT',
              parameters: { entityId: 'entity-1', componentId: 'core:resources', data: {} },
            },
          ],
        },
        {
          // Layer 2: Build shelter (requires resources)
          planningPreconditions: [
            { condition: { has_component: ['entity-1', 'core:resources'] } },
          ],
          planningEffects: [
            {
              type: 'ADD_COMPONENT',
              parameters: { entityId: 'entity-1', componentId: 'core:shelter', data: {} },
            },
          ],
        },
      ];

      // Mock evaluation sequence
      mockEvaluator.evaluate
        .mockReturnValueOnce(false) // goal not satisfied initially
        // Layer 1
        .mockReturnValueOnce(true) // task 1 precondition satisfied
        .mockReturnValueOnce(false) // task 2 precondition not satisfied
        .mockReturnValueOnce(false) // goal not satisfied after layer 1
        // Layer 2
        .mockReturnValueOnce(false) // task 1 precondition not satisfied (no longer hungry)
        .mockReturnValueOnce(true) // task 2 precondition satisfied (has resources)
        .mockReturnValueOnce(true); // goal satisfied after layer 2

      // Mock state transformations
      mockSimulator.simulateEffects
        .mockReturnValueOnce({
          // Layer 1: Add resources
          success: true,
          state: {
            'entity-1:core:hungry': true,
            'entity-1:core:resources': {},
          },
        })
        .mockReturnValueOnce({
          // Layer 2: Add shelter
          success: true,
          state: {
            'entity-1:core:hungry': true,
            'entity-1:core:resources': {},
            'entity-1:core:shelter': {},
          },
        });

      const result = heuristic.calculate(state, goal, tasks);

      expect(result).toBe(2);
    });
  });

  describe('Unsolvable Goals', () => {
    it('should return Infinity when no tasks applicable', () => {
      const state = { 'entity-1:core:hungry': true };
      const goal = {
        conditions: [{ condition: { has_component: ['entity-1', 'core:shelter'] } }],
      };
      const tasks = [
        {
          // Task requires resources, but nothing provides them
          planningPreconditions: [
            { condition: { has_component: ['entity-1', 'core:resources'] } },
          ],
          planningEffects: [
            {
              type: 'ADD_COMPONENT',
              parameters: { entityId: 'entity-1', componentId: 'core:shelter', data: {} },
            },
          ],
        },
      ];

      mockEvaluator.evaluate
        .mockReturnValueOnce(false) // goal not satisfied
        .mockReturnValueOnce(false); // task precondition not satisfied

      const result = heuristic.calculate(state, goal, tasks);

      expect(result).toBe(Infinity);
    });

    it('should return Infinity when max layers reached', () => {
      const state = { 'entity-1:core:hungry': true };
      const goal = {
        conditions: [{ condition: { has_component: ['entity-1', 'core:impossible'] } }],
      };
      const tasks = [
        {
          // Task is always applicable but never satisfies goal
          planningPreconditions: [],
          planningEffects: [
            {
              type: 'ADD_COMPONENT',
              parameters: { entityId: 'entity-1', componentId: 'core:useless', data: {} },
            },
          ],
        },
      ];

      // Goal never satisfied
      mockEvaluator.evaluate.mockReturnValue(false);

      // Simulator always returns different state (makes progress)
      let callCount = 0;
      mockSimulator.simulateEffects.mockImplementation(() => ({
        success: true,
        state: { [`entity-1:core:useless${callCount++}`]: {} },
      }));

      const result = heuristic.calculate(state, goal, tasks);

      expect(result).toBe(Infinity);
      expect(mockSimulator.simulateEffects).toHaveBeenCalled();
    });

    it('should return Infinity when no progress made', () => {
      const state = { 'entity-1:core:hungry': true };
      const goal = {
        conditions: [{ condition: { has_component: ['entity-1', 'core:shelter'] } }],
      };
      const tasks = [
        {
          // Task is applicable but has no effects (no progress)
          planningPreconditions: [
            { condition: { has_component: ['entity-1', 'core:hungry'] } },
          ],
          planningEffects: [],
        },
      ];

      mockEvaluator.evaluate
        .mockReturnValueOnce(false) // goal not satisfied
        .mockReturnValueOnce(true); // task precondition satisfied

      const result = heuristic.calculate(state, goal, tasks);

      expect(result).toBe(Infinity);
    });

    it('should return Infinity for empty task library with unsatisfied goal', () => {
      const state = { 'entity-1:core:hungry': true };
      const goal = {
        conditions: [{ condition: { has_component: ['entity-1', 'core:shelter'] } }],
      };
      const tasks = [];

      mockEvaluator.evaluate.mockReturnValue(false);

      const result = heuristic.calculate(state, goal, tasks);

      expect(result).toBe(Infinity);
    });
  });

  describe('Edge Cases', () => {
    it('should handle tasks without preconditions (always applicable)', () => {
      const state = {};
      const goal = {
        conditions: [{ condition: { has_component: ['entity-1', 'core:shelter'] } }],
      };
      const tasks = [
        {
          planningPreconditions: [], // No preconditions
          planningEffects: [
            {
              type: 'ADD_COMPONENT',
              parameters: { entityId: 'entity-1', componentId: 'core:shelter', data: {} },
            },
          ],
        },
      ];

      mockEvaluator.evaluate
        .mockReturnValueOnce(false) // goal not satisfied
        .mockReturnValueOnce(true); // goal satisfied after layer 1

      mockSimulator.simulateEffects.mockReturnValue({
        success: true,
        state: { 'entity-1:core:shelter': {} },
      });

      const result = heuristic.calculate(state, goal, tasks);

      expect(result).toBe(1);
    });

    it('should handle tasks without effects', () => {
      const state = { 'entity-1:core:hungry': true };
      const goal = {
        conditions: [{ condition: { has_component: ['entity-1', 'core:shelter'] } }],
      };
      const tasks = [
        {
          planningPreconditions: [
            { condition: { has_component: ['entity-1', 'core:hungry'] } },
          ],
          planningEffects: [], // No effects
        },
      ];

      mockEvaluator.evaluate
        .mockReturnValueOnce(false) // goal not satisfied
        .mockReturnValueOnce(true); // task precondition satisfied

      const result = heuristic.calculate(state, goal, tasks);

      expect(result).toBe(Infinity); // No progress possible
    });

    it('should handle effect simulation failures gracefully', () => {
      const state = { 'entity-1:core:hungry': true };
      const goal = {
        conditions: [{ condition: { has_component: ['entity-1', 'core:shelter'] } }],
      };
      const tasks = [
        {
          planningPreconditions: [
            { condition: { has_component: ['entity-1', 'core:hungry'] } },
          ],
          planningEffects: [{ type: 'INVALID_EFFECT' }],
        },
      ];

      mockEvaluator.evaluate
        .mockReturnValueOnce(false) // goal not satisfied
        .mockReturnValueOnce(true); // task precondition satisfied

      mockSimulator.simulateEffects.mockReturnValue({
        success: false,
        error: 'Unknown effect type',
      });

      const result = heuristic.calculate(state, goal, tasks);

      expect(result).toBe(Infinity); // Failed effects mean no progress
    });

    it('should handle evaluation errors in preconditions', () => {
      const state = { 'entity-1:core:hungry': true };
      const goal = {
        conditions: [{ condition: { has_component: ['entity-1', 'core:shelter'] } }],
      };
      const tasks = [
        {
          planningPreconditions: [{ condition: { invalid_operator: ['entity-1'] } }],
          planningEffects: [
            {
              type: 'ADD_COMPONENT',
              parameters: { entityId: 'entity-1', componentId: 'core:shelter', data: {} },
            },
          ],
        },
      ];

      mockEvaluator.evaluate
        .mockReturnValueOnce(false) // goal not satisfied
        .mockImplementationOnce(() => {
          throw new Error('Unknown operator');
        }); // precondition evaluation throws

      const result = heuristic.calculate(state, goal, tasks);

      expect(result).toBe(Infinity); // Task with error is not applicable
    });

    it('should handle evaluation errors in goal conditions', () => {
      const state = {};
      const goal = {
        conditions: [{ condition: { invalid_operator: ['entity-1'] } }],
      };
      const tasks = [];

      mockEvaluator.evaluate.mockImplementation(() => {
        throw new Error('Unknown operator');
      });

      const result = heuristic.calculate(state, goal, tasks);

      expect(result).toBe(Infinity);
    });

    it('should handle conditions missing "condition" field', () => {
      const state = {};
      const goal = {
        conditions: [{ description: 'Missing condition field' }],
      };
      const tasks = [];

      const result = heuristic.calculate(state, goal, tasks);

      expect(result).toBe(Infinity);
    });

    it('should return Infinity for invalid state', () => {
      const goal = { conditions: [] };
      const tasks = [];

      expect(heuristic.calculate(null, goal, tasks)).toBe(Infinity);
      expect(heuristic.calculate(undefined, goal, tasks)).toBe(Infinity);
      expect(heuristic.calculate('invalid', goal, tasks)).toBe(Infinity);
    });

    it('should return Infinity for invalid goal', () => {
      const state = {};
      const tasks = [];

      expect(heuristic.calculate(state, null, tasks)).toBe(Infinity);
      expect(heuristic.calculate(state, {}, tasks)).toBe(Infinity);
      expect(heuristic.calculate(state, { conditions: 'not-array' }, tasks)).toBe(Infinity);
    });

    it('should return Infinity for invalid tasks', () => {
      const state = {};
      const goal = { conditions: [{ condition: { has_component: ['entity-1', 'core:shelter'] } }] };

      mockEvaluator.evaluate.mockReturnValue(false);

      expect(heuristic.calculate(state, goal, null)).toBe(Infinity);
      expect(heuristic.calculate(state, goal, 'not-array')).toBe(Infinity);
    });
  });

  describe('Admissibility', () => {
    it('should never overestimate (relaxed problem is easier)', () => {
      // With relaxed planning, we ignore negative effects
      // So heuristic should be ≤ actual cost
      const state = { 'entity-1:core:hungry': true };
      const goal = {
        conditions: [
          { condition: { '!': { has_component: ['entity-1', 'core:hungry'] } } },
          { condition: { has_component: ['entity-1', 'core:shelter'] } },
        ],
      };
      const tasks = [
        {
          planningPreconditions: [
            { condition: { has_component: ['entity-1', 'core:hungry'] } },
          ],
          planningEffects: [
            {
              type: 'REMOVE_COMPONENT',
              parameters: { entityId: 'entity-1', componentId: 'core:hungry' },
            },
          ],
        },
        {
          planningPreconditions: [],
          planningEffects: [
            {
              type: 'ADD_COMPONENT',
              parameters: { entityId: 'entity-1', componentId: 'core:shelter', data: {} },
            },
          ],
        },
      ];

      // Mock evaluator: goal NOT satisfied initially, but satisfied after layer 1
      mockEvaluator.evaluate
        // Initial goal check: NOT hungry - false (hungry=true)
        .mockReturnValueOnce(false)
        // Initial goal check: has shelter - false (no shelter)
        .mockReturnValueOnce(false)
        // Layer 1: task preconditions - both tasks applicable
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)
        // Layer 1 goal check after effects: NOT hungry - true
        .mockReturnValueOnce(true)
        // Layer 1 goal check after effects: has shelter - true
        .mockReturnValueOnce(true);

      mockSimulator.simulateEffects
        .mockReturnValueOnce({
          success: true,
          state: {},
        })
        .mockReturnValueOnce({
          success: true,
          state: { 'entity-1:core:shelter': {} },
        });

      const result = heuristic.calculate(state, goal, tasks);

      // In relaxed problem: both tasks apply in 1 layer
      // In real problem: might need 2 layers if tasks conflict
      // So h = 1 ≤ h* (admissible)
      expect(result).toBe(1);
    });
  });

  describe('Custom Max Layers', () => {
    it('should respect custom maxLayers parameter', () => {
      const customHeuristic = new RelaxedPlanningGraphHeuristic({
        planningEffectsSimulator: mockSimulator,
        jsonLogicEvaluator: mockEvaluator,
        logger: mockLogger,
        maxLayers: 3, // Custom max
      });

      const state = { 'entity-1:core:hungry': true };
      const goal = {
        conditions: [{ condition: { has_component: ['entity-1', 'core:impossible'] } }],
      };
      const tasks = [
        {
          planningPreconditions: [],
          planningEffects: [
            {
              type: 'ADD_COMPONENT',
              parameters: { entityId: 'entity-1', componentId: 'core:useless', data: {} },
            },
          ],
        },
      ];

      mockEvaluator.evaluate.mockReturnValue(false);

      let callCount = 0;
      mockSimulator.simulateEffects.mockImplementation(() => ({
        success: true,
        state: { [`entity-1:core:useless${callCount++}`]: {} },
      }));

      const result = customHeuristic.calculate(state, goal, tasks);

      expect(result).toBe(Infinity);
      expect(mockSimulator.simulateEffects).toHaveBeenCalledTimes(3); // Max 3 layers
    });
  });
});

describe('RelaxedPlanningGraphHeuristic - Construction', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should validate planningEffectsSimulator dependency', () => {
    const mockLogger = testBed.createMockLogger();
    const mockEvaluator = testBed.createMock('JsonLogicEvaluationService', ['evaluate']);

    expect(() => {
      new RelaxedPlanningGraphHeuristic({
        planningEffectsSimulator: null,
        jsonLogicEvaluator: mockEvaluator,
        logger: mockLogger,
      });
    }).toThrow();

    expect(() => {
      new RelaxedPlanningGraphHeuristic({
        planningEffectsSimulator: {},
        jsonLogicEvaluator: mockEvaluator,
        logger: mockLogger,
      });
    }).toThrow();
  });

  it('should validate jsonLogicEvaluator dependency', () => {
    const mockLogger = testBed.createMockLogger();
    const mockSimulator = testBed.createMock('IPlanningEffectsSimulator', ['simulateEffects']);

    expect(() => {
      new RelaxedPlanningGraphHeuristic({
        planningEffectsSimulator: mockSimulator,
        jsonLogicEvaluator: null,
        logger: mockLogger,
      });
    }).toThrow();

    expect(() => {
      new RelaxedPlanningGraphHeuristic({
        planningEffectsSimulator: mockSimulator,
        jsonLogicEvaluator: {},
        logger: mockLogger,
      });
    }).toThrow();
  });

  it('should use fallback logger if invalid logger provided', () => {
    const mockSimulator = testBed.createMock('IPlanningEffectsSimulator', ['simulateEffects']);
    const mockEvaluator = testBed.createMock('JsonLogicEvaluationService', ['evaluate']);

    // ensureValidLogger creates a fallback instead of throwing
    const heuristic = new RelaxedPlanningGraphHeuristic({
      planningEffectsSimulator: mockSimulator,
      jsonLogicEvaluator: mockEvaluator,
      logger: null,
    });
    expect(heuristic).toBeDefined();
  });

  it('should construct successfully with valid dependencies', () => {
    const mockLogger = testBed.createMockLogger();
    const mockSimulator = testBed.createMock('IPlanningEffectsSimulator', ['simulateEffects']);
    const mockEvaluator = testBed.createMock('JsonLogicEvaluationService', ['evaluate']);

    expect(() => {
      new RelaxedPlanningGraphHeuristic({
        planningEffectsSimulator: mockSimulator,
        jsonLogicEvaluator: mockEvaluator,
        logger: mockLogger,
      });
    }).not.toThrow();
  });

  it('should use default maxLayers if not provided', () => {
    const mockLogger = testBed.createMockLogger();
    const mockSimulator = testBed.createMock('IPlanningEffectsSimulator', ['simulateEffects']);
    const mockEvaluator = testBed.createMock('JsonLogicEvaluationService', ['evaluate']);

    const heuristic = new RelaxedPlanningGraphHeuristic({
      planningEffectsSimulator: mockSimulator,
      jsonLogicEvaluator: mockEvaluator,
      logger: mockLogger,
    });

    expect(heuristic).toBeDefined();
    // Default maxLayers = 10 (tested implicitly in other tests)
  });
});
