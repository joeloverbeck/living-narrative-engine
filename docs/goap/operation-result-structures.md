# Operation Result Structures

## Overview

Many rule operations produce result values that are stored in `result_variable` fields and used by subsequent operations. This document catalogs the structure of these result values for each operation type.

Understanding result structures is essential for:
1. **Effects Analysis**: Knowing what data operations produce
2. **Macro Resolution**: Resolving variable references correctly
3. **Abstract Precondition Generation**: Identifying when results are used in conditions
4. **Debugging**: Understanding rule execution flow

## Result Variable Pattern

Operations that produce results follow this pattern:

```json
{
  "type": "OPERATION_NAME",
  "parameters": {...},
  "result_variable": "variableName"
}
```

The result is stored in the operation context and can be accessed by later operations:

```json
{
  "type": "SOME_OPERATION",
  "field": {"var": "variableName.someField"}
}
```

## Validation Operations

### VALIDATE_INVENTORY_CAPACITY

**Purpose:** Checks if entity has inventory space for an item

**Operation:**
```json
{
  "type": "VALIDATE_INVENTORY_CAPACITY",
  "entity": "target",
  "itemId": {"var": "itemId"},
  "result_variable": "validation"
}
```

**Result Structure:**
```typescript
{
  valid: boolean,
  reason?: string
}
```

**Example Success:**
```json
{
  "valid": true
}
```

**Example Failure:**
```json
{
  "valid": false,
  "reason": "Inventory is full"
}
```

**Usage in Conditionals:**
```json
{
  "type": "IF",
  "condition": {"==": [{"var": "validation.valid"}, true]},
  "then": [...]
}
```

---

### VALIDATE_CONTAINER_CAPACITY

**Purpose:** Checks if container has space for an item

**Operation:**
```json
{
  "type": "VALIDATE_CONTAINER_CAPACITY",
  "containerId": {"var": "containerId"},
  "itemId": {"var": "itemId"},
  "result_variable": "containerValidation"
}
```

**Result Structure:**
```typescript
{
  valid: boolean,
  reason?: string,
  availableSpace?: number,
  requiredSpace?: number
}
```

**Example Success:**
```json
{
  "valid": true,
  "availableSpace": 5,
  "requiredSpace": 1
}
```

**Example Failure:**
```json
{
  "valid": false,
  "reason": "Container is full",
  "availableSpace": 0,
  "requiredSpace": 1
}
```

---

## Query Operations

### QUERY_COMPONENT

**Purpose:** Retrieves component data from an entity

**Operation:**
```json
{
  "type": "QUERY_COMPONENT",
  "entity": "target",
  "component": "core:inventory",
  "result_variable": "targetInventory"
}
```

**Result Structure:**
```typescript
{
  // Component data structure (varies by component)
  // For core:inventory:
  itemCount?: number,
  capacity?: number,
  weight?: number,
  maxWeight?: number
}
```

**Example:**
```json
{
  "itemCount": 3,
  "capacity": 10,
  "weight": 5.5,
  "maxWeight": 20
}
```

**Usage:**
```json
{
  "type": "IF",
  "condition": {"<": [{"var": "targetInventory.itemCount"}, {"var": "targetInventory.capacity"}]},
  "then": [...]
}
```

---

### QUERY_COMPONENTS

**Purpose:** Retrieves multiple components from an entity

**Operation:**
```json
{
  "type": "QUERY_COMPONENTS",
  "entity": "actor",
  "components": ["core:inventory", "core:position"],
  "result_variable": "actorData"
}
```

**Result Structure:**
```typescript
{
  [componentId: string]: {
    // Component data
  }
}
```

**Example:**
```json
{
  "core:inventory": {
    "itemCount": 5,
    "capacity": 10
  },
  "core:position": {
    "location": "bedroom",
    "x": 10,
    "y": 20
  }
}
```

**Usage:**
```json
{
  "type": "MODIFY_COMPONENT",
  "entity": "target",
  "component": "core:position",
  "updates": {
    "location": {"var": "actorData.core:position.location"}
  }
}
```

---

### QUERY_ENTITIES

**Purpose:** Queries entities matching criteria

**Operation:**
```json
{
  "type": "QUERY_ENTITIES",
  "filter": {
    "component": "positioning:sitting",
    "location": {"var": "currentLocation"}
  },
  "result_variable": "nearbyActors"
}
```

**Result Structure:**
```typescript
{
  entities: string[],  // Array of entity IDs
  count: number
}
```

**Example:**
```json
{
  "entities": ["npc_1", "npc_2", "npc_3"],
  "count": 3
}
```

**Usage:**
```json
{
  "type": "FOR_EACH",
  "collection": {"var": "nearbyActors.entities"},
  "variable": "entity",
  "operations": [...]
}
```

---

### QUERY_LOOKUP

**Purpose:** Looks up entity by property

**Operation:**
```json
{
  "type": "QUERY_LOOKUP",
  "property": "name",
  "value": "John",
  "result_variable": "foundEntity"
}
```

**Result Structure:**
```typescript
{
  entityId: string | null,
  found: boolean
}
```

**Example Found:**
```json
{
  "entityId": "npc_1",
  "found": true
}
```

**Example Not Found:**
```json
{
  "entityId": null,
  "found": false
}
```

---

## Component Check Operations

### HAS_COMPONENT

**Purpose:** Checks if entity has a component

**Operation:**
```json
{
  "type": "HAS_COMPONENT",
  "entity": "target",
  "component": "positioning:sitting",
  "result_variable": "isSitting"
}
```

**Result Structure:**
```typescript
boolean
```

**Example:**
```json
true
```

**Usage:**
```json
{
  "type": "IF",
  "condition": {"var": "isSitting"},
  "then": [...]
}
```

---

### HAS_BODY_PART_WITH_COMPONENT_VALUE

**Purpose:** Checks if entity has body part with specific component value

**Operation:**
```json
{
  "type": "HAS_BODY_PART_WITH_COMPONENT_VALUE",
  "entity": "actor",
  "component": "anatomy:hand",
  "field": "isFree",
  "value": true,
  "result_variable": "hasFreeHand"
}
```

**Result Structure:**
```typescript
boolean
```

**Example:**
```json
true
```

---

## Container Operations

### OPEN_CONTAINER

**Purpose:** Opens a container

**Operation:**
```json
{
  "type": "OPEN_CONTAINER",
  "entity": "target",
  "result_variable": "openResult"
}
```

**Result Structure:**
```typescript
{
  success: boolean,
  error?: string
}
```

**Example Success:**
```json
{
  "success": true
}
```

**Example Failure:**
```json
{
  "success": false,
  "error": "Container is locked"
}
```

---

## Calculation Operations

### MATH

**Purpose:** Performs mathematical calculation

**Operation:**
```json
{
  "type": "MATH",
  "expression": {
    "+": [{"var": "currentValue"}, 10]
  },
  "result_variable": "newValue"
}
```

**Result Structure:**
```typescript
number
```

**Example:**
```json
15
```

**Usage:**
```json
{
  "type": "MODIFY_COMPONENT",
  "entity": "actor",
  "component": "core:stats",
  "updates": {
    "health": {"var": "newValue"}
  }
}
```

---

### RESOLVE_DIRECTION

**Purpose:** Resolves facing direction between entities

**Operation:**
```json
{
  "type": "RESOLVE_DIRECTION",
  "entity": "actor",
  "target": "target",
  "result_variable": "direction"
}
```

**Result Structure:**
```typescript
{
  direction: "facing" | "facing_away" | "behind" | "side",
  angle?: number
}
```

**Example:**
```json
{
  "direction": "facing",
  "angle": 15
}
```

---

## Utility Operations

### GET_NAME

**Purpose:** Gets display name of entity

**Operation:**
```json
{
  "type": "GET_NAME",
  "entity": "target",
  "result_variable": "targetName"
}
```

**Result Structure:**
```typescript
string
```

**Example:**
```json
"John Smith"
```

**Usage:**
```json
{
  "type": "DISPATCH_SPEECH",
  "text": {
    "cat": ["Hello, ", {"var": "targetName"}]
  }
}
```

---

### GET_TIMESTAMP

**Purpose:** Gets current timestamp

**Operation:**
```json
{
  "type": "GET_TIMESTAMP",
  "result_variable": "timestamp"
}
```

**Result Structure:**
```typescript
number  // Unix timestamp in milliseconds
```

**Example:**
```json
1640000000000
```

---

## Atomic Operations

### ATOMIC_MODIFY_COMPONENT

**Purpose:** Atomically modifies component data

**Operation:**
```json
{
  "type": "ATOMIC_MODIFY_COMPONENT",
  "entity": "actor",
  "component": "core:inventory",
  "updates": {"itemCount": 5},
  "result_variable": "modifyResult"
}
```

**Result Structure:**
```typescript
boolean  // Success/failure
```

**Example Success:**
```json
true
```

**Example Failure:**
```json
false
```

**Usage:**
```json
{
  "type": "IF",
  "condition": {"var": "modifyResult"},
  "then": [...],
  "else": [...]
}
```

---

## Complex Result Structures

### Multi-Stage Operations

Some operations build on results from previous operations:

```json
{
  "actions": [
    {
      "type": "QUERY_COMPONENT",
      "entity": "target",
      "component": "core:inventory",
      "result_variable": "inventory"
    },
    {
      "type": "MATH",
      "expression": {
        "-": [{"var": "inventory.capacity"}, {"var": "inventory.itemCount"}]
      },
      "result_variable": "availableSpace"
    },
    {
      "type": "IF",
      "condition": {">": [{"var": "availableSpace"}, 0]},
      "then": [...]
    }
  ]
}
```

**Data Flow:**
1. `QUERY_COMPONENT` produces `inventory` object
2. `MATH` uses `inventory` fields to calculate `availableSpace`
3. `IF` uses `availableSpace` in condition

### Nested Structures

Query operations can return nested structures:

```json
{
  "type": "QUERY_COMPONENT",
  "entity": "actor",
  "component": "relationships:connections",
  "result_variable": "relationships"
}
```

**Result:**
```json
{
  "friends": [
    {"entityId": "npc_1", "trust": 0.8},
    {"entityId": "npc_2", "trust": 0.6}
  ],
  "enemies": [
    {"entityId": "npc_3", "hostility": 0.9}
  ]
}
```

**Usage:**
```json
{
  "type": "FOR_EACH",
  "collection": {"var": "relationships.friends"},
  "variable": "friend",
  "operations": [
    {
      "type": "IF",
      "condition": {">": [{"var": "friend.trust"}, 0.7]},
      "then": [...]
    }
  ]
}
```

## Best Practices

### 1. Consistent Naming

Use descriptive, consistent names for result variables:

✓ **Good:**
- `validation`
- `targetInventory`
- `availableSpace`

✗ **Bad:**
- `r1`
- `temp`
- `x`

### 2. Error Handling

Always check success/validity before using results:

```json
{
  "type": "VALIDATE_INVENTORY_CAPACITY",
  "entity": "target",
  "result_variable": "validation"
}
{
  "type": "IF",
  "condition": {"==": [{"var": "validation.valid"}, true]},
  "then": [
    // Use result
  ],
  "else": [
    // Handle failure
  ]
}
```

### 3. Clear Data Flow

Keep data flow simple and traceable:

✓ **Good:**
```json
[
  {"type": "QUERY_COMPONENT", "result_variable": "inv"},
  {"type": "IF", "condition": {"<": [{"var": "inv.itemCount"}, 10]}}
]
```

✗ **Bad:**
```json
[
  {"type": "QUERY_COMPONENT", "result_variable": "a"},
  {"type": "MATH", "expression": {"var": "a.x"}, "result_variable": "b"},
  {"type": "MATH", "expression": {"var": "b"}, "result_variable": "c"},
  {"type": "IF", "condition": {"var": "c"}}
]
```

### 4. Document Complex Structures

For complex result structures, add comments in rules:

```json
{
  "type": "QUERY_COMPONENT",
  "entity": "actor",
  "component": "complex:data",
  "result_variable": "complexData",
  "_comment": "Result structure: { field1: number, nested: { field2: string } }"
}
```

## Troubleshooting

### Undefined Variable Errors

**Symptom:** `Cannot read property 'X' of undefined`

**Causes:**
1. Result variable not set before use
2. Operation failed and didn't set result
3. Typo in variable name

**Solution:**
1. Ensure operation runs before variable is used
2. Check operation success before accessing result
3. Verify variable name matches exactly

### Type Mismatch Errors

**Symptom:** Unexpected behavior or type errors

**Causes:**
1. Assuming wrong result structure
2. Missing field in result
3. Incorrect type conversion

**Solution:**
1. Check operation result structure documentation
2. Add defensive checks for optional fields
3. Use explicit type conversions

### Null/Undefined Results

**Symptom:** Operations return `null` or `undefined`

**Causes:**
1. Entity/component not found
2. Query returned no results
3. Operation failed silently

**Solution:**
1. Check entity/component exists before querying
2. Handle empty query results
3. Add error logging to operations

## Related Documentation

- [Operation Mapping](./operation-mapping.md)
- [Macro Resolution](./macro-resolution.md)
- [Effects Auto-Generation](./effects-auto-generation.md)
- [Troubleshooting](./troubleshooting.md)
