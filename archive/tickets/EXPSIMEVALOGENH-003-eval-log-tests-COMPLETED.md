# EXPSIMEVALOGENH-003: Evaluation Log tests

## Summary
Extend unit tests for the expressions simulator evaluation log to cover evaluation count reset behavior and priority-desc ordering with expression id tiebreakers, assuming UI/controller updates already landed.

## File list it expects to touch
- tests/unit/domUI/expressionsSimulatorController.test.js

## Assumptions
- Evaluation Log UI/DOM updates and controller rendering logic (count, badge, ordering) already exist per spec.
- Existing unit tests already cover basic evaluation count updates and priority badge rendering.

## Scope
- Unit test coverage updates in `tests/unit/domUI/expressionsSimulatorController.test.js` for count reset and id tiebreaker ordering.

## Out of scope
- Production code changes in `src/` or `css/`.
- Snapshot updates outside the expressions simulator evaluation log tests.
- Any changes to Jest configuration or test harness setup.

## Acceptance criteria
### Specific tests that must pass
- `npm run test:unit -- tests/unit/domUI/expressionsSimulatorController.test.js --runInBand`

### Invariants that must remain true
- Existing tests unrelated to the Evaluation Log continue to pass without modification.
- Test DOM setup includes the new `#es-evaluation-count` element.
- Tests continue to avoid full-suite coverage thresholds (unit test subset only).

## Status
Completed

## Outcome
- Added unit coverage for evaluation count reset on empty evaluations and priority tie ordering by expression id.
