# MONCARSAMCOVCON-004: Decide and wire watchlist visibility

Status: Completed

## Goal
Resolve the open question on whether watchlist numeric bullets should be enabled by default or gated, then wire the chosen behavior consistently for report/UI. Current report/UI calls pass `includeWatchlist: false`, so watchlist bullets are not emitted today.

## File list (expected to touch)
- src/expressionDiagnostics/services/samplingCoverageConclusions.js
- src/expressionDiagnostics/services/MonteCarloReportGenerator.js
- src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js
- tests/unit/expressionDiagnostics/services/samplingCoverageConclusions.test.js
- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js
- tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js

## Work items
- Decision: enable watchlist numeric bullets by default for report/UI.
- Update report/UI calls to `buildSamplingCoverageConclusions()` to pass `includeWatchlist: true`.
- Extend tests to cover default watchlist rendering (numeric bullets present without variable names).

## Out of scope
- Any new UI controls beyond a simple enable/disable decision.
- Changes to sampling coverage calculations, thresholds, or rule text.
- Adding variable names to watchlist output.

## Acceptance criteria
### Tests that must pass
- `npm run test:unit -- --testPathPatterns samplingCoverageConclusions --coverage=false`
- `npm run test:unit -- --testPathPatterns monteCarloReportGenerator --coverage=false`
- `npm run test:unit -- --testPathPatterns ExpressionDiagnosticsController --coverage=false`

### Invariants that must remain true
- Watchlist bullets, when enabled, are numeric-only summaries (no variable names).
- Report/UI conclusions remain hidden when no conclusions exist.
- Existing sampling coverage payload remains unchanged.

### Note by the developer

I confirm the watchlist numeric bullets should be enabled by default for both report and UI.

## Outcome
- Enabled watchlist numeric bullets by default in report/UI calls.
- Extended unit coverage to assert watchlist bullets render when coverage conclusions appear.
