# MONCARRECINT-003: Impact Definition + Full-Sample Labeling

## Summary

Confirm Impact already uses full-sample rates and update UI/report formatting to show “Impact (full sample)” in signed pp.

## Status

Completed

## Background

The spec requires Impact to be defined as `passWithoutRate - originalPassRate` using the full Monte Carlo population, with explicit labels and pp units. The current ablation calculation already uses full-sample `triggerCount`/`sampleCount`, so the remaining work is labeling/formatting.

## File List (Expected to Touch)

### Existing Files
- `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`
- `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js`
- `tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.recommendations.test.js`
- `tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.recommendations.test.js`

## Out of Scope (MUST NOT Change)

- Ablation algorithm logic beyond the Impact definition.
- Any data fixtures under `data/mods/`.
- Recommendation ranking/sorting logic in `RecommendationEngine`.

## Implementation Details

- Keep Impact computed from full-sample rates only (already true today).
- Update report and UI labels to “Impact (full sample)” or “Impact (full)” and format with a signed pp value.
- Confirm stored-context or mood-regime sample rates are not used in Impact.

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:unit -- --runInBand --testPathPatterns="monteCarloSimulator.ablationImpact" --coverage=false`
2. `npm run test:unit -- --runInBand --testPathPatterns="ExpressionDiagnosticsController.recommendations" --coverage=false`
3. `npm run test:unit -- --runInBand --testPathPatterns="monteCarloReportGenerator.recommendations" --coverage=false`

### Invariants That Must Remain True

1. Impact is always derived from full-sample pass rates.
2. Impact values are formatted in percentage points with a leading `+` for positives.
3. Impact labels explicitly identify the population as full-sample.

## Outcome

- Confirmed ablation impact already uses full-sample rates; no changes needed in simulator or ablation calculator.
- Updated UI and report recommendation labels to “Impact (full sample)” with signed pp formatting and adjusted related tests.
