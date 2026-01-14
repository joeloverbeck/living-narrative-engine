# MONCARRECSEC-002: Clause Normalization + Logic Tree Tracking

## Summary

Normalize atomic clause IDs deterministically and capture per-sample atom truth values for logic tree evaluation reuse.

## Priority: High | Effort: Medium

## Files to Touch

| File | Change Type |
| --- | --- |
| `src/expressionDiagnostics/services/ClauseNormalizer.js` | Create |
| `src/expressionDiagnostics/services/MonteCarloSimulator.js` | Update |
| `src/expressionDiagnostics/models/HierarchicalClauseNode.js` | Update |
| `tests/unit/expressionDiagnostics/services/monteCarloSimulator.clauseNormalization.test.js` | Create |
| `tests/unit/expressionDiagnostics/services/monteCarloSimulator.logicTreeAtomTracking.test.js` | Create |

## Out of Scope

- Do not change expression schemas or JSON-Logic formats.
- Do not modify UI rendering or report generation.
- Do not introduce non-deterministic IDs.

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- --testPathPatterns clauseNormalization --coverage=false
npm run test:unit -- --testPathPatterns logicTreeAtomTracking --coverage=false
```

### Invariants That Must Remain True

- Clause IDs are stable across runs given identical input.
- Compound clauses are marked `clauseType: 'compound'` when not decomposable.
- Logic tree evaluation uses atom truth values without re-evaluating atom predicates.

## Implementation Notes

- Normalize atomic clauses for `>=`, `<=`, delta clauses, and axis-direction constraints.
- Rewrite compound `max([...]) < c` into children when possible; otherwise derive ID from JSON-Logic path.
- Store a per-sample boolean map keyed by `clauseId` during hierarchical evaluation to avoid re-running atom predicates.
- Persist `clauseId` and `clauseType` on `HierarchicalClauseNode` leaves; keep path-based `id` unchanged.

## Status

Completed.

## Outcome

- Implemented `ClauseNormalizer` and wired it into `MonteCarloSimulator` + `HierarchicalClauseNode` metadata instead of adding a standalone LogicTreeEvaluator.
- Added max `<` decomposition plus deterministic `clauseId`/`clauseType` on hierarchical leaves; atom truth values are reused per sample via a map.
- Tests live under `tests/unit/expressionDiagnostics/services/` and `tests/unit/expressionDiagnostics/models/` rather than a new `tests/unit/monteCarlo/` directory.
