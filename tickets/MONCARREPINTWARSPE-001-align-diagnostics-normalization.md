# MONCARREPINTWARSPE-001: Align Diagnostics Normalization With Runtime

## Summary

Make diagnostics normalization match runtime normalization so Monte Carlo integrity checks do not diverge on mood-axis values in [-1, 1].

## Background

Diagnostics currently treat values in [-1, 1] as already-normalized, while runtime always divides mood axes by 100. This mismatch can flip gate pass/fail and create false I1 warnings.

## File List (Expected to Touch)

### Existing Files
- `src/expressionDiagnostics/utils/axisNormalizationUtils.js`

### New Files
- `tests/unit/expressionDiagnostics/axisNormalizationUtils.test.js`

## Out of Scope (MUST NOT Change)

- Monte Carlo report generation logic.
- Gate evaluation logic in `src/emotions/emotionCalculatorService.js`.
- Any UI rendering in `src/domUI/expression-diagnostics/`.

## Implementation Details

- Remove or guard the "already normalized" shortcut so mood axis values are always normalized with the runtime rule (divide by 100, clamp to [-1, 1]).
- Keep sexual axis normalization behavior unchanged.
- Add unit tests that compare diagnostics normalization to the runtime rules for representative values (e.g., -100, -1, 0, 1, 100).

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:unit -- --runInBand --testPathPatterns="axisNormalizationUtils" --coverage=false`

### Invariants That Must Remain True

1. Raw mood axis values in `MonteCarloSimulator` remain in [-100, 100].
2. Sexual axis normalization continues to clamp to [0, 1].
3. Diagnostics normalization for mood axes matches runtime normalization for all inputs.
