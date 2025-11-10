# GOAP Goal System

## Overview

The GOAP Goal System manages the selection and evaluation of goals for AI actors. Goals represent desired world states that actors want to achieve, and the goal system selects the highest-priority relevant goal for planning.

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

Check if a component exists:

```json
{
  ">=": [{ "var": "actor.components.core:actor" }, null]
}
```

Check if a component does NOT exist:

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
    { ">=": [{ "var": "actor.components.core:actor" }, null] },
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
      { ">=": [{ "var": "actor.components.core:actor" }, null] },
      { "<": [{ "var": "actor.components.core:hunger.value" }, 30] },
      { "!": [{ "var": "actor.components.items:has_food" }] }
    ]
  },
  "goalState": {
    ">=": [{ "var": "actor.components.items:has_food" }, null]
  }
}
```

**Relevance:** Actor exists, is hungry (< 30), and doesn't have food
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
      { ">=": [{ "var": "actor.components.core:actor" }, null] },
      { "<": [{ "var": "actor.components.core:energy.value" }, 40] }
    ]
  },
  "goalState": {
    "and": [
      { ">=": [{ "var": "actor.components.positioning:lying_down" }, null] },
      { ">=": [{ "var": "actor.components.core:energy.value" }, 80] }
    ]
  }
}
```

**Relevance:** Actor exists and is tired (< 40)
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
      { ">=": [{ "var": "actor.components.core:actor" }, null] },
      { ">=": [{ "var": "actor.components.combat:in_combat" }, null] },
      { ">": [{ "var": "actor.components.core:health.value" }, 20] }
    ]
  },
  "goalState": {
    "!": [{ "var": "actor.components.combat:in_combat" }]
  }
}
```

**Relevance:** Actor exists, is in combat, and has sufficient health (> 20)
**Goal State:** Actor is no longer in combat

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
    { ">=": [{ "var": "actor.components.core:actor" }, null] },
    { ">=": [{ "var": "actor.components.combat:warrior" }, null] },
    { ">=": [{ "var": "actor.components.items:weapon" }, null] }
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
        { ">=": [{ "var": "actor.components.combat:in_combat" }, null] }
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

## Future Enhancements

### Planned Features (Tier 2+)

- **Dynamic Priorities**: Calculate priority based on context
- **Goal Interruption**: Switch goals when priorities change
- **Goal Stacking**: Support multiple concurrent goals
- **Goal Memory**: Remember failed/completed goals
- **Goal Sharing**: Cooperative goals between actors

## Related Documentation

- [GOAP System Overview](./README.md)
- [Effects Auto-Generation](./effects-auto-generation.md)
- [Action Selector](./action-selector.md) _(Coming in GOAP-TIER1-008)_
- [Planning System](./planning-system.md) _(Coming in future tickets)_

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
   * @returns {number} Distance metric (0 = satisfied)
   */
  calculateDistance(goalState, actorId, context);
}
```

## Testing

### Running Tests

```bash
# Unit tests
npm run test:unit -- tests/unit/goap/goals/

# Integration tests
npm run test:integration -- tests/integration/goap/goalSelection.integration.test.js

# All GOAP tests
npm run test:unit -- tests/unit/goap/
npm run test:integration -- tests/integration/goap/
```

### Test Coverage

- **GoalManager**: 90%+ branches, 95%+ lines
- **GoalStateEvaluator**: 90%+ branches, 95%+ lines
- Integration tests cover real-world scenarios

## Support

For questions or issues:
- Check [Troubleshooting](#troubleshooting-goal-selection) section
- Review test examples in `tests/unit/goap/goals/`
- See [GOAP System Documentation](./README.md)
