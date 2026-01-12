# MONCARIMPCLAASS-004: Baseline labeling + low-confidence expression sweeps

Status: Completed

## Goal
Make baseline populations explicit in the report/UI and show low-confidence expression sweeps (with warnings) instead of suppressing them entirely.

## Scope
- Distinguish and label stored-context baseline (sweep tables) vs full-sample baseline (simulation summary) when both appear in the same report/UI.
- For expression-level sweeps with <5 baseline hits, render them with a low-confidence warning rather than omitting them (report + interactive UI).

## Tasks
- Update report generator to explicitly label stored-context baselines in sweep tables and reference the full-sample baseline in the same section.
- Adjust global sensitivity section logic to include low-confidence results with a warning badge/text (no suppression).
- Update interactive UI to display the same warning and baseline labeling alongside the global sensitivity tables.

## File list it expects to touch
- `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`
- `src/expression-diagnostics.js`
Note: `ReportOrchestrator` likely does not require changes for this scope.

## Out of scope
- No changes to how baseline hits are computed.
- No changes to the minimum sample requirements for Monte Carlo simulation.
- No changes to stored context selection or limits.

## Acceptance criteria
### Specific tests that must pass
- `npm run test:integration -- --testPathPatterns=tests/integration/expression-diagnostics/sensitivityScalarParity.integration.test.js --coverage=false`
- `npm run test:integration -- --testPathPatterns=tests/integration/expression-diagnostics/sensitivityAnalysis.integration.test.js --coverage=false`
- `npm run test:unit -- --testPathPatterns=tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js --coverage=false`

### Invariants that must remain true
- Report generation does not suppress expression sensitivity data solely because baseline hits are low.
- Baseline numbers continue to reflect their original populations (stored contexts vs full sample).

## Outcome
- Added explicit stored-context vs full-sample baseline labeling in sweep output.
- Low-confidence global sensitivity sweeps now render with warnings instead of being suppressed.
- No changes needed in `ReportOrchestrator` or baseline computation logic.
