# Multi-Action Planning Fix Specification

**Ticket**: MODCOMPLASUP-006-BLOCKER
**Status**: In Progress (Phase 1 complete, Phase 2 pending)
**Created**: 2025-01-16
**Last Updated**: 2025-01-16

## Executive Summary

This specification addresses the critical blocker in GOAP multi-action planning where the planner fails to create plans requiring multiple applications of the same task to reach numeric goals. Currently, 7/16 integration tests pass (all single-action scenarios), while 9/16 fail (all multi-action scenarios).

**Phase 1 (Completed)**: Dual-format state extraction and JSON Logic path resolution
**Phase 2 (This Spec)**: Task reuse algorithm enabling multi-action sequences

## 1. Problem Statement

### 1.1 Current Behavior

The GOAP planner fails to create plans when multiple instances of the same task are required to satisfy a numeric goal constraint.

**Example Scenario (Test: "should require multiple actions for large hunger reduction")**:

```javascript
// Initial state
actor.components['core:needs'] = { hunger: 100 };

// Available task: eat (decrements hunger by 60)
task.planningEffects = [{
  type: 'MODIFY_COMPONENT',
  parameters: {
    entity_ref: 'actor',
    component_type: 'core:needs',
    field: 'hunger',
    value: 60,
    mode: 'decrement'
  }
}];

// Goal: reduce hunger to ≤ 10
goal.goalState = { '<=': [{ var: 'state.actor.components.core_needs.hunger' }, 10] };

// Expected: Plan with 2 eat actions
// - After action 1: 100 - 60 = 40
// - After action 2: 40 - 60 = -20 → clamped to 0 ✓ (satisfies ≤ 10)

// Actual: Planning fails (GOAP_EVENTS.PLANNING_FAILED)
// Reason: Planner applies task once, sees hunger = 40 (not ≤ 10),
//         but does not consider applying "eat" a second time
```

### 1.2 Failing Test Cases

All 9 failing tests follow the same pattern: **multi-action sequences required**

| Test Case | Initial | Task Effect | Goal | Required Actions |
|-----------|---------|-------------|------|------------------|
| Large hunger reduction | hunger: 100 | -60 | ≤ 10 | 2 eat |
| Healing to threshold | health: 40 | +30 | ≥ 80 | 2 heal |
| Large health gap | health: 10 | +30 | ≥ 80 | 3 heal |
| Gold gathering | gold: 30 | +25 | ≥ 100 | 3 mine |
| Exact resource gathering | gold: 0 | +25 | ≥ 75 | 3 mine |
| Exact target no overflow | gold: 50 | +25 | = 100 | 2 mine |
| Component-only goals | - | - | - | Backward compat |
| Mixed component + numeric | - | - | - | Backward compat |
| Complex nested logic | - | - | - | Backward compat |

### 1.3 Impact

**Severity**: BLOCKER
**Affected Systems**: All numeric goal planning
**User Impact**: Cannot use numeric goals for resource accumulation, stat management, or any scenario requiring incremental progress

## 2. Root Cause Analysis

### 2.1 A* Search Implementation Gap

**File**: `src/goap/planner/goapPlanner.js`
**Method**: `plan()` lines 760-1035

**Issue**: The A* search expands nodes by applying each available task **once** per state, but does not allow the **same task** to be re-applied to its own successor state.

**Current Logic** (pseudocode):
```javascript
for (const task of applicableTasks) {
  const successorState = simulateEffects(current.state, task);
  const successorNode = createNode(successorState, [...current.actions, task]);
  open.push(successorNode);
}
```

**Problem**: If `task = eat` is applied to `state₁ = {hunger: 100}`, creating `state₂ = {hunger: 40}`, the search does NOT consider applying `eat` again to `state₂` because task applicability is recalculated fresh for `state₂` without memory of what created it.

**Why Task Isn't Re-Applied**:
1. `getApplicableTasks(state₂)` filters tasks by structural gates and preconditions
2. If structural gates are satisfied (e.g., "actor can eat" = always true), task IS applicable
3. BUT: The loop iterates `applicableTasks` only once per expansion
4. RESULT: Only one instance of `eat` added to plan, even if multiple needed

### 2.2 Heuristic Accuracy Gap

**File**: `src/goap/planner/goalDistanceHeuristic.js`
**Method**: `calculate()` lines 67-147

**Issue**: Heuristic estimates "distance to goal" (e.g., 40 hunger points) but not "number of actions needed" (e.g., 1 more eat action).

**Current Heuristic**:
```javascript
// For hunger: 40, goal: ≤ 10
distance = 40 - 10 = 30  // Correct magnitude

// But heuristic doesn't estimate:
actionsNeeded = Math.ceil(30 / 60) = 1  // One more eat action
```

**Impact**: While the heuristic is admissible (never overestimates cost), it provides poor guidance for multi-step sequences because it doesn't account for task effect granularity.

### 2.3 Task Applicability Logic

**File**: `src/goap/planner/goapPlanner.js`
**Method**: `#getApplicableTasks()` line 507

**Current Behavior**:
- Filters tasks by structural gates (preconditions)
- Returns all tasks that CAN be applied to current state
- Does NOT consider if task was just applied

**Missing Logic**:
- No "task reusability check" to see if applying task again would continue reducing distance
- No limit on how many times a task can appear in a plan
- No mechanism to prefer tasks that haven't been used yet vs. re-using a working task

### 2.4 Stopping Criteria

**File**: `src/goap/planner/goapPlanner.js`
**Lines**: 889-901 (main search loop)

**Current Logic**:
```javascript
while (open.length > 0) {
  const current = open.pop();

  if (isGoalSatisfied(current.state, goal)) {
    return createPlan(current.actions);  // ✓ Correct
  }

  if (closed.has(stateKey)) continue;  // ✓ Prevents revisiting identical states

  // Expand successors...
}
```

**Gap**: No explicit check for "too many actions" or "impossible to reach goal"
- If goal requires 100 actions, planner will try to create a 100-action plan
- If task effect is wrong direction (e.g., +60 when need -60), planner never detects impossibility
- No cost-based termination (e.g., "stop if plan exceeds 10 actions")

## 3. Solution Architecture

### 3.1 Core Design Principles

1. **Task Reusability**: Allow same task to appear multiple times in plan if it continues reducing distance
2. **Admissible Heuristic**: Maintain A* optimality guarantees while improving guidance
3. **Bounded Search**: Prevent infinite loops and runaway planning with configurable limits
4. **Backward Compatibility**: Single-action scenarios must continue working (7 passing tests must remain green)

### 3.2 Task Reuse Algorithm

**Approach**: Modify successor generation to allow task re-application based on distance reduction.

**New Logic** (pseudocode):
```javascript
function expandNode(currentNode, goal, taskLibrary) {
  const applicableTasks = getApplicableTasks(taskLibrary, currentNode.state);
  const successors = [];

  for (const task of applicableTasks) {
    // Check if task is reusable (NEW)
    if (!isTaskReusable(task, currentNode, goal)) {
      continue;
    }

    const successorState = simulateEffects(currentNode.state, task);
    const successorNode = {
      state: successorState,
      actions: [...currentNode.actions, task],
      cost: currentNode.cost + task.cost
    };

    successors.push(successorNode);
  }

  return successors;
}

function isTaskReusable(task, currentNode, goal) {
  // 1. Check structural gates (existing)
  if (!evaluateStructuralGates(task, currentNode.state)) {
    return false;
  }

  // 2. Check if task reduces distance (NEW)
  const currentDistance = calculateDistance(currentNode.state, goal);
  const successorState = simulateEffects(currentNode.state, task);
  const successorDistance = calculateDistance(successorState, goal);

  if (successorDistance >= currentDistance) {
    // Task doesn't reduce distance, not reusable
    return false;
  }

  // 3. Check task reuse limit (NEW)
  const taskUsageCount = currentNode.actions.filter(a => a.id === task.id).length;
  const maxReuse = task.maxReuse || 10;  // Configurable limit

  if (taskUsageCount >= maxReuse) {
    return false;
  }

  return true;
}
```

**Key Changes**:
- **Distance Reduction Check**: Only allow task if it reduces distance to goal
- **Task Reuse Limit**: Prevent infinite loops (default: max 10 instances of same task)
- **Structural Gates**: Maintain existing precondition checking

**Edge Case Handling**:
```javascript
// Overshoot Prevention
if (wouldOvershootGoal(successorState, goal) && !allowPartialEffect) {
  // Don't apply task if it would push past goal
  // Example: hunger = 15, task = -60, goal = ≤ 10
  // Result: 15 - 60 = -45, but goal is satisfied at 10
  // Decision: Apply task (because -45 clamped to 0 still satisfies ≤ 10)

  // Exception: If goal is EXACT equality (=), overshoot may fail
  if (isExactGoal(goal) && !canAchieveExact(task, currentState, goal)) {
    return false;
  }
}

// Impossibility Detection
if (currentDistance > 0 && successorDistance === currentDistance) {
  // Task applied but distance unchanged → impossible
  markTaskAsIneffective(task, currentNode.state);
}
```

### 3.3 Enhanced Heuristic

**File**: `src/goap/planner/goalDistanceHeuristic.js`

**Current**:
```javascript
calculate(state, goal) {
  return numericConstraintEvaluator.calculateDistance(goal.goalState, { state });
}
// Returns: 30 (for hunger: 40, goal: ≤ 10)
```

**Enhanced** (NEW):
```javascript
calculate(state, goal, availableTasks) {
  const baseDistance = numericConstraintEvaluator.calculateDistance(goal.goalState, { state });

  if (baseDistance === 0) return 0;  // Goal already satisfied

  // Find task that best reduces distance
  const bestTask = findBestTaskForGoal(availableTasks, state, goal);

  if (!bestTask) {
    // No task can reduce distance → use base distance as pessimistic estimate
    return baseDistance;
  }

  // Estimate number of actions needed
  const taskEffect = estimateTaskEffect(bestTask, state, goal);
  const actionsNeeded = Math.ceil(baseDistance / taskEffect);
  const estimatedCost = actionsNeeded * bestTask.cost;

  return estimatedCost;  // Admissible: actual cost >= estimated cost
}

function estimateTaskEffect(task, state, goal) {
  // Simulate ONE application of task
  const successorState = simulateEffects(state, task);
  const beforeDistance = calculateDistance(state, goal);
  const afterDistance = calculateDistance(successorState, goal);

  return Math.abs(beforeDistance - afterDistance);  // Distance reduced per action
}
```

**Example**:
```javascript
// State: hunger = 100
// Goal: hunger ≤ 10
// Task: eat (cost = 5, effect = -60 hunger)

baseDistance = 100 - 10 = 90
taskEffect = 60  // Reduces 60 hunger per action
actionsNeeded = Math.ceil(90 / 60) = 2
estimatedCost = 2 * 5 = 10

// Old heuristic: 90 (just distance)
// New heuristic: 10 (estimated cost to reach goal)
// Actual cost: 10 (2 actions * cost 5) ✓ Admissible
```

**Admissibility Proof**:
- If task reduces distance by `d` per action with cost `c`
- Estimated actions: `⌈distance / d⌉`
- Estimated cost: `⌈distance / d⌉ * c`
- Actual actions needed: `≥ ⌈distance / d⌉` (due to discrete actions)
- Therefore: `actual_cost ≥ estimated_cost` ✓

### 3.4 Stopping Criteria Enhancements

**Add Three Termination Conditions**:

```javascript
// 1. Goal Satisfaction (existing)
if (isGoalSatisfied(current.state, goal)) {
  return createPlan(current.actions);
}

// 2. Cost Limit (NEW)
const maxPlanCost = goal.maxCost || 100;  // Configurable
if (current.cost > maxPlanCost) {
  this.#logger.warn('Plan cost exceeded limit', {
    currentCost: current.cost,
    maxCost: maxPlanCost
  });
  continue;  // Skip this node, try other paths
}

// 3. Impossibility Detection (NEW)
const currentDistance = calculateDistance(current.state, goal);
if (currentDistance > 0 && allSuccessorsHaveSameDistance(current, goal)) {
  // No task can reduce distance from this state
  this.#logger.warn('Goal unreachable from current state', {
    state: current.state,
    goal: goal.id,
    distance: currentDistance
  });

  // Mark this branch as dead-end
  continue;
}

// 4. Action Count Limit (NEW)
const maxActions = goal.maxActions || 20;  // Prevent runaway plans
if (current.actions.length >= maxActions) {
  this.#logger.warn('Plan action count exceeded limit', {
    actionCount: current.actions.length,
    maxActions: maxActions
  });
  continue;
}
```

**Configuration**:
```javascript
// In goal definition
{
  id: 'test:reduce_hunger',
  goalState: { '<=': [{ var: 'state.actor.components.core_needs.hunger' }, 10] },
  maxCost: 50,        // Stop if plan cost > 50
  maxActions: 10,     // Stop if plan length > 10 actions
  allowOvershoot: true  // Allow overshoot for inequality goals
}
```

## 4. State Accumulation Semantics

### 4.1 Multiple MODIFY_COMPONENT Operations

**Scenario**: Same field modified multiple times in sequence

```javascript
// Initial state
state = { 'actor:core:needs': { hunger: 100 } };

// Task applied twice
task.planningEffects = [{
  type: 'MODIFY_COMPONENT',
  parameters: {
    entity_ref: 'actor',
    component_type: 'core:needs',
    field: 'hunger',
    value: 60,
    mode: 'decrement'
  }
}];

// After 1st application
state₁ = { 'actor:core:needs': { hunger: 40 } };

// After 2nd application
state₂ = { 'actor:core:needs': { hunger: -20 } };
// Clamped to: { hunger: 0 }
```

**Current Implementation**: `PlanningEffectsSimulator.simulateEffects()` correctly handles:
- ✅ Overflow/underflow detection (lines 421-470)
- ✅ Clamping to valid ranges
- ✅ Dual-format state sync after each modification

**Specification**: No changes needed to state accumulation logic.

### 4.2 Dual-Format Consistency

**Requirement**: After each task application, state must maintain consistency between:
1. Flat hash: `"actor:core:needs" → { hunger: 40 }`
2. Nested format: `state.actor.components['core:needs'] → { hunger: 40 }`
3. Flattened alias: `state.actor.components.core_needs → { hunger: 40 }`

**Current Implementation**: `#syncDualFormat()` (lines 522-549) ✅ Correct

**Edge Case**: Nested modifications
```javascript
// If task A modifies hunger, then task B modifies health
// Both must sync to dual format independently
state after A: {
  'actor:core:needs': { hunger: 40 },
  'state.actor.components.core_needs': { hunger: 40 }
}

state after B: {
  'actor:core:needs': { hunger: 40 },
  'actor:core:stats': { health: 70 },
  'state.actor.components.core_needs': { hunger: 40 },
  'state.actor.components.core_stats': { health: 70 }
}
```

**Specification**: Each MODIFY_COMPONENT operation triggers independent dual-format sync. ✅ Already implemented.

## 5. Edge Cases and Error Handling

### 5.1 Overshoot Scenarios

**Case 1: Inequality Goal (≤, ≥) with Overshoot**
```javascript
// State: hunger = 15
// Task: eat (-60 hunger)
// Goal: hunger ≤ 10

// After eat: 15 - 60 = -45 → clamped to 0
// Goal check: 0 ≤ 10 → TRUE ✓

// Decision: Allow overshoot for inequality goals
```

**Case 2: Equality Goal (=) with Overshoot**
```javascript
// State: gold = 75
// Task: mine (+25 gold)
// Goal: gold = 100

// After mine: 75 + 25 = 100 ✓ Exact

// But what if:
// State: gold = 76
// After mine: 76 + 25 = 101 ≠ 100 ✗

// Decision: For equality goals, check if exact value achievable
// If not, mark goal as impossible
```

**Implementation**:
```javascript
function allowOvershoot(goal, currentState, task) {
  const goalType = detectGoalType(goal.goalState);

  if (goalType === 'inequality') {
    // ≤, ≥, <, > → Allow overshoot
    return true;
  }

  if (goalType === 'equality') {
    // = → Check if exact value achievable
    const exactValue = extractTargetValue(goal.goalState);
    const currentValue = extractCurrentValue(currentState);
    const taskEffect = estimateTaskEffect(task);

    // Check if any number of applications achieves exact value
    for (let n = 1; n <= 10; n++) {
      if (currentValue + (n * taskEffect) === exactValue) {
        return true;  // Exact achievable with n applications
      }
    }

    return false;  // Exact not achievable
  }

  return true;  // Default: allow
}
```

### 5.2 Impossible Goals

**Detection Scenarios**:

1. **Task Effect Wrong Direction**
```javascript
// State: hunger = 100
// Task: eat_more (+20 hunger) ← Wrong direction!
// Goal: hunger ≤ 10

// Detection: After applying task, distance INCREASES
// Action: Mark task as ineffective, try other tasks
```

2. **Task Effect Too Small**
```javascript
// State: hunger = 100
// Task: nibble (-1 hunger)
// Goal: hunger ≤ 10
// Cost per action: 10

// After 90 actions: hunger = 10, cost = 900
// If maxCost = 100, goal is impossible within cost limit

// Detection: Estimated cost > maxCost
// Action: Fail planning with clear error
```

3. **No Applicable Tasks**
```javascript
// State: hunger = 100
// Tasks: [eat (requires inventory contains food)]
// Inventory: empty
// Goal: hunger ≤ 10

// Detection: No tasks pass structural gates
// Action: Fail planning with "no applicable tasks" error
```

**Error Reporting**:
```javascript
{
  type: 'GOAP_EVENTS.PLANNING_FAILED',
  payload: {
    reason: 'impossible_goal',
    details: {
      goalId: 'test:reduce_hunger',
      currentDistance: 90,
      availableTasks: ['eat'],
      whyImpossible: 'Task effect wrong direction: +20 (need negative)'
    }
  }
}
```

### 5.3 Cost-Benefit Analysis

**Scenario**: Goal achievable but too expensive

```javascript
// State: gold = 0
// Task: mine (+1 gold, cost = 10)
// Goal: gold ≥ 1000
// maxCost: 100

// Estimated cost: 1000 actions * 10 = 10,000
// Max allowed: 100
// Decision: Fail planning (too expensive)

// Error:
{
  type: 'GOAP_EVENTS.PLANNING_FAILED',
  payload: {
    reason: 'cost_limit_exceeded',
    estimatedCost: 10000,
    maxCost: 100
  }
}
```

**Implementation**: Check estimated cost before starting A* search
```javascript
function plan(actorId, goal, taskLibrary, initialState) {
  // Quick feasibility check
  const estimatedCost = this.#heuristicRegistry.calculate('goal-distance', initialState, goal, taskLibrary);
  const maxCost = goal.maxCost || Infinity;

  if (estimatedCost > maxCost) {
    this.#logger.warn('Goal estimated cost exceeds limit', {
      estimatedCost,
      maxCost
    });

    this.#eventBus.dispatch({
      type: GOAP_EVENTS.PLANNING_FAILED,
      payload: {
        actorId,
        goalId: goal.id,
        reason: 'cost_limit_exceeded',
        estimatedCost,
        maxCost
      }
    });

    return null;
  }

  // Proceed with A* search...
}
```

## 6. Debugging Procedures

### 6.1 Diagnostic Workflow for Multi-Action Failures

**Symptom**: Test fails with `GOAP_EVENTS.PLANNING_FAILED` for multi-action scenario

**Step 1: Enable Debugging**
```javascript
const goapDebugger = new GOAPDebugger({
  goapController: setup.controller,
  planInspector,
  stateDiffViewer,
  refinementTracer,
  logger
});

goapDebugger.startTrace(actorId);
```

**Step 2: Capture Planning Events**
```javascript
try {
  await setup.controller.decideTurn(actor, world);
} catch (err) {
  const failures = goapDebugger.getFailureHistory(actorId);
  console.log('Failure History:', JSON.stringify(failures, null, 2));

  const planInspection = goapDebugger.inspectPlanJSON(actorId);
  console.log('Plan Inspection:', JSON.stringify(planInspection, null, 2));
}
```

**Step 3: Analyze State Progression**
```javascript
// Get all state transitions during planning
const report = goapDebugger.generateReport(actorId);

// Look for:
// - How many times was each task considered?
// - What was the state after each task application?
// - Did distance to goal decrease with each step?
// - Where did planning get stuck?
```

**Step 4: Verify Distance Calculation**
```javascript
// Manual distance check
const distance = setup.heuristicRegistry.calculate(
  'goal-distance',
  world.state,
  goal
);

console.log('Initial distance:', distance);

// Simulate task application
const successorState = planningEffectsSimulator.simulateEffects(
  world.state,
  task.planningEffects,
  { actor: { id: actorId } }
);

const newDistance = setup.heuristicRegistry.calculate(
  'goal-distance',
  successorState,
  goal
);

console.log('Distance after task:', newDistance);
console.log('Reduction:', distance - newDistance);
```

**Step 5: Check Task Reusability**
```javascript
// Verify task passes structural gates
const gateResult = evaluateStructuralGates(task, world.state);
console.log('Structural gates:', gateResult);

// Check if task reduces distance
const reducesDistance = newDistance < distance;
console.log('Reduces distance:', reducesDistance);

// Check reuse count
const taskCount = plan.actions.filter(a => a.id === task.id).length;
console.log('Task usage count:', taskCount);
console.log('Max reuse allowed:', task.maxReuse || 10);
```

### 6.2 Using PlanInspector

**View Plan Structure**:
```javascript
const inspection = planInspector.inspect(actorId);

// Output:
{
  actorId: 'test_actor',
  plan: {
    actions: [
      { id: 'test:eat', cost: 5 },
      { id: 'test:eat', cost: 5 }  // ← Should see duplicate for multi-action
    ],
    totalCost: 10,
    estimatedDuration: 2
  },
  analysis: {
    actionTypes: { 'test:eat': 2 },
    longestChain: 2,
    hasLoops: false
  }
}
```

**Verify Action Count**:
```javascript
const expectedCount = Math.ceil((100 - 10) / 60);  // 2 actions
const actualCount = inspection.plan.actions.length;

if (actualCount !== expectedCount) {
  console.error('Action count mismatch!', {
    expected: expectedCount,
    actual: actualCount
  });
}
```

### 6.3 Using StateDiffViewer

**Visualize State Changes**:
```javascript
// Before planning
const initialState = world.state;

// After planning (simulate plan execution)
let currentState = initialState;
for (const action of plan.actions) {
  const nextState = planningEffectsSimulator.simulateEffects(
    currentState,
    action.planningEffects,
    { actor: { id: actorId } }
  );

  const diff = stateDiffViewer.visualize(currentState, nextState);
  console.log(`After ${action.id}:`, diff);

  currentState = nextState;
}

// Example output:
// After test:eat:
// {
//   added: {},
//   removed: {},
//   modified: {
//     'actor:core:needs': {
//       hunger: { from: 100, to: 40 }  // ← Shows progression
//     }
//   }
// }
```

## 7. Test Scenarios

### 7.1 Core Multi-Action Tests

**Test 1: Exact Multiple**
```javascript
it('should plan exactly N actions when N * effect = distance', async () => {
  const actor = { id: 'test_actor', components: { 'core:needs': { hunger: 100 } } };
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

  // Expected: 100 / 25 = 4 actions exactly

  await setup.controller.decideTurn(actor, world);

  const events = setup.eventBus.getAll();
  const planCreated = events.find(e => e.type === GOAP_EVENTS.PLANNING_COMPLETED);

  expect(planCreated).toBeDefined();
  expect(planCreated.payload.plan.actions).toHaveLength(4);
  expect(planCreated.payload.plan.actions.every(a => a.id === 'test:eat')).toBe(true);
});
```

**Test 2: Ceiling Division**
```javascript
it('should round up action count when distance not evenly divisible', async () => {
  // hunger: 90, task effect: -60, goal: ≤ 10
  // Distance: 80
  // Actions needed: Math.ceil(80 / 60) = 2
  // After 1: 90 - 60 = 30 (not satisfied)
  // After 2: 30 - 60 = -30 → 0 (satisfied)

  const actor = { id: 'test_actor', components: { 'core:needs': { hunger: 90 } } };
  const task = createTestTask({ /* -60 hunger */ });
  const goal = createTestGoal({ /* ≤ 10 */ });

  await setup.controller.decideTurn(actor, world);

  const plan = getPlan(setup.eventBus);
  expect(plan.actions).toHaveLength(2);
});
```

**Test 3: Overshoot Allowed**
```javascript
it('should allow overshoot for inequality goals', async () => {
  // hunger: 15, task effect: -60, goal: ≤ 10
  // After task: 15 - 60 = -45 → clamped to 0
  // Goal check: 0 ≤ 10 → TRUE ✓

  const actor = { id: 'test_actor', components: { 'core:needs': { hunger: 15 } } };
  const task = createTestTask({ /* -60 hunger */ });
  const goal = createTestGoal({ /* ≤ 10 */ });

  await setup.controller.decideTurn(actor, world);

  const plan = getPlan(setup.eventBus);
  expect(plan.actions).toHaveLength(1);  // One action is enough despite overshoot
});
```

**Test 4: Multiple Task Types**
```javascript
it('should handle multi-action with different task types', async () => {
  // hunger: 100, health: 10
  // Tasks: eat (-60 hunger), heal (+30 health)
  // Goals: hunger ≤ 10 AND health ≥ 80

  const actor = {
    id: 'test_actor',
    components: {
      'core:needs': { hunger: 100 },
      'core:stats': { health: 10 }
    }
  };

  const eatTask = createTestTask({ /* -60 hunger */ });
  const healTask = createTestTask({ /* +30 health */ });

  const goal = createTestGoal({
    goalState: {
      and: [
        { '<=': [{ var: 'state.actor.components.core_needs.hunger' }, 10] },
        { '>=': [{ var: 'state.actor.components.core_stats.health' }, 80] }
      ]
    }
  });

  await setup.controller.decideTurn(actor, world);

  const plan = getPlan(setup.eventBus);

  // Expected: 2 eat + 3 heal = 5 actions
  expect(plan.actions).toHaveLength(5);
  expect(plan.actions.filter(a => a.id === 'test:eat')).toHaveLength(2);
  expect(plan.actions.filter(a => a.id === 'test:heal')).toHaveLength(3);
});
```

### 7.2 Edge Case Tests

**Test 5: Cost Limit Exceeded**
```javascript
it('should fail gracefully when estimated cost exceeds limit', async () => {
  const actor = { id: 'test_actor', components: { 'core:needs': { hunger: 100 } } };
  const task = createTestTask({ /* -1 hunger, cost = 10 */ });
  const goal = createTestGoal({
    goalState: { '<=': [{ var: 'state.actor.components.core_needs.hunger' }, 0] },
    maxCost: 50  // Need 100 actions * 10 = 1000 cost, but limit is 50
  });

  await setup.controller.decideTurn(actor, world);

  const events = setup.eventBus.getAll();
  const planFailed = events.find(e => e.type === GOAP_EVENTS.PLANNING_FAILED);

  expect(planFailed).toBeDefined();
  expect(planFailed.payload.reason).toBe('cost_limit_exceeded');
});
```

**Test 6: Impossible Goal (Wrong Direction)**
```javascript
it('should detect impossible goal when task effect is wrong direction', async () => {
  const actor = { id: 'test_actor', components: { 'core:needs': { hunger: 100 } } };
  const task = createTestTask({ /* +20 hunger (WRONG DIRECTION!) */ });
  const goal = createTestGoal({ /* hunger ≤ 10 */ });

  await setup.controller.decideTurn(actor, world);

  const events = setup.eventBus.getAll();
  const planFailed = events.find(e => e.type === GOAP_EVENTS.PLANNING_FAILED);

  expect(planFailed).toBeDefined();
  expect(planFailed.payload.reason).toBe('impossible_goal');
  expect(planFailed.payload.details).toContain('wrong direction');
});
```

**Test 7: Action Count Limit**
```javascript
it('should respect maxActions limit', async () => {
  const actor = { id: 'test_actor', components: { 'core:needs': { hunger: 1000 } } };
  const task = createTestTask({ /* -60 hunger */ });
  const goal = createTestGoal({
    goalState: { '<=': [{ var: 'state.actor.components.core_needs.hunger' }, 0] },
    maxActions: 5  // Need 17 actions, but limit is 5
  });

  await setup.controller.decideTurn(actor, world);

  const events = setup.eventBus.getAll();
  const planFailed = events.find(e => e.type === GOAP_EVENTS.PLANNING_FAILED);

  expect(planFailed).toBeDefined();
  expect(planFailed.payload.reason).toBe('action_limit_exceeded');
});
```

### 7.3 Backward Compatibility Tests

**Test 8: Single-Action Still Works**
```javascript
it('should maintain backward compatibility with single-action scenarios', async () => {
  // All 7 currently passing tests must continue to pass

  const actor = { id: 'test_actor', components: { 'core:needs': { hunger: 80 } } };
  const task = createTestTask({ /* -60 hunger */ });
  const goal = createTestGoal({ /* hunger ≤ 30 */ });

  await setup.controller.decideTurn(actor, world);

  const plan = getPlan(setup.eventBus);
  expect(plan.actions).toHaveLength(1);  // Single action sufficient
});
```

**Test 9: Component-Only Goals**
```javascript
it('should handle component-only goals without numeric constraints', async () => {
  const actor = { id: 'test_actor', components: {} };
  const task = createTestTask({ /* ADD_COMPONENT: 'core:armed' */ });
  const goal = createTestGoal({
    goalState: { has_component: ['actor', 'core:armed'] }
  });

  await setup.controller.decideTurn(actor, world);

  const plan = getPlan(setup.eventBus);
  expect(plan).toBeDefined();
});
```

## 8. Implementation Roadmap

### 8.1 Phase 1: Core Task Reuse (PRIORITY 1)

**Files to Modify**:
1. `src/goap/planner/goapPlanner.js`
   - Method: `plan()` lines 760-1035
   - Add: `isTaskReusable()` helper method
   - Modify: Successor generation loop to check reusability

**Changes**:
```javascript
// Before (line 917)
const applicableTasks = this.#getApplicableTasks(taskLibrary, current.state, actorId, goal);

for (const task of applicableTasks) {
  // Generate successor...
}

// After
const applicableTasks = this.#getApplicableTasks(taskLibrary, current.state, actorId, goal);

for (const task of applicableTasks) {
  // NEW: Check if task is reusable
  if (!this.#isTaskReusable(task, current, goal)) {
    continue;
  }

  // Generate successor (existing logic)...
}
```

**New Method**:
```javascript
/**
 * Check if a task is reusable for multi-action planning.
 *
 * @param {object} task - Task to check
 * @param {object} currentNode - Current search node
 * @param {object} goal - Goal being planned for
 * @returns {boolean} True if task can be reused
 * @private
 */
#isTaskReusable(task, currentNode, goal) {
  // 1. Check distance reduction
  const currentDistance = this.#heuristicRegistry.calculate(
    'goal-distance',
    currentNode.state,
    goal
  );

  const successorState = this.#planningEffectsSimulator.simulateEffects(
    currentNode.state,
    task.planningEffects,
    { actor: { id: currentNode.actorId } }
  );

  const successorDistance = this.#heuristicRegistry.calculate(
    'goal-distance',
    successorState,
    goal
  );

  if (successorDistance >= currentDistance) {
    this.#logger.debug('Task does not reduce distance, not reusable', {
      taskId: task.id,
      currentDistance,
      successorDistance
    });
    return false;
  }

  // 2. Check reuse limit
  const taskUsageCount = currentNode.actions.filter(a => a.id === task.id).length;
  const maxReuse = task.maxReuse || 10;

  if (taskUsageCount >= maxReuse) {
    this.#logger.debug('Task reuse limit reached', {
      taskId: task.id,
      usageCount: taskUsageCount,
      maxReuse
    });
    return false;
  }

  return true;
}
```

**Testing**:
- Run existing 16 integration tests
- Expected: 9 currently failing tests should now pass
- Expected: 7 currently passing tests should still pass

### 8.2 Phase 2: Enhanced Heuristic (PRIORITY 2)

**Files to Modify**:
1. `src/goap/planner/goalDistanceHeuristic.js`
   - Method: `calculate()` lines 67-147
   - Add: Action count estimation based on task effect

**Changes**:
```javascript
// Before
calculate(state, goal, context = {}) {
  // ... numeric distance calculation ...
  return distance;
}

// After
calculate(state, goal, context = {}) {
  // ... existing distance calculation ...

  const availableTasks = context.availableTasks || [];

  if (availableTasks.length === 0) {
    // No tasks available, use distance as pessimistic estimate
    return distance;
  }

  // Find best task for this goal
  const bestTask = this.#findBestTaskForGoal(availableTasks, state, goal);

  if (!bestTask) {
    return distance;
  }

  // Estimate number of actions needed
  const taskEffect = this.#estimateTaskEffect(bestTask, state, goal);
  const actionsNeeded = Math.ceil(distance / taskEffect);
  const estimatedCost = actionsNeeded * bestTask.cost;

  return estimatedCost;
}
```

**New Methods**:
```javascript
#findBestTaskForGoal(tasks, state, goal) {
  let bestTask = null;
  let bestEffect = 0;

  for (const task of tasks) {
    const effect = this.#estimateTaskEffect(task, state, goal);
    if (effect > bestEffect) {
      bestEffect = effect;
      bestTask = task;
    }
  }

  return bestTask;
}

#estimateTaskEffect(task, state, goal) {
  const beforeDistance = this.#numericConstraintEvaluator.calculateDistance(
    goal.goalState,
    { state }
  );

  const successorState = this.#planningEffectsSimulator.simulateEffects(
    state,
    task.planningEffects,
    { actor: { id: 'temp' } }  // Temporary ID for simulation
  );

  const afterDistance = this.#numericConstraintEvaluator.calculateDistance(
    goal.goalState,
    { state: successorState }
  );

  return Math.abs(beforeDistance - afterDistance);
}
```

**Testing**:
- Unit tests: Verify heuristic estimates correct action count
- Integration tests: Verify planning still finds optimal plans

### 8.3 Phase 3: Stopping Criteria (PRIORITY 3)

**Files to Modify**:
1. `src/goap/planner/goapPlanner.js`
   - Method: `plan()` main loop lines 889-901
   - Add: Cost limit, action limit checks

**Changes**:
```javascript
// In main A* loop (line 889)
while (open.length > 0) {
  const current = open.pop();

  // Existing goal check
  if (this.#isGoalSatisfied(current.state, goal)) {
    return this.#createPlan(current.actions);
  }

  // NEW: Cost limit check
  const maxCost = goal.maxCost || Infinity;
  if (current.cost > maxCost) {
    this.#logger.debug('Node exceeds cost limit, skipping', {
      currentCost: current.cost,
      maxCost
    });
    continue;
  }

  // NEW: Action count limit
  const maxActions = goal.maxActions || 20;
  if (current.actions.length >= maxActions) {
    this.#logger.debug('Node exceeds action count limit, skipping', {
      actionCount: current.actions.length,
      maxActions
    });
    continue;
  }

  // ... rest of loop ...
}

// After loop completes without finding plan
this.#eventBus.dispatch({
  type: GOAP_EVENTS.PLANNING_FAILED,
  payload: {
    actorId,
    goalId: goal.id,
    reason: 'no_valid_plan',
    details: {
      nodesExpanded: closed.size,
      maxCost: goal.maxCost,
      maxActions: goal.maxActions
    }
  }
});
```

**Testing**:
- Test: Cost limit prevents runaway plans
- Test: Action limit prevents excessive sequences
- Test: Limits don't interfere with valid plans

### 8.4 Phase 4: Documentation & Debugging (PRIORITY 4)

**Files to Create/Modify**:
1. `docs/goap/multi-action-planning.md` - NEW
   - Algorithm explanation
   - Usage examples
   - Debugging procedures

2. `docs/goap/debugging-tools.md` - UPDATE
   - Add multi-action debugging workflows
   - Add example outputs

**Content**:
- Step-by-step debugging guide (from Section 6)
- Example outputs from debugging tools
- Common issues and solutions

## 9. Acceptance Criteria

### 9.1 Functional Requirements

✅ **FR1**: Planner creates plans with 2+ instances of same task when needed
✅ **FR2**: All 16 integration tests pass (7 existing + 9 currently failing)
✅ **FR3**: Heuristic estimates action count for improved A* guidance
✅ **FR4**: Cost and action limits prevent runaway planning
✅ **FR5**: Edge cases handled: overshoot, impossible goals, wrong direction

### 9.2 Non-Functional Requirements

✅ **NFR1**: Backward compatibility - all 7 passing tests remain green
✅ **NFR2**: Performance - planning completes in < 100ms for 10-action plans
✅ **NFR3**: Debugging - comprehensive tools for diagnosing multi-action issues
✅ **NFR4**: Code quality - ESLint passes, 80%+ coverage maintained

### 9.3 Testing Requirements

✅ **TR1**: Unit tests for `isTaskReusable()` method
✅ **TR2**: Unit tests for enhanced heuristic
✅ **TR3**: Integration tests for all edge cases (Tests 1-9 from Section 7)
✅ **TR4**: Performance tests for large action sequences (20+ actions)

## 10. Open Questions

**Q1**: Should there be a per-task reuse limit, or a global action count limit?
- **Decision**: Both. `task.maxReuse` (default: 10) AND `goal.maxActions` (default: 20)
- **Rationale**: Different granularity of control

**Q2**: How to handle partial effects (e.g., task that reduces hunger by variable amount)?
- **Decision**: Out of scope for this spec. Assume fixed effects for now.
- **Future**: Add support for parameterized effects in MODCOMPLASUP-011

**Q3**: Should heuristic use cheapest task or most effective task?
- **Decision**: Most effective (largest distance reduction per action)
- **Rationale**: A* will explore cheaper paths naturally via cost function

**Q4**: What happens if multiple tasks can reduce distance (e.g., "eat" and "fast")?
- **Decision**: Heuristic uses most effective, A* search explores all
- **Rationale**: Heuristic is just guidance, search finds optimal plan

## 11. References

- **Primary Spec**: `specs/goap-system-specs.md` - GOAP architecture overview
- **Debugging Tools**: `docs/goap/debugging-tools.md` - Tool usage guide
- **Related Tickets**:
  - `MODCOMPLASUP-001`: Add NumericConstraintEvaluator ✅ Complete
  - `MODCOMPLASUP-002`: Integrate numeric constraints into heuristic ✅ Complete
  - `MODCOMPLASUP-003`: PlanningEffectsSimulator validation ✅ Complete
  - `MODCOMPLASUP-004`: Test coverage for numeric goals ✅ Complete
  - `MODCOMPLASUP-005`: Dual-format state sync ✅ Complete
  - `MODCOMPLASUP-006`: Multi-action planning (THIS SPEC) 🔄 In Progress
  - `MODCOMPLASUP-007`: Activate external goal test (Blocked by -006)
  - `MODCOMPLASUP-008`: Documentation updates (Blocked by -006)

## 12. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-16 | Claude Code | Initial specification |
