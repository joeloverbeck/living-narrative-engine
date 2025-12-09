# GOAP Refinement Method Examples

This directory contains example refinement methods that demonstrate how planning-tasks decompose into sequences of primitive actions in the GOAP (Goal-Oriented Action Planning) system.

## What are Refinement Methods?

Refinement methods bridge the gap between abstract planning and concrete execution:

- **Planning-tasks** (e.g., `task:consume_nourishing_item`) are abstract intentions that the GOAP planner reasons about
- **Refinement methods** define how to turn those abstract tasks into sequences of **primitive actions** (e.g., `items:consume_item`) that the game engine can execute

A single planning-task can have multiple refinement methods for different world states. The system selects the appropriate method based on applicability conditions.

## Example Files

### Basic Examples

#### `refinement-method-simple.json`

**Task**: `core:consume_nourishing_item`  
**Method**: `simple_consume`  
**Scenario**: Actor already has a nourishing item in their inventory

This is the simplest refinement path. When the actor already possesses food, the method directly consumes it without needing to acquire it first.

**Key Features**:

- Single-step refinement (one primitive action)
- Applicability condition checks for item in inventory
- Demonstrates basic structure and required fields
- Shows fallback behavior configuration
- **Updated**: Now uses correct `has_component` operator name

### Conditional Examples

#### `conditional-simple.refinement.json`

**Task**: `core:consume_nourishing_item`  
**Method**: `conditional_acquire`  
**Scenario**: Handles both in-inventory and needs-pickup scenarios

Demonstrates basic if-then-else branching:

- **If** item is in inventory → consume directly
- **Else** → pick up item, then consume

**Key Features**:

- Single conditional step with thenSteps and elseSteps
- Safe component existence checks before property access
- Demonstrates onFailure handling
- Shows how one method can handle multiple scenarios

#### `conditional-nested.refinement.json`

**Task**: `core:consume_nourishing_item`  
**Method**: `full_acquisition`  
**Scenario**: Comprehensive item acquisition with nested conditionals

Demonstrates nested conditional logic (2 levels deep):

1. **If** item in inventory → consume
2. **Else if** item in current location → pick up, consume
3. **Else** → move to location, pick up, consume

**Key Features**:

- Nested conditionals up to 2 levels
- Location-aware logic
- Progressive condition checking
- Demonstrates how to structure complex acquisition logic

#### `conditional-failure.refinement.json`

**Task**: `core:heal_self`  
**Method**: `conditional_healing`  
**Scenario**: Different healing strategies with failure handling

Demonstrates different `onFailure` behaviors:

- **replan**: Critical healing path fails → replan entire goal
- **skip**: Optional rest fails → skip and continue
- **fail**: Quality check fails → fail entire refinement

**Key Features**:

- Multiple conditional steps in sequence
- Different failure strategies per conditional
- Quality validation pattern
- Optional vs required steps

#### `conditional-patterns.refinement.json`

**Task**: `core:example_patterns`  
**Method**: `common_checks`  
**Scenario**: Reference guide for common condition patterns

A comprehensive reference showing 10 common condition patterns:

1. Component existence check
2. Item in inventory check
3. Same location check
4. Entity visibility check
5. Knowledge check (core:known_to)
6. Numeric threshold check
7. Multiple conditions with OR logic
8. Clothing in slot check
9. Item removal blocked check
10. Safe nested property access

**Key Features**:

- All patterns use correct operator names
- Safe property access patterns
- Uses all major custom operators
- Annotated with pattern names for easy reference

## Structure of a Refinement Method

Every refinement method has the following structure:

```json
{
  "$schema": "schema://living-narrative-engine/refinement-method.schema.json",
  "id": "modId:task_id.method_name",
  "taskId": "modId:task_id",
  "description": "Human-readable explanation",

  "applicability": {
    "description": "When this method applies",
    "condition": {
      // JSON Logic expression
    }
  },

  "steps": [
    {
      "stepType": "primitive_action",
      "actionId": "modId:action_id",
      "targetBindings": {
        "placeholder": "entity_reference"
      }
    }
  ],

  "fallbackBehavior": "replan"
}
```

### Required Fields

- **`id`**: Unique identifier in format `modId:task_id.method_name`
- **`taskId`**: Reference to the planning-task being refined
- **`description`**: Clear explanation of what the method does
- **`steps`**: Array of sequential steps (at least one)

### Optional Fields

- **`applicability`**: Conditions for when this method should be selected (omit for "always applicable")
- **`fallbackBehavior`**: What to do if refinement fails (default: `"replan"`)

## Step Types

### `primitive_action`

Executes a concrete game action.

**Required fields**:

- `stepType`: Must be `"primitive_action"`
- `actionId`: Reference to a primitive action (e.g., `"items:consume_item"`)

**Optional fields**:

- `targetBindings`: Maps action targets to entities
- `parameters`: Additional action-specific parameters

**Example**:

```json
{
  "stepType": "primitive_action",
  "actionId": "items:consume_item",
  "targetBindings": {
    "target": "task.params.item"
  }
}
```

### `conditional`

Branches execution based on runtime conditions (if-then-else logic).

**Required fields**:

- `stepType`: Must be `"conditional"`
- `condition`: JSON Logic expression to evaluate
- `thenSteps`: Steps to execute if condition is truthy

**Optional fields**:

- `description`: Human-readable explanation of the check
- `elseSteps`: Steps to execute if condition is falsy
- `onFailure`: Behavior when condition evaluation fails (`"replan"`, `"skip"`, or `"fail"`)

**Example**:

```json
{
  "stepType": "conditional",
  "description": "Check if item is in inventory",
  "condition": {
    "and": [
      { "has_component": [{ "var": "actor" }, "items:inventory"] },
      {
        "in": [
          { "var": "task.params.item" },
          { "var": "actor.components.items:inventory.items" }
        ]
      }
    ]
  },
  "thenSteps": [
    {
      "stepType": "primitive_action",
      "actionId": "items:consume_item",
      "targetBindings": { "target": "task.params.item" }
    }
  ],
  "elseSteps": [
    {
      "stepType": "primitive_action",
      "actionId": "items:pick_up_item",
      "targetBindings": { "target": "task.params.item" }
    },
    {
      "stepType": "primitive_action",
      "actionId": "items:consume_item",
      "targetBindings": { "target": "task.params.item" }
    }
  ],
  "onFailure": "replan"
}
```

**Nesting**: Conditionals can be nested up to 3 levels deep to prevent complexity explosion.

**Future step types** (not yet implemented):

- `parallel`: Concurrent action execution
- `subtask`: Nested planning-task reference

## Applicability Conditions

Applicability conditions use JSON Logic expressions to determine when a refinement method is appropriate. They have access to:

- **`actor`**: Current actor entity with full component data
- **`world`**: World state (implementation TBD)
- **`task.params`**: Bound parameters from planning scope
- **`task.state`**: Transient refinement execution state
- **`target`**: Convenience alias for `task.params.target`

### Custom Operators

The system includes many domain-specific operators. **Important**: Use correct snake_case names.

**Component Checking**:

- `has_component(entityPath, componentId)` - ✅ Correct
- ~~`hasComponent`~~ - ❌ Wrong (old camelCase name)

**Common Operators**:

- `has_component` - Check component existence
- `isRemovalBlocked` - Check if clothing removal blocked
- `hasSittingSpaceToRight` - Spatial positioning check
- `canScootCloser` - Proximity check

See [Condition Patterns Guide](../condition-patterns-guide.md) for comprehensive pattern reference.

### Example Patterns

```json
// Check for component on entity
{
  "has_component": [
    { "var": "task.params.item" },
    "items:nourishing"
  ]
}

// Check item in inventory
{
  "and": [
    { "has_component": [{ "var": "actor" }, "items:inventory"] },
    { "in": [{ "var": "task.params.item" }, { "var": "actor.components.items:inventory.items" }] }
  ]
}

// Safe property access with existence check
{
  "and": [
    { "has_component": [{ "var": "actor" }, "core:health"] },
    { ">": [{ "var": "actor.components.core:health.current" }, 50] }
  ]
}
```

## Conditional Step Evaluation

### Evaluation Context

Conditions in conditional steps are evaluated with:

- Current world state (as modified by previous steps)
- Actor components (current state)
- Task parameters (from planning scope)
- Task state (transient execution state)

### Failure Handling

If condition evaluation fails (missing variables, type errors), the `onFailure` behavior determines what happens:

- **`"replan"`** (default): Invalidate plan and trigger replanning
- **`"skip"`**: Skip this conditional block, continue to next step
- **`"fail"`**: Fail entire refinement, trigger fallback behavior

### Best Practices

1. **Always check component existence** before accessing properties
2. **Use descriptive descriptions** for each conditional
3. **Prefer custom operators** over manual property access
4. **Design for knowledge limitation** (use `core:known_to`)
5. **Handle edge cases** (entities disappearing mid-refinement)

See [Refinement Condition Context](../refinement-condition-context.md) for detailed documentation.

## Fallback Behavior

When a refinement fails during execution (e.g., the food was eaten by another actor), the `fallbackBehavior` determines what happens:

- **`"replan"`** (recommended default): Invalidate the current plan and ask GOAP to create a new plan from the current state
- **`"fail"`**: Abort the current goal entirely and select a new goal
- **`"continue"`**: Skip this task and proceed to the next task in the plan (use cautiously, only for optional tasks)

## Using Examples as Templates

To create your own refinement method:

1. Copy an example file as a starting point (use `conditional-simple.refinement.json` for branching logic)
2. Update the `id` to match your task: `yourmod:your_task.your_method`
3. Set the `taskId` to reference your planning-task
4. Define when your method applies in `applicability.condition`
5. Define the sequence of steps (primitive actions and conditionals) in `steps`
6. Choose appropriate `fallbackBehavior`
7. Validate against the schema

## Integration with Mods

Refinement methods belong in your mod structure:

```
data/mods/yourmod/
├── refinement-methods/
│   ├── your_task.method_one.refinement.json
│   └── your_task.method_two.refinement.json
└── mod-manifest.json
```

Register them in your mod manifest:

```json
{
  "content": {
    "refinementMethods": [
      "your_task.method_one.refinement.json",
      "your_task.method_two.refinement.json"
    ]
  }
}
```

## Schema Reference

Full schema documentation: [refinement-method.schema.json](../../../data/schemas/refinement-method.schema.json)

## Additional Documentation

- **[Refinement Condition Context](../refinement-condition-context.md)** - Complete specification of context variables, evaluation timing, and failure semantics
- **[Condition Patterns Guide](../condition-patterns-guide.md)** - Comprehensive reference for common condition patterns with correct operator names
- **[GOAP System Specification](../../../specs/goap-system-specs.md)** - Overall GOAP system design and architecture

## Future Enhancements

The refinement method system is designed for extensibility. Future versions will add:

- **Parallel steps**: Execute multiple primitive actions concurrently
- **Subtask steps**: Decompose into other planning-tasks (full HTN support)
- **Parameter validation**: Ensure parameters match action requirements
- **Cross-reference validation**: Verify actionId references exist in action registry
- **Runtime nesting depth validation**: Enforce 3-level limit programmatically

## Additional Resources

### Templates for Modders

**Location**: `docs/goap/templates/`

Ready-to-use templates for creating your own refinement methods:

- `simple-sequential-task.template.json` - Linear action sequences
- `conditional-acquisition-task.template.json` - If-then-else branching
- `multi-step-state-task.template.json` - State accumulation with storeResultAs
- `multiple-methods-task.template.json` - Complete task with multiple refinement methods

Each template includes placeholder markers, inline documentation, and usage instructions. See `docs/goap/templates/README.md` for quick start guide.

### Edge Cases & Error Prevention

**Location**: `docs/goap/examples/edge-cases/`

Common error scenarios and defensive programming patterns:

- `empty-inventory-conditional.refinement.json` - Safe array access
- `unreachable-location.refinement.json` - Precondition validation
- `missing-component.refinement.json` - Component existence checks
- `invalid-parameter-type.refinement.json` - Parameter type validation
- `condition-evaluation-error.refinement.json` - Safe property access

See `docs/goap/examples/edge-cases/README.md` for troubleshooting guide and error message reference.

## Questions or Issues?

For questions about refinement methods or GOAP system design, refer to:

- Main GOAP specification: `specs/goap-system-specs.md`
- Schema definition: `data/schemas/refinement-method.schema.json`
- Implementation tickets: `tickets/GOAPIMPL-*.md`
- **Templates**: `docs/goap/templates/README.md` (NEW - quick start for modders)
- **Edge Cases**: `docs/goap/examples/edge-cases/README.md` (NEW - error prevention)
