# GOAPIMPL-020: Plan Invalidation Detector

**Priority**: HIGH
**Estimated Effort**: 2-3 hours
**Dependencies**: GOAPIMPL-018 (GOAP Planner)

## Description

Create PlanInvalidationDetector that checks if plan preconditions still hold before executing each task. Triggers replanning when world state changes invalidate the current plan.

Plan invalidation is critical for responsive AI - detecting when the plan is no longer valid and replanning accordingly.

## Acceptance Criteria

- [ ] Re-checks task preconditions before task execution
- [ ] Detects world state changes that invalidate plan
- [ ] Returns invalidation reason for debugging
- [ ] Supports different invalidation policies (strict/lenient)
- [ ] Logs invalidation events for analysis
- [ ] Provides invalidation diagnostics
- [ ] Handles precondition evaluation errors gracefully
- [ ] 90%+ test coverage

## Files to Create

### Main Implementation
- `src/goap/planner/planInvalidationDetector.js` - Invalidation detector

### Tests
- `tests/unit/goap/planner/planInvalidationDetector.test.js` - Unit tests

## Files to Modify

### Dependency Injection
- `src/dependencyInjection/tokens/tokens-core.js` - Add `IPlanInvalidationDetector` token
- `src/dependencyInjection/registrations/goapRegistrations.js` - Register service

## Testing Requirements

### Unit Tests
- [ ] Test precondition re-checking
- [ ] Test invalidation detection with state changes
- [ ] Test invalidation reasons
- [ ] Test different invalidation policies
- [ ] Test valid plan detection (no invalidation)
- [ ] Test error handling for evaluation failures
- [ ] Test diagnostic output

## Plan Invalidation Detection

### Process Flow
```javascript
checkPlanValidity(plan, currentState, context) {
  const diagnostics = [];

  for (const [index, planStep] of plan.entries()) {
    const task = planStep.task;

    // 1. Re-evaluate preconditions
    for (const precondition of task.preconditions) {
      const satisfied = evaluateCondition(
        precondition,
        currentState,
        context
      );

      if (!satisfied) {
        // 2. Plan invalidated
        return {
          valid: false,
          invalidatedAt: index,
          task: task.id,
          reason: 'precondition_violated',
          precondition: precondition,
          diagnostics: diagnostics
        };
      }

      diagnostics.push({
        task: task.id,
        precondition: precondition,
        satisfied: true
      });
    }
  }

  // 3. All preconditions still satisfied
  return {
    valid: true,
    diagnostics: diagnostics
  };
}
```

### Invalidation Policies

**Strict Policy** (default):
- Check preconditions before **every** task
- Replan on first violation
- Most responsive, higher overhead

**Lenient Policy**:
- Check preconditions before **critical** tasks only
- Allow minor deviations
- Lower overhead, less responsive

**Periodic Policy**:
- Check every N turns
- Balance responsiveness and performance

## When to Check for Invalidation

### Check Points
1. **Before task execution**: Most important
2. **After significant world events**: Actor moved, item taken, etc.
3. **Periodic checks**: Every N turns
4. **On-demand**: When triggered by game logic

### Event-Driven Invalidation
React to world state changes:
```javascript
eventBus.subscribe('ENTITY_MOVED', (event) => {
  if (affectsCurrentPlan(event)) {
    checkPlanValidity();
  }
});
```

## Invalidation Reasons

### Reason Types
```javascript
const INVALIDATION_REASONS = {
  PRECONDITION_VIOLATED: 'Task precondition no longer satisfied',
  GOAL_ALREADY_SATISFIED: 'Goal achieved by external event',
  TASK_IMPOSSIBLE: 'Task cannot be executed due to world changes',
  PARAMETER_INVALID: 'Task parameter entity no longer exists',
  ACTOR_INCAPACITATED: 'Actor cannot continue (dead, stunned, etc.)'
};
```

### Diagnostic Information
```javascript
{
  valid: false,
  invalidatedAt: 2,  // Step index
  task: 'core:eat_food',
  reason: 'precondition_violated',
  precondition: { "var": "actor.has_food" },
  currentState: { /* state snapshot */ },
  diagnostics: [
    { task: 'gather_food', valid: true },
    { task: 'prepare_food', valid: true },
    { task: 'eat_food', valid: false, reason: '...' }
  ]
}
```

## Reference Documentation

### Specifications
- `specs/goap-system-specs.md` lines 209-230 - **PRIMARY REFERENCE** - Plan invalidation
- `specs/goap-system-specs.md` lines 327-349 - Detailed invalidation design

## Implementation Notes

### Precondition Re-Evaluation
Use same evaluation as planning:
```javascript
const satisfied = jsonLogic.evaluate(
  precondition,
  {
    actor: currentActor,
    world: currentWorldState,
    task: planStep.parameters
  }
);
```

### Performance Optimization
- **Incremental checking**: Only check affected tasks
- **Caching**: Cache precondition results
- **Early exit**: Stop on first violation
- **Batch checks**: Check multiple tasks together

### Partial Plan Execution
When plan invalidates mid-execution:
```javascript
const executedSteps = plan.slice(0, invalidatedAt);
const remainingSteps = plan.slice(invalidatedAt);

// Option 1: Replan from current state
replan(currentState, goal);

// Option 2: Continue with fallback behavior
executeFallback(remainingSteps);
```

### False Positives
Minimize false positives (invalid invalidation):
- Use lenient comparisons (tolerance for numeric values)
- Ignore non-critical preconditions (if configurable)
- Debounce rapid state changes

### Logging
Log invalidation for analysis:
```
[PlanInvalidation] Plan invalidated at step 2
  Task: core:eat_food
  Reason: precondition_violated
  Precondition: {"var": "actor.has_food"}
  Current state: actor.has_food = false
  Action: Replanning...
```

## Integration Points

### Required Services (inject)
- `IJsonLogicService` - Evaluate preconditions
- `ILogger` - Logging
- `IEventBus` - Subscribe to world events (optional)

### Used By (future)
- GOAPIMPL-021 (GOAP Controller) - Check validity during plan execution

## Success Validation

✅ **Done when**:
- All unit tests pass with 90%+ coverage
- Invalidation detection works with state changes
- Different policies implemented and tested
- Diagnostic output is clear and actionable
- Performance is acceptable (< 10ms per check)
- Service integrates with DI container
- Documentation explains invalidation detection and policies
