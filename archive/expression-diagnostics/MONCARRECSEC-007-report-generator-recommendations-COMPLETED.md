# MONCARRECSEC-007: Report Generator Recommendations Section

## Summary

Add a recommendations section to the Monte Carlo report output that mirrors the existing UI cards with evidence and anchors.

## Status: Completed

## Assumptions (Revalidated)

- `RecommendationFactsBuilder` and `RecommendationEngine` already exist and are used by the diagnostics UI.
- The report generator does not currently render the recommendations section.
- The report does not include a clause table, so anchors should target blocker sections keyed by clause id.
- Unit tests for facts/engine already exist; only an integration test for report output is missing.

## Priority: Medium | Effort: Small

## Files to Touch

| File | Change Type |
| --- | --- |
| `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` | Update |
| `tests/integration/expression-diagnostics/monteCarloReportRecommendations.integration.test.js` | Create |

## Out of Scope

- Do not change UI components.
- Do not add new recommendation logic.
- Do not alter non-recommendation report sections.

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:integration -- --testPathPatterns monteCarloReportRecommendations --coverage=false
```

### Invariants That Must Remain True

- Evidence lines include numerator and denominator values.
- Confidence is explicitly labeled for each recommendation.
- Recommendation anchors map to clause-id anchors on blocker sections.

## Implementation Notes

- Append a markdown "Recommendations" section with cards rendered as headings + bullet lists.
- Use RecommendationFactsBuilder + RecommendationEngine (no new logic).
- Create clause-id anchors on blocker sections and link to them from recommendations.
- Suppress output when invariant violations exist and insert a warning line instead.

## Outcome

- Implemented report recommendations by wiring RecommendationFactsBuilder/RecommendationEngine into the report generator.
- Added clause-id anchors to blocker sections and linked recommendations to them (no clause table exists in report).
- Added integration coverage for recommendations rendering and invariant-suppression behavior.
