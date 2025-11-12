# Operation Result Structures

## Overview

Operations in the rule execution system can produce result values that are stored in `result_variable` fields and used by subsequent operations. This document catalogs the structure of these result values for each operation type.

**Important Context**: These result structures are used during **rule execution**, not during GOAP planning. The GOAP system analyzes operations to extract `planningEffects`, which is a different structure used for simulating action outcomes during decision-making.

Understanding result structures is essential for:
1. **Rule Development**: Chaining operations that depend on previous results
2. **Debugging**: Understanding rule execution flow
3. **Effects Analysis**: The GOAP EffectsAnalyzer uses these operations to generate planning effects

## Result Variable Pattern

Operations that produce results follow this pattern:

```json
{
  "type": "OPERATION_NAME",
  "parameters": {
    "result_variable": "variableName",
    ...
  }
}
```

The result is stored in the execution context and can be accessed by later operations using JSON Logic:

```json
{
  "type": "IF",
  "parameters": {
    "condition": {"var": "variableName.someField"},
    "then_actions": [...]
  }
}
```

## Validation Operations

### VALIDATE_INVENTORY_CAPACITY

**Purpose:** Checks if entity has inventory space for an item

**Result Structure:**
```typescript
{
  valid: boolean,
  reason?: string  // Present only when valid is false
}
```

**Example:**
```json
// Success
{"valid": true}

// Failure
{"valid": false, "reason": "max_weight_exceeded"}
```

**Common Reasons:**
- `"validation_failed"` - Invalid parameters
- `"no_inventory"` - Entity has no inventory component
- `"no_weight"` - Item has no weight component
- `"max_items_exceeded"` - Inventory item count limit reached
- `"max_weight_exceeded"` - Inventory weight limit exceeded

---

### VALIDATE_CONTAINER_CAPACITY

**Purpose:** Checks if container has space for an item

**Result Structure:**
```typescript
{
  valid: boolean,
  reason?: string  // Present only when valid is false
}
```

**Common Reasons:**
- `"no_container"` - Entity has no container component
- `"container_closed"` - Container must be opened first
- `"no_capacity_defined"` - Container has no capacity limits
- `"no_weight"` - Item has no weight component
- `"max_items_exceeded"` - Container item count limit reached
- `"max_weight_exceeded"` - Container weight limit exceeded

---

## Query Operations

### QUERY_COMPONENT

**Purpose:** Retrieves component data from an entity

**Result Structure:**
```typescript
// Returns the component data directly (structure varies by component)
// For core:inventory:
{
  items: string[],      // Array of item entity IDs
  capacity: {
    maxItems: number,
    maxWeight: number
  }
}

// For core:position:
{
  locationId: string,
  x?: number,
  y?: number
}

// Returns undefined if component not found (or missing_value parameter if specified)
```

---

### QUERY_COMPONENTS

**Purpose:** Retrieves multiple components from an entity

**Result Structure:**
```typescript
{
  [componentId: string]: ComponentData | undefined
}
```

**Example:**
```json
{
  "core:inventory": {
    "items": ["item_1"],
    "capacity": {"maxItems": 10, "maxWeight": 20}
  },
  "core:position": {
    "locationId": "bedroom"
  }
}
```

---

### QUERY_ENTITIES

**Purpose:** Queries entities matching criteria

**Result Structure:**
```typescript
string[]  // Array of entity IDs
```

**Example:**
```json
["npc_1", "npc_2", "npc_3"]
```

---

### QUERY_LOOKUP

**Purpose:** Looks up entity by property

**Result Structure:**
```typescript
{
  entityId: string | null,
  found: boolean
}
```

---

## Component Check Operations

### HAS_COMPONENT

**Purpose:** Checks if entity has a component

**Result Structure:**
```typescript
boolean
```

---

### HAS_BODY_PART_WITH_COMPONENT_VALUE

**Purpose:** Checks if entity has body part with specific component value

**Result Structure:**
```typescript
boolean
```

---

## Container Operations

### OPEN_CONTAINER

**Purpose:** Opens a container

**Result Structure:**
```typescript
{
  success: boolean,
  error?: string,      // Present when success is false
  contents?: string[]  // Array of item IDs in container (present when success is true)
}
```

**Common Errors:**
- `"invalid_parameters"` - Invalid operation parameters
- `"container_not_openable"` - Entity cannot be opened
- `"container_missing_component"` - No container component
- `"already_open"` - Container is already open
- `"missing_key"` - Required key not in actor's inventory

---

## Calculation Operations

### MATH

**Purpose:** Performs mathematical calculation

**Result Structure:**
```typescript
number | null  // Returns null if expression cannot be evaluated
```

**Example:**
```json
15  // Result of successful calculation
null  // Result when evaluation fails (invalid operators, NaN, etc.)
```

---

### RESOLVE_DIRECTION

**Purpose:** Resolves a direction string to a target location ID

**Result Structure:**
```typescript
string | null  // Target location ID, or null if direction not found
```

**Example:**
```json
"tavern_main_room"  // Target location for direction "north"
null  // When no exit exists for the specified direction
```

**Note:** This operation queries the `movement:exits` component on a location entity to find the target of a directional exit (e.g., "north", "south"). It does NOT determine facing direction between entities.

---

## Utility Operations

### GET_NAME

**Purpose:** Gets display name of entity

**Result Structure:**
```typescript
string  // Entity name from core:name component, or fallback value
```

---

### GET_TIMESTAMP

**Purpose:** Gets current timestamp

**Result Structure:**
```typescript
number  // Unix timestamp in milliseconds
```

---

## Atomic Operations

### ATOMIC_MODIFY_COMPONENT

**Purpose:** Atomically modifies component data with check-and-set

**Result Structure:**
```typescript
boolean  // true if modification succeeded, false if check failed
```

---

## Best Practices

### 1. Always Check Success/Validity

For operations that return success/validity status, always check before proceeding:

```json
{
  "type": "VALIDATE_INVENTORY_CAPACITY",
  "parameters": {
    "targetEntity": "target",
    "itemEntity": {"var": "itemId"},
    "result_variable": "validation"
  }
},
{
  "type": "IF",
  "parameters": {
    "condition": {"==": [{"var": "validation.valid"}, true]},
    "then_actions": [/* proceed */],
    "else_actions": [/* handle failure */]
  }
}
```

### 2. Handle Missing Data

Operations like `QUERY_COMPONENT` may return `undefined`. Use the `missing_value` parameter to provide fallbacks:

```json
{
  "type": "QUERY_COMPONENT",
  "parameters": {
    "entity_ref": "actor",
    "component_type": "core:inventory",
    "result_variable": "inventory",
    "missing_value": {"items": [], "capacity": {"maxItems": 0, "maxWeight": 0}}
  }
}
```

### 3. Clear Variable Names

Use descriptive names that indicate what the variable contains:

✓ Good: `"targetInventory"`, `"validation"`, `"availableActors"`
✗ Bad: `"r1"`, `"temp"`, `"x"`

### 4. Minimize Data Flow Complexity

Keep operation chains simple and traceable. Avoid deeply nested variable references.

---

## Troubleshooting

### Undefined Variable Errors

**Symptom:** `Cannot read property 'X' of undefined`

**Causes & Solutions:**
1. Result variable not set before use → Ensure operation runs before variable is referenced
2. Operation failed and didn't set result → Check operation success/validity before accessing result
3. Typo in variable name → Verify variable name matches exactly

### Type Mismatch Errors

**Symptom:** Unexpected behavior or type errors

**Solutions:**
1. Verify result structure matches this documentation
2. Add defensive checks for optional fields
3. Use explicit type conversions when needed

### Null/Undefined Results

**Symptom:** Operations return `null` or `undefined`

**Solutions:**
1. Check entity/component exists before querying
2. Handle empty query results (e.g., `QUERY_ENTITIES` returning `[]`)
3. Use `missing_value` parameters for fallback values

---

## Related Documentation

- [Effects Analyzer](../src/goap/analysis/effectsAnalyzer.js) - Converts operations to planning effects
- [Operation Handlers](../src/logic/operationHandlers/) - Handler implementations
- [Operation Schemas](../data/schemas/operations/) - JSON schema definitions
