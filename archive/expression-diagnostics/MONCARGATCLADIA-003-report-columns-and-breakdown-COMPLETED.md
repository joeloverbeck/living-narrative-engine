# MONCARGATCLADIA-003: Add Gate Clamp Metrics To Monte Carlo Report

## Summary

Surface existing gate clamp + conditional pass (given gate) metrics in the Monte Carlo report's condition breakdown table for emotion-threshold clauses. The per-gate breakdown already exists in the Prototype Math Analysis section, so no new section is required for this ticket. Effective pass is derivable from Fail% | mood-pass, so it is optional and not added here.

## Priority: Medium | Effort: Medium

## Rationale

The report is the primary artifact for analysis. It must expose the new metrics with clear denominators and optional per-gate detail for deeper tuning.

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` | **Modify** |
| `tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js` | **Modify** |
| `tests/integration/expression-diagnostics/monteCarloReport.integration.test.js` | **Modify** |

## Out of Scope

- **DO NOT** change Monte Carlo simulation logic or sampling
- **DO NOT** modify the non-report UI (`expression-diagnostics.html`)
- **DO NOT** add new CSS styles
- **DO NOT** add a separate per-gate breakdown section beyond the existing Prototype Math Analysis
- **DO NOT** add a standalone effective pass column (it is derivable from Fail% | mood-pass)

## Acceptance Criteria

### Tests

- `npm run test:unit -- --testPathPatterns=tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js --coverage=false`
- `npm run test:integration -- --testPathPatterns=tests/integration/expression-diagnostics/monteCarloReport.integration.test.js --coverage=false`

### Invariants

- Gate clamp + pass|gate columns appear only for emotion-threshold clauses and are labeled with explicit denominators.
- Percent + count formatting uses mood-regime denominators as specified in the spec.
- Existing per-gate breakdown remains optional (only rendered when gate data is available) and does not affect other report sections.

## Status: Completed

## Outcome

- Changed: condition breakdown tables now surface gate clamp and pass|gate metrics for emotion-threshold leaves with explicit counts/denominators.
- Changed: unit and integration tests updated to cover the new columns and legend entries.
- Unchanged: effective pass column remains omitted (derivable from Fail% | mood-pass); per-gate breakdown remains in Prototype Math Analysis; simulation logic untouched.
