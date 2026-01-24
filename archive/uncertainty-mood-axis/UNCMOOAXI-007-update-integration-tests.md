# UNCMOOAXI-007: Update Integration Tests

## Summary

Add integration tests to verify the uncertainty axis works correctly end-to-end across the Monte Carlo simulation pipeline, including state generation, normalization, and sampling distribution.

## Priority: Medium | Effort: Medium

## Rationale

Integration tests verify that uncertainty:
- Is included in the MOOD_AXES constant as the 10th axis
- Flows through the full state generation pipeline
- Is correctly sampled in Monte Carlo random state generation
- Properly normalizes from [-100, 100] to [-1, 1]
- Produces varied values across uniform and gaussian distributions

## Dependencies

- **UNCMOOAXI-001** through **UNCMOOAXI-002** must be complete (constant additions)

## Files to Touch

| File | Change Type |
|------|-------------|
| `tests/integration/expression-diagnostics/uncertaintyAxis.integration.test.js` | **Create** - New integration test file |

## Out of Scope

- **DO NOT** modify source files
- **DO NOT** modify unit tests - that's UNCMOOAXI-006
- **DO NOT** modify existing integration tests
- **DO NOT** test prototype intensity calculation (requires data changes)
- **DO NOT** test gate evaluation (service doesn't exist)
- **DO NOT** test epistemic prototypes with uncertainty weights (data not yet updated)

## Corrected Assumptions

### Invalid Assumptions Removed

| Original Assumption | Actual State | Resolution |
|---------------------|--------------|------------|
| `createIntegrationTestEnvironment()` exists | Does NOT exist | Use direct instantiation pattern |
| Container-based DI resolution | Tests use direct class instantiation | Follow existing test pattern |
| `IGateEvaluator` service exists | Does NOT exist | Remove gate evaluation tests |
| 9 epistemic emotions have uncertainty | Only 4 exist (awe, curiosity, suspicion, confusion) | Defer to separate ticket |
| Emotions have uncertainty weights | None have weights yet | Defer to separate ticket |

### Deferred to Separate Ticket

- Adding uncertainty weights to emotion prototypes
- Creating additional epistemic emotions
- Gate evaluation with uncertainty conditions
- Prototype intensity calculation tests

## Implementation Details

### New File: tests/integration/expression-diagnostics/uncertaintyAxis.integration.test.js

Follow the proven pattern from `monteCarloNewAxis.integration.test.js`:
- Direct class instantiation with mock logger
- Test state generation pipeline
- Test normalization pipeline
- Test sampling distribution
- Test dynamic sampling
- Test end-to-end pipeline

### Test Categories

1. **MOOD_AXES Constant** - Verifies uncertainty is included as 10th axis
2. **State Generation Pipeline** - Tests uncertainty appears in generated states
3. **Normalization Pipeline** - Tests [-100,100] → [-1,1] transformation
4. **Sampling Distribution** - Tests uniform and gaussian sampling diversity
5. **Dynamic Sampling** - Tests temporal coherence in dynamic mode
6. **End-to-End Pipeline** - Tests complete flow from generation to context

## Acceptance Criteria

### Tests That Must Pass

```bash
# New integration tests pass
npm run test:integration -- tests/integration/expression-diagnostics/uncertaintyAxis.integration.test.js --verbose

# All expression diagnostics integration tests pass
npm run test:integration -- --testPathPattern="expression-diagnostics" --verbose

# Full integration test suite passes
npm run test:integration
```

### Invariants That Must Remain True

1. **Test Independence**: New tests don't affect existing integration tests
2. **Pattern Consistency**: Tests follow established `monteCarloNewAxis` pattern
3. **Environment Cleanup**: Test environment properly cleaned up
4. **Coverage**: All key uncertainty pathways tested

## Verification Commands

```bash
# Run new integration tests
npm run test:integration -- tests/integration/expression-diagnostics/uncertaintyAxis.integration.test.js --verbose

# Run all integration tests
npm run test:integration

# Lint new test file
npx eslint tests/integration/expression-diagnostics/uncertaintyAxis.integration.test.js

# Full CI check
npm run test:ci
```

## Definition of Done

- [x] `uncertaintyAxis.integration.test.js` created
- [x] Tests verify MOOD_AXES includes uncertainty as 10th axis
- [x] Tests verify random state generation includes uncertainty
- [x] Tests verify normalization pipeline handles uncertainty
- [x] Tests verify sampling distribution diversity
- [x] Tests verify dynamic sampling temporal coherence
- [x] Tests verify end-to-end pipeline integrity
- [x] `npm run test:integration` passes completely
- [x] Test file properly linted

## Outcome

**Status**: Complete

**Date Completed**: 2026-01-22

**What Was Done**:
- Created `tests/integration/expression-diagnostics/uncertaintyAxis.integration.test.js`
- Implemented 6 test suites with 12 individual tests
- Tests verify uncertainty axis through Monte Carlo pipeline

**Test Results**:
- All 12 tests passing
- Full integration suite passes
- No regressions in existing tests

**Deferred Items**:
- Epistemic prototype uncertainty weights (separate ticket)
- Gate evaluation with uncertainty conditions (service doesn't exist)
