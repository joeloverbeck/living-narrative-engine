# MONCARRECINT-004: Gate Incompatibility Semantics for <= Clauses

## Summary

Treat gate incompatibility as benign for `<=`/`<` clauses and suppress the recommendation; keep blocking semantics for `>=`/`>`.

## Background

The spec clarifies that clamping to 0 makes `<=`/`<` clauses non-blocking, so they should not emit gate incompatibility recommendations or show blocking badges. Gate incompatibility is computed at the prototype/regime level (via `gateCompatibility`), so UI/report summaries must cross-reference clause operators to classify incompatibilities as benign vs blocking.

## File List (Expected to Touch)

### Existing Files
- `src/expressionDiagnostics/services/RecommendationEngine.js`
- `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`
- `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js`
- `tests/unit/expressionDiagnostics/services/recommendationEngine.test.js`

## Out of Scope (MUST NOT Change)

- Gate clamp analysis plan construction in `src/expressionDiagnostics/services/MonteCarloSimulator.js`.
- Sampling coverage calculations.
- UI layout/structure beyond labels/badges for gate incompatibility.

## Implementation Details

- Skip `gate_incompatibility` recommendations for `<=`/`<` clauses.
- Where gate incompatibility is still referenced in static summaries, label it as benign for `<=` clauses or omit blocking badges by matching gate-compatibility entries to clause operators (from prerequisites/blockers).
- Preserve existing blocking semantics for `>=`/`>`.

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:unit -- --runInBand --testPathPatterns="recommendationEngine" --coverage=false`

### Invariants That Must Remain True

1. `>=`/`>` gate incompatibility remains blocking/critical.
2. `<=`/`<` gate incompatibility is non-blocking and does not generate recommendations.
3. No changes to gate clamp rate computations.

## Status

Completed.

## Outcome

- Implemented operator-aware gate incompatibility handling in recommendations, report blocks, and UI warnings (benign for `<=`/`<`).
- Added a unit test to ensure `<=` clauses do not emit gate incompatibility recommendations.
