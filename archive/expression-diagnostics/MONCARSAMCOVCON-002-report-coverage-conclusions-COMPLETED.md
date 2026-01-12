# MONCARSAMCOVCON-002: Render coverage conclusions in Monte Carlo report

## Goal
Add a "Coverage Conclusions" subsection to the Sampling Coverage report section using the shared conclusions builder.

## Assumptions Check (2025-02-01)
- The shared conclusions builder already exists at `src/expressionDiagnostics/services/samplingCoverageConclusions.js`.
- `MonteCarloReportGenerator` already renders "### Coverage Conclusions" after notes/warnings and calls the builder.
- Expression diagnostics UI already renders conclusions via the same builder.
- Remaining gap is test coverage around omission behavior and variable-name leakage inside the conclusions subsection.

## File list (expected to touch)
- src/expressionDiagnostics/services/MonteCarloReportGenerator.js
- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js

## Work items
- Verify the report already uses `buildSamplingCoverageConclusions()` with sampling coverage payloads.
- Add/extend unit tests to assert the conclusions subsection:
  - Appears only when conclusions are generated.
  - Does not include variable names within the conclusions bullets.

## Out of scope
- Changes to conclusions logic or rule thresholds.
- UI rendering in `ExpressionDiagnosticsController` or `expression-diagnostics.html`.
- Any changes to Monte Carlo simulator output or sampling coverage payload.

## Acceptance criteria
### Tests that must pass
- `npm run test:unit -- --testPathPatterns monteCarloReportGenerator --coverage=false`

### Invariants that must remain true
- Existing report sections render exactly as before when no conclusions are emitted.
- No variable names appear in coverage conclusions text.
- Sampling coverage report warnings/notes remain in their current positions.

## Status
- [x] Completed

## Outcome
- Planned: add report coverage conclusions rendering and tests.
- Actual: confirmed report already renders conclusions; added tests to ensure omission when no conclusions are produced and to guard against variable names in conclusion bullets.
