# MONCARREPINTWARASS-001: Surface report integrity warnings in non-report UI

## Goal
Add a new integrity warnings container to the Monte Carlo Simulation results section in `expression-diagnostics.html`, wired through `ExpressionDiagnosticsController`, so authors see warning counts and details without opening the report modal.

## Status
Completed

## Updated assumptions
- Report integrity warnings are only computed during report generation today; the non-report UI must explicitly compute/attach them to simulation results.
- Warning rendering should reuse the report generator logic to avoid duplicating integrity checks.

## File list it expects to touch
- expression-diagnostics.html
- src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js
- src/expressionDiagnostics/services/MonteCarloReportGenerator.js
- tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js
- tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.populationSummary.test.js

## Out of scope
- Do not change report modal rendering or report generator output.
- Do not alter warning detection logic or epsilon behavior.
- Do not add new warning types or modify existing codes/messages.

## Acceptance criteria
### Specific tests that must pass
- `npm run test:unit -- --testPathPatterns ExpressionDiagnosticsController --coverage=false`

### Invariants that must remain true
- The integrity warnings container is hidden when there are no warnings.
- Existing Monte Carlo results (population summary, prototype fit, Top Blockers) render unchanged.
- No new console output is introduced in browser UI code.

## Outcome
- Added a non-report integrity warnings block in the Monte Carlo results UI and wired controller rendering for warning counts/details.
- Exposed report-generator warning collection for reuse in the UI instead of building duplicate checks.
- Added unit coverage for the warnings container visibility and content.
