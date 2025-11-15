# GOAPIMPL-021-02: Goal Selection Logic

**Parent Ticket**: GOAPIMPL-021 (GOAP Controller)
**Priority**: CRITICAL
**Estimated Effort**: 45 minutes
**Dependencies**: GOAPIMPL-021-01

## Description

Implement goal selection logic that chooses the highest priority relevant goal from the goal registry. Includes goal relevance checking (not satisfaction - that's the planner's job) and priority-based selection.

## Acceptance Criteria

- [ ] `#selectGoal(actor)` method implemented
- [ ] `#isGoalRelevant(goal, actor, world)` method implemented
- [ ] Goals retrieved from data registry (NOT actor component)
- [ ] Goals filtered by relevance condition
- [ ] Goals sorted by priority (descending)
- [ ] Returns null when no relevant goals exist
- [ ] 90%+ test coverage for goal selection

## Files to Modify

- `src/goap/controllers/goapController.js`

## Implementation Details

### CRITICAL: Goal Data Source Correction

**WRONG (what was assumed):**
```javascript
// ❌ INCORRECT - this is the LLM text-based goals component
const goalsComponent = actor.components?.['core:goals'];
```

**CORRECT (actual implementation):**
```javascript
// ✅ CORRECT - goals come from the goal registry, not actor components
const allGoals = this.#dataRegistry.getAll('goals');
```

### Goal Structure Reference

Goals are loaded from `data/mods/*/goals/*.goal.json` via `GoalLoader`:

```json
{
  "$schema": "schema://living-narrative-engine/goal.schema.json",
  "id": "movement:goal_survive",
  "description": "Stay alive by maintaining health above zero",
  "priority": 100,
  "relevance": {
    "and": [
      { "<": [{ "var": "actor.components.core:health.hp" }, 50] },
      { "has_component": ["actor", "core:alive"] }
    ]
  },
  "goalState": {
    ">=": [{ "var": "actor.components.core:health.hp" }, 80]
  }
}
```

**Key Fields:**
- `id`: Namespaced goal identifier (e.g., "movement:goal_survive")
- `priority`: Numeric importance (higher = more important)
- `relevance`: JSON Logic condition - when is this goal applicable?
- `goalState`: JSON Logic condition - what world state we want to achieve (used by planner, NOT goal selection)

**Note on Condition Format:**
- Conditions are direct JSON Logic objects (no wrapper)
- Example: `"relevance": { "and": [...] }` NOT `"relevance": { "logic": { "and": [...] } }`
- Follows `condition-container.schema.json` which supports direct JSON Logic or `condition_ref`

### Goal Selection Algorithm

```javascript
/**
 * Select highest priority relevant goal from goal registry
 * @param {object} actor - Actor entity
 * @param {object} world - World state
 * @returns {object|null} Selected goal or null
 * @private
 */
#selectGoal(actor, world) {
  // Get all registered goals (from mods, not actor component)
  const allGoals = this.#dataRegistry.getAll('goals');

  if (!allGoals || allGoals.length === 0) {
    this.#logger.debug('No goals registered in system', { actorId: actor.id });
    return null;
  }

  // Build context for relevance evaluation
  const context = this.#contextAssemblyService.assemblePlanningContext(actor.id);

  // Add world state to context
  const evaluationContext = {
    ...context,
    world: world
  };

  // Filter to only relevant goals
  const relevantGoals = allGoals.filter(goal =>
    this.#isGoalRelevant(goal, evaluationContext)
  );

  if (relevantGoals.length === 0) {
    this.#logger.debug('No relevant goals for actor', {
      actorId: actor.id,
      totalGoals: allGoals.length
    });
    return null;
  }

  // Sort by priority (descending - higher priority first)
  const sortedGoals = [...relevantGoals].sort((a, b) => b.priority - a.priority);

  const selectedGoal = sortedGoals[0];

  this.#logger.info('Goal selected', {
    actorId: actor.id,
    goalId: selectedGoal.id,
    priority: selectedGoal.priority,
    relevantCount: relevantGoals.length,
    totalCount: allGoals.length
  });

  return selectedGoal;
}

/**
 * Check if goal relevance condition is satisfied
 *
 * NOTE: This checks RELEVANCE, not GOAL SATISFACTION.
 * - Relevance: "Is this goal applicable right now?" (e.g., low health → healing goal is relevant)
 * - Goal Satisfaction: "Has the goal been achieved?" (checked by planner against goalState)
 *
 * @param {object} goal - Goal to check
 * @param {object} context - Evaluation context (actor + world state)
 * @returns {boolean} True if goal is relevant
 * @private
 */
#isGoalRelevant(goal, context) {
  if (!goal.relevance) {
    // No relevance condition = always relevant
    this.#logger.debug('Goal has no relevance condition, treating as always relevant', {
      goalId: goal.id
    });
    return true;
  }

  try {
    // Evaluate relevance condition using JSON Logic service
    // The context contains actor and world state assembled by ContextAssemblyService
    const result = this.#jsonLogicService.evaluate(goal.relevance, context);

    this.#logger.debug('Goal relevance evaluated', {
      goalId: goal.id,
      relevant: Boolean(result)
    });

    return Boolean(result);
  } catch (err) {
    this.#logger.error('Goal relevance evaluation failed', {
      goalId: goal.id,
      error: err.message,
      relevanceCondition: goal.relevance
    });
    // Treat evaluation errors as not relevant (fail-safe)
    return false;
  }
}
```

## Required Dependencies

### Add to Constructor

The controller needs access to the data registry to retrieve goals:

```javascript
/**
 * @typedef {import('../../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 */

class GoapController {
  /** @type {IDataRegistry} */
  #dataRegistry;

  constructor({
    goapPlanner,
    refinementEngine,
    planInvalidationDetector,
    contextAssemblyService,
    jsonLogicService,  // ← ALREADY INJECTED (no new dependency)
    eventBus,
    dataRegistry,  // ← NEW DEPENDENCY
    logger,
  }) {
    // ... existing validation ...

    validateDependency(dataRegistry, 'IDataRegistry', this.#logger, {
      requiredMethods: ['getAll', 'get'],
    });

    // ... existing assignments ...
    this.#dataRegistry = dataRegistry;
  }
}
```

**Note on JSON Logic Service:**
- `IJsonLogicService` is already injected into the GOAP controller
- Used for evaluating goal relevance conditions
- No new dependency injection needed - already available via `this.#jsonLogicService`

### Update DI Registration

Will be handled in GOAPIMPL-021-07 (DI Registration ticket)

## Testing Requirements

### Unit Tests (add to existing test file)
- [ ] Selects highest priority goal when multiple relevant
- [ ] Returns null when no goals registered in system
- [ ] Returns null when no goals are relevant to actor/world state
- [ ] Goal relevance checks evaluate JSON Logic correctly
- [ ] Goal relevance handles empty/missing relevance condition (always relevant)
- [ ] Goal relevance handles evaluation errors gracefully (treat as not relevant)
- [ ] Goals retrieved from data registry, not actor component
- [ ] Multiple goals with same priority handled consistently

### Test Data Setup

```javascript
// Example test fixture setup
beforeEach(() => {
  // Register goals in data registry
  dataRegistry.register('goals', 'survival:stay_alive', {
    id: 'survival:stay_alive',
    priority: 100,
    relevance: {
      '<': [{ var: 'actor.components.core:health.hp' }, 50]
    },
    goalState: {
      '>=': [{ var: 'actor.components.core:health.hp' }, 80]
    }
  });

  dataRegistry.register('goals', 'needs:eat_food', {
    id: 'needs:eat_food',
    priority: 50,
    relevance: {
      '>=': [{ var: 'actor.components.core:needs.hunger' }, 60]
    },
    goalState: {
      '<=': [{ var: 'actor.components.core:needs.hunger' }, 20]
    }
  });
});
```

## Integration Points

### Required Services
- `IDataRegistry` - Retrieve registered goals from mods
- `IContextAssemblyService` - Build evaluation contexts (already exists)
- JSON Logic evaluator (existing infrastructure)

### Used By
- `GOAPController.decideTurn()` - Main decision loop

## Success Validation

✅ **Done when**:
- Goal selection retrieves goals from data registry
- Relevance conditions evaluated correctly using JSON Logic
- Highest priority relevant goal selected
- All edge cases handled (no goals, no relevant goals, evaluation errors)
- Unit tests pass with 90%+ coverage
- Integration with context assembly service works

## Related Tickets

- **Previous**: GOAPIMPL-021-01 (Core Controller Structure)
- **Next**: GOAPIMPL-021-03 (Plan State Management)
- **Related**: GOAPSPECANA-007 (Goal Schema Analysis)
- **Implements**: GOAPIMPL-021 (Parent - GOAP Controller)

## Validation Notes

### Corrected Assumptions

**ORIGINAL WORKFLOW ASSUMPTION (WRONG):**
- Goals stored in `actor.components['core:goals']`
- Structure: `{ goals: [{ id, priority, conditions }] }`

**ACTUAL IMPLEMENTATION (CORRECT):**
- Goals loaded from `data/mods/*/goals/*.goal.json`
- Retrieved via `dataRegistry.getAll('goals')`
- Structure follows `goal.schema.json` with `relevance` and `goalState`

**WHY THE CONFUSION:**
There are TWO different "goals" concepts:
1. **`core:goals` component** - Text-based goals for LLM players (e.g., "Earn money for car")
2. **GOAP goals** - Structured planning goals loaded from mods

The workflow conflated these two completely different systems.

### Current State

- ✅ `GoalLoader` exists and works (`src/loaders/goalLoader.js`)
- ✅ Goal schema exists (`data/schemas/goal.schema.json`)
- ✅ Integration tests pass
- ❌ No mods currently have goals (directories don't exist)
- ✅ System ready for goal files to be added

### Next Steps After This Ticket

1. Create example goal files in `data/mods/core/goals/`
2. Test goal loading through mod system
3. Verify goal selection with real goal data
