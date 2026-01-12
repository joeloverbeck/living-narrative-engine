# MONCARPERANAREP-001: Remove redundant context builds in MonteCarloSimulator

## Status
Completed

## Goal
Reduce per-sample work by building evaluation context exactly once per sample and threading it through evaluation, failure counting, and failed leaf summaries.

## References
- reports/monte-carlo-performance-analysis-report.md (P0: redundant context building)

## Assumptions & scope validation
- `#evaluateWithTracking`, `#countFailedClauses`, and `#getFailedLeavesSummary` are only called from `simulate()` in `MonteCarloSimulator` (no external callers to update).
- The redundant builds happen exactly once in the main loop plus up to three additional times inside the helper methods for non-triggering samples with clause tracking enabled.
- The report filename in this repo is `reports/monte-carlo-performance-analysis-report.md` (not "performnce").
- Scope remains limited to P0 (redundant context builds) only; P1–P3 items from the report stay out of scope.

## File list (expected to touch)
- src/expressionDiagnostics/services/MonteCarloSimulator.js

## Work items
- Update `#evaluateWithTracking` to accept a prebuilt context instead of raw states; remove its internal `#buildContext` call.
- Update `#countFailedClauses` and `#getFailedLeavesSummary` to accept a prebuilt context and stop rebuilding it internally.
- Update `simulate()` main loop to pass the single built context to the three methods above.
- Ensure the `storedContexts` behavior remains unchanged (still stores the same context object used for evaluation).

## Out of scope
- Changes to emotion calculation logic (filtering, adapter/service APIs).
- Changes to memory sampling or percentile tracking in `HierarchicalClauseNode`.
- Any UI changes in `ExpressionDiagnosticsController`.

## Acceptance criteria
### Tests that must pass
- `npm run test:unit -- --testPathPattern="monteCarloSimulator"`
- `npm run test:integration -- --testPathPattern="expression-diagnostics"`

### Invariants that must remain true
- Simulation results (trigger rate, confidence interval, nearest miss selection) remain statistically equivalent for the same inputs.
- `storedContexts` contents match the contexts used for evaluation in the same order as before.
- No additional `#buildContext` invocations per sample beyond the single call in the main loop.

## Outcome
- Updated MonteCarloSimulator to pass a single prebuilt context into evaluation, failed clause counting, and failed leaf summaries (no internal rebuilds).
- Added a unit test to assert adapter calculations only run once per sample (current + previous) when clause tracking and nearest-miss analysis are enabled.
