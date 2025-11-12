# GOAP Operation Mapping

## Overview

This document defines how rule operations map to planning effects in the GOAP system. The `EffectsAnalyzer` (`src/goap/analysis/effectsAnalyzer.js`) automatically generates planning metadata by analyzing rule operations.

**Important**: Planning effects are generated at runtime from rules, not stored in action files. The analyzer examines rule operations and produces effects conforming to `data/schemas/planning-effects.schema.json`.

## Operation Categories

Operations are categorized by their impact on planning:

1. **State-Changing Operations** (51 operations): Modify world state and generate planning effects
2. **Context Operations** (13 operations): Produce data for other operations but don't change state
3. **Control Flow Operations** (3 operations): Structure execution (IF, IF_CO_LOCATED, SEQUENCE)
4. **Excluded Operations** (24 operations): No planning impact (events, logging, turn control)

## State-Changing Operations

These operations modify world state and generate planning effects.

### Core Component Operations

These operations directly manipulate ECS components and map 1:1 to planning effects.

#### ADD_COMPONENT

Adds a component to an entity. Maps directly to ADD_COMPONENT effect.

```javascript
// Rule operation
{ type: "ADD_COMPONENT", parameters: { entity: "actor", component: "positioning:sitting", data: {} } }

// Planning effect
{ operation: "ADD_COMPONENT", entity: "actor", component: "positioning:sitting", data: {} }
```

#### REMOVE_COMPONENT

Removes a component from an entity. Maps directly to REMOVE_COMPONENT effect.

```javascript
// Rule operation
{ type: "REMOVE_COMPONENT", parameters: { entity: "target", component: "positioning:standing" } }

// Planning effect
{ operation: "REMOVE_COMPONENT", entity: "target", component: "positioning:standing" }
```

#### MODIFY_COMPONENT / ATOMIC_MODIFY_COMPONENT

Modifies component data. Both map to MODIFY_COMPONENT effect (atomicity is an execution detail, not a planning concern).

```javascript
// Rule operation
{ type: "MODIFY_COMPONENT", parameters: { entity: "actor", component: "core:position", updates: { location: "bedroom" } } }

// Planning effect
{ operation: "MODIFY_COMPONENT", entity: "actor", component: "core:position", updates: { location: "bedroom" } }
```

**Note**: Runtime placeholders like `{var: "location"}` are preserved in effects as parameterized values

---

### High-Level Operations

These operations map to component operations internally.

#### Movement Locking

```javascript
// LOCK_MOVEMENT → ADD positioning:movement_locked
{ operation: "ADD_COMPONENT", entity: "actor", component: "positioning:movement_locked" }

// UNLOCK_MOVEMENT → REMOVE positioning:movement_locked
{ operation: "REMOVE_COMPONENT", entity: "actor", component: "positioning:movement_locked" }
```

#### Mouth Engagement Locking

```javascript
// LOCK_MOUTH_ENGAGEMENT → ADD positioning:mouth_engagement_locked
{ operation: "ADD_COMPONENT", entity: "actor", component: "positioning:mouth_engagement_locked" }

// UNLOCK_MOUTH_ENGAGEMENT → REMOVE positioning:mouth_engagement_locked
{ operation: "REMOVE_COMPONENT", entity: "actor", component: "positioning:mouth_engagement_locked" }
```

#### Closeness Operations

Bidirectional relationships that create components on both entities.

```javascript
// ESTABLISH_SITTING_CLOSENESS
[
  { operation: "ADD_COMPONENT", entity: "actor", component: "positioning:sitting_close_to", data: { targetId: "{target.id}" } },
  { operation: "ADD_COMPONENT", entity: "target", component: "positioning:sitting_close_to", data: { targetId: "{actor.id}" } }
]

// ESTABLISH_LYING_CLOSENESS
[
  { operation: "ADD_COMPONENT", entity: "actor", component: "positioning:lying_close_to", data: { targetId: "{target.id}" } },
  { operation: "ADD_COMPONENT", entity: "target", component: "positioning:lying_close_to", data: { targetId: "{actor.id}" } }
]

// REMOVE_SITTING_CLOSENESS
{ operation: "REMOVE_COMPONENT", entity: "actor", component: "positioning:sitting_close_to" }

// REMOVE_LYING_CLOSENESS
{ operation: "REMOVE_COMPONENT", entity: "actor", component: "positioning:lying_close_to" }

// BREAK_CLOSENESS_WITH_TARGET (removes both)
[
  { operation: "REMOVE_COMPONENT", entity: "actor", component: "positioning:sitting_close_to" },
  { operation: "REMOVE_COMPONENT", entity: "actor", component: "positioning:lying_close_to" }
]
```

**Schema Constraint**: Entity references are limited to "actor", "target", or "tertiary_target" as defined in `planning-effects.schema.json`

---

### Inventory & Item Operations

**Important**: Items use `items:inventory_item` component (with `itemId` in data), not `items:in_inventory`.

```javascript
// TRANSFER_ITEM
[
  { operation: "REMOVE_COMPONENT", entity: "actor", component: "items:inventory_item", data: { itemId: "{itemId}" } },
  { operation: "ADD_COMPONENT", entity: "target", component: "items:inventory_item", data: { itemId: "{itemId}" } }
]

// DROP_ITEM_AT_LOCATION
[
  { operation: "REMOVE_COMPONENT", entity: "actor", component: "items:inventory_item", data: { itemId: "{itemId}" } },
  { operation: "ADD_COMPONENT", entity: "actor", component: "items:at_location", data: { location: "{actor.location}" } }
]

// PICK_UP_ITEM_FROM_LOCATION
[
  { operation: "REMOVE_COMPONENT", entity: "actor", component: "items:at_location" },
  { operation: "ADD_COMPONENT", entity: "actor", component: "items:inventory_item", data: { itemId: "{itemId}" } }
]
```

**Schema Limitation**: The schema restricts entity to "actor"/"target"/"tertiary_target". The EffectsAnalyzer generates effects with item IDs like `entity: "{itemId}"`, but these may not validate against the current schema

---

### Container Operations

```javascript
// OPEN_CONTAINER
{ operation: "MODIFY_COMPONENT", entity: "target", component: "items:container", updates: { isOpen: true } }

// TAKE_FROM_CONTAINER
[
  { operation: "REMOVE_COMPONENT", entity: "actor", component: "items:contained_in" },
  { operation: "ADD_COMPONENT", entity: "actor", component: "items:inventory_item", data: { itemId: "{itemId}" } }
]

// PUT_IN_CONTAINER
[
  { operation: "REMOVE_COMPONENT", entity: "actor", component: "items:inventory_item", data: { itemId: "{itemId}" } },
  { operation: "ADD_COMPONENT", entity: "actor", component: "items:contained_in", data: { containerId: "target" } }
]
```

**Note**: Container operations use `items:contained_in` to track which container holds an item.

---

### Clothing Operations

```javascript
// UNEQUIP_CLOTHING
[
  { operation: "REMOVE_COMPONENT", entity: "actor", component: "clothing:equipped", data: { clothingId: "{clothingId}" } },
  { operation: "ADD_COMPONENT", entity: "actor", component: "items:inventory_item", data: { itemId: "{clothingId}" } }
]
```

---

### Other State-Changing Operations

The following operations are recognized as state-changing but lack conversion methods in `EffectsAnalyzer`:

- `DRINK_FROM` - Partial consumption from container
- `DRINK_ENTIRELY` - Full consumption from container
- `SYSTEM_MOVE_ENTITY` - System-level entity movement
- `MODIFY_ARRAY_FIELD` - Array field modifications
- `REMOVE_FROM_CLOSENESS_CIRCLE` - Closeness circle management
- `MERGE_CLOSENESS_CIRCLE` - Closeness circle merging
- `ESTABLISH_FOLLOW_RELATION` - Following relationships
- `BREAK_FOLLOW_RELATION` - Break following relationships
- `REBUILD_LEADER_LIST_CACHE` - Cache maintenance
- `AUTO_MOVE_CLOSENESS_PARTNERS` - Automatic positioning
- `AUTO_MOVE_FOLLOWERS` - Automatic follower movement
- `ADD_PERCEPTION_LOG_ENTRY` - Perception logging

**Implementation Status**: These operations are in `isWorldStateChanging()` but don't have `operationToEffect()` conversion methods yet

---

## Context Operations

These operations produce data for other operations but don't change world state. They generate no planning effects.

**Complete List** (from `EffectsAnalyzer.isContextProducing()`):

- `QUERY_COMPONENT` - Retrieves component data
- `QUERY_COMPONENTS` - Retrieves multiple components
- `QUERY_ENTITIES` - Queries entities by criteria
- `QUERY_LOOKUP` - Looks up entity by property
- `GET_NAME` - Gets entity name
- `GET_TIMESTAMP` - Gets current timestamp
- `SET_VARIABLE` - Sets context variable
- `MODIFY_CONTEXT_ARRAY` - Modifies context arrays
- `VALIDATE_INVENTORY_CAPACITY` - Checks inventory space (may generate abstract precondition)
- `VALIDATE_CONTAINER_CAPACITY` - Checks container space (may generate abstract precondition)
- `HAS_COMPONENT` - Checks component existence (may generate abstract precondition)
- `HAS_BODY_PART_WITH_COMPONENT_VALUE` - Checks body part state
- `RESOLVE_DIRECTION` - Resolves facing direction
- `MATH` - Performs calculations
- `CHECK_FOLLOW_CYCLE` - Checks for following cycles (may generate abstract precondition)

---

## Control Flow Operations

These operations structure execution and are analyzed recursively.

### IF

Conditional execution. Both `then` and `else` branches are analyzed. The analyzer creates CONDITIONAL effects containing the analyzed branches.

```javascript
// Rule operation
{
  type: "IF",
  parameters: {
    condition: { "==": [{"var": "x"}, 5] },
    then_actions: [/* operations */],
    else_actions: [/* operations */]
  }
}

// Planning effect
{
  operation: "CONDITIONAL",
  condition: { "==": [{"var": "x"}, 5] },
  then: [/* analyzed effects from then_actions */]
  // Note: else branch also analyzed and may be included
}
```

**Important**: Contrary to common assumptions, the `EffectsAnalyzer` DOES analyze and include else branches (see `effectsAnalyzer.js:324-335`).

### IF_CO_LOCATED

Specialized conditional for location checks. Converted to standard IF with location comparison.

```javascript
// Converted condition
{
  "==": [
    { var: "actor.location" },
    { var: "target.location" }
  ]
}
```

### SEQUENCE

Structural operation only. The analyzer processes SEQUENCE operations by flattening them - each operation inside is analyzed individually. SEQUENCE itself generates no effects.

### FOR_EACH

**Not Currently Implemented**: FOR_EACH is NOT handled by `EffectsAnalyzer`. It's in the whitelist but has no conversion logic. Collections are not analyzed for planning purposes.

---

## Excluded Operations

These operations have no impact on planning. They don't change world state in ways relevant to GOAP.

**Event Dispatching** (Side effects, no direct state changes):
- `DISPATCH_EVENT`
- `DISPATCH_PERCEPTIBLE_EVENT`
- `DISPATCH_SPEECH`
- `DISPATCH_THOUGHT`

**Turn Control** (Execution flow, not state):
- `END_TURN`
- `REGENERATE_DESCRIPTION`

**Logging** (Debug only):
- `LOG`

**Note**: Events may trigger actions, but those actions plan independently

---

## Runtime Placeholders

**Critical Understanding**: Macros are expanded BEFORE the analyzer runs (by `RuleLoader`). What the analyzer sees are runtime placeholders like `{var: "itemId"}` or `{param: "targetId"}`.

These placeholders are:
1. **Preserved in effects** as parameterized values (e.g., `"{itemId}"`)
2. **Resolved during execution** by `contextUtils.resolvePlaceholders()`
3. **Not resolved during planning** - the planner works with parameterized effects

```javascript
// What EffectsAnalyzer receives (after macro expansion)
{ type: "TRANSFER_ITEM", parameters: { item_id: "{itemId}", from_entity: "actor", to_entity: "target" } }

// What it produces (placeholders preserved)
[
  { operation: "REMOVE_COMPONENT", entity: "actor", component: "items:inventory_item", data: { itemId: "{itemId}" } },
  { operation: "ADD_COMPONENT", entity: "target", component: "items:inventory_item", data: { itemId: "{itemId}" } }
]
```

---

## Abstract Preconditions

Abstract preconditions handle runtime conditions that cannot be evaluated during static analysis. They are defined in the planning effects and simulated during planning.

### Implemented Simulators

The `AbstractPreconditionSimulator` (`src/goap/simulation/abstractPreconditionSimulator.js`) implements 3 preconditions:

1. **hasInventoryCapacity** - Checks if actor can carry item
   - Calculates: `(current weight + item weight) <= max weight`
   - Used for item pickup operations

2. **hasContainerCapacity** - Checks if container has space
   - Calculates: `current count < max capacity`
   - Used for container operations

3. **hasComponent** - Checks if entity has component
   - Simple presence check: `!!entity.components[componentId]`
   - Used for conditional logic

### Simulation Strategies

Defined in action planning effects (not in EffectsAnalyzer):

- **assumeTrue** - Optimistically assume condition is met
- **assumeFalse** - Pessimistically assume condition fails
- **assumeRandom** - Randomly choose true/false
- **evaluateAtRuntime** - Actually evaluate using simulated world state

### Auto-Generation

The `EffectsAnalyzer` can auto-generate abstract preconditions for validation operations:

```javascript
// From EffectsAnalyzer.#operationToAbstractPrecondition()
{
  'VALIDATE_INVENTORY_CAPACITY': {
    description: 'Checks if actor can carry the item',
    parameters: ['actorId', 'itemId'],
    simulationFunction: 'assumeTrue'
  },
  'HAS_COMPONENT': {
    description: 'Checks if entity has component',
    parameters: ['entityId', 'componentId'],
    simulationFunction: 'assumeTrue'
  }
  // etc.
}
```

---

## Operation Count Summary

**Total operations in system**: 91 (from `preValidationUtils.js:KNOWN_OPERATION_TYPES`)

- **State-changing**: 51 operations (in `EffectsAnalyzer.isWorldStateChanging()`)
  - With converters: ~20 operations
  - Without converters: ~31 operations (recognized but not converted)
- **Context-producing**: 15 operations (in `EffectsAnalyzer.isContextProducing()`)
- **Control flow**: 3 operations (IF, IF_CO_LOCATED, SEQUENCE)
- **Excluded**: 22 operations (events, logging, turn control, etc.)

---

## Implementation Architecture

### Analysis Pipeline

1. **Rule Loading** (`src/loaders/ruleLoader.js`)
   - Expands macros (e.g., `{macro: "modId:macroId"}`)
   - Results in operations with runtime placeholders

2. **Effects Analysis** (`src/goap/analysis/effectsAnalyzer.js`)
   - Analyzes rule operations
   - Traces execution paths through conditionals
   - Converts operations to planning effects
   - Generates abstract preconditions

3. **Effect Simulation** (`src/goap/selection/actionSelector.js`)
   - Simulates effects on world state
   - Evaluates abstract preconditions
   - Calculates progress toward goals

4. **Action Selection** (`src/goap/selection/actionSelector.js`)
   - Compares actions by progress
   - Selects best action for active goal

### Key Files

- **Schema**: `data/schemas/planning-effects.schema.json`
- **Analyzer**: `src/goap/analysis/effectsAnalyzer.js`
- **Simulator**: `src/goap/simulation/abstractPreconditionSimulator.js`
- **Selector**: `src/goap/selection/actionSelector.js`
- **Validator**: `src/goap/validation/effectsValidator.js`
- **Whitelist**: `src/utils/preValidationUtils.js` (KNOWN_OPERATION_TYPES)

### Testing

E2E tests in `tests/e2e/goap/` demonstrate:
- Effect simulation accuracy (`ActionSelectionWithEffectSimulation.e2e.test.js`)
- Planning vs execution matching (`PlanningEffectsMatchRuleExecution.e2e.test.js`)
- Abstract preconditions (`AbstractPreconditionConditionalEffects.e2e.test.js`)
- Complete workflows (`CompleteGoapDecisionWithRealMods.e2e.test.js`)

---

## Known Limitations

1. **Schema Restrictions**: Entity field limited to "actor"/"target"/"tertiary_target" - arbitrary entity IDs don't validate
2. **Missing Converters**: 31+ state-changing operations recognized but lack conversion methods
3. **FOR_EACH**: Not implemented - collections not analyzed
4. **Effect Types**: Only 3 effect types (ADD/REMOVE/MODIFY_COMPONENT) + CONDITIONAL
5. **Component Names**: EffectsAnalyzer uses actual component IDs (e.g., `items:inventory_item`), which may differ from documentation assumptions
