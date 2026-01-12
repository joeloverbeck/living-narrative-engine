# MONCARREPINTWARASS-002: Add sample context indices + impact note to integrity warnings

Status: Completed

## Goal
- Extend report integrity warning details to include a small list of example context indices where violations were detected, and render them in the report warning text/details.
- Add the integrity-warning "impact note" (spec D) anywhere warnings are shown (report + MC results UI).

## File list it expects to touch
- src/expressionDiagnostics/services/MonteCarloReportGenerator.js
- src/expressionDiagnostics/utils/reportIntegrityUtils.js
- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.warnings.test.js
- expression-diagnostics.html
- src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js
- tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js

## Out of scope
- Do not change warning thresholds or epsilon values.
- Do not add new UI elements outside the expression diagnostics report and MC results area.
- Do not add verbose per-context traces (axes, gates, raw values).

## Acceptance criteria
### Specific tests that must pass
- `npm run test:unit -- --testPathPatterns monteCarloReportGenerator.warnings --coverage=false`
- `npm run test:unit -- --testPathPatterns ExpressionDiagnosticsController --coverage=false`

### Invariants that must remain true
- Warning counts and codes remain identical to current behavior.
- Only a small, fixed number of indices (e.g., first 3-5) are included in details.
- Report generation remains deterministic for the same input data.

## Notes / Assumptions Updated
- The MC results UI already shows integrity warnings; this ticket only adds the impact note to that existing container.
- Sample indices are reported as stored-context indices (global), even for mood-regime warnings, to make them traceable back to stored contexts.

## Outcome
- Added sample indices to report integrity warning details and rendered them inline in the report warnings list.
- Added the integrity-warning impact note in the report and the existing MC results warnings container.
- Updated unit tests for report warnings and expression diagnostics UI to cover the new samples/impact note behavior.
