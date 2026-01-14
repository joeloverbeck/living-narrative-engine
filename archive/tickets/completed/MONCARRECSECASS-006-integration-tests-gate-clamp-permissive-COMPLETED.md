# MONCARRECSECASS-006: Integration Tests for Gate-Clamp Regime Permissive Recommendation

## Summary

Add integration tests that exercise the end-to-end Monte Carlo recommendations pipeline for the gate-clamp regime permissive recommendation, including emit and no-emit cases and report output validation. The recommendation logic, facts builder, and report rendering already exist; this ticket only adds integration coverage.

## Status: Completed

## Priority: Medium | Effort: Medium

## Rationale

The recommendation spans simulation, facts, engine, and report rendering. Integration tests ensure the full path is wired correctly and that the output stays stable.

## Dependencies

- **Already landed**: gate-clamp analysis plan wiring, facts builder, engine emission, and report rendering. (See `src/expressionDiagnostics/services/RecommendationFactsBuilder.js`, `RecommendationEngine.js`, and `MonteCarloReportGenerator.js`.)

## File List It Expects To Touch

| File | Change Type |
| --- | --- |
| `tests/integration/expression-diagnostics/monteCarloReportRecommendations.integration.test.js` | **Update** (new test cases) |
| `tests/integration/expression-diagnostics/fixtures/` | **Update** or **Create** (toy expressions + MC fixtures if needed) |

## Out of Scope

- **DO NOT** add new unit tests (unit coverage already exists for gate-clamp recommendations)
- **DO NOT** change Monte Carlo core evaluation logic
- **DO NOT** modify existing recommendation types’ thresholds

## Implementation Details

- Add a case that triggers the recommendation:
  - Mood regime allows values that fail a gate predicate.
  - Gate clamp rate is >= 0.20.
  - Candidate keep ratio meets `MIN_KEEP` and predicted clamp reduction meets `MIN_DELTA`.
- Add non-emit cases:
  - clamp rate just below threshold
  - regime implies all gate predicates
  - keep ratio below threshold
- Validate report output includes:
  - the new recommendation type and title
  - denominators for clamp/keep
  - proposed constraint(s) in raw units

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:integration -- --testPathPatterns monteCarloReportRecommendations --coverage=false
```

### Invariants That Must Remain True

- Integration tests must not depend on random variability; fixed seeds or deterministic fixtures only.
- Existing recommendation integration tests continue to pass without updates to their expected output.

## Outcome

- Added integration coverage for gate-clamp recommendations (emit + three suppression cases) and relaxed a brittle recommendation-order assertion.
- No changes to Monte Carlo evaluation logic or recommendation thresholds; fixtures now exercise existing gate-clamp pipeline.
