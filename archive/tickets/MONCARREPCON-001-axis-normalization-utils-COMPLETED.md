# MONCARREPCON-001: Axis normalization utilities + gate pass alignment

## Summary
Create shared axis normalization helpers that mirror EmotionCalculatorService (including gate parsing parity) and update MonteCarloReportGenerator gate pass/failure calculations to use normalized axes with matching axis resolution precedence. Add raw sexual axes to stored Monte Carlo contexts so sexual gate checks can be evaluated consistently.

## Status
Completed.

## File list (expected to touch)
- src/expressionDiagnostics/utils/axisNormalizationUtils.js (new)
- src/expressionDiagnostics/services/MonteCarloReportGenerator.js
- src/expressionDiagnostics/services/MonteCarloSimulator.js (store raw sexual axes in contexts)
- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.gateNormalization.test.js (new)

## Out of scope
- Any changes to Monte Carlo sampling, expression evaluation, or report output structure beyond updated gate pass/failure values.
- Any report formatting or population metadata changes.
- Prototype fit ranking changes outside gate pass/failure calculation.

## Acceptance criteria
- Gate pass and gate failure calculations in MonteCarloReportGenerator use shared normalization helpers and resolve axes the same way as EmotionCalculatorService.
- Gate parsing and operator handling match EmotionCalculatorService/GateConstraint (no `!=`, supports negative thresholds, epsilon equality for `==`).
- The helper normalizes mood, sexual, and affect traits and exposes a resolveAxisValue with matching precedence (traits -> sexual -> mood).
- Stored contexts include raw sexual axes so sexual gate checks can be evaluated; existing context consumers are unaffected.
- Existing report output structure remains unchanged aside from updated gate pass/failure values.

## Tests
- `npm run test:unit -- --testPathPatterns tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.gateNormalization.test.js --coverage=false`

## Invariants
- Gate pass uses normalized axes (mood in [-1, 1], sexual/traits in [0, 1]) and respects sexual_arousal/SA aliasing.
- Sexual normalization mirrors EmotionCalculatorService (sexual_arousal derived from excitation/inhibition/baseline_libido; normalize sex_excitation and sex_inhibition/sexual_inhibition; baseline_libido is not a direct axis).
- Gate parsing and evaluation matches GateConstraint/EmotionCalculatorService (supports negative thresholds; ignores invalid operators).
- No changes to Monte Carlo sampling or expression evaluation behavior.

## Outcome
- Added shared normalization helpers and updated report gate pass/failure logic to use normalized axes with GateConstraint parsing parity.
- Stored raw sexual axes in MonteCarloSimulator contexts to allow sexual gate evaluation.
- Added unit tests covering normalized gate pass rates and SA alias failure rates.
