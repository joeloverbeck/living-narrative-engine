# GOAPIMPL-021-08: Unit Tests

**Parent Ticket**: GOAPIMPL-021 (GOAP Controller)
**Priority**: CRITICAL
**Estimated Effort**: 2 hours
**Dependencies**: GOAPIMPL-021-01 through GOAPIMPL-021-07

## Description

Create comprehensive unit tests for GOAPController covering all methods, edge cases, and failure scenarios. Achieves 90%+ test coverage requirement.

## Acceptance Criteria

- [ ] Complete test suite for all GOAPController methods
- [ ] All happy path scenarios tested
- [ ] All failure scenarios tested
- [ ] Edge cases covered (empty goals, missing components, etc.)
- [ ] Mock dependencies properly isolated
- [ ] 90%+ branch coverage
- [ ] 90%+ line coverage
- [ ] All tests pass

## Files to Create

- `tests/unit/goap/goapController.test.js`

## Test Structure

### Test Organization

```javascript
/**
 * @file Unit tests for GOAPController
 */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import GOAPController from '../../../src/goap/controllers/goapController.js';

describe('GOAPController', () => {
  let testBed;
  let controller;
  let mockPlanner;
  let mockRefinementEngine;
  let mockInvalidationDetector;
  let mockContextAssemblyService;
  let mockEventBus;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();

    // Create mocks
    mockPlanner = testBed.createMock('planner', ['plan']);
    mockRefinementEngine = testBed.createMock('refinementEngine', ['refine']);
    mockInvalidationDetector = testBed.createMock('invalidationDetector', ['check']);
    mockContextAssemblyService = testBed.createMock('contextAssembly', ['buildContext']);
    mockEventBus = testBed.createMock('eventBus', ['dispatch']);
    mockLogger = testBed.createMockLogger();

    controller = new GOAPController({
      planner: mockPlanner,
      refinementEngine: mockRefinementEngine,
      invalidationDetector: mockInvalidationDetector,
      contextAssemblyService: mockContextAssemblyService,
      eventBus: mockEventBus,
      logger: mockLogger
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  // Test suites defined below
});
```

## Test Cases by Feature

### Constructor & Validation

```javascript
describe('Constructor', () => {
  it('should create instance with valid dependencies', () => {
    expect(controller).toBeDefined();
  });

  it('should throw on missing planner', () => {
    expect(() => new GOAPController({
      refinementEngine: mockRefinementEngine,
      invalidationDetector: mockInvalidationDetector,
      contextAssemblyService: mockContextAssemblyService,
      eventBus: mockEventBus,
      logger: mockLogger
    })).toThrow();
  });

  it('should throw on missing refinement engine', () => {
    expect(() => new GOAPController({
      planner: mockPlanner,
      invalidationDetector: mockInvalidationDetector,
      contextAssemblyService: mockContextAssemblyService,
      eventBus: mockEventBus,
      logger: mockLogger
    })).toThrow();
  });

  it('should throw on invalid dependencies', () => {
    expect(() => new GOAPController({
      planner: {},  // Missing required methods
      refinementEngine: mockRefinementEngine,
      invalidationDetector: mockInvalidationDetector,
      contextAssemblyService: mockContextAssemblyService,
      eventBus: mockEventBus,
      logger: mockLogger
    })).toThrow();
  });
});
```

### Goal Selection

```javascript
describe('Goal Selection', () => {
  it('should select highest priority unsatisfied goal', async () => {
    const actor = {
      id: 'actor_1',
      components: {
        'core:goals': {
          goals: [
            { id: 'low_priority', priority: 5, conditions: [] },
            { id: 'high_priority', priority: 10, conditions: [] }
          ]
        }
      }
    };

    mockPlanner.plan.mockResolvedValue({ tasks: [{ taskId: 'task_1' }] });
    mockRefinementEngine.refine.mockResolvedValue({
      success: true,
      stepResults: [{ actionRef: 'test:action', targetBindings: {} }]
    });
    mockInvalidationDetector.check.mockReturnValue({ valid: true });
    mockContextAssemblyService.buildContext.mockReturnValue({});

    await controller.decideTurn(actor, {});

    expect(mockPlanner.plan).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ id: 'high_priority' }),
      expect.any(Object)
    );
  });

  it('should return null when actor has no goals', async () => {
    const actor = {
      id: 'actor_1',
      components: {}
    };

    const result = await controller.decideTurn(actor, {});

    expect(result).toBeNull();
    expect(mockPlanner.plan).not.toHaveBeenCalled();
  });

  it('should return null when all goals satisfied', async () => {
    const actor = {
      id: 'actor_1',
      components: {
        'core:goals': {
          goals: [
            { id: 'goal_1', priority: 10, conditions: [{ '==': [1, 1] }] }
          ]
        }
      }
    };

    mockContextAssemblyService.buildContext.mockReturnValue({ value: 1 });

    const result = await controller.decideTurn(actor, {});

    expect(result).toBeNull();
  });

  it('should skip satisfied goals and select next priority', async () => {
    const actor = {
      id: 'actor_1',
      components: {
        'core:goals': {
          goals: [
            { id: 'satisfied', priority: 10, conditions: [{ '==': [1, 1] }] },
            { id: 'unsatisfied', priority: 5, conditions: [{ '==': [1, 2] }] }
          ]
        }
      }
    };

    mockContextAssemblyService.buildContext.mockReturnValue({});
    mockPlanner.plan.mockResolvedValue({ tasks: [{ taskId: 'task_1' }] });
    mockRefinementEngine.refine.mockResolvedValue({
      success: true,
      stepResults: [{ actionRef: 'test:action', targetBindings: {} }]
    });
    mockInvalidationDetector.check.mockReturnValue({ valid: true });

    await controller.decideTurn(actor, {});

    expect(mockPlanner.plan).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ id: 'unsatisfied' }),
      expect.any(Object)
    );
  });
});
```

### Plan State Management

```javascript
describe('Plan State Management', () => {
  it('should create plan from planner result', async () => {
    const actor = testBed.createActor({ goals: [{ id: 'goal_1', priority: 10, conditions: [] }] });
    const tasks = [{ taskId: 'task_1' }, { taskId: 'task_2' }];

    mockPlanner.plan.mockResolvedValue({ tasks });
    mockRefinementEngine.refine.mockResolvedValue({
      success: true,
      stepResults: [{ actionRef: 'test:action', targetBindings: {} }]
    });
    mockInvalidationDetector.check.mockReturnValue({ valid: true });

    await controller.decideTurn(actor, {});

    // Verify plan created internally
    // Second call should not create new plan
    mockPlanner.plan.mockClear();
    await controller.decideTurn(actor, {});
    expect(mockPlanner.plan).not.toHaveBeenCalled();
  });

  it('should advance plan on successful hint extraction', async () => {
    const actor = testBed.createActor({ goals: [{ id: 'goal_1', priority: 10, conditions: [] }] });
    const tasks = [{ taskId: 'task_1' }, { taskId: 'task_2' }];

    mockPlanner.plan.mockResolvedValue({ tasks });
    mockRefinementEngine.refine
      .mockResolvedValueOnce({
        success: true,
        stepResults: [{ actionRef: 'test:action_1', targetBindings: {} }]
      })
      .mockResolvedValueOnce({
        success: true,
        stepResults: [{ actionRef: 'test:action_2', targetBindings: {} }]
      });
    mockInvalidationDetector.check.mockReturnValue({ valid: true });

    // First turn: task_1
    await controller.decideTurn(actor, {});
    expect(mockRefinementEngine.refine).toHaveBeenCalledWith('task_1', 'actor_1', undefined);

    // Second turn: task_2
    await controller.decideTurn(actor, {});
    expect(mockRefinementEngine.refine).toHaveBeenCalledWith('task_2', 'actor_1', undefined);
  });

  it('should clear plan on completion', async () => {
    const actor = testBed.createActor({ goals: [{ id: 'goal_1', priority: 10, conditions: [] }] });
    const tasks = [{ taskId: 'task_1' }];

    mockPlanner.plan.mockResolvedValue({ tasks });
    mockRefinementEngine.refine.mockResolvedValue({
      success: true,
      stepResults: [{ actionRef: 'test:action', targetBindings: {} }]
    });
    mockInvalidationDetector.check.mockReturnValue({ valid: true });

    // First turn: complete plan
    await controller.decideTurn(actor, {});

    // Second turn: should create new plan
    mockPlanner.plan.mockClear();
    mockPlanner.plan.mockResolvedValue({ tasks });
    await controller.decideTurn(actor, {});
    expect(mockPlanner.plan).toHaveBeenCalled();
  });

  it('should validate plan on each turn', async () => {
    const actor = testBed.createActor({ goals: [{ id: 'goal_1', priority: 10, conditions: [] }] });

    mockPlanner.plan.mockResolvedValue({ tasks: [{ taskId: 'task_1' }] });
    mockRefinementEngine.refine.mockResolvedValue({
      success: true,
      stepResults: [{ actionRef: 'test:action', targetBindings: {} }]
    });
    mockInvalidationDetector.check.mockReturnValue({ valid: true });

    await controller.decideTurn(actor, {});

    mockInvalidationDetector.check.mockClear();
    await controller.decideTurn(actor, {});

    expect(mockInvalidationDetector.check).toHaveBeenCalled();
  });

  it('should clear plan on invalidation', async () => {
    const actor = testBed.createActor({ goals: [{ id: 'goal_1', priority: 10, conditions: [] }] });

    mockPlanner.plan.mockResolvedValue({ tasks: [{ taskId: 'task_1' }] });
    mockRefinementEngine.refine.mockResolvedValue({
      success: true,
      stepResults: [{ actionRef: 'test:action', targetBindings: {} }]
    });

    // First turn: valid plan
    mockInvalidationDetector.check.mockReturnValue({ valid: true });
    await controller.decideTurn(actor, {});

    // Second turn: plan invalidated
    mockInvalidationDetector.check.mockReturnValue({
      valid: false,
      reason: 'Test invalidation'
    });

    mockPlanner.plan.mockClear();
    mockPlanner.plan.mockResolvedValue({ tasks: [{ taskId: 'task_2' }] });

    await controller.decideTurn(actor, {});

    // Should have created new plan
    expect(mockPlanner.plan).toHaveBeenCalled();
  });
});
```

### Action Hint Extraction

```javascript
describe('Action Hint Extraction', () => {
  it('should extract action hint from refinement result', async () => {
    const actor = testBed.createActor({ goals: [{ id: 'goal_1', priority: 10, conditions: [] }] });

    mockPlanner.plan.mockResolvedValue({ tasks: [{ taskId: 'task_1' }] });
    mockRefinementEngine.refine.mockResolvedValue({
      success: true,
      taskId: 'task_1',
      stepResults: [
        {
          actionRef: 'items:consume_item',
          targetBindings: { target: 'entity_123' },
          parameters: { quantity: 1 }
        }
      ]
    });
    mockInvalidationDetector.check.mockReturnValue({ valid: true });

    const result = await controller.decideTurn(actor, {});

    expect(result).toEqual({
      actionHint: {
        actionId: 'items:consume_item',
        targetBindings: {
          target: 'entity_123',
          parameters: { quantity: 1 }
        },
        stepIndex: 0,
        metadata: {
          taskId: 'task_1',
          totalSteps: 1
        }
      }
    });
  });

  it('should handle refinement with no step results', async () => {
    const actor = testBed.createActor({ goals: [{ id: 'goal_1', priority: 10, conditions: [] }] });

    mockPlanner.plan.mockResolvedValue({ tasks: [{ taskId: 'task_1' }] });
    mockRefinementEngine.refine.mockResolvedValue({
      success: true,
      stepResults: []
    });
    mockInvalidationDetector.check.mockReturnValue({ valid: true });

    const result = await controller.decideTurn(actor, {});

    expect(result).toBeNull();
  });

  it('should handle step result without action reference', async () => {
    const actor = testBed.createActor({ goals: [{ id: 'goal_1', priority: 10, conditions: [] }] });

    mockPlanner.plan.mockResolvedValue({ tasks: [{ taskId: 'task_1' }] });
    mockRefinementEngine.refine.mockResolvedValue({
      success: true,
      stepResults: [{ targetBindings: {} }]  // Missing actionRef
    });
    mockInvalidationDetector.check.mockReturnValue({ valid: true });

    const result = await controller.decideTurn(actor, {});

    expect(result).toBeNull();
  });
});
```

### Failure Handling

```javascript
describe('Failure Handling', () => {
  it('should handle planning failure', async () => {
    const actor = testBed.createActor({ goals: [{ id: 'goal_1', priority: 10, conditions: [] }] });

    mockPlanner.plan.mockResolvedValue(null);

    const result = await controller.decideTurn(actor, {});

    expect(result).toBeNull();
    expect(mockEventBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'GOAP_PLANNING_FAILED'
      })
    );
  });

  it('should handle refinement failure with replan fallback', async () => {
    const actor = testBed.createActor({ goals: [{ id: 'goal_1', priority: 10, conditions: [] }] });

    mockPlanner.plan.mockResolvedValue({ tasks: [{ taskId: 'task_1' }] });
    mockRefinementEngine.refine.mockResolvedValue({
      success: false,
      error: 'Refinement failed',
      fallbackBehavior: 'replan'
    });
    mockInvalidationDetector.check.mockReturnValue({ valid: true });

    const result = await controller.decideTurn(actor, {});

    expect(result).toBeNull();
    expect(mockEventBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'GOAP_REFINEMENT_FAILED'
      })
    );
  });

  it('should handle refinement failure with continue fallback', async () => {
    const actor = testBed.createActor({ goals: [{ id: 'goal_1', priority: 10, conditions: [] }] });

    mockPlanner.plan.mockResolvedValue({
      tasks: [{ taskId: 'task_1' }, { taskId: 'task_2' }]
    });

    mockRefinementEngine.refine
      .mockResolvedValueOnce({
        success: false,
        fallbackBehavior: 'continue'
      })
      .mockResolvedValueOnce({
        success: true,
        stepResults: [{ actionRef: 'test:action', targetBindings: {} }]
      });

    mockInvalidationDetector.check.mockReturnValue({ valid: true });

    const result = await controller.decideTurn(actor, {});

    // Should skip task_1 and execute task_2
    expect(result).toBeDefined();
    expect(result.actionHint).toBeDefined();
  });

  it('should enforce recursion depth limit', async () => {
    const actor = testBed.createActor({ goals: [{ id: 'goal_1', priority: 10, conditions: [] }] });

    const tasks = Array(15).fill(null).map((_, i) => ({ taskId: `task_${i}` }));
    mockPlanner.plan.mockResolvedValue({ tasks });

    // All refinements fail with continue
    mockRefinementEngine.refine.mockResolvedValue({
      success: false,
      fallbackBehavior: 'continue'
    });

    mockInvalidationDetector.check.mockReturnValue({ valid: true });

    const result = await controller.decideTurn(actor, {});

    // Should abort after depth limit
    expect(result).toBeNull();
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Recursion depth exceeded')
    );
  });

  it('should track failed goals', async () => {
    const actor = testBed.createActor({ goals: [{ id: 'goal_1', priority: 10, conditions: [] }] });

    mockPlanner.plan.mockResolvedValue(null);

    // Fail multiple times
    await controller.decideTurn(actor, {});
    await controller.decideTurn(actor, {});
    await controller.decideTurn(actor, {});
    await controller.decideTurn(actor, {});

    // Should log permanent failure
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('failed too many times')
    );
  });
});
```

### Event Dispatching

```javascript
describe('Event Dispatching', () => {
  it('should dispatch planning started event', async () => {
    const actor = testBed.createActor({ goals: [{ id: 'goal_1', priority: 10, conditions: [] }] });

    mockPlanner.plan.mockResolvedValue({ tasks: [{ taskId: 'task_1' }] });
    mockRefinementEngine.refine.mockResolvedValue({
      success: true,
      stepResults: [{ actionRef: 'test:action', targetBindings: {} }]
    });
    mockInvalidationDetector.check.mockReturnValue({ valid: true });

    await controller.decideTurn(actor, {});

    expect(mockEventBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'GOAP_PLANNING_STARTED'
      })
    );
  });

  it('should dispatch goal achieved event on plan completion', async () => {
    const actor = testBed.createActor({ goals: [{ id: 'goal_1', priority: 10, conditions: [] }] });

    mockPlanner.plan.mockResolvedValue({ tasks: [{ taskId: 'task_1' }] });
    mockRefinementEngine.refine.mockResolvedValue({
      success: true,
      stepResults: [{ actionRef: 'test:action', targetBindings: {} }]
    });
    mockInvalidationDetector.check.mockReturnValue({ valid: true });

    await controller.decideTurn(actor, {});

    expect(mockEventBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'GOAP_GOAL_ACHIEVED'
      })
    );
  });

  it('should not break on event dispatch failure', async () => {
    const actor = testBed.createActor({ goals: [{ id: 'goal_1', priority: 10, conditions: [] }] });

    mockEventBus.dispatch.mockImplementation(() => {
      throw new Error('Event bus failure');
    });

    mockPlanner.plan.mockResolvedValue({ tasks: [{ taskId: 'task_1' }] });
    mockRefinementEngine.refine.mockResolvedValue({
      success: true,
      stepResults: [{ actionRef: 'test:action', targetBindings: {} }]
    });
    mockInvalidationDetector.check.mockReturnValue({ valid: true });

    // Should not throw
    const result = await controller.decideTurn(actor, {});
    expect(result).toBeDefined();
  });
});
```

### Input Validation

```javascript
describe('Input Validation', () => {
  it('should throw on missing actor', async () => {
    await expect(controller.decideTurn(null, {})).rejects.toThrow();
  });

  it('should throw on missing world', async () => {
    const actor = testBed.createActor({});
    await expect(controller.decideTurn(actor, null)).rejects.toThrow();
  });

  it('should throw on actor without ID', async () => {
    const actor = { components: {} };
    await expect(controller.decideTurn(actor, {})).rejects.toThrow();
  });
});
```

## Coverage Requirements

### Metrics to Achieve
- **Branch Coverage**: ≥ 90%
- **Function Coverage**: ≥ 90%
- **Line Coverage**: ≥ 90%
- **Statement Coverage**: ≥ 90%

### Run Coverage
```bash
npm run test:unit -- tests/unit/goap/goapController.test.js --coverage
```

## Success Validation

✅ **Done when**:
- All test suites pass
- Coverage metrics met (90%+)
- All happy paths tested
- All failure scenarios tested
- Edge cases covered
- Mocks properly isolated
- Tests follow project patterns

## Related Tickets

- **Previous**: GOAPIMPL-021-07 (DI Registration)
- **Next**: GOAPIMPL-021-09 (Integration Tests)
- **Implements**: GOAPIMPL-021 (Parent - GOAP Controller)
