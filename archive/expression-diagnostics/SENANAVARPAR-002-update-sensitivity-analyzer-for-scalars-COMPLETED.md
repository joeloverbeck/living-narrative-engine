# SENANAVARPAR-002: Validate SensitivityAnalyzer Coverage for Scalar Tunables

## Summary
Validate that `SensitivityAnalyzer` already uses centralized tunable helpers and includes scalar tunables (e.g., `sexualArousal`, `previousSexualArousal`) in sensitivity analysis results. Add or strengthen tests only if coverage is missing.

## Status
Completed

## File List
- `src/expressionDiagnostics/services/SensitivityAnalyzer.js`
- `tests/unit/expressionDiagnostics/services/sensitivityAnalyzer.test.js`

## Out of Scope
- Do not change Monte Carlo simulation logic or context generation.
- Do not modify report generator logic.
- Do not change controller or UI code.

## Acceptance Criteria

### Specific tests that must pass
- `npm run test:unit -- --testPathPattern="sensitivityAnalyzer"`

### Invariants that must remain true
- Existing sensitivity behavior for nested variables (e.g., `emotions.*`, `sexual.*`, `sexualStates.*`) remains unchanged.
- Sensitivity computations still ignore non-numeric thresholds.
- No new warnings/errors are logged for valid inputs.

## Reassessment Notes (2026-01-11)
- `advancedMetricsConfig.js` already defines `TUNABLE_VARIABLE_PATTERNS`, `isTunableVariable`, and `getTunableVariableInfo`, including scalar paths.
- `SensitivityAnalyzer.js` already uses `isTunableVariable` in both `computeSensitivityData` and `computeGlobalSensitivityData`.
- Existing unit tests already cover `sexualArousal` and scalar inclusion in global sensitivity selection.
- No sensitivity sweep context mutation exists in this flow; `computeExpressionSensitivity` updates JSON Logic thresholds directly, so scalar-specific context mutation is not applicable.

## Updated Scope
- Confirm current behavior matches the parity spec.
- Add or strengthen tests only if scalar tunables are missing from coverage (e.g., `previousSexualArousal`).

## Implementation Notes (Revised)
- No production code changes expected unless a missing scalar is discovered.
- If needed, add a focused unit test for `previousSexualArousal` in global sensitivity candidate selection.

## Outcome
- Updated scope to reflect existing helper usage and scalar handling.
- Added a focused unit test for `previousSexualArousal` candidate selection; no production code changes were required.
