# MONCARSAMCOVCON-001: Build sampling coverage conclusions utility

## Goal
Create a shared conclusions builder that converts sampling coverage metrics into structured, severity-ordered conclusions without naming specific variables, and surface those conclusions in both the report and in-page Monte Carlo results.

## File list (expected to touch)
- src/expressionDiagnostics/services/samplingCoverageConclusions.js
- src/expressionDiagnostics/services/index.js
- src/expressionDiagnostics/services/MonteCarloReportGenerator.js
- src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js
- expression-diagnostics.html
- tests/unit/expressionDiagnostics/services/samplingCoverageConclusions.test.js
- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js
- tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js

## Work items
- Implement `buildSamplingCoverageConclusions(samplingCoverage, options)` per `specs/monte-carlo-sampling-coverage-conclusions.md` rules (spec reference requested) and `brainstorming/conclusions-engine.md` templates.
- Produce structured output sections: `domainConclusions`, `variableSummary`, `globalImplications`, `watchlist`.
- Enforce domain rule severity ordering and tail-rule suppression when stronger tail rules fire.
- Ensure variable-level summaries are aggregate counts only (no variable names).
- Render conclusions in Monte Carlo report and in-page Sampling Coverage panel, hiding the block when no conclusions are produced.
- Add focused unit tests covering domain rules, variable summary counts, global implications, watchlist minima, plus report/UI rendering.

## Out of scope
- Changes to sampling coverage calculation or payload format.
- Introducing variable names into conclusion text.

## Acceptance criteria
### Tests that must pass
- `npm run test:unit -- --testPathPatterns samplingCoverageConclusions --coverage=false`
- `npm run test:unit -- --testPathPatterns monteCarloReportGenerator --coverage=false`
- `npm run test:unit -- --testPathPatterns ExpressionDiagnosticsController --coverage=false`

### Invariants that must remain true
- Conclusions never include specific variable names.
- Domain conclusions are sorted by severity and suppress weaker tail rules when stronger tail rules fire.
- Sampling coverage payload shape and existing metrics remain unchanged.

## Status
Completed

## Outcome
Implemented the shared conclusions builder and wired it into the report and UI as required, with the sampling coverage container gaining a conclusions list. Added unit coverage for rule evaluation plus report/UI rendering checks. This scope now matches the spec (report + in-page conclusions) rather than the original utility-only plan.
