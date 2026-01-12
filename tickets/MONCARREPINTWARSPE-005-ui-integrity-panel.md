# MONCARREPINTWARSPE-005: UI Integrity Panel + Invalidation Indicator

## Summary

Add an integrity panel to the Expression Diagnostics UI that surfaces Monte Carlo integrity warnings and marks gate-dependent metrics as unreliable.

## Background

The spec calls for a UI-facing integrity summary so report consumers can trust (or distrust) gate-dependent metrics at a glance.

## File List (Expected to Touch)

### Existing Files
- `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js`
- `css/expression-diagnostics.css`

## Out of Scope (MUST NOT Change)

- Monte Carlo simulation logic or report generation.
- Markdown report output.
- Any non-Expression Diagnostics UI pages.

## Implementation Details

- Add a dedicated integrity panel section near the Monte Carlo report output.
- Surface mismatch counts, affected prototypes, and a short explanation that gate-dependent metrics should be treated as unreliable when mismatches exist.
- Visually flag gate-dependent metrics (e.g., badge or warning label) when integrity warnings are present.

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:unit -- --runInBand --testPathPatterns="ExpressionDiagnosticsController" --coverage=false`

### Invariants That Must Remain True

1. UI continues to render when there are zero integrity warnings (panel shows a "no issues" state).
2. Gate-dependent metrics are only flagged when integrity warnings exist.
3. No changes to other diagnostics panels outside Monte Carlo reporting.
