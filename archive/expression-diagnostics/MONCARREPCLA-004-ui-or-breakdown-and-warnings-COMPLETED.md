# MONCARREPCLA-004: UI OR breakdown metrics and OR-constraint warnings

## Goal
Confirm the UI's order-independent OR coverage metrics are clearly labeled and ensure OR-constraint warnings appear in the existing diagnostics sections without altering layout semantics.

## Assumptions & scope notes (revalidated)
- Order-independent OR pass/exclusive metrics and the order-dependent first-pass share are already present in the hierarchical tree UI.
- OR-constraint warning banners already exist for Conditional Pass Rates, Prototype Fit Analysis, and Implied Prototype.
- The UI does not include a dedicated "Prototype Math Analysis" section; that content only exists in the report modal output.

## File list (expected to touch)
- src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js
- tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js

## Work items
- Update OR breakdown rendering to label the order-dependent metric as "first-pass (order-dependent)."
- Add/adjust tests to cover OR alternative coverage labeling and OR-constraint warning visibility for the existing sections.
- Ensure warnings auto-hide when no OR mood constraints are detected.

## Out of scope
- Changes to report generator output or simulator metrics.
- New navigation, layout restructuring, or UI redesigns outside the affected sections.
- Any modifications to mod data or expression logic evaluation.

## Acceptance criteria
### Tests that must pass
- `npm run test:unit -- --testPathPatterns="ExpressionDiagnosticsController" --coverage=false`

### Invariants that must remain true
- Existing section headers, ordering, and anchors in the UI remain unchanged.
- OR breakdown still shows the combined OR pass rate in addition to per-alternative metrics.
- Warning banners are absent when no OR-based mood constraints are present.
- Warning banners are shown for Conditional Pass Rates, Prototype Fit Analysis, and Implied Prototype when OR-based mood constraints are present.

## Status
Completed

## Outcome
- Updated OR breakdown labeling to explicitly mark the first-pass share as order-dependent.
- Added unit coverage for OR alternative labeling and OR-constraint warning visibility.
- Scope adjusted to reflect existing UI warnings and the absence of a Prototype Math Analysis section.
