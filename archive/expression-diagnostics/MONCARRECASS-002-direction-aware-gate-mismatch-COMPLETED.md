# MONCARRECASS-002 - Direction-aware gate mismatch recommendations

## Goal
Prevent gate mismatch recommendations from triggering on `<=` clauses and ensure gate mismatch logic is applied only to `>=` clauses (skip when operator is missing or different).

## File list it expects to touch
- src/expressionDiagnostics/services/RecommendationEngine.js
- tests/unit/expressionDiagnostics/services/recommendationEngine.test.js

## Assumptions (validated)
- Clause operators are already available on DiagnosticFacts as `clause.operator` (sourced from `RecommendationFactsBuilder`), but tests in this ticket must add the operator field to fixtures so the engine behavior is explicit.

## Out of scope
- Changing Monte Carlo simulator gate enforcement logic.
- Adding new recommendation types or modifying UI labels.
- Adjusting confidence thresholds.
- Updating RecommendationFactsBuilder or the report schema beyond using the existing `operator` field.

## Acceptance criteria
### Specific tests that must pass
- npm run test:unit -- --testPathPatterns tests/unit/expressionDiagnostics/services/recommendationEngine.test.js --coverage=false

### Invariants that must remain true
- Existing recommendation ordering and top-3 cap logic remain unchanged.
- Gate mismatch still triggers for `>=` clauses with the same threshold until lost-pass metrics land.
- No changes to stored Monte Carlo report JSON structure yet.

## Notes
- Use the clause operator from recommendation facts to gate the `gateMismatch` signal.
- Add a unit test case covering a `<=` clause with high gate failure rate that does not emit a gate mismatch recommendation.

## Status
Completed

## Outcome
Updated `RecommendationEngine` to only emit gate mismatch recommendations for `>=` operators, added explicit operator coverage in unit tests, and confirmed `<=` clauses do not trigger gate mismatch.
