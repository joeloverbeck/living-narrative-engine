# ROBOPEHANVAL-001: Create MissingHandlerError Class

**Status**: ✅ COMPLETED

## Summary

Create a dedicated error class for missing operation handler scenarios, following the project's established error class patterns.

## Background

The spec requires a `MissingHandlerError` to be thrown when operation handlers are not found, replacing the current silent failure behavior. This error class must follow the existing patterns established by `ConfigurationError` and other domain errors in `src/errors/`.

## Files to Touch

### Create

| File                                            | Purpose                        |
| ----------------------------------------------- | ------------------------------ |
| `src/errors/missingHandlerError.js`             | New error class implementation |
| `tests/unit/errors/missingHandlerError.test.js` | Unit tests for the error class |

### Modify

| File                  | Change                               |
| --------------------- | ------------------------------------ |
| `src/errors/index.js` | Add export for `MissingHandlerError` |

## Out of Scope

- **DO NOT** modify `operationInterpreter.js` (that's ROBOPEHANVAL-003)
- **DO NOT** modify `operationRegistry.js` (that's ROBOPEHANVAL-002)
- **DO NOT** modify any rule loader code
- **DO NOT** modify any test infrastructure code
- **DO NOT** add any validation logic beyond the error class itself

## Implementation Details

### Error Class Structure

```javascript
// src/errors/missingHandlerError.js
import BaseError from './baseError.js';

/**
 * Error thrown when an operation handler is not found in the registry.
 */
export class MissingHandlerError extends BaseError {
  /**
   * @param {string} operationType - The operation type that has no handler
   * @param {string} [ruleId] - Optional rule ID context
   */
  constructor(operationType, ruleId = null) {
    const message = `Cannot execute operation '${operationType}'${ruleId ? ` in rule '${ruleId}'` : ''}: handler not found`;
    super(message, 'MISSING_HANDLER', { operationType, ruleId });
    this.name = 'MissingHandlerError';
    this.operationType = operationType;
    this.ruleId = ruleId;
  }

  getSeverity() {
    return 'error';
  }

  isRecoverable() {
    return false;
  }
}
```

### Pattern Reference

Follow the pattern from `src/errors/unknownAstNodeError.js` (domain-specific runtime error):

- Extend `BaseError`
- Include `getSeverity()` returning `'error'` (not 'critical' - this is a runtime error, not a configuration error)
- Include `isRecoverable()` returning `false`
- Store relevant context as instance properties
- Export as named export for consistency with index.js barrel pattern

## Acceptance Criteria

### Tests That Must Pass

1. **Unit Tests** (`tests/unit/errors/missingHandlerError.test.js`):
   - `MissingHandlerError` can be instantiated with just operation type
   - `MissingHandlerError` can be instantiated with operation type and rule ID
   - Error message includes operation type when no rule ID provided
   - Error message includes both operation type and rule ID when provided
   - `operationType` property is accessible
   - `ruleId` property is accessible (and null when not provided)
   - `getSeverity()` returns 'error'
   - `isRecoverable()` returns false
   - Error is instance of `BaseError`
   - Error is instance of `Error`
   - Error has correct `name` property ('MissingHandlerError')

2. **Existing Tests**:
   - `npm run test:unit` passes with no regressions

### Invariants That Must Remain True

1. The error class follows the project's established error patterns
2. No circular dependencies introduced in `src/errors/index.js`
3. The error can be imported from `src/errors/index.js`
4. The error can be caught and instanceof-checked properly

## Estimated Scope

- ~50 lines of implementation code
- ~80 lines of test code
- Small, focused diff

## Dependencies

- None - this is a foundational ticket

## Dependents

- ROBOPEHANVAL-003 (OperationInterpreter fail-fast) depends on this
- ROBOPEHANVAL-004 (HandlerCompletenessValidator) depends on this

---

## Outcome

### Changes Made vs Originally Planned

**Originally planned:**

- Create `MissingHandlerError` class with `getSeverity()` returning `'critical'`
- Follow `ConfigurationError` pattern

**Actually implemented:**

- Created `MissingHandlerError` class with `getSeverity()` returning `'error'` (not 'critical')
- Followed `UnknownAstNodeError` pattern instead (domain-specific runtime error vs configuration error)

**Rationale for deviation:**

- `'critical'` severity is appropriate for configuration errors that affect system startup
- Missing handler is a runtime error when a rule references an unregistered operation - `'error'` severity is more appropriate
- Aligns with other domain-specific runtime errors like `UnknownAstNodeError`

### Files Created

| File                                            | Lines | Purpose                                  |
| ----------------------------------------------- | ----- | ---------------------------------------- |
| `src/errors/missingHandlerError.js`             | 45    | Error class implementation               |
| `tests/unit/errors/missingHandlerError.test.js` | 161   | Comprehensive unit tests (20 test cases) |

### Files Modified

| File                  | Change                                 |
| --------------------- | -------------------------------------- |
| `src/errors/index.js` | Added export for `MissingHandlerError` |

### Test Results

- All 20 new tests pass
- All 412 existing error tests pass (23 test suites)
- No regressions introduced

### Acceptance Criteria Met

- ✅ Error class follows project patterns (`UnknownAstNodeError`)
- ✅ No circular dependencies
- ✅ Error importable from `src/errors/index.js`
- ✅ instanceof checks work correctly
- ✅ All unit tests pass
