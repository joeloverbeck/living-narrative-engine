# Simple Planner

## Overview

The SimplePlanner is a one-step greedy planner that serves as the foundation for the GOAP (Goal-Oriented Action Planning) system. It validates the planning infrastructure before investing in a full A* backward-chaining planner.

## Architecture

### Core Components

1. **SimplePlanner** (`src/goap/planning/simplePlanner.js`)
   - Delegates action selection to ActionSelector
   - Creates plan objects with single-step actions
   - Validates plan applicability

2. **ActionSelector** (`src/goap/selection/actionSelector.js`)
   - Filters actions to those with planning effects
   - Calculates progress by simulating effects
   - Selects action with highest positive progress
   - Supports conditional effects and abstract preconditions

3. **PlanCache** (`src/goap/planning/planCache.js`)
   - Caches plans to avoid replanning every turn
   - Provides actor-specific and goal-based invalidation
   - Tracks cache statistics

### Dependencies

```
SimplePlanner
  ├── ILogger
  ├── IActionSelector
  └── IGoalManager (injected but unused; reserved for Tier 2+)

ActionSelector
  ├── ILogger
  ├── IGoalStateEvaluator
  ├── IEntityManager (validated but not stored)
  └── IAbstractPreconditionSimulator

PlanCache
  └── ILogger
```

## One-Step Planning Algorithm

The SimplePlanner delegates to ActionSelector, which uses this greedy approach:

1. **Filter Actions**: Select only actions with planning effects
2. **Calculate Progress**: For each action:
   - Calculate current distance to goal
   - Simulate applying action's effects (deep clone state)
   - Calculate future distance to goal
   - Progress = currentDistance - futureDistance
3. **Filter Positive**: Keep only actions with positive progress (progress > 0)
4. **Select Best**: Choose action with highest progress score

### Algorithm Details

```javascript
// SimplePlanner.plan()
function plan(goal, availableActions, actorId, context) {
  const selectedAction = actionSelector.selectAction(
    availableActions,
    goal,
    actorId,
    context
  );
  return selectedAction; // or null if no suitable action
}

// ActionSelector.selectAction()
function selectAction(availableActions, goal, actorId, context) {
  // Step 1: Filter to actions with planning effects
  const plannable = availableActions.filter(a => a.planningEffects);

  // Step 2: Calculate progress for each action
  const scored = plannable.map(action => ({
    action,
    score: calculateProgress(action, goal, actorId, context)
  }));

  // Step 3: Filter positive progress only
  const positive = scored.filter(s => s.score > 0);

  // Step 4: Sort by score descending and return best
  positive.sort((a, b) => b.score - a.score);
  return positive[0]?.action || null;
}
```

## Plan Structure

```javascript
{
  goalId: "survival:find_food",
  steps: [
    {
      actionId: "items:pick_up_food",
      targetId: "food_item_123",
      tertiaryTargetId: null,
      reasoning: "Action items:pick_up_food has 2 effects that move toward goal survival:find_food"
    }
  ],
  createdAt: 1699999999999,
  validUntil: null  // Always null for SimplePlanner (no expiration)
}
```

**Fields:**
- `goalId` - ID of goal this plan pursues
- `steps` - Array of action steps (always length 1 for SimplePlanner)
- `createdAt` - Timestamp when plan was created
- `validUntil` - Always null for SimplePlanner (Tier 2+ feature)

## Plan Caching

### Cache Operations

```javascript
planCache.set('actor1', plan);              // Store plan
const plan = planCache.get('actor1');       // Retrieve (or null)
const has = planCache.has('actor1');        // Check existence
planCache.invalidate('actor1');             // Invalidate actor's plan
planCache.invalidateGoal('survival:find_food'); // Invalidate by goal
planCache.clear();                          // Clear all plans
const stats = planCache.getStats();         // { size: 5, actors: [...] }
```

### Caching Workflow

```
Turn 1: miss → plan → cache → execute
Turn 2: hit → validate → execute
Turn 3: state change → invalidate → miss → plan → cache → execute
```

## Plan Validation

SimplePlanner provides minimal validation:

```javascript
function validatePlan(plan, context) {
  // Check expiration (if set)
  if (plan.validUntil && Date.now() > plan.validUntil) return false;

  // Check has steps
  if (!plan.steps || plan.steps.length === 0) return false;

  return true;
}
```

**Note:** Tier 2+ will add precondition checking, action availability, and world state verification.

## Cache Invalidation Strategies

**Actor-specific:**
```javascript
planCache.invalidate(actorId);  // After action execution or state change
```

**Goal-based:**
```javascript
planCache.invalidateGoal('survival:find_food');  // When goal becomes impossible
```

**Global:**
```javascript
planCache.clear();  // Major state changes or turn boundaries
```

## Context Structure

The context parameter provides a snapshot of world state for planning:

```javascript
{
  entities: {
    [entityId]: {
      components: {
        [componentId]: componentData
      }
    }
  },
  targetId: 'optional_target_id',
  tertiaryTargetId: 'optional_tertiary_target_id'
}
```

**Important:** The context is a plain JavaScript object (snapshot), not direct EntityManager access. This allows simulation without modifying the actual world state.

## Effect Simulation

ActionSelector simulates effects by deep cloning world state and applying operations:

### Supported Operations

1. **ADD_COMPONENT** - Adds component to entity
   ```javascript
   { operation: 'ADD_COMPONENT', entity: 'actor', component: 'core:has_food', data: {} }
   ```

2. **REMOVE_COMPONENT** - Removes component from entity
   ```javascript
   { operation: 'REMOVE_COMPONENT', entity: 'actor', component: 'positioning:sitting' }
   ```

3. **MODIFY_COMPONENT** - Updates component fields
   ```javascript
   { operation: 'MODIFY_COMPONENT', entity: 'actor', component: 'core:energy', updates: { value: 100 } }
   ```

4. **CONDITIONAL** - Conditional effects with abstract preconditions
   ```javascript
   {
     operation: 'CONDITIONAL',
     condition: { abstractPrecondition: 'isFacing', params: ['actor', 'target'] },
     then: [/* effects if true */],
     else: [/* effects if false */]
   }
   ```

### Entity Reference Resolution

Effects use entity references that are resolved during simulation:
- `'actor'` → actorId parameter
- `'target'` → context.targetId
- `'tertiary_target'` → context.tertiaryTargetId
- Direct ID → unchanged

## Usage Example

```javascript
const simplePlanner = container.resolve(goapTokens.ISimplePlanner);
const planCache = container.resolve(goapTokens.IPlanCache);

function planForActor(actorId, goal, availableActions, context) {
  // Check cache
  let plan = planCache.get(actorId);

  if (plan && !simplePlanner.validatePlan(plan, context)) {
    planCache.invalidate(actorId);
    plan = null;
  }

  if (!plan) {
    const action = simplePlanner.plan(goal, availableActions, actorId, context);
    if (action) {
      plan = simplePlanner.createPlan(action, goal);
      planCache.set(actorId, plan);
    }
  }

  return plan;
}
```

## Limitations

SimplePlanner is intentionally limited for Tier 1:

| Feature | SimplePlanner (Tier 1) | A* Planner (Tier 2+) |
|---------|----------------------|---------------------|
| Planning depth | 1 step | Multiple steps |
| Optimality | Greedy (local) | Optimal (global) |
| Action sequences | Single action | Action chains |
| Backtracking | No | Yes |
| Dead-end detection | No | Yes |
| Cost consideration | Via progress score | Full pathfinding |
| State simulation | Deep clone + effects | Same |

**Known weaknesses:**
- Multi-step goals requiring action sequences
- Dead-ends (actions that prevent goal achievement)
- Suboptimal paths (may not find cheapest solution)

## Migration Path to Tier 2

The current interface will be extended with an optional `options` parameter for backward compatibility:

```javascript
// Tier 1 (current)
plan(goal, availableActions, actorId, context) → action|null

// Tier 2+ (future)
plan(goal, availableActions, actorId, context, options) → action|null
// options: { maxDepth: 5, costLimit: 10.0, simulateActions: true }
```

Tier 2+ enhancements:
- Multi-step planning (A* algorithm)
- Precondition checking for all plan steps
- Dead-end detection
- Plan repair when world changes

## Performance Characteristics

- **SimplePlanner**: O(1) - delegates to ActionSelector
- **ActionSelector**: O(n × m) where n = actions, m = effects per action
  - Filters plannable actions: O(n)
  - Calculates progress (with state simulation): O(n × m)
  - Sorts by score: O(n log n)
- **PlanCache**:
  - Get/Set/Has: O(1)
  - Invalidate actor: O(1)
  - Invalidate goal: O(k) where k = cached plans
  - Clear: O(k)

**Optimization tips:**
- Filter actions before planning
- Cache aggressively
- Invalidate selectively
- Profile if planning exceeds 10ms

## Testing

**Unit Tests:** `tests/unit/goap/planning/` (SimplePlanner, PlanCache, ActionSelector)

**E2E Tests:** `tests/e2e/goap/`
- Action selection with effect simulation
- Complete GOAP decision with real mods
- Goal priority selection workflow
- Plan caching and invalidation
- Error recovery and graceful degradation

**Coverage target:** 90% branches, 95% lines

## Common Issues

**Not caching plans:**
```javascript
// ❌ Bad: Plan every turn
const action = simplePlanner.plan(...);

// ✅ Good: Cache and reuse
let plan = planCache.get(actorId);
if (!plan || !simplePlanner.validatePlan(plan, context)) {
  const action = simplePlanner.plan(...);
  plan = simplePlanner.createPlan(action, goal);
  planCache.set(actorId, plan);
}
```

**Stale cache:**
```javascript
// ✅ Invalidate on state changes
planCache.invalidate(entityId);
```

**Wrong context structure:**
```javascript
// ❌ Bad: Direct EntityManager reference
const context = { entityManager };

// ✅ Good: Snapshot
const context = { entities: { actor1: { components: {...} } } };
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Planning slow | Pre-filter actions, check action count |
| Plans not cached | Verify `planCache.set()` is called |
| Cache always invalid | Check invalidation frequency |
| No action selected | Ensure actions have `planningEffects` with positive progress |
| Wrong action selected | Debug progress calculation in ActionSelector |

## Related Documentation

- [GOAP System Overview](./README.md)
- [Action Selector](./action-selector.md) - Action selection algorithm
- [Goal System](./goal-system.md) - Goal definition and evaluation
- [Effects Auto-Generation](./effects-auto-generation.md) - Planning effects
