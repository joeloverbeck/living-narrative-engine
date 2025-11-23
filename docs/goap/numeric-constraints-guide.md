# Numeric Constraints Guide for GOAP Planning

## Introduction

Numeric constraints enable GOAP (Goal-Oriented Action Planning) to handle goals that involve numeric values, such as reducing hunger, increasing health, or accumulating resources. This guide explains how to define and use numeric goals in the Living Narrative Engine.

### What are Numeric Constraints?

Numeric constraints are goal conditions that compare numeric values using operators like `>`, `<`, `>=`, `<=`, and `==`. Instead of simply checking if a component exists or has a specific boolean value, numeric constraints allow the planner to reason about quantities and find actions that move those quantities in the desired direction.

**Example:**
```json
{
  "goalState": {
    "<=": [{ "var": "actor.components.core:needs.hunger" }, 30]
  }
}
```
This goal is satisfied when the actor's hunger value is less than or equal to 30.

### When to Use Numeric Constraints vs Component-Based Goals

**Use Numeric Constraints When:**
- Goals involve quantities (health points, hunger levels, resource counts)
- You need to reduce or increase a numeric value
- The exact numeric threshold matters
- Multiple actions may be needed to reach the goal

**Use Component-Based Goals When:**
- Goals are binary states (has weapon / doesn't have weapon)
- Checking for presence or absence of components
- No numeric thresholds are involved
- Single action typically satisfies the goal

### Benefits

- **Flexible Goal Definition**: Define goals based on numeric thresholds
- **Multi-Action Planning**: Planner can chain multiple actions to reach numeric goals
- **Distance Calculation**: Planner knows how far the current state is from the goal
- **Efficient Search**: Heuristics guide the planner toward actions that reduce distance

### Limitations

- Numeric constraints require numeric component fields
- All actions affecting numeric fields must use `MODIFY_COMPONENT` operations
- Planner cannot reason about complex mathematical relationships
- Performance scales with the number of actions and numeric fields

## Supported Numeric Operators

The GOAP planner supports the following numeric comparison operators:

| Operator | Meaning | Example | Distance Calculation |
|----------|---------|---------|---------------------|
| `>` | Greater than | `hunger > 50` | `target - current` (if not satisfied) |
| `>=` | Greater than or equal | `health >= 80` | `target - current` (if not satisfied) |
| `<` | Less than | `hunger < 30` | `current - target` (if not satisfied) |
| `<=` | Less than or equal | `hunger <= 30` | `current - target` (if not satisfied) |
| `==` | Equal to | `count == 5` | `|current - target|` |

**Distance Calculation**: When a constraint is already satisfied, distance is 0. When not satisfied, distance represents how far the current value is from satisfying the constraint.

**Examples:**
- Current hunger: 80, Goal: `hunger <= 30` → Distance: 50
- Current health: 40, Goal: `health >= 80` → Distance: 40
- Current gold: 25, Goal: `gold == 100` → Distance: 75

## How to Define Numeric Goals

### Basic Numeric Goal

A numeric goal consists of a relevance condition and a goal state with numeric constraints.

```json
{
  "id": "core:satisfy_hunger",
  "relevance": {
    ">": [{ "var": "actor.components.core:needs.hunger" }, 50]
  },
  "goalState": {
    "<=": [{ "var": "actor.components.core:needs.hunger" }, 30]
  },
  "priority": 0.8
}
```

**Explanation:**
- **id**: Unique identifier for the goal
- **relevance**: Goal becomes relevant when hunger > 50 (actor is getting hungry)
- **goalState**: Goal is satisfied when hunger <= 30 (actor is no longer hungry)
- **priority**: Higher priority goals are considered first (0.0 to 1.0)

The planner will find tasks that reduce hunger from the current value to 30 or below.

### Combining Multiple Numeric Constraints

You can combine multiple numeric constraints using JSON Logic operators like `and` and `or`.

```json
{
  "id": "core:emergency_survival",
  "relevance": {
    "or": [
      { "<": [{ "var": "actor.components.core:stats.health" }, 20] },
      { ">": [{ "var": "actor.components.core:needs.hunger" }, 80] }
    ]
  },
  "goalState": {
    "and": [
      { ">=": [{ "var": "actor.components.core:stats.health" }, 50] },
      { "<=": [{ "var": "actor.components.core:needs.hunger" }, 40] }
    ]
  },
  "priority": 1.0
}
```

**Explanation:**
- Goal becomes relevant if health is critically low OR hunger is very high
- Goal is satisfied when BOTH health is at least 50 AND hunger is at most 40
- High priority (1.0) ensures this goal takes precedence

### Using JSON Logic Paths

Numeric goals use JSON Logic `var` expressions to reference component fields. The path format follows the planning state structure:

```json
{ "var": "actor.components.core:needs.hunger" }
```

**Path Components:**
- `actor`: Entity identifier (can be `actor`, `target`, or specific entity IDs)
- `components`: Indicates we're accessing component data
- `core:needs`: Component ID (format: `modId:componentName`)
- `hunger`: Field name within the component

**Alternative Formats:**
```json
// Using flattened format (underscore instead of colon)
{ "var": "actor.components.core_needs.hunger" }

// Nested format (if supported by your planning state view)
{ "var": "actor.components.core:needs.hunger" }
```

## MODIFY_COMPONENT Planning Effects

Tasks that affect numeric values use `MODIFY_COMPONENT` operations in their `planningEffects`. This operation supports three modes: `set`, `increment`, and `decrement`.

### Set Mode (Direct Assignment)

Sets a component field to an exact value, regardless of the previous value.

```json
{
  "type": "MODIFY_COMPONENT",
  "parameters": {
    "entityId": "actor",
    "componentId": "core:needs",
    "modifications": { "hunger": 20 },
    "mode": "set"
  }
}
```

**Result**: Hunger becomes exactly 20, regardless of previous value.

**Use Cases:**
- Resetting values to defaults
- Setting values based on external state
- Overriding calculated values

### Increment Mode (Addition)

Adds a value to the existing field value.

```json
{
  "type": "MODIFY_COMPONENT",
  "parameters": {
    "entityId": "actor",
    "componentId": "core:stats",
    "modifications": { "health": 30 },
    "mode": "increment"
  }
}
```

**Result**: Health increases by 30 (e.g., 40 + 30 = 70).

**Use Cases:**
- Healing/restoration effects
- Resource accumulation
- Stat buffs

### Decrement Mode (Subtraction)

Subtracts a value from the existing field value.

```json
{
  "type": "MODIFY_COMPONENT",
  "parameters": {
    "entityId": "actor",
    "componentId": "core:needs",
    "modifications": { "hunger": 60 },
    "mode": "decrement"
  }
}
```

**Result**: Hunger decreases by 60 (e.g., 80 - 60 = 20).

**Use Cases:**
- Consuming resources
- Satisfying needs
- Damage mitigation

## Common Numeric Goal Patterns

### Hunger/Thirst System

**Goal Definition:**
```json
{
  "id": "core:reduce_hunger",
  "relevance": {
    ">": [{ "var": "actor.components.core:needs.hunger" }, 50]
  },
  "goalState": {
    "<=": [{ "var": "actor.components.core:needs.hunger" }, 30]
  },
  "priority": 0.7
}
```

**Task Effect:**
```json
{
  "id": "core:eat_food",
  "planningEffects": [
    {
      "type": "MODIFY_COMPONENT",
      "parameters": {
        "entityId": "actor",
        "componentId": "core:needs",
        "modifications": { "hunger": 40 },
        "mode": "decrement"
      }
    }
  ]
}
```

**Planning Scenario:**
- Current hunger: 80
- Goal: hunger <= 30
- Task effect: -40 hunger
- Result: 80 - 40 = 40 (not yet satisfied)
- Planner may apply task twice: 80 - 40 - 40 = 0 (satisfied)

### Health Management

**Goal Definition:**
```json
{
  "id": "core:heal_injuries",
  "relevance": {
    "<": [{ "var": "actor.components.core:stats.health" }, 50]
  },
  "goalState": {
    ">=": [{ "var": "actor.components.core:stats.health" }, 80]
  },
  "priority": 0.9
}
```

**Task Effect:**
```json
{
  "id": "core:use_medikit",
  "planningEffects": [
    {
      "type": "MODIFY_COMPONENT",
      "parameters": {
        "entityId": "actor",
        "componentId": "core:stats",
        "modifications": { "health": 30 },
        "mode": "increment"
      }
    }
  ]
}
```

**Planning Scenario:**
- Current health: 40
- Goal: health >= 80
- Task effect: +30 health
- Result: 40 + 30 = 70 (not yet satisfied)
- Planner may apply task twice: 40 + 30 + 30 = 100 (satisfied with overshoot)

### Resource Accumulation

**Goal Definition:**
```json
{
  "id": "core:gather_gold",
  "relevance": {
    "<": [{ "var": "actor.components.core:resources.gold" }, 50]
  },
  "goalState": {
    ">=": [{ "var": "actor.components.core:resources.gold" }, 100]
  },
  "priority": 0.5
}
```

**Task Effect:**
```json
{
  "id": "core:mine_gold",
  "planningEffects": [
    {
      "type": "MODIFY_COMPONENT",
      "parameters": {
        "entityId": "actor",
        "componentId": "core:resources",
        "modifications": { "gold": 25 },
        "mode": "increment"
      }
    }
  ]
}
```

**Planning Scenario:**
- Current gold: 0
- Goal: gold >= 100
- Task effect: +25 gold
- Plan: Apply task 4 times (0 + 25 + 25 + 25 + 25 = 100)

### Exact Value Goals

**Goal Definition:**
```json
{
  "id": "core:calibrate_device",
  "relevance": {
    "!=": [{ "var": "actor.components.core:device.power_level" }, 100]
  },
  "goalState": {
    "==": [{ "var": "actor.components.core:device.power_level" }, 100]
  },
  "priority": 0.6
}
```

**Task Effect:**
```json
{
  "id": "core:adjust_power",
  "planningEffects": [
    {
      "type": "MODIFY_COMPONENT",
      "parameters": {
        "entityId": "actor",
        "componentId": "core:device",
        "modifications": { "power_level": 100 },
        "mode": "set"
      }
    }
  ]
}
```

**Note**: For exact value goals (`==`), use `set` mode to ensure the precise value is achieved.

## Best Practices

### 1. Use Appropriate Operators

Match the operator to the direction of change:

- **For reducing values** (hunger, damage, temperature): Use `<=` or `<`
  ```json
  { "<=": [{ "var": "actor.components.core:needs.hunger" }, 30] }
  ```

- **For increasing values** (health, resources, experience): Use `>=` or `>`
  ```json
  { ">=": [{ "var": "actor.components.core:stats.health" }, 80] }
  ```

- **For exact targets** (counts, precise calibration): Use `==`
  ```json
  { "==": [{ "var": "actor.components.core:device.count" }, 5] }
  ```

### 2. Set Realistic Relevance Thresholds

Make goals relevant before they become critical to allow proactive planning.

**Good Example:**
```json
{
  "relevance": { ">": [{ "var": "actor.components.core:needs.hunger" }, 50] },
  "goalState": { "<=": [{ "var": "actor.components.core:needs.hunger" }, 30] }
}
```
Goal becomes relevant at hunger 50, well before critical levels.

**Bad Example:**
```json
{
  "relevance": { ">": [{ "var": "actor.components.core:needs.hunger" }, 90] },
  "goalState": { "<=": [{ "var": "actor.components.core:needs.hunger" }, 30] }
}
```
Goal only becomes relevant when hunger is critically high (90), leaving little time to act.

### 3. Ensure Tasks Can Satisfy Goals

Verify that your tasks have sufficient effect magnitude to make meaningful progress toward goals.

**Considerations:**
- Task effects should be large enough to reduce distance significantly
- Multiple task applications may be needed (ensure `maxReuse` allows this)
- Task costs should be reasonable relative to goal priority
- Preconditions should not prevent the task from being applicable

**Example:**
```json
{
  "goalState": { "<=": [{ "var": "hunger" }, 30] },
  "task": {
    "id": "eat_snack",
    "planningEffects": [{
      "type": "MODIFY_COMPONENT",
      "parameters": {
        "entityId": "actor",
        "componentId": "core:needs",
        "modifications": { "hunger": 5 },  // Only reduces by 5
        "mode": "decrement"
      }
    }],
    "cost": 1,
    "maxReuse": 20  // Allows multiple applications
  }
}
```

### 4. Type Safety

Ensure numeric operations work with actual numeric values:

- **Component fields must be numeric**: Define component schemas with `"type": "number"`
- **Modifications must be numeric**: Don't use strings or other types in `modifications`
- **Handle missing components**: Tasks should check preconditions before modifying
- **Avoid division by zero**: In custom calculations, validate inputs

**Example Schema:**
```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "core:needs",
  "dataSchema": {
    "type": "object",
    "properties": {
      "hunger": { "type": "number", "minimum": 0, "maximum": 100 }
    },
    "required": ["hunger"]
  }
}
```

### 5. Use Goal Constraints

Limit plan complexity using goal-level constraints:

```json
{
  "id": "core:reduce_hunger",
  "goalState": { "<=": [{ "var": "hunger" }, 30] },
  "maxCost": 50,      // Don't spend more than 50 cost units
  "maxActions": 5,    // Don't chain more than 5 actions
  "priority": 0.7
}
```

### 6. Prefer Idempotent Operations

When possible, design tasks to be safely repeatable:

```json
{
  "id": "core:rest",
  "planningPreconditions": {
    ">": [{ "var": "actor.components.core:needs.fatigue" }, 20]
  },
  "planningEffects": [{
    "type": "MODIFY_COMPONENT",
    "parameters": {
      "entityId": "actor",
      "componentId": "core:needs",
      "modifications": { "fatigue": 30 },
      "mode": "decrement"
    }
  }]
}
```

The precondition prevents the task from being applied when it wouldn't help.

## Troubleshooting Numeric Goals

### Issue: Planner Doesn't Select Task

**Symptom**: Goal is relevant but no plan is created.

**Possible Causes:**
1. Task doesn't reduce distance to goal
2. Task preconditions are not satisfied
3. Task cost is too high relative to goal priority
4. Task `maxReuse` limit is too low

**Debug Steps:**

1. **Verify task has MODIFY_COMPONENT effect:**
   ```json
   {
     "planningEffects": [{
       "type": "MODIFY_COMPONENT",
       "parameters": {
         "entityId": "actor",
         "componentId": "core:needs",
         "modifications": { "hunger": 40 },
         "mode": "decrement"
       }
     }]
   }
   ```

2. **Check effect reduces distance:**
   - Goal: `hunger <= 30`, Current: 80, Effect: `-40` → New: 40 (progress made ✓)
   - Goal: `hunger <= 30`, Current: 80, Effect: `+20` → New: 100 (wrong direction ✗)

3. **Verify preconditions are satisfiable:**
   ```json
   {
     "planningPreconditions": {
       "hasComponent": ["actor", "core:needs"]
     }
   }
   ```
   Ensure the actor has the required components in the planning state.

4. **Review task cost vs priority:**
   - Goal priority: 0.7
   - Task cost: 100
   - If cost is too high, the planner may not consider it worth pursuing

5. **Check maxReuse setting:**
   ```json
   {
     "maxReuse": 10  // Allows task to be used up to 10 times
   }
   ```

### Issue: Wrong Distance Calculated

**Symptom**: Planner reports unexpected distance values or makes poor decisions.

**Possible Causes:**
1. Operator mismatch (using `>` when you need `<`)
2. Field is not numeric (string, boolean, or missing)
3. Component doesn't exist on entity

**Debug Steps:**

1. **Check operator direction:**
   - To reduce hunger: Use `<=` or `<`
   - To increase health: Use `>=` or `>`
   - Verify: Does the operator match your intent?

2. **Verify field exists and is numeric:**
   ```json
   // In component definition
   {
     "hunger": { "type": "number", "minimum": 0, "maximum": 100 }
   }
   ```

3. **Check component exists on entity:**
   ```json
   {
     "planningPreconditions": {
       "hasComponent": ["actor", "core:needs"]
     }
   }
   ```

4. **Enable GOAP debugging:**
   Set environment variable `GOAP_STATE_ASSERT=1` to catch state misses during planning.

### Issue: Plan Never Satisfies Goal

**Symptom**: Plan executes but goal remains unsatisfied.

**Possible Causes:**
1. Effect mode incorrect (`set` vs `increment`/`decrement`)
2. Modification value is wrong or too small
3. Multiple task applications needed but maxReuse is too low
4. Overshoot not allowed for equality constraints

**Debug Steps:**

1. **Verify effect mode matches intent:**
   - To reduce hunger: Use `decrement` mode
   - To increase health: Use `increment` mode
   - To set exact value: Use `set` mode

2. **Calculate: current + effect = satisfies goal?**
   - Current hunger: 80
   - Effect: `-40` (decrement by 40)
   - Result: 40
   - Goal: `<= 30`
   - Satisfied? No (40 > 30)
   - Solution: Allow multiple applications or increase effect magnitude

3. **Check maxReuse allows sufficient applications:**
   ```json
   {
     "maxReuse": 2,  // May not be enough!
     "cost": 10
   }
   ```
   If 2 applications aren't enough, increase maxReuse.

4. **For equality goals, ensure exact value is achievable:**
   ```json
   {
     "goalState": { "==": [{ "var": "count" }, 100] },
     "task": {
       "planningEffects": [{
         "type": "MODIFY_COMPONENT",
         "parameters": {
           "modifications": { "count": 100 },
           "mode": "set"  // Use set mode for exact values
         }
       }]
     }
   }
   ```

### Issue: Planner Takes Too Long

**Symptom**: Planning phase times out or takes excessive time.

**Possible Causes:**
1. Too many available tasks in the task library
2. Large numeric distances requiring many task applications
3. Complex goal conditions with many numeric constraints
4. Heuristic not guiding search effectively

**Debug Steps:**

1. **Reduce task library size:**
   - Use `structural_gates` to filter irrelevant tasks
   - Limit planning scopes to known entities only
   - Avoid tasks with overly broad applicability

2. **Use larger effect magnitudes:**
   ```json
   // Instead of: -5 hunger per task (requires many applications)
   // Use: -40 hunger per task (requires fewer applications)
   {
     "modifications": { "hunger": 40 },
     "mode": "decrement"
   }
   ```

3. **Set maxActions limit:**
   ```json
   {
     "goalState": { "<=": [{ "var": "hunger" }, 30] },
     "maxActions": 5,  // Stop after 5 actions
     "maxCost": 100    // Or cost limit
   }
   ```

4. **Enable heuristic enhancement:**
   The enhanced goal-distance heuristic provides better guidance for multi-action plans.
   See `docs/goap/multi-action-planning.md` for configuration details.

### Issue: Planner Overshoots Goal

**Symptom**: Final value goes past the goal threshold (e.g., hunger becomes negative).

**Solution**: This is expected behavior for inequality constraints (`<=`, `>=`). The planner allows overshoot because it's still valid.

**If exact values are needed:**
1. Use equality constraints: `"=="`
2. Use `set` mode to assign exact values
3. Add preconditions to prevent over-application

**Example:**
```json
{
  "planningPreconditions": {
    ">": [{ "var": "actor.components.core:needs.hunger" }, 30]
  },
  "planningEffects": [{
    "type": "MODIFY_COMPONENT",
    "parameters": {
      "modifications": { "hunger": 40 },
      "mode": "decrement"
    }
  }]
}
```
Precondition prevents task from being applied when hunger is already <= 30.

## See Also

- **Multi-Action Planning**: `docs/goap/multi-action-planning.md` - Advanced planning techniques
- **GOAP Debugging**: `docs/goap/debugging-tools.md` - Debugging and diagnostics
- **GOAP System Specs**: `specs/goap-system-specs.md` - Architecture and implementation details
- **Task Schema**: `data/schemas/task.schema.json` - Task definition format
- **Goal Schema**: `data/schemas/goal.schema.json` - Goal definition format
