# CHAMONCARCLAASS-003: Share Sensitivity Selection Between Report and UI

## Summary

Verify that sensitivity candidate selection is already shared between the Markdown report and HTML diagnostics UI so both surfaces display the same top tunable variables (including scalar paths like `sexualArousal`).

## Status: Completed

## Priority: Medium | Effort: Medium

## Reassessed Assumptions

- Sensitivity candidate selection is already centralized in `SensitivityAnalyzer.computeGlobalSensitivityData()`.
- Both report generation (`ReportOrchestrator`) and the HTML UI (`ExpressionDiagnosticsController`) call the same `SensitivityAnalyzer` method.
- Scalar tunables such as `sexualArousal` are already included via `isTunableVariable()` and covered by existing unit tests.

## Updated Scope

- Verification-only: confirm shared selection logic and existing coverage; no code changes required unless regressions are discovered.

## Files to Touch

| File | Change Type |
|------|-------------|
| `tests/unit/expressionDiagnostics/services/sensitivityAnalyzer.test.js` | Verify (no changes needed) |

## Out of Scope

- **DO NOT** change UI styling or layout in HTML/CSS
- **DO NOT** reformat report sections other than the sensitivity variable list
- **DO NOT** alter sensitivity scoring weights or threshold constants
- **DO NOT** change any Monte Carlo simulation inputs

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- --testPathPatterns "expressionDiagnostics" --coverage=false
```

### Invariants That Must Remain True

- The same sensitivity selection logic is used in both report and HTML paths
- The number of displayed candidates and ranking order remain consistent across outputs
- Existing emotion-only sensitivity outputs remain unchanged except where scalar tunables should now appear

## Notes

- The shared helper already exists in `SensitivityAnalyzer.computeGlobalSensitivityData()`.
- Existing unit tests already validate scalar candidates; no new parity test is required unless behavior diverges.

## Outcome

- No code changes required; report and UI already use the shared `SensitivityAnalyzer` selection logic.
- Coverage already includes scalar tunables like `sexualArousal`, so the ticket closed as verification-only.
