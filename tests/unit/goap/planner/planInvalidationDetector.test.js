/**
 * @file Unit tests for PlanInvalidationDetector
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import PlanInvalidationDetector from '../../../../src/goap/planner/planInvalidationDetector.js';

describe('PlanInvalidationDetector - Constructor', () => {
  it('should construct with valid dependencies', () => {
    const mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const mockJsonLogicService = {
      evaluate: jest.fn(),
    };

    const mockRegistry = {
      get: jest.fn(),
      getAll: jest.fn(),
    };

    const detector = new PlanInvalidationDetector({
      logger: mockLogger,
      jsonLogicEvaluationService: mockJsonLogicService,
      dataRegistry: mockRegistry,
    });

    expect(detector).toBeInstanceOf(PlanInvalidationDetector);
    expect(mockLogger.info).toHaveBeenCalledWith('PlanInvalidationDetector initialized');
  });

  it('should throw if JsonLogicEvaluationService missing evaluate method', () => {
    const mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const invalidService = {}; // Missing evaluate method

    const mockRegistry = {
      get: jest.fn(),
      getAll: jest.fn(),
    };

    expect(() => {
      new PlanInvalidationDetector({
        logger: mockLogger,
        jsonLogicEvaluationService: invalidService,
        dataRegistry: mockRegistry,
      });
    }).toThrow();
  });

  it('should throw if DataRegistry missing get method', () => {
    const mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const mockJsonLogicService = {
      evaluate: jest.fn(),
    };

    const invalidRegistry = {}; // Missing get and getAll methods

    expect(() => {
      new PlanInvalidationDetector({
        logger: mockLogger,
        jsonLogicEvaluationService: mockJsonLogicService,
        dataRegistry: invalidRegistry,
      });
    }).toThrow();
  });
});

describe('PlanInvalidationDetector - Precondition Re-checking', () => {
  let detector;
  let mockLogger;
  let mockJsonLogicService;
  let mockRegistry;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockJsonLogicService = {
      evaluate: jest.fn(),
    };

    mockRegistry = {
      get: jest.fn(),
      getAll: jest.fn(),
    };

    detector = new PlanInvalidationDetector({
      logger: mockLogger,
      jsonLogicEvaluationService: mockJsonLogicService,
      dataRegistry: mockRegistry,
    });
  });

  it('should detect valid plan with satisfied preconditions', () => {
    // Setup: Plan with single task
    const plan = {
      tasks: [
        { taskId: 'core:consume_item', parameters: { target: 'apple-456' } },
      ],
      cost: 1,
      nodesExplored: 5,
    };

    // Setup: Current state with item in inventory
    const currentState = {
      'actor-123:core:inventory': 'apple-456',
    };

    // Setup: Task definition with satisfied precondition
    mockRegistry.get.mockReturnValue({
      id: 'core:consume_item',
      planningPreconditions: [
        {
          description: 'Actor has item',
          condition: { '==': [{ var: 'actor-123.core.inventory' }, 'apple-456'] },
        },
      ],
    });

    // Mock: Precondition evaluates to true
    mockJsonLogicService.evaluate.mockReturnValue(true);

    // Act
    const result = detector.checkPlanValidity(plan, currentState, { actorId: 'actor-123' }, 'strict');

    // Assert
    expect(result.valid).toBe(true);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].allPreconditionsSatisfied).toBe(true);
  });

  it('should detect invalid plan when precondition violated', () => {
    // Setup: Plan with single task
    const plan = {
      tasks: [
        { taskId: 'core:consume_item', parameters: { target: 'apple-456' } },
      ],
      cost: 1,
      nodesExplored: 5,
    };

    // Setup: Current state without item
    const currentState = {
      'actor-123:core:inventory': null,
    };

    // Setup: Task definition with violated precondition
    mockRegistry.get.mockReturnValue({
      id: 'core:consume_item',
      planningPreconditions: [
        {
          description: 'Actor has item',
          condition: { '==': [{ var: 'actor-123.core.inventory' }, 'apple-456'] },
        },
      ],
    });

    // Mock: Precondition evaluates to false
    mockJsonLogicService.evaluate.mockReturnValue(false);

    // Act
    const result = detector.checkPlanValidity(plan, currentState, { actorId: 'actor-123' }, 'strict');

    // Assert
    expect(result.valid).toBe(false);
    expect(result.invalidatedAt).toBe(0);
    expect(result.task).toBe('core:consume_item');
    expect(result.reason).toBe('precondition_violated');
    expect(result.description).toBe('Actor has item');
  });

  it('should check all tasks in strict policy', () => {
    // Setup: Plan with three tasks
    const plan = {
      tasks: [
        { taskId: 'core:task1', parameters: {} },
        { taskId: 'core:task2', parameters: {} },
        { taskId: 'core:task3', parameters: {} },
      ],
      cost: 3,
      nodesExplored: 10,
    };

    const currentState = {};

    // Setup: Task definitions with no preconditions
    mockRegistry.get.mockImplementation((type, id) => {
      const tasks = {
        'core:task1': { id: 'core:task1' },
        'core:task2': { id: 'core:task2' },
        'core:task3': { id: 'core:task3' },
      };
      return tasks[id];
    });

    // Act
    const result = detector.checkPlanValidity(plan, currentState, { actorId: 'actor-123' }, 'strict');

    // Assert
    expect(result.valid).toBe(true);
    expect(result.diagnostics).toHaveLength(3);
    expect(mockRegistry.get).toHaveBeenCalledTimes(3); // All tasks checked
  });

  it('should skip non-critical tasks in lenient policy', () => {
    // Setup: Plan with mix of critical and non-critical tasks
    const plan = {
      tasks: [
        { taskId: 'core:task1', parameters: {}, isCritical: true },
        { taskId: 'core:task2', parameters: {} }, // Not critical
        { taskId: 'core:task3', parameters: {}, isCritical: true },
      ],
      cost: 3,
      nodesExplored: 10,
    };

    const currentState = {};

    // Setup: Task definitions
    mockRegistry.get.mockImplementation((type, id) => {
      const tasks = {
        'core:task1': { id: 'core:task1' },
        'core:task3': { id: 'core:task3' },
      };
      return tasks[id];
    });

    // Act
    const result = detector.checkPlanValidity(plan, currentState, { actorId: 'actor-123' }, 'lenient');

    // Assert
    expect(result.valid).toBe(true);
    expect(result.diagnostics).toHaveLength(2); // Only critical tasks
    expect(mockRegistry.get).toHaveBeenCalledTimes(2); // Only critical tasks checked
  });

  it('should check every 3rd task in periodic policy', () => {
    // Setup: Plan with 7 tasks
    const plan = {
      tasks: [
        { taskId: 'core:task0', parameters: {} }, // Index 0 - checked
        { taskId: 'core:task1', parameters: {} }, // Index 1 - skipped
        { taskId: 'core:task2', parameters: {} }, // Index 2 - skipped
        { taskId: 'core:task3', parameters: {} }, // Index 3 - checked
        { taskId: 'core:task4', parameters: {} }, // Index 4 - skipped
        { taskId: 'core:task5', parameters: {} }, // Index 5 - skipped
        { taskId: 'core:task6', parameters: {} }, // Index 6 - checked
      ],
      cost: 7,
      nodesExplored: 20,
    };

    const currentState = {};

    // Setup: Task definitions
    mockRegistry.get.mockImplementation((type, id) => {
      const tasks = {
        'core:task0': { id: 'core:task0' },
        'core:task3': { id: 'core:task3' },
        'core:task6': { id: 'core:task6' },
      };
      return tasks[id];
    });

    // Act
    const result = detector.checkPlanValidity(plan, currentState, { actorId: 'actor-123' }, 'periodic');

    // Assert
    expect(result.valid).toBe(true);
    expect(result.diagnostics).toHaveLength(3); // Tasks at index 0, 3, 6
    expect(mockRegistry.get).toHaveBeenCalledTimes(3);
  });
});

describe('PlanInvalidationDetector - State Change Detection', () => {
  let detector;
  let mockLogger;
  let mockJsonLogicService;
  let mockRegistry;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockJsonLogicService = {
      evaluate: jest.fn(),
    };

    mockRegistry = {
      get: jest.fn(),
      getAll: jest.fn(),
    };

    detector = new PlanInvalidationDetector({
      logger: mockLogger,
      jsonLogicEvaluationService: mockJsonLogicService,
      dataRegistry: mockRegistry,
    });
  });

  it('should invalidate when world state changes', () => {
    // Setup: Plan that was valid in past state
    const plan = {
      tasks: [
        { taskId: 'core:open_door', parameters: { target: 'door-789' } },
      ],
      cost: 1,
      nodesExplored: 3,
    };

    // Setup: Current state where door is now locked
    const currentState = {
      'door-789:core:locked': true,
    };

    // Setup: Task definition requiring unlocked door
    mockRegistry.get.mockReturnValue({
      id: 'core:open_door',
      planningPreconditions: [
        {
          description: 'Door is unlocked',
          condition: { '==': [{ var: 'door-789.core.locked' }, false] },
        },
      ],
    });

    // Mock: Precondition fails in current state
    mockJsonLogicService.evaluate.mockReturnValue(false);

    // Act
    const result = detector.checkPlanValidity(plan, currentState, { actorId: 'actor-123' }, 'strict');

    // Assert
    expect(result.valid).toBe(false);
    expect(result.invalidatedAt).toBe(0);
    expect(result.reason).toBe('precondition_violated');
    expect(result.description).toBe('Door is unlocked');
  });

  it('should detect parameter entity disappearance', () => {
    // Setup: Plan referencing an entity that no longer exists
    const plan = {
      tasks: [
        { taskId: 'core:pick_up_item', parameters: { target: 'apple-456' } },
      ],
      cost: 1,
      nodesExplored: 2,
    };

    // Setup: Current state where entity is gone
    const currentState = {
      'apple-456:core:exists': false, // Entity marked as non-existent
    };

    // Setup: Task definition checking entity existence
    mockRegistry.get.mockReturnValue({
      id: 'core:pick_up_item',
      planningPreconditions: [
        {
          description: 'Item exists',
          condition: { '==': [{ var: 'apple-456.core.exists' }, true] },
        },
      ],
    });

    // Mock: Precondition fails
    mockJsonLogicService.evaluate.mockReturnValue(false);

    // Act
    const result = detector.checkPlanValidity(plan, currentState, { actorId: 'actor-123' }, 'strict');

    // Assert
    expect(result.valid).toBe(false);
    expect(result.invalidatedAt).toBe(0);
    expect(result.reason).toBe('precondition_violated');
  });
});

describe('PlanInvalidationDetector - Invalidation Reasons', () => {
  let detector;
  let mockLogger;
  let mockJsonLogicService;
  let mockRegistry;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockJsonLogicService = {
      evaluate: jest.fn(),
    };

    mockRegistry = {
      get: jest.fn(),
      getAll: jest.fn(),
    };

    detector = new PlanInvalidationDetector({
      logger: mockLogger,
      jsonLogicEvaluationService: mockJsonLogicService,
      dataRegistry: mockRegistry,
    });
  });

  it('should return detailed invalidation reason', () => {
    const plan = {
      tasks: [{ taskId: 'core:task1', parameters: {} }],
      cost: 1,
      nodesExplored: 1,
    };

    const currentState = {};

    mockRegistry.get.mockReturnValue({
      id: 'core:task1',
      planningPreconditions: [
        {
          description: 'Test precondition',
          condition: { '==': [{ var: 'test' }, true] },
        },
      ],
    });

    mockJsonLogicService.evaluate.mockReturnValue(false);

    const result = detector.checkPlanValidity(plan, currentState, { actorId: 'actor-123' }, 'strict');

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('precondition_violated');
    expect(result.description).toBe('Test precondition');
    expect(result.precondition).toEqual({ '==': [{ var: 'test' }, true] });
  });

  it('should include violated precondition in result', () => {
    const plan = {
      tasks: [{ taskId: 'core:task1', parameters: {} }],
      cost: 1,
      nodesExplored: 1,
    };

    const violatedCondition = { '==': [{ var: 'actor.ready' }, true] };

    mockRegistry.get.mockReturnValue({
      id: 'core:task1',
      planningPreconditions: [
        {
          description: 'Actor is ready',
          condition: violatedCondition,
        },
      ],
    });

    mockJsonLogicService.evaluate.mockReturnValue(false);

    const result = detector.checkPlanValidity(plan, {}, { actorId: 'actor-123' }, 'strict');

    expect(result.precondition).toEqual(violatedCondition);
  });

  it('should provide task index where invalidation occurred', () => {
    // Setup: Plan with 3 tasks, middle one fails
    const plan = {
      tasks: [
        { taskId: 'core:task1', parameters: {} },
        { taskId: 'core:task2', parameters: {} }, // This one fails
        { taskId: 'core:task3', parameters: {} },
      ],
      cost: 3,
      nodesExplored: 10,
    };

    mockRegistry.get.mockImplementation((type, id) => {
      if (type === 'tasks') {
        const tasks = {
          'core:task1': { id: 'core:task1' }, // No preconditions
          'core:task2': {
            id: 'core:task2',
            planningPreconditions: [
              {
                description: 'Failing condition',
                condition: { '==': [{ var: 'test' }, true] },
              },
            ],
          },
          'core:task3': { id: 'core:task3' },
        };
        return tasks[id];
      }
    });

    mockJsonLogicService.evaluate.mockReturnValue(false);

    const result = detector.checkPlanValidity(plan, {}, { actorId: 'actor-123' }, 'strict');

    expect(result.valid).toBe(false);
    expect(result.invalidatedAt).toBe(1); // Second task (index 1)
    expect(result.task).toBe('core:task2');
  });
});

describe('PlanInvalidationDetector - Policy Behaviors', () => {
  let detector;
  let mockLogger;
  let mockJsonLogicService;
  let mockRegistry;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockJsonLogicService = {
      evaluate: jest.fn(),
    };

    mockRegistry = {
      get: jest.fn(),
      getAll: jest.fn(),
    };

    detector = new PlanInvalidationDetector({
      logger: mockLogger,
      jsonLogicEvaluationService: mockJsonLogicService,
      dataRegistry: mockRegistry,
    });
  });

  it('should use strict policy by default', () => {
    const plan = {
      tasks: [
        { taskId: 'core:task1', parameters: {} },
        { taskId: 'core:task2', parameters: {} },
      ],
      cost: 2,
      nodesExplored: 5,
    };

    mockRegistry.get.mockImplementation((type, id) => {
      const tasks = {
        'core:task1': { id: 'core:task1' },
        'core:task2': { id: 'core:task2' },
      };
      return tasks[id];
    });

    // Call without policy argument - should default to strict
    detector.checkPlanValidity(plan, {}, { actorId: 'actor-123' });

    // Both tasks should be checked
    expect(mockRegistry.get).toHaveBeenCalledTimes(2);
  });

  it('should apply lenient policy for non-critical tasks', () => {
    const plan = {
      tasks: [
        { taskId: 'core:critical', parameters: {}, isCritical: true },
        { taskId: 'core:optional', parameters: {} },
      ],
      cost: 2,
      nodesExplored: 5,
    };

    mockRegistry.get.mockImplementation((type, id) => {
      const tasks = {
        'core:critical': { id: 'core:critical' },
      };
      return tasks[id];
    });

    const result = detector.checkPlanValidity(plan, {}, { actorId: 'actor-123' }, 'lenient');

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toHaveLength(1); // Only critical task
    expect(mockRegistry.get).toHaveBeenCalledTimes(1);
  });

  it('should support periodic checking policy', () => {
    const plan = {
      tasks: new Array(10).fill(null).map((_, i) => ({
        taskId: `core:task${i}`,
        parameters: {},
      })),
      cost: 10,
      nodesExplored: 30,
    };

    mockRegistry.get.mockImplementation((type, id) => {
      const tasks = Object.fromEntries(
        Array.from({ length: 10 }, (_, i) => [`core:task${i}`, { id: `core:task${i}` }])
      );
      return tasks[id];
    });

    const result = detector.checkPlanValidity(plan, {}, { actorId: 'actor-123' }, 'periodic');

    expect(result.valid).toBe(true);
    // Periodic checks every 3rd task: indices 0, 3, 6, 9 = 4 tasks
    expect(result.diagnostics).toHaveLength(4);
    expect(mockRegistry.get).toHaveBeenCalledTimes(4);
  });
});

describe('PlanInvalidationDetector - Error Handling', () => {
  let detector;
  let mockLogger;
  let mockJsonLogicService;
  let mockRegistry;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockJsonLogicService = {
      evaluate: jest.fn(),
    };

    mockRegistry = {
      get: jest.fn(),
      getAll: jest.fn(),
    };

    detector = new PlanInvalidationDetector({
      logger: mockLogger,
      jsonLogicEvaluationService: mockJsonLogicService,
      dataRegistry: mockRegistry,
    });
  });

  it('should handle precondition evaluation errors', () => {
    const plan = {
      tasks: [{ taskId: 'core:task1', parameters: {} }],
      cost: 1,
      nodesExplored: 1,
    };

    mockRegistry.get.mockReturnValue({
      id: 'core:task1',
      planningPreconditions: [
        {
          description: 'Test condition',
          condition: { invalid: 'logic' },
        },
      ],
    });

    // Mock evaluation error
    mockJsonLogicService.evaluate.mockImplementation(() => {
      throw new Error('Invalid JSON Logic expression');
    });

    const result = detector.checkPlanValidity(plan, {}, { actorId: 'actor-123' }, 'strict');

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('evaluation_error');
    expect(result.error).toBe('Invalid JSON Logic expression');
  });

  it('should treat evaluation errors as invalidation', () => {
    const plan = {
      tasks: [{ taskId: 'core:task1', parameters: {} }],
      cost: 1,
      nodesExplored: 1,
    };

    mockRegistry.get.mockReturnValue({
      id: 'core:task1',
      planningPreconditions: [
        {
          description: 'Test',
          condition: {},
        },
      ],
    });

    mockJsonLogicService.evaluate.mockImplementation(() => {
      throw new Error('Evaluation failed');
    });

    const result = detector.checkPlanValidity(plan, {}, { actorId: 'actor-123' }, 'strict');

    // Conservative invalidation on error
    expect(result.valid).toBe(false);
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should log evaluation failures with context', () => {
    const plan = {
      tasks: [{ taskId: 'core:task1', parameters: {} }],
      cost: 1,
      nodesExplored: 1,
    };

    mockRegistry.get.mockReturnValue({
      id: 'core:task1',
      planningPreconditions: [
        {
          description: 'Test condition',
          condition: { test: 'condition' },
        },
      ],
    });

    mockJsonLogicService.evaluate.mockImplementation(() => {
      throw new Error('Evaluation error');
    });

    detector.checkPlanValidity(plan, {}, { actorId: 'actor-123' }, 'strict');

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Precondition evaluation error',
      expect.any(Error),
      expect.objectContaining({
        taskId: 'core:task1',
        taskIndex: 0,
        precondition: 'Test condition',
      })
    );
  });
});

describe('PlanInvalidationDetector - Edge Cases', () => {
  let detector;
  let mockLogger;
  let mockJsonLogicService;
  let mockRegistry;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockJsonLogicService = {
      evaluate: jest.fn(),
    };

    mockRegistry = {
      get: jest.fn(),
      getAll: jest.fn(),
    };

    detector = new PlanInvalidationDetector({
      logger: mockLogger,
      jsonLogicEvaluationService: mockJsonLogicService,
      dataRegistry: mockRegistry,
    });
  });

  it('should handle empty plan gracefully', () => {
    const plan = {
      tasks: [],
      cost: 0,
      nodesExplored: 0,
    };

    const result = detector.checkPlanValidity(plan, {}, { actorId: 'actor-123' }, 'strict');

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
  });

  it('should handle invalid plan structure', () => {
    const invalidPlan = null;

    const result = detector.checkPlanValidity(invalidPlan, {}, { actorId: 'actor-123' }, 'strict');

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('invalid_plan_structure');
  });

  it('should handle missing actorId in context', () => {
    const plan = {
      tasks: [{ taskId: 'core:task1', parameters: {} }],
      cost: 1,
      nodesExplored: 1,
    };

    const result = detector.checkPlanValidity(plan, {}, {}, 'strict');

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('invalid_plan_structure');
  });

  it('should handle task not found in repository', () => {
    const plan = {
      tasks: [{ taskId: 'core:missing_task', parameters: {} }],
      cost: 1,
      nodesExplored: 1,
    };

    mockRegistry.get.mockReturnValue(null); // Task not found

    const result = detector.checkPlanValidity(plan, {}, { actorId: 'actor-123' }, 'strict');

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('task_not_found');
    expect(result.task).toBe('core:missing_task');
  });

  it('should handle tasks with no preconditions', () => {
    const plan = {
      tasks: [{ taskId: 'core:simple_task', parameters: {} }],
      cost: 1,
      nodesExplored: 1,
    };

    mockRegistry.get.mockReturnValue({
      id: 'core:simple_task',
      // No planningPreconditions field
    });

    const result = detector.checkPlanValidity(plan, {}, { actorId: 'actor-123' }, 'strict');

    expect(result.valid).toBe(true);
    expect(result.diagnostics[0].noPreconditions).toBe(true);
  });

  it('should handle unknown policy by defaulting to strict', () => {
    const plan = {
      tasks: [
        { taskId: 'core:task1', parameters: {} },
        { taskId: 'core:task2', parameters: {} },
      ],
      cost: 2,
      nodesExplored: 5,
    };

    mockRegistry.get.mockImplementation((type, id) => {
      const tasks = {
        'core:task1': { id: 'core:task1' },
        'core:task2': { id: 'core:task2' },
      };
      return tasks[id];
    });

    detector.checkPlanValidity(plan, {}, { actorId: 'actor-123' }, 'unknown_policy');

    // Should check all tasks (strict behavior)
    expect(mockRegistry.get).toHaveBeenCalledTimes(2);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Unknown policy, defaulting to strict',
      expect.objectContaining({ policy: 'unknown_policy' })
    );
  });

  it('should handle invalid current state input', () => {
    const plan = {
      tasks: [{ taskId: 'core:task1', parameters: {} }],
      cost: 1,
      nodesExplored: 1,
    };

    const result = detector.checkPlanValidity(plan, null, { actorId: 'actor-123' }, 'strict');

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('invalid_plan_structure');
    expect(mockLogger.warn).toHaveBeenCalledWith('Invalid current state', { currentState: null });
  });

  it('should build evaluation context while skipping malformed keys', () => {
    const plan = {
      tasks: [{ taskId: 'core:task1', parameters: {} }],
      cost: 1,
      nodesExplored: 1,
    };

    const currentState = {
      'actor-123:core': { stamina: 10 },
      malformedKey: true,
    };

    mockRegistry.get.mockReturnValue({ id: 'core:task1' });

    const result = detector.checkPlanValidity(plan, currentState, { actorId: 'actor-123' }, 'strict');

    expect(result.valid).toBe(true);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Invalid state key format',
      expect.objectContaining({ key: 'malformedKey' })
    );
  });

  it('should recover when evaluation context building fails', () => {
    const plan = {
      tasks: [{ taskId: 'core:task1', parameters: {} }],
      cost: 1,
      nodesExplored: 1,
    };

    mockRegistry.get.mockReturnValue({ id: 'core:task1' });

    const entriesSpy = jest
      .spyOn(Object, 'entries')
      .mockImplementation(() => {
        throw new Error('entries failed');
      });

    try {
      const result = detector.checkPlanValidity(
        plan,
        { 'actor-123:core:hungry': true },
        { actorId: 'actor-123' },
        'strict'
      );

      expect(result.valid).toBe(true);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Context building failed',
        expect.any(Error),
        expect.objectContaining({ state: expect.anything() })
      );
    } finally {
      entriesSpy.mockRestore();
    }
  });

  it('should handle invalid task identifiers', () => {
    const plan = {
      tasks: [{ taskId: null, parameters: {} }],
      cost: 1,
      nodesExplored: 1,
    };

    const result = detector.checkPlanValidity(plan, {}, { actorId: 'actor-123' }, 'strict');

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('task_not_found');
    expect(mockLogger.warn).toHaveBeenCalledWith('Invalid task ID', { taskId: null });
  });

  it('should handle registry errors when fetching task definitions', () => {
    const plan = {
      tasks: [{ taskId: 'core:task1', parameters: {} }],
      cost: 1,
      nodesExplored: 1,
    };

    mockRegistry.get.mockImplementation(() => {
      throw new Error('registry failure');
    });

    const result = detector.checkPlanValidity(plan, {}, { actorId: 'actor-123' }, 'strict');

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('task_not_found');
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to get task definition',
      expect.any(Error),
      expect.objectContaining({ taskId: 'core:task1' })
    );
  });
});
