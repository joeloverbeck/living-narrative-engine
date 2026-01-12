# MONCARSENGRA-001: Domain-Aware Sensitivity Granularity + Effective Thresholds

## Summary

Align sensitivity grids and display output with domain granularity by:
- deriving step size from variable domains, and
- surfacing integer-effective thresholds in both report output and the expression diagnostics UI.

## Priority: High | Effort: Small

## Rationale

Sensitivity grids currently default to a 0.05 step size and display decimal thresholds even for integer-valued domains. The spec (specs/monte-carlo-sensitivity-granularity.md) requires integer step sizes and “effective threshold” clarity in both report and UI outputs. This ticket implements those report/UI changes without altering sampling or evaluation logic.

## Dependencies

- None

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/config/advancedMetricsConfig.js` | **Update** |
| `src/expressionDiagnostics/services/SensitivityAnalyzer.js` | **Update** |
| `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` | **Update** |
| `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js` | **Update** |
| `tests/unit/expressionDiagnostics/services/sensitivityAnalyzer.test.js` | **Update** |
| `tests/unit/expressionDiagnostics/config/advancedMetricsConfig.test.js` | **Update** |
| `tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js` | **Update** |

## Out of Scope

- **DO NOT** modify Monte Carlo sampling behavior
- **DO NOT** change expression evaluation logic
- **DO NOT** add new UI sections or report sections beyond the effective-threshold clarity
- **DO NOT** alter tunable variable detection beyond domain/step-size metadata

## Implementation Details

1. Add a helper in `advancedMetricsConfig.js` to expose step size/granularity for a variable path.
   - Mood axes (`moodAxes.*`, `mood.*`) and traits return integer granularity (step size 1).
   - Floating-point domains (emotions, sexual states, arousal scalars) return existing float step size (0.05).
2. Update `SensitivityAnalyzer` to pass domain-aware step size to:
   - `computeThresholdSensitivity` for per-clause results.
   - `computeExpressionSensitivity` for global results.
3. Extend sensitivity results to include integer-domain metadata:
   - Add `isIntegerDomain` at the result level.
   - Add `effectiveThreshold` per grid row for integer domains (ceil for `>=`/`>`, floor for `<=`/`<`).
4. Report output (`MonteCarloReportGenerator`):
   - Add an **Effective Threshold** column for integer-domain sensitivity tables.
   - Format integer-domain thresholds without trailing decimals.
   - Add a short note under integer-domain tables: “Thresholds are integer-effective; decimals collapse to integer boundaries.”
5. UI output (`ExpressionDiagnosticsController`):
   - Mirror report changes in the global sensitivity table (effective column + integer formatting).
6. Update tests to validate:
   - step sizes are domain-aware in `SensitivityAnalyzer`.
   - integer-domain tables include effective threshold output in the report generator.
   - new granularity helper outputs correct step sizes.

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/expressionDiagnostics/services/sensitivityAnalyzer.test.js tests/unit/expressionDiagnostics/config/advancedMetricsConfig.test.js tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js --coverage=false
```

### Invariants That Must Remain True

- Monte Carlo sampling, stored contexts, and expression evaluation behavior are unchanged.
- The number of steps in grids stays at the current default unless explicitly configured elsewhere.
- Floating-point domains continue to use 0.05 step size.
- Integer domains show effective thresholds in report and UI outputs.

## Status

Completed

## Outcome

- Expanded scope from step-size-only to include effective-threshold display in report/UI, per spec.
- Added domain-aware step sizes and integer effective thresholds in sensitivity outputs.
- Updated/added unit tests for granularity helpers, sensitivity analysis, report output, and UI tables.
