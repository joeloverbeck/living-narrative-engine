# EXPDIACLISERROB-002: Client health check with caching

## Summary
Add a 2s HEAD /health/live pre-flight check with 60s cache TTL and integrate it into expression operations.

## Status
Completed

## Reassessed assumptions
- `ExpressionStatusService` already includes error classification and structured error returns; this ticket only adds the health check + cache and wires it into existing operations.
- No existing health check tests are present; a new unit test file is required.

## File list (expected to touch)
- src/expressionDiagnostics/services/ExpressionStatusService.js
- tests/unit/expressionDiagnostics/services/expressionStatusService.healthCheck.test.js
- tests/unit/expressionDiagnostics/services/expressionStatusService.test.js

## Out of scope
- UI changes or error display
- Server-side health endpoint changes
- CORS validation or route checks on server

## Acceptance criteria
- New `checkServerHealth()` uses a 2000ms timeout and issues a HEAD request to `/health/live`.
- Health checks are cached for 60s; repeated calls within TTL reuse cached result.
- `scanAllStatuses()` and `updateStatus()` perform health check unless cache is valid.
- Health check failures return structured errors with errorType and message.

## Specific tests that must pass
- `npm run test:unit -- --testPathPatterns="expressionStatusService"`
- `npm run test:unit -- --testPathPatterns="expressionStatusService.healthCheck"`

## Invariants that must remain true
- Health check timeout is <= 2000ms.
- Health check cache TTL is 60000ms.
- Error types are limited to the allowed classification set.

## Outcome
- Added cached client-side health check (HEAD /health/live, 2s timeout) and integrated it into scan/update operations before executing requests.
- Added health check unit coverage plus integration checks to ensure operations short-circuit on failed health checks.
- Kept existing error classification logic and public API shapes unchanged; no server changes required.
