# MONCARRECASS-001 - Include clause metadata in recommendation facts

## Goal
Expose clause operator and threshold metadata in recommendation facts so recommendations can be direction-aware without re-parsing clauses later.

## File list it expects to touch
- src/expressionDiagnostics/services/RecommendationFactsBuilder.js
- tests/unit/expressionDiagnostics/services/diagnosticFactsBuilder.test.js

## Out of scope
- Changing recommendation logic or thresholds.
- Adding new recommendation types or actions.
- Modifying Monte Carlo simulation behavior or stored trace formats.
- Updating report rendering output.

## Acceptance criteria
### Specific tests that must pass
- npm run test:unit -- --testPathPatterns tests/unit/expressionDiagnostics/services/diagnosticFactsBuilder.test.js --coverage=false

### Invariants that must remain true
- Recommendation facts still cap to the top three impact clauses with prototype references.
- No UI text or recommendation output changes in this ticket.
- ESLint rule `mod-architecture/no-hardcoded-mod-references` remains satisfied.

## Notes
- Diagnostic facts already include `thresholdValue`; only the comparison operator is missing.
- Include clause `operator` (and keep any existing clause identifiers) in the facts payload for each recommendation candidate.
- Ensure new fields are nullable-safe if a clause is missing expected fields.

## Status
Completed.

## Outcome
- Added clause operator to recommendation facts (threshold already existed).
- Updated unit tests to cover operator pass-through and nullable behavior.
