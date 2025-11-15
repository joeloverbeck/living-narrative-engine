# GOAPIMPL-021-03: Plan State Management

**Parent Ticket**: GOAPIMPL-021 (GOAP Controller)
**Priority**: CRITICAL
**Estimated Effort**: 1 hour
**Dependencies**: GOAPIMPL-021-01, GOAPIMPL-021-02, GOAPIMPL-020

## Description

Implement plan state management including plan creation, validation, advancement, and invalidation detection. Manages the active plan lifecycle across turns.

## Acceptance Criteria

- [ ] Active plan structure properly defined and documented
- [ ] Plan creation from planner results implemented
- [ ] Plan validation using invalidation detector
- [ ] Plan advancement logic (move to next task/step)
- [ ] Plan clearing on completion or invalidation
- [ ] Plan state persists correctly across turns
- [ ] Replanning triggered on invalidation
- [ ] 90%+ test coverage for plan management

## Files to Modify

- `src/goap/controllers/goapController.js`

## Implementation Details

### Active Plan Structure

```javascript
/**
 * Active plan state structure
 * @typedef {Object} ActivePlan
 * @property {object} goal - Original goal being pursued
 * @property {Array<object>} tasks - Sequence of tasks from planner
 * @property {number} currentStep - Current task index (0-based)
 * @property {number} createdAt - Timestamp of plan creation
 * @property {number} lastValidated - Timestamp of last validation check
 */
```

### Plan Creation

```javascript
/**
 * Create new plan from goal and planner result
 * @param {object} goal - Goal to achieve
 * @param {Array<object>} tasks - Tasks from planner
 * @returns {object} Active plan structure
 * @private
 */
#createPlan(goal, tasks) {
  assertPresent(goal, 'Goal is required');
  assertPresent(tasks, 'Tasks are required');

  if (!Array.isArray(tasks) || tasks.length === 0) {
    throw new InvalidArgumentError('Tasks must be non-empty array');
  }

  const plan = {
    goal: goal,
    tasks: tasks,
    currentStep: 0,
    createdAt: Date.now(),
    lastValidated: Date.now()
  };

  this.#logger.info('Plan created', {
    goalId: goal.id,
    taskCount: tasks.length
  });

  return plan;
}
```

### Plan Validation

```javascript
/**
 * Validate active plan against current world state
 * @param {object} world - Current world state
 * @returns {object} Validation result { valid: boolean, reason?: string }
 * @private
 */
#validateActivePlan(world) {
  if (!this.#activePlan) {
    return { valid: false, reason: 'No active plan' };
  }

  // Use plan invalidation detector
  const validation = this.#invalidationDetector.check(
    this.#activePlan,
    world
  );

  // Update validation timestamp if still valid
  if (validation.valid) {
    this.#activePlan.lastValidated = Date.now();
  } else {
    this.#logger.warn('Plan invalidated', {
      goalId: this.#activePlan.goal.id,
      reason: validation.reason,
      currentStep: this.#activePlan.currentStep
    });
  }

  return validation;
}
```

### Plan Advancement

```javascript
/**
 * Advance plan to next task
 * @returns {boolean} True if plan continues, false if complete
 * @private
 */
#advancePlan() {
  if (!this.#activePlan) {
    throw new Error('Cannot advance: no active plan');
  }

  this.#activePlan.currentStep++;

  const isComplete = this.#activePlan.currentStep >= this.#activePlan.tasks.length;

  if (isComplete) {
    this.#logger.info('Plan completed', {
      goalId: this.#activePlan.goal.id,
      totalSteps: this.#activePlan.tasks.length
    });
  } else {
    this.#logger.debug('Plan advanced', {
      goalId: this.#activePlan.goal.id,
      currentStep: this.#activePlan.currentStep,
      totalSteps: this.#activePlan.tasks.length
    });
  }

  return !isComplete;
}

/**
 * Get current task from active plan
 * @returns {object|null} Current task or null if no plan
 * @private
 */
#getCurrentTask() {
  if (!this.#activePlan) {
    return null;
  }

  if (this.#activePlan.currentStep >= this.#activePlan.tasks.length) {
    return null;
  }

  return this.#activePlan.tasks[this.#activePlan.currentStep];
}
```

### Plan Clearing

```javascript
/**
 * Clear active plan
 * @param {string} reason - Reason for clearing
 * @private
 */
#clearPlan(reason) {
  if (!this.#activePlan) {
    return;
  }

  const goalId = this.#activePlan.goal.id;

  this.#logger.info('Plan cleared', {
    goalId,
    reason,
    stepsCompleted: this.#activePlan.currentStep,
    totalSteps: this.#activePlan.tasks.length
  });

  this.#activePlan = null;
}
```

### Integration into decideTurn

```javascript
async decideTurn(actor, world) {
  assertPresent(actor, 'Actor is required');
  assertNonBlankString(actor.id, 'Actor ID', 'decideTurn', this.#logger);
  assertPresent(world, 'World is required');

  // 1. Check if we have active plan
  if (this.#activePlan) {
    // 2. Validate plan still applicable
    const validation = this.#validateActivePlan(world);

    if (!validation.valid) {
      // 3. Plan invalidated → clear and replan
      this.#clearPlan(`Invalidated: ${validation.reason}`);

      // Dispatch invalidation event (implemented in GOAPIMPL-021-06)
      // Will trigger replanning in next iteration
    }
  }

  // 4. Need new plan?
  if (!this.#activePlan) {
    // 5. Select goal (implemented in GOAPIMPL-021-02)
    const goal = this.#selectGoal(actor);

    if (!goal) {
      this.#logger.debug('No goals to pursue', { actorId: actor.id });
      return null;  // No goals → idle
    }

    // 6. Plan to achieve goal
    const planResult = await this.#planner.plan(actor, goal, world);

    if (!planResult || !planResult.tasks) {
      // 7. Planning failed → handle failure (GOAPIMPL-021-05)
      return this.#handlePlanningFailure(goal);
    }

    // 8. Create and store plan
    this.#activePlan = this.#createPlan(goal, planResult.tasks);
  }

  // 9. Get current task
  const task = this.#getCurrentTask();

  if (!task) {
    // Plan exhausted but still active → shouldn't happen
    this.#logger.error('Active plan has no current task', {
      plan: this.#activePlan
    });
    this.#clearPlan('No current task');
    return null;
  }

  // Continue to refinement and action hint extraction
  // (implemented in GOAPIMPL-021-04)
  return null; // Stub for now
}
```

## Testing Requirements

### Unit Tests (add to existing test file)
- [ ] Plan creation with valid goal and tasks
- [ ] Plan creation throws on invalid inputs
- [ ] Plan validation detects invalidation correctly
- [ ] Plan validation updates lastValidated timestamp
- [ ] Plan advancement increments currentStep
- [ ] Plan advancement detects completion
- [ ] Plan clearing works correctly
- [ ] getCurrentTask returns correct task
- [ ] getCurrentTask handles edge cases (no plan, plan complete)

### Integration Tests
- [ ] Plan persists across multiple decideTurn calls
- [ ] Plan invalidation triggers replanning
- [ ] Completed plan clears correctly

## Integration Points

### Required Services
- `IPlanInvalidationDetector` (GOAPIMPL-020) - Plan validation

### Used By
- `GOAPController.decideTurn()` - Main decision loop

## Success Validation

✅ **Done when**:
- Plan state correctly created, validated, advanced, and cleared
- Plan persists across turns until completion or invalidation
- All edge cases handled (no plan, invalid plan, complete plan)
- Unit and integration tests pass with 90%+ coverage
- Ready for action hint extraction integration

## Related Tickets

- **Previous**: GOAPIMPL-021-02 (Goal Selection Logic)
- **Next**: GOAPIMPL-021-04 (Action Hint Extraction)
- **Implements**: GOAPIMPL-021 (Parent - GOAP Controller)
- **Depends On**: GOAPIMPL-020 (Plan Invalidation Detector)
