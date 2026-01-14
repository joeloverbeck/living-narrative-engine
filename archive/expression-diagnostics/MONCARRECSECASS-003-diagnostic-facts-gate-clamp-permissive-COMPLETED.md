# MONCARRECSECASS-003: Diagnostic Facts for Gate-Clamp Regime Permissive

## Summary

Extend `RecommendationFactsBuilder` to compute per-clause gate-clamp regime evidence (fraction below/above gate, proposed constraint candidates, keep ratios, and replay predictions) using the *existing* gate-clamp plan plus mood-regime histograms/reservoir already emitted by the simulator.

## Priority: High | Effort: Medium

## Rationale

The RecommendationEngine needs structured, invariant-validated facts to emit the new “regime too permissive” recommendation without duplicating heavy logic or sampling.

## Dependencies

- **MONCARRECSECASS-001** is already satisfied by the gate-clamp plan emitted in `MonteCarloSimulator`.
- **MONCARRECSECASS-002** already shipped histogram/reservoir data; no simulator changes required here.

## File List It Expects To Touch

| File | Change Type |
| --- | --- |
| `src/expressionDiagnostics/services/RecommendationFactsBuilder.js` | **Update** (new fact builder for gate-clamp permissive) |
| `src/expressionDiagnostics/services/InvariantValidator.js` | **Update** (new invariants for histograms, implication checks, quantiles) |
| `tests/unit/expressionDiagnostics/services/recommendationFactsBuilderGateClamp.test.js` | **Add** (unit coverage for gate-clamp permissive facts) |

## Out of Scope

- **DO NOT** emit recommendations or change rendering
- **DO NOT** modify Monte Carlo simulation loops
- **DO NOT** change existing recommendation types
- **DO NOT** add UI changes or HTML updates

## Implementation Details

- Add a fact payload per clause (e.g., `gateClampRegimePermissive`) that includes:
  - `gateClampRateInRegime`, `gateFailInRegimeCount`, `moodRegimeCount`
  - `gatePredicates` with implication status vs current regime bounds
  - `axisEvidence`: fractionBelowG / fractionAboveG with denominators
  - Candidate constraints (hard and optional soft) with `keepRatio`
  - Replay predictions: `predClampRate`, `predPassRate` (optional), `predSampleCount`
- Use histogram-derived quantiles for soft alignment (if enabled).
- If a reservoir is missing, fall back to single-axis keepRatio from histogram only (no multi-axis replay).

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- --testPathPatterns recommendationFactsBuilderGateClamp --coverage=false
```

### Invariants That Must Remain True

- `gatePassCount + gateFailCount === moodRegimeCount` for each leaf emotion clause.
- If all gate predicates are implied by regime bounds, the fact builder must mark `allGatesImplied` and avoid producing candidate constraints.
- Histogram-based fractions always use the mood-regime denominator, not global sample counts.
- Quantile monotonicity holds for any computed quantiles.

## Status

Completed.

## Outcome

- Implemented gate-clamp permissive facts in `RecommendationFactsBuilder` using existing gate-clamp plan + regime histograms/reservoir, with implication checks, axis evidence, and candidate/replay metrics.
- Added invariants for gate pass/fail counts and quantile monotonicity; no axis normalization helpers or simulator changes were needed.
- Added unit tests covering replay predictions, implied-gate suppression, and histogram-only keep ratios.
