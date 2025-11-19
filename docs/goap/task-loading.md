# GOAP Task Loading System

## Overview

The GOAP Task Loading System is responsible for loading and validating planning task definitions from mods. Tasks are high-level goals that can be decomposed into sequences of primitive actions through refinement methods.

## Architecture

### Core Components

1. **TaskLoader** (`src/loaders/taskLoader.js`)
   - Extends `SimpleItemLoader` for JSON-based loading
   - Validates task structure and refinement method references
   - Logs task details for debugging
   - Provides summary statistics on loaded tasks

2. **Task Schema** (`data/schemas/task.schema.json`)
   - Defines structure and validation rules for task files
   - Validates planning scope references
   - Ensures refinement method ID format consistency
   - Validates planning effects structure

3. **Mod Manifest Integration**
   - Tasks field in mod manifest schema
   - Pattern: `*.task.json` files
   - Loaded during content phase

### File Structure

```
data/mods/[mod-id]/
├── mod-manifest.json           # Declares tasks array
└── tasks/
    ├── *.task.json             # Task definitions
    └── refinement-methods/     # Refinement method files
        └── *.refinement.json
```

**Canonical reference**: `data/mods/core/tasks/consume_nourishing_item.task.json` and `data/mods/core/tasks/arm_self.task.json` are real assets that now live under the core mod. Their scopes (`core:known_nourishing_items`, `core:known_armament_items`) and refinement methods (`data/mods/core/refinement-methods/...`) provide end-to-end samples for loader debugging.

## Task File Format

### Basic Structure

```json
{
  "$schema": "schema://living-narrative-engine/task.schema.json",
  "id": "modId:task_id",
  "description": "Human-readable description of what this task achieves",
  "structuralGates": {
    "description": "Coarse applicability check",
    "condition": { /* JSON Logic expression */ }
  },
  "planningScope": "modId:scope_name",
  "planningPreconditions": [
    {
      "description": "Precondition description",
      "condition": { /* JSON Logic expression */ }
    }
  ],
  "planningEffects": [
    {
      "type": "OPERATION_TYPE",
      "parameters": { /* operation-specific parameters */ }
    }
  ],
  "refinementMethods": [
    {
      "methodId": "modId:task_id.method_name",
      "$ref": "refinement-methods/task_id.method_name.refinement.json"
    }
  ],
  "cost": 10,
  "priority": 50
}
```

### Field Descriptions

#### Core Identification

- **id** (required): Fully qualified task ID in format `modId:task_id`
- **description** (required): Human-readable explanation of task purpose

#### Structural Gates

- **structuralGates** (optional): Coarse-grained relevance checks
  - Applied before planning scope query
  - Fast rejection of obviously inapplicable tasks
  - Example: Check if actor has hands before "manipulate object" task

#### Planning Scope

- **planningScope** (required): Defines query scope for planning
  - Format: `modId:scope_name` OR special values `none`/`self`
  - Must respect knowledge limitations (use `core:known_to` component)
  - Examples: `core:entities_in_location`, `core:known_entities`

#### Planning Preconditions

- **planningPreconditions** (optional): State-dependent conditions
  - Array of condition objects with JSON Logic expressions
  - Evaluated against entities returned by planning scope
  - Only entities satisfying all preconditions are considered
  - Operator naming: Use `snake_case` for custom operators

#### Planning Effects

- **planningEffects** (required): State changes achieved by task
  - Array of operation objects
  - Each operation must have `type` field
  - Parameters depend on operation type
  - Used for planning and state prediction

#### Refinement Methods

- **refinementMethods** (required): How task decomposes into actions
  - Array of method references
  - Each method must have:
    - `methodId`: Format `modId:task_id.method_name`
    - `$ref`: Relative path to refinement method file
  - Task portion of method ID must match task ID base name
  - Example: Task `core:arm_self` → Method `core:arm_self.draw_from_inventory`

#### Cost and Priority

- **cost** (optional, default: 10): Computational cost for planning
  - Higher values = more expensive to plan
  - Affects planner heuristics

- **priority** (optional, default: 50): Task selection priority
  - Higher values = preferred over lower priority tasks
  - Range: 0-100 typical

## Validation Rules

### Structural Validation

1. **ID Format**: Must be valid namespaced ID (`modId:identifier`)
2. **Planning Scope**: Must be valid scope reference or special value
3. **Refinement Methods**:
   - Method ID must follow format `modId:task_id.method_name`
   - Task portion must match task ID base name
   - `$ref` must point to valid file
4. **Planning Effects**: Each effect must have `type` property

### Semantic Validation

1. **Scope References**: Referenced scopes must exist in registry
2. **Method References**: Referenced refinement method files must exist
3. **Operator Naming**: Custom operators must use `snake_case`
4. **Knowledge Limitation**: Planning scopes should respect knowledge boundaries

## Loading Process

### Phase 1: Schema Validation

1. AJV validates JSON structure against task.schema.json
2. Checks required fields and data types
3. Validates pattern constraints (IDs, references)

### Phase 2: Structural Validation

1. **TaskLoader._validateTaskStructure()** performs:
   - Planning scope reference format validation
   - Refinement method ID format validation
   - Method ID to task ID consistency check
   - Planning effects structure validation

### Phase 3: Registration

1. Task registered in data registry with fully qualified ID
2. Key format: `tasks.{modId}.{taskId}`
3. Available for GOAP planner queries

### Phase 4: Summary Logging

1. Log task details (method count, preconditions, effects)
2. Log mod summary (total tasks, total methods)
3. Debug information for troubleshooting

## Error Handling

### Common Errors

#### Invalid Scope Reference

```
Task {taskId}: planningScope 'invalid' must be a valid scope reference (modId:scopeName)
```

**Fix**: Use format `modId:scopeName` or special values `none`/`self`

#### Method ID Format Error

```
Task {taskId}: Refinement method ID 'invalid' must follow format 'modId:task_id.method_name'
```

**Fix**: Ensure method ID follows pattern and matches task ID

#### Method ID Mismatch

```
Task {taskId}: Refinement method 'modId:other_task.method' task portion must match task ID base name '{taskId}'
```

**Fix**: Method's task portion must match the task it belongs to

#### Missing Effect Type

```
Task {taskId}: Each planning effect must have a 'type' property
```

**Fix**: Add `type` field to all planning effects

## Examples

### Example 1: Simple Consumption Task

```json
{
  "$schema": "schema://living-narrative-engine/task.schema.json",
  "id": "core:consume_nourishing_item",
  "description": "Consume food or drink to satisfy hunger or thirst",
  "structuralGates": {
    "description": "Actor must have ability to consume items",
    "condition": {
      "has_component": ["actor", "core:can_consume"]
    }
  },
  "planningScope": "core:consumable_items_in_reach",
  "planningPreconditions": [
    {
      "description": "Item must be consumable",
      "condition": {
        "has_component": ["item", "core:consumable"]
      }
    }
  ],
  "planningEffects": [
    {
      "type": "ADD_COMPONENT",
      "parameters": {
        "entity": "actor",
        "componentId": "core:satiated"
      }
    }
  ],
  "refinementMethods": [
    {
      "methodId": "core:consume_nourishing_item.simple_consume",
      "$ref": "refinement-methods/consume_nourishing_item.simple_consume.refinement.json"
    }
  ],
  "cost": 5,
  "priority": 60
}
```

### Example 2: Complex Multi-Method Task

```json
{
  "$schema": "schema://living-narrative-engine/task.schema.json",
  "id": "core:arm_self",
  "description": "Acquire and ready a weapon for combat",
  "structuralGates": {
    "description": "Actor must have hands and combat capability",
    "condition": {
      "and": [
        {"has_component": ["actor", "core:has_hands"]},
        {"has_component": ["actor", "core:combat_capable"]}
      ]
    }
  },
  "planningScope": "core:weapons_available",
  "planningPreconditions": [
    {
      "description": "Weapon must be accessible",
      "condition": {
        "or": [
          {"has_component": ["weapon", "core:in_reach"]},
          {"has_component": ["weapon", "core:in_inventory"]}
        ]
      }
    },
    {
      "description": "Actor must have free hands",
      "condition": {
        "has_component": ["actor", "core:free_hands"]
      }
    }
  ],
  "planningEffects": [
    {
      "type": "ADD_COMPONENT",
      "parameters": {
        "entity": "weapon",
        "componentId": "core:equipped"
      }
    },
    {
      "type": "REMOVE_COMPONENT",
      "parameters": {
        "entity": "actor",
        "componentId": "core:unarmed"
      }
    }
  ],
  "refinementMethods": [
    {
      "methodId": "core:arm_self.draw_from_inventory",
      "$ref": "refinement-methods/arm_self.draw_from_inventory.refinement.json"
    },
    {
      "methodId": "core:arm_self.pick_up_and_wield",
      "$ref": "refinement-methods/arm_self.pick_up_and_wield.refinement.json"
    }
  ],
  "cost": 15,
  "priority": 70
}
```

## Integration with GOAP System

### Planning Phase

1. Planner evaluates structural gates for fast rejection
2. Queries planning scope to get candidate entities
3. Evaluates planning preconditions against candidates
4. Selects applicable refinement methods
5. Estimates cost and priority for task selection

### Execution Phase

1. Selected refinement method provides action sequence
2. Actions executed through normal rule/operation system
3. Planning effects tracked for state updates
4. Success/failure triggers plan continuation or replanning

## Best Practices

### Task Design

1. **Keep Structural Gates Simple**: Fast coarse checks only
2. **Use Knowledge-Limited Scopes**: Respect `core:known_to` component
3. **Define Clear Effects**: Make state changes explicit
4. **Provide Multiple Methods**: Enable flexible decomposition
5. **Set Appropriate Costs**: Balance planning performance

### Refinement Methods

1. **One Method Per File**: Clear separation and reusability
2. **Descriptive IDs**: Include task name and strategy
3. **Document Applicability**: Explain when method applies
4. **Test Each Method**: Verify decomposition correctness

### Validation

1. **Run Schema Validation**: Check structure before loading
2. **Test Planning Scopes**: Verify scope queries work correctly
3. **Validate Effects**: Ensure operations are registered
4. **Check Method References**: Verify all files exist

## Testing

### Unit Tests

Test TaskLoader validation logic:
- Scope reference format validation
- Method ID format validation
- Method ID to task ID consistency
- Effect structure validation

### Integration Tests

Test complete loading workflow:
- Load tasks from mod
- Verify registration in data registry
- Check loaded data structure
- Validate error handling

### End-to-End Tests

Test with GOAP planner:
- Task selection based on preconditions
- Refinement method applicability
- Action sequence execution
- Planning effects application

## See Also

- [GOAP System Specification](../specs/goap-system-specs.md)
- [Authoring Planning Tasks](../modding/authoring-planning-tasks.md)
- [Refinement Method Schema](../../data/schemas/refinement-method.schema.json)
- [Task Schema](../../data/schemas/task.schema.json)
- [GOAP Implementation Status](./IMPLEMENTATION-STATUS.md)
