# MONCARREPINTWARSPE-002: Share Gate Evaluation Between Runtime and Diagnostics

## Summary

Eliminate duplicate gate evaluation by reusing runtime-consistent gate logic in Monte Carlo report integrity checks.

## Background

Monte Carlo report generation currently re-evaluates gates using diagnostics utilities that can drift from runtime evaluation. The spec calls for a single canonical gate evaluation path.

## File List (Expected to Touch)

### Existing Files
- `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`
- `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js`
- `src/dependencyInjection/tokens/tokens-diagnostics.js`
- `src/expressionDiagnostics/adapters/EmotionCalculatorAdapter.js`

### New Files
- `src/expressionDiagnostics/services/GateEvaluationService.js`
- `tests/unit/expressionDiagnostics/GateEvaluationService.test.js`

## Out of Scope (MUST NOT Change)

- Monte Carlo sample storage format (handled in a separate ticket).
- Markdown report content (handled in a separate ticket).
- Expression Diagnostics UI rendering (handled in separate tickets).

## Implementation Details

- Introduce a `GateEvaluationService` that wraps the runtime `EmotionCalculatorService` (via adapter if needed) to compute gate pass and post-gate final values.
- Inject and use this service in `MonteCarloReportGenerator` for integrity checks instead of re-evaluating gates with local helpers.
- Keep `GateConstraint` parsing for structure/metadata, but use the shared evaluator for pass/fail and final values.

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:unit -- --runInBand --testPathPatterns="GateEvaluationService" --coverage=false`

### Invariants That Must Remain True

1. Gate fail still implies `final === 0` for hard-gated prototypes.
2. Gate pass still implies `final === clamp01(raw)`.
3. Report integrity checks and runtime evaluation use identical normalization for all axes.
