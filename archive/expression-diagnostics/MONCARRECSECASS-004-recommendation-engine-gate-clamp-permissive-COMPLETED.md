# MONCARRECSECASS-004: Recommendation Engine Emission for Gate-Clamp Regime Permissive

## Summary

Add a new recommendation type that emits when mood-regime gate clamp rates are high and the regime does not imply the gate predicates, using the existing gate-clamp fact payloads from `RecommendationFactsBuilder`.

## Priority: High | Effort: Medium

## Rationale

This is the core logic for “You allow mood states where X is gate-clamped to zero,” and must be deterministic, thresholded, and invariant-driven.

## Dependencies

- **MONCARRECSECASS-003** (already landed: gate-clamp facts + invariants available)

## File List It Expects To Touch

| File | Change Type |
| --- | --- |
| `src/expressionDiagnostics/services/RecommendationEngine.js` | **Update** (new recommendation type, constants, sorting impact) |
| `tests/unit/expressionDiagnostics/services/recommendationEngine.test.js` | **Update** (new unit tests for emission rules) |

## Out of Scope

- **DO NOT** change report rendering or HTML
- **DO NOT** alter Monte Carlo simulation or histogram collection
- **DO NOT** update integration tests in this ticket

## Implementation Details

- `RecommendationFactsBuilder` already emits `gateClampRegimePermissive` facts (including axis histograms, regime implication flags, and candidate predictions) with unit coverage in `tests/unit/expressionDiagnostics/services/recommendationFactsBuilderGateClamp.test.js`. This ticket should not modify that builder.
- Introduce a new recommendation `type`, e.g. `gate_clamp_regime_permissive`.
- Emit only when all of the following are true:
  - `gateClampRateInRegime >= MIN_CLAMP_RATE` (default 0.20)
  - At least one gate predicate is not implied by regime bounds
  - Candidate constraint yields `keepRatio >= MIN_KEEP` (default 0.50) and `predClampRate <= clampRate - MIN_DELTA` (default 0.10)
  - Proposed constraint is not already present and not weaker than existing bounds
- Provide evidence lines with denominators and the per-axis fraction-below/above gate.

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- --testPathPatterns recommendationEngine --coverage=false
```

### Invariants That Must Remain True

- Recommendations are suppressed when `diagnosticFacts.invariants` contains failures.
- Emitted recommendations include `relatedClauseIds` and a stable `id` prefix for the new type.
- Confidence classification still uses mood-regime sample counts (no regression to global sample counts).

## Status

Completed.

## Outcome

- Implemented gate-clamp permissive recommendation emission in `RecommendationEngine`, selecting candidates by clamp-rate improvement and keep ratio with per-axis evidence lines that include denominators.
- Added unit tests to cover emission and redundant-constraint suppression for the new recommendation type.
- No changes were required in `RecommendationFactsBuilder` because gate-clamp facts and invariants were already present from MONCARRECSECASS-003.
