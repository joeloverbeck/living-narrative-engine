# SCODSLROB-002: Filter Evaluation Fail-Fast

## Status: COMPLETED

## Summary
Replace silent error swallowing in filterResolver.js with fail-fast behavior. Non-condition_ref errors should throw ScopeResolutionError with full context instead of silently returning false.

## File List

### Files to Modify
1. `src/scopeDsl/nodes/filterResolver.js` (lines 294-327)
   - Modify catch block to throw on non-condition_ref errors
   - Include entity ID, filter logic, and original error in exception

2. `tests/unit/scopeDsl/nodes/filterResolver.conditionRefErrors.test.js` (line 212-227)
   - **CRITICAL FIX**: Existing test "continues processing when evaluation throws non condition_ref errors"
     explicitly tests for silent swallowing behavior - must be CHANGED to expect fail-fast behavior

### Out of Scope
- NO changes to condition_ref error handling (already re-throws)
- NO changes to entityHelpers.js
- NO changes to jsonLogicEvaluationService.js
- NO new error types (use existing ScopeResolutionError)
- NO changes to the error handler integration

## Assumption Corrections (Discovered During Implementation)
1. **ErrorCodes constant name**: Ticket originally used `FILTER_EVALUATION_FAILED` but the actual
   constant is `FILTER_EVAL_FAILED` (SCOPE_3002) - code must use the correct existing constant
2. **Existing test requires modification**: Test file `filterResolver.conditionRefErrors.test.js`
   has a test that explicitly validates the silent-fail behavior - this must be updated to match
   the new fail-fast semantics

## Implementation Details

### Current Code (Problem)
```javascript
catch (error) {
  if (error.message && error.message.includes('Could not resolve condition_ref')) {
    // ... wrap and re-throw (good)
  }
  // Other errors: silently continue (BAD) - comment at line 326-327
}
```

### Proposed Code (Solution)
```javascript
catch (error) {
  if (error.message && error.message.includes('Could not resolve condition_ref')) {
    // Existing handling - keep as-is
    const wrappedError = new ScopeResolutionError(/* ... */);
    if (errorHandler) {
      errorHandler.handleError(wrappedError, ctx, 'FilterResolver', ErrorCodes.RESOLUTION_FAILED_GENERIC);
    } else {
      throw wrappedError;
    }
  } else {
    // NEW: Fail-fast on other errors
    const entityId = typeof item === 'string' ? item : item?.id;
    const failFastError = new ScopeResolutionError(
      `Filter evaluation failed for entity '${entityId}'`,
      {
        phase: 'filter_evaluation',
        scopeName: ctx.scopeName || 'unknown',
        parameters: { entityId, filterLogic: node.logic },
        originalError: error.message,
        hint: 'Check that entity has all required components for this filter'
      }
    );
    if (errorHandler) {
      errorHandler.handleError(failFastError, ctx, 'FilterResolver', ErrorCodes.FILTER_EVAL_FAILED);
    } else {
      throw failFastError;
    }
  }
}
```

## Acceptance Criteria

### Tests That Must Pass
1. All existing tests in `tests/unit/scopeDsl/nodes/filterResolver.test.js`
2. All existing tests in `tests/integration/scopeDsl/filterResolver.integration.test.js`
3. New test: `tests/unit/scopeDsl/nodes/filterResolver.failFast.test.js`
   - "should throw ScopeResolutionError on TypeError during filter evaluation"
   - "should throw ScopeResolutionError on ReferenceError during filter evaluation"
   - "should include entity ID in error context"
   - "should include filter logic in error context"
   - "should chain original error message"
   - "should still handle condition_ref errors as before"
   - "should use error handler when configured for non-condition_ref errors"

### Tests That Must Be Updated
1. `tests/unit/scopeDsl/nodes/filterResolver.conditionRefErrors.test.js`
   - Test "continues processing when evaluation throws non condition_ref errors" must be
     **changed** to expect fail-fast behavior (throw, not silent continue)

### Invariants That Must Remain True
- INV-EVAL-1: No silent failures during filter evaluation
- Condition_ref errors continue to be handled (backward compatible)
- Error handler integration continues to work if configured

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Changed as planned:**
1. `src/scopeDsl/nodes/filterResolver.js` (lines 325-349): Added else branch to catch block that
   creates and throws/handles `ScopeResolutionError` for non-condition_ref errors using
   `ErrorCodes.FILTER_EVAL_FAILED`

**Additional changes discovered during implementation:**
1. `tests/unit/scopeDsl/nodes/filterResolver.conditionRefErrors.test.js`: Modified existing test
   "continues processing when evaluation throws non condition_ref errors" to expect fail-fast
   behavior instead of silent swallowing

**New files created:**
1. `tests/unit/scopeDsl/nodes/filterResolver.failFast.test.js`: 12 new tests covering:
   - TypeError and ReferenceError handling
   - Entity ID in error context
   - Filter logic in error context
   - Original error message chaining
   - Scope name in error context
   - condition_ref backward compatibility
   - Object items with id property
   - Error handler integration with correct error codes
   - INV-EVAL-1 invariant enforcement

**Assumption corrections applied:**
- Used `ErrorCodes.FILTER_EVAL_FAILED` (the actual constant) instead of `FILTER_EVALUATION_FAILED`
  (as originally written in ticket)

### Test Results
- All 45 filterResolver unit tests pass
- All 23 filterResolver integration tests pass
- All new fail-fast tests pass (12 tests)

### Files Modified Summary
| File | Type | Change |
|------|------|--------|
| `src/scopeDsl/nodes/filterResolver.js` | Modified | Added fail-fast else branch (lines 325-349) |
| `tests/unit/scopeDsl/nodes/filterResolver.conditionRefErrors.test.js` | Modified | Changed 1 test to expect throw instead of silent continue |
| `tests/unit/scopeDsl/nodes/filterResolver.failFast.test.js` | Created | 12 new tests for fail-fast behavior |

### Completion Date
2026-01-03
