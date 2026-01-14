# MONCARRECSEC-001: Prototype Evaluation Output + Gate Aggregation

## Summary

Add deterministic prototype evaluation aggregation (gate pass/fail counts, failed gate frequency, raw/value sums) for referenced prototypes without storing per-sample history.

## Priority: High | Effort: Medium

## Assumptions Corrected (as of current mainline)

- `MonteCarloSimulator` lives at `src/expressionDiagnostics/services/MonteCarloSimulator.js` (not `src/expressionDiagnostics/`).
- There is no `MonteCarloEvaluator.js` in the repo; simulator and report generator cover evaluation needs today.
- Per-sample prototype signals already exist via `EmotionCalculatorService` traces, but they are only stored when `storeSamplesForSensitivity` is enabled; this ticket adds streaming aggregation without storing arrays.

## Files to Touch

| File | Change Type |
| --- | --- |
| `src/expressionDiagnostics/services/MonteCarloSimulator.js` | Update |
| `src/expressionDiagnostics/utils/intensitySignalUtils.js` (optional helper) | Update |
| `tests/unit/expressionDiagnostics/services/monteCarloSimulator.prototypeGatingAggregation.test.js` | Create |

## Out of Scope

- Do not change sampling strategy, RNG, or sample counts.
- Do not add UI or report output.
- Do not add additional recommendation types.
- Do not persist per-sample arrays beyond the aggregation counters.
- Do not expand prototype reference extraction beyond current emotion/sexual variables in prerequisites.

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- --testPathPatterns prototypeGatingAggregation --coverage=false
```

### Invariants That Must Remain True

- `gatePassCount + gateFailCount == moodSampleCount` per prototype.
- `failedGates` aggregation counts sum to `gateFailCount`.
- `0 <= gateFailRate <= 1` for each prototype.

## Implementation Notes

- Required per-sample evaluation details per prototype: `gatesPassed`, `failedGates`, `rawScore`, `value`.
- Aggregate in streaming fashion: increment counters and failed gate frequency map per sample; do not store per-sample arrays.
- Use shared axis normalization + gate parsing to keep gate logic consistent with runtime traces.

## Status

Completed.

## Outcome

- Added streaming prototype gate aggregation in `MonteCarloSimulator` and surfaced `prototypeEvaluationSummary` in simulation results.
- Added unit coverage for gate pass/fail totals, failed gate counts, and raw/value sums; no separate evaluator service was required.
