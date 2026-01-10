# EXPDIACLISERROB-005: CORS integration tests for expression routes

## Summary
Add integration tests to verify CORS headers for expression routes and preflight behavior, reflecting the existing server CORS configuration.

## Status
Completed

## File list (expected to touch)
- llm-proxy-server/tests/integration/expression-routes-cors.integration.test.js
- llm-proxy-server/src/routes/expressionRoutes.js (no changes expected; route definitions already exported)

## Updated assumptions (after code review)
- Server CORS configuration already includes GET, POST, OPTIONS in `llm-proxy-server/src/core/server.js`.
- Expression route metadata is already exported via `EXPRESSION_ROUTE_DEFINITIONS`.
- No server-side CORS logic changes are required; the ticket is test-only unless tests expose missing headers.

## Out of scope
- Any client-side changes
- Changing CORS configuration logic or allowed origins
- Adding new endpoints

## Acceptance criteria
- OPTIONS preflight for `/api/expressions/scan-statuses` and `/api/expressions/update-status` returns expected CORS headers.
- Preflight `Access-Control-Allow-Methods` includes GET, POST, OPTIONS.
- GET scan and POST update include `Access-Control-Allow-Origin` for allowed origin in tests.

## Specific tests that must pass
- `npm run test:integration -- --testPathPatterns="expression-routes-cors"`

## Invariants that must remain true
- CORS allowed methods include GET, POST, OPTIONS.
- API paths and methods remain unchanged.
- Health endpoint `/health/live` remains untouched.

## Outcome
- Added integration coverage for expression route CORS preflight and allowed-origin headers as planned.
- Adjusted existing server and health readiness tests to avoid port conflicts and memory-threshold flakiness encountered during full-suite runs.
