# MONCARREPINTWARSPE-005: UI Integrity Panel + Invalidation Indicator

## Summary

Confirm and extend the existing Monte Carlo integrity warnings UI by adding explicit "unreliable" indicators on gate-dependent metrics when integrity warnings are present.

## Background

The spec calls for a UI-facing integrity summary so report consumers can trust (or distrust) gate-dependent metrics at a glance. The integrity panel already exists in the Expression Diagnostics UI and surfaces warnings plus an impact note, but gate-dependent metric sections are not explicitly flagged.

## Updated Assumptions (Reassessed)

- Integrity warnings UI already exists (`#mc-integrity-warnings`) and is hidden when no warnings are present.
- Unit tests already cover showing/hiding integrity warnings via `ExpressionDiagnosticsController.test.js`.
- Gate-dependent metrics (blockers table, conditional pass rates) are not currently marked as unreliable.

## File List (Expected to Touch)

### Existing Files
- `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js`
- `expression-diagnostics.html`
- `css/expression-diagnostics.css`

## Out of Scope (MUST NOT Change)

- Monte Carlo simulation logic or report generation.
- Markdown report output.
- Any non-Expression Diagnostics UI pages.

## Implementation Details

- Keep the existing integrity panel; do not rework its structure.
- Add small "Unreliable" badges or warning labels on gate-dependent metric sections (Top Blockers + Conditional Pass Rates) when integrity warnings include gate/final mismatch codes (I*).
- Ensure badges are hidden when no integrity warnings are present.

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:unit -- --runInBand --testPathPatterns="ExpressionDiagnosticsController" --coverage=false`

### Invariants That Must Remain True

1. UI continues to render when there are zero integrity warnings (integrity panel remains hidden).
2. Gate-dependent metrics are only flagged when integrity warnings exist.
3. No changes to other diagnostics panels outside Monte Carlo reporting.

## Completion

- Status: Completed

## Outcome

- Kept the existing integrity panel and added explicit "Unreliable" badges for Top Blockers and Conditional Pass Rates when I* integrity warnings appear.
- Updated unit test fixtures to reflect raw mood-axis inputs for gate breakdown and added coverage for the new badges.
