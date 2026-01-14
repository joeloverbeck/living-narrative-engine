# MONCARSIMIMPREP-002: OR Overlap Counters In Simulator Stats

## Summary

Instrument OR evaluation in the Monte Carlo simulator to capture per-OR-block overlap counts (union, exclusive, and pairwise) for both global and mood-regime populations. Note that OR union totals already exist via `evaluationCount`/`failureCount` on OR nodes; this ticket focuses on explicit overlap counters beyond those totals.

## Priority: High | Effort: Medium

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/MonteCarloSimulator.js` | Update |
| `src/expressionDiagnostics/models/HierarchicalClauseNode.js` | Update (for new overlap counters + in-regime variants) |
| `tests/unit/expressionDiagnostics/services/monteCarloSimulator.orOverlapStats.test.js` | Create |

## Out of Scope

- **DO NOT** render new report tables (handled in a separate ticket).
- **DO NOT** change OR pass/fail logic or evaluation outcomes.
- **DO NOT** add OR-block recommendations or impact attribution changes.
- **DO NOT** add UI components.

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- --testPathPatterns=monteCarloSimulator.orOverlapStats.test.js --coverage=false
```

### Invariants That Must Remain True

- Existing OR evaluation results and clause pass/fail counts do not change.
- Existing OR alternative counters (`orSuccessCount`, `orPassCount`, `orExclusivePassCount`) remain global-only and keep their current semantics (conditional on OR success).
- New overlap counters include global and in-regime variants with consistent naming.
- Pairwise pass counts only increment when both alternatives pass in the same sample; exclusive counts only increment when exactly one alternative passes.

## Assumptions (Reassessed)

- OR union totals are already tracked on the OR node (`evaluationCount` / `failureCount`) and do not require new counters.
- Current OR alternative counters are recorded only for global samples and only when the OR succeeds; the ticket adds explicit overlap counters (including in-regime) without changing those existing metrics.

## Status

Completed.

## Outcome

- Implemented OR block exclusive + pairwise pass counters (global + in-regime) while keeping union counts derived from existing evaluation/failure totals.
- Added a focused simulator unit test for overlap counters instead of report/UI changes originally out of scope.
