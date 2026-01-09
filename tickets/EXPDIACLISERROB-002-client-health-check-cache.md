# EXPDIACLISERROB-002: Client health check with caching

## Summary
Add a 2s HEAD /health/live pre-flight check with 60s cache TTL and integrate it into expression operations.

## File list (expected to touch)
- src/expressionDiagnostics/services/ExpressionStatusService.js
- tests/unit/expressionDiagnostics/services/expressionStatusService.healthCheck.test.js
- tests/unit/expressionDiagnostics/services/expressionStatusService.test.js (if integration is added)

## Out of scope
- UI changes or error display
- Server-side health endpoint changes
- CORS validation or route checks on server

## Acceptance criteria
- New `checkServerHealth()` uses a 2000ms timeout and issues a HEAD request to `/health/live`.
- Health checks are cached for 60s; repeated calls within TTL reuse cached result.
- scanAllStatuses() and updateStatus() perform health check unless cache is valid.
- Health check failures return structured errors with errorType and message.

## Specific tests that must pass
- `npm run test:unit -- --testPathPatterns="expressionStatusService"`
- `npm run test:unit -- --testPathPatterns="expressionStatusService.healthCheck"`

## Invariants that must remain true
- Health check timeout is <= 2000ms.
- Health check cache TTL is 60000ms.
- Error types are limited to the allowed classification set.
