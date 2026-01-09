# EXPDIACLISERROB-005: CORS integration tests for expression routes

## Summary
Add integration tests to verify CORS headers for expression routes and preflight behavior.

## File list (expected to touch)
- llm-proxy-server/tests/integration/expression-routes-cors.integration.test.js
- llm-proxy-server/src/routes/expressionRoutes.js (only if test setup requires exported router metadata)

## Out of scope
- Any client-side changes
- Changing CORS configuration logic or allowed origins
- Adding new endpoints

## Acceptance criteria
- OPTIONS preflight for `/api/expressions/scan-statuses` and `/api/expressions/update-status` returns expected CORS headers.
- GET scan and POST update include `Access-Control-Allow-Origin` for allowed origin in tests.

## Specific tests that must pass
- `npm run test:integration -- --testPathPatterns="expression-routes-cors"`

## Invariants that must remain true
- CORS allowed methods include GET, POST, OPTIONS.
- API paths and methods remain unchanged.
- Health endpoint `/health/live` remains untouched.
