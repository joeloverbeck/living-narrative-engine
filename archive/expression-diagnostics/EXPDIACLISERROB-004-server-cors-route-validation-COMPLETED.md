# EXPDIACLISERROB-004: Server CORS vs route method validation

## Summary
Add startup validation/warning that expression route methods remain covered by CORS allowedMethods (CORS already includes GET/POST/OPTIONS).

## Assumptions check
- CORS allowed methods already include GET, POST, OPTIONS in `llm-proxy-server/src/core/server.js`.
- Expression routes are still `GET /scan-statuses` and `POST /update-status`.

## File list (expected to touch)
- llm-proxy-server/src/core/server.js
- llm-proxy-server/src/routes/expressionRoutes.js (export route definitions for validation)
- llm-proxy-server/src/utils/corsValidation.js (new)
- llm-proxy-server/tests/unit/services/corsValidation.test.js (new)

## Out of scope
- Changing CORS origin rules or environment variable names
- Adding new endpoints or altering existing route paths/methods
- Client-side health checks or error classification

## Acceptance criteria
- Server validates expression route methods against CORS allowedMethods at startup.
- Server logs a warning when any route method is missing and throws in dev/test environments.
- No changes to CORS method configuration, route paths, or HTTP methods.

## Specific tests that must pass
- `npm run test:unit -- --testPathPatterns="corsValidation"`

## Invariants that must remain true
- CORS allowed methods include GET, POST, OPTIONS.
- Expression routes remain unchanged in path and HTTP method.
- No runtime changes to request handling for valid routes.

## Status
Completed

## Outcome
- Confirmed CORS already includes GET/POST/OPTIONS; no CORS config changes required.
- Added startup validation against expression route definitions plus unit coverage for warnings/throws.
- Ran `npm run test:single -- --testPathPatterns="corsValidation"` in `llm-proxy-server` due to unit coverage thresholds on subset runs.
