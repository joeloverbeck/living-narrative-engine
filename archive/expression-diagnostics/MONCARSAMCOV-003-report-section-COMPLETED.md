# MONCARSAMCOV-003 - Sampling Coverage in Markdown Report

## Goal
Add a Sampling Coverage section to the Monte Carlo markdown report, including summary tables, lowest-coverage list, and warning blocks when coverage is poor.

## Scope
- Render the Summary by Domain table using `simulationResult.samplingCoverage.summaryByDomain`.
- Render the Lowest Coverage Variables table (top 5 lowest-rated variables; tie-break by lower range coverage, then bin coverage).
- Emit warnings when any domain rating is `poor` and include `simulationResult.samplingMode` when available.
- Insert the Sampling Coverage section directly after Executive Summary in the report.
- Include notes describing range/bin/tail coverage calculations and bin count from `samplingCoverage.config`.

## File list
- `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`
- `tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js`
- `tests/integration/expression-diagnostics/monteCarloReport.integration.test.js`

## Out of scope
- Simulator changes (samplingCoverage is already produced by `MonteCarloSimulator`).
- UI rendering changes in `expression-diagnostics.html`.
- Changes to existing report sections unrelated to Sampling Coverage.

## Acceptance criteria
### Specific tests that must pass
- `npm run test:unit -- --testPathPatterns=tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js --coverage=false`
- `npm run test:integration -- --testPathPatterns=tests/integration/expression-diagnostics/monteCarloReport.integration.test.js --coverage=false`

### Additional assumptions
- `samplingCoverage.summaryByDomain` contains only known domains; variables with `rating: 'unknown'` are excluded from summaries.
- Sampling coverage data is omitted entirely when no in-scope numeric variables are present.

### Invariants that must remain true
- Existing report sections (executive summary, blockers, prototype fit, etc.) render unchanged when `samplingCoverage` is absent.
- The Sampling Coverage section is omitted when no coverage data is present.
- Warnings are additive and do not alter existing warning formats.

## Status
Completed

## Outcome
Added a Sampling Coverage section after the executive summary with summary/lowest-coverage tables, notes (including bin/tail config), and poor-coverage warnings that include sampling mode. Added unit/integration tests for the new output; no simulator or UI changes were required.
