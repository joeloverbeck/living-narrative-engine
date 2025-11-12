# Effects Auto-Generation Guide

## Overview

The effects auto-generation system is a **development-time tool** that analyzes action rules and generates planning metadata. Generated effects are committed to the repository alongside action definitions. This eliminates manual effect authoring, ensures consistency between execution code and planning metadata, and reduces maintenance burden.

**Key Distinction**: Effects generation runs during development (via `npm run generate:effects`), not at runtime. The GOAP planner uses pre-generated effects stored in action files.

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

The effects generator analyzes rule operations offline (during development) to produce planning metadata that is committed to the repository. At runtime, the GOAP planner reads these pre-generated effects from action files.

### Generation Workflow

**Step 1: Developer runs generation command**
```bash
npm run generate:effects -- --action=positioning:sit_down
```

**Step 2: Generator loads action and finds associated rule**
```javascript
// Action: positioning:sit_down
// Rule: positioning:handle_sit_down
{
  "id": "positioning:handle_sit_down",
  "event": { "type": "ACTION_DECIDED" },
  "actions": [
    { "type": "REMOVE_COMPONENT", "entity": "actor", "component": "positioning:standing" },
    { "type": "ADD_COMPONENT", "entity": "actor", "component": "positioning:sitting" }
  ]
}
```

**Step 3: Analyzer processes operations**
- Identifies state-changing operations (ADD/REMOVE/MODIFY_COMPONENT)
- Skips non-state operations (events, logging, queries)
- Traces conditional branches (IF/THEN/ELSE)
- Resolves macros where possible

**Step 4: Generator produces planning effects**
```javascript
{
  "planningEffects": {
    "effects": [
      { "operation": "REMOVE_COMPONENT", "entity": "actor", "component": "positioning:standing" },
      { "operation": "ADD_COMPONENT", "entity": "actor", "component": "positioning:sitting" }
    ],
    "cost": 1.0
  }
}
```

**Step 5: Developer commits changes**
The generated effects are written to the action file and committed to the repository. At runtime, the planner reads these effects without regeneration.

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

### Conditional Operations

The generator handles `IF/THEN/ELSE` operations by creating `CONDITIONAL` effects with abstract preconditions:

```json
// Rule with conditional
{
  "type": "IF",
  "condition": {"var": "hasSpace"},
  "then": [{ "type": "ADD_COMPONENT", "entity": "actor", "component": "test:happy" }],
  "else": [{ "type": "ADD_COMPONENT", "entity": "actor", "component": "test:sad" }]
}

// Generated effect (then branch only, else represents no change)
{
  "operation": "CONDITIONAL",
  "condition": { "abstractPrecondition": "actorHasSpace", "params": ["actor"] },
  "then": [{ "operation": "ADD_COMPONENT", "entity": "actor", "component": "test:happy" }]
}
```

Nested conditionals produce nested `CONDITIONAL` effects. Multiple paths to the same effect create separate conditional effects.

## Macro Resolution

Macros are placeholders for runtime values in rule operations. The generator resolves them when possible.

### Macro Resolution

**Resolvable**: Action parameters and context variables known at generation time are resolved to concrete values:
```json
// Rule: { "type": "ADD_COMPONENT", "entity": "actor", "component": {"var": "targetComponent"} }
// If action.parameters.targetComponent = "positioning:sitting"
// Effect: { "operation": "ADD_COMPONENT", "entity": "actor", "component": "positioning:sitting" }
```

**Unresolvable**: Runtime-only data becomes parameterized:
```json
// Rule: { "type": "TRANSFER_ITEM", "itemId": {"var": "selectedItem"}, ... }
// Effect: { "operation": "REMOVE_COMPONENT", "entity": "actor", "component": "items:in_inventory", "componentId": "{selectedItem}" }
```

## Abstract Preconditions

Abstract preconditions represent conditions that can't be evaluated during analysis. See [abstract-preconditions.md](./abstract-preconditions.md) for the complete catalog.

### When to Create Abstract Preconditions

1. **Runtime-Dependent Conditions**: Conditions that reference world state unknown at analysis time
2. **Complex Queries**: Conditions involving queries that can't be pre-computed
3. **Dynamic Relationships**: Conditions about entity relationships that change during gameplay

### Auto-Generated Preconditions

The generator creates abstract preconditions for runtime-dependent conditions:

| Trigger | Generated Precondition | Default Strategy |
|---------|----------------------|------------------|
| Unresolvable variable | Descriptive name (e.g., `targetTrustsActor`) | `assumeTrue` |
| `VALIDATE_INVENTORY_CAPACITY` | `{entity}HasInventorySpace` | `assumeTrue` |
| `HAS_COMPONENT` check | `{entity}HasComponent_{componentId}` | `evaluateAtRuntime` |

**Simulation Strategies**:
- `assumeTrue`: Optimistic (default)
- `assumeFalse`: Pessimistic
- `evaluateAtRuntime`: Check actual runtime state
- `assumeRandom`: Probabilistic

## Hypothetical Data

Query operations that produce data for later operations result in abstract preconditions:

```json
// QUERY_COMPONENT → IF condition referencing query result
// Becomes: CONDITIONAL effect with abstract precondition
{ "operation": "CONDITIONAL", "condition": { "abstractPrecondition": "targetHasLessThan10Items" }, ... }
```

## Running the Generator

**During Development**: Run generation after creating or modifying action rules.

```bash
# Single action
npm run generate:effects -- --action=positioning:sit_down

# Entire mod
npm run generate:effects -- --mod=positioning

# All mods
npm run generate:effects
```

**Workflow**:
1. Developer modifies action rule
2. Runs generation command
3. Reviews generated effects
4. Commits action file with updated `planningEffects`
5. At runtime, planner reads pre-generated effects

**Programmatic Usage** (for build scripts):
```javascript
const effectsGenerator = container.resolve(goapTokens.IEffectsGenerator);
const effects = effectsGenerator.generateForAction('positioning:sit_down');
// Note: Write effects to file manually; injectEffects() only updates in-memory data
```

## Validation

The generator validates effects during generation:

**Schema Validation**: Checks against `planning-effects.schema.json`
- Required fields present
- Correct types
- Valid operation types

**Semantic Validation**:
- Component IDs use `modId:componentId` format
- Entity values are `actor`, `target`, `tertiary_target`, or entity ID
- Abstract preconditions have `description`, `parameters`, `simulationFunction`
- Cost < 100

**Common Errors**:
| Error | Fix |
|-------|-----|
| `positioning_sitting` | Use `positioning:sitting` |
| Missing `operation` | Add to all effects |
| Invalid entity `actorr` | Use `actor` |
| Precondition missing `simulationFunction` | Add `assumeTrue` or other strategy |

## Troubleshooting

See [troubleshooting.md](./troubleshooting.md) for detailed guide.

**No Effects Generated**
- Check rule exists: `{modId}:handle_{actionName}`
- Verify rule has state-changing operations (not just events/queries)
- Ensure rule references action in conditions

**Validation Failures**
- Regenerate effects after rule changes
- Check component IDs use `mod:component` format
- Verify abstract preconditions have required fields

**Missing Operations**
- Check [operation-mapping.md](./operation-mapping.md) - operation may be non-state
- Verify operation is in executed path (not skipped branch)
- Report issue if state-changing operation is excluded

## Manual Overrides

While auto-generation is recommended, manual overrides are supported for edge cases.

### When to Use Manual Overrides

1. **Complex Effects**: Effects too complex for auto-generation
2. **Performance Optimization**: Hand-tuned costs
3. **Special Cases**: Unusual patterns not supported by analyzer

### How to Override

1. Generate initial effects: `npm run generate:effects -- --action=my_mod:my_action`
2. Edit action file, adding `"_manual": true` and `"_manualReason"`
3. Document why override is needed
4. Keep manually synced with rule changes

**Example**:
```json
{
  "id": "combat:complex_attack",
  "planningEffects": {
    "effects": [...],
    "abstractPreconditions": {
      "targetIsVulnerable": {
        "description": "Custom vulnerability check",
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
