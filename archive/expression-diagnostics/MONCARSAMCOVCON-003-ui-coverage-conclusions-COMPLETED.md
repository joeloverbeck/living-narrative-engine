# MONCARSAMCOVCON-003: Show coverage conclusions in expression diagnostics UI

## Goal
Display coverage conclusions beneath the Sampling Coverage tables in the in-page Monte Carlo results panel, using the shared conclusions builder defined in `specs/monte-carlo-sampling-coverage-conclusions.md`.

## Assumptions Check (2025-03-04)
- The shared conclusions builder already exists at `src/expressionDiagnostics/services/samplingCoverageConclusions.js`.
- `expression-diagnostics.html` includes the conclusions container markup under `#mc-sampling-coverage`.
- `ExpressionDiagnosticsController` already renders conclusions via `buildSamplingCoverageConclusions()` and hides the block when there are no items.
- Report-side conclusions are already implemented in `MonteCarloReportGenerator` and covered by unit tests.
- Remaining gap (if any): unit coverage for the UI empty-state (coverage data present but no conclusions emitted).

## File list (expected to touch)
- expression-diagnostics.html
- src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js
- src/expressionDiagnostics/services/samplingCoverageConclusions.js
- src/expressionDiagnostics/services/MonteCarloReportGenerator.js
- tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js
- tests/unit/expressionDiagnostics/services/samplingCoverageConclusions.test.js
- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js

## Work items
- Confirm the conclusions container markup exists under `#mc-sampling-coverage`.
- Confirm the controller renders conclusions via `buildSamplingCoverageConclusions()` with plain list items.
- Hide the conclusions container when there are no conclusions to display.
- Extend unit tests to verify list rendering and the hidden state when conclusions are empty but coverage data exists.

## Out of scope
- Styling or severity badge UI work.
- Modifying sampling coverage calculation or payload format.
- Adding watchlist bullets or UI toggles.

## Acceptance criteria
### Tests that must pass
- `npm run test:unit -- --testPathPatterns ExpressionDiagnosticsController --coverage=false`
- `npm run test:unit -- --testPathPatterns samplingCoverageConclusions --coverage=false`
- `npm run test:unit -- --testPathPatterns monteCarloReportGenerator --coverage=false`

### Invariants that must remain true
- Sampling coverage summary/tables render exactly as before when conclusions are absent.
- Conclusions list shows no variable names and uses plain list items only.
- The conclusions container remains hidden when no conclusions are emitted.

## Status
- [x] Completed

## Outcome
- Planned: ensure UI conclusions rendering uses the shared builder and add empty-state coverage.
- Actual: confirmed UI/report/helper were already in place; added a UI unit test for conclusions-empty behavior and updated ticket scope/assumptions.
