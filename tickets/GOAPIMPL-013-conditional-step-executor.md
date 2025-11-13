# GOAPIMPL-013: Conditional Step Executor

**Priority**: HIGH
**Estimated Effort**: 3-4 hours
**Dependencies**: GOAPIMPL-007 (Context Assembly), GOAPIMPL-012 (Primitive Action Executor)

## Description

Create ConditionalStepExecutor that evaluates conditions and executes `thenSteps` or `elseSteps` branches. Handles nested conditionals (max 3 levels) and failure modes (replan/skip/fail).

Conditional steps enable branching logic in refinement methods - execute different actions based on runtime conditions.

## Acceptance Criteria

- [ ] Evaluates conditions using JSON Logic
- [ ] Executes `thenSteps` on truthy condition
- [ ] Executes `elseSteps` on falsy condition (if present)
- [ ] Enforces 3-level nesting limit at runtime
- [ ] Handles `onFailure` modes (replan/skip/fail)
- [ ] Provides clear branching diagnostics for debugging
- [ ] Supports nested conditionals
- [ ] Logs condition evaluation and branch selection
- [ ] 90%+ test coverage

## Files to Create

### Main Implementation
- `src/goap/refinement/steps/conditionalStepExecutor.js` - Executor service

### Tests
- `tests/unit/goap/refinement/steps/conditionalStepExecutor.test.js` - Unit tests
- `tests/integration/goap/conditionalExecution.integration.test.js` - Integration tests

## Files to Modify

### Dependency Injection
- `src/dependencyInjection/tokens/tokens-core.js` - Add `IConditionalStepExecutor` token
- `src/dependencyInjection/registrations/goapRegistrations.js` - Register service

## Testing Requirements

### Unit Tests
- [ ] Test condition evaluation with various contexts
- [ ] Test `thenSteps` execution on truthy condition
- [ ] Test `elseSteps` execution on falsy condition
- [ ] Test nested conditional execution (1-3 levels)
- [ ] Test nesting limit enforcement (reject 4+ levels)
- [ ] Test `onFailure` modes
- [ ] Test condition evaluation errors
- [ ] Test branch execution errors

### Integration Tests
- [ ] Test conditional with real task examples
- [ ] Test complex condition logic (AND, OR, comparison)
- [ ] Test nested conditionals with real actions
- [ ] Test error propagation from executed steps
- [ ] Test diagnostic output accuracy

## Conditional Step Structure

### Simple Conditional
```json
{
  "type": "conditional",
  "condition": {
    "var": "actor.components.core:hungry"
  },
  "thenSteps": [
    {
      "type": "primitive_action",
      "actionId": "core:eat_food"
    }
  ],
  "elseSteps": [
    {
      "type": "primitive_action",
      "actionId": "core:skip_meal"
    }
  ],
  "onFailure": "fail"
}
```

### Nested Conditional (2 levels)
```json
{
  "type": "conditional",
  "condition": { "var": "actor.has_item" },
  "thenSteps": [
    {
      "type": "conditional",
      "condition": { "var": "item.is_edible" },
      "thenSteps": [
        { "type": "primitive_action", "actionId": "eat" }
      ],
      "elseSteps": [
        { "type": "primitive_action", "actionId": "discard" }
      ]
    }
  ]
}
```

## Execution Process

### Algorithm
```
1. Evaluate condition with current context
2. If condition is truthy:
   a. Execute thenSteps sequentially
   b. Return aggregate result
3. Else (condition is falsy):
   a. If elseSteps exist: execute elseSteps sequentially
   b. Else: return success (no-op)
4. Handle failures according to onFailure mode
```

### Nesting Level Tracking
```javascript
// Track nesting depth during execution
executeConditional(step, context, currentDepth = 0) {
  if (currentDepth >= 3) {
    throw new StepExecutionError(
      "Conditional nesting limit exceeded (max 3 levels)"
    );
  }

  // Evaluate and execute branches with incremented depth
  for (const branchStep of selectedBranch) {
    if (branchStep.type === 'conditional') {
      executeConditional(branchStep, context, currentDepth + 1);
    }
  }
}
```

## Condition Context

### Available Variables
```javascript
{
  "actor": { /* actor entity data */ },
  "world": { /* world state */ },
  "task": { /* task parameters */ },
  "refinement": {
    "localState": { /* accumulated step results */ }
  }
}
```

### Condition Examples
```json
// Check actor component
{ "var": "actor.components.core:hungry" }

// Compare values
{ "==": [{ "var": "task.params.quantity" }, 5] }

// Complex logic
{
  "and": [
    { "var": "actor.has_inventory" },
    { ">": [{ "var": "actor.inventory_capacity" }, 0] }
  ]
}

// Check refinement state
{ "var": "refinement.localState.pickedItem" }
```

## Reference Documentation

### Specifications
- `specs/goap-system-specs.md` lines 87-127 - Conditional steps specification

### Implementation Guides
- `docs/goap/refinement-condition-context.md` - **PRIMARY REFERENCE** - Condition context variables
- `docs/goap/condition-patterns-guide.md` - Common condition patterns

### Schema References
- `data/schemas/refinement-method.schema.json` - See `ConditionalStep` definition

### Examples
- `data/mods/core/tasks/refinement-methods/conditional-*.refinement.json` - 4 conditional examples

## Implementation Notes

### Branch Selection Logic
```javascript
const conditionResult = jsonLogicService.evaluate(
  step.condition,
  context
);

const selectedBranch = conditionResult
  ? step.thenSteps
  : (step.elseSteps || []);
```

### Sequential Execution
Execute branch steps sequentially (not parallel):
```javascript
const results = [];
for (const branchStep of selectedBranch) {
  const result = await executeStep(branchStep, context);
  results.push(result);

  // Stop on first failure if onFailure is 'fail'
  if (!result.success && step.onFailure === 'fail') {
    throw new StepExecutionError(...);
  }
}
```

### Failure Handling
Respect `onFailure` mode:
- `"fail"`: Stop execution, throw error on first step failure
- `"skip"`: Continue execution, log warning on step failure
- `"replan"`: Stop execution, return replan flag on step failure

### Condition Evaluation Errors
If condition evaluation fails:
1. Log error with condition and context
2. Treat as falsy (execute elseSteps or no-op)
3. Optional: Dispatch warning event

### Performance Considerations
- Condition evaluation is synchronous and fast
- Branch execution is sequential (necessary for state accumulation)
- Avoid deep nesting (max 3 levels enforced)

### Logging and Diagnostics
Log for debugging:
- Step index in method
- Condition expression
- Condition result (true/false)
- Selected branch (then/else)
- Branch step results
- Nesting level

## Integration Points

### Required Services (inject)
- `IContextAssemblyService` (GOAPIMPL-007) - Build condition context
- `IPrimitiveActionStepExecutor` (GOAPIMPL-012) - Execute branch primitive_action steps
- `IJsonLogicService` - Evaluate conditions
- `ILogger` - Logging

### Recursive Dependency
ConditionalStepExecutor needs itself for nested conditionals:
- Inject self-reference or use factory pattern
- Track nesting depth across recursive calls

### Used By (future)
- GOAPIMPL-014 (Refinement Engine) - Execute conditional steps

## Success Validation

✅ **Done when**:
- All unit tests pass with 90%+ coverage
- Integration tests validate conditional execution with real data
- Nested conditionals work up to 3 levels
- Nesting limit enforcement prevents 4+ levels
- Branch selection is correct for all condition results
- Error handling provides clear, actionable messages
- Service integrates with DI container
- Documentation explains conditional execution and error handling
