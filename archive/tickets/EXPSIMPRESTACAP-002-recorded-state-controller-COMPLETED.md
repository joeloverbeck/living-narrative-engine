# EXPSIMPRESTACAP-002: Record previous state and use in evaluation

## Summary
Implement controller state and handlers to record current mood/derived values as a persistent previous-state capture and use it when building expression contexts.

## Assumptions checked
- `expressions-simulator.html` already includes the "Recorded Previous State" block and record button markup (no HTML/CSS changes needed here).
- Existing controller tests live in `tests/unit/domUI/expressionsSimulatorController.test.js` and will need updates/additions as part of this ticket because controller behavior changes.

## Files
- `src/domUI/expressions-simulator/ExpressionsSimulatorController.js`
- `tests/unit/domUI/expressionsSimulatorController.test.js`

## Out of scope
- HTML/CSS changes (handled in EXPSIMPRESTACAP-001).
- Any new data schemas or changes to expression evaluation logic beyond wiring previous state.

## Acceptance criteria
### Specific tests that must pass
- Existing tests in the repo remain green (run the subset relevant to touched files if needed).

### Invariants that must remain true
- If no recorded state exists, `previous*` values remain zeroed as today.
- Recorded state persists across trigger evaluations until explicitly re-recorded.
- The trigger button gating/disabled logic remains unchanged.
- If the emotion calculator throws, the controller logs a warning and leaves the recorded display unchanged.

## Implementation details
- Add a `recordedPreviousState` key in controller state.
- Add DOM bindings for the "Record Current State" button and the recorded-state container.
- On record:
  - Use the same calculation path as `#updateDerivedOutputs` for emotions/sexual states.
  - Store `{ moodAxes, emotions, sexualStates }` in `recordedPreviousState`.
  - Re-render the recorded-state UI (empty-state text when null).
- On trigger:
  - Pass `recordedPreviousState` (if present) as the `previousState` argument to `ExpressionContextBuilder.buildContext` (or equivalent method).
  - Do not overwrite `recordedPreviousState` after evaluation.
- If component schemas are unavailable, keep the record button functional but render placeholders or an error note in the recorded-state panel.

## Status
Completed

## Outcome
- Implemented recorded previous state capture + rendering in the controller and switched expression evaluation to use the recorded capture instead of auto-updating after triggers.
- Added/updated controller unit tests to cover recording, reuse across triggers, formatting, and error handling (tests were brought into scope for this ticket).
