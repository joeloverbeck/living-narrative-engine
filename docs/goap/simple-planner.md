# Simple Planner

## Overview

The SimplePlanner is a one-step greedy planner that serves as the foundation for the GOAP (Goal-Oriented Action Planning) system. It validates the planning infrastructure before investing in a full A* backward-chaining planner.

## Architecture

### Components

1. **SimplePlanner** (`src/goap/planning/simplePlanner.js`)
   - Selects the best single action to move toward a goal
   - Delegates action selection to ActionSelector
   - Creates plan objects with single-step actions
   - Validates plan applicability

2. **PlanCache** (`src/goap/planning/planCache.js`)
   - Caches plans to avoid replanning every turn
   - Supports actor-specific caching
   - Provides goal-based invalidation
   - Tracks cache statistics

### Dependencies

```
SimplePlanner
  ├── ILogger
  ├── IActionSelector
  └── IGoalManager (reserved for Tier 2+)

PlanCache
  └── ILogger
```

## One-Step Planning Algorithm

The SimplePlanner uses a greedy approach:

1. **Filter Actions**: Select actions with planning effects
2. **Calculate Progress**: For each action, calculate how much it moves toward goal
3. **Select Best**: Choose action with highest positive progress
4. **Create Plan**: Package selected action into a plan object

### Algorithm Details

```javascript
function plan(goal, availableActions, actorId, context) {
  // Step 1: Delegate to ActionSelector
  const selectedAction = actionSelector.selectAction(
    availableActions,
    goal,
    actorId,
    context
  );

  // Step 2: Return selected action (or null if none suitable)
  return selectedAction;
}
```

The actual selection logic is in ActionSelector, which:
- Calculates current distance to goal
- Simulates applying each action's effects
- Calculates future distance to goal
- Returns action with best progress (currentDistance - futureDistance)

## Plan Structure

Plans are simple JavaScript objects:

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
  validUntil: null  // No expiration for simple planner
}
```

### Fields

- **goalId**: ID of goal this plan pursues
- **steps**: Array of action steps (always length 1 for SimplePlanner)
  - **actionId**: ID of action to execute
  - **targetId**: Target entity ID (null if no target)
  - **tertiaryTargetId**: Tertiary target ID (null if none)
  - **reasoning**: Human-readable explanation
- **createdAt**: Timestamp when plan was created
- **validUntil**: Expiration timestamp (null = never expires)

## Plan Caching Strategy

The PlanCache provides actor-specific caching:

### Cache Operations

```javascript
// Store plan
planCache.set('actor1', plan);

// Retrieve plan
const plan = planCache.get('actor1'); // returns plan or null

// Check existence
if (planCache.has('actor1')) {
  // use cached plan
}

// Invalidate specific actor
planCache.invalidate('actor1');

// Invalidate all plans for goal
planCache.invalidateGoal('survival:find_food');

// Clear all plans
planCache.clear();

// Get statistics
const stats = planCache.getStats();
// { size: 5, actors: ['actor1', 'actor2', ...] }
```

### Caching Workflow

```
Turn 1:
  Check cache → miss → Plan → Cache plan → Execute first step

Turn 2:
  Check cache → hit → Validate plan → Execute next step

Turn 3:
  State change → Invalidate cache → Check cache → miss → Plan again
```

## Plan Validation

SimplePlanner provides minimal validation for Tier 1:

```javascript
function validatePlan(plan, context) {
  // Check expiration
  if (plan.validUntil && Date.now() > plan.validUntil) {
    return false;
  }

  // Check has steps
  if (!plan.steps || plan.steps.length === 0) {
    return false;
  }

  return true;
}
```

More sophisticated validation will be added in Tier 2:
- Validate preconditions still met
- Check if world state hasn't changed significantly
- Verify action still available

## Cache Invalidation Strategies

### Actor-Specific Invalidation

Invalidate when actor's state changes:

```javascript
// After action execution
planCache.invalidate(actorId);

// After component change
eventBus.on('COMPONENT_ADDED', ({ entityId }) => {
  planCache.invalidate(entityId);
});
```

### Goal-Based Invalidation

Invalidate when goal conditions change:

```javascript
// When goal becomes impossible
planCache.invalidateGoal('survival:find_food');

// When environment changes affecting goal
eventBus.on('WORLD_STATE_CHANGED', ({ affectedGoals }) => {
  affectedGoals.forEach(goalId => {
    planCache.invalidateGoal(goalId);
  });
});
```

### Full Invalidation

Clear all cached plans:

```javascript
// On major state changes
planCache.clear();

// On turn boundary (optional - depends on game design)
eventBus.on('TURN_ENDED', () => {
  planCache.clear(); // conservative approach
});
```

## Context Structure

The `context` parameter provides world state for planning:

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

This structure is built by the caller (typically GoapDecisionProvider) from EntityManager:

```javascript
const context = {
  entities: {},
  targetId: action.targetId,
  tertiaryTargetId: action.tertiaryTargetId
};

// Populate entities object from EntityManager
const relevantEntityIds = [actorId, targetId, tertiaryTargetId];
for (const id of relevantEntityIds) {
  if (id) {
    const entity = entityManager.getEntityInstance(id);
    context.entities[id] = {
      components: entity.getAllComponents()
    };
  }
}
```

## Usage Example

### Basic Planning

```javascript
// Setup
const simplePlanner = container.resolve(goapTokens.ISimplePlanner);
const planCache = container.resolve(goapTokens.IPlanCache);

// Planning workflow
function planForActor(actorId, goal, availableActions, context) {
  // Check cache first
  let plan = planCache.get(actorId);

  if (plan) {
    // Validate cached plan
    if (!simplePlanner.validatePlan(plan, context)) {
      // Invalid, replan
      planCache.invalidate(actorId);
      plan = null;
    }
  }

  if (!plan) {
    // Plan from scratch
    const selectedAction = simplePlanner.plan(goal, availableActions, actorId, context);

    if (selectedAction) {
      plan = simplePlanner.createPlan(selectedAction, goal);
      planCache.set(actorId, plan);
    }
  }

  return plan;
}
```

### With Goal Manager

```javascript
function decideAction(actorId, availableActions, context) {
  // Step 1: Select goal
  const goal = goalManager.selectGoal(actorId, context);
  if (!goal) return null;

  // Step 2: Check if goal satisfied
  if (goalManager.isGoalSatisfied(goal, actorId, context)) {
    return null; // no action needed
  }

  // Step 3: Plan for goal
  const plan = planForActor(actorId, goal, availableActions, context);
  if (!plan) return null;

  // Step 4: Return first step's action
  return plan.steps[0].actionId;
}
```

## Limitations vs. Full A* Planner

SimplePlanner is intentionally limited for Tier 1:

| Feature | SimplePlanner (Tier 1) | A* Planner (Tier 2+) |
|---------|----------------------|---------------------|
| Planning depth | 1 step | Multiple steps |
| Optimality | Greedy (local) | Optimal (global) |
| Action sequences | Single action | Action chains |
| Backtracking | No | Yes |
| Dead-end detection | No | Yes |
| Cost consideration | Via ActionSelector | Full pathfinding |
| State simulation | Basic | Complete |

### When SimplePlanner Fails

SimplePlanner may struggle with:

1. **Multi-step goals**: Goals requiring action sequences
   - Example: "Open chest, take key, unlock door"
   - SimplePlanner: Picks best single action, may not find solution

2. **Dead-ends**: Actions that prevent goal achievement
   - Example: Walking away from only food source
   - SimplePlanner: No lookahead to detect

3. **Optimal paths**: Multiple paths with different costs
   - Example: Fast dangerous route vs. slow safe route
   - SimplePlanner: May not find optimal path

These limitations are acceptable for Tier 1 validation.

## Migration Path to Tier 2

The SimplePlanner architecture supports future enhancement:

### Current Interface (Tier 1)

```javascript
plan(goal, availableActions, actorId, context) → action|null
createPlan(action, goal) → plan
validatePlan(plan, context) → boolean
```

### Future Interface (Tier 2+)

```javascript
// Enhanced planning with depth limit
plan(goal, availableActions, actorId, context, options) → action|null

// Options:
// {
//   maxDepth: 5,           // multi-step planning
//   costLimit: 10.0,       // cost threshold
//   simulateActions: true  // full state simulation
// }

// More sophisticated validation
validatePlan(plan, context) → boolean
// - Check preconditions for all steps
// - Verify action chain feasibility
// - Detect dead-ends
```

### Backward Compatibility

New features are opt-in via options parameter:

```javascript
// Tier 1 behavior (default)
const action = planner.plan(goal, actions, actorId, context);

// Tier 2 behavior (explicit)
const action = planner.plan(goal, actions, actorId, context, {
  maxDepth: 5
});
```

## Performance Characteristics

### SimplePlanner

- **Time Complexity**: O(n) where n = number of available actions
  - Delegates to ActionSelector which evaluates each action once
- **Space Complexity**: O(1) - no state simulation needed
- **Typical Performance**: < 5ms for 20-30 actions

### PlanCache

- **Get/Set**: O(1) - Map-based storage
- **Invalidate**: O(1) for actor, O(n) for goal
- **Memory**: O(k) where k = number of cached plans

### Optimization Tips

1. **Limit available actions**: Filter before planning
2. **Cache aggressively**: Most actors don't change every turn
3. **Invalidate selectively**: Only clear when necessary
4. **Profile planning**: Monitor ms per plan

## Testing

### Unit Tests

Location: `tests/unit/goap/planning/`

- `simplePlanner.test.js`: SimplePlanner class tests
- `planCache.test.js`: PlanCache class tests

Coverage target: 90% branches, 95% lines

### Integration Tests

Location: `tests/integration/goap/planning.integration.test.js`

Tests complete workflows:
- Plan for find_food goal
- Plan for rest_safely goal
- Plan caching across turns
- Plan invalidation on state change
- No plan when goal satisfied
- No plan when no actions available

## Examples

### Example 1: Find Food

```javascript
const goal = {
  id: 'survival:find_food',
  goalState: {
    requirements: [
      {
        entity: 'self',
        component: 'survival:has_food',
        mustExist: true
      }
    ]
  }
};

const actions = [
  {
    id: 'items:pick_up_food',
    planningEffects: {
      effects: [
        {
          operation: 'ADD_COMPONENT',
          entity: 'actor',
          component: 'survival:has_food',
          data: { amount: 1 }
        }
      ]
    }
  }
];

const action = simplePlanner.plan(goal, actions, 'actor1', context);
// → { id: 'items:pick_up_food', ... }

const plan = simplePlanner.createPlan(action, goal);
// → { goalId: 'survival:find_food', steps: [...], ... }
```

### Example 2: Rest Safely

```javascript
const goal = {
  id: 'survival:rest_safely',
  goalState: {
    requirements: [
      {
        entity: 'self',
        component: 'positioning:sitting',
        mustExist: true
      }
    ]
  }
};

const actions = [
  {
    id: 'positioning:sit_down',
    planningEffects: {
      effects: [
        {
          operation: 'ADD_COMPONENT',
          entity: 'actor',
          component: 'positioning:sitting',
          data: {}
        }
      ]
    }
  }
];

const action = simplePlanner.plan(goal, actions, 'actor1', context);
const plan = simplePlanner.createPlan(action, goal);
planCache.set('actor1', plan);
```

## Common Pitfalls

### 1. Forgetting to Cache Plans

```javascript
// ❌ Bad: Plan every turn (expensive)
function getTurnAction(actorId) {
  const action = simplePlanner.plan(...);
  return action;
}

// ✅ Good: Cache and reuse
function getTurnAction(actorId) {
  let plan = planCache.get(actorId);
  if (!plan || !simplePlanner.validatePlan(plan, context)) {
    const action = simplePlanner.plan(...);
    plan = simplePlanner.createPlan(action, goal);
    planCache.set(actorId, plan);
  }
  return plan.steps[0].actionId;
}
```

### 2. Not Invalidating Cache

```javascript
// ❌ Bad: Stale plans
eventBus.on('COMPONENT_ADDED', ({ entityId }) => {
  // Plan cache not invalidated
});

// ✅ Good: Invalidate on change
eventBus.on('COMPONENT_ADDED', ({ entityId }) => {
  planCache.invalidate(entityId);
});
```

### 3. Incorrect Context Structure

```javascript
// ❌ Bad: Direct EntityManager reference
const context = { entityManager };

// ✅ Good: Snapshot of world state
const context = {
  entities: {
    actor1: { components: {...} }
  }
};
```

## Related Documentation

- [GOAP System Overview](./README.md)
- [Action Selector](./action-selector.md) - Action selection algorithm
- [Goal System](./goal-system.md) - Goal definition and evaluation
- [Effects Auto-Generation](./effects-auto-generation.md) - Planning effects

## Future Enhancements (Tier 2+)

1. **Multi-step planning**: A* backward chaining
2. **Plan repair**: Adapt plans when world changes
3. **Plan library**: Reuse successful plans
4. **Hierarchical planning**: Break down complex goals
5. **Plan explanation**: Better reasoning generation
6. **Cost optimization**: Find cheapest path to goal
7. **Time-limited planning**: Anytime algorithm
8. **Partial order planning**: Flexible action sequences

## Questions & Troubleshooting

**Q: Why is planning slow?**
A: Check number of available actions. Consider pre-filtering or caching.

**Q: Plans never cached?**
A: Verify `planCache.set()` is called after `createPlan()`.

**Q: Cached plans always invalid?**
A: Check if `validUntil` is set too short or invalidation too aggressive.

**Q: No action selected?**
A: Ensure actions have `planningEffects` and make positive progress.

**Q: Wrong action selected?**
A: Check ActionSelector's progress calculation and goal distance.

For more questions, see [GOAP Troubleshooting](./troubleshooting.md).
