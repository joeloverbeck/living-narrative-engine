# MONCARSENGRA-002: Effective Threshold Metadata for Sensitivity Grids

## Summary

Ensure effective-threshold metadata is present on sensitivity grid points for integer-valued domains so downstream renderers can show integer-effective boundaries.

## Priority: High | Effort: Medium

## Status: Completed

## Rationale

Integer-valued inputs make decimal thresholds misleading. Adding `effectiveThreshold` at the data layer lets both report and UI renderers display accurate, domain-appropriate boundaries.

## Dependencies

- **MONCARSENGRA-001** (domain granularity helper in place; already exists via `getSensitivityStepSize` + `isIntegerDomain`)

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/SensitivityAnalyzer.js` | **Verify** (effectiveThreshold already applied here) |
| `src/expressionDiagnostics/config/advancedMetricsConfig.js` | **Verify** (helper exports already present) |
| `tests/unit/expressionDiagnostics/services/sensitivityAnalyzer.test.js` | **Update** |

## Out of Scope

- **DO NOT** modify Monte Carlo sampling behavior
- **DO NOT** change expression evaluation logic or comparison operators
- **DO NOT** change sensitivity grid size/step count beyond using existing inputs
- **DO NOT** add report/UI rendering changes (handled in separate tickets)

## Implementation Details

**Current State (verified before changes):**
- `SensitivityAnalyzer` already annotates grid points with `effectiveThreshold` for integer domains.
- Domain granularity helpers (`isIntegerDomain`, `getSensitivityStepSize`) already exist in `advancedMetricsConfig.js`.
- Report/UI renderers already read `effectiveThreshold` (handled in separate tickets but no changes needed here).

1. Extend the sensitivity grid point shape to include `effectiveThreshold` when the variable path is integer-valued.
   - `>=` or `>`: `effectiveThreshold = Math.ceil(threshold)`
   - `<=` or `<`: `effectiveThreshold = Math.floor(threshold)`
   - For float domains, omit `effectiveThreshold` (or set to `null`) to avoid misleading columns.
2. Ensure `computeThresholdSensitivity` and `computeExpressionSensitivity` apply the same logic.
3. Add unit tests covering:
   - Integer domain inputs with both comparison directions.
   - Float domain inputs where `effectiveThreshold` is absent.

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/expressionDiagnostics/services/monteCarloSimulator.sensitivity.test.js --coverage=false
```

### Invariants That Must Remain True

- Sensitivity pass rates and sample counts remain identical to current outputs.
- Grid thresholds still reflect the raw threshold values used for evaluation.
- No new sensitivity analysis results are generated for non-tunable variables.

## Outcome

- Implemented effective-threshold metadata via `SensitivityAnalyzer` (already present), and added missing unit coverage for `<=` comparisons plus float-domain omission.
- No changes were needed in `MonteCarloSimulator` or `advancedMetricsConfig.js` beyond verifying existing helpers.
