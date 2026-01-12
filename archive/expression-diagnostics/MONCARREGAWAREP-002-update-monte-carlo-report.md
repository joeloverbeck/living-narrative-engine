# MONCARREGAWAREP-002: Update Monte Carlo report with regime-aware feasibility
**Status**: Completed

## Goal
Revise the Monte Carlo report to present unambiguous feasibility data, clear regime labeling, and gate-compatibility context.

## File list (expected to touch)
- src/expressionDiagnostics/services/MonteCarloReportGenerator.js
- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js
- tests/integration/expression-diagnostics/monteCarloReport.integration.test.js (if report text expectations shift)

## Assumptions (revalidated)
- Monte Carlo clause results already include in-regime failure rates, observed min/max ranges, tuning direction, and redundancy flags via `HierarchicalClauseNode` serialization; no simulator model changes are required beyond consuming these fields.
- Monte Carlo results include `gateCompatibility` for prototypes referenced in prerequisites; the report can use this directly instead of adding new simulator outputs.
- Stored contexts are available when `storeSamplesForSensitivity` is enabled; regime stats should degrade gracefully (N/A) when contexts are unavailable.

## Work items
- Replace the "Prototype Math Analysis" block with the standardized feasibility block (achievable range, threshold, status, slack, tuning direction).
- Add regime-labeled prototype sections for Global and In mood regime (P50/P90/P95, min/max, gate pass rate) using stored contexts where available.
- Include gate compatibility blocks with boolean status and reason when incompatible (from `simulationResult.gateCompatibility`).
- Add per-clause redundancy flags based on in-regime min/max (from hierarchical breakdown data).
- Show fail rates as "Fail% global" and "Fail% | mood-pass" wherever fail rates appear in the report (blocker header, condition tables, worst-offender summaries, legend).
- Add a short report header note that the report includes global vs in-regime statistics.

## Out of scope
- Changes to the Monte Carlo simulator data model beyond consuming existing in-regime and gate-compatibility fields.
- UI adjustments in `expression-diagnostics.html` or CSS changes.
- Near-hit regime calculations or reporting.

## Acceptance criteria
### Tests that must pass
- `npm run test:integration -- --testPathPatterns="expression-diagnostics/monteCarloReport" --coverage=false`

### Invariants that must remain true
- Report remains valid Markdown and starts with `# Monte Carlo Analysis Report`.
- Report generation does not mutate Monte Carlo results or diagnostics state.
- Report size does not grow unbounded (no raw sample dumps).

## Outcome
- Replaced the Prototype Math Analysis content with the standardized feasibility block, added regime stats tables, and included gate compatibility notes in the report output.
- Added fail-rate labeling for global vs mood-pass metrics plus redundancy flags, along with a header note to clarify regime context.
- Updated unit tests to cover new report text and added a regime/gate compatibility assertion; no simulator model changes were needed.
