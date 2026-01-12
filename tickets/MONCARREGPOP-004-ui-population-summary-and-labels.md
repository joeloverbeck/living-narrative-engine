# MONCARREGPOP-004: UI population summary + labels in expression diagnostics

## Goal
Make the Monte Carlo UI disclose population counts/limits and align its mood-regime predicate with the simulator/report, eliminating confusion like 327 vs 35.

## Expected file list
- `src/expressionDiagnostics/ExpressionDiagnosticsController.js`
- `expression-diagnostics.html`
- `tests/e2e/expressionDiagnostics/monteCarloPopulationLabels.test.js` (or closest existing UI test location)

## Work
- Add a "Population Summary" card in the Monte Carlo results area showing:
  - `sampleCount` + `inRegimeSampleCount`
  - `storedContextCount` + `storedInRegimeCount`
  - `storedContextLimit`
- For UI sections that use stored contexts (conditional pass rates, last-mile decomposition, global sensitivity, prototype fit, implied prototype, prototype gap detection):
  - Add a short population label using `populationSummary` data.
- Switch UI mood constraint extraction/evaluation to use `moodRegimeUtils`:
  - Include both `moodAxes.*` and `mood.*` aliases.
  - Use shared OR detection and warning text so it matches the report.

## Out of scope
- Any changes to Monte Carlo sampling logic.
- Any changes to report output.
- Any layout or styling changes outside the Monte Carlo results area.

## Acceptance criteria
### Tests
- `npm run test:e2e -- --testPathPatterns=monteCarloPopulationLabels.test.js --coverage=false`

### Invariants
- UI calculations for stored-context-based sections remain numerically identical to pre-change values.
- Every stored-context-based section in the UI clearly names its population and limit.
- The UI explains why full-sample counts can differ from stored-context counts (no ambiguous labels like "mood-pass sample count").
