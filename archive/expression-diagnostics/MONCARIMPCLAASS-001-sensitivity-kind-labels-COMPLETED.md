# MONCARIMPCLAASS-001: Add sensitivity result kinds + correct labels/disclaimers

Status: Completed

## Goal
Introduce explicit sensitivity result kinds for marginal clause sweeps vs expression-level sweeps, and drive report + non-report UI labels/disclaimers from the kind so the UI cannot be mislabeled.

## Scope
- Add an explicit `kind` (or distinct result shape) for sensitivity results.
- Update report section headers and per-result headings to use the kind.
- Align the interactive UI label for the **existing** global expression sensitivity panel with the report wording (no marginal sweep UI exists today).

## Tasks
- Extend `SensitivityResult` typing/docs to include `kind` with values like `marginalClausePassRateSweep` and `expressionTriggerRateSweep`.
- Populate `kind` in both `computeThresholdSensitivity` and `computeExpressionSensitivity` (including the report worker simulator).
- Update report generator formatting to:
  - Rename the current “Sensitivity Analysis” section to “Marginal Clause Pass-Rate Sweep”.
  - Include a disclaimer that the sweep does not estimate trigger rate.
  - Keep “Global Expression Sensitivity Analysis” for expression sweeps and use `kind` to drive per-result headings.
- Update the interactive UI label for global sensitivity to mirror the report wording.

## File list it expects to touch
- `src/expressionDiagnostics/services/MonteCarloSimulator.js`
- `src/expressionDiagnostics/services/SensitivityAnalyzer.js`
- `src/expressionDiagnostics/workers/MonteCarloReportWorker.js`
- `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`
- `src/expression-diagnostics.js` (if UI label needs wiring)
- `expression-diagnostics.html`
- `tests/integration/expression-diagnostics/sensitivityAnalysis.integration.test.js`
- `tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js`
- `tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.labels.test.js`

## Out of scope
- No changes to sampling logic or stored context limits.
- No changes to the Monte Carlo simulation output structure beyond adding the `kind` field.
- No changes to core simulation behavior or thresholds.

## Acceptance criteria
### Specific tests that must pass
- `npm run test:integration -- --testPathPatterns=tests/integration/expression-diagnostics/sensitivityAnalysis.integration.test.js --coverage=false`
- `npm run test:unit -- --testPathPatterns=tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.labels.test.js --coverage=false`
- `npm run test:unit -- --testPathPatterns=tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js --coverage=false`

### Invariants that must remain true
- Monte Carlo trigger-rate computations are unchanged.
- Expression-level sensitivity still evaluates the full expression logic.
- Marginal sweeps still operate only on stored contexts (no new evaluator usage).

## Outcome
- Added explicit `kind` discriminators for marginal clause pass-rate sweeps vs expression trigger-rate sweeps (including the report worker).
- Report sections now label marginal sweeps as “Marginal Clause Pass-Rate Sweep,” include a trigger-rate disclaimer, and use kind-driven headings.
- Interactive UI only exposes global expression sensitivity today; updated its heading to match report wording (no new marginal UI added).
- Updated unit + integration tests to reflect the corrected labels/disclaimer.
