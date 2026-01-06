# EXPTRIOBSANDTES-003: ExpressionDispatcher integration tests

## Goal
Add integration coverage for ExpressionDispatcher placeholder replacement and turn-based rate limiting.

## File list it expects to touch
- tests/integration/expressions/expressionDispatcher.integration.test.js
- src/expressions/expressionDispatcher.js (only if fixes are required by tests)
- tests/helpers/ (only if new test helpers are required for actor setup)

## Assumptions (validated against `src/expressions/expressionDispatcher.js`)
- Dispatch requires the actor to have a position component with a `locationId`; otherwise dispatch returns `false`.
- Placeholder replacement uses the actor name from the name component (`text` or `value`), with fallback to `actorId`.
- Rate limiting is per dispatcher instance (one dispatch per turn across all actors), not per-actor.

## Out of scope
- Changes to evaluation or registry behavior.
- UI updates or DOM rendering.
- LLM proxy or network behavior.

## Acceptance criteria
### Specific tests that must pass
- `npm run test:integration -- tests/integration/expressions/expressionDispatcher.integration.test.js --runInBand`

### Invariants that must remain true
- Placeholder replacement uses actor-provided names consistently for `descriptionText` and `alternateDescriptions` (with fallback to `actorId`).
- Rate limiting blocks repeated dispatches in the same turn and allows dispatches in a later turn.

## Status
Completed.

## Outcome
- Added integration coverage for placeholder replacement and turn-based rate limiting in `ExpressionDispatcher`.
- No production code changes were required; tests exercise current dispatcher behavior.
