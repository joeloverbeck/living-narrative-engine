# Runtime Placeholder Resolution in GOAP Planning

## Overview

During GOAP planning effects analysis, rule operations contain **runtime placeholders** - references to values that won't be known until execution time. The effects analyzer preserves these placeholders in generated planning effects using a special notation. This guide explains how runtime placeholders work in the GOAP system and how they're handled during effects generation.

**Important Terminology**: This document discusses "runtime placeholders" (e.g., `{actor.id}`, `{itemId}`). These are distinct from "macros" (`{"macro": "modId:macroId"}`), which are reusable action array references expanded during rule loading by `macroUtils.js`.

## What Are Runtime Placeholders?

Runtime placeholders are string references that will be resolved during rule execution, not during planning:

```
{actor.id}
{target.location}
{itemId}
{componentType}
```

These appear in rule operations within string values and are resolved at execution time by `resolvePlaceholders()` in `src/utils/contextUtils.js`.

## How Effects Analysis Handles Runtime Values

The effects analyzer (`src/goap/analysis/effectsAnalyzer.js`) processes rule operations and converts them to planning effects. When it encounters references to runtime values, it preserves them using placeholder notation:

### During Effects Analysis

1. **Rule operations are analyzed** to identify state-changing operations (ADD_COMPONENT, REMOVE_COMPONENT, etc.)
2. **Runtime placeholders are NOT resolved** - they're preserved in the generated effects
3. **Placeholder notation** is used: `"{variableName}"`, `"{actor.location}"`, `"{itemId}"`

**Example from `effectsAnalyzer.js` (lines 544, 594, 674, 693):**

```javascript
// Establish closeness operation
{
  operation: 'ADD_COMPONENT',
  entity: 'actor',
  component: 'positioning:sitting_close_to',
  data: {
    targetId: `{${targetEntity}.id}`  // Runtime placeholder preserved
  }
}

// Item transfer operation
const itemId = operation.parameters.item_id || '{itemId}';  // Placeholder if not specified
```

### At Execution Time

When an action is actually executed:

1. **Placeholders are resolved** using `resolvePlaceholders()` from `src/utils/contextUtils.js`
2. **Context is built** from:
   - Action parameters from the action definition
   - Context variables set during execution (SET_VARIABLE operations)
   - Entity data from world state
   - Event data from the triggering event
3. **Placeholders replaced** with actual runtime values

## Common Placeholder Patterns

### Simple Entity References

```javascript
// In rule operation
entity: "actor"  // Resolved during execution to actual actor entity ID
entity: "target"  // Resolved to target entity ID from action context
```

### Component ID Placeholders

```javascript
// Item operations
{
  operation: 'ADD_COMPONENT',
  entity: 'actor',
  component: 'items:inventory_item',
  data: { itemId: '{itemId}' }  // Resolved at execution time
}
```

### Location Placeholders

```javascript
// Drop item at actor's location
{
  operation: 'ADD_COMPONENT',
  entity: '{itemId}',
  component: 'items:at_location',
  data: { location: '{actor.location}' }  // Actor's current location
}
```

### Entity ID Placeholders

```javascript
// Closeness relationships
{
  operation: 'ADD_COMPONENT',
  entity: 'actor',
  component: 'positioning:sitting_close_to',
  data: { targetId: '{target.id}' }  // Target entity's ID
}
```

## Abstract Preconditions

For conditionals that cannot be evaluated during effects analysis, the system uses **abstract preconditions**:

### What Are Abstract Preconditions?

Abstract preconditions represent runtime checks that the planner cannot evaluate statically. They're generated when IF operations have conditions that depend on runtime state.

**Example from `effectsAnalyzer.js` (lines 400-443):**

```javascript
{
  'VALIDATE_INVENTORY_CAPACITY': {
    description: 'Checks if actor can carry the item',
    parameters: ['actorId', 'itemId'],
    simulationFunction: 'assumeTrue'  // Optimistic assumption during planning
  },
  'HAS_COMPONENT': {
    description: 'Checks if entity has component',
    parameters: ['entityId', 'componentId'],
    simulationFunction: 'assumeTrue'
  }
}
```

### How They Work

1. **During analysis**: IF operations with runtime-dependent conditions generate CONDITIONAL effects
2. **During simulation**: The planner uses the `simulationFunction` strategy to predict which branch will execute
3. **Simulation strategies**:
   - `assumeTrue`: Optimistically assume condition passes (for capacity checks)
   - `assumeFalse`: Pessimistically assume condition fails
   - `evaluateAtRuntime`: Attempt to evaluate using available entity data

**Example conditional effect:**

```json
{
  "operation": "CONDITIONAL",
  "condition": {
    "abstractPrecondition": "hasComponent",
    "params": ["actor", "positioning:standing"]
  },
  "then": [
    {
      "operation": "REMOVE_COMPONENT",
      "entity": "actor",
      "component": "positioning:standing"
    }
  ],
  "else": []
}
```

## Best Practices for Rule Authors

### Use Concrete Values When Possible

```javascript
// Good - concrete component reference
{
  type: 'ADD_COMPONENT',
  entity: 'actor',
  component: 'positioning:sitting'  // Known at authoring time
}

// Only use placeholders when truly runtime-dependent
{
  type: 'TRANSFER_ITEM',
  itemId: '{itemId}'  // Player selects at runtime
}
```

### Standard Entity Aliases

Use standard aliases that the execution context understands:
- `actor` - The entity performing the action
- `target` - The primary target of the action (secondary_target_id parameter)
- `tertiary` - The tertiary target (tertiary_target_id parameter)

```javascript
{
  type: 'ADD_COMPONENT',
  entity: 'target',  // Will resolve to actual target entity ID
  component: 'items:received_item'
}
```

### Document Complex Placeholders

When using nested placeholders, add comments for clarity:

```javascript
{
  type: 'ADD_COMPONENT',
  entity: 'actor',
  component: 'positioning:sitting_close_to',
  data: {
    // target.id will resolve to the actual entity ID of the target
    targetId: '{target.id}'
  }
}
```

## Implementation References

### Key Source Files

- **Effects Analysis**: `src/goap/analysis/effectsAnalyzer.js` - Converts rule operations to planning effects
- **Effects Generation**: `src/goap/generation/effectsGenerator.js` - Orchestrates effects generation for actions
- **Runtime Resolution**: `src/utils/contextUtils.js` - Resolves placeholders during execution
- **Placeholder Resolver**: `src/utils/executionPlaceholderResolver.js` - Core placeholder resolution logic
- **Macro Expansion**: `src/utils/macroUtils.js` - Expands `{"macro": "..."}` references (different from runtime placeholders)

### Test Coverage

The GOAP system's handling of runtime placeholders and effects is validated by e2e tests in `tests/e2e/goap/`:

- `CompleteGoapDecisionWithRealMods.e2e.test.js` - Full workflow with real mod data
- `AbstractPreconditionConditionalEffects.e2e.test.js` - Conditional effects with abstract preconditions
- `PlanningEffectsMatchRuleExecution.e2e.test.js` - Verifies planning effects match actual execution
- `ActionSelectionWithEffectSimulation.e2e.test.js` - Tests effect simulation during planning

## Related Documentation

- [Effects Auto-Generation](./effects-auto-generation.md) - How planning effects are generated from rules
- [GOAP Architecture Overview](./README.md) - High-level GOAP system architecture
