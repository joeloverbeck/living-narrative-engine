# PUTONCLOACT-005: Strengthen equip clothing handler unit tests (COMPLETED)

## Status
Completed

## Summary
- `equipClothingHandler` already exists with baseline unit tests covering happy paths, displaced placement, and simple orchestrator failure.
- Add/extend unit coverage for parameter validation (bad params, invalid destination) and the `clothing:equipment` guard to ensure the handler exits early with a false result and no orchestrator call.
- Add a regression test for orchestrator exceptions to confirm we dispatch the error and return false without mutating equipment/inventory state.

## File list
- `tests/unit/logic/operationHandlers/equipClothingHandler.test.js` (extend existing suite)
- Helper fakes under `tests/unit/logic/operationHandlers/helpers/*` only if needed for the new cases.

## Out of scope
- Integration or e2e testing of the action/rule pipeline.
- Changes to production handler logic beyond fixes required by the new tests.
- Broad refactors of existing handler test helpers.

## Acceptance criteria
- Tests: `npm run test:unit -- --runInBand --testPathPattern="equipClothingHandler"` passes.
- Lint: `npm run lint -- tests/unit/logic/operationHandlers/equipClothingHandler.test.js` passes.
- Invariants:
  - Invalid params/destination or missing `clothing:equipment` write a false result variable, log a warning, and skip orchestrator calls.
  - Failure and exception scenarios leave equipment/inventory unchanged and surface the orchestrator errors via dispatcher logging.
  - Displaced conflicts remain covered for placement (inventory/ground) without deletion.

## Outcome
- Added unit cases for invalid params/destination, missing `clothing:equipment`, and orchestrator exception paths to the existing handler suite; no production code changes required.
- Test scope remains unit-only; DI/registration coverage was already present and unchanged.
