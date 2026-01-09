# EXPDIACLISERROB-001: Client error classification and structured failures

## Summary
Add explicit error classification and structured failure objects to ExpressionStatusService so failures are user-visible and differentiated, and update the caller to handle the new return shape.

## Status
Completed

## Assumptions audit (updated)
- Current `scanAllStatuses()` returns an array (empty on failure); caller logic in `ExpressionDiagnosticsController` relies on `.length`.
- Current `updateStatus()` returns `{ success: boolean, message, expressionId? }` with no errorType.
- Unit tests in `tests/unit/expressionDiagnostics/services/expressionStatusService.test.js` assert array returns for scan failures and do not cover error type classification.

## File list (expected to touch)
- src/expressionDiagnostics/services/ExpressionStatusService.js
- src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js
- tests/unit/expressionDiagnostics/services/expressionStatusService.test.js

## Out of scope
- UI wiring or user-facing banners/toasts
- Adding new endpoints or changing existing API paths/methods
- Server-side CORS or route validation

## Acceptance criteria
- scanAllStatuses() returns `{ success: true, expressions }` on success and `{ success: false, errorType, message }` on failure.
- updateStatus() returns `{ success: true, ... }` on success and `{ success: false, errorType, message }` on failure.
- Errors are classified into one of: connection_refused, cors_blocked, timeout, server_error, validation_error, unknown.
- Existing 10s (update) and 30s (scan) timeouts remain unchanged.

## Specific tests that must pass
- `npm run test:unit -- --testPathPatterns="expressionStatusService"`

## Invariants that must remain true
- Health endpoint path remains `/health/live`.
- Expression routes remain `/api/expressions/scan-statuses` (GET) and `/api/expressions/update-status` (POST).
- Success response format stays `{ success: true, ... }`.
- Error type classification is one of the allowed values.

## Outcome
- Implemented structured success/failure results for scan/update and error type classification in the client service.
- Updated the expression diagnostics controller to handle the new scan result shape without adding UI changes.
- Expanded unit tests to cover error types (timeout, connection_refused, cors_blocked, server_error) and the new return shapes.
