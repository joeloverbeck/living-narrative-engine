# EXPSIM-005: Tests for Expressions Simulator

## Status
Completed

## Goal
Confirm coverage for the expressions simulator controller, add entrypoint/bootstrap coverage, and keep simulator-specific integration tests aligned with the current harness.

## File list
- tests/unit/domUI/expressionsSimulatorController.test.js (already present)
- tests/unit/expressions-simulator.test.js (new entrypoint/bootstrap coverage)
- tests/integration/expressions/expressionsSimulator.integration.test.js
- src/domUI/expressions-simulator/ExpressionsSimulatorController.js
- src/expressions-simulator.js

## Out of scope
- No changes to production behavior beyond minor testability hooks.
- No changes to expression data files.
- No new DOM harness folder; rely on JSDOM-based unit coverage already in place.

## Acceptance criteria
### Specific tests that must pass
- Unit (controller): input rendering from schemas, derived text updates, trigger flow, previous-state caching, actor/observer message rendering.
- Unit (entrypoint): bootstrap wiring invokes expression registrations and controller initialization; fatal error path reports startup failure.
- Integration: mods load, registry has expressions, evaluator matches expected expression for known inputs, dispatch yields perceptible payload.

### Invariants that must remain true
- Tests run with `--runInBand` for targeted suites when invoked locally.
- Coverage expectations are not enforced for single-file/test runs.
- Existing expression integration tests remain unchanged and green.

## Implementation notes
- Follow patterns from existing expression tests and entrypoint tests (e.g., other simulators).
- Use deterministic fixtures and avoid snapshot drift.

## Outcome
- Confirmed existing controller unit coverage and extended integration coverage for evaluator matches.
- Added entrypoint bootstrap unit tests for `src/expressions-simulator.js`.
- No standalone DOM harness was added; JSDOM-based controller tests remain the DOM coverage path.
