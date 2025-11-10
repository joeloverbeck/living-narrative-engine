# GOAP Operation Mapping

## Overview

This document defines the mapping between rule operations and planning effects for the GOAP system. The Effects Analyzer uses these mappings to automatically generate planning metadata from action rules.

## Operation Categories

Operations are categorized by their impact on planning:

1. **State-Changing Operations**: Generate planning effects
2. **Context Operations**: Produce data used by other operations (no direct effects)
3. **Control Flow Operations**: Structure operation execution (analyzed for contained operations)
4. **Excluded Operations**: No planning impact (events, logging, etc.)

## State-Changing Operations

These operations modify world state and generate planning effects.

### Core Component Operations

#### ADD_COMPONENT

**Purpose**: Adds a component to an entity

**Rule Operation:**
```json
{
  "type": "ADD_COMPONENT",
  "entity": "actor",
  "component": "positioning:sitting",
  "data": {}
}
```

**Planning Effect:**
```json
{
  "operation": "ADD_COMPONENT",
  "entity": "actor",
  "component": "positioning:sitting",
  "data": {}
}
```

**Mapping**: Direct 1:1 mapping

---

#### REMOVE_COMPONENT

**Purpose**: Removes a component from an entity

**Rule Operation:**
```json
{
  "type": "REMOVE_COMPONENT",
  "entity": "target",
  "component": "positioning:standing"
}
```

**Planning Effect:**
```json
{
  "operation": "REMOVE_COMPONENT",
  "entity": "target",
  "component": "positioning:standing"
}
```

**Mapping**: Direct 1:1 mapping

---

#### MODIFY_COMPONENT

**Purpose**: Modifies component data

**Rule Operation:**
```json
{
  "type": "MODIFY_COMPONENT",
  "entity": "actor",
  "component": "core:position",
  "updates": {
    "location": "bedroom"
  }
}
```

**Planning Effect:**
```json
{
  "operation": "MODIFY_COMPONENT",
  "entity": "actor",
  "component": "core:position",
  "updates": {
    "location": "bedroom"
  }
}
```

**Mapping**: Direct 1:1 mapping

**Note**: If `updates` contains macros (e.g., `{var: "newLocation"}`), these are resolved during analysis.

---

#### ATOMIC_MODIFY_COMPONENT

**Purpose**: Atomically modifies component data (thread-safe)

**Rule Operation:**
```json
{
  "type": "ATOMIC_MODIFY_COMPONENT",
  "entity": "actor",
  "component": "core:inventory",
  "updates": {
    "itemCount": 5
  }
}
```

**Planning Effect:**
```json
{
  "operation": "MODIFY_COMPONENT",
  "entity": "actor",
  "component": "core:inventory",
  "updates": {
    "itemCount": 5
  }
}
```

**Mapping**: Maps to `MODIFY_COMPONENT` effect (atomic behavior is execution detail)

---

### Component-Based Operations

These operations are implemented via component changes and map to multiple effects.

#### LOCK_MOVEMENT

**Purpose**: Prevents entity movement

**Rule Operation:**
```json
{
  "type": "LOCK_MOVEMENT",
  "entity": "actor"
}
```

**Planning Effect:**
```json
{
  "operation": "ADD_COMPONENT",
  "entity": "actor",
  "component": "positioning:movement_locked"
}
```

---

#### UNLOCK_MOVEMENT

**Purpose**: Allows entity movement

**Rule Operation:**
```json
{
  "type": "UNLOCK_MOVEMENT",
  "entity": "actor"
}
```

**Planning Effect:**
```json
{
  "operation": "REMOVE_COMPONENT",
  "entity": "actor",
  "component": "positioning:movement_locked"
}
```

---

#### ESTABLISH_SITTING_CLOSENESS

**Purpose**: Establishes sitting proximity relationship

**Rule Operation:**
```json
{
  "type": "ESTABLISH_SITTING_CLOSENESS",
  "entity": "actor",
  "target": "target"
}
```

**Planning Effects:**
```json
[
  {
    "operation": "ADD_COMPONENT",
    "entity": "actor",
    "component": "positioning:sitting_close_to",
    "data": {
      "targetId": "{targetId}"
    }
  },
  {
    "operation": "ADD_COMPONENT",
    "entity": "target",
    "component": "positioning:sitting_close_to",
    "data": {
      "targetId": "{actorId}"
    }
  }
]
```

**Note**: Generates symmetric relationship effects

---

### Inventory & Item Operations

#### TRANSFER_ITEM

**Purpose**: Transfers item from one entity to another

**Rule Operation:**
```json
{
  "type": "TRANSFER_ITEM",
  "itemId": "{itemId}",
  "fromEntity": "actor",
  "toEntity": "target"
}
```

**Planning Effects:**
```json
[
  {
    "operation": "REMOVE_COMPONENT",
    "entity": "actor",
    "component": "items:in_inventory",
    "componentId": "{itemId}"
  },
  {
    "operation": "ADD_COMPONENT",
    "entity": "target",
    "component": "items:in_inventory",
    "componentId": "{itemId}"
  }
]
```

**Note**: Requires tracking which specific component instance is affected (componentId)

---

#### DROP_ITEM_AT_LOCATION

**Purpose**: Drops item from inventory to location

**Rule Operation:**
```json
{
  "type": "DROP_ITEM_AT_LOCATION",
  "entity": "actor",
  "itemId": "{itemId}",
  "location": "{currentLocation}"
}
```

**Planning Effects:**
```json
[
  {
    "operation": "REMOVE_COMPONENT",
    "entity": "actor",
    "component": "items:in_inventory",
    "componentId": "{itemId}"
  },
  {
    "operation": "ADD_COMPONENT",
    "entity": "{itemId}",
    "component": "items:at_location",
    "data": {
      "location": "{currentLocation}"
    }
  }
]
```

---

#### PICK_UP_ITEM_FROM_LOCATION

**Purpose**: Picks up item from location into inventory

**Rule Operation:**
```json
{
  "type": "PICK_UP_ITEM_FROM_LOCATION",
  "entity": "actor",
  "itemId": "{itemId}"
}
```

**Planning Effects:**
```json
[
  {
    "operation": "REMOVE_COMPONENT",
    "entity": "{itemId}",
    "component": "items:at_location"
  },
  {
    "operation": "ADD_COMPONENT",
    "entity": "actor",
    "component": "items:in_inventory",
    "componentId": "{itemId}"
  }
]
```

---

#### OPEN_CONTAINER

**Purpose**: Opens a container

**Rule Operation:**
```json
{
  "type": "OPEN_CONTAINER",
  "entity": "target"
}
```

**Planning Effect:**
```json
{
  "operation": "MODIFY_COMPONENT",
  "entity": "target",
  "component": "items:container",
  "updates": {
    "isOpen": true
  }
}
```

---

#### TAKE_FROM_CONTAINER

**Purpose**: Takes item from container to inventory

**Rule Operation:**
```json
{
  "type": "TAKE_FROM_CONTAINER",
  "entity": "actor",
  "containerId": "{containerId}",
  "itemId": "{itemId}"
}
```

**Planning Effects:**
```json
[
  {
    "operation": "REMOVE_COMPONENT",
    "entity": "{containerId}",
    "component": "items:contains",
    "componentId": "{itemId}"
  },
  {
    "operation": "ADD_COMPONENT",
    "entity": "actor",
    "component": "items:in_inventory",
    "componentId": "{itemId}"
  }
]
```

---

#### PUT_IN_CONTAINER

**Purpose**: Puts item from inventory into container

**Rule Operation:**
```json
{
  "type": "PUT_IN_CONTAINER",
  "entity": "actor",
  "containerId": "{containerId}",
  "itemId": "{itemId}"
}
```

**Planning Effects:**
```json
[
  {
    "operation": "REMOVE_COMPONENT",
    "entity": "actor",
    "component": "items:in_inventory",
    "componentId": "{itemId}"
  },
  {
    "operation": "ADD_COMPONENT",
    "entity": "{containerId}",
    "component": "items:contains",
    "componentId": "{itemId}"
  }
]
```

---

### Clothing Operations

#### UNEQUIP_CLOTHING

**Purpose**: Removes equipped clothing

**Rule Operation:**
```json
{
  "type": "UNEQUIP_CLOTHING",
  "entity": "actor",
  "clothingId": "{clothingId}"
}
```

**Planning Effects:**
```json
[
  {
    "operation": "REMOVE_COMPONENT",
    "entity": "actor",
    "component": "clothing:equipped",
    "componentId": "{clothingId}"
  },
  {
    "operation": "ADD_COMPONENT",
    "entity": "actor",
    "component": "items:in_inventory",
    "componentId": "{clothingId}"
  }
]
```

---

### Consumption Operations

#### DRINK_FROM

**Purpose**: Drinks from a container (partial consumption)

**Rule Operation:**
```json
{
  "type": "DRINK_FROM",
  "entity": "actor",
  "containerId": "{containerId}",
  "amount": 100
}
```

**Planning Effect:**
```json
{
  "operation": "MODIFY_COMPONENT",
  "entity": "{containerId}",
  "component": "items:liquid_container",
  "updates": {
    "currentVolume": "{currentVolume - amount}"
  }
}
```

**Note**: Requires macro resolution for volume calculation

---

#### DRINK_ENTIRELY

**Purpose**: Consumes all liquid from container

**Rule Operation:**
```json
{
  "type": "DRINK_ENTIRELY",
  "entity": "actor",
  "containerId": "{containerId}"
}
```

**Planning Effect:**
```json
{
  "operation": "MODIFY_COMPONENT",
  "entity": "{containerId}",
  "component": "items:liquid_container",
  "updates": {
    "currentVolume": 0,
    "isEmpty": true
  }
}
```

---

## Context Operations

These operations produce data used by other operations but don't directly change world state.

### Query Operations

| Operation | Purpose | Planning Impact |
|-----------|---------|-----------------|
| `QUERY_COMPONENT` | Retrieves component data | None (data operation) |
| `QUERY_COMPONENTS` | Retrieves multiple components | None (data operation) |
| `QUERY_ENTITIES` | Queries entities by criteria | None (data operation) |
| `QUERY_LOOKUP` | Looks up entity by property | None (data operation) |

**Note**: These operations provide context for state-changing operations but don't generate effects themselves.

### Utility Operations

| Operation | Purpose | Planning Impact |
|-----------|---------|-----------------|
| `GET_NAME` | Gets entity name | None (data operation) |
| `GET_TIMESTAMP` | Gets current timestamp | None (data operation) |
| `SET_VARIABLE` | Sets context variable | None (execution detail) |
| `VALIDATE_INVENTORY_CAPACITY` | Checks inventory space | None (validation only) |
| `VALIDATE_CONTAINER_CAPACITY` | Checks container space | None (validation only) |
| `HAS_COMPONENT` | Checks component existence | None (query only) |
| `HAS_BODY_PART_WITH_COMPONENT_VALUE` | Checks body part state | None (query only) |
| `RESOLVE_DIRECTION` | Resolves facing direction | None (calculation only) |
| `MATH` | Performs calculation | None (calculation only) |

---

## Control Flow Operations

These operations structure the execution of other operations.

### IF

**Purpose**: Conditional execution

**Rule Operation:**
```json
{
  "type": "IF",
  "condition": {"==": [{"var": "x"}, 5]},
  "then": [
    {"type": "ADD_COMPONENT", "entity": "actor", "component": "test:component"}
  ],
  "else": [
    {"type": "REMOVE_COMPONENT", "entity": "actor", "component": "test:component"}
  ]
}
```

**Planning Effect:**
```json
{
  "operation": "CONDITIONAL",
  "condition": {"==": [{"var": "x"}, 5]},
  "then": [
    {
      "operation": "ADD_COMPONENT",
      "entity": "actor",
      "component": "test:component"
    }
  ]
}
```

**Analysis Approach:**
- Analyze both branches
- Create conditional effect with analyzed then/else branches
- If condition references unknown variables, create abstract precondition
- Note: Only `then` branch is included in effects (else branch represents no change from current state)

---

### IF_CO_LOCATED

**Purpose**: Conditional based on entity location matching

**Rule Operation:**
```json
{
  "type": "IF_CO_LOCATED",
  "entityA": "actor",
  "entityB": "target",
  "then": [...],
  "else": [...]
}
```

**Planning Effect:**
```json
{
  "operation": "CONDITIONAL",
  "condition": {"==": [
    {"var": "actor.location"},
    {"var": "target.location"}
  ]},
  "then": [...]
}
```

**Note**: Maps to standard conditional with location comparison

---

### FOR_EACH

**Purpose**: Iterates over collection

**Rule Operation:**
```json
{
  "type": "FOR_EACH",
  "collection": {"var": "items"},
  "variable": "item",
  "operations": [
    {"type": "ADD_COMPONENT", "entity": {"var": "item"}, "component": "test:processed"}
  ]
}
```

**Planning Approach:**
- **Conservative**: Assume 0-N iterations (no specific effects)
- **Optimistic**: If collection is determinable, generate N effects
- **Abstract**: Create abstract "for each processed" effect

**Default**: Conservative approach (no effects unless collection is static)

---

### SEQUENCE

**Purpose**: Executes operations in sequence

**Rule Operation:**
```json
{
  "type": "SEQUENCE",
  "operations": [
    {"type": "ADD_COMPONENT", ...},
    {"type": "MODIFY_COMPONENT", ...}
  ]
}
```

**Planning Effect:**
```json
[
  {"operation": "ADD_COMPONENT", ...},
  {"operation": "MODIFY_COMPONENT", ...}
]
```

**Note**: Flattens to array of effects

---

## Excluded Operations

These operations have no impact on planning and are excluded from analysis.

### Event Operations

| Operation | Purpose | Exclusion Reason |
|-----------|---------|------------------|
| `DISPATCH_EVENT` | Dispatches event | Side effect, no state change |
| `DISPATCH_PERCEPTIBLE_EVENT` | Dispatches perceptible event | Side effect, no state change |
| `DISPATCH_SPEECH` | Dispatches speech event | Side effect, no state change |
| `DISPATCH_THOUGHT` | Dispatches thought event | Side effect, no state change |

**Note**: Events may trigger other actions, but those actions plan independently.

---

### Turn Control Operations

| Operation | Purpose | Exclusion Reason |
|-----------|---------|------------------|
| `END_TURN` | Ends current turn | Execution control only |
| `REGENERATE_DESCRIPTION` | Regenerates description | UI concern only |

---

### Logging Operations

| Operation | Purpose | Exclusion Reason |
|-----------|---------|------------------|
| `LOG` | Logs message | Debugging only |

---

## Macro Resolution

Many operations reference context variables using macros (e.g., `{var: "itemId"}`). The Effects Analyzer must resolve these during analysis.

### Direct Resolution
When macro value is determinable from action context:
```json
// Rule operation
{"type": "ADD_COMPONENT", "entity": "actor", "component": {"var": "componentType"}}

// If componentType = "positioning:sitting" in action context
// Planning effect
{"operation": "ADD_COMPONENT", "entity": "actor", "component": "positioning:sitting"}
```

### Parameterized Effects
When macro value is not determinable (depends on runtime):
```json
// Rule operation
{"type": "TRANSFER_ITEM", "itemId": {"var": "selectedItem"}, ...}

// Planning effect (parameterized)
{
  "operation": "REMOVE_COMPONENT",
  "entity": "actor",
  "component": "items:in_inventory",
  "componentId": "{selectedItem}"  // Parameter placeholder
}
```

### Abstract Preconditions
When condition involves unknown runtime values:
```json
// Rule operation with unknown condition
{
  "type": "IF",
  "condition": {"var": "target.relationship.trust"},
  "then": [...]
}

// Planning effect with abstract precondition
{
  "operation": "CONDITIONAL",
  "condition": {
    "abstractPrecondition": "targetTrustsActor",
    "params": ["actor", "target"]
  },
  "then": [...]
}

// Abstract precondition definition (auto-generated)
{
  "abstractPreconditions": {
    "targetTrustsActor": {
      "description": "Checks if target trusts actor",
      "parameters": ["actor", "target"],
      "simulationFunction": "assumeTrue"
    }
  }
}
```

---

## Complete Operation List

### State-Changing (17 operations)
1. ADD_COMPONENT
2. REMOVE_COMPONENT
3. MODIFY_COMPONENT
4. ATOMIC_MODIFY_COMPONENT
5. LOCK_MOVEMENT
6. UNLOCK_MOVEMENT
7. ESTABLISH_SITTING_CLOSENESS
8. TRANSFER_ITEM
9. DROP_ITEM_AT_LOCATION
10. PICK_UP_ITEM_FROM_LOCATION
11. OPEN_CONTAINER
12. TAKE_FROM_CONTAINER
13. PUT_IN_CONTAINER
14. UNEQUIP_CLOTHING
15. DRINK_FROM
16. DRINK_ENTIRELY
17. *(Additional component-based operations as discovered)*

### Context Operations (12 operations)
1. QUERY_COMPONENT
2. QUERY_COMPONENTS
3. QUERY_ENTITIES
4. QUERY_LOOKUP
5. GET_NAME
6. GET_TIMESTAMP
7. SET_VARIABLE
8. VALIDATE_INVENTORY_CAPACITY
9. VALIDATE_CONTAINER_CAPACITY
10. HAS_COMPONENT
11. HAS_BODY_PART_WITH_COMPONENT_VALUE
12. RESOLVE_DIRECTION
13. MATH

### Control Flow (4 operations)
1. IF
2. IF_CO_LOCATED
3. FOR_EACH
4. SEQUENCE

### Excluded (6 operations)
1. DISPATCH_EVENT
2. DISPATCH_PERCEPTIBLE_EVENT
3. DISPATCH_SPEECH
4. DISPATCH_THOUGHT
5. END_TURN
6. REGENERATE_DESCRIPTION
7. LOG

**Total: 39+ operations categorized**

---

## Usage Examples

### Example 1: Simple Sit Down Action

**Rule Operations:**
```json
{
  "operations": [
    {
      "type": "REMOVE_COMPONENT",
      "entity": "actor",
      "component": "positioning:standing"
    },
    {
      "type": "ADD_COMPONENT",
      "entity": "actor",
      "component": "positioning:sitting"
    }
  ]
}
```

**Generated Planning Effects:**
```json
{
  "effects": [
    {
      "operation": "REMOVE_COMPONENT",
      "entity": "actor",
      "component": "positioning:standing"
    },
    {
      "operation": "ADD_COMPONENT",
      "entity": "actor",
      "component": "positioning:sitting"
    }
  ],
  "cost": 1.0
}
```

---

### Example 2: Conditional Give Item

**Rule Operations:**
```json
{
  "operations": [
    {
      "type": "IF",
      "condition": {
        "==": [{"var": "targetInventorySpace"}, true]
      },
      "then": [
        {
          "type": "TRANSFER_ITEM",
          "itemId": {"var": "selectedItem"},
          "fromEntity": "actor",
          "toEntity": "target"
        }
      ]
    }
  ]
}
```

**Generated Planning Effects:**
```json
{
  "effects": [
    {
      "operation": "CONDITIONAL",
      "condition": {
        "abstractPrecondition": "targetHasInventorySpace",
        "params": ["target"]
      },
      "then": [
        {
          "operation": "REMOVE_COMPONENT",
          "entity": "actor",
          "component": "items:in_inventory",
          "componentId": "{selectedItem}"
        },
        {
          "operation": "ADD_COMPONENT",
          "entity": "target",
          "component": "items:in_inventory",
          "componentId": "{selectedItem}"
        }
      ]
    }
  ],
  "abstractPreconditions": {
    "targetHasInventorySpace": {
      "description": "Checks if target has inventory space",
      "parameters": ["target"],
      "simulationFunction": "assumeTrue"
    }
  },
  "cost": 1.0
}
```

---

## Implementation Notes

### For Effects Analyzer Implementation

1. **Operation Registry**: Create registry mapping operation types to analyzer functions
2. **Recursive Analysis**: Handle nested operations (IF, SEQUENCE, etc.) recursively
3. **Macro Resolution**: Build macro resolution context from action parameters
4. **Abstract Detection**: Detect when conditions reference unknown runtime values
5. **Effect Deduplication**: Merge duplicate effects from multiple paths
6. **Validation**: Validate generated effects against planning-effects schema

### For Effects Generator Implementation

1. **Schema Compliance**: Ensure all generated effects match schema structure
2. **Cost Estimation**: Calculate default cost based on effect complexity
3. **Precondition Extraction**: Auto-name and document abstract preconditions
4. **Effect Ordering**: Preserve operation order where it matters
5. **Documentation**: Generate human-readable descriptions of effects

---

## Future Extensions

### Planned Additional Operations

- **EQUIP_CLOTHING**: Equips clothing item
- **MOVE_TO_LOCATION**: Moves entity to location
- **ENTER_VEHICLE**: Enters vehicle
- **EXIT_VEHICLE**: Exits vehicle
- **LOCK_DOOR**: Locks door
- **UNLOCK_DOOR**: Unlocks door

### Advanced Effect Types

- **PROBABILISTIC_EFFECT**: Effects with success probability
- **DELAYED_EFFECT**: Effects that occur after delay
- **PERSISTENT_EFFECT**: Effects that require maintenance
- **REVERSIBLE_EFFECT**: Effects that auto-reverse after duration

---

## References

- [Planning Effects Schema](../../data/schemas/planning-effects.schema.json)
- [Effects Analyzer Architecture](./effects-analyzer-architecture.md)
- [Operation Handler Registry](../../src/logic/operationHandlers/)
