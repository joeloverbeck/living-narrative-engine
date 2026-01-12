# PRODISCHASUGASS-003: Align Report And UI Sensitivity Selection

## Status: Completed

## Summary

Confirm the report output and the expression-diagnostics UI show the same top tunables, including scalar paths like `sexualArousal`, and update documentation scope to reflect the existing shared implementation.

## Priority: Medium | Effort: Medium

## Rationale

The report and UI already use the same selection logic via `SensitivityAnalyzer.computeGlobalSensitivityData()`. The remaining work is verification, not new code extraction.

## File List (Expected to Touch)

| File | Change Type |
|------|-------------|
| `tests/unit/expressionDiagnostics/services/sensitivityAnalyzer.test.js` | **Verify** |
| `tests/integration/expression-diagnostics/sensitivityScalarParity.integration.test.js` | **Verify** |
| `tickets/PRODISCHASUGASS-003-align-report-and-ui-sensitivity-selection.md` | **Update** |

## Out of Scope

- Do not change the UI layout or text labels for sensitivity sections.
- Do not adjust the Monte Carlo sampling parameters or thresholds.
- Do not modify expression data or fixtures outside the new tests.

## Acceptance Criteria

### Tests

- `npm run test:unit -- --testPathPatterns sensitivityAnalyzer --coverage=false`
- `npm run test:integration -- --testPathPatterns sensitivityScalarParity --coverage=false`

### Invariants

- Report and UI already use `SensitivityAnalyzer.computeGlobalSensitivityData()` and yield identical variable lists for the same input data.
- The selection algorithm remains consistent with the existing weighting formula.
- No changes to unrelated diagnostics sections (gate pass rates, intensity distributions, gap detection).

## Implementation Notes

- No new helper needed: selection is already centralized in `SensitivityAnalyzer`.
- Validation focuses on scalar tunables (e.g., `sexualArousal`) and parity between report/UI outputs.

## Outcome

Confirmed shared selection already exists via `SensitivityAnalyzer`, with scalar tunables covered by existing unit and integration tests. No code changes required beyond updating this ticket scope.
