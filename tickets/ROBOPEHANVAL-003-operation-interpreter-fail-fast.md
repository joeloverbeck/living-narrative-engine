# ROBOPEHANVAL-003: OperationInterpreter Fail-Fast on Missing Handler

## Summary

Modify `OperationInterpreter` to throw `MissingHandlerError` instead of silently returning when a handler is not found. This is the core behavior change that eliminates silent failures.

## Background

Current behavior at `src/logic/operationInterpreter.js:418-425`:

```javascript
const handler = this.#registry.getHandler(opType);
if (!handler) {
  this.#logger.error(`---> HANDLER NOT FOUND for operation type: "${opType}".`);
  return;  // SILENT FAILURE
}
```

This must become:

```javascript
const handler = this.#registry.getHandler(opType);
if (!handler) {
  throw new MissingHandlerError(opType, this.#currentRuleId);
}
```

## Files to Touch

### Modify

| File | Change |
|------|--------|
| `src/logic/operationInterpreter.js` | Import `MissingHandlerError`, throw instead of return |
| `tests/unit/logic/operationInterpreter.missingHandler.test.js` | Create new test file |

### Note

Examine if there's already an `operationInterpreter.test.js` - if so, add tests there instead.

## Out of Scope

- **DO NOT** modify `operationRegistry.js` (that's ROBOPEHANVAL-002)
- **DO NOT** modify any loader code (that's ROBOPEHANVAL-005)
- **DO NOT** add any validation service code (that's ROBOPEHANVAL-004)
- **DO NOT** change how `#currentRuleId` is tracked (use existing mechanism if present)
- **DO NOT** modify test infrastructure (ModTestHandlerFactory)

## Implementation Details

### Import Addition

```javascript
import { MissingHandlerError } from '../errors/missingHandlerError.js';
```

### Code Change Location

Around line 418-425, change:

```javascript
// BEFORE
if (!handler) {
  this.#logger.error(`---> HANDLER NOT FOUND for operation type: "${opType}".`);
  return;
}

// AFTER
if (!handler) {
  throw new MissingHandlerError(opType, this.#currentRuleId);
}
```

### Rule ID Context

Check if `OperationInterpreter` already tracks the current rule being executed. If `#currentRuleId` doesn't exist:
- Look for how the rule context is passed in (might be in execution context)
- If no rule ID available, pass `null` - error message will still be useful

## Acceptance Criteria

### Tests That Must Pass

1. **Unit Tests** (`tests/unit/logic/operationInterpreter.missingHandler.test.js`):
   - Missing handler throws `MissingHandlerError`
   - Error contains correct operation type
   - Error contains rule ID when available
   - Error is of correct type (instanceof check)
   - Error does NOT get swallowed by any internal try/catch
   - Error propagates up the call stack

2. **Verify Existing Tests**:
   - `npm run test:unit` - many tests may fail initially
   - This is expected: tests that relied on silent failure now see thrown errors
   - Tests that expected operations to "just not happen" must be updated

3. **Integration Sanity**:
   - A test that intentionally uses an unregistered operation type gets `MissingHandlerError`

### Invariants That Must Remain True

1. **Fail-Fast**: Missing handler = thrown error, NEVER silent return
2. Valid handlers continue to execute normally
3. Handler execution errors still propagate normally (no change to existing error handling)
4. Logging of the error is removed (throwing the error IS the notification)

## Estimated Scope

- ~5 lines changed in implementation
- ~50 lines of test code
- Small diff but HIGH IMPACT - may break many tests

## Risk Assessment

**HIGH IMPACT CHANGE**: This will likely cause many existing tests to fail because they:
1. Set up incomplete handler registrations
2. Expect operations to silently not execute

These failures are EXPECTED and DESIRABLE - they reveal the exact places that were silently broken before.

## Dependencies

- ROBOPEHANVAL-001 (MissingHandlerError class) must be completed first

## Dependents

- All downstream tickets may need to run tests after this to see what breaks
- ROBOPEHANVAL-007 (ModTestHandlerFactory) specifically handles test infrastructure fixes
