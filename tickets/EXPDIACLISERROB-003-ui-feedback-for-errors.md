# EXPDIACLISERROB-003: UI feedback for expression diagnostics failures

## Summary
Surface structured errorType/message from ExpressionStatusService in the expression diagnostics UI with actionable guidance.

## File list (expected to touch)
- src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js
- src/expression-diagnostics.js (if wiring updates are needed)
- css/expression-diagnostics.css (or relevant stylesheet for the panel)
- tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js (if present; otherwise add appropriate UI unit tests)

## Out of scope
- Any server-side changes
- Changing API endpoints or response shapes
- Modifying health check logic or error classification in the service

## Acceptance criteria
- When service returns `{ success: false, errorType, message }`, the UI shows a visible error banner/toast with the message.
- Error guidance is tailored by errorType (connection_refused, cors_blocked, timeout, server_error, validation_error, unknown).
- The UI does not silently swallow failures (no empty table with no messaging).

## Specific tests that must pass
- `npm run test:unit -- --testPathPatterns="ExpressionDiagnosticsController"`

## Invariants that must remain true
- Existing UI controls continue to function (scan, update, reset) when the service returns success.
- No console-only error reporting replaces user-visible feedback.
- UI keeps current route and page structure (no navigation changes).
