# PROCRESUGREC-005: Add Integration Tests for Prototype Creation Recommendation

## Summary

Add integration coverage for the prototype creation recommendation within the expression diagnostics report pipeline, ensuring schema-valid payloads and stable ordering.

**Assumption Correction (discovered during implementation):** The original ticket assumed integration tests could be added without code changes. However, `MonteCarloReportGenerator` was not wiring `prototypeFitRankingService` to `RecommendationFactsBuilder` nor `prototypeSynthesisService` to `RecommendationEngine`, which prevented `prototype_create_suggestion` from ever emitting. Minimal wiring fixes are included in scope.

## Priority: Medium | Effort: Medium

## Rationale

Integration tests validate the full diagnostics flow (facts -> ranking -> recommendation emission) and ensure the recommendation behaves correctly with real report inputs.

## Dependencies

- PROCRESUGREC-001 (facts builder)
- PROCRESUGREC-003 (recommendation emission)

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` | **Update** - wire dependencies |
| `src/dependencyInjection/registrations/uiRegistrations.js` | **Update** - pass prototypeSynthesisService |
| `tests/integration/expression-diagnostics/monteCarloReportRecommendations.integration.test.js` | **Update** |

## Out of Scope

- **DO NOT** change MonteCarlo report schemas
- **DO NOT** add performance or memory tests

## Implementation Details

### Wiring Fixes (minimal changes)

1. `MonteCarloReportGenerator` constructor: Accept `prototypeSynthesisService`
2. Line ~2683: Pass `prototypeFitRankingService` to `RecommendationFactsBuilder`
3. Line ~2708: Pass `prototypeSynthesisService` to `RecommendationEngine`
4. `uiRegistrations.js`: Resolve and pass `IPrototypeSynthesisService`

### Integration Tests

- Add integration cases:
  - Recommendation present with schema-valid payload (A && B path).
  - Recommendation present via gap signal (C path).
  - No emission when fit is good and gap is low.
  - Stable sorting when multiple recommendations exist.
- Use mock services that exercise both A/B and C paths.
- Verify deterministic `id`, `type`, and `relatedClauseIds` ordering.

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:integration -- tests/integration/expression-diagnostics/monteCarloReportRecommendations.integration.test.js --coverage=false
```

### Invariants That Must Remain True

- No changes to existing report ordering across unrelated recommendations.
- Integration test uses deterministic fixtures and fixed sample sizes.
- Recommendation payloads are schema-valid and numeric metrics are finite.

## Definition of Done

- [x] Integration tests cover emit and no-emit cases.
- [x] Sorting stability is asserted when multiple recommendations exist.
- [x] All specified integration tests pass.

## Outcome

**Status**: ✅ Completed

### Implementation Summary

1. **Wiring fixes applied**:
   - `MonteCarloReportGenerator` now accepts `prototypeSynthesisService` in constructor
   - `RecommendationFactsBuilder` receives `prototypeFitRankingService` to build `prototypeFit`, `gapDetection`, and `targetSignature` facts
   - `RecommendationEngine` receives `prototypeSynthesisService` to synthesize new prototypes
   - `uiRegistrations.js` updated to resolve and pass `IPrototypeSynthesisService`

2. **Integration tests added** (4 new test cases):
   - `emits prototype_create_suggestion when A && B path triggers` - Tests no usable prototype + improved fit scenario
   - `emits prototype_create_suggestion when C path triggers` - Tests gap signal scenario
   - `does not emit prototype_create_suggestion when fit is good and gap is low` - Tests no-emit case
   - `maintains stable sorting when multiple recommendations exist` - Tests deterministic ordering

3. **Test helper added**:
   - `createSimulationResultWithMinimalClauseData()` - Provides minimal clause/prototype data needed for `RecommendationEngine` to process recommendations (avoids early exit)

4. **Bug fix discovered**:
   - Mock used `nearestDistancePercentile` but code expects `distancePercentile` - fixed in all test cases

### Test Results

```
Test Suites: 1 passed, 1 total
Tests:       10 passed, 10 total (4 new prototype_create_suggestion tests)
```

All integration tests pass with proper coverage of emit and no-emit paths.
