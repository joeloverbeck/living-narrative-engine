# MONCARREGPOP-003: Report population summary + per-section labels

## Goal
Make Monte Carlo report sections declare their population and unit so discrepancies like 327 vs 35 are clearly explained to readers.

## Expected file list
- `src/monteCarlo/MonteCarloReportGenerator.js`
- `tests/unit/monteCarlo/monteCarloReportGenerator.populationLabels.test.js`

## Work
- Add a "Population Summary" block near the report header using `populationSummary`:
  - Total samples + in-regime sample count/rate
  - Stored contexts + in-regime stored count/rate
  - Explicit note when `storedContextCount < sampleCount` and the configured limit
- For each report section that uses stored contexts (conditional pass rates, sensitivity analysis, prototype fit, implied prototype, gap detection, last-mile decomposition, gate failure stats):
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
