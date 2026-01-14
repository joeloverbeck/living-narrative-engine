# MONCARREPINTWARSPE-003: Store Gate Evaluation Traces Per Sample

## Summary

Persist raw/gated/final gate traces in Monte Carlo sample contexts so reports do not need to recompute gate results.

## Background

The report currently recomputes gate pass/fail, which risks drift and makes integrity checks noisier. Storing evaluation traces per sample keeps report logic simple and consistent.

## Notes / Corrections

- `MonteCarloReportWorker` already forwards `storedContexts` without stripping fields, so no worker changes are required.
- Diagnostics gate normalization (`axisNormalizationUtils`) differs from runtime normalization in `EmotionCalculatorService`; traces must be derived from the runtime evaluator to avoid drift (see `specs/monte-carlo-report-integrity-warnings-spec.md`).

## File List (Expected to Touch)

### Existing Files
- `src/expressionDiagnostics/services/MonteCarloSimulator.js`
- `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`
- `src/expressionDiagnostics/adapters/EmotionCalculatorAdapter.js`
- `src/emotions/emotionCalculatorService.js`
- `tests/unit/expressionDiagnostics/adapters/emotionCalculatorAdapter.test.js`
- `tests/unit/expressionDiagnostics/services/monteCarloSimulator.context.test.js`
- `tests/unit/expressionDiagnostics/services/monteCarloSimulator.hierarchical.test.js`
- `tests/unit/expressionDiagnostics/services/monteCarloSimulator.populationMeta.test.js`
- `tests/unit/expressionDiagnostics/services/monteCarloSimulator.populationSummary.test.js`
- `tests/unit/expressionDiagnostics/services/monteCarloSimulator.test.js`

### New Files
- `tests/integration/expression-diagnostics/monteCarloStoredTrace.integration.test.js`

## Out of Scope (MUST NOT Change)

- Gate evaluation math (handled in a separate ticket).
- UI rendering and CSS for Expression Diagnostics.
- Data files under `data/mods/`.

## Implementation Details

- Extend stored Monte Carlo contexts to include a `gateTrace` payload per prototype:
  - `gateTrace.emotions[prototypeId]` and `gateTrace.sexualStates[prototypeId]`.
  - Each entry contains `raw`, `gatePass`, `gated`, `final` (post-hard-gate).
- Derive traces from the runtime evaluator (EmotionCalculatorService normalization + gate parsing).
- Update report generator to use stored traces for integrity checks and gate-dependent prototype stats.

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:integration -- --runInBand --testPathPatterns="monteCarloStoredTrace" --coverage=false`

### Invariants That Must Remain True

1. Stored contexts remain immutable once pushed into `storedContexts`.
2. Gate traces are derived from the same runtime evaluator used during simulation.
3. When `gatePass` is false, `final` is exactly 0 in stored traces.

## Status

Completed

## Outcome

- Stored runtime-derived gate traces for emotion/sexual prototypes in Monte Carlo contexts.
- Updated report generator to consume stored traces for gate integrity and prototype regime stats, leaving per-gate failure rates unchanged.
- Added a focused integration test for runtime-normalized gate traces and updated unit mocks/adapter coverage; no report worker changes were needed.
