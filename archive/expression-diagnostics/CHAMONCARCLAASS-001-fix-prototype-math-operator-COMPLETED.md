# CHAMONCARCLAASS-001: Fix Prototype Math Operator in Report

## Summary

Update the Monte Carlo report prototype math header to display the correct operator (<= for low/upper-bound clauses, >= for high/lower-bound clauses), matching the underlying clause direction.

## Status: Completed

## Priority: High | Effort: Low

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` | Update |
| `tests/unit/expressionDiagnostics/monteCarloReportGenerator.test.js` | Update or Create |

## Out of Scope

- **DO NOT** change reachability calculations in `BranchReachability.js`
- **DO NOT** change clause extraction logic in `PathSensitiveAnalyzer.js`
- **DO NOT** change report section ordering or wording outside the prototype math header
- **DO NOT** modify HTML UI output in `src/domUI/`

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- --testPathPatterns "monteCarloReportGenerator" --coverage=false
```

### Invariants That Must Remain True

- Prototype math analysis content must still match the computed reachability results
- Output formatting remains stable aside from the operator symbol
- No changes to Monte Carlo simulation outcomes or thresholds

## Notes

### Reassessed Assumptions & Scope

- The operator is available on `blocker.hierarchicalBreakdown.comparisonOperator`; it is **not** part of the `PrototypeConstraintAnalyzer` result.
- The operator must be plumbed from `#extractEmotionConditions()` to `#formatPrototypeAnalysis()` (not derived from the analysis object).
- Continue to ignore clause extraction/calculation logic; only adjust report header formatting.

### Implementation Notes

- Update `#formatPrototypeAnalysis()` to accept the operator from the caller.
- Pass the operator through `#generatePrototypeMathSection()` / `#extractEmotionConditions()`.
- Add/adjust a unit test that asserts the header uses `<=` for low direction clauses.

## Outcome

- Updated prototype math header formatting to use the clause operator from `hierarchicalBreakdown`.
- Added a unit test ensuring `<=` is shown for low/upper-bound prototype clauses.
- Scope remained report-only formatting; no analysis logic or UI output changes.
