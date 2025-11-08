# MODTESDIAIMP-003: Integrate Parameter Validation into ScopeEngine

**Phase**: 1 - Parameter Validation
**Priority**: 🔴 Critical
**Estimated Effort**: 2 hours
**Dependencies**: MODTESDIAIMP-001, MODTESDIAIMP-002

---

## Overview

Integrate parameter validation into `ScopeEngine.resolve()` to fail fast with clear error messages when parameters have incorrect types or structures.

## Objectives

- Add validation calls at the start of `resolve()` method
- Ensure validation happens before any processing
- Maintain existing error propagation behavior
- Preserve stack traces for debugging

## Implementation Details

### File to Modify
- **Path**: `src/scopeDsl/engine.js`
- **Method**: `resolve(ast, actorEntity, runtimeCtx, trace = null)`
- **Location**: Around line 289

### Integration Pattern

```javascript
resolve(ast, actorEntity, runtimeCtx, trace = null) {
  // ADD VALIDATION - Fail fast with clear errors
  ParameterValidator.validateAST(ast, 'ScopeEngine.resolve');
  ParameterValidator.validateActorEntity(actorEntity, 'ScopeEngine.resolve');
  ParameterValidator.validateRuntimeContext(runtimeCtx, 'ScopeEngine.resolve');

  // Continue with existing logic
  const ctx = {
    actorEntity,
    runtimeCtx,
    trace,
    // ...
  };
  // ... rest of method unchanged
}
```

### Import Statement

```javascript
import { ParameterValidator } from './core/parameterValidator.js';
```

## Acceptance Criteria

- ✅ Import `ParameterValidator` at top of file
- ✅ Validation calls added as first statements in `resolve()`
- ✅ Validation order: AST → actorEntity → runtimeCtx
- ✅ All three validations called before any processing
- ✅ No changes to existing logic after validation
- ✅ ParameterValidationError propagates to caller
- ✅ Source location in errors is "ScopeEngine.resolve"

## Testing Requirements

**Test File**: `tests/unit/scopeDsl/engine.test.js` (modify existing)

### New Test Suite: "Parameter Validation"

1. **Invalid AST Tests**
   - Throw error for undefined AST
   - Throw error for null AST
   - Throw error for AST without kind

2. **Invalid actorEntity Tests**
   - Throw error for undefined actorEntity
   - Throw error for primitive actorEntity
   - Throw error for object without id
   - Detect and hint for context object

3. **Invalid runtimeCtx Tests**
   - Throw error for undefined runtimeCtx
   - Throw error for missing entityManager
   - Throw error for missing jsonLogicEval
   - Throw error for missing logger

4. **Error Message Tests**
   - Verify error includes "ScopeEngine.resolve" in message
   - Verify error is ParameterValidationError
   - Verify error context has expected/received

5. **Valid Parameters Test**
   - Pass: All valid parameters proceed normally

## Integration Impact

### Breaking Changes
- **None** - Only adds validation, doesn't change behavior for valid inputs

### Error Message Changes
- Before: Generic errors like "Cannot read property 'id' of undefined"
- After: Clear ParameterValidationError with hints

## Migration Guide for Tests

Existing tests with invalid parameters will now get clearer errors:

```javascript
// Before: TypeError deep in resolution chain
// After: ParameterValidationError at entry point

// Tests that intentionally pass invalid params need update:
it('should handle missing actorEntity', () => {
  expect(() => {
    scopeEngine.resolve(ast, undefined, runtimeCtx);
  }).toThrow(ParameterValidationError); // Update to expect new error type
});
```

## Rollback Plan

If issues arise:
1. Comment out validation calls
2. Keep validator files for future use
3. Revert commit

## Performance Impact

- **Minimal**: 3 additional function calls per resolve()
- **Overhead**: < 0.1ms per call
- **Benefit**: Fail-fast prevents deeper processing on invalid input

## References

- **Spec Section**: 3.1 Integration Points, Point 1 (lines 472-490)
- **Related Files**:
  - `src/scopeDsl/engine.js` (target file)
  - `src/scopeDsl/core/parameterValidator.js` (dependency)
- **Related Tickets**:
  - MODTESDIAIMP-001 (ParameterValidationError)
  - MODTESDIAIMP-002 (ParameterValidator)
  - MODTESDIAIMP-004 (Resolver integration)
