# MONCARREPCON-005: Achievable range scoping labels

## Status
Completed

## Summary
Clarify report labeling for theoretical ranges vs observed maxima to avoid mixing regime scopes.

## File list (expected to touch)
- src/expressionDiagnostics/services/MonteCarloReportGenerator.js
- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.labels.test.js (new)
- tests/integration/expression-diagnostics/monteCarloReport.integration.test.js

## Out of scope
- Any changes to population metadata or hashing.
- Any changes to gate pass logic or intensity computations.
- Any changes to Monte Carlo sampling behavior.

## Acceptance criteria
- The feasibility block label reads "Theoretical range (mood constraints, AND-only)".
- Regime stats explicitly label observed maxima as "Observed max (global, final)" and "Observed max (mood-regime, final)".
- Report string output reflects the updated labels without altering computed values.

## Tests
- `npm run test:unit -- --testPathPatterns tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.labels.test.js --coverage=false`
- `npm run test:integration -- --testPathPatterns tests/integration/expression-diagnostics/monteCarloReport.integration.test.js --coverage=false`

## Scope notes
- Existing integration coverage asserts the feasibility label, so update that expectation alongside the report generator label change.

## Invariants
- Theoretical range uses the same axis constraint computation as before.
- Only labels change; numeric values remain unchanged.

## Outcome
- Updated feasibility and regime stats labels to explicitly call out theoretical range and observed max scope.
- Adjusted integration expectations to match the new labels (unit + integration coverage).
