# MONCARREPINTWARSPE-007: Gate Integrity Test Coverage

## Summary

Add unit/integration tests that lock in hard-gate invariants and ensure report gate evaluation matches runtime behavior.

## Background

The spec recommends adding tests T1-T3 and T6 to protect against regressions in gate evaluation and Monte Carlo integrity warnings.

## File List (Expected to Touch)

### Existing Files
- `src/emotions/emotionCalculatorService.js`
- `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`
- `src/expressionDiagnostics/services/MonteCarloSimulator.js`

### New Files
- `tests/unit/emotions/emotionCalculatorService.gate.test.js`
- `tests/unit/expressionDiagnostics/monteCarloGateConsistency.test.js`
- `tests/integration/expressionDiagnostics/monteCarloStoredContextIntegrity.test.js`

## Out of Scope (MUST NOT Change)

- Expression data under `data/mods/`.
- Any UI rendering in `src/domUI/expression-diagnostics/`.
- Non-gate-related report sections.

## Implementation Details

- T1/T2: Unit tests for hard-gate clamping and pass/fail invariants in `EmotionCalculatorService`.
- T3: Unit test that report-side gate evaluation matches runtime for a representative set of mood axes (including -1, 0, 1).
- T6: Integration test that stored Monte Carlo contexts reflect post-gate finals and include gate traces if available.

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:unit -- --runInBand --testPathPatterns="emotionCalculatorService.gate" --coverage=false`
2. `npm run test:unit -- --runInBand --testPathPatterns="monteCarloGateConsistency" --coverage=false`
3. `npm run test:integration -- --runInBand --testPathPatterns="monteCarloStoredContextIntegrity" --coverage=false`

### Invariants That Must Remain True

1. Gate fail always produces final intensity 0.
2. Non-zero final intensity always implies gate pass.
3. Report integrity checks never produce I1 warnings for deterministic Monte Carlo runs when normalization is consistent.
