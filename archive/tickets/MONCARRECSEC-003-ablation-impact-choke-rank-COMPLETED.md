# MONCARRECSEC-003: Ablation Impact + Choke Ranking

## Summary

Compute clause ablation impact and enforce monotonicity for forced-TRUE evaluation, producing a deterministic choke rank order using the existing hierarchical clause trees built in the Monte Carlo simulator.

## Priority: High | Effort: Medium

## Files to Touch

| File | Change Type |
| --- | --- |
| `src/expressionDiagnostics/services/AblationImpactCalculator.js` | Create |
| `src/expressionDiagnostics/services/MonteCarloSimulator.js` | Update |
| `tests/unit/expressionDiagnostics/services/monteCarloSimulator.ablationImpact.test.js` | Create |

## Out of Scope

- Do not alter base pass/fail scoring.
- Do not add UI or report formatting.
- Do not compute recommendations in this ticket.

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- --testPathPatterns ablationImpact --coverage=false
```

### Invariants That Must Remain True

- For each clause, `passWithoutC >= passOriginal`.
- Forcing TRUE for an AND subtree never reduces pass rate.
- Impact values are deterministic for a given Monte Carlo result.

## Implementation Notes

- Use `HierarchicalClauseNode` trees already produced by `MonteCarloSimulator` to evaluate forced-TRUE passes without introducing a new LogicTreeEvaluator service.
- Evaluate logic trees with clause forced TRUE using cached atom results from the per-sample map.
- Store impact for atomic clauses and top-level subtrees in the Monte Carlo simulation result payload.
- Provide a stable choke rank by sorting on impact descending with deterministic tiebreak (clauseId).

## Status

Completed.

## Outcome

- Added ablation impact computation using hierarchical clause trees and cached atom results.
- Exposed ablation impact and choke rank data on Monte Carlo simulation results (no UI/report changes).
- Added unit coverage for deterministic impacts and ranking.
