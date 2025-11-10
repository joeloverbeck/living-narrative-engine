# Macro Resolution Guide

## Overview

Macros are placeholders in rule operations that reference runtime values. The effects analyzer must resolve these macros during analysis to generate accurate planning effects. This guide explains how macros work, how they're resolved, and how to handle unresolvable macros.

## What Are Macros?

Macros are JSON objects that serve as placeholders for values that may not be known when the rule is authored:

```json
{
  "var": "variableName"
}
```

Instead of hardcoding a value, macros allow rules to be flexible and data-driven.

## Macro Types

### 1. Variable References (`var`)

**Purpose:** References a variable in the operation context

**Syntax:**
```json
{"var": "variableName"}
```

**Example:**
```json
{
  "type": "ADD_COMPONENT",
  "entity": "actor",
  "component": {"var": "componentType"}
}
```

**Resolution Sources:**
- Action parameters
- Previous operation results (via `result_variable`)
- Context variables set by `SET_VARIABLE`

---

### 2. Parameter References (`param`)

**Purpose:** References an action parameter

**Syntax:**
```json
{"param": "parameterName"}
```

**Example:**
```json
{
  "type": "MODIFY_COMPONENT",
  "entity": "actor",
  "component": "core:position",
  "updates": {
    "location": {"param": "targetLocation"}
  }
}
```

**Resolution Source:** Action definition's `parameters` field

---

### 3. Lookup References (`lookup`)

**Purpose:** Looks up a value from world state

**Syntax:**
```json
{
  "lookup": {
    "entity": "actor",
    "field": "location"
  }
}
```

**Example:**
```json
{
  "type": "SET_VARIABLE",
  "name": "actorLocation",
  "value": {
    "lookup": {
      "entity": "actor",
      "field": "location"
    }
  }
}
```

**Resolution:** Requires world state access (may be unresolvable during analysis)

---

### 4. JSON Logic Expressions

**Purpose:** Computes values using JSON Logic

**Syntax:**
```json
{
  "+": [{"var": "count"}, 1]
}
```

**Example:**
```json
{
  "type": "MODIFY_COMPONENT",
  "entity": "actor",
  "component": "core:stats",
  "updates": {
    "score": {
      "+": [{"var": "currentScore"}, 10]
    }
  }
}
```

**Resolution:** Evaluated using JSON Logic engine if all referenced variables are resolved

---

## Macro Resolution Process

### Step 1: Build Resolution Context

The analyzer builds a context containing all available values:

```javascript
{
  // Action parameters
  parameters: {
    targetComponent: "positioning:sitting",
    targetLocation: "bedroom"
  },

  // Previous operation results
  variables: {
    validation: { valid: true },
    currentLocation: "livingroom"
  },

  // Entity data (if available)
  entities: {
    actor: { location: "bedroom", name: "John" }
  }
}
```

### Step 2: Attempt Resolution

For each macro, the analyzer attempts to resolve it:

```javascript
// Macro
{"var": "targetComponent"}

// Resolution attempt
context.parameters.targetComponent → "positioning:sitting"

// Result
"positioning:sitting"  // Resolved!
```

### Step 3: Handle Unresolvable Macros

If resolution fails, the analyzer marks the macro for parameterization:

```javascript
// Macro
{"var": "selectedItem"}

// Resolution attempt
context.parameters.selectedItem → undefined
context.variables.selectedItem → undefined

// Result
"{selectedItem}"  // Parameterized
```

## Resolvable vs. Unresolvable Macros

### Resolvable Macros

Macros that can be resolved during analysis:

**1. Static Action Parameters:**
```json
// Action definition
{
  "parameters": {
    "componentType": "positioning:sitting"
  }
}

// Rule operation
{"var": "componentType"}

// Resolved to
"positioning:sitting"
```

**2. Set Variables:**
```json
// Previous operation
{
  "type": "SET_VARIABLE",
  "name": "location",
  "value": "bedroom"
}

// Later operation
{"var": "location"}

// Resolved to
"bedroom"
```

**3. Operation Results (Sometimes):**
```json
// Previous operation
{
  "type": "GET_NAME",
  "entity": "actor",
  "result_variable": "actorName"
}

// Later operation
{"var": "actorName"}

// May resolve to
"John"  // If entity data is available during analysis
```

### Unresolvable Macros

Macros that cannot be resolved during analysis:

**1. Runtime-Dependent Variables:**
```json
// Selected by player at runtime
{"var": "selectedItem"}

// Cannot resolve - depends on player choice
// Parameterized as: "{selectedItem}"
```

**2. Dynamic Query Results:**
```json
// Previous operation
{
  "type": "QUERY_COMPONENT",
  "entity": "target",
  "component": "core:inventory",
  "result_variable": "inventory"
}

// Later operation
{"var": "inventory.itemCount"}

// Cannot resolve - target inventory unknown at analysis time
// Parameterized as: "{inventory.itemCount}"
```

**3. Computed Values:**
```json
{
  "+": [{"var": "dynamicValue"}, 10]
}

// If dynamicValue is unresolvable, entire expression is unresolvable
// Parameterized as: "{dynamicValue + 10}"
```

## Common Macros in Rules

### Component Type Selection

```json
{
  "type": "ADD_COMPONENT",
  "entity": "actor",
  "component": {"var": "componentType"}
}
```

**Typical Resolution:**
- Action parameter: `componentType = "positioning:sitting"`
- Resolved effect: `component: "positioning:sitting"`

---

### Entity References

```json
{
  "type": "MODIFY_COMPONENT",
  "entity": {"var": "targetEntity"},
  "component": "core:position"
}
```

**Typical Resolution:**
- Action parameter: `targetEntity = "target"`
- Resolved effect: `entity: "target"`

---

### Item IDs

```json
{
  "type": "TRANSFER_ITEM",
  "itemId": {"var": "itemId"},
  "fromEntity": "actor",
  "toEntity": "target"
}
```

**Typical Resolution:**
- Usually unresolvable (player-selected item)
- Parameterized effect: `componentId: "{itemId}"`

---

### Location Updates

```json
{
  "type": "MODIFY_COMPONENT",
  "entity": "actor",
  "component": "core:position",
  "updates": {
    "location": {"var": "newLocation"}
  }
}
```

**Typical Resolution:**
- If `newLocation` is set by previous operation: Resolved
- If `newLocation` is dynamic: Parameterized as `"{newLocation}"`

---

## Macro Resolution in Conditionals

Conditionals present special challenges for macro resolution:

### Resolvable Condition

```json
{
  "type": "IF",
  "condition": {
    "==": [{"var": "targetType"}, "actor"]
  },
  "then": [...]
}
```

**Resolution:**
- If `targetType` is in context: Evaluate condition
- Result: `true` or `false`
- **Effect:** Only include executed branch in effects

### Unresolvable Condition

```json
{
  "type": "IF",
  "condition": {
    ">": [{"var": "target.trust"}, 0.5]
  },
  "then": [...]
}
```

**Resolution:**
- `target.trust` is runtime-dependent
- Cannot evaluate condition
- **Effect:** Create conditional effect with abstract precondition

```json
{
  "operation": "CONDITIONAL",
  "condition": {
    "abstractPrecondition": "targetTrustAbove50",
    "params": ["target"]
  },
  "then": [...]
}
```

## Parameterized Effects

When macros cannot be resolved, effects use parameterized placeholders:

### Parameter Syntax

Unresolved macros are converted to parameters:

```
{"var": "itemId"} → "{itemId}"
```

### Example: Parameterized Item Transfer

**Rule Operation:**
```json
{
  "type": "TRANSFER_ITEM",
  "itemId": {"var": "selectedItem"},
  "fromEntity": "actor",
  "toEntity": "target"
}
```

**Generated Effects:**
```json
[
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
```

### Parameter Binding

At planning time, the planner binds parameters:

```javascript
// Planning time
const selectedItem = "sword_1";
const effects = bindParameters(planningEffects, { selectedItem });

// Result
[
  {
    "operation": "REMOVE_COMPONENT",
    "entity": "actor",
    "component": "items:in_inventory",
    "componentId": "sword_1"
  },
  ...
]
```

## Impact on Effects Generation

### Macro Resolution Determines Effect Specificity

**Fully Resolved:**
```json
{
  "operation": "ADD_COMPONENT",
  "entity": "actor",
  "component": "positioning:sitting"
}
```
- Effect is specific and concrete
- Planner knows exactly what will happen

**Partially Resolved:**
```json
{
  "operation": "ADD_COMPONENT",
  "entity": "actor",
  "component": "{componentType}"
}
```
- Effect is parameterized
- Planner needs to bind parameter

**Unresolvable Condition:**
```json
{
  "operation": "CONDITIONAL",
  "condition": {
    "abstractPrecondition": "checkSomething",
    "params": ["actor"]
  },
  "then": [...]
}
```
- Effect is conditional
- Planner must simulate or defer evaluation

## Troubleshooting Macro Resolution

### Macro Not Resolved

**Symptom:** Expected macro to resolve but got parameterized effect

**Causes:**
1. Variable not in context
2. Typo in variable name
3. Operation producing variable not run before usage

**Solution:**
1. Check variable is set before use
2. Verify variable name matches exactly (case-sensitive)
3. Reorder operations if needed

**Example:**
```json
// ✗ Wrong order
[
  {
    "type": "ADD_COMPONENT",
    "component": {"var": "componentType"}
  },
  {
    "type": "SET_VARIABLE",
    "name": "componentType",
    "value": "positioning:sitting"
  }
]

// ✓ Correct order
[
  {
    "type": "SET_VARIABLE",
    "name": "componentType",
    "value": "positioning:sitting"
  },
  {
    "type": "ADD_COMPONENT",
    "component": {"var": "componentType"}
  }
]
```

---

### Circular Reference

**Symptom:** Macro references itself or creates circular dependency

**Causes:**
1. Variable depends on itself
2. Circular variable chain

**Solution:**
1. Break circular dependency
2. Use intermediate variables

**Example:**
```json
// ✗ Circular
{
  "type": "SET_VARIABLE",
  "name": "x",
  "value": {"+": [{"var": "x"}, 1]}
}

// ✓ Fixed with initial value
{
  "type": "SET_VARIABLE",
  "name": "x",
  "value": 0
}
{
  "type": "SET_VARIABLE",
  "name": "x",
  "value": {"+": [{"var": "x"}, 1]}
}
```

---

### Incorrect Type After Resolution

**Symptom:** Resolved value has wrong type

**Causes:**
1. Variable contains unexpected type
2. Type conversion needed
3. Wrong variable referenced

**Solution:**
1. Check variable type
2. Add explicit type conversion
3. Verify variable name

**Example:**
```json
// Variable is string "5" but number expected
{
  "type": "MODIFY_COMPONENT",
  "updates": {
    "count": {"var": "count"}  // String "5" instead of number 5
  }
}

// Fix with type conversion
{
  "type": "SET_VARIABLE",
  "name": "countNumber",
  "value": {
    "*": [{"var": "count"}, 1]  // Converts to number
  }
}
```

---

## Best Practices

### 1. Use Descriptive Variable Names

```json
// ✓ Good
{"var": "targetComponent"}
{"var": "selectedItemId"}
{"var": "newLocation"}

// ✗ Bad
{"var": "x"}
{"var": "temp"}
{"var": "v1"}
```

### 2. Set Variables Early

```json
// ✓ Good - Set all variables at the start
[
  {"type": "SET_VARIABLE", "name": "componentType", "value": "..."},
  {"type": "SET_VARIABLE", "name": "location", "value": "..."},
  {"type": "ADD_COMPONENT", "component": {"var": "componentType"}},
  {"type": "MODIFY_COMPONENT", "updates": {"location": {"var": "location"}}}
]
```

### 3. Check Variable Existence

```json
// ✓ Good - Check before using
{
  "type": "IF",
  "condition": {"!!": [{"var": "optionalValue"}]},
  "then": [
    {"type": "USE_VALUE", "value": {"var": "optionalValue"}}
  ]
}
```

### 4. Document Unresolvable Macros

```json
{
  "type": "TRANSFER_ITEM",
  "itemId": {"var": "selectedItem"},
  "_comment": "selectedItem is determined by player at runtime, will be parameterized in effects"
}
```

### 5. Use Action Parameters for Static Values

```json
// ✓ Good - Use action parameter
{
  "id": "test:action",
  "parameters": {
    "componentType": "positioning:sitting"
  }
}

// In rule
{"var": "componentType"}  // Will resolve to "positioning:sitting"

// ✗ Bad - Hardcode in rule
"positioning:sitting"  // Less flexible
```

## Advanced Macro Patterns

### Nested Resolution

```json
{
  "type": "SET_VARIABLE",
  "name": "location",
  "value": {"var": "targetLocation"}
}
{
  "type": "MODIFY_COMPONENT",
  "updates": {
    "location": {"var": "location"}
  }
}
```

**Resolution:**
1. Resolve `targetLocation` to `"bedroom"`
2. Resolve `location` to `"bedroom"`
3. Final effect: `"location": "bedroom"`

### Conditional Resolution

```json
{
  "type": "SET_VARIABLE",
  "name": "componentType",
  "value": {
    "if": [
      {"var": "isSitting"},
      "positioning:sitting",
      "positioning:standing"
    ]
  }
}
```

**Resolution:**
- If `isSitting` is resolvable: Resolve to concrete value
- If `isSitting` is not resolvable: Parameterize entire expression

### Lookup Chain

```json
{
  "type": "SET_VARIABLE",
  "name": "actorLocation",
  "value": {"lookup": {"entity": "actor", "field": "location"}}
}
{
  "type": "QUERY_ENTITIES",
  "filter": {
    "location": {"var": "actorLocation"}
  }
}
```

## Related Documentation

- [Effects Auto-Generation](./effects-auto-generation.md)
- [Operation Result Structures](./operation-result-structures.md)
- [Abstract Preconditions](./abstract-preconditions.md)
- [Troubleshooting](./troubleshooting.md)
