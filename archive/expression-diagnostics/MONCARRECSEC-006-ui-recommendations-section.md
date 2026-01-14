# MONCARRECSEC-006: UI Recommendations Section + Choke Rank

## Summary

Render a Recommendations section in the Monte Carlo diagnostics UI with cards, choke rank labels, and a prototype funnel row.

## Priority: Medium | Effort: Medium

## Status: Completed

## Assumptions (Reassessed)

- The Monte Carlo UI lives in `expression-diagnostics.html` and is driven by `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js` (there is no `src/expressionDiagnostics/ui` folder).
- Recommendations data already exists via `RecommendationFactsBuilder` + `RecommendationEngine`; this ticket wires UI rendering only.
- Report output updates are tracked elsewhere; this ticket is UI-only.

## Files to Touch

| File | Change Type |
| --- | --- |
| `expression-diagnostics.html` | Update |
| `css/expression-diagnostics.css` | Update |
| `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js` | Update |
| `tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.recommendations.test.js` | Create |

## Out of Scope

- Do not change global styling or theme tokens.
- Do not redesign existing tables beyond adding columns/rows required here.
- Do not add report output changes (handled separately).

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- --testPathPatterns ExpressionDiagnosticsController.recommendations --coverage=false
```

### Invariants That Must Remain True

- Recommendations are hidden when invariant violations exist and a warning banner is shown.
- Evidence lines display numerator and denominator values.
- Choke rank labels are consistent with impact ordering from facts.

## Implementation Notes

- Add section title "Recommendations" and render each item as a card with title, confidence, impact, evidence, actions, and jump-to-clause links.
- Add "Choke rank" column in clause table.
- Add prototype funnel row: mood sample count, gate clamp rate, pass|gate, effective pass, impact.
- When `moodSampleCount` is below low-confidence threshold, display a warning banner and mark recommendations as low confidence.
- Do not rely on color alone; use icons or text labels for recommendation type.

## Outcome

- Implemented Recommendations UI in `expression-diagnostics.html` + `css/expression-diagnostics.css` and wired rendering in `ExpressionDiagnosticsController` using existing facts/engine services.
- Added choke rank column, jump-to-clause anchors, and funnel metrics per card; no separate UI component layer was introduced.
- Added unit tests covering low-confidence warnings, invariant suppression, and choke rank display.
