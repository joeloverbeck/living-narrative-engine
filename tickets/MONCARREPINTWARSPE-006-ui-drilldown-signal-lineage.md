# MONCARREPINTWARSPE-006: UI Drill-Down for Sample Gate Details

## Summary

Provide a drill-down view in the Expression Diagnostics UI that shows raw/gated/final gate signals, numeric scales, and sample-level details for flagged indices.

## Background

The spec calls for UI-only drill-down to make integrity warnings actionable and to display signal lineage with explicit numeric scales.

## File List (Expected to Touch)

### Existing Files
- `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js`
- `css/expression-diagnostics.css`

## Out of Scope (MUST NOT Change)

- Monte Carlo simulation logic or report generation.
- Markdown report output.
- Non-Expression Diagnostics UI pages.

## Implementation Details

- Add a drill-down interaction for sample indices flagged in integrity warnings.
- Show raw/gated/final values with axis normalization scale (raw [-100, 100], normalized [-1, 1], final [0, 1]).
- Include gate pass/fail reasons when available from stored traces.

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:unit -- --runInBand --testPathPatterns="ExpressionDiagnosticsController" --coverage=false`

### Invariants That Must Remain True

1. Drill-down UI is only rendered when integrity data is present.
2. UI remains functional without stored trace data (fallback messaging).
3. Existing UI layout and interactions remain stable outside the new drill-down panel.
