# MONCARREGAWAREP-001: Regime-aware Monte Carlo payload fields

## Status
Completed

## Goal
Extend Monte Carlo simulation output to include regime-aware feasibility metrics, gate compatibility, redundancy, and tuning direction data needed by the report/UI.

## File list (expected to touch)
- src/expressionDiagnostics/services/MonteCarloSimulator.js
- src/expressionDiagnostics/models/HierarchicalClauseNode.js
- tests/unit/expressionDiagnostics/services/monteCarloSimulator.test.js

## Work items
- Compute achievable ranges (min/max) for global and mood-pass (in-regime) samples per leaf clause in the hierarchical breakdown; surface a clause-level range only when the prerequisite is a single leaf.
- Add in-regime pass/fail rates alongside existing global rates in the Monte Carlo results payload (clause-level + hierarchical breakdown).
- Derive regime redundancy flags using in-regime min/max and the clause operator (leaf-only; null for compound nodes).
- Compute tuning direction labels from the operator (>= vs <=, or >/<) and include them with clause summaries.
- Add per-prototype gate compatibility verdicts (true/false) plus a reason string when incompatible, based on the expression's mood-regime axis bounds.
- Preserve existing payload shape for consumers not yet migrated by adding new fields rather than renaming/removing old ones.

## Out of scope
- Changes to sampling distributions or sample sizes.
- Any report formatting or UI presentation changes.
- Static analyzer changes (GateConstraintAnalyzer / IntensityBoundsCalculator).
- Implementation of the near-hit regime metrics.

## Acceptance criteria
### Tests that must pass
- `npm run test:unit -- --testPathPatterns="monteCarloSimulator" --coverage=false`
- `npm run test:integration -- --testPathPatterns="expression-diagnostics/monteCarloReport" --coverage=false`

### Invariants that must remain true
- Monte Carlo sampling count, distribution type, and random state generation remain unchanged.
- Existing consumers of Monte Carlo results continue to work without updates.
- Global (unconditional) metrics remain identical to pre-change behavior.

## Outcome
- Implemented in-regime rates, achievable ranges, redundancy flags, and tuning directions in the Monte Carlo payload (leaf clauses only) plus gate compatibility summaries for referenced prototypes.
- Kept scope to MonteCarloSimulator/HierarchicalClauseNode payload additions and added focused unit tests; no UI/report formatting changes.
