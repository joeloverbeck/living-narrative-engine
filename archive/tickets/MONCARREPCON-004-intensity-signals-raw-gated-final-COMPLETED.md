# MONCARREPCON-004: Intensity signals (raw, gated, final) and report labeling

## Summary
Use existing axis normalization helpers to compute raw/gated/final intensity signals, then update report sections to label signal usage and show raw vs final stats side by side.

## Assumptions corrected (as of current mainline)
- `src/expressionDiagnostics/utils/axisNormalizationUtils.js` already exists and is used by MonteCarloReportGenerator gate pass/failure calculations.
- Monte Carlo contexts already store `sexualAxes`, `previousSexualAxes`, and `affectTraits` in `MonteCarloSimulator.#buildContext`.
- Gate normalization and population label tests already exist; only new tests needed are for signal labeling and raw vs final regime stats.

## File list (expected to touch)
- src/expressionDiagnostics/utils/intensitySignalUtils.js (new)
- src/expressionDiagnostics/services/MonteCarloReportGenerator.js
- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.signals.test.js (new)

## Out of scope
- Population metadata and hash work.
- Report integrity warnings.
- Any changes to prototype weight definitions or expression content.

## Acceptance criteria
- Raw intensity computation mirrors PrototypeFitRankingService's sum/abs-weight formula, but uses normalized axes from the shared helpers.
- Gated signal is raw when all gates pass, otherwise 0; final is equal to gated (until future clamps exist).
- Report tables explicitly label signal used, and prototype stats include both raw and final P90/P95/max (either separate tables or clearly labeled columns).
- Clause stats explicitly state `Signal: final`.

## Tests
- `npm run test:unit -- --testPathPatterns tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.signals.test.js --coverage=false`

## Invariants
- If a gate fails for a context, gated/final must be 0 even when raw > 0.
- For any population, passSet(final >= t) is a subset of gatePassSet for t > 0.

## Status
Completed.

## Outcome
- Added shared intensity signal utilities and used them to compute raw/final regime stats with explicit signal labeling.
- Added report-level "Signal: final" labeling for clause stats and a unit test covering the raw/final regime rows.
