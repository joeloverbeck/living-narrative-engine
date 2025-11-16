# GOAPIMPL-025-01: GoapController Debug API

**Parent Ticket**: GOAPIMPL-025 (GOAP Debugging Tools)
**Priority**: HIGH (blocking for all debug tools)
**Estimated Effort**: 1 hour
**Dependencies**: None (builds on existing GoapController)

## Description

Add read-only debug API methods to GoapController to expose internal plan state for inspection. These methods enable external debug tools to query active plans, failure history, and current task execution state without breaking encapsulation.

**Reference**: 
- Parent ticket: `tickets/GOAPIMPL-025-goap-debugging-tools.md`
- Validation: `claudedocs/workflow-validation-GOAPIMPL-025.md` (Issue #8)
- Spec: `specs/goap-system-specs.md` lines 507-516

## Acceptance Criteria

- [ ] `getActivePlan(actorId)` returns active plan or null
- [ ] `getFailedGoals(actorId)` returns goal failure history
- [ ] `getFailedTasks(actorId)` returns task failure history  
- [ ] `getCurrentTask(actorId)` returns current task from plan
- [ ] Methods are read-only (return deep copies, not references)
- [ ] Methods handle missing actorId gracefully (return null/empty)
- [ ] JSDoc documentation added for all methods
- [ ] Unit tests validate all methods

## Current State Analysis

From `src/goap/controllers/goapController.js`:

**Private State (lines 159-163)**:
```javascript
#activePlan = null;      // Structure: { goal, tasks, currentStep, actorId, createdAt, lastValidated }
#failedGoals = new Map(); // Key: goal.id, Value: { goal, timestamp, reason }
#failedTasks = new Map(); // Key: taskId, Value: { task, timestamp, reason }
#currentActorId = null;
#recursionDepth = 0;
```

**Plan Structure (lines 491-507)**:
```javascript
{
  goal: goal,           // Goal object with id, priority
  tasks: tasks,         // Array of { taskId, params }
  currentStep: 0,       // Current task index
  actorId: actorId,
  createdAt: timestamp,
  lastValidated: timestamp
}
```

**Failure Tracking (lines 868-958)**:
- Failures expire after 5 minutes
- Max 3 failures before giving up
- Recursion depth tracked for 'continue' fallback

## Implementation Details

### File to Modify
- `src/goap/controllers/goapController.js`

### Methods to Add

Add at end of class, before closing brace:

```javascript
  // ==================== Debug API (Read-Only) ====================

  /**
   * Get the active plan for an actor (debug API).
   * @param {string} actorId - Entity ID of actor
   * @returns {object|null} Deep copy of active plan or null if no plan exists
   */
  getActivePlan(actorId) {
    string.assertNonBlank(actorId, 'actorId', 'GoapController.getActivePlan', this.#logger);
    
    if (!this.#activePlan || this.#activePlan.actorId !== actorId) {
      return null;
    }
    
    // Return deep copy to prevent external modification
    return {
      goal: { ...this.#activePlan.goal },
      tasks: this.#activePlan.tasks.map(task => ({ ...task })),
      currentStep: this.#activePlan.currentStep,
      actorId: this.#activePlan.actorId,
      createdAt: this.#activePlan.createdAt,
      lastValidated: this.#activePlan.lastValidated,
    };
  }

  /**
   * Get failed goals for an actor (debug API).
   * @param {string} actorId - Entity ID of actor
   * @returns {Array} Array of failed goal records
   */
  getFailedGoals(actorId) {
    string.assertNonBlank(actorId, 'actorId', 'GoapController.getFailedGoals', this.#logger);
    
    const failures = [];
    for (const [goalId, failure] of this.#failedGoals.entries()) {
      if (failure.goal && failure.goal.actorId === actorId) {
        failures.push({
          goalId,
          goal: { ...failure.goal },
          timestamp: failure.timestamp,
          reason: failure.reason,
        });
      }
    }
    
    return failures;
  }

  /**
   * Get failed tasks for an actor (debug API).
   * @param {string} actorId - Entity ID of actor
   * @returns {Array} Array of failed task records
   */
  getFailedTasks(actorId) {
    string.assertNonBlank(actorId, 'actorId', 'GoapController.getFailedTasks', this.#logger);
    
    const failures = [];
    for (const [taskId, failure] of this.#failedTasks.entries()) {
      // Task failures are actor-agnostic, return all
      failures.push({
        taskId,
        task: { ...failure.task },
        timestamp: failure.timestamp,
        reason: failure.reason,
      });
    }
    
    return failures;
  }

  /**
   * Get the current task from active plan (debug API).
   * @param {string} actorId - Entity ID of actor
   * @returns {object|null} Current task or null if no active plan
   */
  getCurrentTask(actorId) {
    string.assertNonBlank(actorId, 'actorId', 'GoapController.getCurrentTask', this.#logger);
    
    const plan = this.getActivePlan(actorId);
    if (!plan || plan.currentStep >= plan.tasks.length) {
      return null;
    }
    
    return { ...plan.tasks[plan.currentStep] };
  }
}
```

### Import Requirements
Already has: `string` from `src/utils/validationCore.js`

## Testing Requirements

### Unit Tests

Create: `tests/unit/goap/controllers/goapController.DebugAPI.test.js`

**Test Cases**:
1. **getActivePlan**:
   - Returns null when no plan exists
   - Returns null when actorId doesn't match
   - Returns deep copy of active plan
   - Modifications to returned plan don't affect internal state

2. **getFailedGoals**:
   - Returns empty array when no failures
   - Returns failures for specified actor only
   - Includes goal, timestamp, reason in each record
   - Expired failures are excluded (after 5 minutes)

3. **getFailedTasks**:
   - Returns empty array when no failures
   - Returns all task failures (actor-agnostic)
   - Includes task, timestamp, reason in each record

4. **getCurrentTask**:
   - Returns null when no plan exists
   - Returns null when currentStep >= tasks.length
   - Returns current task from plan
   - Returns deep copy (modifications don't affect plan)

**Test Structure**:
```javascript
describe('GoapController - Debug API', () => {
  let testBed;
  let controller;

  beforeEach(() => {
    testBed = createTestBed();
    controller = testBed.createGoapController();
  });

  describe('getActivePlan', () => {
    it('should return null when no plan exists', () => {
      const plan = controller.getActivePlan('actor-1');
      expect(plan).toBeNull();
    });

    it('should return active plan for actor', async () => {
      // Create plan by calling decideTurn
      await controller.decideTurn(actor, world);
      
      const plan = controller.getActivePlan('actor-1');
      expect(plan).not.toBeNull();
      expect(plan.actorId).toBe('actor-1');
      expect(plan.tasks).toBeInstanceOf(Array);
    });

    it('should return deep copy (modifications dont affect internal state)', async () => {
      await controller.decideTurn(actor, world);
      
      const plan1 = controller.getActivePlan('actor-1');
      plan1.currentStep = 999;
      
      const plan2 = controller.getActivePlan('actor-1');
      expect(plan2.currentStep).not.toBe(999);
    });
  });

  // ... other test suites
});
```

## Edge Cases

1. **Null actorId**: Throw validation error
2. **Empty string actorId**: Throw validation error
3. **Non-existent actorId**: Return null/empty array
4. **Plan state changes during query**: Return snapshot at call time
5. **Concurrent access**: Methods are read-only, safe for concurrent calls

## Performance Considerations

- Deep copy overhead: ~10ms for typical plan (3-5 tasks)
- Failure history scan: O(n) where n = number of failures
- Not intended for hot path (debug/development use only)

## Success Validation

✅ **Done when**:
- All 4 methods implemented with JSDoc
- Unit tests cover all methods and edge cases
- Methods return deep copies (verified by tests)
- No TypeScript errors in typecheck
- No ESLint errors

## References

- Parent: `tickets/GOAPIMPL-025-goap-debugging-tools.md`
- Controller: `src/goap/controllers/goapController.js`
- Validation: `claudedocs/workflow-validation-GOAPIMPL-025.md`
- Spec: `specs/goap-system-specs.md`
- Test Examples: `tests/unit/goap/controllers/goapController.test.js`
