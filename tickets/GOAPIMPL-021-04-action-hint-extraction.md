# GOAPIMPL-021-04: Action Hint Extraction

**Parent Ticket**: GOAPIMPL-021 (GOAP Controller)
**Priority**: CRITICAL
**Estimated Effort**: 1 hour
**Dependencies**: GOAPIMPL-021-01, GOAPIMPL-021-03, GOAPIMPL-014

## Description

Implement action hint extraction from refinement engine results. Converts refined task step results into action hints that can be matched against discovered actions in the turn system.

## Acceptance Criteria

- [ ] Task refinement integration with refinement engine
- [ ] Action hint extraction from step results
- [ ] Target binding extraction and formatting
- [ ] Action hint structure correctly formed
- [ ] Handles refinement results with no actionable steps
- [ ] Plan advancement after successful hint extraction
- [ ] 90%+ test coverage for hint extraction

## Files to Modify

- `src/goap/controllers/goapController.js`

## Implementation Details

### Refinement Integration

```javascript
/**
 * Refine current task to executable step results
 * @param {object} task - Task from plan
 * @param {object} actor - Actor entity
 * @returns {Promise<object>} Refinement result
 * @private
 */
async #refineTask(task, actor) {
  assertPresent(task, 'Task is required');
  assertPresent(actor, 'Actor is required');

  this.#logger.debug('Refining task', {
    taskId: task.taskId,
    actorId: actor.id,
    params: task.params
  });

  // Call refinement engine
  const result = await this.#refinementEngine.refine(
    task.taskId,
    actor.id,
    task.params
  );

  return result;
}
```

### Action Hint Extraction

```javascript
/**
 * Extract action hint from refinement result
 * @param {object} refinementResult - Result from refinement engine
 * @returns {object|null} Action hint or null if extraction fails
 * @private
 */
#extractActionHint(refinementResult) {
  assertPresent(refinementResult, 'Refinement result is required');

  if (!refinementResult.success) {
    this.#logger.warn('Refinement failed, cannot extract hint', {
      error: refinementResult.error
    });
    return null;
  }

  const stepResults = refinementResult.stepResults;

  if (!Array.isArray(stepResults) || stepResults.length === 0) {
    this.#logger.warn('Refinement produced no step results');
    return null;
  }

  // Extract first step result (turn-based execution)
  const firstStep = stepResults[0];

  if (!firstStep.actionRef) {
    this.#logger.error('Step result has no action reference', {
      stepResult: firstStep
    });
    return null;
  }

  // Build action hint
  const actionHint = {
    actionId: firstStep.actionRef,  // e.g., "items:consume_item"
    targetBindings: this.#extractTargetBindings(firstStep),
    stepIndex: 0,
    metadata: {
      taskId: refinementResult.taskId,
      totalSteps: stepResults.length
    }
  };

  this.#logger.info('Action hint extracted', {
    actionId: actionHint.actionId,
    bindings: actionHint.targetBindings
  });

  return actionHint;
}

/**
 * Extract target bindings from step result
 * @param {object} stepResult - Step result from refinement
 * @returns {object} Target bindings
 * @private
 */
#extractTargetBindings(stepResult) {
  const bindings = {};

  // Extract target entity bindings
  if (stepResult.targetBindings) {
    Object.assign(bindings, stepResult.targetBindings);
  }

  // Extract parameter bindings
  if (stepResult.parameters) {
    bindings.parameters = stepResult.parameters;
  }

  return bindings;
}
```

### Integration into decideTurn

```javascript
async decideTurn(actor, world) {
  // ... (plan validation and creation from previous tickets)

  // 9. Get current task
  const task = this.#getCurrentTask();

  if (!task) {
    this.#clearPlan('No current task');
    return null;
  }

  // 10. Refine task to step results
  const refinementResult = await this.#refineTask(task, actor);

  if (!refinementResult.success) {
    // 11. Refinement failed → handle failure (GOAPIMPL-021-05)
    return this.#handleRefinementFailure(task, refinementResult);
  }

  // 12. Extract action hint from refinement result
  const actionHint = this.#extractActionHint(refinementResult);

  if (!actionHint) {
    this.#logger.error('Failed to extract action hint', {
      taskId: task.taskId,
      refinementResult
    });
    return this.#handleRefinementFailure(task, refinementResult);
  }

  // 13. Advance plan for next turn
  const planContinues = this.#advancePlan();

  if (!planContinues) {
    // Plan complete → clear and dispatch goal achieved event
    this.#clearPlan('Goal achieved');
    // Event dispatching in GOAPIMPL-021-06
  }

  // 14. Return action hint for GoapDecisionProvider
  return { actionHint };
}
```

### Action Hint Structure

```javascript
/**
 * Action hint structure
 * @typedef {Object} ActionHint
 * @property {string} actionId - Full action reference (e.g., "items:consume_item")
 * @property {object} targetBindings - Target entity bindings and parameters
 * @property {number} stepIndex - Index of step within refinement result (always 0 for turn-based)
 * @property {object} metadata - Additional context (taskId, totalSteps)
 */
```

### Example Flow

```javascript
// Input: Task from plan
const task = {
  taskId: "gather_food",
  params: { targetType: "apple" }
};

// Refinement produces step results
const refinementResult = {
  success: true,
  taskId: "gather_food",
  stepResults: [
    {
      actionRef: "items:pick_up_item",
      targetBindings: {
        target: "entity_apple_123"
      },
      parameters: {
        quantity: 1
      }
    }
  ]
};

// Extract action hint
const actionHint = {
  actionId: "items:pick_up_item",
  targetBindings: {
    target: "entity_apple_123",
    parameters: { quantity: 1 }
  },
  stepIndex: 0,
  metadata: {
    taskId: "gather_food",
    totalSteps: 1
  }
};

// Return to GoapDecisionProvider
return { actionHint };
```

## Testing Requirements

### Unit Tests (add to existing test file)
- [ ] Task refinement calls refinement engine correctly
- [ ] Action hint extraction from valid step results
- [ ] Handles refinement failure gracefully
- [ ] Handles empty step results
- [ ] Handles step result without action reference
- [ ] Target bindings extracted correctly
- [ ] Plan advances after successful hint extraction
- [ ] Plan clears on completion

### Integration Tests
- [ ] Complete cycle: task → refinement → hint → plan advance
- [ ] Multi-step plan executes correctly across turns
- [ ] Plan completion triggers goal achieved

## Integration Points

### Required Services
- `IRefinementEngine` (GOAPIMPL-014) - Task refinement

### Output Contract
- Returns `{ actionHint }` for GoapDecisionProvider
- Action hint structure matches expected format

### Used By
- `GOAPController.decideTurn()` - Main decision loop
- GoapDecisionProvider (GOAPIMPL-022) - Consumes action hints

## Success Validation

✅ **Done when**:
- Task refinement integrates correctly with refinement engine
- Action hints extracted with correct structure
- Target bindings properly formatted
- All edge cases handled (failures, empty results, missing data)
- Unit and integration tests pass with 90%+ coverage
- Ready for failure handling integration

## Related Tickets

- **Previous**: GOAPIMPL-021-03 (Plan State Management)
- **Next**: GOAPIMPL-021-05 (Failure Handling)
- **Implements**: GOAPIMPL-021 (Parent - GOAP Controller)
- **Depends On**: GOAPIMPL-014 (Refinement Engine)
- **Consumed By**: GOAPIMPL-022 (Action Decider Integration)
