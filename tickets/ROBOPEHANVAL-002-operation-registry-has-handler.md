# ROBOPEHANVAL-002: Add hasHandler Method to OperationRegistry

## Summary

Add a `hasHandler(operationType)` method to `OperationRegistry` that returns a boolean indicating whether a handler is registered for the given operation type.

## Background

The spec requires a way to check handler existence without retrieving the handler itself. The existing `getHandler()` returns `undefined` for missing handlers, but validation logic needs a cleaner boolean check. Note that `getRegisteredTypes()` already exists.

## Files to Touch

### Modify

| File | Change |
|------|--------|
| `src/logic/operationRegistry.js` | Add `hasHandler(operationType)` method |
| `tests/unit/logic/operationRegistry.completeness.test.js` | Create new test file for completeness methods |

### Note

There may be existing tests for `OperationRegistry` - check `tests/unit/logic/` for files like `operationRegistry.test.js` and add tests there if appropriate.

## Out of Scope

- **DO NOT** modify `operationInterpreter.js` (that's ROBOPEHANVAL-003)
- **DO NOT** modify any loader code
- **DO NOT** modify any error classes
- **DO NOT** change the behavior of existing `getHandler()` or `register()` methods
- **DO NOT** add validation logic - just the boolean check method

## Implementation Details

### Method Signature

```javascript
/**
 * Check if a handler exists for the given operation type
 * @param {string} operationType - The operation type to check
 * @returns {boolean} True if handler is registered, false otherwise
 */
hasHandler(operationType) {
  const trimmed = getNormalizedOperationType(
    operationType,
    this.#logger,
    'OperationRegistry.hasHandler'
  );
  if (!trimmed) {
    return false;
  }
  return this.#registry.has(trimmed);
}
```

### Placement

Add the method after `getHandler()` and before `getRegisteredTypes()` for logical grouping of query methods.

## Acceptance Criteria

### Tests That Must Pass

1. **Unit Tests** (`tests/unit/logic/operationRegistry.completeness.test.js` or existing file):
   - `hasHandler()` returns `true` for registered operation type
   - `hasHandler()` returns `false` for unregistered operation type
   - `hasHandler()` handles null/undefined input gracefully (returns false)
   - `hasHandler()` handles empty string input gracefully (returns false)
   - `hasHandler()` uses normalized operation type (handles whitespace)
   - `hasHandler()` is consistent with `getHandler()` results:
     - If `hasHandler(type)` returns true, `getHandler(type)` returns a handler
     - If `hasHandler(type)` returns false, `getHandler(type)` returns undefined

2. **Existing Tests**:
   - `npm run test:unit` passes with no regressions
   - Any existing `operationRegistry` tests continue to pass

### Invariants That Must Remain True

1. `hasHandler()` must be consistent with `getHandler()` - they must agree on handler existence
2. `hasHandler()` does NOT log on missing handlers (unlike `getHandler()` which logs debug)
3. `hasHandler()` is a pure query method with no side effects
4. Existing `getHandler()`, `register()`, and `getRegisteredTypes()` behavior unchanged

## Estimated Scope

- ~15 lines of implementation code
- ~60 lines of test code
- Very small, focused diff

## Dependencies

- None - this is independent foundational work

## Dependents

- ROBOPEHANVAL-004 (HandlerCompletenessValidator) uses this method
- ROBOPEHANVAL-005 (Rule loader validation) may use this method
