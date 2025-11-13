# GOAPIMPL-021: GOAP Controller

**Priority**: CRITICAL
**Estimated Effort**: 4-5 hours
**Dependencies**: GOAPIMPL-014 (Refinement Engine), GOAPIMPL-018 (GOAP Planner), GOAPIMPL-020 (Plan Invalidation Detector)

## Description

Create GOAPController that orchestrates the complete GOAP cycle: goal selection → planning → refinement → execution → replanning. Integrates planner, refinement engine, and action executor into a cohesive decision-making system.

The GOAP controller is the main entry point for GOAP-based AI - it coordinates all GOAP subsystems to make intelligent action decisions.

## Acceptance Criteria

- [ ] Manages complete GOAP cycle (goal → plan → refine → execute)
- [ ] Handles goal selection from actor's goals
- [ ] Triggers planning with GOAP planner
- [ ] Refines tasks to primitive actions with refinement engine
- [ ] Executes actions via existing action executor
- [ ] Detects plan invalidation and triggers replanning
- [ ] Handles all failure modes gracefully (planning fails, refinement fails, execution fails)
- [ ] Dispatches lifecycle events for monitoring
- [ ] Maintains plan state across turns
- [ ] 90%+ test coverage

## Files to Create

### Main Implementation
- `src/goap/goapController.js` - Main GOAP orchestration controller

### Tests
- `tests/unit/goap/goapController.test.js` - Unit tests
- `tests/integration/goap/goapController.integration.test.js` - Integration tests
- `tests/e2e/goap/goapFullCycle.e2e.test.js` - End-to-end tests

## Files to Modify

### Dependency Injection
- `src/dependencyInjection/tokens/tokens-core.js` - Add `IGOAPController` token
- `src/dependencyInjection/registrations/goapRegistrations.js` - Register controller

## Testing Requirements

### Unit Tests
- [ ] Test complete GOAP cycle with simple goal
- [ ] Test replanning on plan invalidation
- [ ] Test failure handling at each stage (planning, refinement, execution)
- [ ] Test multiple goal achievement
- [ ] Test goal selection logic
- [ ] Test plan state persistence
- [ ] Test event dispatching

### Integration Tests
- [ ] Test GOAP cycle with real tasks and actions
- [ ] Test replanning scenarios
- [ ] Test multi-step plans
- [ ] Test failure recovery
- [ ] Test integration with action executor

### E2E Tests
- [ ] Test complete game scenario with GOAP AI
- [ ] Test actor achieving complex goal over multiple turns
- [ ] Test plan adaptation to dynamic world
- [ ] Test multi-actor GOAP scenarios

## GOAP Cycle Flow

### High-Level Algorithm
```javascript
decideTurn(actor, world) {
  // 1. Check if we have active plan
  if (this.activePlan) {
    // 2. Validate plan still applicable
    const validation = this.invalidationDetector.check(
      this.activePlan,
      world
    );

    if (!validation.valid) {
      // 3. Plan invalidated → clear and replan
      this.logger.info('Plan invalidated', validation.reason);
      this.activePlan = null;
    }
  }

  // 4. Need new plan?
  if (!this.activePlan) {
    // 5. Select goal
    const goal = this.selectGoal(actor);

    if (!goal) {
      return null;  // No goals → idle
    }

    // 6. Plan to achieve goal
    const plan = await this.planner.plan(actor, goal, world);

    if (!plan) {
      // 7. Planning failed → handle failure
      return this.handlePlanningFailure(goal);
    }

    this.activePlan = {
      goal: goal,
      tasks: plan,
      currentStep: 0
    };
  }

  // 8. Get next task from plan
  const task = this.activePlan.tasks[this.activePlan.currentStep];

  // 9. Refine task to primitive actions
  const refinementResult = await this.refinementEngine.refine(
    task,
    actor,
    world
  );

  if (!refinementResult.success) {
    // 10. Refinement failed → handle failure
    return this.handleRefinementFailure(task, refinementResult);
  }

  // 11. Execute first primitive action
  const action = refinementResult.actions[0];

  // 12. Advance plan
  this.activePlan.currentStep++;

  if (this.activePlan.currentStep >= this.activePlan.tasks.length) {
    // 13. Plan complete
    this.activePlan = null;
  }

  return action;
}
```

### Goal Selection
```javascript
selectGoal(actor) {
  const goals = actor.components['core:goals']?.goals || [];

  // Sort by priority (descending)
  goals.sort((a, b) => b.priority - a.priority);

  // Return highest priority unsatisfied goal
  for (const goal of goals) {
    if (!this.isGoalSatisfied(goal, actor)) {
      return goal;
    }
  }

  return null;  // All goals satisfied
}
```

## Plan State Management

### Active Plan Structure
```javascript
{
  goal: {
    id: "be_fed",
    priority: 10,
    conditions: [...]
  },
  tasks: [
    { taskId: "gather_food", parameters: {...} },
    { taskId: "eat_food", parameters: {...} }
  ],
  currentStep: 0,
  createdAt: timestamp,
  lastValidated: timestamp
}
```

### Plan Persistence
- Store active plan in actor state or separate plan manager
- Persist plan across turns
- Clear plan when completed or invalidated

## Failure Handling

### Planning Failure
```javascript
handlePlanningFailure(goal) {
  this.logger.warn('Planning failed for goal', goal.id);

  // Dispatch event
  this.eventBus.dispatch({
    type: 'GOAP_PLANNING_FAILED',
    payload: { goalId: goal.id, actorId: this.actor.id }
  });

  // Fallback: idle or default action
  return null;  // Idle this turn
}
```

### Refinement Failure
```javascript
handleRefinementFailure(task, result) {
  this.logger.warn('Refinement failed for task', task.taskId);

  if (result.fallbackBehavior === 'replan') {
    // Clear plan → will replan next turn
    this.activePlan = null;
    return null;
  }

  if (result.fallbackBehavior === 'continue') {
    // Skip this task, continue with plan
    this.activePlan.currentStep++;
    return this.decideTurn(this.actor, this.world);  // Recurse
  }

  // fallbackBehavior === 'fail'
  this.activePlan = null;
  return null;
}
```

### Execution Failure
Handled by action executor, may trigger plan invalidation.

## Events to Dispatch

### GOAP Lifecycle Events
```javascript
// Planning started
GOAP_PLANNING_STARTED { actorId, goalId }

// Planning completed
GOAP_PLANNING_COMPLETED { actorId, goalId, planLength }

// Planning failed
GOAP_PLANNING_FAILED { actorId, goalId, reason }

// Plan invalidated
GOAP_PLAN_INVALIDATED { actorId, goalId, reason, step }

// Replanning triggered
GOAP_REPLANNING_STARTED { actorId, goalId }

// Task refined
GOAP_TASK_REFINED { actorId, taskId, actionsGenerated }

// Goal achieved
GOAP_GOAL_ACHIEVED { actorId, goalId }
```

## Reference Documentation

### Specifications
- `specs/goap-system-specs.md` lines 164-195 - **PRIMARY REFERENCE** - Complete execution loop
- `specs/goap-system-specs.md` lines 327-349 - Plan invalidation and replanning

## Implementation Notes

### State Management
Options for plan persistence:
1. **Actor component**: Add `core:active_plan` component
2. **Controller state**: Store in controller instance (simple)
3. **Plan manager**: Separate service for multi-actor scenarios

Start with controller state for MVP.

### Turn-Based Execution
GOAP controller returns ONE action per turn:
- Refine task → get action sequence
- Execute first action only
- Store remaining actions for future turns (or re-refine)

### Replanning Strategy
When to replan:
- **Reactive**: On plan invalidation
- **Periodic**: Every N turns
- **Opportunistic**: When better plan available

Start with reactive for MVP.

### Goal Achievement Detection
Check goal satisfaction:
- Before goal selection (skip satisfied goals)
- After action execution (detect achievement)
- Periodic checks (external goal satisfaction)

### Performance Considerations
- Planning is expensive (~10-100ms)
- Cache plans when possible
- Validate incrementally (not full revalidation)
- Consider async planning (don't block game loop)

## Integration Points

### Required Services (inject)
- `IGOAPPlanner` (GOAPIMPL-018) - Planning
- `IRefinementEngine` (GOAPIMPL-014) - Task refinement
- `IPlanInvalidationDetector` (GOAPIMPL-020) - Plan validation
- `IActionExecutor` - Execute primitive actions
- `IContextAssemblyService` (GOAPIMPL-007) - Build contexts
- `IEventBus` - Dispatch events
- `ILogger` - Logging

### Used By (future)
- GOAPIMPL-022 (Action Decider Integration) - GOAP decision provider

## Success Validation

✅ **Done when**:
- All unit tests pass with 90%+ coverage
- Integration tests validate complete GOAP cycle
- E2E tests demonstrate goal achievement over multiple turns
- All failure scenarios handled gracefully
- Events dispatched for monitoring
- Plan state persists correctly
- Service integrates with DI container
- Documentation explains GOAP cycle and failure handling
