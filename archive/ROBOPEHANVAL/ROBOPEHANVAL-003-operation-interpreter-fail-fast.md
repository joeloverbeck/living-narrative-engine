# ROBOPEHANVAL-003: OperationInterpreter Fail-Fast on Missing Handler

**Status**: ✅ COMPLETED

## Summary

Modify `OperationInterpreter` to throw `MissingHandlerError` instead of silently returning when a handler is not found. This is the core behavior change that eliminates silent failures.

## Background

Current behavior at `src/logic/operationInterpreter.js:418-425`:

```javascript
const handler = this.#registry.getHandler(opType);
if (!handler) {
  this.#logger.error(`---> HANDLER NOT FOUND for operation type: "${opType}".`);
  return; // SILENT FAILURE
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

| File                                            | Change                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------ |
| `src/logic/operationInterpreter.js`             | Import `MissingHandlerError`, throw instead of return                    |
| `tests/unit/logic/operationInterpreter.test.js` | Add fail-fast tests to existing file (756 lines, comprehensive coverage) |

### Note (Resolved)

✅ `operationInterpreter.test.js` exists - tests added there per ticket guidance.

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
  throw new MissingHandlerError(opType, null);
}
```

### Rule ID Context (Resolved)

✅ Verified: `OperationInterpreter` does NOT track `#currentRuleId`. The `ruleId` is tracked in `SystemLogicInterpreter` but not passed to `OperationInterpreter.execute()`. Per ticket guidance, we pass `null` - the error message will still be useful with the operation type.

## Acceptance Criteria

### Tests That Must Pass

1. **Unit Tests** (`tests/unit/logic/operationInterpreter.test.js`):
   - Missing handler throws `MissingHandlerError`
   - Error contains correct operation type
   - Error has `null` ruleId (no context tracking in interpreter)
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

---

## Outcome

### What Was Planned vs What Changed

| Aspect               | Originally Planned                                       | Actually Implemented                                |
| -------------------- | -------------------------------------------------------- | --------------------------------------------------- |
| Import location      | Line ~10                                                 | Line 10 ✅                                          |
| Code change location | Lines 418-425                                            | Lines 420-422 ✅                                    |
| ruleId parameter     | `this.#currentRuleId`                                    | `null` (no context tracking exists) ✅              |
| Test file            | Create new `operationInterpreter.missingHandler.test.js` | Added to existing `operationInterpreter.test.js` ✅ |

### Corrected Assumptions

1. **Test file**: Ticket suggested creating a new file, but `operationInterpreter.test.js` already existed with 756 lines of comprehensive coverage. Per ticket's own guidance ("if so, add tests there instead"), tests were added to the existing file.

2. **Rule ID context**: Ticket assumed `#currentRuleId` might exist. Investigation confirmed it does not - `OperationInterpreter` receives only `operation` and `executionContext`. The ruleId is tracked in `SystemLogicInterpreter` but not passed down. Per ticket guidance, `null` is used.

### Tests Modified/Added

| Test                                                                             | Change                                                                   | Rationale                            |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------ |
| `execute should call registry.getHandler with trimmed operation type` (line 225) | Changed from expecting `logger.error` to expecting `MissingHandlerError` | Core behavior change                 |
| `execute should throw MissingHandlerError when handler not found` (line 587)     | Renamed from "log error", changed assertion                              | Core behavior change                 |
| `MissingHandlerError contains correct operation type` (line 597)                 | NEW                                                                      | Verify error contains useful context |
| `MissingHandlerError has null ruleId` (line 610)                                 | NEW                                                                      | Document current limitation          |
| `MissingHandlerError propagates up the call stack` (line 623)                    | NEW                                                                      | Verify error isn't swallowed         |
| `execute should treat IF like any other type` (line 648)                         | Changed from expecting `logger.error` to expecting `MissingHandlerError` | Core behavior change                 |

### Lines of Code Changed

- **Production**: ~5 lines (1 import + 4 lines replaced with 2)
- **Tests**: ~50 lines (3 modified, 3 new test cases added)

### Test Results

All 33 tests in `operationInterpreter.test.js` pass.

### Impact Assessment

The predicted "HIGH IMPACT" test failures across the codebase did NOT materialize in the immediate test suite. This is because:

1. Most tests properly register handlers through mock registries
2. Tests that used `UNKNOWN_OP` already expected failure behavior (just now via throw instead of return)

Further test runs across the full codebase may reveal additional tests that relied on silent failure - this is the intended purpose of ROBOPEHANVAL-007.
