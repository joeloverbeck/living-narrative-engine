# MONCARRECINT-001: Axis Constraint Sources + Deterministic Conflict Metrics

## Summary

Persist source clauses for axis constraints, compute deterministic conflict metrics (default bounds + lost magnitude) in `PrototypeConstraintAnalyzer`, then surface them via `RecommendationFactsBuilder`. Conflict detection should trigger whenever a constraint narrows the default bounds (not only when it crosses zero).

## Background

The Monte Carlo recommendation integrity spec requires axis conflicts to be traceable to prerequisite clauses and to include deterministic lost magnitude values based on axis defaults.

## File List (Expected to Touch)

### Existing Files
- `src/expressionDiagnostics/services/PrototypeConstraintAnalyzer.js`
- `src/expressionDiagnostics/services/RecommendationFactsBuilder.js`
- `tests/unit/expressionDiagnostics/services/diagnosticFactsBuilder.test.js`

### New Files
- `tests/unit/expressionDiagnostics/services/prototypeConstraintAnalyzer.axisConflicts.test.js`

## Out of Scope (MUST NOT Change)

- Monte Carlo sampling distributions or RNG setup.
- UI/report formatting in `src/domUI/` or `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`.
- Any expression data under `data/mods/`.

## Implementation Details

- Extend axis constraint extraction to retain `sources` with `{ varPath, operator, threshold }` from prerequisite clauses (append all contributing clauses per axis).
- Conflict type detection must compare against axis defaults: `constraintMax < defaultMax` for positive weights and `constraintMin > defaultMin` for negative weights (no zero-crossing gate).
- Use axis default bounds (not hard-coded `[-1, 1]`) when computing lost magnitude.
- Add `defaultMin`, `defaultMax`, `lostRawSum`, and `lostIntensity` to `axisAnalysis` entries (include `sources` from the axis constraint where available).
- Propagate `sources`, `lostRawSum`, and `lostIntensity` into `RecommendationFactsBuilder` axis conflict output (use analyzer-provided values; do not recompute in the builder).

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:unit -- --runInBand --testPathPatterns="prototypeConstraintAnalyzer.axisConflicts" --coverage=false`
2. `npm run test:unit -- --runInBand --testPathPatterns="diagnosticFactsBuilder" --coverage=false`

### Invariants That Must Remain True

1. Axis conflict detection is only based on axis defaults + prerequisite bounds (no mood-only hard-coding).
2. `lostRawSum` is never negative and never exceeds the axis span contribution from that weight.
3. `lostIntensity` is only computed when `sumAbsWeights > 0` and remains in `[0, 1]`.

## Status

Completed

## Outcome

- Axis constraints now retain source clauses, and axis analysis carries default bounds plus lost-magnitude fields.
- Conflict detection now triggers whenever constraints narrow defaults (not only when crossing zero).
- Recommendation facts now surface sources and lost-magnitude values (no builder-side recomputation).
- Added focused axis conflict unit tests and updated diagnostic facts coverage.
