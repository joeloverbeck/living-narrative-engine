# GOAPIMPL-021-06: Event Dispatching

**Parent Ticket**: GOAPIMPL-021 (GOAP Controller)
**Priority**: MEDIUM
**Estimated Effort**: 45 minutes
**Dependencies**: GOAPIMPL-021-01 through GOAPIMPL-021-05

## Description

Implement comprehensive event dispatching for all GOAP lifecycle stages. Enables monitoring, debugging, and integration with other systems through the event bus.

## Acceptance Criteria

- [ ] All GOAP lifecycle events dispatched at appropriate points
- [ ] Event payloads contain relevant context data
- [ ] Events follow project event schema conventions
- [ ] Event dispatching doesn't block GOAP execution
- [ ] Events logged for debugging
- [ ] 90%+ test coverage for event dispatching

## Files to Modify

- `src/goap/controllers/goapController.js`

## Implementation Details

### Event Definitions

```javascript
/**
 * GOAP lifecycle event types
 */
const GOAP_EVENTS = {
  PLANNING_STARTED: 'GOAP_PLANNING_STARTED',
  PLANNING_COMPLETED: 'GOAP_PLANNING_COMPLETED',
  PLANNING_FAILED: 'GOAP_PLANNING_FAILED',
  PLAN_INVALIDATED: 'GOAP_PLAN_INVALIDATED',
  REPLANNING_STARTED: 'GOAP_REPLANNING_STARTED',
  TASK_REFINED: 'GOAP_TASK_REFINED',
  REFINEMENT_FAILED: 'GOAP_REFINEMENT_FAILED',
  ACTION_HINT_GENERATED: 'GOAP_ACTION_HINT_GENERATED',
  ACTION_HINT_FAILED: 'GOAP_ACTION_HINT_FAILED',
  GOAL_ACHIEVED: 'GOAP_GOAL_ACHIEVED',
  GOAL_SELECTED: 'GOAP_GOAL_SELECTED',
  UNEXPECTED_ERROR: 'GOAP_UNEXPECTED_ERROR'
};
```

### Event Dispatch Helper

```javascript
/**
 * Dispatch GOAP lifecycle event
 * @param {string} eventType - Event type from GOAP_EVENTS
 * @param {object} payload - Event payload
 * @private
 */
#dispatchEvent(eventType, payload) {
  try {
    this.#eventBus.dispatch({
      type: eventType,
      payload: {
        timestamp: Date.now(),
        ...payload
      }
    });

    this.#logger.debug('GOAP event dispatched', {
      eventType,
      payload
    });
  } catch (err) {
    // Event dispatching should never break GOAP execution
    this.#logger.error('Failed to dispatch GOAP event', {
      eventType,
      payload,
      error: err.message
    });
  }
}
```

### Goal Selection Events

```javascript
#selectGoal(actor) {
  // ... existing goal selection logic ...

  for (const goal of sortedGoals) {
    if (!this.#isGoalSatisfied(goal, actor)) {
      // Dispatch goal selected event
      this.#dispatchEvent(GOAP_EVENTS.GOAL_SELECTED, {
        actorId: actor.id,
        goalId: goal.id,
        priority: goal.priority
      });

      this.#logger.info('Goal selected', {
        actorId: actor.id,
        goalId: goal.id,
        priority: goal.priority
      });

      return goal;
    }
  }

  return null;
}
```

### Planning Events

```javascript
async decideTurn(actor, world) {
  // ... plan validation logic ...

  if (!this.#activePlan) {
    const goal = this.#selectGoal(actor);

    if (!goal) {
      return null;
    }

    // Dispatch planning started event
    this.#dispatchEvent(GOAP_EVENTS.PLANNING_STARTED, {
      actorId: actor.id,
      goalId: goal.id
    });

    const planResult = await this.#planner.plan(actor, goal, world);

    if (!planResult || !planResult.tasks) {
      // Dispatch planning failed event
      this.#dispatchEvent(GOAP_EVENTS.PLANNING_FAILED, {
        actorId: actor.id,
        goalId: goal.id,
        reason: planResult?.error || 'Unknown planning failure'
      });

      return this.#handlePlanningFailure(goal);
    }

    // Dispatch planning completed event
    this.#dispatchEvent(GOAP_EVENTS.PLANNING_COMPLETED, {
      actorId: actor.id,
      goalId: goal.id,
      planLength: planResult.tasks.length,
      tasks: planResult.tasks.map(t => t.taskId)
    });

    this.#activePlan = this.#createPlan(goal, planResult.tasks);
  }

  // ... rest of cycle ...
}
```

### Plan Invalidation Events

```javascript
#validateActivePlan(world) {
  if (!this.#activePlan) {
    return { valid: false, reason: 'No active plan' };
  }

  const validation = this.#invalidationDetector.check(
    this.#activePlan,
    world
  );

  if (!validation.valid) {
    // Dispatch plan invalidated event
    this.#dispatchEvent(GOAP_EVENTS.PLAN_INVALIDATED, {
      goalId: this.#activePlan.goal.id,
      reason: validation.reason,
      currentStep: this.#activePlan.currentStep,
      totalSteps: this.#activePlan.tasks.length
    });

    // If invalidation triggers replanning, dispatch that too
    this.#dispatchEvent(GOAP_EVENTS.REPLANNING_STARTED, {
      goalId: this.#activePlan.goal.id,
      previousStep: this.#activePlan.currentStep
    });

    this.#logger.warn('Plan invalidated', {
      goalId: this.#activePlan.goal.id,
      reason: validation.reason
    });
  } else {
    this.#activePlan.lastValidated = Date.now();
  }

  return validation;
}
```

### Task Refinement Events

```javascript
async #refineTask(task, actor) {
  // ... refinement logic ...

  const result = await this.#refinementEngine.refine(
    task.taskId,
    actor.id,
    task.params
  );

  if (result.success) {
    // Dispatch task refined event
    this.#dispatchEvent(GOAP_EVENTS.TASK_REFINED, {
      actorId: actor.id,
      taskId: task.taskId,
      stepsGenerated: result.stepResults.length,
      actionRefs: result.stepResults.map(s => s.actionRef)
    });
  } else {
    // Dispatch refinement failed event
    this.#dispatchEvent(GOAP_EVENTS.REFINEMENT_FAILED, {
      actorId: actor.id,
      taskId: task.taskId,
      reason: result.error,
      fallbackBehavior: result.fallbackBehavior
    });
  }

  return result;
}
```

### Action Hint Events

```javascript
#extractActionHint(refinementResult) {
  // ... hint extraction logic ...

  const actionHint = {
    actionId: firstStep.actionRef,
    targetBindings: this.#extractTargetBindings(firstStep),
    stepIndex: 0,
    metadata: {
      taskId: refinementResult.taskId,
      totalSteps: stepResults.length
    }
  };

  // Dispatch action hint generated event
  this.#dispatchEvent(GOAP_EVENTS.ACTION_HINT_GENERATED, {
    actionId: actionHint.actionId,
    targetBindings: actionHint.targetBindings,
    taskId: refinementResult.taskId
  });

  return actionHint;
}

#handleActionHintFailure(actionHint) {
  // Dispatch action hint failed event
  this.#dispatchEvent(GOAP_EVENTS.ACTION_HINT_FAILED, {
    actionId: actionHint.actionId,
    bindings: actionHint.targetBindings,
    reason: 'Action not available or prerequisites failed'
  });

  this.#clearPlan('Action hint failed to resolve');
  return null;
}
```

### Goal Achievement Event

```javascript
#advancePlan() {
  if (!this.#activePlan) {
    throw new Error('Cannot advance: no active plan');
  }

  this.#activePlan.currentStep++;

  const isComplete = this.#activePlan.currentStep >= this.#activePlan.tasks.length;

  if (isComplete) {
    // Dispatch goal achieved event
    this.#dispatchEvent(GOAP_EVENTS.GOAL_ACHIEVED, {
      goalId: this.#activePlan.goal.id,
      totalSteps: this.#activePlan.tasks.length,
      duration: Date.now() - this.#activePlan.createdAt
    });

    this.#logger.info('Goal achieved', {
      goalId: this.#activePlan.goal.id
    });
  }

  return !isComplete;
}
```

### Error Events

```javascript
async decideTurn(actor, world) {
  // ... setup ...

  try {
    // ... GOAP cycle ...
  } catch (err) {
    // Dispatch unexpected error event
    this.#dispatchEvent(GOAP_EVENTS.UNEXPECTED_ERROR, {
      actorId: actor.id,
      error: err.message,
      stack: err.stack,
      phase: this.#determineErrorPhase()
    });

    this.#logger.error('Unexpected error in GOAP cycle', err);

    this.#clearPlan('Unexpected error');
    this.#recursionDepth = 0;
    return null;
  }
}

/**
 * Determine which phase of GOAP cycle caused error
 * @returns {string} Phase name
 * @private
 */
#determineErrorPhase() {
  if (!this.#activePlan) {
    return 'goal_selection_or_planning';
  }
  return 'task_refinement_or_execution';
}
```

## Event Payload Schemas

### Event Structure Examples

```javascript
// GOAP_PLANNING_STARTED
{
  type: 'GOAP_PLANNING_STARTED',
  payload: {
    timestamp: 1234567890,
    actorId: 'actor_123',
    goalId: 'be_fed'
  }
}

// GOAP_PLANNING_COMPLETED
{
  type: 'GOAP_PLANNING_COMPLETED',
  payload: {
    timestamp: 1234567890,
    actorId: 'actor_123',
    goalId: 'be_fed',
    planLength: 3,
    tasks: ['gather_food', 'cook_food', 'eat_food']
  }
}

// GOAP_PLAN_INVALIDATED
{
  type: 'GOAP_PLAN_INVALIDATED',
  payload: {
    timestamp: 1234567890,
    goalId: 'be_fed',
    reason: 'Target entity no longer exists',
    currentStep: 1,
    totalSteps: 3
  }
}

// GOAP_GOAL_ACHIEVED
{
  type: 'GOAP_GOAL_ACHIEVED',
  payload: {
    timestamp: 1234567890,
    goalId: 'be_fed',
    totalSteps: 3,
    duration: 15000  // milliseconds
  }
}
```

## Testing Requirements

### Unit Tests (add to existing test file)
- [ ] All event types dispatched correctly
- [ ] Event payloads contain required fields
- [ ] Event dispatching failures don't break execution
- [ ] Events dispatched at correct lifecycle points
- [ ] Timestamp always included in payload

### Integration Tests
- [ ] Complete GOAP cycle dispatches all expected events
- [ ] Failed cycles dispatch appropriate error events
- [ ] Event listeners can observe GOAP lifecycle

## Integration Points

### Required Services
- `IEventBus` - Event dispatching

### Event Consumers (future)
- GOAP monitoring dashboard
- Analytics/telemetry systems
- Debugging tools

## Success Validation

✅ **Done when**:
- All lifecycle events dispatched at correct points
- Event payloads complete and well-formed
- Event dispatching doesn't impact performance
- Failed dispatches handled gracefully
- Tests verify all events fire correctly
- Documentation lists all event types and payloads

## Related Tickets

- **Previous**: GOAPIMPL-021-05 (Failure Handling)
- **Next**: GOAPIMPL-021-07 (DI Registration)
- **Implements**: GOAPIMPL-021 (Parent - GOAP Controller)
