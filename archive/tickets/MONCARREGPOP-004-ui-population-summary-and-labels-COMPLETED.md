# MONCARREGPOP-004: UI population summary + labels in expression diagnostics

Status: Completed

## Goal
Make the Monte Carlo UI disclose population counts/limits and align its mood-regime predicate with the simulator/report, eliminating confusion like 327 vs 35.

## Expected file list
- `src/expressionDiagnostics/ExpressionDiagnosticsController.js`
- `expression-diagnostics.html`
- `tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.populationSummary.test.js` (new)

## Work
- Add a "Population Summary" card in the Monte Carlo results area showing:
  - `sampleCount` + `inRegimeSampleCount`
  - `storedContextCount` + `storedInRegimeCount`
  - `storedContextLimit`
- For UI sections that use stored contexts (conditional pass rates, last-mile decomposition, global sensitivity, prototype fit, implied prototype, prototype gap detection):
  - Add a short population label using `populationSummary` data.
- Note: UI mood constraint extraction already uses `moodRegimeUtils` with `moodAxes.*` + `mood.*` alias support and shared OR detection. No changes needed unless regressions are found.

## Out of scope
- Any changes to Monte Carlo sampling logic.
- Any changes to report output.
- Any layout or styling changes outside the Monte Carlo results area.

## Acceptance criteria
### Tests
- `npm run test:unit -- --testPathPatterns=ExpressionDiagnosticsController.populationSummary.test.js --coverage=false`

### Invariants
- UI calculations for stored-context-based sections remain numerically identical to pre-change values.
- Every stored-context-based section in the UI clearly names its population and limit.
- The UI explains why full-sample counts can differ from stored-context counts (no ambiguous labels like "mood-pass sample count").

## Outcome
- Added a Monte Carlo population summary card and stored-context population labels in the UI, wired to existing `populationSummary` data.
- Added a unit test to cover population summary rendering and label updates.
- Confirmed UI mood-regime extraction already uses `moodRegimeUtils`; no changes required.
