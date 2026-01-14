# MONCARRECSECASS-001: Gate Axis Analysis Plan for Mood-Regime Recommendations

## Summary

Add a pre-pass analysis step that identifies which emotion/sexual-threshold clauses have gate predicates that can clamp them, and derive the set of gate axes to track during Monte Carlo simulation. Persist the analysis plan on the simulation result for downstream histogram and recommendation work.

## Priority: High | Effort: Medium

## Rationale

The new “gate-clamp regime permissive” recommendation needs to know which gate predicates apply to each emotion/sexual-threshold clause and which axes are involved. Today we only get gate outcomes, not the per-clause gate predicate metadata required to compute implied-vs-non-implied gates or axis histograms.

## Dependencies

- None (foundational data plumbing for later tickets)

## File List It Expects To Touch

| File | Change Type |
| --- | --- |
| `src/expressionDiagnostics/services/MonteCarloSimulator.js` | **Update** (build and attach analysis plan to `SimulationResult`) |
| `tests/unit/expressionDiagnostics/services/monteCarloSimulatorAnalysisPlan.test.js` | **Add** (plan generation coverage) |

## Out of Scope

- **DO NOT** add histogram collection or reservoir sampling
- **DO NOT** emit recommendations or change report rendering
- **DO NOT** alter Monte Carlo evaluation logic or gate pass/clamp counters
- **DO NOT** introduce new thresholds/heuristics for emission

## Implementation Details

- Detect leaf emotion/sexual-threshold clauses (e.g., `emotions.X >= t`, `sexualStates.Y >= t`) during simulator setup.
- Use existing threshold metadata on `HierarchicalClauseNode` (already collected during clause tree creation) rather than adding new analyzer plumbing; `PrototypeConstraintAnalyzer` already exposes parsed gate metadata via `gateStatus.gates`.
- For each clause, resolve its prototype gates and normalize each gate predicate into a structure like:
  - `axis` (e.g., `valence`, `arousal`, `sexual_arousal`, `affective_empathy`)
  - `operator` (`>=`, `<=`, `>`, `<`)
  - `thresholdNormalized` in the same normalized scale used by gate evaluation
  - `thresholdRaw` in the same raw scale as expression prerequisites when a clear mapping exists (mood/sexual/trait axes scale from normalized * 100; derived axes like `sexual_arousal` stay in [0..1]; set to null if unmapped).
- Produce a plan object on the simulation result (e.g., `gateClampRegimePlan`):
  - `trackedGateAxes`: unique, stable-sorted list of axes to histogram
- `clauseGateMap`: `clauseId -> { prototypeId, type, usePrevious, gatePredicates: [...] }`

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- --testPathPatterns monteCarloSimulatorAnalysisPlan --coverage=false
```

### Invariants That Must Remain True

- Each entry in `clauseGateMap` only includes gate predicates derived from the clause’s linked prototype.
- `trackedGateAxes` is a unique set derived from `clauseGateMap` (no extras, no missing axes).
- No changes to existing `gatePassCount`, `gateFailCount`, or `gateClampRateInRegime` calculations.

## Status

Completed.

## Outcome

- Added `gateClampRegimePlan` on Monte Carlo simulation results with per-clause gate predicate metadata and tracked axes, using existing clause-tree threshold metadata.
- Added unit coverage for the analysis plan output; no updates were required in `PrototypeConstraintAnalyzer` or `moodRegimeUtils`.
