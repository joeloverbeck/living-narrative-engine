# MONCARSIMIMPREP-006: Clamp-Trivial Labeling And De-Prioritization

## Summary

Detect clamp-trivial caps (gate clamps intensity to zero) and label them in the report while excluding them from worst-offender rankings by default.

## Status

Completed.

## Assumptions (Verified)

- Hierarchical breakdown leaves already expose `comparisonOperator`, `gatePassRateInRegime`, and `inRegimeMaxObservedValue` for report rendering.
- Worst-offender lists are assembled by `FailureExplainer` and passed through the blocker payload; de-prioritization should happen in the report generator (not in the explainer) to keep scope minimal.

## Priority: Medium | Effort: Medium

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/models/HierarchicalClauseNode.js` | Update |
| `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` | Update |
| `tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.clampTrivial.test.js` | Create |

## Out of Scope

- **DO NOT** change redundancy detection logic (`redundantInRegime`).
- **DO NOT** change clause evaluation or simulator sampling.
- **DO NOT** adjust `FailureExplainer` ranking logic; filter clamp-trivial clauses only at report rendering time.
- **DO NOT** remove clamp-trivial clauses from any non-offender sections.

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- --testPathPatterns=monteCarloReportGenerator.clampTrivial.test.js --coverage=false
```

### Invariants That Must Remain True

- Clamp-trivial is flagged only for leaf nodes with operator `<`/`<=`, `gatePassRateInRegime === 0` (not null), and `inRegimeMaxObservedValue === 0` (not null).
- Worst-offender ranking excludes clamp-trivial clauses unless explicitly included.
- Non-clamp clauses remain ranked as before.

## Outcome

- Added clamp-trivial detection to clause snapshots and labeled it in report outputs, including the breakdown table and blocker summary.
- Filtered clamp-trivial clauses out of worst-offender analysis by default, with an explicit opt-in flag for inclusion.
- Added unit coverage for labeling and ranking behavior.
