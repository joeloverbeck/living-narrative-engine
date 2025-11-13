# GOAP Modder Guide: Parameter Binding

**Audience**: Content creators and modders
**Prerequisites**: Basic understanding of JSON, GOAP concepts
**Related**: [Refinement Parameter Binding](./refinement-parameter-binding.md), [Examples](./examples/)

## Introduction

This guide teaches you how to use **parameter binding** in GOAP refinement methods. Parameter binding is how you pass data from high-level tasks to low-level actions, making your refinement methods dynamic and reusable.

### What You'll Learn

- How to access task parameters in your refinement methods
- How to extract data from nested objects
- How to store and reuse results from previous steps
- How to validate parameters before using them
- Common patterns and best practices
- How to debug parameter issues

## Quick Start

### The Basics

When a task is created, it has **parameters**. Your refinement method accesses these parameters using `task.params`:

```json
{
  "stepType": "primitive_action",
  "actionId": "items:pick_up_item",
  "targetBindings": {
    "item": "task.params.targetItem"
  }
}
```

**What happens**:
1. Task has `params: { targetItem: "apple_7" }`
2. Refinement binds `item` to `"task.params.targetItem"`
3. At runtime, resolves to `"apple_7"`
4. Action executes with `item = "apple_7"`

### Your First Parameter Binding

Let's create a simple refinement method that moves to a location:

```json
{
  "id": "my_mod:move_to_location",
  "description": "Move actor to a specified location",
  "steps": [
    {
      "stepType": "primitive_action",
      "actionId": "positioning:move_to",
      "targetBindings": {
        "target": "task.params.destination"
      }
    }
  ]
}
```

**Task Parameters** (provided by planner):
```json
{
  "destination": "tavern_main_room"
}
```

**Result**: Actor moves to `tavern_main_room`.

## Parameter Sources

You have **four sources** of data you can bind to actions:

### 1. Task Parameters (`task.params`)

**What**: Data passed from the planner when task is created
**When to use**: For all task-level data (items, locations, targets, etc.)
**Availability**: All steps in the refinement method

```json
{
  "targetBindings": {
    "item": "task.params.item",
    "location": "task.params.location",
    "npc": "task.params.targetNPC"
  }
}
```

### 2. Refinement Local State (`refinement.localState`)

**What**: Results stored from previous steps
**When to use**: When you need to pass data between steps
**Availability**: Only steps AFTER the step that stored the result

```json
{
  "stepType": "primitive_action",
  "actionId": "items:pick_up_item",
  "targetBindings": {
    "item": "task.params.item"
  },
  "storeResultAs": "pickupResult"
}
```

**Later step**:
```json
{
  "targetBindings": {
    "item": "refinement.localState.pickupResult.data.item"
  }
}
```

### 3. Actor Entity (`actor`)

**What**: Current actor's entity data from the game world
**When to use**: To check actor's current state (position, inventory, health, etc.)
**Availability**: All steps

```json
{
  "condition": {
    "!=": [
      {"var": "actor.position.room"},
      {"var": "task.params.destination"}
    ]
  }
}
```

### 4. World State (`world`) - Coming Soon

**What**: Global world facts (time, weather, etc.)
**Status**: Not yet implemented
**Availability**: TBD

## Common Patterns

### Pattern 1: Simple Pass-Through

**Use case**: Pass task parameters directly to actions

```json
{
  "steps": [
    {
      "stepType": "primitive_action",
      "actionId": "items:pick_up_item",
      "targetBindings": {
        "item": "task.params.item"
      }
    },
    {
      "stepType": "primitive_action",
      "actionId": "items:consume_item",
      "targetBindings": {
        "item": "task.params.item"
      }
    }
  ]
}
```

**Task params**: `{ item: "apple_7" }`
**Result**: Pickup and consume `apple_7`

### Pattern 2: Nested Property Access

**Use case**: Extract specific data from complex parameters

```json
{
  "targetBindings": {
    "location": "task.params.item.location",
    "ownerId": "task.params.item.owner.id"
  }
}
```

**Task params**:
```json
{
  "item": {
    "entityId": "sword_3",
    "location": "armory",
    "owner": {
      "id": "guard_5",
      "name": "Guard"
    }
  }
}
```

**Result**:
- `location` = `"armory"`
- `ownerId` = `"guard_5"`

### Pattern 3: Conditional Movement

**Use case**: Only move if not already at destination

```json
{
  "stepType": "primitive_action",
  "actionId": "positioning:move_to",
  "targetBindings": {
    "target": "task.params.destination"
  },
  "condition": {
    "!=": [
      {"var": "actor.position.room"},
      {"var": "task.params.destination"}
    ]
  }
}
```

**What happens**: Move action only executes if actor is NOT already at destination.

### Pattern 4: Chain Results

**Use case**: Use result from one step in the next step

```json
{
  "steps": [
    {
      "description": "Pick up item and remember result",
      "stepType": "primitive_action",
      "actionId": "items:pick_up_item",
      "targetBindings": {
        "item": "task.params.item"
      },
      "storeResultAs": "pickupResult"
    },
    {
      "description": "Consume the item we just picked up",
      "stepType": "primitive_action",
      "actionId": "items:consume_item",
      "targetBindings": {
        "item": "refinement.localState.pickupResult.data.item"
      }
    }
  ]
}
```

### Pattern 5: Validate Before Execute

**Use case**: Check parameters are valid before expensive operations

```json
{
  "steps": [
    {
      "description": "Validate item exists",
      "stepType": "conditional",
      "condition": {
        "entity-exists": [{"var": "task.params.item"}]
      },
      "trueBranch": [
        {
          "stepType": "primitive_action",
          "actionId": "items:pick_up_item",
          "targetBindings": {
            "item": "task.params.item"
          }
        }
      ],
      "falseBranch": [
        {
          "stepType": "fail",
          "reason": "Item does not exist"
        }
      ]
    }
  ]
}
```

### Pattern 6: Check Success Before Proceeding

**Use case**: Only continue if previous step succeeded

```json
{
  "steps": [
    {
      "stepType": "primitive_action",
      "actionId": "items:pick_up_item",
      "targetBindings": {"item": "task.params.item"},
      "storeResultAs": "pickupResult"
    },
    {
      "stepType": "conditional",
      "condition": {
        "==": [{"var": "refinement.localState.pickupResult.success"}, true]
      },
      "trueBranch": [
        {
          "stepType": "primitive_action",
          "actionId": "items:use_item",
          "targetBindings": {
            "item": "refinement.localState.pickupResult.data.item"
          }
        }
      ],
      "falseBranch": [
        {
          "stepType": "fail",
          "reason": "Could not acquire item"
        }
      ]
    }
  ]
}
```

## Action Placeholder Names

**CRITICAL**: Each action defines its own placeholder names. You CANNOT use generic names!

### How to Find Placeholder Names

**Step 1**: Find the action file in `data/mods/[mod]/actions/`

**Step 2**: Look at `targetPlaceholders` in the action file:

```json
{
  "id": "items:pick_up_item",
  "targetPlaceholders": {
    "item": {
      "description": "Item to pick up",
      "requiredComponents": ["items:item", "items:pickupable"]
    }
  }
}
```

**Step 3**: Use the exact placeholder name:

```json
{
  "targetBindings": {
    "item": "task.params.targetItem"  // ✅ Correct - "item" is the placeholder
  }
}
```

### Common Placeholder Names by Action Type

| Action Type | Common Placeholders | Examples |
|-------------|---------------------|----------|
| Movement | `target`, `destination` | `positioning:move_to` |
| Items | `item`, `primary` | `items:pick_up_item`, `items:drink_from` |
| Social | `npc`, `target` | `social:talk_to` |
| Combat | `target`, `weapon` | `combat:attack` |

**Always check the action file** - don't assume placeholder names!

## Storing and Using Results

### Storing Results

Use `storeResultAs` to save step results:

```json
{
  "stepType": "primitive_action",
  "actionId": "items:pick_up_item",
  "targetBindings": {
    "item": "task.params.item"
  },
  "storeResultAs": "myResult"  // ← Store result with this name
}
```

### Result Structure

Every stored result has this structure:

```javascript
{
  success: true,           // Did the action succeed?
  data: {                  // Action-specific data
    item: "apple_7",
    actor: "player_1"
  },
  error: null,             // Error message if failed
  timestamp: 1425,         // When it executed
  actionId: "items:pick_up_item"  // Which action produced this
}
```

### Accessing Stored Results

**Check if succeeded**:
```json
{"var": "refinement.localState.myResult.success"}
```

**Get data from result**:
```json
"refinement.localState.myResult.data.item"
```

**Check for error**:
```json
{"var": "refinement.localState.myResult.error"}
```

### Visibility Rules

**Rule**: You can ONLY access results from PREVIOUS steps

```json
{
  "steps": [
    {
      "storeResultAs": "step1"
      // ❌ Cannot access: refinement.localState.step1
    },
    {
      "targetBindings": {
        "value": "refinement.localState.step1.data.value"  // ✅ Can access
      },
      "storeResultAs": "step2"
      // ❌ Cannot access: refinement.localState.step2
    },
    {
      "targetBindings": {
        "val1": "refinement.localState.step1.data.value",  // ✅ Can access
        "val2": "refinement.localState.step2.data.value"   // ✅ Can access
      }
    }
  ]
}
```

## Validation

### Why Validate?

**Prevent errors**: Catch issues before expensive operations
**Clear feedback**: Know exactly what went wrong
**Faster failures**: Fail early instead of halfway through

### What to Validate

1. **Required parameters exist**
```json
{
  "condition": {
    "and": [
      {"!=": [{"var": "task.params.item"}, null]},
      {"!=": [{"var": "task.params.item"}, undefined]}
    ]
  }
}
```

2. **Entities exist**
```json
{
  "condition": {
    "entity-exists": [{"var": "task.params.item"}]
  }
}
```

3. **Entities have required components**
```json
{
  "condition": {
    "entity-has-component": [
      {"var": "task.params.item"},
      "items:pickupable"
    ]
  }
}
```

4. **Actor state is valid**
```json
{
  "condition": {
    "<": [
      {"var": "actor.inventory.length"},
      {"var": "actor.inventory.maxSize"}
    ]
  }
}
```

### Validation Template

```json
{
  "steps": [
    {
      "description": "Validate all parameters",
      "stepType": "conditional",
      "condition": {
        "and": [
          {"!=": [{"var": "task.params.item"}, null]},
          {"entity-exists": [{"var": "task.params.item"}]},
          {"entity-has-component": [{"var": "task.params.item"}, "items:item"]}
        ]
      },
      "trueBranch": [
        /* Your actual workflow here */
      ],
      "falseBranch": [
        {
          "stepType": "fail",
          "reason": "Validation failed - check parameters"
        }
      ]
    }
  ]
}
```

## Debugging

### Common Errors

#### Error: "Parameter not found"

```
Error: Parameter 'task.params.nonexistent' not found in context
```

**Causes**:
- Parameter name misspelled
- Parameter not provided by task
- Wrong parameter source (task.params vs refinement.localState)

**Fix**:
- Check parameter name spelling
- Verify task provides the parameter
- Check if you meant to use a different source

#### Error: "Cannot read property of undefined"

```
Error: Cannot read property 'location' of undefined (task.params.item.location)
```

**Causes**:
- Parent object doesn't exist
- Trying to access property on null/undefined

**Fix**:
- Validate parent exists first
- Use conditional to check before accessing

```json
{
  "condition": {
    "and": [
      {"!=": [{"var": "task.params.item"}, null]},
      {"!=": [{"var": "task.params.item.location"}, null]}
    ]
  }
}
```

#### Error: "Local state not available"

```
Error: Local state 'refinement.localState.futureResult' not available - step not yet executed
```

**Causes**:
- Trying to access result before it's stored
- Wrong execution order

**Fix**:
- Move the accessing step AFTER the storing step
- Check conditional branches - result might not be in scope

#### Error: "Action expects different placeholder"

```
Error: Action "items:drink_from" expects placeholder "primary", but "item" was provided
```

**Causes**:
- Using wrong placeholder name for action
- Different actions have different placeholder names

**Fix**:
- Check action definition file
- Use exact placeholder name from action schema

### Debug Checklist

When parameters aren't working:

1. ✅ Check parameter names for typos
2. ✅ Verify parameter source (task.params vs refinement.localState vs actor)
3. ✅ Validate execution order (accessing stored results)
4. ✅ Check action placeholder names in action definition
5. ✅ Verify nested property paths exist
6. ✅ Add validation conditionals for complex parameters
7. ✅ Check result structure (success, data, error fields)

### Enable Tracing (Future Feature)

When implemented, you'll be able to enable parameter tracing:

```javascript
{
  debug: {
    traceParameters: true
  }
}
```

This will show you:
- What parameters are available at each step
- How bindings resolve to actual values
- What gets stored in local state
- Which conditionals evaluate to true/false

## Best Practices

### 1. Always Use Full Paths

**✅ Good**:
```json
{
  "targetBindings": {
    "item": "task.params.targetItem",
    "location": "actor.position.room"
  }
}
```

**❌ Ambiguous**:
```json
{
  "targetBindings": {
    "item": "targetItem",  // Which scope?
    "location": "room"     // Which scope?
  }
}
```

### 2. Validate Early

**✅ Good**: Validate at the start
```json
{
  "steps": [
    {
      "description": "Validate parameters",
      "stepType": "conditional",
      "condition": /* validation logic */
    },
    {
      "description": "Do work",
      "stepType": "primitive_action"
      /* ... */
    }
  ]
}
```

**❌ Bad**: Validate late, after work is done
```json
{
  "steps": [
    {
      "description": "Do work first",
      "stepType": "primitive_action"
      /* ... */
    },
    {
      "description": "Validate too late",
      "stepType": "conditional"
    }
  ]
}
```

### 3. Name Results Descriptively

**✅ Good**:
```json
{
  "storeResultAs": "pickupResult",
  "storeResultAs": "moveToTavernResult",
  "storeResultAs": "consumeItemResult"
}
```

**❌ Bad**:
```json
{
  "storeResultAs": "r1",
  "storeResultAs": "result",
  "storeResultAs": "temp"
}
```

### 4. Check Success Before Using Results

**✅ Good**:
```json
{
  "condition": {
    "==": [{"var": "refinement.localState.pickupResult.success"}, true]
  },
  "trueBranch": [
    {
      "targetBindings": {
        "item": "refinement.localState.pickupResult.data.item"
      }
    }
  ]
}
```

**❌ Risky**: Assume success
```json
{
  "targetBindings": {
    "item": "refinement.localState.pickupResult.data.item"  // What if pickup failed?
  }
}
```

### 5. Document Expected Parameters

**✅ Good**:
```json
{
  "id": "my_mod:get_item",
  "description": "Acquires and uses an item. Requires task.params.item (entity ID) and task.params.location (room entity ID).",
  "steps": [/* ... */]
}
```

### 6. Use Descriptive Task Parameter Names

**✅ Good**:
```json
{
  "task": {
    "params": {
      "targetItem": "apple_7",
      "targetLocation": "tavern",
      "targetNPC": "bartender"
    }
  }
}
```

**❌ Bad**:
```json
{
  "task": {
    "params": {
      "x": "apple_7",
      "y": "tavern",
      "z": "bartender"
    }
  }
}
```

## Examples

See the `docs/goap/examples/` directory for complete working examples:

### Example 1: Simple Parameter Passing
**File**: `parameter-simple.refinement.json`
**What it shows**: Basic parameter passing from task to actions

### Example 2: Parameter Transformation
**File**: `parameter-transformation.refinement.json`
**What it shows**: Extracting nested properties, property access patterns

### Example 3: State Accumulation
**File**: `parameter-state.refinement.json`
**What it shows**: Using `storeResultAs`, chaining results, state evolution

### Example 4: Parameter Validation
**File**: `parameter-validation.refinement.json`
**What it shows**: Comprehensive validation, error handling, fail scenarios

## Quick Reference

### Parameter Access Syntax

| Context | Format | Example |
|---------|--------|---------|
| Target Bindings | Direct string | `"task.params.item"` |
| Conditions | JSON Logic `{"var": "..."}` | `{"var": "task.params.item"}` |
| Property Access | Dot notation | `"task.params.item.location"` |

### Parameter Sources

| Source | Description | Example |
|--------|-------------|---------|
| `task.params.*` | Task parameters | `"task.params.targetItem"` |
| `refinement.localState.*` | Stored results | `"refinement.localState.pickupResult.data.item"` |
| `actor.*` | Actor entity data | `"actor.position.room"` |
| `world.*` | World state (TBD) | `"world.currentTime"` |

### Result Structure

```javascript
{
  success: boolean,
  data: object,
  error: string | null,
  timestamp: number,
  actionId: string
}
```

### Common Validation Operators

| Operator | Purpose | Example |
|----------|---------|---------|
| `entity-exists` | Check entity exists | `{"entity-exists": [{"var": "task.params.item"}]}` |
| `entity-has-component` | Check entity has component | `{"entity-has-component": ["entity_id", "component:name"]}` |
| `!=`, `==` | Equality checks | `{"!=": [{"var": "task.params.item"}, null]}` |
| `and`, `or` | Logical operators | `{"and": [condition1, condition2]}` |

## Need Help?

- **Full Documentation**: [Refinement Parameter Binding](./refinement-parameter-binding.md)
- **Examples**: `docs/goap/examples/parameter-*.refinement.json`
- **Action References**: [Refinement Action References](./refinement-action-references.md)
- **Condition Patterns**: [Condition Patterns Guide](./condition-patterns-guide.md)

---

**Happy Modding!** 🎮
