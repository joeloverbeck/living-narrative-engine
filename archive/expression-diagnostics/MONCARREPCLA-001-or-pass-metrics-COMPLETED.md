# MONCARREPCLA-001: Add order-independent OR pass metrics to clause nodes and simulator

## Status
Completed

## Goal
Capture order-independent OR alternative pass and exclusive-pass rates in the hierarchical clause tree while preserving the existing order-dependent first-pass contribution signal.

## File list (expected to touch)
- src/expressionDiagnostics/models/HierarchicalClauseNode.js
- src/expressionDiagnostics/services/MonteCarloSimulator.js
- tests/unit/expressionDiagnostics/models/HierarchicalClauseNode.test.js
- tests/unit/expressionDiagnostics/services/monteCarloSimulator.hierarchical.test.js

## Assumptions (updated)
- `HierarchicalClauseNode.fromJSON()` currently restores only evaluation-based stats; OR counters are not restored today.
- `MonteCarloSimulator` already calls `recordOrSuccess()` for each child when an OR succeeds; the new work should preserve that behavior.
- Existing tests cover OR first-pass contribution but do not cover order-independent OR pass/exclusive counters or rates.

## Work items
- Extend `HierarchicalClauseNode` with counters for `orPassCount` and `orExclusivePassCount`, plus getters and `toJSON()` fields for `orPassRate` and `orExclusivePassRate` (null when `orSuccessCount` is 0).
- Ensure new counters default to 0. Update `fromJSON()` to restore OR counters when present (including existing `orContributionCount`/`orSuccessCount`) while remaining backward-compatible with older payloads that omit them.
- Update the OR evaluation branch in `MonteCarloSimulator` to:
  - call existing `recordOrSuccess()` per child on OR success,
  - call `recordOrPass()` for each passing child,
  - call `recordOrExclusivePass()` when a child passes and all sibling alternatives failed,
  - keep `recordOrContribution()` for the first-pass order-dependent metric.
- Add/adjust unit coverage for new counters and rates in clause serialization and simulator hierarchical tracking.

## Out of scope
- Any report text, table, or UI changes.
- Changes to Monte Carlo sampling logic or distributions.
- Changes to non-OR clause statistics.
- Broader report/UI updates described in `specs/monte-carlo-report-clarifications.md` outside of OR clause metrics.

## Acceptance criteria
### Tests that must pass
- `npm run test:unit -- --testPathPatterns="HierarchicalClauseNode" --coverage=false`
- `npm run test:unit -- --testPathPatterns="monteCarloSimulator.hierarchical" --coverage=false`

### Invariants that must remain true
- Existing JSON fields and counters on `HierarchicalClauseNode` remain intact and backwards-compatible.
- Order-dependent first-pass contribution continues to be recorded exactly as before.
- New OR pass/exclusive rates return `null` when `orSuccessCount` is 0.

## Outcome
- Added order-independent OR pass/exclusive counters with rates, plus `fromJSON()` restoration alongside existing OR counters.
- Simulator OR branch now records pass and exclusive-pass signals while preserving first-pass contribution behavior.
- Updated unit coverage for serialization, rate calculations, and OR tracking; no report/UI changes were made.
