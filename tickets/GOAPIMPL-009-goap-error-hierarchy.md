# GOAPIMPL-009: GOAP Error Hierarchy

**Priority**: HIGH
**Estimated Effort**: 1-2 hours
**Dependencies**: None

## Description

Create comprehensive error hierarchy for GOAP system with clear error types for different failure scenarios. Enables precise error handling and debugging throughout the GOAP implementation.

All GOAP errors should extend a base GoapError class and include rich context information to aid debugging.

## Acceptance Criteria

- [ ] Base `GoapError` class created with common functionality
- [ ] `RefinementError` for refinement method execution failures
- [ ] `PlanningError` for GOAP planner failures
- [ ] `ContextAssemblyError` for context building issues
- [ ] `ParameterResolutionError` for parameter reference resolution failures
- [ ] `MethodSelectionError` for method applicability failures
- [ ] `StepExecutionError` for refinement step execution failures
- [ ] All errors include context information (taskId, methodId, stepIndex, etc.)
- [ ] All errors have clear, actionable messages
- [ ] Errors properly serialize for logging/debugging
- [ ] Comprehensive documentation for each error type

## Files to Create

### Error Hierarchy
- `src/goap/errors/goapError.js` - Base error class
- `src/goap/errors/refinementError.js` - Refinement failures
- `src/goap/errors/planningError.js` - Planning failures
- `src/goap/errors/contextAssemblyError.js` - Context issues
- `src/goap/errors/parameterResolutionError.js` - Parameter resolution failures
- `src/goap/errors/methodSelectionError.js` - Method selection failures
- `src/goap/errors/stepExecutionError.js` - Step execution failures

### Tests
- `tests/unit/goap/errors/errorHierarchy.test.js` - Error hierarchy tests

## Files to Modify

None (pure addition)

## Testing Requirements

### Unit Tests
- [ ] Test base GoapError instantiation
- [ ] Test error inheritance chain (all errors extend GoapError)
- [ ] Test error context information is preserved
- [ ] Test error serialization (toJSON)
- [ ] Test error message formatting
- [ ] Test error stack trace preservation
- [ ] Test each specific error type with appropriate context

## Error Structure

### Base GoapError
```javascript
class GoapError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = 'GoapError';
    this.context = context;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}
```

### Specific Error Types

#### RefinementError
Context: `{ taskId, methodId, stepIndex, actorId, reason }`
Use: When refinement method execution fails

#### PlanningError
Context: `{ goalId, actorId, worldState, reason }`
Use: When GOAP planner cannot find plan

#### ContextAssemblyError
Context: `{ actorId, contextType, missingData, reason }`
Use: When context cannot be assembled

#### ParameterResolutionError
Context: `{ reference, partialPath, failedAt, availableKeys, contextType }`
Use: When parameter reference cannot be resolved

#### MethodSelectionError
Context: `{ taskId, methodIds, evaluationResults, actorId }`
Use: When no applicable method found

#### StepExecutionError
Context: `{ stepIndex, stepType, actionId, targetBindings, reason }`
Use: When refinement step execution fails

## Reference Documentation

### Specifications
- `specs/goap-system-specs.md` lines 185-230 - Plan invalidation and failure modes
- `data/schemas/refinement-method.schema.json` - See `fallbackBehavior` field

### Error Handling Patterns
- Existing error patterns in `src/errors/`
- Event bus error dispatching patterns

## Implementation Notes

### Error Context Guidelines
Each error should include:
1. **What failed**: Clear description of operation
2. **Why it failed**: Root cause if known
3. **Where it failed**: Location in code/data (task ID, method ID, step index)
4. **How to fix**: Actionable guidance when possible

### Error Messages
Format: `"[ErrorType] <operation> failed: <reason>. Context: <relevant_context>"`

Examples:
- `"[RefinementError] Task 'consume_nourishing_item' refinement failed: No applicable methods found. Available methods: [method1, method2]"`
- `"[ParameterResolutionError] Cannot resolve 'task.params.item': Property 'item' not found in task.params. Available: [location, actor]"`

### Error Serialization
Errors must serialize cleanly for:
- Event bus dispatch
- Logging systems
- Debugging tools
- JSON storage/transmission

### Integration with Event System
All GOAP errors should trigger system events:
```javascript
eventBus.dispatch({
  type: 'GOAP_ERROR_OCCURRED',
  payload: {
    error: goapError.toJSON(),
    severity: 'error', // or 'warning'
    context: { /* additional context */ }
  }
});
```

## Success Validation

✅ **Done when**:
- All error classes implemented with proper inheritance
- All tests pass
- Error messages are clear and actionable
- Error context includes all relevant debugging information
- Errors serialize properly for logging
- Documentation explains when to use each error type
