# MONCARRECASS-005 - Add lost-pass metric for gate mismatch

## Goal
Track and expose a "lost pass" metric (raw score >= threshold but gated value < threshold) to replace the current gate failure rate trigger for `>=` clauses.

## File list it expects to touch
- src/expressionDiagnostics/services/MonteCarloSimulator.js
- src/expressionDiagnostics/services/MonteCarloReportGenerator.js
- src/expressionDiagnostics/services/RecommendationFactsBuilder.js
- src/expressionDiagnostics/services/RecommendationEngine.js
- src/expressionDiagnostics/models/HierarchicalClauseNode.js
- tests/unit/expressionDiagnostics/services/monteCarloSimulator.gateEnforcement.test.js
- tests/unit/expressionDiagnostics/services/diagnosticFactsBuilder.test.js

## Out of scope
- Changing gating semantics (HARD gating stays as-is).
- Altering existing gate failure rate calculations.
- Updating UI recommendation wording or types.

## Acceptance criteria
### Specific tests that must pass
- npm run test:unit -- --testPathPatterns tests/unit/expressionDiagnostics/services/monteCarloSimulator.gateEnforcement.test.js --coverage=false
- npm run test:unit -- --testPathPatterns tests/unit/expressionDiagnostics/services/diagnosticFactsBuilder.test.js --coverage=false

### Invariants that must remain true
- Monte Carlo simulation results for existing metrics remain unchanged aside from the new lost-pass fields.
- No additional sampling is introduced; performance remains equivalent for the same iteration counts.
- Data is still serialized without circular references.

## Notes
- Record per-clause counters for `>=` clauses only (raw pass count vs gated pass count) and compute a lost-pass rate in-regime.
- Gate mismatch trigger currently lives in `RecommendationEngine`, so update it to use the lost-pass metric.
- Lost-pass tracking requires clause-level storage on `HierarchicalClauseNode` and simulator wiring for prototype-linked clauses (emotions/sexualStates).
- Ensure the report generator and facts builder expose the metric without requiring UI changes yet.

## Status
Completed

## Outcome
Implemented lost-pass tracking on clause nodes (including sexual state clauses), surfaced counts/rates in simulator results and diagnostic facts, and switched the recommendation gate-mismatch trigger to use lost-pass instead of gate-fail rate. Added/updated unit tests to cover the new counters and facts wiring.
