# CHAMONCARCLAASS-002: Include Scalar Tunables in Global Sensitivity

## Summary

Confirm that global expression sensitivity includes scalar tunables like `sexualArousal` (not just `emotions.*`) and that coverage already asserts these appear in top candidates when appropriate.

## Status: Completed

## Priority: High | Effort: Low

## Reassessed Assumptions

- `computeGlobalSensitivityData()` already includes scalar tunables via `isTunableVariable()` and does not filter to emotion-only paths.
- Existing unit coverage already asserts `sexualArousal` and `previousSexualArousal` are selected as candidates when their scores are high.
- `computeExpressionSensitivity()` accepts scalar paths as-is (JSON Logic `{"var": "sexualArousal"}`), so no additional handling is needed.

## Updated Scope

- Verify existing behavior and tests; no code changes required unless regressions are found.

## Files to Touch

| File | Change Type |
|------|-------------|
| `tests/unit/expressionDiagnostics/services/sensitivityAnalyzer.test.js` | Verify (no changes needed) |

## Out of Scope

- **DO NOT** change tuning regex definitions in `src/expressionDiagnostics/config/advancedMetricsConfig.js`
- **DO NOT** adjust scoring weights for `computeGlobalSensitivityData()`
- **DO NOT** modify report/HTML rendering
- **DO NOT** alter Monte Carlo sampling or random state generation

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- --testPathPatterns "sensitivityAnalyzer" --coverage=false
```

### Invariants That Must Remain True

- `isTunableVariable()` behavior remains unchanged for existing emotion paths
- Global sensitivity still selects candidates based on the current scoring formula
- Top blockers analysis remains consistent for emotion-only expressions

## Notes

- Existing tests already cover scalar tunables (`sexualArousal`, `previousSexualArousal`) in global sensitivity selection.

## Outcome

- No code changes were needed because global sensitivity already includes scalar tunables and unit coverage already asserts `sexualArousal`/`previousSexualArousal` selection.
- Work completed as a verification-only pass with the existing unit test suite.
