# MONCARRECASS-006 - Validate lost-pass metric for gate mismatch recommendations

## Goal
Confirm gate mismatch recommendations for `>=` clauses use the lost-pass rate and align unit tests/docs with the current implementation.

## Updated assumptions (from code + spec review)
- `RecommendationEngine` already uses `lostPassRateInRegime` for `>=` clauses, not gate fail rate.
- Clause direction awareness is implemented (`>=` only) and `<=` clauses do not emit gate mismatch.
- `RecommendationFactsBuilder` already exposes lost-pass metrics from the simulator.

## File list it expects to touch
- src/expressionDiagnostics/services/RecommendationEngine.js
- tests/unit/expressionDiagnostics/services/recommendationEngine.test.js

## Out of scope
- Changing lost-pass metric calculation or simulator behavior.
- Emitting new recommendation types.
- Altering confidence/severity logic.

## Acceptance criteria
### Specific tests that must pass
- npm run test:unit -- --testPathPatterns tests/unit/expressionDiagnostics/services/recommendationEngine.test.js --coverage=false

### Invariants that must remain true
- Gate mismatch does not trigger for `<=` clauses.
- Threshold mismatch and axis conflict signals continue to behave as before.
- Recommendation confidence remains based on mood sample count only.

## Notes
- Keep the lost-pass threshold at 0.25 (current behavior).
- Update tests to show gate mismatch fires when lost-pass rate exceeds threshold even if gate fail rate is low.

## Status
Completed.

## Outcome
- Updated unit coverage to drive gate mismatch off lost-pass metrics (including low gate-fail cases).
- No production code changes needed because the engine already uses lost-pass rate for `>=` clauses.
