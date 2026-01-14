# MONCARREPINTWARSPE-006: UI Drill-Down for Sample Gate Details

## Summary

Provide a drill-down view in the Expression Diagnostics UI that shows raw/gated/final gate signals, numeric scales, and sample-level details for flagged indices.

## Background

The spec calls for UI-only drill-down to make integrity warnings actionable and to display signal lineage with explicit numeric scales.

## Assumptions Rechecked

- Integrity warnings UI already exists in `expression-diagnostics.html` and is wired in `ExpressionDiagnosticsController` (this ticket extends it rather than creating it).
- Report integrity warnings already include `details.sampleIndices` for a small example set (up to 5 indices).
- Stored contexts may include `gateTrace` with `{ raw, gated, final, gatePass }` per prototype; no gate pass/fail "reason" strings are stored today.
- Signal lineage values are already normalized to `0..1` for raw/gated/final; axis normalization scales should be conveyed as text (mood raw `[-100, 100]` -> normalized `[-1, 1]`, sexual raw `[0, 100]` -> normalized `[0, 1]`, traits raw `[0, 100]` -> normalized `[0, 1]`).

## File List (Expected to Touch)

### Existing Files
- `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js`
- `expression-diagnostics.html`
- `css/expression-diagnostics.css`
- `tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js`

## Out of Scope (MUST NOT Change)

- Monte Carlo simulation logic or report generation.
- Markdown report output.
- Non-Expression Diagnostics UI pages.

## Implementation Details

- Add a drill-down interaction for sample indices flagged in integrity warnings.
- Show raw/gated/final values (0..1) alongside axis normalization scale text (mood raw [-100, 100] -> normalized [-1, 1], sexual raw [0, 100] -> normalized [0, 1], traits raw [0, 100] -> normalized [0, 1]).
- Surface gatePass boolean when `gateTrace` is available; otherwise provide fallback messaging (no gate reason strings exist yet).

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:unit -- --runInBand --testPathPatterns="ExpressionDiagnosticsController" --coverage=false`

### Invariants That Must Remain True

1. Drill-down UI is only rendered when integrity data is present.
2. UI remains functional without stored trace data (fallback messaging).
3. Existing UI layout and interactions remain stable outside the new drill-down panel.

## Status

Completed.

## Outcome

- Added drill-down UI inside the existing integrity warnings panel with sample index buttons and signal lineage data.
- Displayed raw/gated/final signals (0..1) with gate pass status and axis normalization scale notes.
- Added fallback messaging when gate traces are missing while still showing stored final values when available.
