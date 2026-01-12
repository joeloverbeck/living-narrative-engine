# MONCARIMPCLAASS-005: Add tests for sweep labeling + integrity checks

## Reassessment (from specs/monte-carlo-implementation-claims-assessment.md)
- Sweep kinds, labels, and disclaimers are already implemented in report generation.
- Sensitivity results already carry `kind` + `populationHash` metadata.
- Monotonicity warnings exist in both report and interactive UI.
- Low-confidence expression sweeps already render with warnings (not suppressed).
- Most required test coverage already exists outside the originally listed files.

## Goal
Verify existing sweep labeling/integrity coverage and add the missing UI test for monotonicity warning badges.

## Scope
- Add UI test coverage that asserts non-monotonic sweep warning badges appear in the interactive panel.
- Confirm existing tests already cover:
  - Sweep kind labels/disclaimers (report output).
  - Population hash metadata on sweep results.
  - Monotonicity warnings in report output.
  - Low-confidence warning in report + UI.

## Tasks
- Add UI test assertions to confirm non-monotonic sweep warning badges appear in the interactive panel.
- Reference existing tests that already cover sweep labels, population hashes, report warnings, and low-confidence banners.

## File list it expects to touch
- `tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js`

## Out of scope
- No changes to production code (this ticket is tests only).
- No snapshot regeneration outside the tests listed above.

## Acceptance criteria
### Specific tests that must pass
- `npm run test:unit -- --testPathPatterns=tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.labels.test.js --coverage=false`
- `npm run test:integration -- --testPathPatterns=tests/integration/expression-diagnostics/sensitivityAnalysis.integration.test.js --coverage=false`
- `npm run test:integration -- --testPathPatterns=tests/integration/expression-diagnostics/sensitivityScalarParity.integration.test.js --coverage=false`
- `npm run test:unit -- --testPathPatterns=tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js --coverage=false`

### Invariants that must remain true
- No test depends on network access or real worker threads.
- Existing integration tests continue to use stored-context simulations only.

## Status
Completed.

## Outcome
- Added UI test coverage for non-monotonic sweep warning badges in the interactive panel.
- Verified existing tests already cover sweep labels/disclaimers, population hashes, report monotonicity warnings, and low-confidence warnings.
- No production code changes were needed.
