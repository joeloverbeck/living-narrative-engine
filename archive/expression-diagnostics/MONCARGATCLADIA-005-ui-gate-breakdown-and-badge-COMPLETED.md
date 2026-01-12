# MONCARGATCLADIA-005: Add Gate Breakdown Panel And Classification Badge

## Summary

Add an expandable per-gate breakdown panel and a heuristic classification badge (gate mismatch vs threshold too high vs both; otherwise "Balanced") to the non-report diagnostics UI for emotion-threshold clauses.

## Priority: Medium | Effort: Medium

## Rationale

Gate breakdowns and classification help authors rapidly identify whether to tune gates, thresholds, or both. The spec requires explicit thresholds and clear labeling to avoid misinterpretation.

## Assumptions Recheck

- The blockers table already shows Gate clamp (mood) and Pass | gate (mood) columns in the non-report UI, so this ticket focuses on the per-gate panel and classification badge only.
- Monte Carlo results do not currently include per-gate failure rates, but stored contexts are available from simulation for UI-side computation.
- Emotion prototype gates live in `core:emotion_prototypes` via `IDataRegistry`, so gate breakdown can be computed without modifying Monte Carlo sampling.

## Files to Touch

| File | Change Type |
|------|-------------|
| `expression-diagnostics.html` | **Modify** |
| `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js` | **Modify** |
| `src/expressionDiagnostics/config/advancedMetricsConfig.js` | **Modify** (classification thresholds) |
| `css/expression-diagnostics.css` | **Modify** |
| `tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js` | **Modify** |

## Out of Scope

- **DO NOT** add report UI changes
- **DO NOT** modify Monte Carlo simulation sampling or gate logic
- **DO NOT** introduce new global styles unrelated to the diagnostics UI

## Acceptance Criteria

### Tests

- `npm run test:unit -- --testPathPatterns=tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js --coverage=false`

### Invariants

- Classification thresholds are defined in configuration and not hardcoded in UI logic.
- The per-gate panel renders only when gate data is present and is collapsed by default.
- The badge tooltip explains the heuristic and uses the same denominators as the table metrics.

## Completion Notes

- [x] Update this ticket with an Outcome section and mark completed before archiving.

## Status

Completed

## Outcome

- Delivered the per-gate breakdown panel by computing gate failure rates from stored contexts and prototype gates (no Monte Carlo logic changes).
- Added the gate-vs-threshold classification badge with configurable thresholds and tooltip clarifying denominators; retained existing Gate clamp / Pass | gate columns.
