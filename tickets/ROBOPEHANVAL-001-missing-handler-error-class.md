# ROBOPEHANVAL-001: Create MissingHandlerError Class

## Summary

Create a dedicated error class for missing operation handler scenarios, following the project's established error class patterns.

## Background

The spec requires a `MissingHandlerError` to be thrown when operation handlers are not found, replacing the current silent failure behavior. This error class must follow the existing patterns established by `ConfigurationError` and other domain errors in `src/errors/`.

## Files to Touch

### Create

| File | Purpose |
|------|---------|
| `src/errors/missingHandlerError.js` | New error class implementation |
| `tests/unit/errors/missingHandlerError.test.js` | Unit tests for the error class |

### Modify

| File | Change |
|------|--------|
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
    return 'critical';
  }

  isRecoverable() {
    return false;
  }
}
```

### Pattern Reference

Follow the pattern from `src/errors/configurationError.js`:
- Extend `BaseError`
- Include `getSeverity()` returning 'critical'
- Include `isRecoverable()` returning `false`
- Store relevant context as instance properties

## Acceptance Criteria

### Tests That Must Pass

1. **Unit Tests** (`tests/unit/errors/missingHandlerError.test.js`):
   - `MissingHandlerError` can be instantiated with just operation type
   - `MissingHandlerError` can be instantiated with operation type and rule ID
   - Error message includes operation type when no rule ID provided
   - Error message includes both operation type and rule ID when provided
   - `operationType` property is accessible
   - `ruleId` property is accessible (and null when not provided)
   - `getSeverity()` returns 'critical'
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
