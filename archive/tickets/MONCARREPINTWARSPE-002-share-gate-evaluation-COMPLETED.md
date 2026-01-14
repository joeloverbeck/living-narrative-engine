# MONCARREPINTWARSPE-002: Align Gate Evaluation Between Runtime and Diagnostics

## Summary

Ensure Monte Carlo report integrity checks use runtime-consistent axis normalization so gate evaluation matches the runtime calculator.

## Background

Monte Carlo report generation re-evaluates gates using diagnostics utilities. The spec shows those utilities normalize axes differently from `EmotionCalculatorService`, which can cause gate mismatches. There is no public runtime gate-evaluation API to call directly, so the safest path is to make diagnostics normalization match runtime behavior.

## File List (Expected to Touch)

### Existing Files
- `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`
- `src/expressionDiagnostics/services/MonteCarloSimulator.js`
- `src/expressionDiagnostics/utils/axisNormalizationUtils.js`

### New Files
- None.

## Out of Scope (MUST NOT Change)

- Monte Carlo sample storage format (handled in a separate ticket).
- Markdown report content (handled in a separate ticket).
- Expression Diagnostics UI rendering (handled in separate tickets).

## Implementation Details

- Align diagnostics axis normalization with `EmotionCalculatorService` (no "already normalized" shortcuts for axes in [-1, 1]).
- Keep `GateConstraint` parsing for structure/metadata; gate pass/fail should use the normalized axes that now match runtime behavior.

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:unit -- --runInBand --testPathPatterns="axisNormalizationUtils" --coverage=false`

### Invariants That Must Remain True

1. Gate fail still implies `final === 0` for hard-gated prototypes.
2. Gate pass still implies `final === clamp01(raw)`.
3. Report integrity checks and runtime evaluation use identical normalization for all axes (mood, sexual, affect traits).

## Status

Completed.

## Outcome

Aligned diagnostics axis normalization with runtime expectations and added unit coverage for small-value normalization; no new gate-evaluation service was introduced.
