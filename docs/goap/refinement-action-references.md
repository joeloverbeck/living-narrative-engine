# Refinement Action References

**Version**: 1.0.0
**Schema Version**: refinement-method.schema.json v1.1.0
**Status**: Documentation for implemented schema

## Overview

Refinement methods decompose abstract planning tasks into concrete primitive actions. This document explains how refinement method steps reference and invoke primitive actions with proper target bindings and parameters.

## Table of Contents

1. [Action Reference Format](#action-reference-format)
2. [Target Binding Mechanics](#target-binding-mechanics)
3. [Parameter Passing](#parameter-passing)
4. [Failure Handling](#failure-handling)
5. [Validation Rules](#validation-rules)
6. [Integration with Action System](#integration-with-action-system)
7. [Examples](#examples)
8. [Troubleshooting](#troubleshooting)

## Action Reference Format

### Basic Structure

Primitive action steps use the `PrimitiveActionStep` type defined in `refinement-method.schema.json`:

```json
{
  "stepType": "primitive_action",
  "actionId": "modId:actionId",
  "targetBindings": {
    "placeholderName": "task.params.entityId"
  },
  "parameters": {
    "paramName": "value"
  }
}
```

### Required Fields

- **`stepType`**: Must be `"primitive_action"` (constant)
- **`actionId`**: Reference to existing action in format `"modId:actionId"`
  - Example: `"items:pick_up_item"`
  - Example: `"deference:crawl_to"`
  - Example: `"intimacy:hold_hand"`

### Optional Fields

- **`targetBindings`**: Maps action placeholder names to entity references
- **`parameters`**: Overrides action default parameters

## Target Binding Mechanics

### How Actions Define Targets

Actions use the multi-target format with **placeholder names**. Each action defines its own placeholder names in the `targets` section:

```json
{
  "id": "items:pick_up_item",
  "targets": {
    "primary": {
      "scope": "items:items_at_location",
      "placeholder": "item",
      "description": "Item to pick up"
    }
  }
}
```

**Key Point**: The `placeholder` field (here `"item"`) is what refinement methods must reference.

### Different Actions, Different Placeholders

**Important**: Placeholder names are action-specific, not standardized:

| Action | Placeholder Name | Description |
|--------|------------------|-------------|
| `items:pick_up_item` | `"item"` | The item to pick up |
| `items:drink_from` | `"primary"` | The drinkable item |
| `deference:crawl_to` | `"target"` | The destination |
| `intimacy:hold_hand` | `"target"` | The person whose hand to hold |

**Critical Rule**: You cannot use generic placeholder names. You must use the exact placeholder name defined by each action.

### How Refinements Bind Targets

Refinement methods use `targetBindings` to map task parameters to action placeholders:

```json
{
  "stepType": "primitive_action",
  "actionId": "items:pick_up_item",
  "targetBindings": {
    "item": "task.params.item"
  }
}
```

**Binding Format**:
- **Key**: Exact placeholder name from the action (e.g., `"item"`)
- **Value**: String reference to entity ID (e.g., `"task.params.item"`)
- **NOT JSON Logic**: Use direct string references, not `{"var": "task.params.item"}`

### Target Binding Resolution

At refinement execution time:

1. Refinement engine receives task with bound parameters: `task.params.item = "entity_123"`
2. Engine evaluates binding: `"task.params.item"` → `"entity_123"`
3. Engine invokes action: `items:pick_up_item` with target `item="entity_123"`

### Multiple Target Bindings

Actions may have multiple targets:

```json
{
  "id": "items:transfer_item",
  "targets": {
    "primary": {
      "placeholder": "item",
      "description": "Item to transfer"
    },
    "secondary": {
      "placeholder": "recipient",
      "description": "Who receives the item"
    }
  }
}
```

Refinement binds both:

```json
{
  "stepType": "primitive_action",
  "actionId": "items:transfer_item",
  "targetBindings": {
    "item": "task.params.item",
    "recipient": "task.params.target"
  }
}
```

### Discovering Action Placeholders

To find the correct placeholder names for an action:

1. **Check Action Definition**: Look at `data/mods/*/actions/*.action.json`
2. **Find `targets` Section**: Each target slot has a `placeholder` field
3. **Use Exact Names**: Copy placeholder names exactly into `targetBindings`

Example inspection:

```bash
# Find an action file
cat data/mods/items/actions/pick_up_item.action.json

# Look for the targets section:
{
  "targets": {
    "primary": {
      "placeholder": "item",  // ← This is what you need
      ...
    }
  }
}
```

## Parameter Passing

### Default Parameters

Actions define default parameters in their schema:

```json
{
  "id": "items:pick_up_item",
  "parameters": {
    "force": false,
    "silent": false
  }
}
```

### Overriding Parameters

Refinement steps can override defaults:

```json
{
  "stepType": "primitive_action",
  "actionId": "items:pick_up_item",
  "targetBindings": {
    "item": "task.params.item"
  },
  "parameters": {
    "force": true
  }
}
```

**Result**: Action executes with `force=true`, `silent=false` (default retained).

### Parameter Semantics

- **Override Only**: Cannot add new parameters not defined by action
- **Type Safety**: Parameter values must match action's parameter types
- **Validation**: Future runtime will validate parameter names and types

### Common Parameter Patterns

```json
// Suppress notifications
{"parameters": {"silent": true}}

// Force execution regardless of preconditions
{"parameters": {"force": true}}

// Adjust behavior flags
{"parameters": {"gentle": true, "quick": false}}
```

## Failure Handling

### Method-Level Only

**Important**: Primitive action steps do NOT have step-level `onFailure` handlers. Failure handling is defined at the **method level** via `fallbackBehavior`.

### Refinement Method Structure

```json
{
  "refinementMethodId": "consume_food_item",
  "taskId": "task:consume_nourishing_item",
  "fallbackBehavior": "fail",
  "steps": [
    {
      "stepType": "primitive_action",
      "actionId": "items:pick_up_item",
      "targetBindings": {"item": "task.params.item"}
    },
    {
      "stepType": "primitive_action",
      "actionId": "items:consume_item",
      "targetBindings": {"item": "task.params.item"}
    }
  ]
}
```

### Fallback Behaviors

| Behavior | Description | Use Case |
|----------|-------------|----------|
| `"fail"` | Stop execution, mark method as failed | Critical paths where failure is unacceptable |
| `"continue"` | Log error, continue to next step | Optional steps where partial completion is acceptable |
| `"replan"` | Trigger replanning (future) | When world state invalidates current plan |

### Failure Propagation

When a primitive action fails:

1. Action execution returns failure result
2. Refinement engine checks method's `fallbackBehavior`
3. If `"fail"`: Method execution stops, failure propagates to planner
4. If `"continue"`: Method continues to next step

**Note**: Step-level failure handling may be added in future versions.

## Validation Rules

These rules will be enforced by future runtime validation:

### Action Reference Validation

- ✅ `actionId` must exist in loaded action registry
- ✅ `actionId` format must be `"modId:actionId"`
- ✅ Referenced mod must be loaded and available

### Target Binding Validation

- ✅ All binding keys must match action's defined placeholder names
- ✅ All required action targets must have bindings provided
- ✅ Binding values must be valid string references (e.g., `"task.params.X"`)
- ✅ Referenced task parameters must exist

### Parameter Validation

- ✅ All parameter names must be defined by the action
- ✅ Parameter values must match action's parameter types
- ✅ Cannot add parameters not defined by action

### Nesting Validation

- ✅ Maximum nesting depth: 10 levels (prevents infinite recursion)
- ✅ Circular refinement detection (task A → task B → task A)

## Integration with Action System

### Action Discovery

Primitive actions are loaded by the action system:

1. **Action Loader**: `src/loaders/actionLoader.js` (extends `SimpleItemLoader`)
2. **Action Registry**: All actions registered by mod ID and action ID
3. **Schema Validation**: Actions validated against `data/schemas/action.schema.json`

### Action Execution Flow

```
Refinement Method
  ↓
Primitive Action Step
  ↓
Action Lookup (by actionId)
  ↓
Target Resolution (via targetBindings)
  ↓
Parameter Override (via parameters)
  ↓
Action Execution
  ↓
Result (success/failure)
```

### Action Structure Reference

Primitive actions have:

- **`id`**: Unique identifier (`"modId:actionId"`)
- **`targets`**: Multi-target definition with placeholders
- **`parameters`**: Default parameter values
- **`applicabilityConditions`**: JSON Logic conditions (execution-time)
- **`operation`**: Operation to perform when executed

### Execution-Time vs Planning-Time

**Important Distinction**:

- **Planning Tasks**: Use planning-time conditions and world-wide scopes
- **Refinement Methods**: Bridge between planning and execution
- **Primitive Actions**: Use execution-time conditions and local scopes

Action applicability is checked at **execution time**, not during planning. This means:

- Actions check actual world state when executed
- Planning assumes methods are applicable (checked at planning time)
- Action execution can still fail if conditions not met

## Examples

### Example 1: Simple Action Reference

**See**: `docs/goap/examples/action-reference-bindings.refinement.json`

Demonstrates:
- Basic action reference
- Single target binding
- No parameter overrides

### Example 2: Parameter Overrides

**See**: `docs/goap/examples/action-reference-parameters.refinement.json`

Demonstrates:
- Action with custom parameters
- Overriding default values
- Multiple steps with different parameter sets

### Example 3: Multiple Target Bindings

**See**: `docs/goap/examples/action-reference-bindings.refinement.json`

Demonstrates:
- Action with multiple targets
- Binding multiple placeholders
- Complex task parameter mapping

### Example 4: Failure Handling

**See**: `docs/goap/examples/action-reference-failure.refinement.json`

Demonstrates:
- Method-level `fallbackBehavior`
- Sequential action execution
- Failure propagation behavior

## Troubleshooting

### Error: "Unknown action ID"

**Cause**: Action not found in registry.

**Solution**:
1. Check action exists: `data/mods/*/actions/*.action.json`
2. Verify mod is loaded in `game.json`
3. Check action ID format: `"modId:actionId"`

### Error: "Unknown placeholder name"

**Cause**: Target binding key doesn't match action's placeholder.

**Solution**:
1. Open action definition file
2. Find `targets` section
3. Copy exact `placeholder` value
4. Use that value as key in `targetBindings`

**Example**:

```json
// ❌ Wrong - using generic name
{"targetBindings": {"primary": "task.params.item"}}

// ✅ Correct - using action's placeholder
{"targetBindings": {"item": "task.params.item"}}
```

### Error: "Missing required target binding"

**Cause**: Action requires target but no binding provided.

**Solution**:
1. Check action's `targets` section
2. Identify all required targets (those without `optional: true`)
3. Provide bindings for all required targets

### Error: "Invalid parameter name"

**Cause**: Attempting to override parameter not defined by action.

**Solution**:
1. Check action's `parameters` section
2. Only override parameters that action defines
3. Remove any extra parameters from refinement step

### Error: "Task parameter not found"

**Cause**: Binding references `task.params.X` but task doesn't have parameter X.

**Solution**:
1. Check task definition's `parameters` section
2. Ensure task parameter exists
3. Use correct parameter name in binding reference

### Placeholder Name Mismatches

**Common Mistake**: Assuming all actions use standard placeholder names.

**Reality**: Each action defines its own placeholders:

```json
// Action 1 uses "item"
"actionId": "items:pick_up_item"
"targetBindings": {"item": "task.params.item"}

// Action 2 uses "target"
"actionId": "deference:crawl_to"
"targetBindings": {"target": "task.params.location"}

// Action 3 uses "primary"
"actionId": "items:drink_from"
"targetBindings": {"primary": "task.params.beverage"}
```

**Best Practice**: Always inspect the action definition first.

### JSON Logic in Target Bindings

**Common Mistake**: Using JSON Logic format in `targetBindings`.

```json
// ❌ Wrong
{"targetBindings": {"item": {"var": "task.params.item"}}}

// ✅ Correct
{"targetBindings": {"item": "task.params.item"}}
```

**Note**: `targetBindings` uses simple string references, not JSON Logic expressions.

## Modder Quick Reference

### Checklist for Adding Primitive Action Step

- [ ] Find action ID: Check `data/mods/*/actions/`
- [ ] Inspect action file: Note placeholder names in `targets` section
- [ ] Create step with `stepType: "primitive_action"`
- [ ] Set `actionId` to `"modId:actionId"`
- [ ] Add `targetBindings` with exact placeholder names as keys
- [ ] Bind each placeholder to task parameter: `"task.params.X"`
- [ ] (Optional) Add `parameters` to override action defaults
- [ ] Validate JSON against schema

### Quick Action Inspection

```bash
# Find all actions in a mod
ls data/mods/items/actions/*.action.json

# View action placeholders
cat data/mods/items/actions/pick_up_item.action.json | grep -A 5 "placeholder"

# Find actions by name pattern
find data/mods -name "*pick*.action.json"
```

### Common Action Reference Patterns

```json
// Single-target action
{
  "stepType": "primitive_action",
  "actionId": "items:pick_up_item",
  "targetBindings": {"item": "task.params.item"}
}

// Multi-target action
{
  "stepType": "primitive_action",
  "actionId": "items:transfer_item",
  "targetBindings": {
    "item": "task.params.item",
    "recipient": "task.params.target"
  }
}

// Action with parameter override
{
  "stepType": "primitive_action",
  "actionId": "items:pick_up_item",
  "targetBindings": {"item": "task.params.item"},
  "parameters": {"force": true}
}
```

## Future Enhancements

Planned features for future versions:

- **Runtime Validation**: Automated checking of placeholder names and references
- **Step-Level Failure Handlers**: Per-step `onFailure` handlers (if needed)
- **Dynamic Target Binding**: Computed bindings using JSON Logic (if needed)
- **Conditional Parameters**: Parameter values based on conditions (if needed)
- **Action Recommendation**: Tooling to suggest appropriate actions for tasks

## Related Documentation

- **Base Schema**: `docs/goap/refinement-method-base-schema.md`
- **Conditional Logic**: `docs/goap/refinement-conditional-logic.md`
- **Parameter Binding**: `docs/goap/refinement-parameter-binding.md` (future)
- **Task Schema**: `docs/goap/task-schema.md` (future)
- **GOAP System**: `specs/goap-system-specs.md`

## Schema Reference

The `PrimitiveActionStep` type is defined in `data/schemas/refinement-method.schema.json`:

```json
{
  "type": "object",
  "required": ["stepType", "actionId"],
  "properties": {
    "stepType": {
      "type": "string",
      "const": "primitive_action"
    },
    "actionId": {
      "type": "string",
      "pattern": "^[a-zA-Z0-9_]+:[a-zA-Z0-9_]+$",
      "description": "Reference to primitive action (modId:actionId)"
    },
    "targetBindings": {
      "type": "object",
      "patternProperties": {
        "^[a-zA-Z_][a-zA-Z0-9_]*$": {
          "type": "string",
          "description": "Binding from placeholder name to task parameter"
        }
      }
    },
    "parameters": {
      "type": "object",
      "description": "Parameter overrides for the action"
    }
  }
}
```

---

**Document Version**: 1.0.0
**Last Updated**: 2025-01-13
**Schema Version**: refinement-method.schema.json v1.1.0
