# GOAPIMPL-012: Primitive Action Step Executor

**Priority**: HIGH
**Estimated Effort**: 3-4 hours
**Dependencies**: GOAPIMPL-008 (Parameter Resolution), GOAPIMPL-010 (State Manager)

## Description

Create PrimitiveActionStepExecutor that executes `primitive_action` steps by resolving action references, binding targets, and invoking the action execution system. Handles parameter overrides and failure reporting.

Primitive action steps are the leaf nodes of refinement - they represent actual actions that can be executed by the existing action system.

## Acceptance Criteria

- [ ] Resolves `actionId` to registered action definition
- [ ] Binds `targetBindings` to entity IDs using parameter resolution
- [ ] Passes parameter overrides to action executor
- [ ] Reports action execution success/failure
- [ ] Optionally stores action result in `refinement.localState` (via `storeResultAs`)
- [ ] Logs execution details for debugging
- [ ] Handles action not found error
- [ ] Handles target binding failure
- [ ] 90%+ test coverage

## Files to Create

### Main Implementation
- `src/goap/refinement/steps/primitiveActionStepExecutor.js` - Executor service

### Tests
- `tests/unit/goap/refinement/steps/primitiveActionStepExecutor.test.js` - Unit tests
- `tests/integration/goap/primitiveActionExecution.integration.test.js` - Integration tests

## Files to Modify

### Dependency Injection
- `src/dependencyInjection/tokens/tokens-core.js` - Add `IPrimitiveActionStepExecutor` token
- `src/dependencyInjection/registrations/goapRegistrations.js` - Register service

## Testing Requirements

### Unit Tests
- [ ] Test action resolution from action registry
- [ ] Test target binding with various parameter sources
- [ ] Test parameter override semantics
- [ ] Test action execution integration
- [ ] Test failure handling and reporting
- [ ] Test `storeResultAs` pattern
- [ ] Test missing action handling
- [ ] Test invalid target binding handling

### Integration Tests
- [ ] Test execution with real actions
- [ ] Test target binding with real entity references
- [ ] Test parameter overrides affect action execution
- [ ] Test result storage in refinement.localState
- [ ] Test error messages are clear and actionable

## Primitive Action Step Structure

### Step Definition (from refinement method)
```json
{
  "type": "primitive_action",
  "actionId": "core:pick_up_item",
  "targetBindings": {
    "item": "task.params.item"
  },
  "parameterOverrides": {
    "quiet": true
  },
  "storeResultAs": "pickedItem",
  "onFailure": "fail"
}
```

### Execution Process
```
1. Resolve actionId → action definition
2. Resolve targetBindings → entity IDs
3. Merge parameterOverrides
4. Execute action via action executor
5. If storeResultAs: store result in localState
6. Return execution result
```

## Target Binding Resolution

### Binding Sources
```javascript
// From task parameters
"targetBindings": {
  "item": "task.params.item"  // → "entity-123"
}

// From refinement local state
"targetBindings": {
  "location": "refinement.localState.targetLocation"  // → "entity-456"
}

// From actor
"targetBindings": {
  "actor": "actor"  // → current actor entity ID
}

// Literal value (passthrough)
"targetBindings": {
  "quantity": 5  // → 5 (not resolved, used as-is)
}
```

### Resolution Process
For each binding:
1. Check if value is string starting with parameter path
2. If yes → resolve using ParameterResolutionService
3. If no → use value as-is (literal)
4. Validate resolved value matches action parameter schema

## Reference Documentation

### Specifications
- `specs/goap-system-specs.md` lines 73-85 - Example refinement with primitive_action steps

### Implementation Guides
- `docs/goap/refinement-action-references.md` - **PRIMARY REFERENCE** - Complete action reference guide
- `docs/goap/refinement-parameter-binding.md` - Parameter binding patterns

### Schema References
- `data/schemas/refinement-method.schema.json` - See `PrimitiveActionStep` definition

### Examples
- `data/mods/core/tasks/refinement-methods/consume_nourishing_item_eating.refinement.json` - Real primitive_action examples

## Implementation Notes

### Action Executor Integration
The existing action executor system:
- Located at `src/actions/` or similar
- Takes action ID, actor ID, target parameters
- Returns success/failure result
- May dispatch events

Integration:
```javascript
const result = await actionExecutor.execute({
  actionId: resolvedActionId,
  actorId: context.actor.id,
  targets: resolvedTargetBindings,
  parameters: mergedParameters
});
```

### Parameter Override Semantics
Parameter overrides are merged with action defaults:
1. Start with action definition default parameters
2. Apply targetBindings (resolved entity IDs)
3. Apply parameterOverrides (from step definition)
4. Result: final parameters for action execution

### Result Storage
If `storeResultAs` is specified:
```javascript
if (step.storeResultAs) {
  refinementStateManager.store(step.storeResultAs, result);
}
```

Result structure (from action executor):
```javascript
{
  success: true,
  actionId: "core:pick_up_item",
  effects: [ /* executed operations */ ],
  // action-specific data
}
```

### Failure Handling
Respect `onFailure` mode from step:
- `"fail"`: Throw StepExecutionError
- `"skip"`: Log warning, return failure result
- `"replan"`: Return failure result with replan flag

### Logging
Log for debugging:
- Step index in method
- Action ID
- Resolved target bindings
- Parameter overrides
- Execution result
- storeResultAs key (if any)

## Integration Points

### Required Services (inject)
- `IParameterResolutionService` (GOAPIMPL-008) - Resolve target bindings
- `IRefinementStateManager` (GOAPIMPL-010) - Store results
- `IActionExecutor` - Execute actions
- `IActionRegistry` - Resolve action IDs
- `ILogger` - Logging

### Used By (future)
- GOAPIMPL-014 (Refinement Engine) - Execute method steps

## Success Validation

✅ **Done when**:
- All unit tests pass with 90%+ coverage
- Integration tests validate execution with real actions
- Target binding resolution works with all parameter sources
- Parameter overrides merge correctly
- Result storage works correctly
- Error handling provides clear, actionable messages
- Service integrates with DI container
- Documentation explains execution process and error handling
