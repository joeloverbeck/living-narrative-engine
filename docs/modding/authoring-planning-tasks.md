# Authoring Planning Tasks

A comprehensive guide for mod authors creating GOAP planning tasks and refinement methods.

## Introduction

Planning tasks are high-level goals in the GOAP (Goal-Oriented Action Planning) system. They represent complex objectives that NPCs can work toward, such as "find shelter" or "acquire weapon". Tasks decompose into sequences of primitive actions through refinement methods.

This guide will teach you how to:
- Design effective planning tasks
- Create refinement methods
- Structure task files correctly
- Test and debug your tasks

## Canonical Samples

The core mod now ships with two complete, production-ready planning tasks you can reference while following this guide:

- `data/mods/core/tasks/consume_nourishing_item.task.json` uses the knowledge-limited scope `core:known_nourishing_items` plus the `core:hungry` marker to show how structural gates, preconditions, and planning effects are tied together. Its refinement methods live under `data/mods/core/refinement-methods/consume_nourishing_item/` and demonstrate inventory-first vs. retrieval-first branching.
- `data/mods/core/tasks/arm_self.task.json` illustrates how to plan over `core:known_armament_items`, prevent duplicate work when `core:armed` is already present, and stage different refinement behaviors (readying a carried weapon vs. picking one up).

Skim those files whenever you need concrete examples of the patterns described below.

## Prerequisites

Before creating tasks, you should understand:
- [JSON Logic expressions](./json-logic-guide.md)
- [Component system](./component-system.md)
- [Scope DSL](./scope-dsl.md)
- [Action and rule system](./actions-and-rules.md)

## Task Anatomy

### Minimum Viable Task

```json
{
  "$schema": "schema://living-narrative-engine/task.schema.json",
  "id": "my_mod:simple_task",
  "description": "A simple task example",
  "planningScope": "none",
  "planningEffects": [
    {
      "type": "ADD_COMPONENT",
      "parameters": {
        "entity": "actor",
        "componentId": "my_mod:task_complete"
      }
    }
  ],
  "refinementMethods": [
    {
      "methodId": "my_mod:simple_task.direct_action",
      "$ref": "refinement-methods/simple_task.direct_action.refinement.json"
    }
  ]
}
```

### Complete Task Template

```json
{
  "$schema": "schema://living-narrative-engine/task.schema.json",
  "id": "my_mod:task_name",
  "description": "Detailed task description explaining the goal",

  "structuralGates": {
    "description": "Fast coarse-grained check for task relevance",
    "condition": {
      "has_component": ["actor", "my_mod:required_ability"]
    }
  },

  "planningScope": "my_mod:entities_of_interest",

  "planningPreconditions": [
    {
      "description": "Condition that must be met for task applicability",
      "condition": {
        "has_component": ["target", "my_mod:required_property"]
      }
    }
  ],

  "planningEffects": [
    {
      "type": "ADD_COMPONENT",
      "parameters": {
        "entity": "actor",
        "componentId": "my_mod:task_achieved"
      }
    }
  ],

  "refinementMethods": [
    {
      "methodId": "my_mod:task_name.method_one",
      "$ref": "refinement-methods/task_name.method_one.refinement.json"
    },
    {
      "methodId": "my_mod:task_name.method_two",
      "$ref": "refinement-methods/task_name.method_two.refinement.json"
    }
  ],

  "cost": 10,
  "priority": 50
}
```

## Step-by-Step Guide

### Step 1: Define the Goal

Ask yourself:
- **What is the high-level objective?** (e.g., "obtain food")
- **What changes when successful?** (effects on world state)
- **What must be true to attempt this?** (preconditions)
- **Who/what is involved?** (planning scope entities)

Example: "Acquire Weapon" task
- Objective: Actor obtains and readies a weapon
- Changes: Actor gains `equipped_weapon` component
- Requirements: Actor has free hands, weapon exists
- Involves: Available weapons in area or inventory

### Step 2: Choose a Planning Scope

The planning scope defines which entities the planner queries:

```json
"planningScope": "core:weapons_available"
```

**Scope options:**
- `"none"` - No entity binding (self-contained task)
- `"self"` - Actor binds to themselves
- `"modId:scope_name"` - Custom scope query

**Knowledge limitation principle:**
NPCs should only plan with entities they know about. Use scopes that respect the `core:known_to` component.

✅ Good: `"core:known_weapons"`
❌ Bad: `"core:all_weapons_in_world"` (breaks knowledge limitation)

### Step 3: Define Structural Gates (Optional)

Structural gates are fast, coarse checks that reject obviously inapplicable tasks:

```json
"structuralGates": {
  "description": "Actor must be capable of weapon use",
  "condition": {
    "and": [
      {"has_component": ["actor", "core:has_hands"]},
      {"has_component": ["actor", "core:combat_capable"]}
    ]
  }
}
```

**When to use:**
- Actor lacks fundamental ability (no hands for manipulation)
- Task category is completely inappropriate (combat task for pacifist)
- Fast rejection before expensive scope queries

**When NOT to use:**
- Detailed precondition checks (use planningPreconditions instead)
- State-dependent conditions (those belong in preconditions)

### Step 4: Define Planning Preconditions

Preconditions are evaluated against entities from the planning scope:

```json
"planningPreconditions": [
  {
    "description": "Weapon must be accessible to actor",
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
]
```

**Tips:**
- Use descriptive descriptions for debugging
- Check both actor and target entity states
- Keep conditions simple and composable
- Use custom operators with `snake_case` naming

### Step 5: Define Planning Effects

Effects describe the state changes the task achieves:

```json
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
]
```

**Effect types:**
- `ADD_COMPONENT` - Add component to entity
- `REMOVE_COMPONENT` - Remove component from entity
- Custom operations (register in operation handlers)

**Best practices:**
- Be explicit about all state changes
- Include both additions and removals
- Consider side effects (removing "unarmed" when equipping weapon)

### Step 6: Create Refinement Methods

Refinement methods define how the task decomposes into actions. Create separate files in `refinement-methods/` subdirectory:

**File: `refinement-methods/arm_self.draw_from_inventory.refinement.json`**

```json
{
  "$schema": "schema://living-narrative-engine/refinement-method.schema.json",
  "id": "core:arm_self.draw_from_inventory",
  "taskId": "core:arm_self",
  "description": "Draw weapon from inventory",

  "applicability": {
    "description": "Weapon must be in inventory",
    "condition": {
      "and": [
        {"has_component": ["task.params.weapon", "core:in_inventory"]},
        {"not": {"has_component": ["task.params.weapon", "core:equipped"]}}
      ]
    }
  },

  "steps": [
    {
      "stepType": "primitive_action",
      "actionId": "equipment:equip_weapon",
      "targetBindings": {
        "weapon": "task.params.weapon"
      },
      "parameters": {
        "hand": "primary",
        "ready": true,
        "quick_draw": true
      },
      "description": "Draw and equip weapon"
    }
  ],

  "fallbackBehavior": "replan"
}
```

**Method ID format:** `modId:task_id.method_name`
- Must match task ID in the first part
- Method name describes the strategy

### Step 7: Set Cost and Priority

```json
"cost": 15,
"priority": 70
```

**Cost** (default: 10):
- Computational cost for planning this task
- Higher = more expensive to plan
- Simple tasks: 5-10
- Medium tasks: 10-20
- Complex tasks: 20-30

**Priority** (default: 50):
- Task selection preference
- Higher = preferred over lower priority tasks
- Survival tasks: 70-90
- Comfort tasks: 40-60
- Optional tasks: 20-40

### Step 8: Register in Mod Manifest

Add task to your mod's manifest:

```json
{
  "id": "my_mod",
  "version": "1.0.0",
  "name": "My Mod",
  "content": {
    "tasks": [
      "tasks/my_task.task.json",
      "tasks/another_task.task.json"
    ]
  }
}
```

## Common Patterns

### Pattern 1: Item Acquisition

```json
{
  "id": "my_mod:acquire_item",
  "description": "Obtain specific item type",
  "planningScope": "my_mod:desired_items",
  "planningPreconditions": [
    {
      "description": "Item must be accessible",
      "condition": {
        "or": [
          {"has_component": ["item", "core:in_reach"]},
          {"has_component": ["item", "core:tradeable"]}
        ]
      }
    }
  ],
  "planningEffects": [
    {
      "type": "ADD_COMPONENT",
      "parameters": {
        "entity": "item",
        "componentId": "core:in_inventory"
      }
    }
  ],
  "refinementMethods": [
    {
      "methodId": "my_mod:acquire_item.pick_up",
      "$ref": "refinement-methods/acquire_item.pick_up.refinement.json"
    },
    {
      "methodId": "my_mod:acquire_item.trade_for",
      "$ref": "refinement-methods/acquire_item.trade_for.refinement.json"
    }
  ]
}
```

### Pattern 2: Location-Based Task

```json
{
  "id": "my_mod:reach_location",
  "description": "Travel to specific location",
  "planningScope": "my_mod:known_locations",
  "structuralGates": {
    "description": "Actor must be mobile",
    "condition": {
      "has_component": ["actor", "core:can_move"]
    }
  },
  "planningPreconditions": [
    {
      "description": "Location must be reachable",
      "condition": {
        "has_component": ["location", "core:accessible"]
      }
    }
  ],
  "planningEffects": [
    {
      "type": "ADD_COMPONENT",
      "parameters": {
        "entity": "actor",
        "componentId": "my_mod:at_destination"
      }
    }
  ],
  "refinementMethods": [
    {
      "methodId": "my_mod:reach_location.walk",
      "$ref": "refinement-methods/reach_location.walk.refinement.json"
    }
  ]
}
```

### Pattern 3: Social Interaction

```json
{
  "id": "my_mod:persuade_npc",
  "description": "Convince NPC to take action",
  "planningScope": "my_mod:persuadable_npcs",
  "structuralGates": {
    "description": "Actor must be able to communicate",
    "condition": {
      "has_component": ["actor", "core:can_speak"]
    }
  },
  "planningPreconditions": [
    {
      "description": "NPC must be present and receptive",
      "condition": {
        "and": [
          {"has_component": ["npc", "core:conscious"]},
          {"not": {"has_component": ["npc", "my_mod:hostile_to_actor"]}}
        ]
      }
    }
  ],
  "planningEffects": [
    {
      "type": "ADD_COMPONENT",
      "parameters": {
        "entity": "npc",
        "componentId": "my_mod:convinced"
      }
    }
  ],
  "refinementMethods": [
    {
      "methodId": "my_mod:persuade_npc.charm",
      "$ref": "refinement-methods/persuade_npc.charm.refinement.json"
    },
    {
      "methodId": "my_mod:persuade_npc.intimidate",
      "$ref": "refinement-methods/persuade_npc.intimidate.refinement.json"
    }
  ]
}
```

## Testing Your Tasks

### Validation Tests

1. **Schema Validation**:
   ```bash
   npm run validate
   ```

2. **Loader Tests** (create unit test):
   ```javascript
   describe('Task Loading', () => {
     it('should load my_task correctly', async () => {
       // Test task loads without errors
       // Verify structure matches expected format
       // Check refinement methods resolve
     });
   });
   ```

### Integration Tests

1. **Planner Integration**:
   ```javascript
   describe('Task Planning', () => {
     it('should select task when preconditions met', () => {
       // Set up world state
       // Trigger planner
       // Verify task is selected
     });
   });
   ```

2. **Method Execution**:
   ```javascript
   describe('Refinement Method Execution', () => {
     it('should execute method steps correctly', () => {
       // Execute refinement method
       // Verify action sequence
       // Check effects applied
     });
   });
   ```

## Debugging

### Common Issues

#### Task Never Selected

**Symptoms**: Planner ignores your task

**Checklist**:
- ✓ Structural gates pass for actor
- ✓ Planning scope returns entities
- ✓ Preconditions satisfied
- ✓ Cost is reasonable
- ✓ Priority is appropriate

**Debug strategy**:
1. Enable GOAP logging
2. Check structural gate evaluation
3. Verify scope query results
4. Test preconditions individually

#### Method Not Applicable

**Symptoms**: Task selected but no method applies

**Checklist**:
- ✓ Method applicability conditions correct
- ✓ Task parameters bound correctly
- ✓ Entity states match expected values

**Debug strategy**:
1. Log method applicability evaluation
2. Check task parameter bindings
3. Verify entity component states

#### Effects Not Applied

**Symptoms**: Task completes but world state unchanged

**Checklist**:
- ✓ Effect operations registered
- ✓ Entity references correct
- ✓ Component IDs valid
- ✓ Operations executed

**Debug strategy**:
1. Add logging to operation handlers
2. Verify effect operations exist
3. Check entity IDs in effects

## Best Practices

### Design Principles

1. **Single Responsibility**: Each task achieves one clear goal
2. **Composability**: Tasks combine to achieve complex objectives
3. **Knowledge Limitation**: Respect what NPCs can know
4. **Modularity**: Reusable methods across tasks

### Performance

1. **Efficient Gates**: Fast structural checks
2. **Scoped Queries**: Limit planning scope size
3. **Reasonable Costs**: Balance planning time
4. **Cached Results**: Leverage planning cache

### Maintainability

1. **Clear Descriptions**: Document intent thoroughly
2. **Consistent Naming**: Follow mod conventions
3. **Logical Organization**: Group related tasks
4. **Version Control**: Track task changes

## Advanced Topics

### Conditional Methods

Create methods that only apply in specific situations:

```json
{
  "applicability": {
    "condition": {
      "and": [
        {"has_component": ["actor", "my_mod:skilled"]},
        {">=": [{"get_component": ["actor", "my_mod:skill_level"]}, 5]}
      ]
    }
  }
}
```

### Composite Steps

Methods can include conditional logic and nested sequences:

```json
{
  "steps": [
    {
      "stepType": "conditional",
      "condition": {"has_component": ["target", "my_mod:locked"]},
      "thenSteps": [
        {
          "stepType": "primitive_action",
          "actionId": "my_mod:unlock_target"
        }
      ]
    },
    {
      "stepType": "primitive_action",
      "actionId": "my_mod:interact_with_target"
    }
  ]
}
```

### Parameterized Tasks

Tasks can bind parameters for method use:

```json
{
  "planningEffects": [
    {
      "type": "BIND_PARAMETER",
      "parameters": {
        "name": "tool",
        "value": "task.params.selected_tool"
      }
    }
  ]
}
```

## See Also

- [GOAP System Specification](../specs/goap-system-specs.md)
- [Task Loading System](../goap/task-loading.md)
- [Refinement Method Schema](../../data/schemas/refinement-method.schema.json)
- [JSON Logic Guide](./json-logic-guide.md)
- [Scope DSL Reference](./scope-dsl.md)
