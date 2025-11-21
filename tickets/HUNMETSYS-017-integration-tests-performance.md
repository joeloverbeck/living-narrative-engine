# HUNMETSYS-017: Integration Tests & Performance Validation

**Status:** Not Started  
**Phase:** 5 - Integration Testing  
**Priority:** High  
**Estimated Effort:** 10 hours  
**Dependencies:** HUNMETSYS-001-016 (all previous tickets)

## Objective

Create comprehensive integration and performance tests for the complete metabolism system, validating end-to-end workflows and performance targets.

## Context

With all metabolism components, operations, and rules implemented, we need to verify:
- Complete hunger cycle works (eat → digest → burn → state update → body composition)
- Multi-entity turn processing scales acceptably
- GOAP integration works (AI seeks food appropriately)
- Performance targets met (<100ms per turn for 100 entities)

## Files to Touch

### New Files (8+)

**Integration Tests:**
1. `tests/integration/mods/metabolism/eatAction.test.js`
2. `tests/integration/mods/metabolism/turnProcessing.test.js`
3. `tests/integration/mods/metabolism/hungerCycle.test.js`
4. `tests/integration/goap/hungerGoals.test.js`

**E2E Tests:**
5. `tests/e2e/metabolism/completeHungerCycle.test.js`
6. `tests/e2e/metabolism/multiEntityProcessing.test.js`

**Performance Tests:**
7. `tests/performance/metabolism/turnProcessing.performance.test.js`
8. `tests/performance/metabolism/scalability.performance.test.js`

## Test Categories

### 1. Integration Tests - Eat Action
**File:** `tests/integration/mods/metabolism/eatAction.test.js`

**Tests:**
- ✅ Eating food adds bulk to buffer
- ✅ Eating removes item from inventory
- ✅ Cannot eat when buffer full
- ✅ Cannot eat incompatible fuel types
- ✅ Eating dispatches item_consumed event

### 2. Integration Tests - Turn Processing
**File:** `tests/integration/mods/metabolism/turnProcessing.test.js`

**Tests:**
- ✅ BURN_ENERGY reduces current_energy each turn
- ✅ DIGEST_FOOD converts buffer to energy each turn
- ✅ UPDATE_HUNGER_STATE recalculates state each turn
- ✅ UPDATE_BODY_COMPOSITION updates anatomy after threshold
- ✅ Processing order correct (burn → digest → update state → update body)

### 3. Integration Tests - Complete Hunger Cycle
**File:** `tests/integration/mods/metabolism/hungerCycle.test.js`

**Tests:**
- ✅ Full cycle: hungry → eat → digest → satiated
- ✅ Energy increases from digestion over multiple turns
- ✅ Hunger state improves as energy increases
- ✅ Body composition normalizes after recovery
- ✅ Overeating prevented when buffer full

### 4. Integration Tests - GOAP Hunger Goals
**File:** `tests/integration/goap/hungerGoals.test.js`

**Tests:**
- ✅ Goal activates when is_hungry returns true
- ✅ Goal activates when predicted_energy < 500
- ✅ Goal creates plan to find and eat food
- ✅ Goal does NOT activate when digesting (predicted_energy sufficient)
- ✅ AI doesn't spam eat actions

### 5. E2E Test - Complete Hunger Cycle
**File:** `tests/e2e/metabolism/completeHungerCycle.test.js`

**Scenario:**
```javascript
// 1. Create hungry actor (energy: 500/1000)
// 2. Create food (bread: energy 200, bulk 30)
// 3. Actor eats food
// 4. Simulate 10 turns
// 5. Verify:
//    - Buffer decreased from 30 to 0 (digested)
//    - Energy increased from 500 to ~512 (gained 32, burned 20)
//    - Hunger state improved from hungry to neutral
```

### 6. E2E Test - Multi-Entity Processing
**File:** `tests/e2e/metabolism/multiEntityProcessing.test.js`

**Scenario:**
```javascript
// 1. Create 10 actors with varying energy levels
// 2. Simulate 5 turns
// 3. Verify:
//    - All actors' energy decreased correctly
//    - All actors' hunger states updated
//    - No race conditions or cross-contamination
```

### 7. Performance Test - Turn Processing
**File:** `tests/performance/metabolism/turnProcessing.performance.test.js`

**Performance Targets:**
- ✅ 100 entities processed in <100ms per turn
- ✅ Memory usage stable (no leaks)
- ✅ GC pressure acceptable (<10% time in GC)

**Test:**
```javascript
it('should process 100 entities per turn in <100ms', async () => {
  const entities = await createEntities(100);
  const startTime = performance.now();
  await processTurnForAllEntities(entities);
  const duration = performance.now() - startTime;

  expect(duration).toBeLessThan(100);
});
```

### 8. Performance Test - Scalability
**File:** `tests/performance/metabolism/scalability.performance.test.js`

**Tests:**
- ✅ Linear scaling: 200 entities = ~2x time of 100 entities
- ✅ No exponential slowdown with entity count
- ✅ Memory usage scales linearly

## Out of Scope

**Not Included:**
- ❌ Visual/UI testing (manual QA)
- ❌ Browser-specific testing
- ❌ Stress testing (>1000 entities)
- ❌ AI behavior tuning tests

## Acceptance Criteria

**Must Have:**
- ✅ All 8 test files created
- ✅ All integration tests pass
- ✅ All E2E tests pass
- ✅ All performance tests pass
- ✅ Performance target met: <100ms per turn for 100 entities
- ✅ No memory leaks detected
- ✅ GOAP integration working (AI eats when hungry, doesn't spam)
- ✅ Complete hunger cycle verified end-to-end

**Coverage:**
- ✅ Happy path: eat → digest → recover
- ✅ Edge cases: overeating, starvation, critical state
- ✅ Multi-entity scenarios
- ✅ Performance under load

## Testing Commands

```bash
# Run all integration tests
npm run test:integration tests/integration/mods/metabolism/
npm run test:integration tests/integration/goap/hungerGoals.test.js

# Run all E2E tests
npm run test:e2e tests/e2e/metabolism/

# Run performance tests
npm run test:performance tests/performance/metabolism/

# Run full test suite
npm run test:ci
```

## Performance Benchmarks

**Target Metrics:**
```
Entities: 100
Turns: 1
Operations per entity: 4 (burn, digest, update state, update body)
Total operations: 400
Target time: <100ms
Target per-operation: <0.25ms
```

**Acceptance:**
- ✅ Average <100ms
- ✅ p95 <150ms
- ✅ p99 <200ms
- ✅ No outliers >500ms

## References

- **Spec:** Section "Testing Strategy" (p. 29-32)
- **Previous:** All HUNMETSYS-001-016
- **Next:** HUNMETSYS-018 (Edge cases)
