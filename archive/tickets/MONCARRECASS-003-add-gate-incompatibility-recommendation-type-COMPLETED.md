# MONCARRECASS-003 - Add gate incompatibility recommendation type

## Goal
Introduce a dedicated recommendation type that explains when a clause's regime makes a prototype gate impossible ("always clamped to 0").

## File list it expects to touch
- src/expressionDiagnostics/services/RecommendationEngine.js
- tests/unit/expressionDiagnostics/services/recommendationEngine.test.js

## Out of scope
- Modifying gate compatibility math in PrototypeConstraintAnalyzer.
- Renaming existing recommendation types.
- Any changes to Monte Carlo sampling or gating behavior.

## Acceptance criteria
### Specific tests that must pass
- npm run test:unit -- --testPathPatterns tests/unit/expressionDiagnostics/services/recommendationEngine.test.js --coverage=false
- npm run test:unit -- --testPathPatterns tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.recommendations.test.js --coverage=false

### Invariants that must remain true
- Existing `prototype_mismatch` recommendations still appear for gate mismatch and threshold mismatch triggers.
- Recommendation actions remain deterministic and do not depend on random sampling.
- UI continues to render recommendations without throwing when unknown types are absent.

## Notes
- The current `axisConflict` flag in `RecommendationEngine` is sourced from `compatibilityScore` (binary gate compatibility), not axis sign conflict detection.
- Use the existing gate compatibility signal (`compatibilityScore <= -0.25`) as the trigger for the new recommendation type and stop treating it as `prototype_mismatch`.
- Add a clear, specific action message such as "Regime makes the gate impossible; adjust gate inputs or swap prototype." (wording can be refined in implementation).

## Status
Completed.

## Outcome
Added a dedicated `gate_incompatibility` recommendation driven by compatibility scores, and limited `prototype_mismatch` to gate/threshold mismatches. Updated unit tests to cover the new recommendation and to ensure UI fixtures include clause operators so gate mismatch triggers remain intact.
