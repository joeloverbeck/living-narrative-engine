# EXPEVALOG-001: Add Structured Dispatch Outcome Details

## Summary

Expose a structured dispatch outcome from the expression dispatcher without changing existing behavior. Keep `dispatch()` returning a boolean, but add a `dispatchWithResult()` helper that surfaces rate-limit and failure reasons for logging.

## Priority: Medium | Effort: Small

## Rationale

Expression evaluation logs need to capture whether dispatch was attempted, rate-limited, or failed. Today we only get a boolean. A structured result enables logging without touching selection logic.

## Dependencies

- None

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressions/expressionDispatcher.js` | **Update** |
| `tests/unit/expressions/expressionDispatcher.test.js` | **Update** |

## Out of Scope

- **DO NOT** change the event payload schema sent to the event bus
- **DO NOT** alter rate-limiting behavior
- **DO NOT** update expression selection or evaluation logic
- **DO NOT** add network calls or logging outside the dispatcher

## Implementation Details

- Add `dispatchWithResult(actorId, expression, turnNumber)` that returns an object like:
  - `attempted` (boolean)
  - `success` (boolean)
  - `rateLimited` (boolean)
  - `reason` (string or null; e.g., `rate_limited`, `missing_location`, `dispatch_error`)
- Implement `dispatch()` as a thin wrapper that calls `dispatchWithResult()` and returns `result.success` (preserving the boolean return contract).
- Ensure existing debug/warn/error logs remain intact.
- Update unit tests to cover the new return shape for `dispatchWithResult()` while keeping existing `dispatch()` tests intact.

## Acceptance Criteria

### Specific tests that must pass

- `npm run test:unit -- --testPathPatterns expressionDispatcher --coverage=false`

### Invariants that must remain true

- `ExpressionDispatcher.dispatch()` continues to return a boolean.
- Event payloads remain identical to pre-change behavior.
- Rate-limiting still allows only one dispatch per turn number.
