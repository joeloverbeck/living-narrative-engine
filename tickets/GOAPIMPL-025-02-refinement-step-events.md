# GOAPIMPL-025-02: Refinement Step-Level Events

**Parent Ticket**: GOAPIMPL-025 (GOAP Debugging Tools)
**Priority**: HIGH (blocking for refinement tracer)
**Estimated Effort**: 1.5 hours
**Dependencies**: None (builds on existing event system)

## Description

Add step-level events to the GOAP event system to enable fine-grained tracing of refinement method execution. These events allow debug tools to observe individual step execution, state updates, and failures during task refinement.

**Reference**:
- Parent ticket: `tickets/GOAPIMPL-025-goap-debugging-tools.md`
- Validation: `claudedocs/workflow-validation-GOAPIMPL-025.md` (Issue #7)
- Spec: `specs/goap-system-specs.md` lines 507-516

## Acceptance Criteria

- [ ] New event types defined in `goapEvents.js`
- [ ] Events dispatched from RefinementEngine during step execution
- [ ] Events include actorId, taskId, stepIndex, and relevant data
- [ ] Events integrate with existing GOAP event system
- [ ] No performance impact when events not subscribed
- [ ] Event schemas documented in JSDoc
- [ ] Unit tests validate event dispatch
- [ ] Integration tests validate event flow

## Current State Analysis

### Existing Event System

From `src/goap/events/goapEvents.js`:

**Task-Level Events (already exist)**:
```javascript
export const GOAP_EVENTS = {
  TASK_REFINED: 'GOAP:TASK_REFINED',           // Task successfully refined to actions
  REFINEMENT_FAILED: 'GOAP:REFINEMENT_FAILED', // Task refinement failed
  // ... other events
};
```

**Missing**: Step-level granularity within refinement execution

### Refinement Execution Flow

From `src/goap/refinement/refinementEngine.js` (lines 145-252):

```javascript
async refineTask(task, world) {
  // 1. Select method
  const method = this.#selectMethod(task, evaluationContext);
  
  // 2. Execute steps
  for (let i = 0; i < method.steps.length; i++) {
    const step = method.steps[i];
    const stepResult = await this.#executeStep(step, ...);
    
    if (!stepResult.success) {
      // Step failed
    }
  }
  
  // 3. Dispatch task-level event
  this.#eventBus.dispatch({
    type: GOAP_EVENTS.TASK_REFINED,
    payload: { ... }
  });
}
```

**Need**: Events for each step execution, not just task completion

## Implementation Details

### File to Modify: goapEvents.js

Add new event types to `GOAP_EVENTS` object:

```javascript
export const GOAP_EVENTS = {
  // ... existing events
  
  // Refinement step-level events (NEW)
  REFINEMENT_STEP_STARTED: 'GOAP:REFINEMENT_STEP_STARTED',
  REFINEMENT_STEP_COMPLETED: 'GOAP:REFINEMENT_STEP_COMPLETED',
  REFINEMENT_STEP_FAILED: 'GOAP:REFINEMENT_STEP_FAILED',
  REFINEMENT_STATE_UPDATED: 'GOAP:REFINEMENT_STATE_UPDATED',
};

/**
 * Event dispatched when a refinement method step begins execution.
 * @typedef {object} RefinementStepStartedEvent
 * @property {'GOAP:REFINEMENT_STEP_STARTED'} type
 * @property {object} payload
 * @property {string} payload.actorId - Actor entity ID
 * @property {string} payload.taskId - Task being refined
 * @property {string} payload.methodId - Selected refinement method
 * @property {number} payload.stepIndex - Step index in method
 * @property {object} payload.step - Step definition
 * @property {number} payload.timestamp - When step started
 */

/**
 * Event dispatched when a refinement method step completes successfully.
 * @typedef {object} RefinementStepCompletedEvent
 * @property {'GOAP:REFINEMENT_STEP_COMPLETED'} type
 * @property {object} payload
 * @property {string} payload.actorId - Actor entity ID
 * @property {string} payload.taskId - Task being refined
 * @property {string} payload.methodId - Selected refinement method
 * @property {number} payload.stepIndex - Step index in method
 * @property {object} payload.result - Step execution result
 * @property {number} payload.duration - Execution time in ms
 * @property {number} payload.timestamp - When step completed
 */

/**
 * Event dispatched when a refinement method step fails.
 * @typedef {object} RefinementStepFailedEvent
 * @property {'GOAP:REFINEMENT_STEP_FAILED'} type
 * @property {object} payload
 * @property {string} payload.actorId - Actor entity ID
 * @property {string} payload.taskId - Task being refined
 * @property {string} payload.methodId - Selected refinement method
 * @property {number} payload.stepIndex - Step index in method
 * @property {string} payload.error - Error message
 * @property {number} payload.timestamp - When step failed
 */

/**
 * Event dispatched when refinement local state is updated.
 * @typedef {object} RefinementStateUpdatedEvent
 * @property {'GOAP:REFINEMENT_STATE_UPDATED'} type
 * @property {object} payload
 * @property {string} payload.actorId - Actor entity ID
 * @property {string} payload.taskId - Task being refined
 * @property {string} payload.key - State key that changed
 * @property {*} payload.oldValue - Previous value (or undefined)
 * @property {*} payload.newValue - New value
 * @property {number} payload.timestamp - When state changed
 */
```

### File to Modify: refinementEngine.js

Add event dispatching in `#executeStep` method (around line 418):

```javascript
async #executeStep(step, stepIndex, stepContext, refinementContext) {
  const { actorId, taskId, methodId } = refinementContext;
  const startTime = Date.now();
  
  // Dispatch step started event
  this.#eventBus.dispatch({
    type: GOAP_EVENTS.REFINEMENT_STEP_STARTED,
    payload: {
      actorId,
      taskId,
      methodId,
      stepIndex,
      step: { type: step.type, ...step }, // Include step definition
      timestamp: startTime,
    },
  });

  let result;
  try {
    // Execute step based on type
    if (step.type === 'primitive_action') {
      result = await this.#primitiveActionExecutor.execute(step, stepContext);
    } else if (step.type === 'conditional') {
      result = await this.#conditionalExecutor.execute(step, stepContext, 
        (conditionalSteps) => this.#executeSteps(conditionalSteps, stepContext, refinementContext)
      );
    } else if (step.type === 'loop') {
      result = await this.#executeLoopStep(step, stepContext, refinementContext);
    } else {
      throw new Error(`Unknown step type: ${step.type}`);
    }

    // Dispatch success event
    this.#eventBus.dispatch({
      type: GOAP_EVENTS.REFINEMENT_STEP_COMPLETED,
      payload: {
        actorId,
        taskId,
        methodId,
        stepIndex,
        result: {
          success: result.success,
          actionGenerated: result.actionId,
        },
        duration: Date.now() - startTime,
        timestamp: Date.now(),
      },
    });

    return result;

  } catch (err) {
    // Dispatch failure event
    this.#eventBus.dispatch({
      type: GOAP_EVENTS.REFINEMENT_STEP_FAILED,
      payload: {
        actorId,
        taskId,
        methodId,
        stepIndex,
        error: err.message,
        timestamp: Date.now(),
      },
    });

    throw err;
  }
}
```

Add state update events in RefinementStateManager (around line 750):

```javascript
set(key, value) {
  const oldValue = this.#state.get(key);
  this.#state.set(key, value);
  
  // Dispatch state update event
  if (this.#eventBus && this.#refinementContext) {
    this.#eventBus.dispatch({
      type: GOAP_EVENTS.REFINEMENT_STATE_UPDATED,
      payload: {
        actorId: this.#refinementContext.actorId,
        taskId: this.#refinementContext.taskId,
        key,
        oldValue,
        newValue: value,
        timestamp: Date.now(),
      },
    });
  }
}
```

### Constructor Changes

RefinementStateManager needs eventBus and refinementContext:

```javascript
constructor({ eventBus, logger }) {
  this.#eventBus = eventBus;
  this.#logger = logger;
  this.#state = new Map();
  this.#refinementContext = null; // Set when refinement starts
}

// Called from RefinementEngine.refineTask
setRefinementContext(context) {
  this.#refinementContext = context;
}

// Called when refinement completes/fails
clearRefinementContext() {
  this.#refinementContext = null;
  this.#state.clear();
}
```

## Testing Requirements

### Unit Tests

Create: `tests/unit/goap/refinement/refinementStepEvents.test.js`

**Test Cases**:

1. **REFINEMENT_STEP_STARTED**:
   - Dispatched when step execution begins
   - Includes actorId, taskId, methodId, stepIndex
   - Includes step definition
   - Timestamp is present

2. **REFINEMENT_STEP_COMPLETED**:
   - Dispatched when step succeeds
   - Includes result data
   - Duration is calculated
   - Not dispatched if step fails

3. **REFINEMENT_STEP_FAILED**:
   - Dispatched when step throws error
   - Includes error message
   - Not dispatched if step succeeds

4. **REFINEMENT_STATE_UPDATED**:
   - Dispatched when local state changes
   - Includes oldValue and newValue
   - Includes state key
   - Not dispatched when state is read

**Test Structure**:
```javascript
describe('RefinementEngine - Step Events', () => {
  let testBed;
  let engine;
  let eventBus;
  let capturedEvents;

  beforeEach(() => {
    testBed = createTestBed();
    eventBus = testBed.createEventBus();
    engine = testBed.createRefinementEngine({ eventBus });
    
    // Capture all events
    capturedEvents = [];
    Object.values(GOAP_EVENTS).forEach(eventType => {
      eventBus.on(eventType, (event) => {
        capturedEvents.push(event);
      });
    });
  });

  describe('REFINEMENT_STEP_STARTED', () => {
    it('should dispatch when step begins', async () => {
      const task = { taskId: 'consume_food', params: {} };
      
      await engine.refineTask(task, world, evaluationContext);
      
      const startedEvents = capturedEvents.filter(
        e => e.type === GOAP_EVENTS.REFINEMENT_STEP_STARTED
      );
      
      expect(startedEvents.length).toBeGreaterThan(0);
      expect(startedEvents[0].payload.stepIndex).toBe(0);
    });
  });

  // ... other test suites
});
```

### Integration Tests

Update: `tests/integration/goap/goapController.integration.test.js`

Add test case for event flow during full refinement:

```javascript
it('should dispatch step events during refinement', async () => {
  const eventLog = [];
  
  eventBus.on(GOAP_EVENTS.REFINEMENT_STEP_STARTED, e => eventLog.push(e));
  eventBus.on(GOAP_EVENTS.REFINEMENT_STEP_COMPLETED, e => eventLog.push(e));
  
  await goapController.decideTurn(actor, world);
  
  // Verify step events were dispatched
  const startedEvents = eventLog.filter(
    e => e.type === GOAP_EVENTS.REFINEMENT_STEP_STARTED
  );
  const completedEvents = eventLog.filter(
    e => e.type === GOAP_EVENTS.REFINEMENT_STEP_COMPLETED
  );
  
  expect(startedEvents.length).toBe(completedEvents.length);
  expect(startedEvents.length).toBeGreaterThan(0);
});
```

## Edge Cases

1. **Step execution throws**: REFINEMENT_STEP_FAILED dispatched
2. **Conditional step branches**: Events for executed branch only
3. **Loop steps**: Multiple events for each iteration
4. **State updates during step**: State events interleaved with step events
5. **No event subscribers**: No performance overhead

## Performance Considerations

- Event dispatch: ~0.1ms per event (negligible)
- No overhead when no subscribers
- Event payloads are small (< 1KB)
- Total overhead: < 1% of refinement time

## Success Validation

✅ **Done when**:
- 4 new event types defined in goapEvents.js
- Events dispatched from RefinementEngine
- Events dispatched from RefinementStateManager
- JSDoc documentation complete
- Unit tests validate all events
- Integration tests validate event flow
- No TypeScript errors
- No ESLint errors

## References

- Parent: `tickets/GOAPIMPL-025-goap-debugging-tools.md`
- Events: `src/goap/events/goapEvents.js`
- Engine: `src/goap/refinement/refinementEngine.js`
- State Manager: `src/goap/refinement/refinementStateManager.js`
- Validation: `claudedocs/workflow-validation-GOAPIMPL-025.md`
- Spec: `specs/goap-system-specs.md`
