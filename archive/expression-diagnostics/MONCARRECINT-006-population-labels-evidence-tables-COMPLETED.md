# MONCARRECINT-006: Population Labels for Evidence + Tables

## Summary

Add population metadata to recommendation evidence and surface population labels (with N) in UI and report tables.

## Assumptions Check (2026-01-13)

- Recommendation evidence items are already built in `RecommendationEngine`, but they only embed population hints inside labels (e.g., "population mood-regime") and do not carry structured population metadata.
- UI and report formatters for recommendations do not currently render population labels.
- Some evidence rows are scalar metrics (denominator = 1) or subset ratios (e.g., gate-fail share, raw-pass share) that do not map cleanly to the allowed population names without reinterpreting the metric. These should not be forced into a different denominator just to satisfy labeling.

## Background

The spec requires every recommendation evidence item and table to explicitly declare which population was used for denominators (full, mood-regime, gate-pass in mood-regime, stored contexts).

## File List (Expected to Touch)

### Existing Files
- `src/expressionDiagnostics/services/RecommendationEngine.js`
- `src/expressionDiagnostics/services/RecommendationFactsBuilder.js`
- `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`
- `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js`
- `tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.recommendations.test.js`
- `tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.recommendations.test.js`

## Out of Scope (MUST NOT Change)

- Recommendation scoring and ranking logic.
- Any Monte Carlo sampling or ablation math.
- Data packs under `data/mods/`.

## Implementation Details

- Add `population: { name, count }` to evidence items; derive `count` from the evidence denominator when the metric represents a population rate.
- For scalar evidence (denominator = 1) or non-population ratios that would require new population names, keep the existing numerator/denominator semantics and attach population metadata only when it is truthful without changing metric meaning.
- Update UI and report formatters to display `Population: NAME (N=COUNT)` for evidence items and relevant tables.
- Use the spec’s allowed population names: `full`, `mood-regime`, `gate-pass (mood-regime)`, `stored-global`, `stored-mood-regime`.

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:unit -- --runInBand --testPathPatterns="ExpressionDiagnosticsController.recommendations" --coverage=false`
2. `npm run test:unit -- --runInBand --testPathPatterns="monteCarloReportGenerator.recommendations" --coverage=false`

### Invariants That Must Remain True

1. Evidence numerators/denominators align with the declared population when the metric is population-derived; scalar metrics do not alter their denominator to force a population label.
2. Population labels are present for population-derived evidence and report tables where denominators map to an allowed population.
3. No changes to UI layout beyond added labels.

## Completion

- Status: Completed (2026-01-13)

## Outcome

- Population metadata now accompanies recommendation evidence, with UI/report formatters displaying `Population: NAME (N=COUNT)` when a population-backed denominator is present.
- Scalar evidence items retain their original numerator/denominator semantics while still gaining population labels when a truthful population count is available.
- Tests for the recommendations UI and report rendering were updated to assert population labels.
