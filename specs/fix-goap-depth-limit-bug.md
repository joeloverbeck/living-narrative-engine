# Specification: Fix GOAP Planner Depth Limit Bug

## Problem Statement

The GOAP planner incorrectly uses accumulated task cost (`gScore`) to enforce the maximum plan depth limit instead of tracking the actual number of tasks in the plan. This causes valid short plans with high cumulative costs to be incorrectly rejected.

### Current Buggy Behavior

**Location**: `src/goap/planner/goapPlanner.js` lines 1002-1007

```javascript
// 7.6 Check depth limit
if (current.gScore >= maxDepth) {  // ❌ BUG: Compares COST to depth limit
  this.#logger.debug('Depth limit reached for node', {
    depth: current.gScore,
    maxDepth,
  });
  continue; // Skip expanding this node
}
```

**Problem**: 
- `gScore` represents accumulated task COST, not plan LENGTH
- Example: A plan with 3 tasks of cost 10 each has `gScore = 30` but `length = 3`
- Default `maxDepth = 20` rejects this plan even though 3 tasks is well within reasonable depth

**Impact**:
- 6 out of 16 numeric goal planning tests fail (37.5% failure rate)
- All failing tests require plans where `gScore > 20` but `length < maxDepth`
- Example from tests:
  - ✅ PASSES: 2 heals needed (gScore = 20, length = 2)
  - ❌ FAILS: 3 heals needed (gScore = 30, length = 3)

**When Introduced**: Commit `398037fd5` on Nov 14, 2025 ("Implemented GOAPIMPL-018-05")

## Correct Behavior Specification

### Requirements

1. **Track Plan Length Separately from Cost**
   - Maintain a separate counter for the number of tasks in the plan
   - This counter increments by 1 for each task added, regardless of task cost
   - Plan length = number of actions from initial state to current state

2. **Use Plan Length for Depth Limiting**
   - Compare plan LENGTH to `maxDepth`, not accumulated cost
   - Allow plans where `planLength < maxDepth`, regardless of `gScore`
   - Continue to use `gScore` for A* cost calculations (no change to A* algorithm)

3. **Preserve Cost-Based Optimization**
   - Keep `gScore` for optimal path finding (A* uses cost to find cheapest plan)
   - Keep `fScore = gScore + hScore` for node priority ordering
   - Only change the depth limit check to use plan length

### Implementation Approach

#### 1. Add Plan Length Tracking to Node Structure

**Location**: Where nodes are created/expanded in `goapPlanner.js`

**Change Required**: Add `planLength` property to each node alongside `gScore`

```javascript
// Example initial node (line ~950)
const initialNode = {
  state: initialStateForPlanning,
  gScore: 0,              // Cost from start (existing)
  planLength: 0,          // ← ADD: Number of tasks (NEW)
  hScore: initialHScore,
  fScore: initialHScore,
  parent: null,
  task: null,
  parameters: {},
};

// Example successor node (line ~1055)
const successorGScore = current.gScore + taskCost;  // Existing cost tracking
const successorPlanLength = current.planLength + 1; // ← ADD: Increment task count

const successorNode = {
  state: nextState,
  gScore: successorGScore,
  planLength: successorPlanLength,  // ← ADD: Track plan length
  hScore: successorHScore,
  fScore: successorFScore,
  parent: current,
  task,
  parameters: boundParameters,
};
```

#### 2. Update Depth Limit Check

**Location**: `src/goap/planner/goapPlanner.js` line 1002

**Current Code**:
```javascript
if (current.gScore >= maxDepth) {
  this.#logger.debug('Depth limit reached for node', {
    depth: current.gScore,
    maxDepth,
  });
  continue;
}
```

**Fixed Code**:
```javascript
if (current.planLength >= maxDepth) {  // ✅ FIX: Use plan length instead of cost
  this.#logger.debug('Depth limit reached for node', {
    planLength: current.planLength,
    maxDepth,
  });
  continue;
}
```

#### 3. Update Debug Logging

Update any debug logs that reference "depth" to clarify whether they mean plan length or cost:

```javascript
this.#logger.debug('Expanding node', {
  planLength: current.planLength,  // Number of tasks
  gScore: current.gScore,          // Accumulated cost
  task: task.id,
});
```

### Edge Cases to Handle

1. **Initial Node**: `planLength = 0` (no tasks yet)
2. **Single Task Plan**: `planLength = 1`, `gScore = taskCost`
3. **High-Cost Tasks**: `gScore` can exceed `maxDepth`, but `planLength` should not
4. **Zero-Cost Tasks**: `gScore` unchanged, but `planLength` still increments

## Test Cases

### Unit Tests

**File**: `tests/unit/goap/planner/goapPlanner.test.js`

```javascript
describe('Plan depth limiting', () => {
  it('should limit plan by LENGTH not COST', async () => {
    // Setup: maxDepth = 3, task cost = 10
    // Create 4 tasks to exceed depth limit
    
    const result = await planner.plan(actor, goal, { maxDepth: 3 });
    
    // Plan should stop at 3 tasks (planLength = 3)
    // Even though gScore = 30 might be higher
    expect(result.tasks).toHaveLength(3);
  });

  it('should allow high-cost plans within length limit', async () => {
    // Setup: maxDepth = 5, 3 tasks with cost = 100 each
    
    const result = await planner.plan(actor, goal, { maxDepth: 5 });
    
    // Should succeed even though gScore = 300 > maxDepth = 5
    // Because planLength = 3 < maxDepth = 5
    expect(result.tasks).toHaveLength(3);
    expect(result.success).toBe(true);
  });

  it('should increment planLength by 1 per task', async () => {
    // Setup: Varying task costs
    const tasks = [
      { cost: 5 },
      { cost: 15 },
      { cost: 1 },
    ];
    
    // planLength should be 3 regardless of individual costs
    // gScore should be 21 (5 + 15 + 1)
  });
});
```

### Integration Tests

**File**: `tests/integration/goap/numericGoalPlanning.integration.test.js`

The existing failing tests should pass after the fix:

```javascript
it('should handle multiple heals for large health gap', async () => {
  // Currently FAILS because gScore = 30 > maxDepth = 20
  // Should PASS after fix because planLength = 3 < maxDepth = 20
  
  const actor = { health: 10 };
  const goal = { health: '>=', value: 80 };
  
  const result = await planner.plan(actor, goal);
  
  expect(result.tasks).toHaveLength(3);  // 3 heal tasks
  expect(result.success).toBe(true);
});
```

Expected test results after fix:
- **Before**: 10/16 passing (62.5%)
- **After**: 16/16 passing (100%)

## Verification Steps

1. **Run Affected Tests**:
   ```bash
   NODE_ENV=test npx jest tests/integration/goap/numericGoalPlanning.integration.test.js --no-coverage
   ```
   - Should go from 10/16 passing to 16/16 passing

2. **Run A* Planning Tests** (should remain passing):
   ```bash
   NODE_ENV=test npx jest tests/integration/goap/aStarPlanning.integration.test.js --no-coverage
   ```
   - Should remain 8/8 passing

3. **Run Full GOAP Test Suite**:
   ```bash
   NODE_ENV=test npx jest tests/integration/goap/ --no-coverage
   ```
   - All tests should pass

4. **Verify Debug Logs**:
   - Run verbose diagnostic test to confirm `planLength` is tracked correctly
   - Verify log messages clearly distinguish between plan length and cost

## Files to Modify

1. **Primary Implementation**:
   - `src/goap/planner/goapPlanner.js`
     - Line ~950: Add `planLength: 0` to initial node
     - Line ~1002: Change depth check to use `planLength`
     - Line ~1055: Add `planLength` increment for successor nodes
     - Update debug logs to clarify length vs cost

2. **Test Updates** (if needed):
   - `tests/unit/goap/planner/goapPlanner.test.js` - Add unit tests for plan length tracking
   - `tests/integration/goap/numericGoalPlanning.integration.test.js` - Should pass without changes

3. **Documentation**:
   - Update any comments in `goapPlanner.js` that reference depth limiting
   - Document the distinction between plan length and cost in JSDoc

## Success Criteria

✅ All 16 numeric goal planning tests pass
✅ All A* planning tests remain passing  
✅ Plans are limited by number of tasks, not accumulated cost
✅ High-cost plans within length limit are accepted
✅ Debug logs clearly distinguish plan length from cost
✅ No performance regression (A* algorithm unchanged)

## References

- **Bug Location**: `src/goap/planner/goapPlanner.js:1002`
- **Introduced**: Commit `398037fd5` (Nov 14, 2025)
- **Failing Tests**: `tests/integration/goap/numericGoalPlanning.integration.test.js`
  - Lines 411-440: "should handle multiple heals for large health gap"
  - Lines 442-471: "should plan sequence for very low starting health"
  - Lines 473-502: "should find optimal path with varying heal costs"
  - Lines 504-532: "should handle threshold just above current value"
  - Lines 534-562: "should work with exact threshold match"
  - Lines 564-592: "should handle incremental progress toward goal"
