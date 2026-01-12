# MONCARREPCLA-002: Update report OR breakdown and operator-aware prototype math

## Goal
Make the Monte Carlo report and diagnostics UI accurate for OR alternatives, operator-specific prototype math messaging, and OR-mood-constraint caveats without changing the overall report structure.

## Assumptions (reassessed)
- `HierarchicalClauseNode` already tracks `orPassCount`/`orExclusivePassCount` and `MonteCarloSimulator` already records them; no data-model changes required unless missing.
- Report generator still labels OR contribution as order-independent and prototype math uses >= semantics for <= operators.
- UI currently shows only first-pass contribution for OR blocks and has no warning when OR mood constraints are present.

## File list (expected to touch)
- src/expressionDiagnostics/services/MonteCarloReportGenerator.js
- src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js
- expression-diagnostics.html
- css/expression-diagnostics.css
- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js
- tests/integration/expression-diagnostics/monteCarloReport.integration.test.js

## Work items
- Update the OR breakdown table to include order-independent `P(alt passes | OR pass)` and `P(alt exclusively passes | OR pass)` alongside the existing first-pass contribution, labeling it as order-dependent.
- Rename the summary label from "Success Breakdown" to "OR Alternative Coverage" and add the one-line note about first-pass order dependence.
- Adjust prototype math section rendering to be operator-aware:
  - For `>=` or `>`: keep "Max Achievable" reachability framing and narrow margin logic.
  - For `<=` or `<`: switch to upper-bound safety framing, compute narrative gap as `maxAchievable - threshold`, and revise recommendation text per spec.
- Ensure "narrow margin" messaging never appears for `<=` or `<` operators.
- Add warnings in report + UI sections that rely on AND-only mood constraint extraction when OR mood constraints are present.

## Out of scope
- Adding or changing simulator metrics beyond the existing OR pass/exclusive counters.
- Changing the report output structure beyond additional columns/labels and updated wording.

## Acceptance criteria
### Tests that must pass
- `npm run test:unit -- --testPathPatterns="monteCarloReportGenerator" --coverage=false`
- `npm run test:integration -- --testPathPatterns="monteCarloReport" --coverage=false`

### Invariants that must remain true
- Report sections and headings remain present in the same order (only wording/column additions change).
- First-pass contribution remains visible and explicitly labeled as order-dependent.
- Prototype math output never states "narrow margin" for `<=` or `<`.

## Status
Completed

## Outcome
- Updated report OR alternative coverage to include pass/exclusive rates and an order-dependence note; kept first-pass share.
- Made prototype math operator-aware for `<=`/`<` with upper-bound framing and revised recommendations, plus gate-note adjustment.
- Added OR-mood-constraint warnings in report sections and the diagnostics UI where AND-only extraction applies.
- Confirmed simulator/model already tracked OR pass/exclusive metrics; no data-model changes needed.
