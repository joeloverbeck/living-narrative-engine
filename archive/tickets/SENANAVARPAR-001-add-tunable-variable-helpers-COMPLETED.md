# SENANAVARPAR-001: Add Tunable Variable Helpers and Scalar Epsilon

## Summary
Align sensitivity analysis tunable-variable filtering with the parity spec by centralizing tunable detection in `advancedMetricsConfig`, covering scalar `sexualArousal`/`previousSexualArousal`, and using the helper in `SensitivityAnalyzer` so global sensitivity matches Top Blockers.

## File List
- `src/expressionDiagnostics/config/advancedMetricsConfig.js`
- `src/expressionDiagnostics/services/SensitivityAnalyzer.js`
- `tests/unit/expressionDiagnostics/config/advancedMetricsConfig.test.js`
- `tests/unit/expressionDiagnostics/services/sensitivityAnalyzer.test.js`

## Out of Scope
- Do not modify `MonteCarloReportGenerator` or `MonteCarloSimulator`.
- Do not update UI renderers or report formatting.
- Do not add new simulation context fields.

## Acceptance Criteria

### Specific tests that must pass
- `npm run test:unit -- --testPathPattern="advancedMetricsConfig|sensitivityAnalyzer"`

### Invariants that must remain true
- Existing near-miss epsilons for nested domains remain unchanged.
- `getEpsilonForVariable` continues to return the default when no domain match is found.
- `SensitivityAnalyzer` behavior is unchanged for existing emotion/sexual paths besides allowing additional tunable families and scalars.
- No new dependencies are introduced in config modules.

## Implementation Notes
- Add a `TUNABLE_VARIABLE_PATTERNS` map covering nested domains (`emotions.*`, `sexualStates.*`, `sexual.*`, `mood.*`, `moodAxes.*`, `traits.*`, `affectTraits.*`) and scalar paths (`sexualArousal`, `previousSexualArousal`).
- Export `isTunableVariable()` and `getTunableVariableInfo()` helpers.
- Extend `advancedMetricsConfig.nearMissEpsilon` with scalar keys for `sexualArousal` and `previousSexualArousal`, and ensure `detectDomain()` recognizes those scalar paths (keep default fallback).
- Update `SensitivityAnalyzer` to use `isTunableVariable()` for filtering in both sensitivity methods.
- Add unit tests covering positive/negative matches and scalar metadata, plus sensitivity selection for scalar and moodAxes paths.

## Status
Completed

## Outcome
- Added tunable-variable helpers and scalar epsilon entries in `advancedMetricsConfig`, including moodAxes detection for epsilons.
- Updated `SensitivityAnalyzer` filtering to use the new helper so scalar and moodAxes candidates participate in sensitivity analysis.
- Extended unit coverage for tunable helper metadata and scalar/moodAxes sensitivity selection.
- Left `MonteCarloReportGenerator`/`MonteCarloSimulator` and UI output unchanged (original ticket scope expanded to include `SensitivityAnalyzer`).
