# Refinement Condition Context

## Overview

Conditions in refinement methods (both applicability conditions and conditional step conditions) are evaluated using JSON Logic expressions with access to a rich context of game state information. This document specifies all available variables, their structure, evaluation timing, and failure semantics.

## Context Variables

### `actor`

**Type**: Entity object with full component data  
**Description**: The current actor entity executing the refinement  
**Availability**: Always present

**Structure**:
```json
{
  "id": "entity_123",
  "components": {
    "core:actor": { /* actor component data */ },
    "items:inventory": {
      "items": ["item_1", "item_2"],
      "capacity": 10
    },
    "positioning:position": {
      "location": "location_5",
      "posture": "standing"
    }
    // ... other components
  }
}
```

**Common Access Patterns**:
```json
// Check if actor has a component
{ "has_component": [{ "var": "actor" }, "items:inventory"] }

// Access component property
{ "var": "actor.components.positioning:position.location" }

// Check inventory contents
{ "in": ["item_7", { "var": "actor.components.items:inventory.items" }] }
```

### `world`

**Type**: World state object  
**Description**: Read-only access to world state facts and global information  
**Availability**: Always present  
**Note**: Implementation details TBD - this will be populated by world state service

**Structure** (Preliminary):
```json
{
  "locations": {
    "location_5": {
      "id": "location_5",
      "name": "Kitchen",
      "entities": ["entity_123", "item_7"]
    }
  },
  "time": {
    "currentTurn": 42,
    "timeOfDay": "morning"
  }
  // Additional world state as needed
}
```

**Common Access Patterns**:
```json
// Check current location
{ "==": [
  { "var": "actor.components.positioning:position.location" },
  "location_5"
]}

// Access location entities (via world state - TBD)
{ "var": "world.locations[location_5].entities" }
```

### `task`

**Type**: Task execution context object  
**Description**: Information about the current task being refined  
**Availability**: Always present

**Structure**:
```json
{
  "params": {
    "item": "item_7",
    "location": "location_5"
    // Parameters bound from planning scope
  },
  "state": {
    // Transient refinement execution state
    // Can be used to pass data between steps
    "acquiredItems": ["item_1"],
    "visitedLocations": ["location_3", "location_5"]
  }
}
```

**Common Access Patterns**:
```json
// Access bound parameter
{ "var": "task.params.item" }

// Check parameter component
{ "has_component": [
  { "var": "task.params.item" },
  "items:nourishing"
]}

// Access transient state
{ "var": "task.state.acquiredItems" }

// Check if item is the bound parameter
{ "==": ["item_7", { "var": "task.params.item" }] }
```

### `target`

**Type**: Entity ID (string) or Entity object  
**Description**: Convenience alias for `task.params.target` when task has a single primary target  
**Availability**: When task defines a `target` parameter

**Usage**:
```json
// Equivalent expressions
{ "var": "target" }
{ "var": "task.params.target" }

// Component check
{ "has_component": [{ "var": "target" }, "items:nourishing"] }
```

## Evaluation Timing

### Applicability Conditions

**When**: Evaluated during refinement method selection, before any steps execute  
**Purpose**: Determine which refinement method(s) can handle the current situation  
**Context State**: Current world state at time of task execution initiation

### Conditional Step Conditions

**When**: Evaluated immediately before the conditional step executes  
**Purpose**: Determine which branch (thenSteps or elseSteps) to execute  
**Context State**: World state as modified by all previous steps in the refinement

**Important**: State changes from previous steps are visible to subsequent conditionals:
```json
{
  "steps": [
    {
      "stepType": "primitive_action",
      "actionId": "items:pick_up_item",
      "targetBindings": { "target": "task.params.item" }
    },
    {
      "stepType": "conditional",
      "description": "Item is now in inventory after previous step",
      "condition": {
        "in": [
          { "var": "task.params.item" },
          { "var": "actor.components.items:inventory.items" }
        ]
      },
      "thenSteps": [ /* ... */ ]
    }
  ]
}
```

## Failure Semantics

### Condition Evaluation Failures

Conditions can fail to evaluate in several scenarios:

1. **Missing Variables**: Referenced variable does not exist
   - Example: `{ "var": "task.params.nonexistent" }` when parameter not bound
   
2. **Type Errors**: Operation receives invalid type
   - Example: `{ "+": ["string", 5] }` - cannot add string to number
   
3. **Component Access on Null**: Accessing properties of undefined entities
   - Example: `{ "var": "task.params.item.components.food:nutrition" }` when item doesn't exist

### Default Failure Behavior

**Applicability Conditions**: If evaluation fails, method is considered **not applicable**  
**Conditional Steps**: Behavior determined by `onFailure` property:

- `"replan"` (default): Invalidate plan and trigger replanning from current state
- `"skip"`: Skip conditional block, continue to next step in sequence
- `"fail"`: Fail entire refinement, trigger method-level `fallbackBehavior`

### Handling Undefined Values

JSON Logic treats `null`, `undefined`, `false`, `0`, `""`, and `[]` as falsy. Design conditions defensively:

```json
// ❌ Unsafe - fails if component doesn't exist
{
  ">": [
    { "var": "actor.components.core:health.current" },
    50
  ]
}

// ✅ Safe - checks existence first
{
  "and": [
    { "has_component": [{ "var": "actor" }, "core:health"] },
    {
      ">": [
        { "var": "actor.components.core:health.current" },
        50
      ]
    }
  ]
}
```

## Integration with Existing Systems

### JSON Logic Evaluation Service

Conditions are evaluated by `src/logic/jsonLogicEvaluationService.js`:

- Whitelist validation ensures only safe operations
- Custom operator support via `jsonLogicCustomOperators.js`
- Condition reference resolution via `condition_ref`

### Custom Operators

All custom operators from `src/logic/jsonLogicCustomOperators.js` are available:

**Component Checking**:
- `has_component(entityPath, componentId)` - Check if entity has component
- `hasPartWithComponentValue(entityPath, componentId, propertyPath, expectedValue)`
- `hasPartOfType(entityPath, partType)`

**Clothing & Equipment**:
- `hasClothingInSlot(entityPath, slotName)`
- `hasClothingInSlotLayer(entityPath, slotName, layerName)`
- `isSocketCovered(entityPath, socketId)`
- `isRemovalBlocked(actorPath, targetItemPath)`

**Spatial & Positioning**:
- `hasSittingSpaceToRight(entityPath, targetPath, minSpaces)`
- `canScootCloser(entityPath, targetPath)`
- `isClosestLeftOccupant(entityPath, targetPath, actorPath)`
- `isClosestRightOccupant(entityPath, targetPath, actorPath)`
- `hasOtherActorsAtLocation(entityPath)`

**Usage Example**:
```json
{
  "has_component": [
    { "var": "task.params.item" },
    "items:nourishing"
  ]
}
```

### Context Assembly

Context is assembled by the refinement engine before condition evaluation:

1. Current actor entity retrieved with all components
2. World state snapshot captured
3. Task parameters from planning scope binding
4. Transient task state initialized (or carried forward)

**Note**: Context assembly implementation is part of future refinement engine work.

## Best Practices

### 1. Always Check Existence

Before accessing nested properties, verify the entity/component exists:

```json
{
  "and": [
    { "has_component": [{ "var": "actor" }, "items:inventory"] },
    {
      "in": [
        { "var": "task.params.item" },
        { "var": "actor.components.items:inventory.items" }
      ]
    }
  ]
}
```

### 2. Use Descriptive Condition Descriptions

```json
{
  "description": "Item is in actor's inventory and not consumed",
  "condition": { /* ... */ }
}
```

### 3. Prefer Custom Operators

Use domain-specific operators instead of generic property access:

```json
// ✅ Preferred - uses custom operator
{ "has_component": [{ "var": "actor" }, "core:health"] }

// ❌ Avoid - fragile property access
{ "!=": [{ "var": "actor.components.core:health" }, null] }
```

### 4. Design for Knowledge Limitation

Remember that planning scopes are knowledge-limited (via `core:known_to` component). Don't assume omniscience:

```json
// Planning scope should already filter to known items
// Condition checks practical feasibility
{
  "and": [
    { "has_component": [{ "var": "task.params.item" }, "items:edible"] },
    { "has_component": [{ "var": "actor" }, "biology:can_eat"] }
  ]
}
```

### 5. Handle Edge Cases

Consider what happens when entities disappear mid-refinement:

```json
{
  "onFailure": "replan",  // If item was consumed by someone else
  "condition": {
    "has_component": [
      { "var": "task.params.item" },
      "items:consumable"
    ]
  }
}
```

## Debugging Conditions

### Common Issues

1. **Condition always evaluates to false**
   - Check variable paths are correct
   - Verify entities/components exist
   - Use `has_component` before accessing properties

2. **Evaluation failures**
   - Check for null/undefined access
   - Verify operator names (use `has_component`, not `hasComponent`)
   - Ensure parameters are properly bound

3. **Unexpected branching**
   - Remember JSON Logic falsy values: `null`, `undefined`, `false`, `0`, `""`, `[]`
   - Use explicit comparisons: `{ "==": [x, true] }` vs `{ "var": "x" }`

### Testing Strategy

Test conditions in isolation before integrating into refinement methods:

1. Create test cases with various world states
2. Verify condition evaluates correctly in each scenario
3. Test failure cases (missing entities, null components)
4. Validate with actual custom operators (not mocked)

## Examples

See `docs/goap/examples/` for comprehensive examples:

- `conditional-simple.refinement.json` - Basic if-then-else
- `conditional-nested.refinement.json` - Nested conditionals
- `conditional-failure.refinement.json` - Failure handling patterns
- `conditional-patterns.refinement.json` - Common condition patterns

## Future Enhancements

1. **Enhanced World State Access**: Richer world state queries (nearby entities, location properties)
2. **Path Finding**: Distance calculations, reachability checks
3. **Knowledge Queries**: "Does actor know about entity X?"
4. **Temporal Queries**: "Has event X occurred recently?"
5. **Aggregate Operators**: Count, sum, filter operations on entity collections

## Related Documentation

- [JSON Logic Documentation](https://jsonlogic.com/) - Core logic engine
- [Custom Operators](../../src/logic/jsonLogicCustomOperators.js) - Domain-specific operators
- [Condition Container Schema](../../data/schemas/condition-container.schema.json) - Condition format
- [Refinement Method Schema](../../data/schemas/refinement-method.schema.json) - Full schema reference
