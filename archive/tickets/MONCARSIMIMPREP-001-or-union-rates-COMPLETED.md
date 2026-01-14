# MONCARSIMIMPREP-001: OR Union Rates From Actual Counts

## Summary

Replace the independence-based OR pass rate calculation (currently computed from child failure rates in the report generator) with actual OR-node union counts already tracked by the simulator. Keep mood-regime OR failure rates tied to in-regime counts, and cover with a focused unit test.

## Priority: High | Effort: Small

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` | Update |
| `tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.orUnion.test.js` | Create |

## Out of Scope

- **DO NOT** add OR overlap tables or pairwise stats (handled elsewhere).
- **DO NOT** change simulator instrumentation or evaluation counts.
- **DO NOT** add or alter recommendation logic.
- **DO NOT** modify report formatting outside the OR combined pass-rate fields.

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- --testPathPatterns=monteCarloReportGenerator.orUnion.test.js --coverage=false
```

### Invariants That Must Remain True

- OR combined pass rate equals `(evaluationCount - failureCount) / evaluationCount` within rounding tolerance, using the OR node counts from the hierarchical breakdown.
- Mood-regime OR failure rate uses the in-regime counts (no global fallback) as displayed in the OR block footer.
- Independence math is not used unless explicitly labeled as a diagnostic estimate.

## Status

Completed.

## Outcome

Used OR-node evaluation/failure counts (and in-regime counts) to compute combined OR block rates in the report generator, and added a focused unit test to lock the behavior. No report formatting changes or simulator instrumentation updates were needed beyond the count-based calculations described above.
