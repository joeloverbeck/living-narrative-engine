# EXPEVALOG-003: Add Proxy Endpoint for JSONL Expression Logs

## Summary

Add a proxy server endpoint (`POST /api/expressions/log`) that appends one JSONL entry per request to `logs/expressions/expression-evals-YYYY-MM-DD.jsonl` under the project root, with path safety checks.

## Status

Completed

## Priority: Medium | Effort: Medium

## Rationale

Runtime logging needs a durable append-only sink. This endpoint performs validation, ensures the daily log file exists, and safely appends entries.

## Dependencies

- None (can be implemented in parallel with runtime changes)

## Files to Touch

| File | Change Type |
|------|-------------|
| `llm-proxy-server/src/routes/expressionRoutes.js` | **Update** |
| `llm-proxy-server/src/handlers/expressionLogController.js` | **Create** |
| `llm-proxy-server/src/services/expressionLogService.js` | **Create** |
| `llm-proxy-server/src/core/server.js` | **Update** |
| `llm-proxy-server/tests/integration/expressions/expressionLogEndpoint.integration.test.js` | **Create** |
| `llm-proxy-server/tests/unit/expressionLogService.test.js` | **Create** |

## Out of Scope

- **DO NOT** add log rotation beyond daily file naming
- **DO NOT** accept arbitrary file paths from clients
- **DO NOT** change existing expression diagnostic status endpoints
- **DO NOT** add authentication or rate limiting

## Implementation Details

- Create `ExpressionLogService` that:
  - Resolves the project root (consistent with other services using `process.cwd()` or `path.resolve`).
  - Creates `logs/expressions` if missing.
  - Writes to `expression-evals-YYYY-MM-DD.jsonl` using `fs.promises.appendFile`.
  - Verifies the computed path stays within the project root (`path.relative` + prefix check).
  - Accepts an optional log directory override to enable safety-path testing without exposing path input to clients.
- Create `ExpressionLogController` that:
  - Validates `req.body.entry` is present and is an object.
  - Calls the service and returns `{ success: true, path, bytesWritten }` on success.
  - Returns 400 for validation errors and 500 for write failures.
- Register the new route in `expressionRoutes` and wire the controller in `server.js`.
- Add integration tests covering:
  - Happy path appends a line and returns 200 with `path` and `bytesWritten`.
  - Missing `entry` returns 400.
- Add a unit test that path safety rejects traversal via the log directory override (endpoint does not accept paths).

## Acceptance Criteria

### Specific tests that must pass

- `cd llm-proxy-server && npm run test:integration -- --testPathPatterns expressionLogEndpoint --coverage=false`

### Invariants that must remain true

- Proxy server continues to boot with existing routes unchanged.
- Existing expression status endpoints keep their current behavior.
- Logs are written only under `logs/expressions` in the project root.

## Outcome

Added a dedicated expression log controller/service, updated routes wiring, and covered the new endpoint with integration tests plus a unit-level safety-path guard test. The path traversal check is validated via the log directory override rather than a request payload since the endpoint does not accept paths.
