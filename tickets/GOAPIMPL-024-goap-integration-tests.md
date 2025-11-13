# GOAPIMPL-024: GOAP System Integration Tests

**Priority**: HIGH
**Estimated Effort**: 3-4 hours
**Dependencies**: All implementation tickets (GOAPIMPL-007 through GOAPIMPL-023)

## Description

Create comprehensive integration test suite covering complete GOAP workflows with multiple tasks, actors, and scenarios. Tests validate the entire GOAP system working together end-to-end.

Integration tests ensure all GOAP components work together correctly and catch integration issues that unit tests might miss.

## Acceptance Criteria

- [ ] Test simple goal achievement (single task)
- [ ] Test complex plans (multiple tasks with dependencies)
- [ ] Test replanning on world changes
- [ ] Test knowledge-limited planning
- [ ] Test multiple actors with different capabilities
- [ ] Test failure handling at all levels (planning, refinement, execution)
- [ ] Test plan invalidation scenarios
- [ ] Test parametrized task binding
- [ ] Test conditional refinement branching
- [ ] 80%+ coverage of GOAP system

## Files to Create

### Integration Test Suites
- `tests/integration/goap/simpleGoal.integration.test.js` - Simple goal scenarios
- `tests/integration/goap/complexPlan.integration.test.js` - Multi-task plans
- `tests/integration/goap/replanning.integration.test.js` - Replanning scenarios
- `tests/integration/goap/knowledgeLimited.integration.test.js` - Knowledge-limited planning
- `tests/integration/goap/multiActor.integration.test.js` - Multiple actors
- `tests/integration/goap/failureHandling.integration.test.js` - Failure scenarios
- `tests/integration/goap/planInvalidation.integration.test.js` - Invalidation scenarios

## Files to Modify

None (pure testing)

## Testing Requirements

### Test 1: Simple Goal Achievement
**Scenario**: Actor hungry, food nearby
```javascript
describe('Simple Goal: Eat Food', () => {
  it('should plan and execute single task to achieve goal', async () => {
    // Setup: Actor with hunger, food in same location
    const actor = createActor({ hungry: true });
    const food = createFood({ location: actor.location });

    // Goal: Be not hungry
    const goal = { conditions: [{ "!": { "var": "actor.hungry" } }] };

    // Execute GOAP cycle
    const result = await goapController.achieveGoal(actor, goal);

    // Verify: Goal achieved
    expect(result.success).toBe(true);
    expect(actor.components['core:hungry']).toBe(false);
    expect(result.tasksExecuted).toEqual(['consume_nourishing_item']);
  });
});
```

### Test 2: Complex Multi-Task Plan
**Scenario**: Actor needs shelter, must gather resources first
```javascript
describe('Complex Goal: Build Shelter', () => {
  it('should execute multi-step plan with dependencies', async () => {
    // Setup: Actor, resources scattered, building location
    const actor = createActor({ hasResources: false, hasShelter: false });
    const resources = createResources({ scattered: true });

    // Goal: Have shelter
    const goal = { conditions: [{ "var": "actor.has_shelter" }] };

    // Execute GOAP cycle
    const result = await goapController.achieveGoal(actor, goal);

    // Verify: Multi-step plan executed
    expect(result.success).toBe(true);
    expect(result.tasksExecuted).toEqual([
      'gather_resources',
      'transport_resources',
      'build_shelter'
    ]);
    expect(actor.components['core:shelter']).toBeDefined();
  });
});
```

### Test 3: Replanning on World Change
**Scenario**: Plan invalidated mid-execution, replans
```javascript
describe('Replanning: Food Taken by Other', () => {
  it('should replan when planned resource becomes unavailable', async () => {
    // Setup: Actor planning to eat specific food
    const actor = createActor({ hungry: true });
    const food = createFood({ location: actor.location });
    const otherActor = createActor({ location: actor.location });

    // Start GOAP cycle
    await goapController.startTurn(actor);

    // Simulate: Other actor takes food before our actor executes
    removeEntity(food.id);

    // Continue GOAP cycle
    const result = await goapController.continueTurn(actor);

    // Verify: Replanning occurred
    expect(result.replanned).toBe(true);
    expect(result.replanReason).toBe('precondition_violated');

    // Verify: Actor found alternative or gave up
    expect(result.success || result.goalUnachievable).toBe(true);
  });
});
```

### Test 4: Knowledge-Limited Planning
**Scenario**: Actor only knows subset of world, plans accordingly
```javascript
describe('Knowledge Limitation: Hidden Food', () => {
  it('should only plan with known entities', async () => {
    // Setup: Actor knows about food1, not food2
    const actor = createActor({ hungry: true });
    const food1 = createFood({ location: 'room1', known: true });
    const food2 = createFood({ location: 'room2', known: false });

    // Add knowledge
    actor.components['core:known_to'] = { entities: [food1.id] };

    // Goal: Eat food
    const goal = { conditions: [{ "!": { "var": "actor.hungry" } }] };

    // Execute GOAP cycle
    const result = await goapController.achieveGoal(actor, goal);

    // Verify: Only food1 considered (food2 ignored)
    expect(result.planParameters.item).toBe(food1.id);
    expect(result.planParameters.item).not.toBe(food2.id);
  });
});
```

### Test 5: Multi-Actor Coordination
**Scenario**: Multiple GOAP actors operating simultaneously
```javascript
describe('Multi-Actor: Shared Resources', () => {
  it('should handle multiple actors with competing goals', async () => {
    // Setup: Two hungry actors, one food
    const actor1 = createActor({ hungry: true, id: 'actor1' });
    const actor2 = createActor({ hungry: true, id: 'actor2' });
    const food = createFood({ quantity: 1 });

    const goal = { conditions: [{ "!": { "var": "actor.hungry" } }] };

    // Execute both actors' turns
    const results = await Promise.all([
      goapController.achieveGoal(actor1, goal),
      goapController.achieveGoal(actor2, goal)
    ]);

    // Verify: Only one actor gets food
    const successfulActors = results.filter(r => r.success).length;
    expect(successfulActors).toBe(1);

    // Verify: Other actor replans or fails gracefully
    const failedActor = results.find(r => !r.success);
    expect(failedActor.replanTriggered || failedActor.goalUnachievable).toBe(true);
  });
});
```

### Test 6: Failure Handling
**Scenario**: Planning fails, refinement fails, execution fails
```javascript
describe('Failure Handling: All Levels', () => {
  it('should handle planning failure gracefully', async () => {
    const actor = createActor();
    const impossibleGoal = { conditions: [{ "var": "impossible_state" }] };

    const result = await goapController.achieveGoal(actor, impossibleGoal);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('no_plan_found');
    // Actor should not crash, just idle
  });

  it('should handle refinement failure gracefully', async () => {
    const actor = createActor({ missing_capability: true });
    const goal = { conditions: [{ "var": "goal_state" }] };

    // Task exists but cannot be refined (no applicable methods)
    const result = await goapController.achieveGoal(actor, goal);

    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/refinement_failed/);
  });

  it('should handle execution failure gracefully', async () => {
    const actor = createActor();
    const goal = { conditions: [{ "var": "goal_state" }] };

    // Simulate action execution failure
    mockActionExecutor.execute.mockResolvedValue({ success: false });

    const result = await goapController.achieveGoal(actor, goal);

    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/execution_failed/);
  });
});
```

### Test 7: Plan Invalidation
**Scenario**: Various plan invalidation triggers
```javascript
describe('Plan Invalidation: Multiple Scenarios', () => {
  it('should invalidate when precondition violated', async () => {
    // Test: Entity required by task is removed
  });

  it('should invalidate when goal already satisfied', async () => {
    // Test: External event satisfies goal before execution
  });

  it('should invalidate when actor becomes incapacitated', async () => {
    // Test: Actor loses capability mid-plan
  });
});
```

## Test Data and Fixtures

### Create Test Helpers
```javascript
// tests/common/goap/goapTestHelpers.js
export function createTestWorld() {
  return {
    entities: new Map(),
    addEntity(entity) { this.entities.set(entity.id, entity); },
    removeEntity(id) { this.entities.delete(id); },
    getEntity(id) { return this.entities.get(id); }
  };
}

export function createTestActor(overrides = {}) {
  return {
    id: uuid(),
    components: {
      'core:hungry': false,
      'core:known_to': { entities: [] },
      ...overrides
    }
  };
}

export function createTestGoal(conditions, priority = 10) {
  return {
    id: uuid(),
    priority,
    conditions
  };
}
```

## Reference Documentation

### Specifications
- `specs/goap-system-specs.md` - Complete GOAP specification

### Examples
- `data/mods/core/tasks/*.task.json` - Example tasks for testing
- `data/mods/core/tasks/refinement-methods/*.refinement.json` - Example methods

## Implementation Notes

### Test Organization
- One test file per major scenario category
- Each test file contains multiple related tests
- Use descriptive test names explaining scenario

### Test Isolation
- Each test creates fresh world state
- No shared state between tests
- Clean up after each test (DI container reset, etc.)

### Mock vs Real Components
- **Real**: Task loader, schema validator, JSON Logic
- **Mock**: Action executor (for controlled testing)
- **Real where possible**: Integration tests should use real components

### Performance Benchmarks
Include performance assertions:
```javascript
const startTime = Date.now();
await goapController.achieveGoal(actor, goal);
const duration = Date.now() - startTime;

expect(duration).toBeLessThan(100);  // Planning should be fast
```

## Success Validation

✅ **Done when**:
- All integration tests pass
- 80%+ coverage of GOAP system
- Tests cover all major scenarios
- Test failures provide clear diagnostic information
- Tests run in reasonable time (< 5s total)
- Documentation explains test scenarios and helpers
