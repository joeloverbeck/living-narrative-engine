# Ticket: Create Modder Documentation

## Ticket ID: PHASE5-TICKET15
## Priority: Low
## Estimated Time: 8-10 hours
## Dependencies: PHASE4-TICKET14
## Blocks: PHASE5-TICKET16, PHASE5-TICKET17

## Overview

Create comprehensive documentation for modders who want to create and use multi-target actions. This documentation serves as the primary reference for understanding how to design, implement, and debug multi-target actions in the Living Narrative Engine.

## Goals

1. **Complete Reference**: Comprehensive guide covering all multi-target features
2. **Tutorial Format**: Step-by-step tutorials for common patterns
3. **Best Practices**: Guidelines for efficient and maintainable action design
4. **Troubleshooting**: Common issues and solutions
5. **Examples Library**: Rich collection of working examples

## Documentation Structure

1. **Getting Started Guide**: Basic concepts and simple examples
2. **Reference Manual**: Complete API documentation
3. **Tutorial Series**: Progressive learning path
4. **Best Practices Guide**: Design patterns and optimization
5. **Troubleshooting Guide**: Common issues and debugging

## Implementation Steps

### Step 1: Getting Started Guide

Create file: `docs/modding/multi-target-actions/getting-started.md`

```markdown
# Getting Started with Multi-Target Actions

Multi-target actions allow a single action to work with multiple entities simultaneously, enabling complex interactions that would be difficult to achieve with single-target actions.

## What Are Multi-Target Actions?

Traditional actions work with a single target:
```json
{
  "id": "core:talk_to",
  "name": "talk to {target}",
  "targetDefinitions": {
    "target": {
      "scope": "location.core:actors[]",
      "validation": { "conscious": true }
    }
  }
}
```

Multi-target actions can work with multiple targets:
```json
{
  "id": "examples:give_item_to_person",
  "name": "give {item} to {person}",
  "targetDefinitions": {
    "item": {
      "scope": "actor.core:inventory.items[]",
      "validation": { "giftable": true }
    },
    "person": {
      "scope": "location.core:actors[]",
      "validation": { "conscious": true }
    }
  }
}
```

## Key Concepts

### Target Definitions

Each target in a multi-target action has its own definition:

- **Name**: Identifier used in action text and operations
- **Scope**: Expression that finds potential targets
- **Validation**: Rules that targets must satisfy
- **Context Dependency**: Whether target resolution depends on other targets

### Target Resolution Order

Targets are resolved in the order they appear in the `targetDefinitions` object. This matters for context-dependent targets.

### Context Variables

Later targets can access data from earlier targets:

```json
{
  "targetDefinitions": {
    "container": {
      "scope": "location.core:objects[]",
      "validation": { "locked": true }
    },
    "key": {
      "scope": "actor.core:inventory.items[]",
      "contextFrom": "container",
      "validation": {
        "key_types_match_container": true
      }
    }
  }
}
```

## Your First Multi-Target Action

Let's create a simple "throw item at target" action:

### Step 1: Define the Action Structure

```json
{
  "id": "my_mod:throw_item",
  "name": "throw {item} at {target}",
  "description": "Throw an item at someone or something",
  "category": "interaction"
}
```

### Step 2: Define Target Definitions

```json
{
  "targetDefinitions": {
    "item": {
      "name": "item",
      "description": "Item to throw",
      "scope": "actor.core:inventory.items[]",
      "required": true,
      "validation": {
        "type": "object",
        "properties": {
          "components": {
            "type": "object",
            "properties": {
              "core:item": {
                "type": "object",
                "properties": {
                  "throwable": { "type": "boolean", "const": true }
                }
              }
            }
          }
        }
      }
    },
    "target": {
      "name": "target",
      "description": "What to throw at",
      "scope": "location.core:actors[] | location.core:objects[]",
      "required": true,
      "validation": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "not": { "const": "actor.id" }
          }
        }
      }
    }
  }
}
```

### Step 3: Add Conditions and Effects

```json
{
  "conditions": [
    {
      "description": "Must be close enough to target",
      "condition": {
        "<=": [{ "var": "distance_to_target" }, 5]
      }
    }
  ],
  "effects": [
    {
      "description": "Remove item from inventory",
      "operation": {
        "type": "modifyComponent",
        "entityId": "actor.id",
        "componentId": "core:inventory",
        "modifications": {
          "items": {
            "operation": "remove",
            "value": "item.id"
          }
        }
      }
    },
    {
      "description": "Dispatch throw event",
      "operation": {
        "type": "dispatchEvent",
        "eventType": "ITEM_THROWN",
        "payload": {
          "actorId": "actor.id",
          "itemId": "item.id",
          "targetId": "target.id"
        }
      }
    }
  ],
  "command": "throw {item.components.core:item.name} at {target.components.core:actor.name || target.components.core:object.name}",
  "result": "You throw {item.components.core:item.name} at {target.components.core:actor.name || target.components.core:object.name}."
}
```

### Step 4: Test Your Action

Create test entities and verify the action works:

```javascript
// In your test file
const player = testBed.createEntity('player', {
  'core:inventory': { items: ['rock'] }
});

const rock = testBed.createEntity('rock', {
  'core:item': { name: 'Rock', throwable: true }
});

const target = testBed.createEntity('dummy', {
  'core:object': { name: 'Training Dummy' }
});

const result = await actionProcessor.process(
  'my_mod:throw_item',
  'player',
  context
);

expect(result.success).toBe(true);
```

## Common Patterns

### Independent Targets

Targets that don't depend on each other:

```json
{
  "targetDefinitions": {
    "weapon": { "scope": "actor.core:inventory.weapons[]" },
    "enemy": { "scope": "location.core:actors[{\"faction\": \"hostile\"}]" }
  }
}
```

### Context-Dependent Targets

Later targets use data from earlier ones:

```json
{
  "targetDefinitions": {
    "lock": {
      "scope": "location.core:objects[{\"locked\": true}]"
    },
    "key": {
      "scope": "actor.core:inventory.items[]",
      "contextFrom": "lock",
      "validation": {
        "compatible_with_lock": true
      }
    }
  }
}
```

### Multiple Similar Targets

Multiple targets of the same type:

```json
{
  "targetDefinitions": {
    "primary_target": { "scope": "location.core:actors[]" },
    "secondary_target": { 
      "scope": "location.core:actors[]",
      "validation": {
        "not_same_as_primary": true
      }
    }
  }
}
```

## Next Steps

1. Read the [Reference Manual](reference.md) for complete API documentation
2. Follow the [Tutorial Series](tutorials/index.md) for in-depth examples
3. Study the [Best Practices Guide](best-practices.md) for optimization tips
4. Check the [Troubleshooting Guide](troubleshooting.md) when you run into issues

## Quick Reference

### Target Definition Properties

- `name`: Human-readable name
- `description`: Explanation of target's purpose
- `scope`: Scope DSL expression to find targets
- `required`: Whether target is mandatory (default: true)
- `contextFrom`: Which target to use for context (optional)
- `validation`: JSON Schema for target validation
- `maxCombinations`: Limit for multiple target combinations

### Context Variables

- `actor`: Entity performing the action
- `location`: Current location
- `game`: Game state
- `target`: Primary target (when contextFrom specified)
- `targets`: All resolved targets by name

### Common Scope Patterns

- `actor.core:inventory.items[]` - Actor's items
- `location.core:actors[]` - People in location
- `location.core:objects[]` - Objects in location
- `target.core:inventory.items[]` - Target's items (context-dependent)
```

### Step 2: Reference Manual

Create file: `docs/modding/multi-target-actions/reference.md`

```markdown
# Multi-Target Actions Reference Manual

Complete API documentation for multi-target actions in the Living Narrative Engine.

## Action Definition Schema

### Root Properties

```json
{
  "id": "string",              // Unique action identifier (mod:action_name)
  "name": "string",            // Display name with {target} placeholders
  "description": "string",     // Human-readable description
  "category": "string",        // Action category for organization
  "targetDefinitions": {},     // Target definitions (see below)
  "conditions": [],            // Action conditions (JSON Logic)
  "effects": [],               // Action effects (operations)
  "command": "string",         // Command text template
  "result": "string",          // Result text template
  "maxCombinations": "number"  // Limit target combinations (default: 100)
}
```

### Target Definitions

The `targetDefinitions` object contains target specifications:

```json
{
  "targetDefinitions": {
    "target_name": {
      "name": "string",           // Display name
      "description": "string",    // Purpose description
      "scope": "string",          // Scope DSL expression
      "required": "boolean",      // Is target required (default: true)
      "contextFrom": "string",    // Target to use for context
      "validation": {},           // JSON Schema validation
      "maxCombinations": "number" // Per-target combination limit
    }
  }
}
```

### Target Definition Properties

#### `name` (required)
Human-readable name for the target used in UI and error messages.

```json
{
  "name": "item to throw"
}
```

#### `description` (required)
Explanation of what this target represents and how it's used.

```json
{
  "description": "An item from the actor's inventory that can be thrown"
}
```

#### `scope` (required)
Scope DSL expression that defines where to find potential targets.

```json
{
  "scope": "actor.core:inventory.items[]"
}
```

Common scope patterns:
- `actor.core:inventory.items[]` - Actor's items
- `location.core:actors[]` - People in location
- `location.core:objects[]` - Objects in location
- `target.core:inventory.items[]` - Target's items (context-dependent)
- `game.entities[]` - All game entities

#### `required` (optional, default: true)
Whether this target must be resolved for the action to be available.

```json
{
  "required": false
}
```

#### `contextFrom` (optional)
Specifies which previously resolved target to use as context for scope resolution.

```json
{
  "contextFrom": "container"  // Use "container" target as context
}
```

When specified, the scope can reference the context target:
```json
{
  "scope": "target.core:inventory.items[]"  // "target" refers to contextFrom target
}
```

#### `validation` (optional)
JSON Schema that potential targets must satisfy.

```json
{
  "validation": {
    "type": "object",
    "properties": {
      "components": {
        "type": "object",
        "properties": {
          "core:item": {
            "type": "object",
            "properties": {
              "throwable": { "type": "boolean", "const": true }
            }
          }
        }
      }
    }
  }
}
```

#### `maxCombinations` (optional)
Limits the number of combinations generated for this specific target.

```json
{
  "maxCombinations": 10  // Only generate up to 10 combinations for this target
}
```

## Context Variables

When using `contextFrom`, these variables are available in scopes:

### `target`
The entity specified by `contextFrom`.

```dsl
target.core:inventory.items[]
target.components.core:actor.name
target.id
```

### `targets`
Object containing all resolved targets keyed by definition name.

```dsl
targets.primary[0].core:inventory.items[]
targets.secondary[0].components.core:actor.name
```

### Standard Variables

Always available:
- `actor` - Entity performing the action
- `location` - Current location entity
- `game` - Global game state

## Scope DSL for Multi-Target Actions

### Basic Syntax

```dsl
# Simple property access
actor.core:inventory.items[]

# Filtered arrays
location.core:actors[{\"conscious\": true}]

# Union operations
location.core:actors[] | location.core:objects[]

# Context-dependent access
target.core:inventory.items[]
```

### Context-Dependent Patterns

```dsl
# Access target's properties
target.core:actor.name
target.components.core:health.current

# Filter based on target data
actor.core:inventory.items[{
  "<=": [
    {"var": "entity.components.core:item.price"},
    {"var": "target.components.core:inventory.gold"}
  ]
}]

# Multiple target context
targets.container[0].core:contents.items[{
  "in": [
    {"var": "targets.key[0].components.core:key.types"},
    {"var": "entity.components.core:lock.compatible_keys"}
  ]
}]
```

## Validation Patterns

### Component Validation

```json
{
  "validation": {
    "type": "object",
    "properties": {
      "components": {
        "type": "object",
        "properties": {
          "core:item": {
            "type": "object",
            "properties": {
              "type": { "type": "string", "const": "weapon" },
              "durability": { "type": "number", "minimum": 1 }
            },
            "required": ["type", "durability"]
          }
        },
        "required": ["core:item"]
      }
    }
  }
}
```

### Property Validation

```json
{
  "validation": {
    "type": "object",
    "properties": {
      "id": {
        "type": "string",
        "not": { "const": "actor.id" }  // Not the actor themselves
      }
    }
  }
}
```

### Context-Dependent Validation

```json
{
  "validation": {
    "type": "object",
    "properties": {
      "components": {
        "type": "object",
        "properties": {
          "core:key": {
            "type": "object",
            "properties": {
              "types": {
                "type": "array",
                "contains": {
                  "const": { "var": "target.components.core:container.lock_type" }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

## Performance Considerations

### Combination Limits

Control the number of target combinations generated:

```json
{
  "maxCombinations": 50,  // Global limit for the action
  "targetDefinitions": {
    "item": {
      "maxCombinations": 10,  // Per-target limit
      "scope": "actor.core:inventory.items[]"
    }
  }
}
```

### Efficient Scopes

Use specific scopes rather than broad ones:

```dsl
# Good - specific
actor.core:inventory.weapons[]

# Less efficient - broad with filter
actor.core:inventory.items[{"==": [{"var": "entity.type"}, "weapon"]}]
```

### Early Filtering

Put the most restrictive validation first:

```json
{
  "targetDefinitions": {
    "expensive_item": {
      "scope": "location.core:objects[{\">\": [{\"var\": \"entity.price\"}, 1000]}]",
      "validation": {
        "available": true
      }
    }
  }
}
```

## Error Handling

### Safe Context Access

```dsl
# Check existence before access
target.core:inventory ? target.core:inventory.items[] : []

# Provide defaults
target.core:actor.name || target.id
```

### Validation Errors

Handle missing or invalid targets gracefully:

```json
{
  "conditions": [
    {
      "description": "Validate target exists and is accessible",
      "condition": {
        "and": [
          { "!=": [{ "var": "target" }, null] },
          { "var": "target.components.core:actor.conscious" }
        ]
      }
    }
  ]
}
```

## Template Variables

### In Command Text

Reference resolved targets in command text:

```json
{
  "command": "give {item.components.core:item.name} to {person.components.core:actor.name}"
}
```

### In Effect Operations

Use target data in operations:

```json
{
  "effects": [
    {
      "operation": {
        "type": "modifyComponent",
        "entityId": "person.id",
        "componentId": "core:inventory",
        "modifications": {
          "items": {
            "operation": "add",
            "value": "item.id"
          }
        }
      }
    }
  ]
}
```

### In Event Payloads

Include target information in events:

```json
{
  "effects": [
    {
      "operation": {
        "type": "dispatchEvent",
        "eventType": "ITEM_GIVEN",
        "payload": {
          "giver": "actor.id",
          "receiver": "person.id",
          "item": "item.id",
          "itemName": "item.components.core:item.name"
        }
      }
    }
  ]
}
```

## Migration from Single-Target Actions

### Backward Compatibility

Multi-target actions are fully backward compatible. Existing single-target actions continue to work unchanged.

### Converting Single-Target to Multi-Target

1. Wrap existing target in `targetDefinitions`:

```json
// Old format
{
  "target": {
    "scope": "location.core:actors[]"
  }
}

// New format
{
  "targetDefinitions": {
    "target": {
      "scope": "location.core:actors[]"
    }
  }
}
```

2. Update templates to use new format:

```json
// Old
{
  "command": "talk to {target.name}"
}

// New
{
  "command": "talk to {target.components.core:actor.name}"
}
```

## Best Practices

### Target Naming
- Use descriptive names: `weapon`, `target`, `container`
- Avoid generic names: `thing`, `object`, `entity`
- Be consistent across related actions

### Scope Design
- Use the most specific scope possible
- Filter at the scope level when possible
- Cache expensive operations

### Validation Strategy
- Validate the most likely failure cases first
- Use meaningful error messages
- Handle edge cases gracefully

### Performance Optimization
- Set appropriate combination limits
- Use early filtering in scopes
- Avoid deep nesting in validation

### Documentation
- Include clear descriptions for all targets
- Document any special requirements
- Provide usage examples

## Common Patterns Reference

### Trading Actions
```json
{
  "targetDefinitions": {
    "item_to_give": {
      "scope": "actor.core:inventory.items[]",
      "validation": { "tradeable": true }
    },
    "person_to_trade_with": {
      "scope": "location.core:actors[]",
      "validation": { "willing_to_trade": true }
    }
  }
}
```

### Crafting Actions
```json
{
  "targetDefinitions": {
    "recipe": {
      "scope": "game.recipes[]",
      "validation": { "known_by_actor": true }
    },
    "tool": {
      "scope": "actor.core:inventory.items[]",
      "contextFrom": "recipe",
      "validation": { "compatible_with_recipe": true }
    }
  }
}
```

### Combat Actions
```json
{
  "targetDefinitions": {
    "weapon": {
      "scope": "actor.core:equipment.weapons[]",
      "validation": { "usable": true }
    },
    "target": {
      "scope": "location.core:actors[]",
      "validation": { "hostile_or_neutral": true }
    }
  }
}
```
```

### Step 3: Tutorial Series Index

Create file: `docs/modding/multi-target-actions/tutorials/index.md`

```markdown
# Multi-Target Actions Tutorial Series

Progressive tutorial series that teaches multi-target action development from basic concepts to advanced patterns.

## Tutorial Structure

### Beginner Level

1. **[Creating Your First Multi-Target Action](01-first-action.md)**
   - Basic concepts and simple two-target action
   - Target definitions and validation
   - Testing your action

2. **[Understanding Scope DSL](02-scope-dsl.md)**
   - Scope expressions for finding targets
   - Filtering and selection patterns
   - Common scope patterns

3. **[Adding Validation](03-validation.md)**
   - JSON Schema validation for targets
   - Common validation patterns
   - Error handling

### Intermediate Level

4. **[Context-Dependent Targets](04-context-dependent.md)**
   - Using contextFrom for dependent targets
   - Context variables and access patterns
   - Complex dependency chains

5. **[Performance Optimization](05-performance.md)**
   - Combination limits and performance
   - Efficient scope design
   - Profiling and debugging

6. **[Complex Interactions](06-complex-interactions.md)**
   - Multi-step actions with multiple targets
   - Conditional target resolution
   - Advanced validation patterns

### Advanced Level

7. **[System Integration](07-system-integration.md)**
   - Integrating with game systems
   - Event handling and state management
   - Cross-system interactions

8. **[Custom Patterns](08-custom-patterns.md)**
   - Creating reusable patterns
   - Advanced scope techniques
   - Custom validation helpers

9. **[Debugging and Troubleshooting](09-debugging.md)**
   - Common issues and solutions
   - Debug tools and techniques
   - Performance profiling

## Learning Path

### For New Modders
Start with tutorials 1-3 to understand the basics, then move to 4-6 for practical applications.

### For Experienced Modders
Review tutorial 4 for context concepts, then focus on 5-9 for advanced techniques.

### For System Developers
Focus on tutorials 7-9 for integration and debugging techniques.

## Prerequisites

- Basic understanding of JSON
- Familiarity with the Living Narrative Engine mod system
- Experience with single-target actions (recommended)

## Tutorial Code

All tutorial code is available in the `data/mods/examples/` directory. Each tutorial builds on the previous ones, creating a comprehensive example library.

## Support and Community

- **Documentation**: Complete reference manual
- **Examples**: Working code samples
- **Issues**: Report problems or request clarifications
- **Community**: Share patterns and best practices

## Next Steps

1. Start with [Creating Your First Multi-Target Action](01-first-action.md)
2. Work through tutorials in order
3. Practice with the provided examples
4. Experiment with your own action ideas
5. Share your creations with the community
```

### Step 4: Best Practices Guide

Create file: `docs/modding/multi-target-actions/best-practices.md`

```markdown
# Multi-Target Actions Best Practices

Guidelines for creating efficient, maintainable, and user-friendly multi-target actions.

## Design Principles

### 1. User Experience First

**Clear Action Names**
```json
// Good
{
  "name": "give {item} to {person}",
  "name": "unlock {container} with {key}"
}

// Avoid
{
  "name": "use {thing} on {target}",
  "name": "interact with {object}"
}
```

**Intuitive Target Order**
Present targets in logical order:
```json
{
  "targetDefinitions": {
    "item": { /* what you're giving */ },
    "recipient": { /* who receives it */ }
  }
}
```

**Meaningful Descriptions**
```json
{
  "item": {
    "name": "item to give",
    "description": "An item from your inventory that you want to give away"
  }
}
```

### 2. Performance Optimization

**Set Appropriate Limits**
```json
{
  "maxCombinations": 50,  // Global limit
  "targetDefinitions": {
    "item": {
      "maxCombinations": 10,  // Per-target limit
      "scope": "actor.core:inventory.items[]"
    }
  }
}
```

**Efficient Scope Design**
```json
// Efficient - filter at scope level
{
  "scope": "actor.core:inventory.weapons[]"
}

// Less efficient - filter after retrieval
{
  "scope": "actor.core:inventory.items[]",
  "validation": { "type": "weapon" }
}
```

**Early Filtering**
```json
{
  "scope": "location.core:actors[{\"and\": [{\"conscious\": true}, {\"!=\": [\"faction\", \"hostile\"]}]}]"
}
```

### 3. Maintainable Code

**Consistent Naming**
```json
// Good - consistent across actions
{
  "weapon": { "scope": "actor.core:equipment.weapons[]" },
  "target": { "scope": "location.core:actors[]" }
}

// Good - descriptive and specific
{
  "healing_potion": { "scope": "actor.core:inventory.potions[]" },
  "injured_ally": { "scope": "location.core:actors[{\"health\": {\"<\": 50}}]" }
}
```

**Modular Validation**
```json
{
  "validation": {
    "allOf": [
      { "$ref": "#/definitions/tradeable_item" },
      { "$ref": "#/definitions/actor_can_afford" }
    ]
  }
}
```

## Target Definition Patterns

### Independent Targets

For targets that don't depend on each other:

```json
{
  "targetDefinitions": {
    "weapon": {
      "scope": "actor.core:equipment.weapons[]",
      "validation": {
        "type": "object",
        "properties": {
          "components": {
            "type": "object",
            "properties": {
              "core:weapon": {
                "type": "object",
                "properties": {
                  "durability": { "type": "number", "minimum": 1 }
                }
              }
            }
          }
        }
      }
    },
    "enemy": {
      "scope": "location.core:actors[]",
      "validation": {
        "type": "object",
        "properties": {
          "components": {
            "type": "object",
            "properties": {
              "core:actor": {
                "type": "object",
                "properties": {
                  "faction": { "type": "string", "const": "hostile" }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

### Context-Dependent Targets

For targets that use data from other targets:

```json
{
  "targetDefinitions": {
    "container": {
      "scope": "location.core:objects[]",
      "validation": {
        "type": "object",
        "properties": {
          "components": {
            "type": "object",
            "properties": {
              "core:container": {
                "type": "object",
                "properties": {
                  "locked": { "type": "boolean", "const": true }
                }
              }
            }
          }
        }
      }
    },
    "key": {
      "scope": "actor.core:inventory.items[]",
      "contextFrom": "container",
      "validation": {
        "type": "object",
        "properties": {
          "components": {
            "type": "object",
            "properties": {
              "core:key": {
                "type": "object",
                "properties": {
                  "types": {
                    "type": "array",
                    "contains": {
                      "const": { "var": "target.components.core:container.lock_type" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

## Scope DSL Best Practices

### Efficient Context Usage

**Cache Expensive Lookups**
```dsl
# Good - cache target data
target_inventory := target.core:inventory.items[]
affordable_items := target_inventory[][{
  "<=": [
    {"var": "entity.components.core:item.price"},
    {"var": "actor.components.core:inventory.gold"}
  ]
}]

# Less efficient - repeated context access
target.core:inventory.items[][{
  "<=": [
    {"var": "entity.components.core:item.price"},
    {"var": "actor.components.core:inventory.gold"}
  ]
}]
```

**Safe Context Access**
```dsl
# Always check existence
target_items := target.core:inventory ? target.core:inventory.items[] : []

# Provide meaningful defaults
target_name := target.core:actor.name || target.core:item.name || target.id
```

**Optimize Filtering**
```dsl
# Good - use built-in filtering
weapons := actor.core:inventory.weapons[]

# Less efficient - manual filtering
weapons := actor.core:inventory.items[][{
  "==": [{"var": "entity.components.core:item.type"}, "weapon"]
}]
```

## Validation Strategies

### Layered Validation

1. **Scope-level filtering** (fastest)
2. **JSON Schema validation** (structural)
3. **Condition checking** (business logic)

```json
{
  "targetDefinitions": {
    "tradeable_item": {
      "scope": "actor.core:inventory.items[{\"tradeable\": true}]",  // Filter 1
      "validation": {  // Filter 2
        "type": "object",
        "properties": {
          "components": {
            "type": "object",
            "properties": {
              "core:item": {
                "type": "object",
                "properties": {
                  "value": { "type": "number", "minimum": 1 }
                }
              }
            }
          }
        }
      }
    }
  },
  "conditions": [  // Filter 3
    {
      "description": "Actor can afford to lose this item",
      "condition": {
        ">": [
          { "var": "actor.components.core:inventory.total_value" },
          { "*": [{ "var": "tradeable_item.components.core:item.value" }, 2] }
        ]
      }
    }
  ]
}
```

### Context-Aware Validation

```json
{
  "validation": {
    "type": "object",
    "if": {
      "properties": {
        "components": {
          "type": "object",
          "properties": {
            "core:key": {
              "type": "object"
            }
          }
        }
      }
    },
    "then": {
      "properties": {
        "components": {
          "type": "object",
          "properties": {
            "core:key": {
              "type": "object",
              "properties": {
                "types": {
                  "type": "array",
                  "contains": {
                    "const": { "var": "target.components.core:container.lock_type" }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

## Error Handling

### Graceful Degradation

```json
{
  "conditions": [
    {
      "description": "Validate all targets are still available",
      "condition": {
        "and": [
          { "!=": [{ "var": "item" }, null] },
          { "!=": [{ "var": "target" }, null] },
          { "var": "item.components.core:item.available" },
          { "var": "target.components.core:actor.conscious" }
        ]
      }
    }
  ]
}
```

### Meaningful Error Messages

```json
{
  "conditions": [
    {
      "description": "You must have the right type of key for this lock",
      "condition": {
        "in": [
          { "var": "container.components.core:container.lock_type" },
          { "var": "key.components.core:key.types" }
        ]
      }
    }
  ]
}
```

## Testing Strategies

### Unit Testing

Test each target definition independently:

```javascript
describe('Multi-Target Action - Give Item', () => {
  describe('Item Target', () => {
    it('should find tradeable items in inventory', () => {
      // Test item target resolution
    });
    
    it('should reject non-tradeable items', () => {
      // Test validation
    });
  });
  
  describe('Recipient Target', () => {
    it('should find conscious actors', () => {
      // Test recipient target resolution
    });
  });
});
```

### Integration Testing

Test the complete action flow:

```javascript
describe('Give Item Action Integration', () => {
  it('should complete full give item interaction', () => {
    // Test end-to-end action processing
  });
  
  it('should handle edge cases gracefully', () => {
    // Test error conditions
  });
});
```

### Performance Testing

```javascript
describe('Performance', () => {
  it('should handle large inventories efficiently', () => {
    // Create scenario with many items
    const start = performance.now();
    // Execute action
    const end = performance.now();
    expect(end - start).toBeLessThan(100); // 100ms limit
  });
});
```

## Documentation Standards

### Action Documentation

```json
{
  "id": "my_mod:give_item",
  "name": "give {item} to {person}",
  "description": "Give an item from your inventory to another character",
  "category": "social",
  "documentation": {
    "usage": "Use this action to transfer items to other characters",
    "examples": [
      "give potion to wounded ally",
      "give key to door guard"
    ],
    "notes": [
      "Both characters must be conscious",
      "Item must be marked as tradeable",
      "Action may trigger relationship changes"
    ]
  }
}
```

### Code Comments

```json
{
  "targetDefinitions": {
    "healing_item": {
      "name": "healing item",
      "description": "A medical item that can restore health",
      "scope": "actor.core:inventory.medical_items[]",
      "validation": {
        // Ensure item has healing properties and sufficient potency
        "type": "object",
        "properties": {
          "components": {
            "type": "object",
            "properties": {
              "medical:healing": {
                "type": "object",
                "properties": {
                  "potency": { "type": "number", "minimum": 1 }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

## Common Anti-Patterns

### Avoid These Mistakes

**Over-broad Scopes**
```json
// Avoid - too general
{
  "scope": "game.entities[]",
  "validation": { /* complex filtering */ }
}

// Better - specific scope
{
  "scope": "location.core:actors[]"
}
```

**Circular Dependencies**
```json
// Avoid - circular context
{
  "targetA": { "contextFrom": "targetB" },
  "targetB": { "contextFrom": "targetA" }
}
```

**Unsafe Context Access**
```json
// Avoid - no safety checks
{
  "scope": "target.core:inventory.items[]"
}

// Better - safe access
{
  "scope": "target.core:inventory ? target.core:inventory.items[] : []"
}
```

**Performance Killers**
```json
// Avoid - no limits
{
  "targetDefinitions": {
    "any_item": { "scope": "game.entities[]" },
    "any_target": { "scope": "game.entities[]" }
  }
}

// Better - appropriate limits
{
  "maxCombinations": 25,
  "targetDefinitions": {
    "item": { 
      "scope": "actor.core:inventory.items[]",
      "maxCombinations": 5
    },
    "target": { 
      "scope": "location.core:actors[]",
      "maxCombinations": 5
    }
  }
}
```

## Checklist for Quality Actions

### Before Implementation
- [ ] Clear, intuitive action name
- [ ] Logical target order
- [ ] Appropriate performance limits
- [ ] Well-defined scope expressions
- [ ] Comprehensive validation rules

### During Development
- [ ] Test with various entity configurations
- [ ] Verify context dependencies work correctly
- [ ] Check performance with large datasets
- [ ] Validate error handling
- [ ] Ensure backward compatibility

### Before Release
- [ ] Complete documentation
- [ ] Example usage scenarios
- [ ] Performance benchmarks
- [ ] Integration tests pass
- [ ] Code review completed

### Post-Release
- [ ] Monitor performance metrics
- [ ] Collect user feedback
- [ ] Update documentation as needed
- [ ] Plan future enhancements
- [ ] Share lessons learned

Follow these best practices to create multi-target actions that are efficient, maintainable, and provide excellent user experiences.
```

### Step 5: Troubleshooting Guide

Create file: `docs/modding/multi-target-actions/troubleshooting.md`

```markdown
# Multi-Target Actions Troubleshooting Guide

Common issues, solutions, and debugging techniques for multi-target actions.

## Common Issues

### 1. No Valid Target Combinations Found

**Symptoms:**
- Action doesn't appear in available actions list
- Error: "No valid target combinations found"

**Causes:**
- Overly restrictive scope definitions
- Invalid validation schemas
- Context dependency errors
- Performance limits too low

**Solutions:**

1. **Check Scope Expressions**
```json
// Debug: Temporarily broaden scope
{
  "scope": "location.core:actors[]"  // Instead of complex filtering
}
```

2. **Validate Schema Syntax**
```json
// Ensure proper JSON Schema format
{
  "validation": {
    "type": "object",  // Always specify type
    "properties": {
      "components": {
        "type": "object",
        "required": ["core:actor"]  // Check required arrays
      }
    }
  }
}
```

3. **Check Context Dependencies**
```json
// Ensure contextFrom target exists and is resolved first
{
  "targetDefinitions": {
    "container": { /* resolved first */ },
    "key": { 
      "contextFrom": "container"  // Depends on container
    }
  }
}
```

4. **Increase Limits**
```json
{
  "maxCombinations": 100,  // Increase if needed
  "targetDefinitions": {
    "item": {
      "maxCombinations": 20  // Per-target limit
    }
  }
}
```

### 2. Context Variables Not Working

**Symptoms:**
- Scope expressions with context fail
- Error: "Cannot resolve context variable"

**Causes:**
- Missing `contextFrom` property
- Circular dependencies
- Context target not resolved

**Solutions:**

1. **Verify Context Setup**
```json
{
  "targetDefinitions": {
    "primary": {
      "scope": "location.core:objects[]"
    },
    "secondary": {
      "contextFrom": "primary",  // Must specify this
      "scope": "target.core:inventory.items[]"
    }
  }
}
```

2. **Check Resolution Order**
```json
// Targets resolve in definition order
{
  "targetDefinitions": {
    "first": { /* no context dependency */ },
    "second": { "contextFrom": "first" },
    "third": { "contextFrom": "second" }
  }
}
```

3. **Debug Context Access**
```json
// Add safety checks
{
  "scope": "target ? target.core:inventory.items[] : []"
}
```

### 3. Performance Issues

**Symptoms:**
- Slow action processing
- UI freezes during target resolution
- Memory usage spikes

**Causes:**
- Too many target combinations
- Expensive scope expressions
- Deep context dependencies

**Solutions:**

1. **Set Appropriate Limits**
```json
{
  "maxCombinations": 50,  // Reasonable global limit
  "targetDefinitions": {
    "items": {
      "maxCombinations": 10,  // Limit per target
      "scope": "actor.core:inventory.items[]"
    }
  }
}
```

2. **Optimize Scope Expressions**
```json
// Efficient - filter at source
{
  "scope": "actor.core:inventory.weapons[]"
}

// Inefficient - filter after retrieval
{
  "scope": "actor.core:inventory.items[]",
  "validation": { "type": "weapon" }
}
```

3. **Use Early Filtering**
```json
{
  "scope": "location.core:actors[{\"and\": [{\"conscious\": true}, {\"faction\": \"friendly\"}]}]"
}
```

### 4. Validation Failures

**Symptoms:**
- Targets found but validation fails
- Unexpected validation errors

**Causes:**
- Incorrect JSON Schema syntax
- Missing entity components
- Type mismatches

**Solutions:**

1. **Simplify Validation**
```json
// Start simple and add complexity
{
  "validation": {
    "type": "object"
  }
}
```

2. **Check Component Structure**
```json
{
  "validation": {
    "type": "object",
    "properties": {
      "components": {
        "type": "object",
        "properties": {
          "core:item": {  // Verify component exists
            "type": "object"
          }
        },
        "required": ["core:item"]
      }
    }
  }
}
```

3. **Handle Missing Data**
```json
{
  "validation": {
    "type": "object",
    "properties": {
      "components": {
        "type": "object",
        "if": {
          "properties": {
            "core:item": { "type": "object" }
          }
        },
        "then": {
          "properties": {
            "core:item": {
              "properties": {
                "durability": { "type": "number", "minimum": 1 }
              }
            }
          }
        }
      }
    }
  }
}
```

### 5. Template Resolution Errors

**Symptoms:**
- Action text shows {undefined} or {null}
- Missing or incorrect command text

**Causes:**
- Invalid template variable paths
- Missing entity components
- Incorrect property access

**Solutions:**

1. **Use Safe Property Access**
```json
{
  "command": "give {item.components.core:item.name || 'item'} to {target.components.core:actor.name || 'target'}"
}
```

2. **Verify Property Paths**
```json
// Correct component access
{
  "command": "use {tool.components.core:item.name}"
}

// Incorrect - missing components
{
  "command": "use {tool.core:item.name}"
}
```

3. **Add Fallbacks**
```json
{
  "command": "{actor.components.core:actor.name} gives {item.components.core:item.name || item.id} to {recipient.components.core:actor.name || recipient.id}"
}
```

## Debugging Techniques

### 1. Enable Debug Logging

Add to your development configuration:

```javascript
// In your test setup
const debugConfig = {
  logging: {
    level: 'debug',
    categories: ['actions', 'scope', 'validation']
  }
};
```

### 2. Test Individual Components

**Test Scope Resolution**
```javascript
describe('Debug Scope Resolution', () => {
  it('should resolve basic scope', async () => {
    const result = await scopeInterpreter.evaluate(
      'actor.core:inventory.items[]',
      context
    );
    console.log('Scope result:', result);
  });
});
```

**Test Validation**
```javascript
describe('Debug Validation', () => {
  it('should validate target structure', () => {
    const isValid = ajvValidator.validate(
      validationSchema,
      testEntity
    );
    if (!isValid) {
      console.log('Validation errors:', ajvValidator.errors);
    }
  });
});
```

### 3. Use Simplified Test Cases

Create minimal test scenarios:

```javascript
describe('Debug Multi-Target Action', () => {
  beforeEach(() => {
    // Create minimal test environment
    testBed.createEntity('player', {
      'core:actor': { name: 'Player' },
      'core:inventory': { items: ['test_item'] }
    });
    
    testBed.createEntity('test_item', {
      'core:item': { name: 'Test Item', tradeable: true }
    });
    
    testBed.createEntity('npc', {
      'core:actor': { name: 'NPC', conscious: true }
    });
  });
  
  it('should process minimal action', async () => {
    const result = await actionProcessor.process(
      'test:give_item',
      'player',
      context
    );
    
    console.log('Action result:', JSON.stringify(result, null, 2));
  });
});
```

### 4. Performance Profiling

**Measure Resolution Time**
```javascript
describe('Performance Testing', () => {
  it('should resolve targets quickly', async () => {
    const start = performance.now();
    
    const result = await actionProcessor.process(
      actionId,
      actorId,
      context
    );
    
    const end = performance.now();
    const duration = end - start;
    
    console.log(`Resolution took ${duration}ms`);
    expect(duration).toBeLessThan(100);
  });
});
```

**Monitor Memory Usage**
```javascript
it('should not leak memory', () => {
  const initialMemory = process.memoryUsage().heapUsed;
  
  // Process many actions
  for (let i = 0; i < 100; i++) {
    actionProcessor.process(actionId, actorId, context);
  }
  
  // Force garbage collection
  global.gc();
  
  const finalMemory = process.memoryUsage().heapUsed;
  const leakage = finalMemory - initialMemory;
  
  console.log(`Memory leakage: ${leakage} bytes`);
  expect(leakage).toBeLessThan(1024 * 1024); // 1MB limit
});
```

## Diagnostic Tools

### 1. Action Inspector

Create a debug tool to inspect action processing:

```javascript
class ActionInspector {
  static async inspect(actionId, actorId, context) {
    console.log('=== Action Inspection ===');
    console.log('Action ID:', actionId);
    console.log('Actor ID:', actorId);
    console.log('Context:', JSON.stringify(context, null, 2));
    
    const action = await actionLoader.load(actionId);
    console.log('Action Definition:', JSON.stringify(action, null, 2));
    
    for (const [targetName, targetDef] of Object.entries(action.targetDefinitions)) {
      console.log(`\n--- Target: ${targetName} ---`);
      
      try {
        const scopeResult = await scopeInterpreter.evaluate(
          targetDef.scope,
          context
        );
        console.log('Scope Result:', scopeResult);
        
        const validTargets = scopeResult.filter(entity => {
          if (targetDef.validation) {
            return ajvValidator.validate(targetDef.validation, entity);
          }
          return true;
        });
        console.log('Valid Targets:', validTargets.length);
        
      } catch (error) {
        console.error('Target Resolution Error:', error);
      }
    }
  }
}
```

### 2. Scope Expression Tester

```javascript
class ScopeExpressionTester {
  static async test(expression, context) {
    console.log('Testing scope expression:', expression);
    
    try {
      const result = await scopeInterpreter.evaluate(expression, context);
      console.log('Result:', result);
      console.log('Result count:', Array.isArray(result) ? result.length : 1);
      
      return result;
    } catch (error) {
      console.error('Scope evaluation error:', error);
      throw error;
    }
  }
}
```

### 3. Validation Schema Tester

```javascript
class ValidationTester {
  static test(schema, entity) {
    console.log('Testing validation schema');
    console.log('Schema:', JSON.stringify(schema, null, 2));
    console.log('Entity:', JSON.stringify(entity, null, 2));
    
    const isValid = ajvValidator.validate(schema, entity);
    
    if (isValid) {
      console.log('✅ Validation passed');
    } else {
      console.log('❌ Validation failed');
      console.log('Errors:', ajvValidator.errors);
    }
    
    return isValid;
  }
}
```

## FAQ

### Q: Why aren't my targets being found?

A: Check these common issues:
1. Scope expression syntax errors
2. Entity components missing
3. Validation schema too restrictive
4. Performance limits too low

### Q: How do I debug context-dependent targets?

A: 
1. Verify the context target is resolved first
2. Check the `contextFrom` property is set correctly
3. Test context access with simple expressions
4. Add safety checks for missing context data

### Q: My action is slow. How can I optimize it?

A:
1. Set appropriate `maxCombinations` limits
2. Use specific scopes instead of broad filtering
3. Move validation to the scope level when possible
4. Profile with performance testing tools

### Q: How do I handle missing entity components?

A:
1. Use conditional validation schemas
2. Add existence checks in scopes
3. Provide fallback values in templates
4. Test with various entity configurations

### Q: What's the difference between scope filtering and validation?

A:
- **Scope filtering**: Fast, happens during entity collection
- **Validation**: Slower, detailed structural checking
- Use scope filtering for simple property checks
- Use validation for complex structural requirements

### Q: How do I test multi-target actions effectively?

A:
1. Test each target definition separately
2. Test with minimal entity setups
3. Test edge cases and error conditions
4. Use performance benchmarks
5. Test context dependencies thoroughly

## Getting Help

### Debug Information to Collect

When reporting issues, include:

1. **Action Definition** (JSON)
2. **Entity Structures** (relevant components)
3. **Context Data** (sanitized)
4. **Error Messages** (full stack traces)
5. **Expected vs Actual Behavior**
6. **Performance Measurements** (if relevant)

### Community Resources

- **Documentation**: Complete reference guides
- **Examples**: Working code samples
- **Forums**: Community discussions
- **Issues**: Bug reports and feature requests

### Professional Support

For complex debugging or performance optimization, consider:
- Code review services
- Performance auditing
- Custom debugging tools
- Training workshops

Remember: Most issues can be resolved by carefully checking scope expressions, validation schemas, and context dependencies. When in doubt, start with simple cases and build complexity gradually.
```

## Acceptance Criteria

1. ✅ Complete getting started guide with tutorial workflow
2. ✅ Comprehensive reference manual covering all API features
3. ✅ Tutorial series index with progressive learning path
4. ✅ Best practices guide with performance and design patterns
5. ✅ Troubleshooting guide with common issues and solutions
6. ✅ Documentation serves as primary modder reference
7. ✅ Examples and code samples throughout documentation
8. ✅ Clear explanations of context-dependent features
9. ✅ Performance optimization guidelines included
10. ✅ Debugging and diagnostic techniques documented

## Documentation Requirements

### For Modders
- Step-by-step tutorials from basic to advanced
- Complete API reference with examples
- Best practices for performance and maintainability
- Troubleshooting guide for common issues
- Rich example library with real-world scenarios

### For Developers
- Integration patterns for extending the system
- Performance profiling and optimization techniques
- Debug tools and diagnostic utilities
- Security considerations and validation patterns

## Future Enhancements

1. **Interactive Documentation**: Web-based examples that can be run and modified
2. **Video Tutorials**: Screen-recorded walkthroughs of complex patterns
3. **AI Documentation Assistant**: AI-powered help for writing actions
4. **Community Examples**: User-contributed action patterns and examples
5. **Localization**: Documentation in multiple languages for international modders