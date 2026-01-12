# SENANAVARPAR-004: Integration Test for Sensitivity Parity with Scalars

## Summary
Add an integration test that verifies `sexualArousal` appears in both the Top Blockers "Most Tunable Condition" line and Global Expression Sensitivity output for the same expression.

## Assumptions (Updated)
- Scalar tunable detection is already implemented via `advancedMetricsConfig` + `isTunableVariable` in production code.
- Unit coverage already exists for scalar tunable handling; the remaining gap is a single end-to-end parity check in integration tests.

## File List
- `tests/integration/expression-diagnostics/sensitivityScalarParity.integration.test.js`

## Out of Scope
- Do not modify production code (scalar parity is already implemented).
- Do not change existing integration test files.
- Do not add new fixtures outside the test file.

## Acceptance Criteria

### Specific tests that must pass
- `npm run test:integration -- --testPathPatterns="sensitivityScalarParity"`

### Invariants that must remain true
- Integration tests use existing test container patterns.
- No reliance on network calls or external services.
- Test data remains deterministic and self-contained.

## Implementation Notes
- Build a compound expression with `sexualArousal >= 0.35` and a second leaf that keeps `sexualArousal` as the most tunable candidate.
- Run Monte Carlo simulation with a sample size large enough to reliably capture near-miss data.
- Assert that the Top Blockers "Most Tunable Condition" line includes `sexualArousal`.
- Assert that Global Sensitivity includes a `sexualArousal` entry.

## Outcome
- Added a deterministic integration test that generates a report showing `sexualArousal` as the most tunable condition and in global sensitivity.
- No production code changes were required; scope remained purely test coverage.

## Status
- Completed
