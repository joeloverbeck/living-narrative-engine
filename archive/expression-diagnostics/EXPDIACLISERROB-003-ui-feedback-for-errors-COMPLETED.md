# EXPDIACLISERROB-003: UI feedback for expression diagnostics failures

## Summary
Surface structured errorType/message from ExpressionStatusService in the expression diagnostics UI with actionable guidance.

## Value assessment
This is worth implementing. The spec requires user-visible feedback for client/server failures (I4), and the current UI only logs errors and silently falls back to registry data.

## Assumptions (reassessed)
- ExpressionStatusService already returns `{ success: false, errorType, message }` for scan/update failures and performs cached health checks. The UI does not yet surface these results.
- The problematic expressions panel currently falls back to registry data on scan failures, which masks errors without user-visible guidance.
- Unit tests for the controller already exist in `tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js`; no new test file is needed.

## File list (expected to touch)
- src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js
- css/expression-diagnostics.css (or relevant stylesheet for the panel)
- tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js

## Out of scope
- Any server-side changes
- Changing API endpoints or response shapes
- Modifying health check logic or error classification in the service

## Acceptance criteria
- When service returns `{ success: false, errorType, message }`, the UI shows a visible error banner/toast with the message.
- Error guidance is tailored by errorType (connection_refused, cors_blocked, timeout, server_error, validation_error, unknown).
- Failures are no longer silent: the panel can still show fallback data, but must also show an error banner when a scan/update fails.

## Specific tests that must pass
- `npm run test:unit -- --testPathPatterns="ExpressionDiagnosticsController"`

## Invariants that must remain true
- Existing UI controls continue to function (scan, update, reset) when the service returns success.
- No console-only error reporting replaces user-visible feedback.
- UI keeps current route and page structure (no navigation changes).

## Status
Completed

## Outcome
- Implemented an in-panel error banner that surfaces scan/update failures with errorType-specific guidance, while keeping the registry fallback behavior for empty scans.
- Added styling for the banner and unit tests covering scan failure responses and update failure handling.
