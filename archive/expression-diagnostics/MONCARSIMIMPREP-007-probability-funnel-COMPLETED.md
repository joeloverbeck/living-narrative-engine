# MONCARSIMIMPREP-007: Probability Funnel Section

## Summary

Add a probability funnel section to the Monte Carlo report that shows key drop-offs using existing sample counts (no resampling). The funnel should use existing per-clause gate counts and OR union counts already tracked during simulation.

## Priority: Medium | Effort: Small

## Status

Completed

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` | Update |
| `tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.probabilityFunnel.test.js` | Create |

## Out of Scope

- **DO NOT** change simulator sampling or add new counters.
- **DO NOT** alter existing blocker analysis content outside the new funnel section.
- **DO NOT** add UI or styling changes beyond plain report text.

## Assumptions & Notes

- Use `simulationResult.sampleCount`, `simulationResult.inRegimeSampleCount`, and `simulationResult.triggerCount` as the primary funnel stages.
- Gate pass counts come from existing leaf `gatePassInRegimeCount` + `inRegimeEvaluationCount` in clause hierarchy.
- OR union counts come from existing OR-node union counts (`orUnionPassInRegimeCount` / `inRegimeEvaluationCount` when available; otherwise global counts).
- "Key threshold clauses" are selected via `simulationResult.ablationImpact.clauseImpacts` when available; if missing, fall back to the most severe leaf thresholds with gate counts.

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- --testPathPatterns=monteCarloReportGenerator.probabilityFunnel.test.js --coverage=false
```

### Invariants That Must Remain True

- Funnel counts are computed from existing stats (full samples, regime pass, gate pass, OR union, final trigger).
- No additional sampling or reruns are performed in the report generator.

## Outcome

- Added a Probability Funnel subsection to the blocker analysis with sample, mood-regime, gate-pass (key thresholds), OR-union, and final trigger counts.
- Key thresholds are chosen via ablation impact when available, with a fallback to high-failure leaf thresholds that have gate counts.
