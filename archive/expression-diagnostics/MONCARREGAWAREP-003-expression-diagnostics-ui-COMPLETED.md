# MONCARREGAWAREP-003: Expression diagnostics UI regime summaries

Status: Completed

## Goal
Expose regime-aware Monte Carlo summaries in the expression diagnostics UI without widening the primary tables.

## File list (expected to touch)
- src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js
- src/domUI/expression-diagnostics/MonteCarloReportModal.js
- css/expression-diagnostics.css
- expression-diagnostics.html
- src/expressionDiagnostics/services/PrototypeFitRankingService.js
- tests/integration/expression-diagnostics/monteCarloReport.integration.test.js
- tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js

## Assumptions & scope corrections
- Existing Top Blockers expansion uses the hierarchical breakdown row; extend that row with regime details rather than adding a new expansion mechanism.
- Regime-aware data already exists in Monte Carlo clause failures via `hierarchicalBreakdown` and the simulator payload (`inRegimeFailureRate`, min/max observed values, redundancy, tuning direction).
- Gate compatibility is computed in Monte Carlo results as `gateCompatibility` but is not currently surfaced in the UI; use this payload for the Conditional Pass Rates warning.
- The Monte Carlo report already contains a regime note in its markdown; only add a UI-facing hint near the Generate Report button or modal header.

## Work items
- Add expandable row details for Top Blockers that show: Fail% global, Fail% | mood-pass, regime redundancy flag, achievable range/status, and tuning direction.
- Add a short "Regime context" blurb under Conditional Pass Rates, and surface a warning if any gate incompatibility is detected.
- Add gate compatibility + in-regime achievable range to the detailed prototype info panel (not the main table).
- Add a small note near the Report button or report header explaining the global vs in-regime split.
- Keep the main tables unchanged in column count and order.

## Out of scope
- Visual redesign of the page layout or changes to overall styling conventions.
- Any changes to Monte Carlo sampling or report generation logic.
- Near-hit regime UI surfaces.

## Acceptance criteria
### Tests that must pass
- `npm run test:integration -- --testPathPatterns="expression-diagnostics/layoutOrder" --coverage=false`
- `npm run test:integration -- --testPathPatterns="expression-diagnostics/monteCarloReport" --coverage=false`

### Invariants that must remain true
- Existing table column headers and ordering remain unchanged.
- No new console warnings/errors in the browser diagnostics page.
- Expandable details do not render when Monte Carlo data is unavailable.

## Outcome
- Implemented regime detail rows inside the existing Top Blockers breakdown expansion, plus a new conditional pass regime note and gate-compatibility warning.
- Added prototype-fit detail rows for gate compatibility + in-regime ranges and a report button note; no changes to report generation logic or main table columns.
- Extended prototype fit ranking outputs and added unit coverage for gate-compatibility warnings.
