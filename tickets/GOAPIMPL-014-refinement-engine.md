# GOAPIMPL-014: Refinement Engine

**Priority**: CRITICAL
**Estimated Effort**: 4-5 hours
**Dependencies**: GOAPIMPL-010, GOAPIMPL-011, GOAPIMPL-012, GOAPIMPL-013

## Description

Create RefinementEngine that orchestrates the complete refinement process: method selection, step execution, state management, and failure handling. This is the main entry point for task → action decomposition.

The refinement engine transforms abstract planning tasks into concrete primitive actions that can be executed by the existing action system.

## Acceptance Criteria

- [ ] Selects applicable refinement method from task's method list
- [ ] Executes method steps sequentially
- [ ] Manages `refinement.localState` throughout execution
- [ ] Handles `fallbackBehavior` (replan/fail/continue)
- [ ] Returns sequence of primitive actions to execute
- [ ] Logs refinement process for debugging
- [ ] Dispatches events for refinement lifecycle
- [ ] Handles method selection failure gracefully
- [ ] Handles step execution failures according to `onFailure` mode
- [ ] 90%+ test coverage

## Files to Create

### Main Implementation
- `src/goap/refinement/refinementEngine.js` - Main orchestration engine

### Tests
- `tests/unit/goap/refinement/refinementEngine.test.js` - Unit tests
- `tests/integration/goap/refinementEngine.integration.test.js` - Integration tests
- `tests/e2e/goap/refinementFullFlow.e2e.test.js` - End-to-end tests

## Files to Modify

### Dependency Injection
- `src/dependencyInjection/tokens/tokens-core.js` - Add `IRefinementEngine` token
- `src/dependencyInjection/registrations/goapRegistrations.js` - Register service

## Testing Requirements

### Unit Tests
- [ ] Test complete refinement flow with simple method
- [ ] Test method selection (success and failure cases)
- [ ] Test step execution sequencing
- [ ] Test state accumulation across steps
- [ ] Test `fallbackBehavior` modes
- [ ] Test event dispatching
- [ ] Test error handling at each stage
- [ ] Test primitive action collection

### Integration Tests
- [ ] Test refinement with real task examples
- [ ] Test method selection with applicability conditions
- [ ] Test step execution with real actions
- [ ] Test conditional branching
- [ ] Test error propagation and recovery

### E2E Tests
- [ ] Test complete flow: task → method → actions → execution
- [ ] Test multi-step refinement with state accumulation
- [ ] Test refinement failure and fallback
- [ ] Test integration with action executor

## Refinement Process Flow

### High-Level Algorithm
```
Input: task, actor, context
Output: sequence of primitive actions OR refinement failure

1. Initialize refinement.localState (empty)
2. Select applicable method using MethodSelectionService
3. If no method applicable:
   a. Handle fallbackBehavior
   b. Return failure or replan signal
4. Execute method steps sequentially:
   a. For each step:
      - Update context with current localState
      - Execute step (primitive_action or conditional)
      - Accumulate results in localState
      - Handle step failures per onFailure mode
5. Collect primitive actions from execution
6. Dispatch refinement complete event
7. Clear refinement.localState
8. Return action sequence
```

### Method Selection
```javascript
const method = await methodSelectionService.select(
  task.refinementMethods,
  context
);

if (!method) {
  return handleFallbackBehavior(task.fallbackBehavior);
}
```

### Step Execution Loop
```javascript
const primitiveActions = [];

for (const [index, step] of method.steps.entries()) {
  const stepContext = {
    ...context,
    refinement: {
      localState: refinementStateManager.getSnapshot()
    }
  };

  let result;
  if (step.type === 'primitive_action') {
    result = await primitiveActionExecutor.execute(step, stepContext);
    primitiveActions.push(result.action);
  } else if (step.type === 'conditional') {
    result = await conditionalExecutor.execute(step, stepContext);
    primitiveActions.push(...result.actions);
  }

  // Handle step result
  if (result.storeResultAs) {
    refinementStateManager.store(result.storeResultAs, result.value);
  }

  // Handle failures
  if (!result.success) {
    handleStepFailure(step, result);
  }
}

return primitiveActions;
```

## Fallback Behavior

### Modes (from task.fallbackBehavior)
```javascript
switch (task.fallbackBehavior) {
  case 'replan':
    // Signal planner to replan
    return {
      success: false,
      replan: true,
      reason: 'no_applicable_method'
    };

  case 'fail':
    // Fail task entirely
    throw new RefinementError(
      `No applicable method for task '${task.id}'`
    );

  case 'continue':
    // Skip this task, continue plan
    return {
      success: true,
      skipped: true,
      reason: 'no_applicable_method'
    };
}
```

## Events to Dispatch

### Refinement Lifecycle Events
```javascript
// Refinement started
{
  type: 'GOAP_REFINEMENT_STARTED',
  payload: {
    taskId: task.id,
    actorId: actor.id,
    timestamp: Date.now()
  }
}

// Method selected
{
  type: 'GOAP_METHOD_SELECTED',
  payload: {
    taskId: task.id,
    methodId: method.id,
    actorId: actor.id
  }
}

// Step executed
{
  type: 'GOAP_STEP_EXECUTED',
  payload: {
    taskId: task.id,
    methodId: method.id,
    stepIndex: index,
    stepType: step.type,
    success: result.success
  }
}

// Refinement completed
{
  type: 'GOAP_REFINEMENT_COMPLETED',
  payload: {
    taskId: task.id,
    methodId: method.id,
    actorId: actor.id,
    actionsGenerated: primitiveActions.length,
    success: true
  }
}

// Refinement failed
{
  type: 'GOAP_REFINEMENT_FAILED',
  payload: {
    taskId: task.id,
    actorId: actor.id,
    reason: error.message,
    fallbackBehavior: task.fallbackBehavior
  }
}
```

## Reference Documentation

### Specifications
- `specs/goap-system-specs.md` lines 163-195 - **PRIMARY REFERENCE** - Complete refinement pipeline

### Implementation Guides
- `docs/goap/task-loading.md` - Refinement methods section
- All refinement documentation in `docs/goap/refinement-*.md`

### Schema References
- `data/schemas/task.schema.json` - Task structure with refinement methods
- `data/schemas/refinement-method.schema.json` - Complete method schema

### Examples
- `data/mods/core/tasks/refinement-methods/*.refinement.json` - All 8 example methods

## Implementation Notes

### Error Recovery Strategy
Step execution may fail at various points:
1. **Method selection fails**: Use fallbackBehavior
2. **Step execution fails**: Use step.onFailure mode
3. **Condition evaluation fails**: Treat as falsy, log warning
4. **Action execution fails**: Propagate to step.onFailure

### State Management Lifecycle
```
1. Initialize state (empty object)
2. Execute steps, accumulating state
3. State visible to subsequent steps
4. Clear state after method completes
5. State does NOT persist across methods
```

### Primitive Action Collection
Collect primitive actions from:
- Direct primitive_action steps
- Actions from conditional thenSteps
- Actions from conditional elseSteps
- Nested conditionals (recursively)

Return actions in execution order.

### Performance Considerations
- Steps execute sequentially (necessary for state dependencies)
- Method selection is cached per task ID
- Context assembly may be expensive (consider caching)
- Event dispatching is async (don't block on it)

### Integration Points

#### Required Services (inject)
- `IMethodSelectionService` (GOAPIMPL-011) - Select methods
- `IRefinementStateManager` (GOAPIMPL-010) - Manage state
- `IPrimitiveActionStepExecutor` (GOAPIMPL-012) - Execute primitive steps
- `IConditionalStepExecutor` (GOAPIMPL-013) - Execute conditional steps
- `IContextAssemblyService` (GOAPIMPL-007) - Build contexts
- `IEventBus` - Dispatch events
- `ILogger` - Logging

#### Used By (future)
- GOAPIMPL-021 (GOAP Controller) - Refine tasks during plan execution

## Success Validation

✅ **Done when**:
- All unit tests pass with 90%+ coverage
- Integration tests validate complete refinement flows
- E2E tests demonstrate task → actions transformation
- All error scenarios handled gracefully
- Events dispatched for all lifecycle stages
- State management works across multiple steps
- Fallback behaviors work correctly
- Service integrates with DI container
- Documentation explains refinement process and error handling
