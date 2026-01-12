# MONCARGATCLADIA-004: Add Gate Clamp Metrics To Diagnostics UI Table

## Summary

Extend the Top Blockers clause table in `expression-diagnostics.html` to display gate clamp and pass-given-gate metrics for emotion-threshold clauses with clear labels, counts, and tooltips.

## Priority: Medium | Effort: Medium

## Rationale

Non-report UI should surface the same diagnostic signals as the report, but in a compact, legible format that avoids denominator confusion.

## Files to Touch

| File | Change Type |
|------|-------------|
| `expression-diagnostics.html` | **Modify** |
| `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js` | **Modify** |
| `tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js` | **Modify** |

## Out of Scope

- **DO NOT** add per-gate breakdown UI (handled in a separate ticket)
- **DO NOT** add or change report output
- **DO NOT** adjust Monte Carlo simulation logic

## Assumptions (Updated)

- The Top Blockers table header is defined in `expression-diagnostics.html`, but row values are rendered dynamically in `ExpressionDiagnosticsController`.
- Gate clamp and pass-given-gate metrics already exist in Monte Carlo clause failure payloads (`gateClampRateInRegime`, `passRateGivenGateInRegime`, and related counts) and can be joined to blockers by clause description.
- Expression-level UI data should continue to be derived from Monte Carlo results; no report output changes are required.

## Acceptance Criteria

### Tests

- `npm run test:unit -- --testPathPatterns=tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js --coverage=false`

### Invariants

- Gate clamp metrics appear only for emotion-threshold clauses.
- Tooltips explicitly state the denominator (mood-regime subset and/or gate-pass subset).
- Existing clause table columns remain in their current order unless the UI spec requires explicit repositioning.

## Status

Completed

## Outcome

- Added gate clamp and pass|gate columns to the Top Blockers table with explicit denominators in header tooltips and counts in cells.
- Joined Monte Carlo clause-failure gate metrics onto blockers by clause description; no report output changes needed.
- Covered rendering and formatting via `ExpressionDiagnosticsController` unit test updates.
