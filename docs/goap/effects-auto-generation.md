# Effects Auto-Generation Guide

## Overview

The effects auto-generation system is a core feature of GOAP Tier 1 that automatically creates planning metadata from action rules. This eliminates the need for manual effect authoring, ensures consistency between execution code and planning metadata, and reduces maintenance burden.

## Table of Contents

1. [How It Works](#how-it-works)
2. [Operation Mapping](#operation-mapping)
3. [Data Flow Analysis](#data-flow-analysis)
4. [Path Tracing](#path-tracing)
5. [Macro Resolution](#macro-resolution)
6. [Abstract Preconditions](#abstract-preconditions)
7. [Hypothetical Data](#hypothetical-data)
8. [Running the Generator](#running-the-generator)
9. [Validation](#validation)
10. [Troubleshooting](#troubleshooting)
11. [Manual Overrides](#manual-overrides)

## How It Works

The effects auto-generation system analyzes rule operations to extract planning effects. The process follows these steps:

### Step 1: Load Action and Rule

```javascript
// Action definition
{
  "id": "positioning:sit_down",
  "name": "Sit down",
  "targets": "positioning:available_furniture"
}

// Associated rule (positioning:handle_sit_down)
{
  "id": "positioning:handle_sit_down",
  "event": { "type": "ACTION_DECIDED" },
  "actions": [
    { "type": "REMOVE_COMPONENT", "entity": "actor", "component": "positioning:standing" },
    { "type": "ADD_COMPONENT", "entity": "actor", "component": "positioning:sitting" }
  ]
}
```

### Step 2: Analyze Operations

The analyzer examines each operation in the rule:

1. **Identify State-Changing Operations**: Operations that modify world state
2. **Skip Non-State Operations**: Events, logging, queries
3. **Trace Conditionals**: Follow IF/THEN/ELSE branches
4. **Resolve Macros**: Replace variable references with concrete values

### Step 3: Generate Planning Effects

```javascript
// Generated planning effects
{
  "planningEffects": {
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
    "cost": 1.2
  }
}
```

### Step 4: Validate and Inject

The generated effects are validated against the schema and injected into the action definition.

## Operation Mapping

The generator maps rule operations to planning effects using a comprehensive operation registry. See [operation-mapping.md](./operation-mapping.md) for the complete mapping table.

### State-Changing Operations

These operations generate planning effects:

**Component Operations:**
- `ADD_COMPONENT` → Direct mapping
- `REMOVE_COMPONENT` → Direct mapping
- `MODIFY_COMPONENT` → Direct mapping
- `ATOMIC_MODIFY_COMPONENT` → Maps to `MODIFY_COMPONENT`

**Component-Based Operations:**
- `LOCK_MOVEMENT` → `ADD_COMPONENT` (positioning:movement_locked)
- `UNLOCK_MOVEMENT` → `REMOVE_COMPONENT` (positioning:movement_locked)
- `ESTABLISH_SITTING_CLOSENESS` → Multiple `ADD_COMPONENT` effects

**Inventory Operations:**
- `TRANSFER_ITEM` → `REMOVE_COMPONENT` + `ADD_COMPONENT`
- `PICK_UP_ITEM_FROM_LOCATION` → `REMOVE_COMPONENT` + `ADD_COMPONENT`
- `DROP_ITEM_AT_LOCATION` → `REMOVE_COMPONENT` + `ADD_COMPONENT`

**Container Operations:**
- `OPEN_CONTAINER` → `MODIFY_COMPONENT` (isOpen: true)
- `TAKE_FROM_CONTAINER` → `REMOVE_COMPONENT` + `ADD_COMPONENT`
- `PUT_IN_CONTAINER` → `REMOVE_COMPONENT` + `ADD_COMPONENT`

### Non-State Operations

These operations are excluded from planning:

- `DISPATCH_EVENT`, `DISPATCH_PERCEPTIBLE_EVENT`, `DISPATCH_SPEECH`, `DISPATCH_THOUGHT`
- `END_TURN`, `REGENERATE_DESCRIPTION`
- `LOG`
- Query operations: `QUERY_COMPONENT`, `QUERY_ENTITIES`, etc.
- Validation operations: `VALIDATE_INVENTORY_CAPACITY`, `HAS_COMPONENT`, etc.

## Data Flow Analysis

The analyzer traces data flow through operations to understand state changes.

### Simple Linear Flow

```json
{
  "actions": [
    { "type": "SET_VARIABLE", "name": "location", "value": "bedroom" },
    { "type": "MODIFY_COMPONENT", "entity": "actor", "component": "core:position", "updates": { "location": {"var": "location"} } }
  ]
}
```

**Analysis:**
1. `SET_VARIABLE` creates context: `location = "bedroom"`
2. `MODIFY_COMPONENT` references `location` via macro
3. Macro resolver: `{"var": "location"}` → `"bedroom"`
4. Generated effect uses concrete value: `"location": "bedroom"`

### Complex Flow with Queries

```json
{
  "actions": [
    { "type": "QUERY_COMPONENT", "entity": "target", "component": "core:inventory", "result_variable": "targetInventory" },
    { "type": "IF", "condition": {"<": [{"var": "targetInventory.itemCount"}, 10]}, "then": [
      { "type": "TRANSFER_ITEM", "itemId": {"var": "itemId"}, "fromEntity": "actor", "toEntity": "target" }
    ]}
  ]
}
```

**Analysis:**
1. `QUERY_COMPONENT` produces context (not a planning effect)
2. `IF` condition references runtime data → **abstract precondition**
3. `TRANSFER_ITEM` in then branch → conditional effects
4. Generated: `CONDITIONAL` effect with abstract precondition

## Path Tracing

The generator traces all possible execution paths through conditional operations.

### Simple Conditional

```json
{
  "type": "IF",
  "condition": {"var": "hasSpace"},
  "then": [
    { "type": "ADD_COMPONENT", "entity": "actor", "component": "test:happy" }
  ],
  "else": [
    { "type": "ADD_COMPONENT", "entity": "actor", "component": "test:sad" }
  ]
}
```

**Generated Effect:**

```json
{
  "operation": "CONDITIONAL",
  "condition": {
    "abstractPrecondition": "actorHasSpace",
    "params": ["actor"]
  },
  "then": [
    { "operation": "ADD_COMPONENT", "entity": "actor", "component": "test:happy" }
  ]
}
```

**Note:** Only the `then` branch is included in effects. The `else` branch represents no change from the current state, so it's omitted.

### Nested Conditionals

```json
{
  "type": "IF",
  "condition": {"var": "isDay"},
  "then": [
    {
      "type": "IF",
      "condition": {"var": "isRaining"},
      "then": [
        { "type": "ADD_COMPONENT", "entity": "actor", "component": "test:wet" }
      ]
    }
  ]
}
```

**Generated Effect:**

```json
{
  "operation": "CONDITIONAL",
  "condition": {
    "abstractPrecondition": "isDay",
    "params": []
  },
  "then": [
    {
      "operation": "CONDITIONAL",
      "condition": {
        "abstractPrecondition": "isRaining",
        "params": []
      },
      "then": [
        { "operation": "ADD_COMPONENT", "entity": "actor", "component": "test:wet" }
      ]
    }
  ]
}
```

### Multiple Paths

When multiple paths lead to the same effect, the generator creates a single conditional with all paths:

```json
{
  "actions": [
    { "type": "IF", "condition": {"var": "pathA"}, "then": [
      { "type": "ADD_COMPONENT", "entity": "actor", "component": "test:component" }
    ]},
    { "type": "IF", "condition": {"var": "pathB"}, "then": [
      { "type": "ADD_COMPONENT", "entity": "actor", "component": "test:component" }
    ]}
  ]
}
```

**Generated Effects:**

Two conditional effects are created (one per path). The planner can choose either path to achieve the goal.

## Macro Resolution

Macros are placeholders for runtime values in rule operations. The generator resolves them when possible.

### Resolvable Macros

**Action Parameters:**

```json
// Action definition
{
  "id": "test:action",
  "parameters": {
    "targetComponent": "positioning:sitting"
  }
}

// Rule operation
{ "type": "ADD_COMPONENT", "entity": "actor", "component": {"var": "targetComponent"} }

// Resolved effect
{ "operation": "ADD_COMPONENT", "entity": "actor", "component": "positioning:sitting" }
```

**Context Variables:**

```json
// Rule operations
{ "type": "SET_VARIABLE", "name": "location", "value": "bedroom" }
{ "type": "MODIFY_COMPONENT", "entity": "actor", "component": "core:position", "updates": {"location": {"var": "location"}} }

// Resolved effect
{ "operation": "MODIFY_COMPONENT", "entity": "actor", "component": "core:position", "updates": {"location": "bedroom"} }
```

### Unresolvable Macros

When a macro references runtime-only data, it's parameterized:

```json
// Rule operation
{ "type": "TRANSFER_ITEM", "itemId": {"var": "selectedItem"}, "fromEntity": "actor", "toEntity": "target" }

// Parameterized effect
{
  "operation": "REMOVE_COMPONENT",
  "entity": "actor",
  "component": "items:in_inventory",
  "componentId": "{selectedItem}"
}
```

The planner will bind `{selectedItem}` at runtime.

## Abstract Preconditions

Abstract preconditions represent conditions that can't be evaluated during analysis. See [abstract-preconditions.md](./abstract-preconditions.md) for the complete catalog.

### When to Create Abstract Preconditions

1. **Runtime-Dependent Conditions**: Conditions that reference world state unknown at analysis time
2. **Complex Queries**: Conditions involving queries that can't be pre-computed
3. **Dynamic Relationships**: Conditions about entity relationships that change during gameplay

### Auto-Generated Preconditions

The generator automatically creates abstract preconditions when it encounters:

1. **Unresolvable Condition Variables**:
   ```json
   { "condition": {"var": "target.relationship.trust"} }
   // → abstractPrecondition: "targetTrustsActor"
   ```

2. **Capacity Checks**:
   ```json
   { "type": "VALIDATE_INVENTORY_CAPACITY", "entity": "target" }
   // → abstractPrecondition: "targetHasInventorySpace"
   ```

3. **Component Existence Checks**:
   ```json
   { "type": "HAS_COMPONENT", "entity": "target", "component": "positioning:sitting" }
   // → abstractPrecondition: "targetHasComponent_positioning_sitting"
   ```

### Precondition Naming

The generator uses descriptive names:

- `targetHasInventorySpace` (from capacity validation)
- `targetTrustsActor` (from relationship check)
- `actorIsStanding` (from component check)
- `locationIsAccessible` (from location check)

### Simulation Functions

Each abstract precondition includes a simulation function:

- `assumeTrue`: Optimistic planning (default)
- `assumeFalse`: Pessimistic planning
- `assumeRandom`: Probabilistic planning
- `evaluateAtRuntime`: Defer to runtime

## Hypothetical Data

When operations produce data used by later operations, the generator tracks it as hypothetical data.

### Example: Query Result Used in Condition

```json
{
  "actions": [
    { "type": "QUERY_COMPONENT", "entity": "target", "component": "core:inventory", "result_variable": "inv" },
    { "type": "IF", "condition": {"<": [{"var": "inv.itemCount"}, 10]}, "then": [
      { "type": "ADD_COMPONENT", "entity": "target", "component": "items:inventory_item" }
    ]}
  ]
}
```

**Analysis:**
1. `QUERY_COMPONENT` produces hypothetical `inv` data
2. Condition references `inv.itemCount` (hypothetical)
3. Generator creates abstract precondition: `targetHasLessThan10Items`
4. Effect is conditional on abstract precondition

## Running the Generator

### Generate for Single Action

```bash
npm run generate:effects -- --action=positioning:sit_down
```

### Generate for Mod

```bash
npm run generate:effects -- --mod=positioning
```

### Generate for All Mods

```bash
npm run generate:effects
```

### Programmatic Usage

```javascript
import { goapTokens } from './dependencyInjection/tokens/tokens-goap.js';

const effectsGenerator = container.resolve(goapTokens.IEffectsGenerator);

// Generate for single action
const effects = effectsGenerator.generateForAction('positioning:sit_down');

// Generate for mod
const effectsMap = effectsGenerator.generateForMod('positioning');

// Inject into action definitions
effectsGenerator.injectEffects(effectsMap);
```

## Validation

The generator validates effects before injection.

### Schema Validation

Ensures effects match `planning-effects.schema.json`:

- All required fields present
- Types correct (string, number, object, etc.)
- Valid operation types
- Proper nesting structure

### Semantic Validation

Ensures effects make semantic sense:

- Component IDs use `modId:componentId` format
- Entity values are valid (`actor`, `target`, `tertiary_target`, or entity ID)
- Abstract preconditions have required fields
- Cost is reasonable (< 100)

### Validation Errors

Common validation errors:

```
Error: Invalid component reference: positioning_sitting
Fix: Use colon separator: positioning:sitting

Error: Missing required field 'operation' in effect
Fix: Ensure all effects have 'operation' field

Error: Invalid entity value: 'actorr'
Fix: Use valid entity value: 'actor'

Error: Abstract precondition missing 'simulationFunction'
Fix: Add simulationFunction: 'assumeTrue'
```

## Troubleshooting

See [troubleshooting.md](./troubleshooting.md) for detailed troubleshooting guide.

### Common Issues

**No Effects Generated**

**Symptom:** Generator returns `null` or empty effects

**Causes:**
1. No rule found for action
2. Rule has only non-state operations
3. Rule naming mismatch

**Solution:**
1. Verify rule exists: `{modId}:handle_{actionName}`
2. Check rule has state-changing operations
3. Ensure rule references action in conditions

---

**Effects Don't Match Rules**

**Symptom:** Validation reports mismatches

**Causes:**
1. Manual edits to action file
2. Stale generated effects
3. Rule changed after generation

**Solution:**
1. Regenerate effects
2. Check git diff for unexpected changes
3. Validate after generation

---

**Missing Operations**

**Symptom:** Expected operations not in effects

**Causes:**
1. Operation is non-state (excluded)
2. Operation in skipped branch
3. Bug in operation analyzer

**Solution:**
1. Check operation mapping table
2. Verify operation is in executed path
3. Report issue with minimal reproduction

## Manual Overrides

While auto-generation is recommended, manual overrides are supported for edge cases.

### When to Use Manual Overrides

1. **Complex Effects**: Effects too complex for auto-generation
2. **Performance Optimization**: Hand-tuned costs
3. **Special Cases**: Unusual patterns not supported by analyzer

### How to Override

1. Generate initial effects:
   ```bash
   npm run generate:effects -- --action=my_mod:my_action
   ```

2. Edit action file manually:
   ```json
   {
     "planningEffects": {
       "effects": [...],
       "cost": 2.5,
       "_manual": true
     }
   }
   ```

3. Add `_manual: true` flag to prevent regeneration

### Manual Override Best Practices

1. **Document Why**: Add comment explaining why manual override is needed
2. **Keep in Sync**: Update manually when rule changes
3. **Consider Alternatives**: Can the rule be restructured for auto-generation?
4. **Test Thoroughly**: Manually-defined effects bypass validation

### Example Manual Override

```json
{
  "id": "combat:complex_attack",
  "planningEffects": {
    "effects": [
      {
        "operation": "CONDITIONAL",
        "condition": {
          "abstractPrecondition": "targetIsVulnerable",
          "params": ["target"]
        },
        "then": [
          { "operation": "MODIFY_COMPONENT", "entity": "target", "component": "combat:health", "updates": {"value": "{calculatedDamage}"} }
        ]
      }
    ],
    "abstractPreconditions": {
      "targetIsVulnerable": {
        "description": "Checks if target is vulnerable to attack (custom logic)",
        "parameters": ["target"],
        "simulationFunction": "evaluateAtRuntime"
      }
    },
    "cost": 2.0,
    "_manual": true,
    "_manualReason": "Complex damage calculation requires runtime evaluation"
  }
}
```

## Related Documentation

- [GOAP System Overview](./README.md)
- [Operation Mapping](./operation-mapping.md)
- [Effects Analyzer Architecture](./effects-analyzer-architecture.md)
- [Abstract Preconditions](./abstract-preconditions.md)
- [Macro Resolution](./macro-resolution.md)
- [Troubleshooting](./troubleshooting.md)
