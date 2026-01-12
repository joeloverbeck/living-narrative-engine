# MONCARSAMCOV-004 - In-Page Sampling Coverage Panel

## Goal
Render the Sampling Coverage panel in the in-page Monte Carlo results (expression-diagnostics.html) and hide it when no usable coverage data is available.

## Scope
- Add the `#mc-sampling-coverage` container markup after the trigger-rate summary and before Top Blockers (currently missing in the HTML).
- Extend ExpressionDiagnosticsController to populate the summary line, domain table, and lowest-coverage list from `result.samplingCoverage`.
- Hide the panel when `samplingCoverage` is missing or produces no displayable summaries (unknown-domain variables are excluded, not a reason to hide by themselves).

## File list
- `expression-diagnostics.html`
- `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js`
- `css/expression-diagnostics.css` (or the relevant diagnostics stylesheet)
- `tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js`

## Out of scope
- Report generator changes.
- Simulator changes.
- Broader UI redesign outside the new sampling coverage panel.

## Acceptance criteria
### Specific tests that must pass
- `npm run test:unit -- --testPathPatterns=tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js --coverage=false`

### Invariants that must remain true
- Existing Monte Carlo results layout and DOM ids remain intact.
- The panel does not render when `samplingCoverage` is missing.
- No new global CSS resets or typography changes are introduced.

## Status
- [ ] In progress
- [x] Completed

## Outcome
- Added the in-page sampling coverage panel markup, controller rendering, and styling for the summary, domain table, and lowest-coverage list.
- Panel hides when `samplingCoverage` is missing or has no displayable summaries; unknown-domain variables are excluded from summaries rather than blocking rendering.
- Added unit coverage for visible/hidden panel states in the ExpressionDiagnosticsController test suite.
