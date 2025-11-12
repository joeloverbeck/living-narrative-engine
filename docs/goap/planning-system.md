# GOAP Planning System

## Overview

The GOAP Planning System manages goal selection, action planning, and decision-making for AI actors. This system enables NPCs to intelligently select and pursue goals by evaluating available actions and simulating their effects.

**Key Components:**
- **Goal System**: Manages goal selection based on relevance and priority
- **SimplePlanner**: One-step greedy planner for action selection
- **ActionSelector**: Calculates progress toward goals by simulating effects
- **PlanCache**: Caches plans to avoid replanning
- **Abstract Preconditions**: Handles runtime-dependent conditions during planning

## Table of Contents

1. [Goal System](#goal-system)
2. [SimplePlanner & Action Selection](#simpleplanner--action-selection)
3. [Abstract Preconditions](#abstract-preconditions)

## Goal System

### Overview

The Goal System manages the selection and evaluation of goals for AI actors. Goals represent desired world states that actors want to achieve. The system selects the highest-priority relevant unsatisfied goal and uses it to guide action selection through effect simulation.

### Components

**GoalManager** (`src/goap/goals/goalManager.js`)

Responsible for selecting the most appropriate goal for an actor.

**Key Methods:**
- `selectGoal(actorId, context)` - Selects highest-priority relevant unsatisfied goal
- `isRelevant(goal, actorId, context)` - Checks if goal is relevant for actor
- `isGoalSatisfied(goal, actorId, context)` - Checks if goal is already satisfied
- `getGoalsForActor(actorId)` - Gets all available goals for actor

**GoalStateEvaluator** (`src/goap/goals/goalStateEvaluator.js`)

Evaluates goal state conditions using JSON Logic.

**Key Methods:**
- `evaluate(goalState, actorId, context)` - Evaluates if goal state is satisfied
- `calculateDistance(goalState, actorId, context)` - Calculates heuristic distance to goal

### Goal Definition Format

Goals are defined in JSON files following the `goal.schema.json` schema.

**Basic Structure:**
```json
{
  "$schema": "../../../schemas/goal.schema.json",
  "id": "modId:goal_name",
  "description": "Human-readable description of the goal",
  "priority": 80,
  "relevance": { /* JSON Logic condition */ },
  "goalState": { /* JSON Logic condition */ }
}
```

**Properties:**
- **id** (required): Namespaced identifier (e.g., `core:find_food`)
- **description** (optional): Human-readable explanation
- **priority** (required): Numeric value (0+), higher = more important
- **relevance** (required): JSON Logic condition - when to consider this goal
- **goalState** (required): JSON Logic condition - desired world state

### JSON Logic Conditions

Both `relevance` and `goalState` use JSON Logic syntax to evaluate world state.

**Note:** The `actor` object in JSON Logic evaluation uses a `ComponentAccessor`, which provides dynamic property access to entity components. This is automatically handled by `GoalManager.isRelevant()` and `GoalStateEvaluator.evaluate()`.

**Accessing Component Data:**
```json
{
  "var": "actor.components.core:actor"
}
```

**Component Existence Checks:**
```json
// Check if exists
{
  "!=": [{"var": "actor.components.core:actor"}, null]
}

// Check if NOT exists
{
  "==": [{"var": "actor.components.items:has_food"}, null]
}
```

**Value Comparisons:**
```json
{
  "<": [{"var": "actor.components.core:hunger.value"}, 30]
}
```

**Composite Conditions:**
```json
{
  "and": [
    {"!=": [{"var": "actor.components.core:actor"}, null]},
    {"<": [{"var": "actor.components.core:hunger.value"}, 30]}
  ]
}
```

### Example Goal Definitions

**Find Food Goal:**
```json
{
  "$schema": "../../../schemas/goal.schema.json",
  "id": "core:find_food",
  "description": "Actor needs to find food when hungry",
  "priority": 80,
  "relevance": {
    "and": [
      {"!=": [{"var": "actor.components.core:actor"}, null]},
      {"!=": [{"var": "actor.components.core:hunger"}, null]},
      {"<": [{"var": "actor.components.core:hunger.value"}, 30]},
      {"==": [{"var": "actor.components.items:has_food"}, null]}
    ]
  },
  "goalState": {
    "!=": [{"var": "actor.components.items:has_food"}, null]
  }
}
```

**Rest Safely Goal:**
```json
{
  "$schema": "../../../schemas/goal.schema.json",
  "id": "core:rest_safely",
  "description": "Actor needs to rest when tired",
  "priority": 60,
  "relevance": {
    "and": [
      {"!=": [{"var": "actor.components.core:actor"}, null]},
      {"!=": [{"var": "actor.components.core:energy"}, null]},
      {"<": [{"var": "actor.components.core:energy.value"}, 40]}
    ]
  },
  "goalState": {
    "and": [
      {"!=": [{"var": "actor.components.positioning:lying_down"}, null]},
      {"!=": [{"var": "actor.components.core:energy"}, null]},
      {">=": [{"var": "actor.components.core:energy.value"}, 80]}
    ]
  }
}
```

### Priority Tuning

**Priority Ranges:**
- **100+**: Critical survival goals (flee, emergency)
- **80-99**: High-priority needs (combat, hunger)
- **60-79**: Important maintenance (rest, repair)
- **40-59**: Social/comfort goals (play, groom)
- **20-39**: Optional goals (explore, collect)
- **0-19**: Idle/background goals

**Priority Guidelines:**
1. **Survival First**: Life-threatening situations should have highest priority
2. **Combat Second**: Combat-related goals should be high priority
3. **Basic Needs**: Hunger, thirst, rest should be medium-high priority
4. **Comfort**: Optional activities should be lower priority
5. **Context Matters**: Consider actor type and situation

### Goal Selection Algorithm

The `selectGoal` method follows this process:

1. **Get All Goals**: Retrieve all goal definitions for actor's mod set
2. **Filter Relevant**: Evaluate `relevance` condition for each goal
3. **Filter Unsatisfied**: Evaluate `goalState` for each relevant goal
4. **Sort by Priority**: Order unsatisfied goals by priority (descending)
5. **Select Highest**: Return the goal with highest priority

### Context Structure

The GOAP system requires a properly structured context object:

```javascript
const context = {
  // Entity state data (required)
  entities: {
    [actorId]: {
      components: actor.getAllComponents()
    },
    [targetId]: {
      components: target.getAllComponents()
    }
  },

  // Optional: Target references
  targetId: string,
  tertiaryTargetId: string,

  // Enriched automatically by GoalManager
  actor: entityInstance,
  actorId: string
};
```

## SimplePlanner & Action Selection

### Overview

The SimplePlanner is a one-step greedy planner that validates the planning infrastructure. It delegates action selection to ActionSelector, which calculates progress toward goals by simulating action effects.

### Architecture

**Core Components:**

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

### One-Step Planning Algorithm

The SimplePlanner delegates to ActionSelector, which uses this greedy approach:

1. **Filter Actions**: Select only actions with planning effects
2. **Calculate Progress**: For each action:
   - Calculate current distance to goal
   - Simulate applying action's effects (deep clone state)
   - Calculate future distance to goal
   - Progress = currentDistance - futureDistance
3. **Filter Positive**: Keep only actions with positive progress (progress > 0)
4. **Select Best**: Choose action with highest progress score

### Plan Structure

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
  validUntil: null  // Always null for SimplePlanner
}
```

### Plan Caching

**Cache Operations:**
```javascript
planCache.set('actor1', plan);              // Store plan
const plan = planCache.get('actor1');       // Retrieve (or null)
const has = planCache.has('actor1');        // Check existence
planCache.invalidate('actor1');             // Invalidate actor's plan
planCache.invalidateGoal('survival:find_food'); // Invalidate by goal
planCache.clear();                          // Clear all plans
const stats = planCache.getStats();         // { size: 5, actors: [...] }
```

**Caching Workflow:**
```
Turn 1: miss → plan → cache → execute
Turn 2: hit → validate → execute
Turn 3: state change → invalidate → miss → plan → cache → execute
```

**Cache Invalidation Strategies:**
- **Actor-specific**: `planCache.invalidate(actorId)` - After action execution or state change
- **Goal-based**: `planCache.invalidateGoal('survival:find_food')` - When goal becomes impossible
- **Global**: `planCache.clear()` - Major state changes or turn boundaries

### Effect Simulation

ActionSelector simulates effects by deep cloning world state and applying operations:

**Supported Operations:**

1. **ADD_COMPONENT** - Adds component to entity
2. **REMOVE_COMPONENT** - Removes component from entity
3. **MODIFY_COMPONENT** - Updates component fields
4. **CONDITIONAL** - Conditional effects with abstract preconditions

**Entity Reference Resolution:**

Effects use entity references that are resolved during simulation:
- `'actor'` → actorId parameter
- `'target'` → context.targetId
- `'tertiary_target'` → context.tertiaryTargetId
- Direct ID → unchanged

### Usage Example

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

### Limitations

SimplePlanner is intentionally limited for Tier 1:

| Feature | SimplePlanner (Tier 1) | A* Planner (Tier 2+) |
|---------|----------------------|---------------------|
| Planning depth | 1 step | Multiple steps |
| Optimality | Greedy (local) | Optimal (global) |
| Action sequences | Single action | Action chains |
| Backtracking | No | Yes |
| Dead-end detection | No | Yes |
| Cost consideration | Via progress score | Full pathfinding |

**Known weaknesses:**
- Multi-step goals requiring action sequences
- Dead-ends (actions that prevent goal achievement)
- Suboptimal paths (may not find cheapest solution)

### Performance Characteristics

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

## Abstract Preconditions

### Overview

Abstract preconditions are condition functions used in conditional planning effects during GOAP decision-making. They evaluate conditions against simulated world state during planning to predict action outcomes.

### What Are Abstract Preconditions?

Abstract preconditions are named, parameterized functions that:

1. **Evaluate Runtime Conditions**: Check conditions against simulated world state during planning
2. **Enable Conditional Effects**: Control which effect branches (then/else) are applied during simulation
3. **Support Planning Simulation**: Allow the planner to predict action outcomes before execution
4. **Must Be Defined Inline**: Each action that uses abstract preconditions must define them in its `planningEffects.abstractPreconditions` object

**Example:**
```json
{
  "planningEffects": {
    "effects": [
      {
        "operation": "CONDITIONAL",
        "condition": {
          "abstractPrecondition": "hasInventoryCapacity",
          "params": ["actor", "target"]
        },
        "then": [...],
        "else": [...]
      }
    ],
    "abstractPreconditions": {
      "hasInventoryCapacity": {
        "description": "Checks if actor has inventory space for item",
        "parameters": ["actorId", "itemId"],
        "simulationFunction": "assumeTrue"
      }
    }
  }
}
```

### Why Are They Needed?

During planning, the GOAP system needs to predict which effects an action will produce. When rules contain conditional operations, the planner must evaluate conditions against simulated world state to determine which effect branch will execute.

**Example Scenario:**

A `pick_up_item` action might conditionally add the item to inventory only if there's capacity:

```json
{
  "operation": "CONDITIONAL",
  "condition": {
    "abstractPrecondition": "hasInventoryCapacity",
    "params": ["actor", "target"]
  },
  "then": [
    {"operation": "ADD_COMPONENT", "entity": "actor", "component": "items:has_item", "data": {...}}
  ],
  "else": [
    {"operation": "ADD_COMPONENT", "entity": "actor", "component": "items:inventory_full", "data": {...}}
  ]
}
```

### How Abstract Preconditions Work

During planning simulation:

1. **ActionSelector** encounters a CONDITIONAL effect
2. Extracts the abstract precondition name and parameters
3. Resolves parameter entity references (e.g., "actor" → actual entity ID)
4. Calls **AbstractPreconditionSimulator** with the precondition name and resolved parameters
5. Simulator checks the simulated world state and returns true/false
6. ActionSelector applies the appropriate effect branch (then/else)
7. Resulting future state is used to calculate progress toward goal

### Abstract Precondition Structure

Abstract preconditions are defined within each action's `planningEffects.abstractPreconditions` object.

**Required Fields:**
```json
{
  "preconditionName": {
    "description": "Human-readable description of what this checks",
    "parameters": ["param1", "param2"],
    "simulationFunction": "assumeTrue"
  }
}
```

**Fields:**
- `description` (string, required): Clear description of the condition's purpose
- `parameters` (array of strings, required): List of entity parameter names
- `simulationFunction` (string, required): Simulation strategy hint (validated but currently not used by simulator)

**Important Notes:**
- The precondition name determines simulation behavior
- The `simulationFunction` field is validated but the actual simulation logic is determined by the precondition name
- Parameters must match the expected parameter count and types for the given precondition name

### Implemented Abstract Preconditions

The GOAP system currently implements **3 abstract preconditions**:

#### hasInventoryCapacity

**Implementation:** `src/goap/simulation/abstractPreconditionSimulator.js`

**Description:** Calculates if an actor's inventory can hold an item based on weight

**Parameters:** `["actorId", "itemId"]`

**Simulation Logic:**
1. Retrieves actor's `items:inventory` component from simulated world state
2. Retrieves item's `items:item` component
3. Calculates current total weight of all items in inventory
4. Checks if `currentWeight + itemWeight <= max_weight`
5. Returns `true` if there's capacity, `false` otherwise

**Returns:**
- `true` if actor has no inventory component (unlimited capacity assumed)
- `true` if adding the item would not exceed max_weight
- `false` if item doesn't exist or would exceed capacity

**Usage:**
```json
{
  "condition": {
    "abstractPrecondition": "hasInventoryCapacity",
    "params": ["actor", "target"]
  }
}
```

#### hasContainerCapacity

**Implementation:** `src/goap/simulation/abstractPreconditionSimulator.js`

**Description:** Checks if a container has room for another item

**Parameters:** `["containerId", "itemId"]`

**Simulation Logic:**
1. Retrieves container's `items:container` component
2. Checks current item count in container
3. Compares against `max_capacity`
4. Returns `true` if `currentCount < maxCapacity`

**Returns:**
- `false` if entity is not a container or item doesn't exist
- `true` if container has room (current count < max capacity)
- `true` if container has no capacity limit (Infinity)

#### hasComponent

**Implementation:** `src/goap/simulation/abstractPreconditionSimulator.js`

**Description:** Checks if an entity has a specific component in simulated world state

**Parameters:** `["entityId", "componentId"]`

**Simulation Logic:**
1. Looks up entity in `worldState.entities[entityId]`
2. Checks if `components[componentId]` exists
3. Returns boolean result

**Returns:**
- `true` if entity has the component
- `false` if entity doesn't exist or lacks the component

**Usage:**
```json
{
  "condition": {
    "abstractPrecondition": "hasComponent",
    "params": ["actor", "positioning:standing"]
  }
}
```

### Simulation Function Field (Metadata Only)

The `simulationFunction` field is **validated but not currently used** by the simulator. Values like `"assumeTrue"`, `"assumeFalse"`, `"assumeRandom"`, and `"evaluateAtRuntime"` are accepted during validation but do not affect simulation behavior.

**Current Behavior:**
- All simulation logic is determined by the precondition **name**, not the `simulationFunction` value
- `hasInventoryCapacity` always calculates actual capacity
- `hasContainerCapacity` always calculates actual capacity
- `hasComponent` always checks actual component existence

### Auto-Generated Preconditions

The `EffectsAnalyzer` automatically generates abstract precondition definitions when analyzing rules that contain certain operation types:

| Operation Type | Generated Precondition | Parameters | simulationFunction |
|---|---|---|---|
| `VALIDATE_INVENTORY_CAPACITY` | `hasInventoryCapacity` | `["actorId", "itemId"]` | `"assumeTrue"` |
| `VALIDATE_CONTAINER_CAPACITY` | `hasContainerCapacity` | `["containerId", "itemId"]` | `"assumeTrue"` |
| `HAS_COMPONENT` | `hasComponent` | `["entityId", "componentId"]` | `"assumeTrue"` |
| `CHECK_FOLLOW_CYCLE` | (name from data flow) | `["leaderId", "followerId"]` | `"assumeFalse"` |

### Adding New Abstract Preconditions

To add a new abstract precondition to the GOAP system:

**1. Add Simulator Function**

Edit `src/goap/simulation/abstractPreconditionSimulator.js`:

```javascript
simulate(functionName, parameters, worldState) {
  const simulators = {
    hasInventoryCapacity: this.#simulateInventoryCapacity.bind(this),
    hasContainerCapacity: this.#simulateContainerCapacity.bind(this),
    hasComponent: this.#simulateHasComponent.bind(this),
    myNewPrecondition: this.#simulateMyNewPrecondition.bind(this)  // Add here
  };

  const simulator = simulators[functionName];
  if (!simulator) {
    this.#logger.warn(`No simulator for abstract function: ${functionName}`);
    return false;
  }

  return simulator(parameters, worldState);
}

// Add implementation
#simulateMyNewPrecondition([param1, param2], worldState) {
  // Implement simulation logic using worldState
  // Return true/false based on condition
}
```

**2. (Optional) Register in Effects Analyzer**

If the precondition should be auto-generated from specific operation types, add to `src/goap/analysis/effectsAnalyzer.js`

**3. Use in Action Planning Effects**

Define the precondition in action's `planningEffects.abstractPreconditions`:

```json
{
  "planningEffects": {
    "effects": [
      {
        "operation": "CONDITIONAL",
        "condition": {
          "abstractPrecondition": "myNewPrecondition",
          "params": ["actor", "target"]
        },
        "then": [...],
        "else": [...]
      }
    ],
    "abstractPreconditions": {
      "myNewPrecondition": {
        "description": "Clear description of condition",
        "parameters": ["param1", "param2"],
        "simulationFunction": "assumeTrue"
      }
    }
  }
}
```

### World State Structure

During planning simulation, abstract preconditions receive a `worldState` object:

```javascript
{
  entities: {
    [entityId]: {
      components: {
        [componentId]: componentData
      }
    }
  },
  targetId: string,         // Optional
  tertiaryTargetId: string  // Optional
}
```

This is a **simulated snapshot** used for planning calculations, not live EntityManager queries.

### Key Implementation Classes

| Class | Location | Purpose |
|---|---|---|
| `AbstractPreconditionSimulator` | `src/goap/simulation/abstractPreconditionSimulator.js` | Evaluates abstract preconditions during planning |
| `ActionSelector` | `src/goap/selection/actionSelector.js` | Calls simulator when encountering CONDITIONAL effects |
| `EffectsAnalyzer` | `src/goap/analysis/effectsAnalyzer.js` | Auto-generates precondition definitions from rules |
| `EffectsValidator` | `src/goap/validation/effectsValidator.js` | Validates precondition structure |

## Testing

### Running Tests

```bash
# Unit tests
npm run test:unit -- tests/unit/goap/goals/
npm run test:unit -- tests/unit/goap/planning/

# E2E tests (most comprehensive)
npm run test:e2e -- tests/e2e/goap/GoalRelevanceAndSatisfactionEvaluation.e2e.test.js
npm run test:e2e -- tests/e2e/goap/GoalPrioritySelectionWorkflow.e2e.test.js
npm run test:e2e -- tests/e2e/goap/ActionSelectionWithEffectSimulation.e2e.test.js
npm run test:e2e -- tests/e2e/goap/CompleteGoapDecisionWithRealMods.e2e.test.js
npm run test:e2e -- tests/e2e/goap/AbstractPreconditionConditionalEffects.e2e.test.js
npm run test:e2e -- tests/e2e/goap/PlanCachingAndInvalidation.e2e.test.js
npm run test:e2e -- tests/e2e/goap/MultiTurnGoalAchievement.e2e.test.js
npm run test:e2e -- tests/e2e/goap/MultiActorConcurrentGoapDecisions.e2e.test.js

# All GOAP tests
npm run test:unit -- tests/unit/goap/
npm run test:e2e -- tests/e2e/goap/
```

### Test Coverage

The GOAP planning system is validated through comprehensive E2E tests:

- **Goal relevance evaluation**: Complex JSON Logic conditions (AND/OR/NOT)
- **Goal satisfaction detection**: Component existence and value checks
- **Priority-based selection**: Multiple competing goals
- **Action selection with effect simulation**: Greedy selection based on goal progress
- **Abstract preconditions**: hasComponent, hasInventoryCapacity, hasContainerCapacity
- **Plan caching and invalidation**: Actor-specific, goal-based, global strategies
- **Multi-turn goal achievement**: Plan persistence across turns
- **Multi-actor concurrent decisions**: Cache isolation and concurrent planning
- **Complete workflow**: From goal selection through action execution

## Troubleshooting

### No Goal Selected

**Problem:** `selectGoal` returns `null`

**Possible Causes:**
1. No goals defined for actor's mods
2. No goals have relevant conditions met
3. All relevant goals are already satisfied

**Solutions:**
- Verify goals are loaded via `getAllGoalDefinitions()`
- Check relevance conditions match actor's state
- Ensure goal states are not already satisfied

### Wrong Goal Selected

**Problem:** Lower priority goal selected instead of higher

**Possible Causes:**
1. Higher priority goal's relevance condition fails
2. Higher priority goal is already satisfied
3. Priority values are not set correctly

**Solutions:**
- Log relevance evaluation for each goal
- Verify goal state evaluation
- Review and adjust priority values

### Goal Never Satisfied

**Problem:** Goal selected repeatedly but never satisfied

**Possible Causes:**
1. Goal state condition impossible to achieve
2. Actions don't produce required components
3. Goal state condition too strict

**Solutions:**
- Verify actions can produce required components
- Check planning effects match goal state requirements
- Simplify goal state condition if needed

### No Action Selected

**Problem:** ActionSelector returns `null`

**Possible Causes:**
1. No actions have `planningEffects`
2. No actions produce positive progress toward goal
3. Actions filtered out before selection

**Solutions:**
- Ensure actions have `planningEffects` defined
- Verify actions' effects move toward goal state
- Check action availability and prerequisites

### Plans Not Cached

**Problem:** Planner recalculates every turn

**Possible Causes:**
1. `planCache.set()` not called after planning
2. Plans invalidated too frequently
3. Cache validation always fails

**Solutions:**
- Verify caching workflow (see Usage Example)
- Review invalidation triggers
- Check plan validation logic

## Related Documentation

- [GOAP System Overview](./README.md) - Architecture and concepts
- [Effects System](./effects-system.md) - Effects generation and analysis
- [Operation Mapping](./operation-mapping.md) - Complete operation-to-effect mapping
- [Troubleshooting](./troubleshooting.md) - Common issues and solutions
