# MONCARRECSEC-004: DiagnosticFacts Builder + Invariant Checks

## Summary

Build a normalized `DiagnosticFacts` object from Monte Carlo simulator results and validate the probability invariants before recommendations run.

## Priority: High | Effort: Medium

## Files to Touch

| File | Change Type |
| --- | --- |
| `src/expressionDiagnostics/services/RecommendationFactsBuilder.js` | Create |
| `src/expressionDiagnostics/services/InvariantValidator.js` | Create |
| `src/expressionDiagnostics/services/index.js` | Update |
| `tests/unit/expressionDiagnostics/services/diagnosticFactsBuilder.test.js` | Create |
| `tests/unit/expressionDiagnostics/services/invariantValidator.test.js` | Create |

## Out of Scope

- Do not render UI or report output.
- Do not add additional recommendation rules.
- Do not change Monte Carlo sampling behavior.
- Do not introduce a new MonteCarlo diagnostics orchestrator (no such service exists yet).

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- --testPathPatterns diagnosticFactsBuilder --coverage=false
npm run test:unit -- --testPathPatterns invariantValidator --coverage=false
```

### Invariants That Must Remain True

- `0 <= rate <= 1` for all computed rates.
- `gatePassCount <= moodSampleCount` and `thresholdPassCount <= gatePassCount`.
- `pThreshEffective == gatePassRate * pThreshGivenGate` within epsilon.
- Invariant violations are surfaced in `DiagnosticFacts.invariants` and suppress recommendations downstream.

## Assumptions + Scope Updates

- The builder consumes `MonteCarloSimulator` output (`clauseFailures`, `ablationImpact`, `prototypeEvaluationSummary`, `gateCompatibility`) plus the source expression; there is no `MonteCarloDiagnosticsService` to update.
- `compatibilityScore` is derived from `gateCompatibility` (1 for compatible, -1 for incompatible, 0 when unavailable) until a continuous score is specified.
- `avgViolationInMood` uses the existing `averageViolation` because in-regime averages are not currently tracked.
- Prototype threshold pass counts come from the selected prototype-linked leaf clause’s gate pass/pass counts; if multiple clauses target a prototype, pick the one with the highest `gatePassInRegimeCount` (tie-breaker: `clauseId`).
- Clause impact uses `ablationImpact` when present; when missing, impact defaults to 0.

## Implementation Notes

- Compute clause impact, conditional fail rate (sibling-conditioned when available), and near-miss rate.
- Summarize failed gate counts as `{ gateId, count }` sorted by count desc.
- Record invariants on the `DiagnosticFacts` payload for downstream gating.

## Status

Completed.

## Outcome

- Added a `RecommendationFactsBuilder` and `InvariantValidator`, exported via services index.
- Builder consumes MonteCarlo simulator output + expression data, using gate compatibility as a boolean-derived `compatibilityScore`.
- Added unit tests for builder output and invariant violations; no report/UI integration yet.
