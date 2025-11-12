# GOAP Goal System

## Overview

The GOAP Goal System manages the selection and evaluation of goals for AI actors. Goals represent desired world states that actors want to achieve. The system selects the highest-priority relevant unsatisfied goal and uses it to guide action selection through effect simulation.

## Components

### GoalManager

The `GoalManager` class is responsible for selecting the most appropriate goal for an actor based on current world state and goal priorities.

**Location:** `src/goap/goals/goalManager.js`

**Key Methods:**
- `selectGoal(actorId, context)` - Selects highest-priority relevant unsatisfied goal
- `isRelevant(goal, actorId, context)` - Checks if goal is relevant for actor
- `isGoalSatisfied(goal, actorId, context)` - Checks if goal is already satisfied
- `getGoalsForActor(actorId)` - Gets all available goals for actor

### GoalStateEvaluator

The `GoalStateEvaluator` class evaluates goal state conditions using JSON Logic.

**Location:** `src/goap/goals/goalStateEvaluator.js`

**Key Methods:**
- `evaluate(goalState, actorId, context)` - Evaluates if goal state is satisfied
- `calculateDistance(goalState, actorId, context)` - Calculates heuristic distance to goal

## Goal Definition Format

Goals are defined in JSON files following the `goal.schema.json` schema.

### Basic Structure

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

### Properties

- **id** (required): Namespaced identifier (e.g., `core:find_food`)
- **description** (optional): Human-readable explanation
- **priority** (required): Numeric value (0+), higher = more important
- **relevance** (required): JSON Logic condition - when to consider this goal
- **goalState** (required): JSON Logic condition - desired world state

## JSON Logic Conditions

Both `relevance` and `goalState` use JSON Logic syntax to evaluate world state.

**Note:** The `actor` object in JSON Logic evaluation uses a `ComponentAccessor` (created via `createComponentAccessor()`), which provides dynamic property access to entity components. This is automatically handled by `GoalManager.isRelevant()` and `GoalStateEvaluator.evaluate()`.

### Accessing Component Data

Access entity components via the `actor.components.*` path:

```json
{
  "var": "actor.components.core:actor"
}
```

Access nested component properties:

```json
{
  "var": "actor.components.core:hunger.value"
}
```

### Component Existence Checks

Check if a component exists (using `!=` operator):

```json
{
  "!=": [{ "var": "actor.components.core:actor" }, null]
}
```

Check if a component does NOT exist (using `==` for null check):

```json
{
  "==": [{ "var": "actor.components.items:has_food" }, null]
}
```

Alternative using `!` (NOT) operator:

```json
{
  "!": [{ "var": "actor.components.items:has_food" }]
}
```

### Value Comparisons

Compare component values:

```json
{
  "<": [{ "var": "actor.components.core:hunger.value" }, 30]
}
```

```json
{
  ">=": [{ "var": "actor.components.core:energy.value" }, 80]
}
```

### Composite Conditions

Use logical operators to combine conditions:

**AND condition:**
```json
{
  "and": [
    { "!=": [{ "var": "actor.components.core:actor" }, null] },
    { "<": [{ "var": "actor.components.core:hunger.value" }, 30] }
  ]
}
```

**OR condition:**
```json
{
  "or": [
    { "<": [{ "var": "actor.components.core:health.value" }, 20] },
    { "<": [{ "var": "actor.components.core:energy.value" }, 10] }
  ]
}
```

**NOT condition:**
```json
{
  "!": [{ "var": "actor.components.combat:in_combat" }]
}
```

## Example Goal Definitions

### Find Food Goal

A hungry actor needs to find food:

```json
{
  "$schema": "../../../schemas/goal.schema.json",
  "id": "core:find_food",
  "description": "Actor needs to find food when hungry",
  "priority": 80,
  "relevance": {
    "and": [
      { "!=": [{ "var": "actor.components.core:actor" }, null] },
      { "!=": [{ "var": "actor.components.core:hunger" }, null] },
      { "<": [{ "var": "actor.components.core:hunger.value" }, 30] },
      { "==": [{ "var": "actor.components.items:has_food" }, null] }
    ]
  },
  "goalState": {
    "!=": [{ "var": "actor.components.items:has_food" }, null]
  }
}
```

**Relevance:** Actor exists, has hunger component, is hungry (< 30), and doesn't have food
**Goal State:** Actor has food component

### Rest Safely Goal

A tired actor needs to rest:

```json
{
  "$schema": "../../../schemas/goal.schema.json",
  "id": "core:rest_safely",
  "description": "Actor needs to rest when tired",
  "priority": 60,
  "relevance": {
    "and": [
      { "!=": [{ "var": "actor.components.core:actor" }, null] },
      { "!=": [{ "var": "actor.components.core:energy" }, null] },
      { "<": [{ "var": "actor.components.core:energy.value" }, 40] }
    ]
  },
  "goalState": {
    "and": [
      { "!=": [{ "var": "actor.components.positioning:lying_down" }, null] },
      { "!=": [{ "var": "actor.components.core:energy" }, null] },
      { ">=": [{ "var": "actor.components.core:energy.value" }, 80] }
    ]
  }
}
```

**Relevance:** Actor exists, has energy component, and is tired (< 40)
**Goal State:** Actor is lying down and energy is restored (>= 80)

### Defeat Enemy Goal

An actor in combat needs to defeat their enemy:

```json
{
  "$schema": "../../../schemas/goal.schema.json",
  "id": "core:defeat_enemy",
  "description": "Actor needs to defeat an enemy in combat",
  "priority": 90,
  "relevance": {
    "and": [
      { "!=": [{ "var": "actor.components.core:actor" }, null] },
      { "!=": [{ "var": "actor.components.combat:in_combat" }, null] },
      { "!=": [{ "var": "actor.components.core:health" }, null] },
      { ">": [{ "var": "actor.components.core:health.value" }, 20] }
    ]
  },
  "goalState": {
    "==": [{ "var": "actor.components.combat:in_combat" }, null]
  }
}
```

**Relevance:** Actor exists, is in combat, has health component, and has sufficient health (> 20)
**Goal State:** Actor is no longer in combat (component removed)

## Creating Goals for Creature Types

### Cat Goals

Cats might have goals like:
- `cat:find_food` (priority 80) - Hunt when hungry
- `cat:rest_safely` (priority 60) - Sleep when tired
- `cat:play` (priority 40) - Play when energetic
- `cat:groom` (priority 30) - Groom when dirty

### Goblin Goals

Goblins might have goals like:
- `goblin:survive_combat` (priority 100) - Escape when low health
- `goblin:defeat_enemy` (priority 90) - Fight when able
- `goblin:find_treasure` (priority 70) - Seek loot when safe
- `goblin:eat_food` (priority 60) - Eat when hungry

### Monster Goals

Monsters might have goals like:
- `monster:hunt_prey` (priority 95) - Hunt when hungry
- `monster:defend_territory` (priority 85) - Defend home area
- `monster:rest` (priority 50) - Rest when injured

## Priority Tuning

### Priority Ranges

- **100+**: Critical survival goals (flee, emergency)
- **80-99**: High-priority needs (combat, hunger)
- **60-79**: Important maintenance (rest, repair)
- **40-59**: Social/comfort goals (play, groom)
- **20-39**: Optional goals (explore, collect)
- **0-19**: Idle/background goals

### Priority Guidelines

1. **Survival First**: Life-threatening situations should have highest priority
2. **Combat Second**: Combat-related goals should be high priority
3. **Basic Needs**: Hunger, thirst, rest should be medium-high priority
4. **Comfort**: Optional activities should be lower priority
5. **Context Matters**: Consider actor type and situation

### Dynamic Priorities

Future versions may support dynamic priority calculation based on:
- Urgency (how critical is the need)
- Opportunity (how easy is it to achieve)
- Cost (how expensive is the goal to pursue)

## Goal Selection Algorithm

The `selectGoal` method follows this process:

1. **Get All Goals**: Retrieve all goal definitions for actor's mod set
2. **Filter Relevant**: Evaluate `relevance` condition for each goal
3. **Filter Unsatisfied**: Evaluate `goalState` for each relevant goal
4. **Sort by Priority**: Order unsatisfied goals by priority (descending)
5. **Select Highest**: Return the goal with highest priority

### Example Flow

```
Goals Available: [find_food(80), rest_safely(60), defeat_enemy(90)]
           ↓
Filter Relevant: [find_food(80), defeat_enemy(90)]  (not tired)
           ↓
Filter Unsatisfied: [find_food(80), defeat_enemy(90)]  (both unsatisfied)
           ↓
Sort by Priority: [defeat_enemy(90), find_food(80)]
           ↓
Select Highest: defeat_enemy(90)
```

## Common JSON Logic Patterns

### Check Multiple Components

```json
{
  "and": [
    { "!=": [{ "var": "actor.components.core:actor" }, null] },
    { "!=": [{ "var": "actor.components.combat:warrior" }, null] },
    { "!=": [{ "var": "actor.components.items:weapon" }, null] }
  ]
}
```

### Range Checks

```json
{
  "and": [
    { ">": [{ "var": "actor.components.core:hunger.value" }, 20] },
    { "<": [{ "var": "actor.components.core:hunger.value" }, 80] }
  ]
}
```

### Threshold with Buffer

```json
{
  "or": [
    { "<": [{ "var": "actor.components.core:health.value" }, 30] },
    {
      "and": [
        { "<": [{ "var": "actor.components.core:health.value" }, 50] },
        { "!=": [{ "var": "actor.components.combat:in_combat" }, null] }
      ]
    }
  ]
}
```

## Troubleshooting Goal Selection

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

### Performance Issues

**Problem:** Goal selection is slow

**Possible Causes:**
1. Too many goals defined
2. Complex relevance/goal state conditions
3. Expensive component access

**Solutions:**
- Limit number of active goals per mod
- Simplify JSON Logic conditions
- Cache entity component data

## Integration with Action System

Goals work with the GOAP action system:

1. **Goal Selection**: GoalManager selects highest-priority goal
2. **Action Discovery**: ActionSelector finds actions that satisfy goal
3. **Planning**: Planner builds sequence of actions to achieve goal
4. **Execution**: Selected actions are executed
5. **Re-evaluation**: Goal state is checked after each action

## Best Practices

### Goal Design

1. **Keep Relevance Simple**: Fast evaluation is important
2. **Make Goals Achievable**: Ensure actions can satisfy goal state
3. **Use Appropriate Priorities**: Balance competing goals
4. **Test Thoroughly**: Verify goals select and satisfy correctly

### Component Usage

1. **Check Existence First**: Always verify component exists
2. **Use Consistent Paths**: Follow `actor.components.mod:component.field` pattern
3. **Handle Missing Data**: Use null checks and defaults
4. **Document Requirements**: List required components in description

### Performance

1. **Limit Active Goals**: Don't define hundreds of goals per actor
2. **Cache When Possible**: Reuse goal evaluations within same turn
3. **Optimize Conditions**: Use simpler conditions when possible
4. **Profile Selection**: Monitor goal selection performance

## Context Structure

The GOAP system requires a properly structured context object for goal evaluation and action selection:

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
    // ... other entities
  },

  // Optional: Target references
  targetId: string,         // Primary target entity ID
  tertiaryTargetId: string, // Tertiary target entity ID

  // Enriched automatically by GoalManager
  actor: entityInstance,    // Added by GoalManager
  actorId: string          // Added by GoalManager
};
```

**Important:** The `actor` field in context uses a `ComponentAccessor` created via `createComponentAccessor(actorId, entityManager, logger)`. This accessor provides the `actor.components.*` interface used in JSON Logic evaluation.

## Future Enhancements

**Note:** The following features are potential future enhancements not yet implemented:

- **Dynamic Priorities**: Calculate priority based on urgency, opportunity, and cost
- **Goal Interruption**: Switch goals mid-execution when priorities change
- **Goal Stacking**: Support multiple concurrent goals
- **Goal Memory**: Remember and learn from failed/completed goals
- **Goal Sharing**: Cooperative goals between actors
- **Sophisticated Distance Calculation**: Currently returns 0 (satisfied) or 1 (unsatisfied); could implement more nuanced heuristics

## Action Selection

The ActionSelector class selects the best action to move toward a goal using greedy selection.

### ActionSelector API

```javascript
class ActionSelector {
  /**
   * Selects best action to move toward goal
   * @param {Array<object>} availableActions - Actions from action discovery
   * @param {object} goal - Selected goal
   * @param {string} actorId - Entity ID of actor
   * @param {object} context - World state context
   * @returns {object|null} Selected action or null
   */
  selectAction(availableActions, goal, actorId, context);

  /**
   * Calculates how much an action progresses toward goal
   * @param {object} action - Action with planningEffects
   * @param {object} goal - Goal definition
   * @param {string} actorId - Entity ID of actor
   * @param {object} context - World state context
   * @returns {number} Progress score (higher = better)
   */
  calculateProgress(action, goal, actorId, context);

  /**
   * Simulates applying action effects to world state
   * @param {object} action - Action with planningEffects
   * @param {string} actorId - Entity ID of actor
   * @param {object} currentState - Current world state
   * @returns {object} Simulated future state
   */
  simulateEffects(action, actorId, currentState);
}
```

### Selection Algorithm

1. **Filter Plannable Actions**: Only consider actions with `planningEffects`
2. **Calculate Progress**: For each action, simulate effects and calculate progress toward goal
3. **Filter Positive Progress**: Only consider actions that move closer to goal
4. **Select Best**: Return action with highest progress score

### Effect Simulation

The ActionSelector simulates action effects to predict future world state:

- **ADD_COMPONENT**: Adds component to simulated state
- **REMOVE_COMPONENT**: Removes component from simulated state
- **MODIFY_COMPONENT**: Updates component properties in simulated state
- **CONDITIONAL**: Evaluates condition and applies appropriate effects

### Abstract Preconditions

Conditional effects use abstract preconditions which are simulated during planning:

```javascript
{
  operation: 'CONDITIONAL',
  condition: {
    abstractPrecondition: 'hasInventoryCapacity',
    params: ['actor', 'item1']
  },
  then: [...]
}
```

See [Abstract Preconditions](./abstract-preconditions.md) for the complete catalog.

### AbstractPreconditionSimulator API

```javascript
class AbstractPreconditionSimulator {
  /**
   * Simulates an abstract precondition
   * @param {string} functionName - Name of abstract function
   * @param {Array} parameters - Function parameters
   * @param {object} worldState - World state for simulation
   * @returns {boolean} Result of simulation
   */
  simulate(functionName, parameters, worldState);
}
```

**Built-in Simulators**:
- `hasInventoryCapacity(actorId, itemId)` - Checks if actor can carry item
- `hasContainerCapacity(containerId, itemId)` - Checks if container has space
- `hasComponent(entityId, componentId)` - Checks if entity has component

## Related Documentation

- [GOAP System Overview](./README.md)
- [Effects Auto-Generation](./effects-auto-generation.md)
- [Abstract Preconditions](./abstract-preconditions.md)

## API Reference

### GoalManager

```javascript
class GoalManager {
  /**
   * Selects the highest-priority relevant goal for an actor
   * @param {string} actorId - Entity ID of actor
   * @param {Object} context - World state context
   * @returns {Object|null} Selected goal or null
   */
  selectGoal(actorId, context);

  /**
   * Evaluates if a goal is relevant for an actor
   * @param {Object} goal - Goal definition
   * @param {string} actorId - Entity ID of actor
   * @param {Object} context - World state context
   * @returns {boolean} True if relevant
   */
  isRelevant(goal, actorId, context);

  /**
   * Evaluates if goal state is satisfied
   * @param {Object} goal - Goal definition
   * @param {string} actorId - Entity ID of actor
   * @param {Object} context - World state context
   * @returns {boolean} True if goal achieved
   */
  isGoalSatisfied(goal, actorId, context);

  /**
   * Gets all goals for an actor's mod set
   * @param {string} actorId - Entity ID of actor
   * @returns {Array<Object>} List of goals
   */
  getGoalsForActor(actorId);
}
```

### GoalStateEvaluator

```javascript
class GoalStateEvaluator {
  /**
   * Evaluates if goal state condition is met
   * @param {Object} goalState - Goal state condition (JSON Logic)
   * @param {string} actorId - Entity ID of actor
   * @param {Object} context - World state context
   * @returns {boolean} True if goal state satisfied
   */
  evaluate(goalState, actorId, context);

  /**
   * Calculates distance to goal state (for heuristic)
   * @param {Object} goalState - Goal state condition
   * @param {string} actorId - Entity ID of actor
   * @param {Object} context - World state context
   * @returns {number} Distance metric (0 = satisfied, 1 = unsatisfied)
   * Note: Currently uses simple binary heuristic. Future versions may implement
   * more sophisticated distance calculations.
   */
  calculateDistance(goalState, actorId, context);
}
```

## Testing

### Running Tests

```bash
# Unit tests
npm run test:unit -- tests/unit/goap/goals/

# E2E tests (most comprehensive)
npm run test:e2e -- tests/e2e/goap/GoalRelevanceAndSatisfactionEvaluation.e2e.test.js
npm run test:e2e -- tests/e2e/goap/GoalPrioritySelectionWorkflow.e2e.test.js
npm run test:e2e -- tests/e2e/goap/ActionSelectionWithEffectSimulation.e2e.test.js
npm run test:e2e -- tests/e2e/goap/CompleteGoapDecisionWithRealMods.e2e.test.js

# All GOAP tests
npm run test:unit -- tests/unit/goap/
npm run test:e2e -- tests/e2e/goap/
```

### Test Coverage

The GOAP goal system is validated through comprehensive E2E tests that use real mod data:

- **Goal relevance evaluation**: Complex JSON Logic conditions (AND/OR/NOT)
- **Goal satisfaction detection**: Component existence and value checks
- **Priority-based selection**: Multiple competing goals
- **Action selection with effect simulation**: Greedy selection based on goal progress
- **Complete workflow**: From goal selection through action execution

## Support

For questions or issues:
- Check [Troubleshooting](#troubleshooting-goal-selection) section
- Review test examples in `tests/unit/goap/goals/`
- See [GOAP System Documentation](./README.md)
