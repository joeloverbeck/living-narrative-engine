# EXPDIACLISERROB-004: Server CORS vs route method validation

## Summary
Add startup validation/warning that all expression routes use HTTP methods present in CORS allowedMethods.

## File list (expected to touch)
- llm-proxy-server/src/core/server.js
- llm-proxy-server/src/routes/expressionRoutes.js (if route list needs to be exported for validation)
- llm-proxy-server/tests/unit/services/corsValidation.test.js (new)

## Out of scope
- Changing CORS origin rules or environment variable names
- Adding new endpoints or altering existing route paths/methods
- Client-side health checks or error classification

## Acceptance criteria
- Server logs a warning (or throws in dev) if any route method is missing from CORS allowedMethods.
- Expression routes (GET scan, POST update) are confirmed to be covered by CORS methods.

## Specific tests that must pass
- `npm run test:unit -- --testPathPatterns="corsValidation"`

## Invariants that must remain true
- CORS allowed methods include GET, POST, OPTIONS.
- Expression routes remain unchanged in path and HTTP method.
- No runtime changes to request handling for valid routes.
