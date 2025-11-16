# MULACTPLAFIX-005: Comprehensive Test Suite for Multi-Action Planning

**Status**: Ready for Implementation
**Priority**: HIGH
**Phase**: Testing and Validation
**Estimated Effort**: 8 hours
**Dependencies**: MULACTPLAFIX-001, MULACTPLAFIX-002, MULACTPLAFIX-003, MULACTPLAFIX-004
**Blocks**: None

## Objective

Create a comprehensive test suite covering all multi-action planning scenarios, edge cases, and integration points. Verify that all 16 integration tests pass and establish regression testing baseline.

## Scope

This ticket covers **three test categories**:

1. **Core Multi-Action Tests** (7 new tests)
2. **Edge Case Tests** (5 tests)
3. **Backward Compatibility Tests** (4 tests)
4. **Performance Tests** (3 tests)

**Total**: ~19 new tests + verification of existing 16 integration tests

## Test Categories

### 1. Core Multi-Action Tests

These tests verify the fundamental multi-action planning capability.

#### Test 1.1: Exact Multiple Actions

**Scenario**: Distance exactly divisible by task effect

```javascript
it('should plan exactly N actions when N * effect = distance', async () => {
  // Initial: hunger = 100
  // Task: eat (-25 hunger, cost 5)
  // Goal: hunger ≤ 0
  // Expected: 4 actions (100/25 = 4)
  //   After 1: 75
  //   After 2: 50
  //   After 3: 25
  //   After 4: 0 ✓

  const { setup, actor, world } = await createTestSetup();

  actor.components['core:needs'] = { hunger: 100 };

  const task = createTestTask({
    id: 'test:eat',
    cost: 5,
    planningEffects: [{
      type: 'MODIFY_COMPONENT',
      parameters: {
        entity_ref: 'actor',
        component_type: 'core:needs',
        field: 'hunger',
        value: 25,
        mode: 'decrement'
      }
    }]
  });

  const goal = createTestGoal({
    id: 'test:reduce_hunger',
    goalState: { '<=': [{ var: 'state.actor.components.core_needs.hunger' }, 0] }
  });

  await setup.controller.decideTurn(actor, world);

  const events = setup.eventBus.getAll();
  const planCreated = events.find(e => e.type === GOAP_EVENTS.PLANNING_COMPLETED);

  expect(planCreated).toBeDefined();
  expect(planCreated.payload.plan.actions).toHaveLength(4);
  expect(planCreated.payload.plan.actions.every(a => a.id === 'test:eat')).toBe(true);
  expect(planCreated.payload.plan.totalCost).toBe(20); // 4 * 5
});
```

#### Test 1.2: Ceiling Division

**Scenario**: Distance NOT evenly divisible, requires rounding up

```javascript
it('should round up action count when distance not evenly divisible', async () => {
  // Initial: hunger = 90
  // Task: eat (-60 hunger, cost 5)
  // Goal: hunger ≤ 10
  // Distance: 80
  // Actions needed: Math.ceil(80 / 60) = 2
  //   After 1: 30 (not satisfied)
  //   After 2: -30 → 0 (satisfied) ✓

  // ... test implementation
  expect(plan.actions).toHaveLength(2);
});
```

#### Test 1.3: Overshoot Allowed

**Scenario**: Inequality goal allows overshoot

```javascript
it('should allow overshoot for inequality goals', async () => {
  // Initial: hunger = 15
  // Task: eat (-60 hunger)
  // Goal: hunger ≤ 10
  //   After 1: -45 → 0 (satisfies ≤ 10) ✓

  // ... test implementation
  expect(plan.actions).toHaveLength(1);
});
```

#### Test 1.4: Multiple Task Types

**Scenario**: Plan uses different tasks for different fields

```javascript
it('should handle multi-action with different task types', async () => {
  // Initial: hunger = 100, health = 10
  // Tasks: eat (-60 hunger, cost 5), heal (+30 health, cost 5)
  // Goal: hunger ≤ 10 AND health ≥ 80
  // Expected:
  //   - 2 eat actions (100 → 40 → -20/0)
  //   - 3 heal actions (10 → 40 → 70 → 100)
  //   - Total: 5 actions, cost 25

  // ... test implementation
  expect(plan.actions).toHaveLength(5);
  expect(plan.actions.filter(a => a.id === 'test:eat')).toHaveLength(2);
  expect(plan.actions.filter(a => a.id === 'test:heal')).toHaveLength(3);
  expect(plan.totalCost).toBe(25);
});
```

#### Test 1.5: Large Action Sequences

**Scenario**: Many actions required (stress test)

```javascript
it('should handle large action sequences efficiently', async () => {
  // Initial: gold = 0
  // Task: mine (+5 gold, cost 1)
  // Goal: gold ≥ 100
  // Expected: 20 actions (100/5 = 20)

  // ... test implementation
  expect(plan.actions).toHaveLength(20);
  expect(plan.totalCost).toBe(20);
});
```

#### Test 1.6: Zero to Target

**Scenario**: Start from zero, accumulate to goal

```javascript
it('should accumulate from zero to target', async () => {
  // Initial: gold = 0
  // Task: mine (+25 gold)
  // Goal: gold ≥ 75
  // Expected: 3 actions (0 → 25 → 50 → 75)

  // ... test implementation
  expect(plan.actions).toHaveLength(3);
});
```

#### Test 1.7: Exact Target (No Overflow)

**Scenario**: Reach exact target without going over

```javascript
it('should reach exact target without overflow', async () => {
  // Initial: gold = 50
  // Task: mine (+25 gold)
  // Goal: gold = 100
  // Expected: 2 actions (50 → 75 → 100) ✓ Exact

  // ... test implementation
  expect(plan.actions).toHaveLength(2);
  expect(finalState.gold).toBe(100);
});
```

### 2. Edge Case Tests

#### Test 2.1: Cost Limit Exceeded

```javascript
it('should fail gracefully when estimated cost exceeds limit', async () => {
  // Initial: hunger = 100
  // Task: nibble (-1 hunger, cost 10)
  // Goal: hunger ≤ 0, maxCost: 50
  // Estimated: 100 actions * 10 = 1000 >> 50
  // Expected: PLANNING_FAILED (cost_limit_exceeded)

  // ... test implementation
  const planFailed = events.find(e => e.type === GOAP_EVENTS.PLANNING_FAILED);
  expect(planFailed).toBeDefined();
  expect(planFailed.payload.reason).toBe('cost_limit_exceeded');
  expect(planFailed.payload.details.estimatedCost).toBeGreaterThan(50);
});
```

#### Test 2.2: Action Count Limit

```javascript
it('should respect maxActions limit', async () => {
  // Initial: hunger = 1000
  // Task: eat (-60 hunger)
  // Goal: hunger ≤ 0, maxActions: 5
  // Need 17 actions, limit is 5
  // Expected: PLANNING_FAILED (action_limit_exceeded)

  // ... test implementation
  expect(planFailed.payload.reason).toBe('action_limit_exceeded');
});
```

#### Test 2.3: Impossible Goal (Wrong Direction)

```javascript
it('should detect impossible goal when task effect is wrong direction', async () => {
  // Initial: hunger = 100
  // Task: eat_more (+20 hunger) ← WRONG!
  // Goal: hunger ≤ 10
  // Expected: PLANNING_FAILED (search_exhausted)

  // ... test implementation
  expect(planFailed.payload.reason).toBe('search_exhausted');
});
```

#### Test 2.4: Task Reuse Limit

```javascript
it('should respect task maxReuse limit', async () => {
  // Initial: hunger = 1000
  // Task: eat (-60 hunger, maxReuse: 5)
  // Goal: hunger ≤ 0
  // Need 17 actions, but maxReuse = 5
  // Expected: PLANNING_FAILED or plan with other tasks

  // ... test implementation
  const eatCount = plan.actions.filter(a => a.id === 'test:eat').length;
  expect(eatCount).toBeLessThanOrEqual(5);
});
```

#### Test 2.5: No Applicable Tasks

```javascript
it('should fail when no tasks are applicable', async () => {
  // Initial: hunger = 100
  // Task: eat (requires: inventory.food > 0)
  // Inventory: empty
  // Goal: hunger ≤ 10
  // Expected: PLANNING_FAILED (search_exhausted)

  // ... test implementation
  expect(planFailed.payload.reason).toBe('search_exhausted');
});
```

### 3. Backward Compatibility Tests

These tests verify that existing single-action scenarios still work.

#### Test 3.1: Single Action Sufficient

```javascript
it('should maintain backward compatibility with single-action scenarios', async () => {
  // Initial: hunger = 80
  // Task: eat (-60 hunger)
  // Goal: hunger ≤ 30
  // Expected: 1 action (80 → 20 ✓)

  // ... test implementation
  expect(plan.actions).toHaveLength(1);
});
```

#### Test 3.2: Component-Only Goals

```javascript
it('should handle component-only goals without numeric constraints', async () => {
  // Initial: no 'core:armed' component
  // Task: equip_weapon (adds 'core:armed' component)
  // Goal: has_component('actor', 'core:armed')
  // Expected: 1 action

  // ... test implementation
  expect(plan.actions).toHaveLength(1);
  expect(finalState['actor:core:armed']).toBeDefined();
});
```

#### Test 3.3: Mixed Component + Numeric Goals

```javascript
it('should handle mixed component and numeric goals', async () => {
  // Goal: has_component('actor', 'core:armed') AND hunger ≤ 10
  // Expected: Plan with equip + eat actions

  // ... test implementation
  expect(plan.actions.some(a => a.id === 'test:equip')).toBe(true);
  expect(plan.actions.some(a => a.id === 'test:eat')).toBe(true);
});
```

#### Test 3.4: Complex Nested Logic

```javascript
it('should handle complex nested logic in goals', async () => {
  // Goal: (hunger ≤ 10 OR health ≥ 80) AND position = 'home'
  // Expected: Valid plan satisfying complex condition

  // ... test implementation
  expect(plan).toBeDefined();
  expect(isGoalSatisfied(finalState, goal)).toBe(true);
});
```

### 4. Performance Tests

#### Test 4.1: Large Plans Performance

**File**: `tests/performance/goap/multiActionPlanning.performance.test.js`

```javascript
it('should plan 20-action sequences in < 100ms', () => {
  // Measure planning time for 20 identical actions
  // Expected: < 100ms

  const startTime = performance.now();
  const plan = planner.plan(actor, goal, tasks, initialState);
  const endTime = performance.now();

  expect(endTime - startTime).toBeLessThan(100);
  expect(plan.actions).toHaveLength(20);
});
```

#### Test 4.2: Node Expansion Efficiency

```javascript
it('should expand minimal nodes with enhanced heuristic', () => {
  // Compare node expansion count with vs without enhanced heuristic
  // Expected: 20-30% reduction with enhanced heuristic

  const withoutHeuristic = planWithOldHeuristic();
  const withHeuristic = planWithEnhancedHeuristic();

  const reduction = (withoutHeuristic.nodesExpanded - withHeuristic.nodesExpanded) / withoutHeuristic.nodesExpanded;
  expect(reduction).toBeGreaterThan(0.2); // At least 20% reduction
});
```

#### Test 4.3: Memory Usage

**File**: `tests/memory/goap/multiActionPlanning.memory.test.js`

```javascript
it('should not leak memory during large plan generation', async () => {
  // Generate 100 plans, measure memory
  // Expected: No memory accumulation

  const initialMemory = process.memoryUsage().heapUsed;

  for (let i = 0; i < 100; i++) {
    await planner.plan(actor, goal, tasks, state);
  }

  const finalMemory = process.memoryUsage().heapUsed;
  const delta = finalMemory - initialMemory;

  // Allow 5MB growth (reasonable for caching)
  expect(delta).toBeLessThan(5 * 1024 * 1024);
});
```

## Test File Organization

```
tests/
├── unit/
│   └── goap/
│       └── planner/
│           ├── goapPlanner.taskReuse.test.js (NEW - from MULACTPLAFIX-001)
│           ├── goalDistanceHeuristic.enhanced.test.js (NEW - from MULACTPLAFIX-002)
│           ├── goapPlanner.stoppingCriteria.test.js (NEW - from MULACTPLAFIX-003)
│           └── goalTypeDetector.test.js (NEW - from MULACTPLAFIX-004)
├── integration/
│   └── goap/
│       ├── numericGoalPlanning.integration.test.js (EXISTING - verify 16/16 pass)
│       ├── multiActionCore.integration.test.js (NEW - Tests 1.1-1.7)
│       ├── edgeCases.integration.test.js (NEW - Tests 2.1-2.5)
│       ├── backwardCompatibility.integration.test.js (NEW - Tests 3.1-3.4)
│       └── planningFailures.integration.test.js (NEW - from MULACTPLAFIX-003)
├── performance/
│   └── goap/
│       └── multiActionPlanning.performance.test.js (NEW - Tests 4.1-4.2)
└── memory/
    └── goap/
        └── multiActionPlanning.memory.test.js (NEW - Test 4.3)
```

## Acceptance Criteria

### Test Pass Rates

- [ ] All 16 existing integration tests pass (currently 7/16)
- [ ] All 7 core multi-action tests pass
- [ ] All 5 edge case tests pass
- [ ] All 4 backward compatibility tests pass
- [ ] All 3 performance tests pass
- [ ] **Total: 35/35 tests passing**

### Coverage Metrics

- [ ] Unit test coverage: 80%+ for modified files
  - `goapPlanner.js`: 85%+
  - `goalDistanceHeuristic.js`: 90%+
  - `goalTypeDetector.js`: 95%+
- [ ] Integration test coverage: All major scenarios covered
- [ ] Performance benchmarks established and passing

### Quality Standards

- [ ] All tests use `createTestBed()` from `/tests/common/`
- [ ] Descriptive test names following "should [expected behavior]" pattern
- [ ] Arrange-Act-Assert structure consistently applied
- [ ] Mock dependencies properly isolated
- [ ] No test interdependencies (each test independent)
- [ ] Performance tests run separately (not in CI by default)

## Testing Commands

```bash
# Run full GOAP integration suite
npm run test:integration -- tests/integration/goap/

# Run specific test files
npm run test:integration -- tests/integration/goap/numericGoalPlanning.integration.test.js

# Run unit tests
npm run test:unit -- tests/unit/goap/

# Run performance tests (manual)
npm run test:performance -- tests/performance/goap/

# Run memory tests (manual)
npm run test:memory -- tests/memory/goap/

# Coverage report
npm run test:unit -- --coverage --testPathPattern="goap"
```

## Related Files

**Existing Integration Tests** (verify pass):
- `tests/integration/goap/numericGoalPlanning.integration.test.js`
- `tests/integration/goap/heuristicCalculation.integration.test.js`
- `tests/integration/goap/planInvalidation.integration.test.js`

**New Test Files** (create):
- Unit: 4 files (from tickets 001-004)
- Integration: 4 files (core, edge cases, backward compat, failures)
- Performance: 1 file
- Memory: 1 file

**Test Utilities**:
- `tests/common/testBed.js` (existing)
- `tests/integration/goap/testFixtures/goapTestSetup.js` (existing)
- `tests/integration/goap/testHelpers/eventBusRecorder.js` (existing)

## Notes

- **This ticket depends on all previous tickets being complete**
- Focus on test **quality** over quantity
- Establish baseline for future regression testing
- Performance tests run manually, not in CI (too slow)
- Memory tests use Node.js `--expose-gc` flag

## Success Metrics

1. **Test Pass Rate**: 35/35 tests passing (100%)
2. **Coverage**: 80%+ unit coverage, 100% integration coverage
3. **Performance**: All benchmarks < 100ms for 10-20 action plans
4. **Regression**: Zero failures in existing 7 passing tests
5. **Documentation**: Clear test descriptions for all scenarios
