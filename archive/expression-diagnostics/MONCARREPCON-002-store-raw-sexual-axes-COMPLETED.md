# MONCARREPCON-002: Store raw sexual axes in Monte Carlo contexts

## Summary
Verify MonteCarloSimulator stored context already includes raw sexual axes and add coverage to prevent regressions.

## Assumptions (reassessed)
- `MonteCarloSimulator.#buildContext` already stores `sexualAxes` and `previousSexualAxes` from the raw state objects.
- The remaining gap is test coverage to lock the behavior in place.

## File list (expected to touch)
- tests/unit/expressionDiagnostics/services/monteCarloSimulator.context.test.js (new)

## Out of scope
- Any changes to emotion calculation or expression evaluation logic.
- Any report formatting or population metadata changes.
- Any removal or renaming of existing context fields (sexualStates, sexualArousal).

## Acceptance criteria
- Stored context already includes raw sexual axes in `sexualAxes` (current) and `previousSexualAxes` (previous) based on currentState/previousState sexual values.
- Existing fields `sexualStates` and `sexualArousal` remain intact and unmodified.
- Unit test verifies raw sexual axes are present and match the source state values.

## Tests
- `npm run test:unit -- --testPathPatterns tests/unit/expressionDiagnostics/services/monteCarloSimulator.context.test.js --coverage=false`

## Invariants
- No change to Monte Carlo sampling behavior or expression prerequisites evaluation.
- Stored context is still JSON-serializable.

## Status
- Completed

## Outcome
- Verified the MonteCarloSimulator context already stores raw sexual axes and previous sexual axes; no runtime changes needed.
- Added a unit test to lock the stored context fields and ensure derived sexual fields remain present.
