# EXPTRIOBSANDTES-005: Expression triggering E2E suite

## Goal
Add E2E coverage for expression triggering from `ACTION_DECIDED` updates, including priority selection and no-op update behavior.

## Updated assumptions
- `ExpressionPersistenceListener` already performs change detection via its previous-state cache; the no-op update assertion must occur after at least one stateful update has been processed.
- `createE2ETestEnvironment` loads mods but does not run `InitializationService`, so the E2E suite must explicitly subscribe the expression listener to `ACTION_DECIDED` via `ISafeEventDispatcher`.
- `ExpressionRegistry` caches expressions on first evaluation; any test-only expressions must be added to the data registry before the first evaluation.

## File list it expects to touch
- tests/e2e/expressions/ExpressionTriggering.e2e.test.js
- tests/e2e/helpers/ (if new helpers are required to seed expression data)
- tests/fixtures/ or data/mods/ (only if a minimal test expression fixture is needed)

## Out of scope
- Refactors of the engine initialization harness.
- Non-expression E2E scenarios.
- Production mod data edits unless strictly required for stable fixtures.

## Acceptance criteria
### Specific tests that must pass
- `npm run test:e2e -- tests/e2e/expressions/ExpressionTriggering.e2e.test.js --runInBand`

### Invariants that must remain true
- The test suite verifies a known expression from `data/mods/emotions/expressions/` or a dedicated test fixture with stable prerequisites.
- Priority selection in the full stack dispatches only the highest-priority expression.
- No perceptible event is dispatched on an unchanged mood/sexual_state update after a prior update has established state, and a subsequent change triggers exactly one event.

## Status
Completed

## Outcome
- Added a new E2E suite at `tests/e2e/expressions/ExpressionTriggering.e2e.test.js` using the container-based environment with explicit expression listener subscription.
- Used live `emotions` expressions and inline registry inserts for priority testing instead of new fixture files.
- Updated assertions to match the runtime expression ID format (base IDs like `quiet_contentment`).
