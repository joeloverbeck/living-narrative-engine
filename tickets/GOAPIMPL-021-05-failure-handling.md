# GOAPIMPL-021-05: Failure Handling

**Parent Ticket**: GOAPIMPL-021 (GOAP Controller)
**Priority**: HIGH
**Estimated Effort**: 1 hour
**Dependencies**: GOAPIMPL-021-01, GOAPIMPL-021-02, GOAPIMPL-021-03, GOAPIMPL-021-04

## Description

Implement comprehensive failure handling for all stages of the GOAP cycle: planning failures, refinement failures, and execution failures. Ensures graceful degradation and proper fallback behaviors.

## Acceptance Criteria

- [ ] Planning failure handler implemented
- [ ] Refinement failure handler implemented
- [ ] Multiple fallback strategies supported (idle, replan, continue, fail)
- [ ] Failures logged with appropriate severity
- [ ] Failed goals/tasks tracked to prevent infinite retry loops
- [ ] Graceful degradation to idle behavior
- [ ] 90%+ test coverage for failure paths

## Files to Modify

- `src/goap/controllers/goapController.js`

## Implementation Details

### Planning Failure Handler

```javascript
/**
 * Handle planning failure
 * @param {object} goal - Goal that failed to plan
 * @returns {null} Always returns null (idle this turn)
 * @private
 */
#handlePlanningFailure(goal) {
  assertPresent(goal, 'Goal is required');

  this.#logger.warn('Planning failed for goal', {
    goalId: goal.id,
    priority: goal.priority
  });

  // Track failed goal to prevent infinite retry
  this.#trackFailedGoal(goal.id, 'planning_failed');

  // Dispatch planning failure event (GOAPIMPL-021-06)
  // Event will be handled there

  // Fallback: idle this turn
  // Next turn will try next highest priority goal
  return null;
}

/**
 * Track failed goal attempt
 * @param {string} goalId - ID of failed goal
 * @param {string} reason - Failure reason
 * @private
 */
#trackFailedGoal(goalId, reason) {
  if (!this.#failedGoals) {
    this.#failedGoals = new Map();
  }

  const attempts = this.#failedGoals.get(goalId) || [];
  attempts.push({
    reason,
    timestamp: Date.now()
  });

  this.#failedGoals.set(goalId, attempts);

  // Prune old failures (older than 5 minutes)
  const FAILURE_EXPIRY = 5 * 60 * 1000;
  const now = Date.now();
  const recentFailures = attempts.filter(
    f => now - f.timestamp < FAILURE_EXPIRY
  );
  this.#failedGoals.set(goalId, recentFailures);

  // If too many recent failures, mark goal as permanently failed
  const MAX_FAILURES = 3;
  if (recentFailures.length >= MAX_FAILURES) {
    this.#logger.error('Goal failed too many times, giving up', {
      goalId,
      attempts: recentFailures.length
    });
    // Could dispatch permanent failure event here
  }
}
```

### Refinement Failure Handler

```javascript
/**
 * Handle refinement failure with configurable fallback
 * @param {object} task - Task that failed to refine
 * @param {object} refinementResult - Failure result from refinement engine
 * @returns {object|null} Action hint or null depending on fallback
 * @private
 */
#handleRefinementFailure(task, refinementResult) {
  assertPresent(task, 'Task is required');
  assertPresent(refinementResult, 'Refinement result is required');

  const fallbackBehavior = refinementResult.fallbackBehavior || 'replan';

  this.#logger.warn('Refinement failed for task', {
    taskId: task.taskId,
    reason: refinementResult.error,
    fallback: fallbackBehavior
  });

  // Track failed task
  this.#trackFailedTask(task.taskId, 'refinement_failed');

  // Dispatch refinement failure event (GOAPIMPL-021-06)

  // Handle different fallback strategies
  switch (fallbackBehavior) {
    case 'replan':
      // Clear plan → will replan next turn
      this.#clearPlan('Refinement failed, replanning');
      return null;

    case 'continue':
      // Skip this task, try next task in plan
      this.#logger.info('Skipping failed task, continuing plan');
      const planContinues = this.#advancePlan();

      if (!planContinues) {
        // Plan exhausted
        this.#clearPlan('Plan exhausted after skipping failed task');
        return null;
      }

      // Recursively try next task
      // Note: Add recursion depth limit to prevent stack overflow
      if (!this.#recursionDepth) {
        this.#recursionDepth = 0;
      }
      this.#recursionDepth++;

      if (this.#recursionDepth > 10) {
        this.#logger.error('Recursion depth exceeded in failure handling');
        this.#clearPlan('Too many consecutive failures');
        this.#recursionDepth = 0;
        return null;
      }

      // Try next task
      const result = this.decideTurn(this.#currentActor, this.#currentWorld);
      this.#recursionDepth = 0;
      return result;

    case 'fail':
      // Clear plan and give up on goal
      this.#clearPlan('Refinement failed critically');
      this.#trackFailedGoal(this.#activePlan?.goal?.id, 'refinement_critical_failure');
      return null;

    default:
      // Unknown fallback → treat as replan
      this.#logger.warn('Unknown fallback behavior, replanning', {
        fallback: fallbackBehavior
      });
      this.#clearPlan('Unknown fallback behavior');
      return null;
  }
}

/**
 * Track failed task attempt
 * @param {string} taskId - ID of failed task
 * @param {string} reason - Failure reason
 * @private
 */
#trackFailedTask(taskId, reason) {
  if (!this.#failedTasks) {
    this.#failedTasks = new Map();
  }

  const attempts = this.#failedTasks.get(taskId) || [];
  attempts.push({
    reason,
    timestamp: Date.now()
  });

  this.#failedTasks.set(taskId, attempts);

  // Prune old failures (same as goals)
  const FAILURE_EXPIRY = 5 * 60 * 1000;
  const now = Date.now();
  const recentFailures = attempts.filter(
    f => now - f.timestamp < FAILURE_EXPIRY
  );
  this.#failedTasks.set(taskId, recentFailures);
}
```

### Action Hint Resolution Failure

```javascript
/**
 * Handle action hint resolution failure
 * Called when GoapDecisionProvider cannot match hint to available actions
 * @param {object} actionHint - Hint that failed to resolve
 * @returns {null} Idle this turn
 * @private
 */
#handleActionHintFailure(actionHint) {
  this.#logger.warn('Action hint failed to resolve', {
    actionId: actionHint.actionId,
    bindings: actionHint.targetBindings
  });

  // Action not available → likely world state changed
  // Invalidate plan and replan next turn
  this.#clearPlan('Action hint failed to resolve');

  // Dispatch hint resolution failure event (GOAPIMPL-021-06)

  return null;
}
```

### Constructor Additions

```javascript
constructor({
  planner,
  refinementEngine,
  invalidationDetector,
  contextAssemblyService,
  eventBus,
  logger
}) {
  // ... existing validations ...

  this.#activePlan = null;
  this.#failedGoals = new Map();
  this.#failedTasks = new Map();
  this.#recursionDepth = 0;
  this.#currentActor = null;  // For recursive decideTurn
  this.#currentWorld = null;
}
```

### decideTurn Modifications

```javascript
async decideTurn(actor, world) {
  // ... existing validation ...

  // Store for recursive calls in failure handling
  this.#currentActor = actor;
  this.#currentWorld = world;

  try {
    // ... existing GOAP cycle logic ...

    // Reset recursion depth on successful completion
    this.#recursionDepth = 0;

    return result;
  } catch (err) {
    this.#logger.error('Unexpected error in GOAP cycle', err);

    // Clear plan on unexpected errors
    this.#clearPlan('Unexpected error');

    // Dispatch error event (GOAPIMPL-021-06)

    // Reset state
    this.#recursionDepth = 0;

    // Idle this turn
    return null;
  }
}
```

## Testing Requirements

### Unit Tests (add to existing test file)
- [ ] Planning failure returns null (idle)
- [ ] Planning failure tracked in failed goals
- [ ] Refinement failure with 'replan' fallback clears plan
- [ ] Refinement failure with 'continue' fallback advances plan
- [ ] Refinement failure with 'fail' fallback clears plan and tracks goal
- [ ] Refinement failure recursion depth limit enforced
- [ ] Action hint failure clears plan
- [ ] Failed goal tracking prevents infinite retries
- [ ] Failed goal expiry works correctly
- [ ] Unexpected errors handled gracefully

### Integration Tests
- [ ] Failed planning leads to idle turn
- [ ] Failed refinement triggers replanning
- [ ] Multiple consecutive failures handled correctly
- [ ] Recovery after transient failures

## Integration Points

### Required Services
- Event bus for failure events (GOAPIMPL-021-06)

### Failure Event Types
- `GOAP_PLANNING_FAILED`
- `GOAP_REFINEMENT_FAILED`
- `GOAP_ACTION_HINT_FAILED`
- `GOAP_UNEXPECTED_ERROR`

## Success Validation

✅ **Done when**:
- All failure types handled gracefully
- Fallback strategies implemented correctly
- Failed attempts tracked and expired properly
- Recursion depth limits prevent stack overflow
- All edge cases covered with tests
- Unit and integration tests pass with 90%+ coverage
- System degrades gracefully under all failure conditions

## Related Tickets

- **Previous**: GOAPIMPL-021-04 (Action Hint Extraction)
- **Next**: GOAPIMPL-021-06 (Event Dispatching)
- **Implements**: GOAPIMPL-021 (Parent - GOAP Controller)
