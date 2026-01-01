# MULTARRESROB-005 – Add JSDoc API Contracts

## Problem

`captureResolutionError` already normalizes null/undefined/string/object errors per the robustness spec, but its JSDoc still advertises `{Error}` only. The contract needs to reflect the implemented behavior so callers know the method is null-safe and accepts any error input.

## Proposed Scope

Update the JSDoc comment on `captureResolutionError` per spec Section 6.2:

```javascript
/**
 * Captures error information during target resolution.
 *
 * @param {object} trace - The action trace object. If not action-aware, method returns early.
 * @param {object} actionDef - The action definition being processed.
 * @param {object} actor - The actor performing the action.
 * @param {any} error - Error to capture. Can be null, undefined, string, Error, or any object.
 *                      Method will normalize to safe values:
 *                      - String errors used directly
 *                      - Error objects: message property extracted
 *                      - null/undefined: "Unknown error"
 *                      - Other objects: String() coercion
 * @returns {void}
 * @throws {never} This method never throws; all errors are captured internally.
 */
captureResolutionError(trace, actionDef, actor, error) {
  // ...
}
```

## File List

- `src/actions/pipeline/services/implementations/TargetResolutionTracingOrchestrator.js` (JSDoc only, lines ~210-215)

## Out of Scope

- Implementation changes (already landed; this ticket is JSDoc-only)
- Other methods in TracingOrchestrator (focus on `captureResolutionError` only)
- Other service files
- New test files (existing tests already cover null-safety)

## Acceptance Criteria

### Specific Tests That Must Pass

```bash
npm run typecheck
npm run test:unit -- tests/unit/actions/pipeline/services/implementations/TargetResolutionTracingOrchestrator.test.js
```

### Invariants That Must Remain True

1. **JSDoc-only change**: No implementation code changes in this ticket

2. **Required annotations**:
   - `@param {any} error` with description of accepted types
   - `@throws {never}` to indicate method never throws
   - `@returns {void}`

3. **Documentation accuracy**: The JSDoc must accurately reflect the current behavior in `TargetResolutionTracingOrchestrator`

4. **TypeScript compatibility**: JSDoc must pass `npm run typecheck` without errors

5. **Existing behavior unchanged**: All existing tests must pass without modification

## Dependencies

- MULTARRESROB-001 is assumed complete; `captureResolutionError` is already null-safe in the current codebase.

## Blocked By

- None

## Blocks

- Nothing (documentation)

## Completion

- Completed

## Outcome

Updated `captureResolutionError` JSDoc to reflect the existing null-safe behavior and `@throws {never}` contract. No implementation changes or new tests were required because null-safety and normalization coverage already existed in unit tests.
