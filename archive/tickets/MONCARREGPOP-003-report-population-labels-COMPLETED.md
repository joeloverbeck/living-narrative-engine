# MONCARREGPOP-003: Report population summary + per-section labels

## Status
Completed

## Goal
Make Monte Carlo report sections declare their population and unit so discrepancies like 327 vs 35 are clearly explained to readers.

## Expected file list
- `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`
- `tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.populationLabels.test.js`

## Assumptions & scope check
- `simulationResult.populationSummary` already exists in `MonteCarloSimulator`, so the report should consume it rather than inventing new fields.
- Gate failure stats live inside the Prototype Math Analysis section (via stored-context gate failure rates), so the population label should be attached there.

## Work
- Add a "Population Summary" block near the report header using `populationSummary`:
  - Total samples + in-regime sample count/rate
  - Stored contexts + in-regime stored count/rate
  - Explicit note when `storedContextCount < sampleCount` and the configured limit
- For each report section that uses stored contexts (conditional pass rates, sensitivity analysis, prototype fit, implied prototype, gap detection, last-mile decomposition, gate failure stats within prototype math):
  - Add a single-line population label: "Population: stored contexts (N of total; limit M; in-regime K)."
- Standardize naming for the regime predicate in the report:
  - "Mood regime = AND-only mood constraints from prerequisites (moodAxes.* or mood.*)."

## Out of scope
- UI changes.
- Any changes to Monte Carlo sampling or sensitivity limits.
- Changing how existing statistics are computed beyond adding labels.

## Acceptance criteria
### Tests
- `npm run test:unit -- --testPathPatterns=monteCarloReportGenerator.populationLabels.test.js --coverage=false`

### Invariants
- Report counts/rates match pre-change values for the same input data.
- Every stored-context-based section explicitly names its population and limit.
- The report makes clear why counts like 327 (full samples) vs 35 (stored contexts) can both be correct.

## Outcome
- Added a population summary block plus stored-context population labels in report sections, including prototype math gate failure stats.
- Added unit coverage for population summary output and section labels.
