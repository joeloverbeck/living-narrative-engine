# GOAPIMPL-021-09: Integration Tests

**Parent Ticket**: GOAPIMPL-021 (GOAP Controller)
**Priority**: HIGH
**Estimated Effort**: 1.5 hours
**Dependencies**: GOAPIMPL-021-01 through GOAPIMPL-021-08, GOAPIMPL-014, GOAPIMPL-018, GOAPIMPL-020

## Description

Create integration tests that verify GOAPController works correctly with real implementations of its dependencies. Tests the complete GOAP cycle with actual planner, refinement engine, and invalidation detector.

## Acceptance Criteria

- [ ] Tests use real GOAP subsystem implementations
- [ ] Complete GOAP cycle tested end-to-end
- [ ] Multi-turn scenarios validated
- [ ] Plan invalidation and replanning tested
- [ ] Multi-step plan execution verified
- [ ] Failure recovery scenarios tested
- [ ] Event flow validated
- [ ] All tests pass

## Files to Create

- `tests/integration/goap/goapController.integration.test.js`

## Test Structure

### Test Setup

```javascript
/**
 * @file Integration tests for GOAPController
 */
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import GOAPController from '../../../src/goap/controllers/goapController.js';
// Import real implementations
import GOAPPlanner from '../../../src/goap/planning/goapPlanner.js';
import RefinementEngine from '../../../src/goap/refinement/refinementEngine.js';
import PlanInvalidationDetector from '../../../src/goap/validation/planInvalidationDetector.js';

describe('GOAPController - Integration', () => {
  let testBed;
  let controller;
  let planner;
  let refinementEngine;
  let invalidationDetector;
  let contextAssemblyService;
  let eventBus;

  beforeEach(() => {
    testBed = createTestBed();

    // Create real implementations
    planner = new GOAPPlanner({
      // ... dependencies for planner
    });

    refinementEngine = new RefinementEngine({
      // ... dependencies for refinement engine
    });

    invalidationDetector = new PlanInvalidationDetector({
      // ... dependencies for detector
    });

    contextAssemblyService = testBed.createMock('contextAssembly', ['buildContext']);
    eventBus = testBed.createEventBus();  // Real or mock event bus

    controller = new GOAPController({
      planner,
      refinementEngine,
      invalidationDetector,
      contextAssemblyService,
      eventBus,
      logger: testBed.createMockLogger()
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  // Test suites below
});
```

## Integration Test Cases

### Complete GOAP Cycle

```javascript
describe('Complete GOAP Cycle', () => {
  it('should execute complete cycle from goal to action hint', async () => {
    // Setup: Actor with simple goal
    const actor = {
      id: 'test_actor',
      components: {
        'core:goals': {
          goals: [
            {
              id: 'be_fed',
              priority: 10,
              conditions: [
                { '>=': [{ var: 'actor.components.core:needs.hunger' }, 80] }
              ]
            }
          ]
        },
        'core:needs': {
          hunger: 50  // Unsatisfied
        }
      }
    };

    // Setup: World with available food
    const world = {
      entities: {
        food_item: {
          id: 'food_item',
          components: {
            'items:consumable': { nutrition: 50 }
          }
        }
      }
    };

    // Setup: Context assembly
    contextAssemblyService.buildContext.mockReturnValue({
      actor: actor,
      world: world
    });

    // Execute: First turn
    const result = await controller.decideTurn(actor, world);

    // Verify: Action hint returned
    expect(result).toBeDefined();
    expect(result.actionHint).toBeDefined();
    expect(result.actionHint.actionId).toBeDefined();
    expect(result.actionHint.targetBindings).toBeDefined();

    // Verify: Events dispatched
    const dispatchedEvents = eventBus.getDispatched();
    expect(dispatchedEvents).toContainEqual(
      expect.objectContaining({ type: 'GOAP_PLANNING_STARTED' })
    );
    expect(dispatchedEvents).toContainEqual(
      expect.objectContaining({ type: 'GOAP_PLANNING_COMPLETED' })
    );
    expect(dispatchedEvents).toContainEqual(
      expect.objectContaining({ type: 'GOAP_TASK_REFINED' })
    );
  });
});
```

### Multi-Turn Plan Execution

```javascript
describe('Multi-Turn Plan Execution', () => {
  it('should execute multi-step plan across turns', async () => {
    const actor = testBed.createActorWithGoal({
      goalId: 'build_shelter',
      priority: 10,
      conditions: []
    });

    const world = testBed.createWorld({
      resources: ['wood', 'stone']
    });

    contextAssemblyService.buildContext.mockReturnValue({ actor, world });

    const actionHints = [];

    // Execute: Multiple turns
    for (let turn = 0; turn < 5; turn++) {
      const result = await controller.decideTurn(actor, world);

      if (result && result.actionHint) {
        actionHints.push(result.actionHint);
      } else {
        // Plan complete or idle
        break;
      }
    }

    // Verify: Multiple action hints generated
    expect(actionHints.length).toBeGreaterThan(1);

    // Verify: Action hints progressed through plan
    const actionIds = actionHints.map(h => h.actionId);
    expect(actionIds).toContain('items:pick_up_item');  // Gather resources
    expect(actionIds).toContain('crafting:craft_item');  // Build shelter

    // Verify: Goal achieved event
    const events = eventBus.getDispatched();
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'GOAP_GOAL_ACHIEVED' })
    );
  });

  it('should maintain plan state across turns', async () => {
    const actor = testBed.createActorWithMultiStepGoal();
    const world = testBed.createWorld();

    contextAssemblyService.buildContext.mockReturnValue({ actor, world });

    // Turn 1: Start plan
    const result1 = await controller.decideTurn(actor, world);
    expect(result1).toBeDefined();

    // Turn 2: Continue plan (shouldn't replan)
    const planningEvents1 = eventBus.getDispatched().filter(
      e => e.type === 'GOAP_PLANNING_STARTED'
    );

    const result2 = await controller.decideTurn(actor, world);
    expect(result2).toBeDefined();

    const planningEvents2 = eventBus.getDispatched().filter(
      e => e.type === 'GOAP_PLANNING_STARTED'
    );

    // Verify: No replanning (same plan count)
    expect(planningEvents2.length).toBe(planningEvents1.length);
  });
});
```

### Plan Invalidation & Replanning

```javascript
describe('Plan Invalidation & Replanning', () => {
  it('should detect plan invalidation and replan', async () => {
    const actor = testBed.createActorWithGoal({
      goalId: 'use_item',
      priority: 10
    });

    const world = testBed.createWorld({
      items: [{ id: 'item_1', type: 'tool' }]
    });

    contextAssemblyService.buildContext.mockReturnValue({ actor, world });

    // Turn 1: Create plan
    await controller.decideTurn(actor, world);

    // World change: Remove target item
    world.items = [];

    // Turn 2: Plan should invalidate and replan
    await controller.decideTurn(actor, world);

    // Verify: Invalidation and replanning events
    const events = eventBus.getDispatched();
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'GOAP_PLAN_INVALIDATED' })
    );
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'GOAP_REPLANNING_STARTED' })
    );
  });

  it('should handle replanning when target becomes unavailable', async () => {
    const actor = testBed.createActor({
      goals: [
        {
          id: 'consume_specific_item',
          priority: 10,
          conditions: []
        }
      ]
    });

    const world = {
      entities: {
        target_item: { id: 'target_item' }
      }
    };

    contextAssemblyService.buildContext.mockReturnValue({ actor, world });

    // Turn 1: Create plan targeting specific item
    const result1 = await controller.decideTurn(actor, world);
    expect(result1?.actionHint?.targetBindings?.target).toBe('target_item');

    // World change: Target removed
    delete world.entities.target_item;

    // Turn 2: Should detect invalidation and either:
    // 1. Replan with different target
    // 2. Fail gracefully if no alternatives
    const result2 = await controller.decideTurn(actor, world);

    // Verify: Handled gracefully (not crashed)
    expect(result2 === null || result2?.actionHint).toBeTruthy();
  });
});
```

### Failure Recovery

```javascript
describe('Failure Recovery', () => {
  it('should recover from transient refinement failure', async () => {
    const actor = testBed.createActorWithGoal({
      goalId: 'multi_task_goal',
      priority: 10
    });

    const world = testBed.createWorld();
    contextAssemblyService.buildContext.mockReturnValue({ actor, world });

    // Simulate transient failure (e.g., temporary resource unavailability)
    let callCount = 0;
    const originalRefine = refinementEngine.refine.bind(refinementEngine);

    refinementEngine.refine = jest.fn(async (...args) => {
      callCount++;
      if (callCount === 2) {
        // Fail second call
        return {
          success: false,
          fallbackBehavior: 'replan'
        };
      }
      return originalRefine(...args);
    });

    // Execute: Multiple turns
    const results = [];
    for (let i = 0; i < 5; i++) {
      const result = await controller.decideTurn(actor, world);
      results.push(result);
    }

    // Verify: System recovered and continued
    const successfulHints = results.filter(r => r?.actionHint);
    expect(successfulHints.length).toBeGreaterThan(0);
  });

  it('should handle planning failure gracefully', async () => {
    const actor = testBed.createActorWithGoal({
      goalId: 'impossible_goal',
      priority: 10
    });

    const world = testBed.createWorld({ empty: true });
    contextAssemblyService.buildContext.mockReturnValue({ actor, world });

    // Execute: Should fail to plan but not crash
    const result = await controller.decideTurn(actor, world);

    // Verify: Returns null (idle)
    expect(result).toBeNull();

    // Verify: Planning failure event
    const events = eventBus.getDispatched();
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'GOAP_PLANNING_FAILED' })
    );
  });
});
```

### Event Flow Integration

```javascript
describe('Event Flow', () => {
  it('should dispatch events in correct order', async () => {
    const actor = testBed.createActorWithGoal({
      goalId: 'simple_goal',
      priority: 10
    });

    const world = testBed.createWorld();
    contextAssemblyService.buildContext.mockReturnValue({ actor, world });

    await controller.decideTurn(actor, world);

    const eventTypes = eventBus.getDispatched().map(e => e.type);

    // Verify: Event order
    const planningStartIndex = eventTypes.indexOf('GOAP_PLANNING_STARTED');
    const planningCompleteIndex = eventTypes.indexOf('GOAP_PLANNING_COMPLETED');
    const taskRefinedIndex = eventTypes.indexOf('GOAP_TASK_REFINED');

    expect(planningStartIndex).toBeGreaterThan(-1);
    expect(planningCompleteIndex).toBeGreaterThan(planningStartIndex);
    expect(taskRefinedIndex).toBeGreaterThan(planningCompleteIndex);
  });

  it('should include all required event data', async () => {
    const actor = testBed.createActorWithGoal({
      goalId: 'test_goal',
      priority: 10
    });

    const world = testBed.createWorld();
    contextAssemblyService.buildContext.mockReturnValue({ actor, world });

    await controller.decideTurn(actor, world);

    const events = eventBus.getDispatched();

    // Verify: All events have timestamp
    events.forEach(event => {
      expect(event.payload.timestamp).toBeDefined();
    });

    // Verify: Goal-related events have goalId
    const goalEvents = events.filter(e =>
      e.type.startsWith('GOAP_GOAL') || e.type.includes('PLANNING')
    );
    goalEvents.forEach(event => {
      expect(event.payload.goalId).toBeDefined();
    });
  });
});
```

### Integration with GoapDecisionProvider

```javascript
describe('Integration with Turn System', () => {
  it('should produce action hints compatible with GoapDecisionProvider', async () => {
    const actor = testBed.createActorWithGoal({
      goalId: 'perform_action',
      priority: 10
    });

    const world = testBed.createWorld();
    contextAssemblyService.buildContext.mockReturnValue({ actor, world });

    const result = await controller.decideTurn(actor, world);

    // Verify: Action hint structure
    expect(result.actionHint).toMatchObject({
      actionId: expect.any(String),
      targetBindings: expect.any(Object),
      stepIndex: expect.any(Number),
      metadata: expect.objectContaining({
        taskId: expect.any(String),
        totalSteps: expect.any(Number)
      })
    });

    // Verify: Action ID is namespaced
    expect(result.actionHint.actionId).toMatch(/^[a-z_]+:[a-z_]+$/);
  });
});
```

## Test Helpers

### Actor Factory

```javascript
// In testBed or separate helper
testBed.createActorWithGoal = (goalConfig) => {
  return {
    id: 'test_actor',
    components: {
      'core:goals': {
        goals: [goalConfig]
      }
    }
  };
};

testBed.createActorWithMultiStepGoal = () => {
  return testBed.createActorWithGoal({
    id: 'complex_goal',
    priority: 10,
    conditions: []
  });
};
```

### World Factory

```javascript
testBed.createWorld = (config = {}) => {
  return {
    entities: config.entities || {},
    resources: config.resources || [],
    ...config
  };
};
```

## Success Validation

✅ **Done when**:
- Complete GOAP cycle tested with real implementations
- Multi-turn scenarios validated
- Plan invalidation and replanning work correctly
- Failure recovery scenarios pass
- Event flow verified
- All integration tests pass
- No mocking of core GOAP subsystems (planner, refinement, detector)

## Related Tickets

- **Previous**: GOAPIMPL-021-08 (Unit Tests)
- **Next**: GOAPIMPL-021-10 (E2E Tests)
- **Implements**: GOAPIMPL-021 (Parent - GOAP Controller)
- **Depends On**: GOAPIMPL-014, GOAPIMPL-018, GOAPIMPL-020
