# EXPEVALOG-002: Emit Runtime Expression Evaluation Log Entries

## Summary

Capture ordered matches and dispatch outcomes during each expression evaluation cycle, then post a JSON log entry to the proxy server via a small runtime logger utility.

## Priority: Medium | Effort: Medium

## Rationale

We need append-only JSONL logs for every evaluation cycle, including selected expression, matches in priority order, and dispatch outcomes. This ticket wires the runtime to emit those entries without impacting selection or dispatch flow.

## Dependencies

- **EXPEVALOG-001** (Structured dispatch outcome details)

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressions/expressionPersistenceListener.js` | **Update** |
| `src/expressions/expressionEvaluationLogger.js` | **Create** |
| `src/config/endpointConfig.js` | **Update** |
| `src/dependencyInjection/registrations/expressionsRegistrations.js` | **Update** |
| `src/dependencyInjection/tokens/tokens-core.js` | **Update** |
| `tests/unit/expressions/expressionPersistenceListener.test.js` | **Update** |
| `tests/unit/expressions/expressionEvaluationLogger.test.js` | **Create** |

## Out of Scope

- **DO NOT** change expression selection or priority ordering
- **DO NOT** include full evaluation traces or prerequisite failures
- **DO NOT** modify expression schemas or mod data
- **DO NOT** block dispatch when logging fails

## Implementation Details

- Add a runtime logger utility (e.g., `ExpressionEvaluationLogger`) that:
  - Uses `EndpointConfig` to resolve `POST /api/expressions/log`.
  - Sends `{ entry }` as JSON with `fetch`.
  - Returns `true/false` (or a result) but never throws; swallow errors after logging a debug message.
- Extend `EndpointConfig` with a `getExpressionLogEndpoint()` (or equivalent) so the URL is centrally derived.
- Update `ExpressionPersistenceListener` to:
  - Pass `event.type` into `#processStateChange` so the log entry contains `eventType`.
  - Use `expressionEvaluatorService.evaluateAll(context)` to get ordered matches.
  - Build `selected` from `matches[0]` or `null`.
  - Map matches to `{ id, priority, category }` with safe fallbacks.
  - Call `expressionDispatcher.dispatchWithResult(...)` when `selected` exists.
  - Emit a log entry for every evaluation cycle (including no-match cycles).
- Add unit tests for:
  - Log entry creation with match/no-match cases.
  - Ensuring dispatch is attempted only when `selected` is present.
  - Logger utility posts to the configured endpoint and handles failures without throwing.

## Acceptance Criteria

### Specific tests that must pass

- `npm run test:unit -- --testPathPatterns expressionPersistenceListener --coverage=false`
- `npm run test:unit -- --testPathPatterns expressionEvaluationLogger --coverage=false`

### Invariants that must remain true

- Expression evaluation ordering remains determined by `ExpressionRegistry` priority sorting.
- Dispatch still occurs only for the selected (highest-priority) match.
- Logging failures do not prevent or delay expression dispatch.
