# MONCARREGAWAREP-004: Tests for regime-aware Monte Carlo reporting

## Status: Completed

## Goal
Add or update integration tests to validate regime-aware Monte Carlo reporting fields and payloads without expanding test scope beyond expression diagnostics.

## Reassessed assumptions
- The report generator already implements the feasibility block, tuning direction labels, regime-aware fail rates, and redundancy flags (see `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`).
- Unit tests in `tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js` already cover some regime-aware report formatting.
- The Top Blockers expansion UI consumes regime-aware payload fields via `ExpressionDiagnosticsController` private helpers; integration tests should validate the payload fields rather than DOM wiring.

## File list (expected to touch)
- tests/integration/expression-diagnostics/monteCarloReport.integration.test.js
- tests/integration/expression-diagnostics/hierarchicalBlockers.integration.test.js

## Work items
- Add report assertions for feasibility block fields, regime labels, and fail-rate formatting in integration coverage (avoid duplicating unit-level checks).
- Add integration coverage that MonteCarloSimulator/FailureExplainer payloads include regime-aware fields used by Top Blockers expansions (global vs mood-pass rates, redundancy flag, tuning direction, in-regime range).
- Validate that gate compatibility details are only included when provided in the simulation payload (UI warning rendering is out of scope).
- Ensure regime-aware fields are present in the diagnostics payload used by report generation integration tests.

## Out of scope
- Introducing new fixtures or mod data unrelated to expression diagnostics.
- End-to-end tests or performance/memory suites.
- Changes to sampling algorithms or diagnostic result modeling.

## Acceptance criteria
### Tests that must pass
- `npm run test:integration -- --testPathPatterns="expression-diagnostics/monteCarloReport" --coverage=false`
- `npm run test:integration -- --testPathPatterns="expression-diagnostics/hierarchicalBlockers" --coverage=false`
- `npm run test:integration -- --testPathPatterns="expression-diagnostics/advancedMetrics" --coverage=false`

### Invariants that must remain true
- Existing report assertions unrelated to Monte Carlo remain valid.
- Tests do not depend on global state or sample randomness beyond existing harness behavior.
- No changes to snapshot baselines outside expression diagnostics tests.
- DOM-level tests for `ExpressionDiagnosticsController` are not required; payload verification is sufficient for this ticket.

## Outcome

Added integration coverage for in-regime fail-rate formatting, prototype feasibility blocks/regime stats, gate compatibility rendering, and in-regime payload fields used by the Top Blockers expansion. DOM-level warning rendering remains out of scope as planned.
