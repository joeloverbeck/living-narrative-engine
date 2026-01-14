# MONCARSIMIMPREP-003: OR Overlap Table In Report

## Summary

Add an OR overlap section to the Monte Carlo report using existing OR-node counters to display absolute union, exclusive, and overlap rates for global and mood-regime populations.

## Priority: Medium-High | Effort: Medium

## Status: Completed

## Dependencies

- **MONCARSIMIMPREP-002** (OR overlap counters already recorded on OR nodes)

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` | Update |
| `tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.orOverlap.test.js` | Create |

## Assumptions (Reassessed)

- OR union counts are derived from `evaluationCount - failureCount` on the OR node (exported as `orUnionPassCount`), not from `orPassCount`.
- Per-alternative `orPassCount` / `orExclusivePassCount` are global-only. In-regime exclusive/overlap is available at the OR-node level (`orBlockExclusivePassInRegimeCount`, `orPairPassInRegimeCounts`), not per child.

## Out of Scope

- **DO NOT** modify simulator evaluation or add new counters.
- **DO NOT** change existing OR pass-rate fields outside the overlap section.
- **DO NOT** alter recommendation logic.
- **DO NOT** change layout/styling beyond the new section content.

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- --testPathPatterns=monteCarloReportGenerator.orOverlap.test.js --coverage=false
```

### Invariants That Must Remain True

- Reported `union` equals `(evaluationCount - failureCount) / evaluationCount` for the OR node (global) and `(inRegimeEvaluationCount - inRegimeFailureCount) / inRegimeEvaluationCount` when available.
- `sum(exclusive) <= union` and `union == sum(exclusive) + overlapMass` within epsilon (global uses child exclusive counts; in-regime uses OR-node exclusive count).
- Overlap rates use `orPairPassCounts` / `orPairPassInRegimeCounts`, not independence math.

## Outcome

- Added an OR overlap table with absolute union/exclusive/overlap rates for global and mood-regime populations.
- Included top overlap pair reporting from recorded pairwise counts; per-alternative in-regime exclusives were not added because those counters are not recorded.
