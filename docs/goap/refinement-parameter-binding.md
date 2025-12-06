# GOAP Refinement Method Parameter Binding

**Version**: 1.0.0
**Schema Version**: refinement-method.schema.json v1.1.0
**Status**: Design Specification
**Related**: [Refinement Action References](./refinement-action-references.md), [Condition Context](./refinement-condition-context.md)

## Overview

This document specifies the **parameter binding mechanism** for GOAP refinement methods. Parameter binding is the process of connecting planning-level task parameters with execution-level primitive actions, enabling data flow through multi-step refinement processes.

### Purpose

The parameter binding mechanism provides:

1. **Task-to-Action Data Flow**: Pass parameters from high-level tasks to low-level actions
2. **State Accumulation**: Store and reuse results from completed steps
3. **Dynamic Value Resolution**: Resolve entity IDs, locations, and other values at runtime
4. **Flexible Transformations**: Access nested properties and computed values
5. **Type Safety**: Validate parameters before execution

### Key Concepts

```
┌─────────────┐
│   Task      │  ← Planning level (what to achieve)
│  params: {} │
└──────┬──────┘
       │ Binds to ↓
┌──────▼──────────────┐
│   Refinement        │  ← Execution level (how to achieve)
│  localState: {}     │
│  steps: []          │
└──────┬──────────────┘
       │ Binds to ↓
┌──────▼──────────────┐
│  Primitive Action   │  ← Action level (atomic operations)
│  targetBindings: {} │
└─────────────────────┘
```

**Parameter Sources** (Four types):

| Source                  | Availability     | Description                    | Example                             |
| ----------------------- | ---------------- | ------------------------------ | ----------------------------------- |
| `task.params`           | All steps        | Parameters from planning scope | `task.params.targetItem`            |
| `refinement.localState` | Subsequent steps | Accumulated step results       | `refinement.localState.step1Result` |
| `actor`                 | All steps        | Current actor entity data      | `actor.position.room`               |
| `world`                 | All steps (TBD)  | World state facts              | `world.currentTime`                 |

## Architecture

### Parameter Flow

```
Task Definition (Planning)
    ↓
    task.params = { item: "apple_7", location: "room_12" }
    ↓
Refinement Method (Execution)
    ↓
    Step 1: Move to location
      targetBindings: { target: "task.params.location" }
      → Resolves to: "room_12"
      ↓ (executes)
      storeResultAs: "moveResult"
    ↓
    refinement.localState.moveResult = { success: true, position: "room_12" }
    ↓
    Step 2: Pick up item
      targetBindings: { item: "task.params.item" }
      → Resolves to: "apple_7"
      ↓ (executes)
      storeResultAs: "pickupResult"
    ↓
    refinement.localState.pickupResult = { success: true, item: "apple_7", actor: "player_1" }
    ↓
    Step 3: Consume item
      targetBindings: { item: "refinement.localState.pickupResult.item" }
      → Resolves to: "apple_7"
```

### Context Structure

At any point during refinement execution, the following context is available:

```javascript
{
  // Task parameters (immutable)
  task: {
    params: {
      // Planning-level parameters
      targetItem: "apple_7",
      targetLocation: "room_12"
    }
  },

  // Refinement state (mutable)
  refinement: {
    localState: {
      // Results from completed steps
      step1Result: { success: true, position: "room_12" },
      step2Result: { success: true, item: "apple_7" }
    }
  },

  // Actor entity (from ECS)
  actor: {
    id: "player_1",
    name: "Player",
    position: { room: "room_12", coordinates: { x: 10, y: 5 } },
    inventory: ["sword_1", "potion_3"]
  },

  // World state (TBD - future feature)
  world: {
    currentTime: 1425,
    weather: "rainy"
  }
}
```

## Parameter Sources

### 1. Task Parameters (`task.params`)

**Purpose**: Parameters bound from the planning scope when the task is selected.

**Characteristics**:

- **Immutable**: Cannot be modified during refinement
- **Available**: To all steps in the refinement method
- **Scope**: Defined by task schema (GOAPIMPL-005)
- **Validation**: Must match task parameter schema

**Usage Example**:

```json
{
  "stepType": "primitive_action",
  "actionId": "items:pick_up_item",
  "targetBindings": {
    "item": "task.params.targetItem"
  }
}
```

**Property Access**:

```json
{
  "targetBindings": {
    "location": "task.params.item.location",
    "owner": "task.params.item.owner.id"
  }
}
```

### 2. Refinement Local State (`refinement.localState`)

**Purpose**: Accumulate and share results between steps within a refinement method.

**Characteristics**:

- **Mutable**: Updated as steps complete
- **Scoped**: Only visible to subsequent steps
- **Initialized**: Empty object `{}` at refinement start
- **Cleared**: After refinement completes or fails

**State Accumulation**:

Steps can store their execution results using the `storeResultAs` field:

```json
{
  "stepType": "primitive_action",
  "actionId": "items:pick_up_item",
  "targetBindings": {
    "item": "task.params.targetItem"
  },
  "storeResultAs": "pickupResult"
}
```

**Result Structure**:

```javascript
{
  success: true,         // boolean - whether action succeeded
  data: {                // object - action-specific result data
    item: "apple_7",
    actor: "player_1",
    timestamp: 1425
  },
  error: null            // string | null - error message if failed
}
```

**Accessing Stored Results**:

```json
{
  "stepType": "primitive_action",
  "actionId": "items:consume_item",
  "targetBindings": {
    "item": "refinement.localState.pickupResult.data.item"
  }
}
```

**Visibility Rules**:

```json
{
  "steps": [
    {
      "description": "Step 1 - stores result",
      "storeResultAs": "step1Result"
      // ✅ Can access: task.params, actor, world
      // ❌ Cannot access: refinement.localState.step1Result (not yet stored)
    },
    {
      "description": "Step 2 - can access step 1 result",
      "targetBindings": {
        "value": "refinement.localState.step1Result.data.value"
      }
      // ✅ Can access: task.params, actor, world, refinement.localState.step1Result
    }
  ]
}
```

### 3. Actor Entity (`actor`)

**Purpose**: Access current actor's entity data from the ECS.

**Characteristics**:

- **Dynamic**: Reflects current entity state
- **Available**: To all steps
- **Mutable**: Changes as actions modify the actor
- **Source**: Entity Component System (ECS)

**Usage Example**:

```json
{
  "stepType": "primitive_action",
  "actionId": "positioning:move_to",
  "targetBindings": {
    "destination": "task.params.location"
  },
  "condition": {
    "!=": [{ "var": "actor.position.room" }, { "var": "task.params.location" }]
  }
}
```

**Common Actor Properties**:

| Property          | Description                | Example                     |
| ----------------- | -------------------------- | --------------------------- |
| `actor.id`        | Actor entity ID            | `"player_1"`                |
| `actor.name`      | Actor display name         | `"Player"`                  |
| `actor.position`  | Current position component | `{ room: "room_12" }`       |
| `actor.inventory` | Inventory items            | `["sword_1", "potion_3"]`   |
| `actor.health`    | Health component           | `{ current: 80, max: 100 }` |

**Note**: Available properties depend on which components the actor entity has.

### 4. World State (`world`) - TBD

**Purpose**: Access global world facts and state.

**Status**: Specification pending (requires world state API implementation)

**Proposed Usage**:

```json
{
  "condition": {
    "and": [
      { ">": [{ "var": "world.currentTime" }, 1200] },
      { "==": [{ "var": "world.weather" }, "clear"] }
    ]
  }
}
```

**Characteristics**:

- **Global**: Shared across all tasks and actors
- **Read-Only**: Cannot be modified through parameter binding
- **Dynamic**: Updated by game systems
- **Queryable**: Access via dot notation

## Parameter Binding Syntax

### Target Bindings (Primitive Actions)

**Format**: Direct string references (NOT JSON Logic)

```json
{
  "stepType": "primitive_action",
  "actionId": "items:pick_up_item",
  "targetBindings": {
    "item": "task.params.targetItem"
  }
}
```

**✅ CORRECT Syntax**:

```json
"targetBindings": {
  "item": "task.params.targetItem",
  "location": "actor.position.room",
  "result": "refinement.localState.previousResult.data.value"
}
```

**❌ WRONG Syntax** (DO NOT use JSON Logic in target bindings):

```json
"targetBindings": {
  "item": {"var": "task.params.targetItem"}  // ❌ Wrong!
}
```

### Conditional Expressions (JSON Logic)

**Format**: JSON Logic with `{"var": "..."}` accessor

```json
{
  "stepType": "conditional",
  "condition": {
    "==": [
      { "var": "actor.position.room" },
      { "var": "task.params.targetLocation" }
    ]
  }
}
```

**Accessing Parameters in Conditions**:

```json
{
  "condition": {
    "and": [
      // Check task parameter
      { "!=": [{ "var": "task.params.item" }, null] },

      // Check local state
      { "==": [{ "var": "refinement.localState.moveResult.success" }, true] },

      // Check actor state
      { ">": [{ "var": "actor.inventory.length" }, 0] }
    ]
  }
}
```

### Property Access Patterns

**Dot Notation**: Navigate nested objects

```json
// Simple property access
"task.params.item"

// Nested property access
"task.params.item.location"
"actor.position.coordinates.x"
"refinement.localState.result.data.value"

// Array indexing (via JSON Logic)
{"var": "actor.inventory.0"}
```

**Array Operations** (via JSON Logic in conditions):

```json
{
  "condition": {
    "in": [{ "var": "task.params.requiredItem" }, { "var": "actor.inventory" }]
  }
}
```

## Parameter Transformation

### Basic Transformation

**Pass-through**: Direct parameter forwarding

```json
{
  "targetBindings": {
    "item": "task.params.item"
  }
}
```

### Property Extraction

**Extract nested properties**:

```json
{
  "targetBindings": {
    "location": "task.params.item.location",
    "ownerId": "task.params.item.owner.id"
  }
}
```

**Example Task Parameters**:

```javascript
task.params = {
  item: {
    entityId: 'apple_7',
    location: 'room_12',
    owner: {
      id: 'npc_5',
      name: 'Merchant',
    },
  },
};
```

**Binding Resolution**:

```javascript
targetBindings = {
  location: 'room_12', // Resolved from task.params.item.location
  ownerId: 'npc_5', // Resolved from task.params.item.owner.id
};
```

### Computed Values (Conditional Logic)

**Use conditional steps for computed transformations**:

```json
{
  "steps": [
    {
      "stepType": "conditional",
      "condition": {
        ">": [{ "var": "actor.inventory.length" }, 5]
      },
      "trueBranch": [
        {
          "stepType": "primitive_action",
          "actionId": "items:drop_item",
          "targetBindings": {
            "item": "actor.inventory.0" // Drop first item
          },
          "storeResultAs": "dropResult"
        }
      ],
      "falseBranch": []
    }
  ]
}
```

### State Accumulation Patterns

**Pattern 1: Chain Results**

```json
{
  "steps": [
    {
      "description": "Step 1: Acquire item",
      "stepType": "primitive_action",
      "actionId": "items:pick_up_item",
      "targetBindings": {
        "item": "task.params.item"
      },
      "storeResultAs": "acquireResult"
    },
    {
      "description": "Step 2: Use acquired item",
      "stepType": "primitive_action",
      "actionId": "items:use_item",
      "targetBindings": {
        "item": "refinement.localState.acquireResult.data.item"
      },
      "storeResultAs": "useResult"
    }
  ]
}
```

**Pattern 2: Conditional Based on Results**

```json
{
  "steps": [
    {
      "stepType": "primitive_action",
      "actionId": "items:pick_up_item",
      "targetBindings": {
        "item": "task.params.item"
      },
      "storeResultAs": "pickupResult"
    },
    {
      "stepType": "conditional",
      "condition": {
        "==": [{ "var": "refinement.localState.pickupResult.success" }, true]
      },
      "trueBranch": [
        {
          "stepType": "primitive_action",
          "actionId": "items:consume_item",
          "targetBindings": {
            "item": "refinement.localState.pickupResult.data.item"
          }
        }
      ],
      "falseBranch": [
        {
          "stepType": "fail",
          "reason": "Failed to acquire item"
        }
      ]
    }
  ]
}
```

## Scope Rules

### Scope Precedence

When multiple parameter sources define the same property name, the following precedence applies:

**Precedence Order** (highest to lowest):

1. `refinement.localState` - Most specific, step-level scope
2. `task.params` - Task-level scope
3. `actor` - Actor entity scope
4. `world` - Global scope

**Example**:

```javascript
// If all sources define "item":
refinement.localState.item; // ✅ Takes precedence
task.params.item; // Used if localState.item doesn't exist
actor.item; // Used if neither above exist
world.item; // Used if none above exist
```

### Visibility Rules

**Rule 1: Task Parameters** - Visible to all steps

```json
{
  "steps": [
    { "targetBindings": { "item": "task.params.item" } }, // ✅ Visible
    { "targetBindings": { "item": "task.params.item" } }, // ✅ Visible
    { "targetBindings": { "item": "task.params.item" } } // ✅ Visible
  ]
}
```

**Rule 2: Local State** - Only visible to subsequent steps

```json
{
  "steps": [
    {
      "storeResultAs": "result1"
      // ❌ Cannot access: refinement.localState.result1
    },
    {
      "targetBindings": {
        "value": "refinement.localState.result1.data.value" // ✅ Can access result1
      },
      "storeResultAs": "result2"
      // ❌ Cannot access: refinement.localState.result2
    },
    {
      "targetBindings": {
        "val1": "refinement.localState.result1.data.value", // ✅ Can access result1
        "val2": "refinement.localState.result2.data.value" // ✅ Can access result2
      }
    }
  ]
}
```

**Rule 3: Conditional Branches** - Isolated local state

```json
{
  "stepType": "conditional",
  "trueBranch": [
    {
      "storeResultAs": "trueResult"
      // ✅ Available to later steps in trueBranch
      // ❌ NOT available to falseBranch
    }
  ],
  "falseBranch": [
    {
      "storeResultAs": "falseResult"
      // ✅ Available to later steps in falseBranch
      // ❌ NOT available to trueBranch
    }
  ]
  // ❌ Neither trueResult nor falseResult available after conditional completes
}
```

**Rule 4: Actor State** - Dynamic, reflects current entity state

```json
{
  "steps": [
    {
      "targetBindings": {
        "location": "actor.position.room" // Reads current position
      }
    },
    {
      "stepType": "primitive_action",
      "actionId": "positioning:move_to",
      "targetBindings": {
        "destination": "task.params.newRoom"
      }
      // ← Actor position changes here
    },
    {
      "targetBindings": {
        "location": "actor.position.room" // Reads UPDATED position
      }
    }
  ]
}
```

### Shadowing Behavior

**Definition**: When a more specific scope defines a property that exists in a broader scope.

**Example**:

```javascript
// Initial state
task.params.item = "apple_7"
refinement.localState = {}

// Step 1 stores result
refinement.localState.item = "orange_3"

// Step 2 accesses "item"
"targetBindings": {
  "item": "item"  // ← Which item?
}

// Resolution: refinement.localState.item = "orange_3" (precedence)
```

**Best Practice**: Always use fully qualified names to avoid ambiguity:

```json
{
  "targetBindings": {
    "originalItem": "task.params.item", // Explicit
    "modifiedItem": "refinement.localState.item" // Explicit
  }
}
```

## Validation

### Validation Timing

**1. Schema Validation** (Load Time)

- Validate refinement method structure
- Validate target binding syntax
- Validate condition JSON Logic syntax

**2. Parameter Validation** (Before Step Execution)

- Validate required parameters exist
- Validate parameter types match expected types
- Validate reference resolution (parameter source exists)

**3. Runtime Validation** (During Execution)

- Validate action target bindings resolve successfully
- Validate condition expressions evaluate successfully
- Validate stored results match expected structure

### Required Parameter Validation

**Action Schema Defines Requirements**:

```json
// items:pick_up_item action schema
{
  "targetPlaceholders": {
    "item": {
      "description": "Item to pick up",
      "required": true,
      "requiredComponents": ["items:item", "items:pickupable"]
    }
  }
}
```

**Refinement Must Provide**:

```json
{
  "stepType": "primitive_action",
  "actionId": "items:pick_up_item",
  "targetBindings": {
    "item": "task.params.targetItem" // ✅ Required placeholder provided
  }
}
```

**Validation Failure**:

```json
{
  "stepType": "primitive_action",
  "actionId": "items:pick_up_item",
  "targetBindings": {} // ❌ Missing required "item" binding
}
```

**Error**: `Missing required target binding: "item" for action "items:pick_up_item"`

### Type Validation

**Entity ID Validation**:

```json
{
  "targetBindings": {
    "item": "task.params.itemId"
  }
}
```

**Validation**:

- `task.params.itemId` must resolve to a valid entity ID
- Entity must exist in the ECS
- Entity must have required components (defined by action schema)

**Validation Failure**:

- **Missing Parameter**: "Parameter 'task.params.itemId' not found in context"
- **Invalid Entity**: "Entity 'invalid_123' does not exist"
- **Missing Component**: "Entity 'apple_7' missing required component 'items:pickupable'"

### Reference Resolution Validation

**Valid References**:

```json
{
  "targetBindings": {
    "item": "task.params.item", // ✅ Valid
    "location": "actor.position.room", // ✅ Valid
    "result": "refinement.localState.step1.data.value" // ✅ Valid (if step1 executed)
  }
}
```

**Invalid References**:

```json
{
  "targetBindings": {
    "item": "task.params.nonexistent", // ❌ Parameter doesn't exist
    "location": "actor.invalid.property", // ❌ Property path invalid
    "result": "refinement.localState.futureStep.value" // ❌ Step not yet executed
  }
}
```

### Fallback Behavior

When validation fails, the refinement method can specify fallback behavior:

```json
{
  "stepType": "primitive_action",
  "actionId": "items:pick_up_item",
  "targetBindings": {
    "item": "task.params.item"
  },
  "onFailure": "replan" // Options: "replan", "fail", "continue"
}
```

**Fallback Options**:

| Option     | Behavior                                 |
| ---------- | ---------------------------------------- |
| `replan`   | Abandon current plan, trigger replanning |
| `fail`     | Fail entire refinement method            |
| `continue` | Skip this step, continue to next step    |

## Integration with JSON Logic

### Target Bindings vs Conditional Expressions

**Key Distinction**:

| Context                 | Format                      | Example                       |
| ----------------------- | --------------------------- | ----------------------------- |
| Target Bindings         | Direct string reference     | `"task.params.item"`          |
| Conditional Expressions | JSON Logic `{"var": "..."}` | `{"var": "task.params.item"}` |

**Why The Difference?**

- **Target Bindings**: Resolved **before** action execution, values passed directly to action
- **Conditional Expressions**: Evaluated **during** step processing, boolean result used for control flow

### Available JSON Logic Operators

**Standard Operators** (from json-logic-js):

```json
{
  "condition": {
    "and": [
      { "==": [{ "var": "task.params.item" }, "apple_7"] },
      { ">": [{ "var": "actor.health.current" }, 50] },
      { "in": [{ "var": "task.params.room" }, { "var": "actor.visited" }] }
    ]
  }
}
```

**Custom Operators** (Living Narrative Engine extensions):

```json
{
  "condition": {
    "entity-has-component": [{ "var": "task.params.item" }, "items:consumable"]
  }
}
```

See [Condition Patterns Guide](./condition-patterns-guide.md) for complete operator reference.

### Complex Conditions with Parameters

**Pattern: Multi-Source Validation**

```json
{
  "condition": {
    "and": [
      // Task parameter exists
      { "!=": [{ "var": "task.params.item" }, null] },

      // Actor has space in inventory
      {
        "<": [
          { "var": "actor.inventory.length" },
          { "var": "actor.inventory.maxSize" }
        ]
      },

      // Previous step succeeded
      { "==": [{ "var": "refinement.localState.moveResult.success" }, true] },

      // Item is in same room as actor
      {
        "==": [
          { "var": "task.params.item.location" },
          { "var": "actor.position.room" }
        ]
      }
    ]
  }
}
```

## Debugging Parameter Binding

### Parameter Tracing

**Enable Tracing** (runtime configuration):

```javascript
{
  debug: {
    traceParameters: true,
    traceStepExecution: true
  }
}
```

**Trace Output Format**:

```
[REFINEMENT] Starting refinement: "get_and_consume_item"
[PARAMS] Task parameters: { item: "apple_7", location: "room_12" }
[PARAMS] Local state initialized: {}

[STEP 1] Executing: "move_to_location"
[PARAMS] Resolving target binding "target" = "task.params.location"
[PARAMS]   → task.params.location = "room_12"
[PARAMS]   → Resolved: "room_12"
[STEP 1] Action "positioning:move_to" executing with targets: { target: "room_12" }
[STEP 1] Complete - Result stored as "moveResult"
[PARAMS] Local state updated: { moveResult: { success: true, position: "room_12" } }

[STEP 2] Executing: "pick_up_item"
[PARAMS] Resolving target binding "item" = "task.params.item"
[PARAMS]   → task.params.item = "apple_7"
[PARAMS]   → Resolved: "apple_7"
[STEP 2] Action "items:pick_up_item" executing with targets: { item: "apple_7" }
[STEP 2] Complete - Result stored as "pickupResult"
[PARAMS] Local state updated: { moveResult: {...}, pickupResult: { success: true, item: "apple_7" } }
```

### Common Parameter Issues

**Issue 1: Parameter Not Found**

```
Error: Parameter 'task.params.nonexistent' not found in context
```

**Solution**: Verify parameter name and source:

- Check task schema for parameter definition
- Verify parameter is passed when task is created
- Check spelling and case sensitivity

**Issue 2: Property Path Invalid**

```
Error: Cannot read property 'location' of undefined (task.params.item.location)
```

**Solution**: Validate nested structure:

- Check that parent object exists
- Verify property exists on object
- Use conditional checks before accessing deep properties

**Issue 3: Accessing Future State**

```
Error: Local state 'refinement.localState.step5Result' not available - step not yet executed
```

**Solution**: Verify execution order:

- Ensure step storing result executes before step accessing result
- Check conditional branch logic - state may not be available in all branches

**Issue 4: Action Placeholder Mismatch**

```
Error: Action "items:drink_from" expects placeholder "primary", but "item" was provided
```

**Solution**: Check action schema for correct placeholder names:

- Read action definition file
- Use exact placeholder names from action schema
- Different actions use different placeholder names

### Inspection Tools

**Proposed Runtime Inspection** (future feature):

```javascript
// Get current parameter context for a refinement
inspector.getContext(refinementId).then((context) => {
  console.log('Task Params:', context.task.params);
  console.log('Local State:', context.refinement.localState);
  console.log('Actor:', context.actor);
});

// Get parameter resolution trace
inspector.getParameterTrace(refinementId, stepIndex).then((trace) => {
  trace.forEach((resolution) => {
    console.log(`${resolution.binding} → ${resolution.value}`);
  });
});
```

## Best Practices

### 1. Use Descriptive Parameter Names

**✅ Good**:

```json
{
  "task": {
    "params": {
      "targetItem": "apple_7",
      "targetLocation": "room_12",
      "targetNPC": "merchant_5"
    }
  }
}
```

**❌ Avoid**:

```json
{
  "task": {
    "params": {
      "a": "apple_7",
      "b": "room_12",
      "c": "merchant_5"
    }
  }
}
```

### 2. Always Use Fully Qualified Names

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
    "item": "targetItem", // Which scope?
    "location": "room" // Which scope?
  }
}
```

### 3. Validate Parameters Early

**✅ Good**:

```json
{
  "steps": [
    {
      "stepType": "conditional",
      "condition": {
        "and": [
          { "!=": [{ "var": "task.params.item" }, null] },
          { "entity-exists": [{ "var": "task.params.item" }] },
          {
            "entity-has-component": [
              { "var": "task.params.item" },
              "items:pickupable"
            ]
          }
        ]
      },
      "trueBranch": [
        /* proceed with pickup */
      ],
      "falseBranch": [
        { "stepType": "fail", "reason": "Invalid item parameter" }
      ]
    }
  ]
}
```

### 4. Document Parameter Requirements

**✅ Good**:

```json
{
  "$schema": "schema://living-narrative-engine/refinement-method.schema.json",
  "id": "tasks:get_and_consume_item",
  "description": "Acquire and consume an item. Requires task.params.item (entity ID of consumable item).",
  "steps": [
    /* ... */
  ]
}
```

### 5. Use State Accumulation for Complex Workflows

**✅ Good**:

```json
{
  "steps": [
    {
      "description": "Acquire item",
      "stepType": "primitive_action",
      "actionId": "items:pick_up_item",
      "targetBindings": { "item": "task.params.item" },
      "storeResultAs": "acquireResult"
    },
    {
      "description": "Validate item acquired",
      "stepType": "conditional",
      "condition": {
        "==": [{ "var": "refinement.localState.acquireResult.success" }, true]
      },
      "trueBranch": [
        {
          "description": "Use item",
          "stepType": "primitive_action",
          "actionId": "items:use_item",
          "targetBindings": {
            "item": "refinement.localState.acquireResult.data.item"
          }
        }
      ],
      "falseBranch": [
        { "stepType": "fail", "reason": "Could not acquire item" }
      ]
    }
  ]
}
```

### 6. Handle Missing Parameters Gracefully

**✅ Good**:

```json
{
  "stepType": "conditional",
  "condition": {
    "and": [
      { "!=": [{ "var": "task.params.optionalItem" }, null] },
      { "!=": [{ "var": "task.params.optionalItem" }, undefined] }
    ]
  },
  "trueBranch": [
    {
      "stepType": "primitive_action",
      "actionId": "items:use_item",
      "targetBindings": { "item": "task.params.optionalItem" }
    }
  ],
  "falseBranch": []
}
```

### 7. Minimize State Accumulation

**✅ Good** (only store what you need):

```json
{
  "storeResultAs": "moveResult"
  // Later: access only specific properties
  "targetBindings": {
    "location": "refinement.localState.moveResult.data.position"
  }
}
```

**❌ Avoid** (storing entire entity objects):

```json
{
  "storeResultAs": "entireWorldState" // ❌ Too much data
}
```

## Schema Extensions (Proposed)

### `storeResultAs` Field

**Schema Extension**:

```json
{
  "PrimitiveActionStep": {
    "type": "object",
    "properties": {
      "stepType": { "const": "primitive_action" },
      "actionId": { "type": "string" },
      "targetBindings": { "type": "object" },
      "parameters": { "type": "object" },
      "storeResultAs": {
        "type": "string",
        "description": "Variable name to store action result in refinement.localState",
        "pattern": "^[a-zA-Z_][a-zA-Z0-9_]*$"
      },
      "onFailure": {
        "enum": ["replan", "fail", "continue"],
        "default": "replan"
      }
    },
    "required": ["stepType", "actionId", "targetBindings"]
  }
}
```

### Result Structure Format

**Standard Result Object**:

```typescript
interface StepResult {
  success: boolean;
  data: Record<string, any>; // Action-specific result data
  error: string | null; // Error message if success === false
  timestamp: number; // Execution timestamp
  actionId: string; // Action that produced this result
}
```

**Example Result Objects**:

```javascript
// Success case
{
  success: true,
  data: {
    item: "apple_7",
    actor: "player_1",
    previousLocation: "room_11",
    newLocation: "room_12"
  },
  error: null,
  timestamp: 1425,
  actionId: "items:pick_up_item"
}

// Failure case
{
  success: false,
  data: {},
  error: "Item not accessible - container is locked",
  timestamp: 1426,
  actionId: "items:pick_up_item"
}
```

### Local State Initialization

**Refinement Start**:

```javascript
refinement.localState = {};
```

**After Each Step with `storeResultAs`**:

```javascript
refinement.localState[storeResultAs] = {
  success: /* boolean */,
  data: /* object */,
  error: /* string | null */,
  timestamp: /* number */,
  actionId: /* string */
}
```

**Refinement End**:

```javascript
refinement.localState = {}; // Cleared
```

## Related Documentation

- [Refinement Action References](./refinement-action-references.md) - Action ID usage and placeholder names
- [Refinement Condition Context](./refinement-condition-context.md) - Available context for conditions
- [Condition Patterns Guide](./condition-patterns-guide.md) - JSON Logic patterns and operators
- [Action Discovery Guide](./action-discovery-guide.md) - How actions are discovered and validated
- [Task Schema Specification](./task-schema-specification.md) - Task definition and parameter structure (GOAPIMPL-005)

## Examples

See `docs/goap/examples/` for complete working examples:

- [`parameter-simple.refinement.json`](./examples/parameter-simple.refinement.json) - Basic parameter passing
- [`parameter-transformation.refinement.json`](./examples/parameter-transformation.refinement.json) - Property access and transformations
- [`parameter-state.refinement.json`](./examples/parameter-state.refinement.json) - State accumulation with `storeResultAs`
- [`parameter-validation.refinement.json`](./examples/parameter-validation.refinement.json) - Validation and error handling

## Version History

| Version | Date       | Changes                                                    |
| ------- | ---------- | ---------------------------------------------------------- |
| 1.0.0   | 2025-01-13 | Initial specification - parameter binding mechanism design |

---

**Status**: Design Specification
**Implementation**: Documentation only (runtime implementation TBD)
**Dependencies**: GOAPIMPL-001 (Base Schema), GOAPIMPL-003 (Action References)
**Blocks**: GOAPIMPL-005 (Task Schema), GOAPIMPL-007 (Complete Examples)
