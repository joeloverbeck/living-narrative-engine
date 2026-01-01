# MULTARRESROB-001 – Fix Null-Safety in captureResolutionError

**Status: COMPLETED**

## Problem

The `captureResolutionError` method in `TargetResolutionTracingOrchestrator` crashes when receiving null, undefined, string, or non-Error object inputs. The method directly accesses `error.message` without null checks, while inconsistently using optional chaining for `error.constructor?.name`. The current JSDoc types `error` as `Error`, but runtime usage (from `MultiTargetResolutionStage` error paths) can pass null, strings, or objects without a `message`.

**Evidence from coverage tests** (lines 2003-2008 in `MultiTargetResolutionStage.coverage.test.js`):
```javascript
// Spy on captureResolutionError to prevent it from crashing on null error
// The tracing orchestrator's captureResolutionError accesses error.message directly
// which would crash if error is null
jest
  .spyOn(mockDeps.tracingOrchestrator, 'captureResolutionError')
  .mockImplementation(() => {});
```

## Proposed Scope

Apply null-safe error normalization in `captureResolutionError` following the pattern from the spec (Section 6.1), including a non-empty error message fallback for empty strings:

```javascript
captureResolutionError(trace, actionDef, actor, error) {
  if (!this.isActionAwareTrace(trace)) return;

  // Normalize error to safe values
  const rawMessage =
    typeof error === 'string' ? error : error?.message;
  const errorMessage =
    rawMessage && rawMessage.length > 0
      ? rawMessage
      : String(error ?? 'Unknown error');

  const errorType =
    error?.constructor?.name ??
    (typeof error === 'string' ? 'String' : 'Unknown');

  const errorData = {
    stage: 'target_resolution',
    actorId: actor.id,
    resolutionFailed: true,
    error: errorMessage,
    errorType: errorType,
    scopeName: error?.scopeName,
    timestamp: Date.now(),
  };
  // ... rest unchanged
}
```

## File List

- `src/actions/pipeline/services/implementations/TargetResolutionTracingOrchestrator.js` (lines 213-236)

## Out of Scope

- Other capture methods in `TargetResolutionTracingOrchestrator` (captureLegacyDetection, captureScopeEvaluation, etc.)
- `MultiTargetResolutionStage.js` error handling (uses its own null-safe pattern already)
- Removing the spy workaround in `MultiTargetResolutionStage.coverage.test.js` (handled in MULTARRESROB-004)
- Result envelope changes
- JSDoc documentation (handled in MULTARRESROB-005)
- Adding assertions to consumers (handled in MULTARRESROB-006)

## Acceptance Criteria

### Specific Tests That Must Pass

```bash
npm run test:unit -- tests/unit/actions/pipeline/services/implementations/TargetResolutionTracingOrchestrator.test.js
npm run test:unit -- tests/unit/actions/pipeline/stages/MultiTargetResolutionStage.coverage.test.js
npm run test:unit -- tests/unit/actions/pipeline/stages/MultiTargetResolutionStage.test.js
```

### Invariants That Must Remain True

1. **No-throw guarantee**: `captureResolutionError` must never throw when called with any of:
   - `null`
   - `undefined`
   - `'string error'`
   - `new Error('test')`
   - `{ scopeName: 'test:scope' }` (object without message)
   - `123` (number)
   - `{}` (empty object)

2. **Output normalization**: The `errorData.error` field must always be a non-empty string, falling back to `Unknown error` for empty string inputs

3. **Backward compatibility**: Existing tests pass without modification (the spy mock in coverage tests may still be present; it just won't be necessary)

4. **Consistent optional chaining**: Use `error?.` pattern throughout the method for all error property access

### Tests to Add or Update

- Add null-safety coverage for `captureResolutionError` in `tests/unit/actions/pipeline/services/implementations/TargetResolutionTracingOrchestrator.test.js` (table-driven inputs matching the invariant list).

## Dependencies

- None (this is the foundational ticket)

## Blocked By

- Nothing

## Blocks

- MULTARRESROB-002 (validates this fix with property tests)
- MULTARRESROB-004 (removes spy mock workaround)
- MULTARRESROB-005 (documents the null-safety contract)

## Outcome

Updated `captureResolutionError` to normalize null/undefined/empty-string inputs into non-empty error messages while keeping error type and scopeName safe; added table-driven null-safety tests in `TargetResolutionTracingOrchestrator.test.js` instead of deferring all test changes to follow-on tickets.
