# PRODISCHASUGASS-002: Include sexualArousal In Global Sensitivity

## Summary

Confirm global sensitivity analysis includes scalar tunables like `sexualArousal` and document existing test coverage for scalar paths.

## Status: Completed

## Priority: High | Effort: Medium

## Rationale

Reassessment against `specs/prototype-discovery-chatgpt-suggestions-assessment.md` and current tests shows scalar tunables are already included in global sensitivity, with both unit and integration coverage asserting `sexualArousal` appears in the report output.

## File List (Expected to Touch)

| File | Change Type |
|------|-------------|
| `tickets/PRODISCHASUGASS-002-include-sexual-arousal-in-global-sensitivity.md` | **Update** |

## Out of Scope

- No code changes required unless the scalar regression is reproduced.

## Acceptance Criteria

### Tests

- `npm run test:unit -- --testPathPatterns sensitivityAnalyzer --coverage=false`
- `npm run test:integration -- --testPathPatterns sensitivityScalarParity --coverage=false`

### Invariants

- Global sensitivity selection includes scalar variable paths (e.g., `sexualArousal`) when they rank in the top tunables.
- The tunability score computation and ordering remain unchanged for existing emotion-path variables.
- Existing sensitivity warnings for low sample counts remain intact.

## Implementation Notes

- `computeGlobalSensitivityData()` already accepts scalar tunables via `isTunableVariable`.
- Coverage exists in `tests/unit/expressionDiagnostics/services/sensitivityAnalyzer.test.js` and `tests/integration/expression-diagnostics/sensitivityScalarParity.integration.test.js`; no new fixture file needed.

## Outcome

- Actual changes: ticket reassessment and documentation update only.
- Originally planned: code change to handle scalars plus new fixture and test file.
