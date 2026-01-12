# PRODISSEXSTAINC-004: Add Integration Tests for Prototype Fit with Sexual States

## Summary

Add integration coverage for prototype fit analysis when expressions reference sexual state prototypes, ensuring all prototype sections include sexual entries.

## Priority: Medium | Effort: Medium

## Status: Completed

## Rationale

Unit tests already cover sexual prototype inclusion and the prerequisites-array fix. We still need an integration-level check that exercises the real services together (PrototypeFitRankingService + MonteCarloReportGenerator) so regressions in wiring or data registry setup are caught.

## Assumptions (Updated)

- `PrototypeFitRankingService` already accepts prerequisites arrays and scans for `sexualStates.*` references.
- Unit tests already verify sexual prototype inclusion in the report generator and controller.
- Integration coverage is missing for the end-to-end flow with real services and registry data.

## Files to Touch

| File | Change Type |
|------|-------------|
| `tests/integration/expression-diagnostics/prototypeFitWithSexualStates.integration.test.js` | Create |
| `tests/fixtures/expressionDiagnostics/sexualStatesOnly.expression.json` | Create (if needed) |

## Out of Scope

- **DO NOT** change production code in `src/`
- **DO NOT** modify existing mods in `data/mods/`
- **DO NOT** update UI snapshots or styling

## Test Scenarios

- Analyze an expression fixture that references sexual states and verify:
  - Prototype Fit leaderboard includes both emotion and sexual prototypes.
  - Implied Prototype rankings include sexual prototypes.
  - Gap Detection includes sexual prototypes.
- Generate a report using real services (not mocks) and verify prototype sections include sexual prototypes.
- Edge case: expression referencing only sexual states shows sexual prototypes in rankings without emotion entries.

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:integration -- --testPathPatterns=prototypeFitWithSexualStates --coverage=false
```

### Invariants That Must Remain True

- Tests do not mutate any files under `data/mods/`.
- Integration tests remain deterministic with fixed sample sizes.
- Existing integration suites are unaffected.

## Outcome

- Added integration coverage using in-memory registry data and a sexual-only fixture rather than relying on live mod expressions.
- No production code changes were required; scope remained test-only with deterministic contexts.
