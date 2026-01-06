# EXPTRIOBSANDTES-004: ExpressionRegistry + PersistenceListener INFO logs

## Goal
Add INFO-level logs confirming expression registry load counts and persistence listener match context (actorId, turnNumber).

## Assumptions check (revalidated)
- Expression evaluation INFO logs already exist in `src/expressions/expressionEvaluatorService.js`, so only registry + persistence listener need changes here.
- There is no integration test at `tests/integration/expressions/expressionPersistenceListener.integration.test.js`; the relevant coverage is currently in unit tests.

## File list it expects to touch
- src/expressions/expressionRegistry.js
- src/expressions/expressionPersistenceListener.js
- tests/unit/expressions/expressionRegistry.test.js (new)
- tests/unit/expressions/expressionPersistenceListener.test.js

## Out of scope
- Any changes to expression selection logic or dispatch rules.
- Adding or modifying tests beyond what is needed for log coverage.
- Mod data updates.

## Acceptance criteria
### Specific tests that must pass
- `npm run test:unit -- tests/unit/expressions/expressionRegistry.test.js --runInBand`
- `npm run test:unit -- tests/unit/expressions/expressionPersistenceListener.test.js --runInBand`

### Invariants that must remain true
- Registry cache build behavior remains unchanged aside from emitting INFO logs.
- Persistence listener still short-circuits events without `actorId` or without mood/sexual updates.
- Log entries are structured, include counts/ids, and do not introduce noisy per-frame spam beyond the specified points.

## Status
Completed

## Outcome
- Logged registry cache load counts once per cache build, avoiding duplicate prefixes.
- Promoted expression match logging to INFO with `actorId`, `turnNumber`, and `expressionId`.
- Added unit coverage for registry logging and updated persistence listener tests to assert match log context.
