# MONCARSIMIMPREP-005: Population-Specific Confidence Labels

## Summary

Update low-confidence warnings in the Monte Carlo report to include population name, N, and hits so the confidence context is explicit.

## Priority: Medium | Effort: Small

## Assumptions & Corrections

- Reference report is `reports/monte-carlo-simulator-improvements-report.md` (the repo does not include `reports/monte-carlo-simulator-report.md`).
- The low-confidence warning lives in the **Global Expression Sensitivity Analysis** section and is generated inside `#generateGlobalSensitivitySection`.
- Use the existing test file `tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js` instead of creating a new file.

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` | Update |
| `tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js` | Update |

## Out of Scope

- **DO NOT** change the thresholds that trigger low-confidence warnings.
- **DO NOT** alter any other report sections or formatting.
- **DO NOT** modify simulator sampling or stats.

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- --testPathPatterns=monteCarloReportGenerator.test.js --coverage=false
```

### Invariants That Must Remain True

- Every low-confidence warning includes population label, `N`, and hit count.
- Existing confidence thresholds and calculations remain unchanged.

## Status

Completed.

## Outcome

- Updated the global sensitivity low-confidence warning to include population name, sample size, and estimated hits.
- Adjusted the existing MonteCarlo report unit test to cover the new warning details instead of adding a new test file.
