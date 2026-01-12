# CHAMONCARCLAASS-004: Suppress Low-Confidence Sensitivity Tables

## Summary

When baseline expression hits are fewer than 5, suppress or replace the global sensitivity tables with an explicit "Insufficient data" message in both the report and HTML diagnostics UI.

## Priority: Low | Effort: Low

## Status: Completed

## Current State (Reassessed)

- The report and UI already show a low-confidence warning but still render the global sensitivity tables.
- There is no unit test coverage asserting low-confidence behavior for the global sensitivity section.

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` | Update |
| `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js` | Update |
| `tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js` | Add or Update tests |
| `tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js` | Add or Update tests |

## Out of Scope

- **DO NOT** change the existing low-confidence warning text outside the sensitivity section
- **DO NOT** remove individual clause sensitivity output
- **DO NOT** alter Monte Carlo sampling or threshold logic
- **DO NOT** change report formatting in unrelated sections

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- --testPathPatterns "expressionDiagnostics" --coverage=false
```

### Invariants That Must Remain True

- If baseline hits >= 5, the full sensitivity tables still render
- If baseline hits < 5, sensitivity tables are omitted or replaced with a single concise notice
- Clause-level sensitivity remains available regardless of baseline hit count

## Notes

- Pick one behavior (suppress or replace) and apply it consistently in both outputs.
- Add a unit test for a low-hit fixture to verify the message and the absence of tables.

## Outcome

Global sensitivity tables are now replaced with a single "Insufficient data" message when baseline hits are below 5, and unit tests cover both low-confidence suppression and normal rendering for report and UI.
