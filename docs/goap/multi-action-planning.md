# Multi-Action Planning Guide

## Overview

Multi-action planning allows GOAP actors to create plans with multiple sequential tasks to achieve complex goals. This enables realistic behavior where actors must perform multiple steps to satisfy goals that cannot be achieved in a single action.

### What is Multi-Action Planning?

Multi-action planning is the ability to chain multiple abstract tasks together to achieve a goal. For example, to reduce hunger from 100 to 0, an actor might need to eat multiple times if each meal only reduces hunger by 60.

### When is it Needed?

Multi-action planning is needed when:

- **Goal requires accumulation**: Gathering 100 gold with tasks that give 25 gold each
- **Goal requires reduction**: Reducing hunger from 100 to ≤10 with meals that reduce by 60 each
- **Multiple fields must change**: Both hunger ≤10 AND health ≥80 requiring different tasks
- **Complex workflows**: Acquire item → move to location → use item sequences

### How Does it Work?

The GOAP planner uses A\* search to find the optimal sequence of tasks that:

1. **Start from current state**: Actor's current world state
2. **Apply task effects sequentially**: Simulate state changes via `planning_effects`
3. **Reach goal state**: Satisfy all conditions in `goalState`
4. **Minimize cost**: Choose lowest-cost plan within limits

## Core Concepts

### Task vs Action Separation

The GOAP system uses a two-level architecture:

- **Planning Tasks**: Abstract intentions used during planning (e.g., `task:consume_nourishing_item`)
  - Defined in `data/mods/*/tasks/` directories
  - Have `planning_preconditions` and `planning_effects`
  - Work at the conceptual level ("consume food")
- **Executable Actions**: Concrete operations executed by the engine (e.g., `items:consume_item`)
  - Defined in `data/mods/*/actions/` directories
  - Have `prerequisites`, `forbidden_components`, `required_components`
  - Work at the physical level ("eat this specific apple")

- **Refinement**: Translation from tasks to actions after planning
  - Occurs during execution, not during planning
  - Handles the micro-details of "how" to execute an abstract task
  - See `specs/goap-system-specs.md` for complete explanation

**Key Insight**: The planner reasons about tasks (abstract), then refines them to actions (concrete) at execution time.

### Task Reusability

Tasks can be reused multiple times in a single plan:

- **Distance Reduction Check**: Each task application must reduce the distance to goal
  - Calculated via heuristics (goal-distance or RPG)
  - If `distance(after) >= distance(before)`, task is not applicable
  - The numeric guard only runs when the goal's root operator is a pure comparator (`<`, `<=`, `>`, or `>=`). This is the same `goalHasPureNumericRoot(goal)` helper used inside `GoapPlanner`; wrap numeric checks inside `and`/`or` trees and the guard is bypassed entirely.
  - When either heuristic calculation sanitizes (NaN, Infinity, negative output, or a thrown error), the planner logs `Heuristic produced invalid value` once per `(actorId, goalId, heuristicId)` and immediately prints `Heuristic distance invalid, bypassing guard` before returning `true`. Sanitized heuristics are treated as instrumentation failures, not guard rejections.
  - If `planningEffectsSimulator` reports `{ success: false }` or throws while preparing the successor state, `testTaskReducesDistance` records Effect Failure Telemetry and throws `GOAP_PLANNER_FAILURES.INVALID_EFFECT_DEFINITION`. The guard never returns `false` for these cases—bad effects are fatal rather than "distance didn't shrink" noise.
  - Historical rationale and edge-case catalog: `archive/GOADISGUAROB/goap-distance-guard-robustness.md`.

- **Reuse Limits**: Tasks have optional `maxReuse` configuration
  - Default: 10 (prevents infinite loops)
  - Can be overridden per task
  - Example: Mining task limited to 5 uses per plan
- **Structural Gates**: Filter task library per actor before planning
  - Coarse "is this relevant in principle?" check
  - Different from execution-time prerequisites
  - Knowledge-based existence queries

### Heuristic Enhancement

The planner uses heuristics to guide the search efficiently:

- **Goal-Distance Heuristic**: Counts unsatisfied conditions + numeric distances
  - Simple mode: Count boolean conditions + sum numeric gaps
  - Enhanced mode: Estimates task count via most effective task analysis
  - Time complexity: O(n) for n conditions, O(t) for enhanced with t tasks
- **RPG Heuristic**: Relaxed planning graph analysis
  - Advanced heuristic with better accuracy
  - Analyzes abstract plan structure
  - More expensive but finds better plans
- **Admissibility**: All heuristics maintain admissibility (never overestimate cost)
  - Guarantees A\* optimality
  - Critical for finding lowest-cost plans

**Performance Benefit**: Good heuristics dramatically reduce search space and planning time.

### Stopping Criteria

The planner stops when:

- **Goal Reached**: All goal conditions satisfied
- **Cost Limit Exceeded**: Estimated cost > `goal.maxCost` (default: Infinity)
- **Action Limit Exceeded**: Plan length > `goal.maxActions` (default: 20)
- **Impossibility Detected**: Search exhausted with no solution

**Configuration**: Limits defined in goal definition, not runtime goal object.

## Usage Examples

### Example 1: Resource Accumulation

**Scenario**: Gather 100 gold with mine task (+25 gold per use)

```javascript
const goal = {
  id: 'gather_gold',
  goalState: {
    '>=': [{ var: 'state.actor.components.core_resources.gold' }, 100],
  },
  maxCost: 50, // Reasonable cost limit
  maxActions: 10, // Prevent excessive plans
};

// Initial state: gold = 0
// Mine task: +25 gold, cost = 5

// Expected plan: 4 mine tasks
// 0 → 25 → 50 → 75 → 100
// Total cost: 20 (4 tasks × 5 cost)
```

**Key Points**:

- Inequality goal (≥) allows overshoot
- Task reused 4 times (within maxReuse limit)
- Each task reduces distance: 100 → 75 → 50 → 25 → 0

### Example 2: Stat Management

**Scenario**: Reduce hunger from 100 to ≤10

```javascript
const goal = {
  id: 'reduce_hunger',
  goalState: {
    '<=': [{ var: 'state.actor.components.core_needs.hunger' }, 10],
  },
};

// Initial state: hunger = 100
// Eat task: -60 hunger, cost = 5

// Expected plan: 2 eat tasks
// 100 → 40 → -20 (clamped to 0)
// Total cost: 10 (2 tasks × 5 cost)
```

**Key Points**:

- Inequality goal (≤) allows overshoot to 0
- Values clamped at 0 (standard behavior)
- Second eat brings hunger from 40 to 0 (overshoots target of 10)

### Example 3: Multi-Field Goals

**Scenario**: Hunger ≤10 AND Health ≥80

```javascript
const goal = {
  goalState: {
    and: [
      { '<=': [{ var: 'state.actor.components.core_needs.hunger' }, 10] },
      { '>=': [{ var: 'state.actor.components.core_stats.health' }, 80] },
    ],
  },
};

// Initial state: hunger = 100, health = 50
// Eat task: -60 hunger, +10 health, cost = 5
// Heal task: +40 health, cost = 10

// Expected plan: Mixed tasks
// 1. eat (hunger: 100→40, health: 50→60)
// 2. eat (hunger: 40→0, health: 60→70)
// 3. heal (hunger: 0, health: 70→110)
// OR alternative with different task ordering
```

**Key Points**:

- Combined goals require coordinated task selection
- Planner finds optimal mix based on costs
- Task order may vary depending on heuristic guidance

## Configuration Options

### Task Configuration

```javascript
{
  "id": "test:eat",
  "cost": 5,
  "maxReuse": 10,      // Optional: limit task reuse (default: 10)
  "structural_gates": {
    // Optional: coarse applicability filter
    "and": [
      { "!!": { "var": "actor.components.biology:can_eat" } }
    ]
  },
  "planning_preconditions": {
    // Optional: state-space preconditions
  },
  "planning_effects": [
    {
      "op": "decrease",
      "path": "actor.components.core_needs.hunger",
      "amount": 60
    }
  ]
}
```

**Field Descriptions**:

- `id`: Unique task identifier (modId:taskName)
- `cost`: Task cost for A\* search (lower = preferred)
- `maxReuse`: Maximum times task can appear in one plan
- `structural_gates`: Coarse "is this task ever applicable?"
- `planning_preconditions`: Fine "is this task applicable in this state?"
- `planning_effects`: State changes this task causes

### Goal Configuration

```javascript
{
  "id": "test:reduce_hunger",
  "goalState": {
    // JSON Logic expression
    "<=": [{ "var": "state.actor.components.core_needs.hunger" }, 10]
  },
  "maxCost": 50,       // Optional: max plan cost (default: Infinity)
  "maxActions": 20,    // Optional: max plan length (default: 20)
  "allowOvershoot": true  // Optional: for inequality goals (auto-detected)
}
```

**Field Descriptions**:

- `id`: Unique goal identifier
- `goalState`: JSON Logic expression defining success
- `maxCost`: Planning stops if estimated cost exceeds this
- `maxActions`: Planning stops if plan length exceeds this
- `allowOvershoot`: Whether overshoot allowed for inequality goals

**Note**: `maxCost` and `maxActions` come from goal definition (data registry), not runtime goal object.

## Edge Cases

### Overshoot Scenarios

The planner handles overshoot differently based on goal type:

**Inequality Goals (≤, ≥)**: Overshoot allowed

```javascript
// Goal: hunger ≤ 10
// Task: -60 hunger
// 100 → 40 → -20 (clamped to 0) ✅ Allowed, still satisfies ≤10
```

**Equality Goals (=)**: Overshoot NOT allowed

```javascript
// Goal: hunger = 10
// Task: -60 hunger
// 100 → 40 ❌ Cannot continue, would overshoot
```

**Automatic Detection**: Goal type detected via goal state analysis.

> **Numeric Heuristic Guard**
>
> `GoapPlanner.#hasNumericConstraints` only treats a goal as "numeric" when the
> root JSON Logic operator is a comparator (`<=`, `<`, `>=`, `>`). Mixed roots
> (`and`, `or`, component predicates, equality wrappers) are evaluated as
> booleans and bypass `#taskReducesDistance`. If you need heuristic-driven
> pruning, keep the numeric comparator at the root and move structural checks
> into separate goals or upstream gating logic.

### Impossible Goals

The planner detects impossibility in several ways:

**Wrong Direction Tasks**: Task increases when decrease needed

```javascript
// Goal: hunger ≤ 10 (need decrease)
// Only task available: +20 hunger (increases)
// Result: Planning fails, no tasks reduce distance
```

**Insufficient Effect**: Task effect too small, would exceed cost/action limits

```javascript
// Goal: hunger ≤ 0
// Task: -5 hunger, cost = 10
// Limit: maxCost = 50
// Estimated: 20 tasks × 10 cost = 200 > 50
// Result: Planning fails, exceeds cost limit
```

**No Applicable Tasks**: Structural gates or preconditions exclude all tasks

```javascript
// Goal: reduce_hunger
// Actor: no biology:can_eat component
// Result: Task library empty after structural gates, planning fails
```

### Performance Considerations

**Large Action Counts (20+ actions)**:

- Use performance profiling tools
- Consider increasing task effect magnitude
- Verify heuristic accuracy

**Complex Goals**:

- Monitor node expansion count
- Use RPG heuristic for better guidance
- Set reasonable cost/action limits

**Heuristic Accuracy**:

- Verify admissibility (never overestimate)
- Test with known-solvable scenarios
- Compare estimated vs actual plan costs

## Troubleshooting

### Common Issues

#### Issue 1: Planning Fails for Multi-Action Scenario

**Symptoms**: `goap:planning_failed` event dispatched

**Solution**:

1. **Check task reduces distance**:

   ```javascript
   const initialDistance = heuristicRegistry.calculate(
     'goal-distance',
     initialState,
     goal
   );
   const successorState = effectsSimulator.simulateEffects(
     initialState,
     task.planningEffects,
     context
   );
   const newDistance = heuristicRegistry.calculate(
     'goal-distance',
     successorState,
     goal
   );
   console.log('Reduces Distance:', newDistance < initialDistance);
   ```

2. **Verify reuse limit not exceeded**:

   ```javascript
   const taskDef = dataRegistry.get('tasks', 'test:eat');
   const maxReuse = taskDef.maxReuse || 10;
   console.log('Max Reuse:', maxReuse);
   ```

3. **Check cost/action limits**:
   ```javascript
   const goalDef = dataRegistry.getGoalDefinition(goal.id);
   const maxCost = goalDef.maxCost || Infinity;
   const maxActions = goalDef.maxActions || 20;
   console.log('Cost Limit:', maxCost, 'Action Limit:', maxActions);
   ```

#### Issue 2: Plan Has Too Many Tasks

**Symptoms**: Plan length exceeds expected

**Solution**:

1. **Lower action limit**:

   ```javascript
   goal.maxActions = 5; // Reduce from default 20
   ```

2. **Increase task effect magnitude**:

   ```javascript
   // Change: -10 hunger → -60 hunger
   // Reduces tasks needed: 10 → 2
   ```

3. **Use more effective tasks**:

```javascript
// Add new task with stronger effect
// Planner will prefer it if cost is reasonable
```

#### Issue 3: Numeric guard not triggering for mixed goals

**Symptoms**: GOAPDebugger/Plan Inspector report "Numeric Heuristic: BYPASSED" even though the goal contains numeric comparisons inside `and`/`or` trees.

**Solution**:

1. **Keep numeric comparator at root**:

   ```javascript
   // ✅ Heuristic active
   goalState: { '<=': [{ var: 'state.actor.components.core_needs.hunger' }, 20] }

   // ❌ Heuristic bypassed
   goalState: {
     and: [
       { has_component: ['actor', 'core:armed'] },
       { '<=': [{ var: 'state.actor.components.core_needs.hunger' }, 20] },
     ],
   }
   ```

2. **Split structural gating**: Move component checks into structural gates or a separate goal so the numeric comparator can sit at the root.
3. **Verify with tooling**: Use `goapDebugger.inspectPlan()` or `inspectPlanJSON()` to confirm the `Numeric Heuristic` line shows `ACTIVE`. See `docs/goap/debugging-tools.md` for full workflow.

#### Issue 4: Wrong Tasks Selected

**Symptoms**: Plan uses unexpected tasks

**Solution**:

1. **Verify structural gates**:

   ```javascript
   // Check task.structural_gates evaluate correctly
   const gates = task.structural_gates;
   const passes = jsonLogic.apply(gates, context);
   console.log('Structural Gates Pass:', passes);
   ```

2. **Check task costs**:

   ```javascript
   // Planner prefers cheaper tasks
   console.log(
     'Task Costs:',
     tasks.map((t) => ({ id: t.id, cost: t.cost }))
   );
   ```

3. **Review heuristic accuracy**:
   ```javascript
   // Bad heuristic can mislead search
   // Try different heuristic or debug search expansion
   ```

## Performance Tuning

### Optimize Planning Speed

**Use Enhanced Heuristic**: RPG heuristic provides better guidance

```javascript
// In heuristic registry, ensure RPG heuristic is registered
const heuristic = heuristicRegistry.get('rpg');
```

**Set Reasonable Limits**: Prevent excessive search

```javascript
goal.maxCost = 100; // Reasonable for scenario
goal.maxActions = 10; // Prevent runaway plans
```

**Profile Performance**: Measure and optimize hotspots

```javascript
const startTime = performance.now();
const plan = await planner.plan(actorId, goal, tasks, initialState);
const endTime = performance.now();
console.log('Planning Time:', endTime - startTime, 'ms');
```

### Reduce Memory Usage

**Limit Plan Length**: Smaller plans = less memory

```javascript
goal.maxActions = 10; // Down from 20
```

**Clean Up Closed States**: Periodic cleanup during long searches

```javascript
// Implement in planner (advanced)
if (closed.size > 10000) {
  // Prune low-priority states
}
```

**Efficient State Hashing**: Use msgpack for compact state representation

```javascript
// Already implemented in GOAP system
```

## References

- **GOAP System Specs**: [`specs/goap-system-specs.md`](../../specs/goap-system-specs.md) - Complete architecture explanation
- **Debugging Tools**: [`docs/goap/debugging-tools.md`](./debugging-tools.md) - Debug tool reference
- **Debugging Multi-Action**: [`docs/goap/debugging-multi-action.md`](./debugging-multi-action.md) - Troubleshooting workflows
- **Numeric Constraints**: Task loading guide and numeric constraint handling
- **Task Loading**: [`docs/goap/task-loading.md`](./task-loading.md) - How tasks are loaded from mods
