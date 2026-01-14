# MONCARREPINTWARSPE-001: Align Diagnostics Normalization With Runtime

## Summary

Make diagnostics normalization match runtime normalization so Monte Carlo integrity checks do not diverge on mood-axis values near zero (e.g., -1, 0, 1).

## Background

Diagnostics currently treat values in [-1, 1] as already-normalized for mood axes, while runtime always divides mood axes by 100. This mismatch can flip gate pass/fail and create false I1 warnings.

## File List (Expected to Touch)

### Existing Files
- `src/expressionDiagnostics/utils/axisNormalizationUtils.js`
- `src/expressionDiagnostics/services/MonteCarloSimulator.js`

### New Files
- `tests/unit/expressionDiagnostics/axisNormalizationUtils.test.js`

## Out of Scope (MUST NOT Change)

- Monte Carlo report generation logic.
- Gate evaluation logic in `src/emotions/emotionCalculatorService.js`.
- Any UI rendering in `src/domUI/expression-diagnostics/`.

## Implementation Details

- Remove or guard the "already normalized" shortcut so mood axis values are always normalized with the runtime rule (divide by 100, no extra clamp).
- Keep sexual axis normalization behavior unchanged.
- Align MonteCarloSimulator mood constraint normalization to the same divide-by-100 rule.
- Add unit tests that compare diagnostics normalization to the runtime rules for representative values (e.g., -100, -1, 0, 1, 100).

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:unit -- --runInBand --testPathPatterns="axisNormalizationUtils" --coverage=false`

### Invariants That Must Remain True

1. Raw mood axis values in `MonteCarloSimulator` remain in [-100, 100].
2. Sexual axis normalization continues to clamp to [0, 1].
3. Diagnostics normalization for mood axes matches runtime normalization for all inputs.

## Status
Completed

## Outcome
Diagnostics mood-axis normalization now always divides by 100 (matching runtime) and MonteCarloSimulator mood-constraint normalization follows the same rule. Added unit coverage for mood-axis normalization and preserved sexual-axis behavior, as originally planned, but clarified that runtime does not apply an extra clamp beyond the raw [-100, 100] range.
