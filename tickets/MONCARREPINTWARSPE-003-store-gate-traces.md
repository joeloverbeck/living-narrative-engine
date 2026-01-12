# MONCARREPINTWARSPE-003: Store Gate Evaluation Traces Per Sample

## Summary

Persist raw/gated/final gate traces in Monte Carlo sample contexts so reports do not need to recompute gate results.

## Background

The report currently recomputes gate pass/fail, which risks drift and makes integrity checks noisier. Storing evaluation traces per sample keeps report logic simple and consistent.

## File List (Expected to Touch)

### Existing Files
- `src/expressionDiagnostics/services/MonteCarloSimulator.js`
- `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`
- `src/expressionDiagnostics/workers/MonteCarloReportWorker.js`

### New Files
- `tests/integration/expressionDiagnostics/monteCarloStoredTrace.test.js`

## Out of Scope (MUST NOT Change)

- Gate evaluation math (handled in a separate ticket).
- UI rendering and CSS for Expression Diagnostics.
- Data files under `data/mods/`.

## Implementation Details

- Extend stored Monte Carlo contexts to include a `gateTrace` payload per prototype:
  - `raw`, `gatePass`, `gated`, `final` (post-hard-gate).
- Update report generator to use stored traces for integrity checks and report sections that need gate detail.
- Ensure report worker passes through the enriched simulation result without stripping the trace.

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:integration -- --runInBand --testPathPatterns="monteCarloStoredTrace" --coverage=false`

### Invariants That Must Remain True

1. Stored contexts remain immutable once pushed into `storedContexts`.
2. Gate traces are derived from the same runtime evaluator used during simulation.
3. When `gatePass` is false, `final` is exactly 0 in stored traces.
