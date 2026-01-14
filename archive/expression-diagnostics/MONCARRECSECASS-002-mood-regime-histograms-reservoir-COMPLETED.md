# MONCARRECSECASS-002: Mood-Regime Axis Histograms + Sample Reservoir

## Summary

Collect axis distributions and an optional sample reservoir for mood-regime samples so downstream recommendation logic can compute fraction-below/above, quantiles, keep ratios, and replay-based predictions.

## Priority: High | Effort: Medium

## Rationale

The new recommendation requires authoritative statistics inside the mood regime (fraction below gate, quantiles, and keepRatio). These do not exist today and must be collected during simulation in a structured, bounded way.

## Dependencies

- None. `MonteCarloSimulator` already builds a gate clamp regime plan containing `trackedGateAxes`.

## File List It Expects To Touch

| File | Change Type |
| --- | --- |
| `src/expressionDiagnostics/services/MonteCarloSimulator.js` | **Update** (collect histograms and reservoir for in-regime samples) |
| `tests/unit/expressionDiagnostics/services/monteCarloSimulatorHistograms.test.js` | **Add** (unit coverage for histogram + reservoir invariants) |

## Out of Scope

- **DO NOT** emit recommendations or change recommendation facts
- **DO NOT** change report rendering or UI
- **DO NOT** alter existing gate pass/clamp accounting
- **DO NOT** add implication logic or quantile math here

## Implementation Details

- Use `trackedGateAxes` from the existing gate clamp plan to limit collection.
- Track histograms inside the mood regime with raw context values:
  - Mood axes: integer buckets for `[-100..100]` (201 bins).
  - Sexual axes: `sex_excitation` and `sex_inhibition` in `[0..100]` (101 bins),
    `baseline_libido` in `[-50..50]` (101 bins).
  - Affect traits: integer buckets for `[0..100]` (101 bins).
  - Derived axes (e.g., `sexual_arousal`): bucketed on `[0..1]` with 101 bins
    (store the raw derived value in the reservoir).
- Record the number of in-regime samples used to build each histogram.
- Maintain an optional in-regime sample reservoir (bounded size) with raw axis values
  as represented in the evaluation context. Downstream code can normalize if needed
  (mood/traits/sexual axes use `/100`; `sexual_arousal` is already `[0..1]`).
- Attach to `SimulationResult`:
- `moodRegimeAxisHistograms`
- `moodRegimeSampleReservoir` (including `sampleCount`, `storedCount`, and cap metadata)

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- --testPathPatterns monteCarloSimulatorHistograms --coverage=false
```

### Invariants That Must Remain True

- For each tracked axis histogram: `sum(bins) === histogram.sampleCount`.
- `histogram.sampleCount` equals the number of in-regime samples evaluated for that axis.
- Reservoir `storedCount` never exceeds configured cap; recorded `sampleCount` reflects total in-regime samples.
- Existing Monte Carlo output fields remain unchanged unless explicitly extended.

## Status

Completed.

## Outcome

- Implemented mood-regime histogram + reservoir collection in `MonteCarloSimulator`, including axis-specific ranges for baseline libido and derived sexual arousal, plus a reservoir cap config.
- Added a focused unit test for histogram binning and reservoir counts; no changes needed to `RandomStateGenerator` or `axisNormalizationUtils` beyond the simulator logic.
