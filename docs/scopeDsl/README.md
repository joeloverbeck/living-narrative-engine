# ScopeDSL Comprehensive Modder's Guide

## Table of Contents

1. [Introduction](#introduction)
2. [Core Concepts](#core-concepts)
3. [Basic Syntax](#basic-syntax)
4. [Sources](#sources)
5. [Property Access & Navigation](#property-access--navigation)
6. [Filtering with JSON Logic](#filtering-with-json-logic)
7. [Union Operations](#union-operations)
8. [Special Resolvers](#special-resolvers)
9. [Advanced Patterns](#advanced-patterns)
10. [Performance Considerations](#performance-considerations)
11. [Best Practices](#best-practices)
12. [Common Patterns Library](#common-patterns-library)

## Introduction

ScopeDSL is a domain-specific language for defining entity queries and selections in the Living Narrative Engine. It allows modders to create powerful, flexible scope definitions that determine which entities are available for actions, conditions, and other game mechanics.

### What is a Scope?

A scope is a query that resolves to a set of entity IDs. Scopes are used throughout the engine to:

- Define action targets (who can be targeted by an action)
- Filter entities based on conditions
- Navigate entity relationships
- Access entity components and properties

### File Format

Scope definitions are stored in `.scope` files within your mod's `scopes/` directory:

```
mods/your-mod/scopes/your_scope.scope
```

## Core Concepts

### Scope Definition Syntax

Each scope follows this basic pattern:

```
mod_id:scope_name := scope_expression
```

Example:

```
core:actors_in_location := entities(core:actor)[{"condition_ref": "core:entity-at-location"}]
```

### Comments

Use `//` for single-line comments:

```
// This scope returns all actors in the current location
core:actors_in_location := entities(core:actor)
```

### Namespace Requirements

All scope IDs must be namespaced with your mod ID:

- ✅ `my_mod:my_scope`
- ❌ `my_scope` (missing namespace)

## Basic Syntax

### Core Operators

| Operator    | Purpose              | Example                  |
| ----------- | -------------------- | ------------------------ |
| `.`         | Property access      | `actor.core:inventory`   |
| `[]`        | Array iteration      | `actor.items[]`          |
| `+` or `\|` | Union (combine sets) | `actor + location`       |
| `:`         | Namespace separator  | `core:actor`             |
| `[{...}]`   | JSON Logic filter    | `entities[{">": [...]}]` |

## Sources

Sources are the starting points for scope resolution:

### 1. actor

Returns the current actor (the entity performing the action):

```
actor
```

### 2. location

Returns the current location entity:

```
location
```

### 3. target

Returns the current target entity (if available in context):

```
target
```

### 4. entities(component)

Returns all entities with a specific component:

```
entities(core:actor)        // All actors
entities(core:item)         // All items
entities(clothing:garment)  // All clothing items
```

### 5. none

Returns an empty set (useful for actions without targets):

```
none
```

### 6. self

Returns the current entity in context:

```
self
```

## Property Access & Navigation

### Component Access

Access entity components using dot notation:

```
actor.core:stats           // Access stats component
actor.core:inventory.items // Access items within inventory
```

### Nested Property Access

Navigate through nested data structures:

```
actor.core:stats.strength        // Get strength value
actor.core:position.locationId   // Get location ID
location.core:exits[].target     // Get all exit targets
```

### Array Iteration

Use `[]` to iterate over arrays:

```
actor.items[]                    // All items in inventory
actor.core:followers.list[]      // All followers
entities(core:actor)[]           // All actors as individual results
```

### Chaining

Chain multiple operations:

```
location.core:exits[].target.core:description
// Gets descriptions of all locations connected to current location
```

## Filtering with JSON Logic

Filters use JSON Logic syntax to apply conditions:

### Basic Comparison

```
// Entities with level > 5
entities(core:actor)[{">": [{"var": "entity.components.core:stats.level"}, 5]}]

// Entities with specific name
entities(core:actor)[{"==": [{"var": "entity.components.core:name.value"}, "Guard"]}]

// Not equal comparison
entities(core:actor)[{"!=": [{"var": "id"}, {"var": "actor.id"}]}]
```

### Logical Operators

#### AND Conditions

```
entities(core:actor)[{
  "and": [
    {">": [{"var": "entity.components.core:stats.level"}, 5]},
    {"<": [{"var": "entity.components.core:health.current"}, 90]}
  ]
}]
```

#### OR Conditions

```
entities(core:actor)[{
  "or": [
    {">": [{"var": "entity.components.core:stats.strength"}, 20]},
    {">": [{"var": "entity.components.core:stats.agility"}, 15]}
  ]
}]
```

#### Complex Nested Conditions

```
entities(core:actor)[{
  "and": [
    {">=": [{"var": "entity.components.core:stats.level"}, 3]},
    {
      "or": [
        {">=": [{"var": "entity.components.core:stats.strength"}, 20]},
        {
          "and": [
            {">=": [{"var": "entity.components.core:stats.agility"}, 15]},
            {"<": [{"var": "entity.components.core:health.current"}, 80]}
          ]
        }
      ]
    }
  ]
}]
```

### Arithmetic Operations

Perform calculations within filters:

```
// Combined stats > 40
entities(core:actor)[{
  ">": [
    {
      "+": [
        {"var": "entity.components.core:stats.strength"},
        {"var": "entity.components.core:stats.agility"}
      ]
    },
    40
  ]
}]
```

### Condition References

Reference pre-defined conditions:

```
entities(core:actor)[{"condition_ref": "core:entity-at-location"}]

// Combine multiple condition references
entities(core:actor)[{
  "and": [
    {"condition_ref": "core:entity-at-location"},
    {"condition_ref": "core:entity-is-not-current-actor"},
    {"condition_ref": "core:entity-has-actor-component"}
  ]
}]
```

### Array Element Filtering

Filter elements within arrays:

```
// Items with quantity > 1
actor.core:inventory.items[{">": [{"var": "quantity"}, 1]}]

// Items of specific type
actor.core:inventory.items[{"==": [{"var": "type"}, "weapon"]}].name
```

## Union Operations

Combine multiple entity sets using union operators (`+` or `|`):

### Basic Union

```
// Combine actor and location
actor + location

// Alternative syntax (identical behavior)
actor | location
```

### Complex Unions

```
// All actors and all items
entities(core:actor) + entities(core:item)

// Multiple unions
actor + location + target

// Union with filtered sets
entities(core:actor)[{">": [{"var": "entity.components.core:stats.level"}, 5]}] +
entities(core:actor)[{"<": [{"var": "entity.components.core:stats.level"}, 3]}]
```

### Deduplication

Unions automatically deduplicate results:

```
// Even if actor appears in both sets, it's only included once
entities(core:actor) + entities(core:actor)
```

## Special Resolvers

The engine provides special resolvers for common patterns:

### Clothing Resolvers

```
// Topmost clothing items (prioritizes outer > base > underwear)
actor.topmost_clothing[]

// All clothing items
actor.all_clothing[]

// Specific slot
actor.topmost_clothing.torso_upper
actor.topmost_clothing.torso_lower

// Layer-specific clothing
actor.outer_clothing[]
actor.underwear[]
```

### Positioning Resolvers

```
// Actors within close proximity
actor.components.positioning:closeness.partners[]

// Available furniture
entities(furniture:seat)[{"condition_ref": "furniture:is-available"}]

// Furniture being used
actor.components.positioning:sitting.furniture
```

### Relationship Resolvers

```
// Followers
actor.components.core:followers.list[]

// Current partners
actor.components.intimacy:kissing.partner
```

## Advanced Patterns

### Multi-Mod Scope References

Reference scopes from other mods:

```
// Reference a scope from base mod
base:enhanced_actors

// Combine scopes from different mods
base:actors + extension:special_actors
```

### Dynamic Entity Selection

Select entities based on runtime conditions:

```
// Actors in same location as player
entities(core:actor)[{
  "==": [
    {"var": "entity.components.core:position.locationId"},
    {"var": "actor.components.core:position.locationId"}
  ]
}]
```

### Cascading Filters

Apply multiple filters in sequence:

```
// Get high-level actors, then filter by health
entities(core:actor)[
  {">": [{"var": "entity.components.core:stats.level"}, 10]}
][
  {">": [{"var": "entity.components.core:health.current"}, 50]}
]
```

### Null Safety

Handle missing components gracefully:

```
// Only entities with stats component will be evaluated
entities(core:actor)[{
  "and": [
    {"!=": [{"var": "entity.components.core:stats"}, null]},
    {">": [{"var": "entity.components.core:stats.level"}, 5]}
  ]
}]
```

## Error Handling

The ScopeDSL system includes comprehensive error handling with standardized error codes and environment-aware processing.

### Quick Start with Error Handling

When scope resolution fails, you'll receive standardized error messages with specific error codes:

```javascript
// Example error output
[ScopeDSL:FilterResolver] SCOPE_1001: Actor entity missing from context

// In development mode, you get detailed context:
{
  code: 'SCOPE_1001',
  category: 'missing_context',
  resolverName: 'FilterResolver',
  context: { /* sanitized context for debugging */ }
}
```

### Common Error Scenarios

#### Missing Context (SCOPE_1xxx)
```
// Error: SCOPE_1001 - Missing actor
my_scope := actor  // But actor not provided in context

// Fix: Ensure context includes required entities
```

#### Invalid Data (SCOPE_2xxx)
```
// Error: SCOPE_2005 - Invalid component ID
my_scope := entities(actor)  // Missing namespace

// Fix: Use namespaced component IDs
my_scope := entities(core:actor)
```

#### Resolution Failures (SCOPE_3xxx)
```
// Error: SCOPE_3001 - Scope not found
my_scope := other_mod:undefined_scope

// Fix: Ensure referenced scope exists
my_scope := other_mod:existing_scope
```

#### System Errors (SCOPE_4xxx)
```
// Error: SCOPE_4001 - Circular dependency
scope_a := scope_b
scope_b := scope_a  // Circular!

// Fix: Remove circular references
scope_a := actor
scope_b := location
```

### Error Code Categories

| Range | Category | Description |
|-------|----------|-------------|
| 1xxx | Context | Missing or invalid context data |
| 2xxx | Data Validation | Invalid data format or structure |
| 3xxx | Resolution | Failed resolution operations |
| 4xxx | System | System limits and constraints |
| 5xxx | Parse | Syntax and parsing errors |
| 6xxx | Configuration | Setup and configuration issues |
| 9xxx | Unknown | Unclassified or fallback errors |

### Debugging Tips

1. **Check error codes** - Each code indicates the specific problem
2. **Review context** - Development mode shows detailed context
3. **Validate syntax** - Use proper ScopeDSL syntax patterns
4. **Test incrementally** - Build complex scopes step by step

### For Developers

If you're implementing custom resolvers or working on the ScopeDSL system:

- [Error Handling Developer Guide](./error-handling-guide.md) - Complete implementation guide
- [Error Codes Reference](./error-codes-reference.md) - Full error code catalog
- [Migration Guide](../migration/scopedsl-error-handling-migration.md) - Updating existing resolvers

## Performance Considerations

### 1. Filter Early, Filter Often

Apply filters as early as possible to reduce the working set:

```
// Good: Filter at source
entities(core:actor)[{">": [{"var": "entity.components.core:stats.level"}, 5]}]

// Less optimal: Get all then filter later
entities(core:actor)[]
```

### 2. Use Component Filters

When using `entities()`, specify the most restrictive component:

```
// Good: Only queries actors
entities(core:actor)

// Less optimal: Queries all entities then filters
entities(core:position)[{"condition_ref": "core:entity-has-actor-component"}]
```

### 3. Avoid Deep Nesting

Limit navigation depth for better performance:

```
// Reasonable depth
actor.core:inventory.items[].name

// Avoid excessive nesting
actor.a.b.c.d.e.f.g.h.i.j
```

### 4. Cache Complex Conditions

For frequently used complex filters, create named conditions:

```
// Define once in conditions/
{
  "id": "my_mod:complex_filter",
  "logic": { /* complex logic here */ }
}

// Reference multiple times
entities(core:actor)[{"condition_ref": "my_mod:complex_filter"}]
```

### Performance Targets

Based on system testing:

- Simple scopes: < 10ms
- Moderate complexity: < 50ms
- Complex filters (100+ entities): < 200ms
- Very complex (1000+ entities): < 500ms

## Best Practices

### 1. Naming Conventions

Use descriptive, consistent names:

```
// Good
my_mod:actors_in_combat
my_mod:available_weapons
my_mod:hostile_npcs

// Avoid
my_mod:scope1
my_mod:temp
my_mod:x
```

### 2. Documentation

Always document complex scopes:

```
// Returns actors with level > 10 who are injured (health < 50%)
// Used for healing priority targeting
my_mod:injured_veterans := entities(core:actor)[{
  "and": [
    {">": [{"var": "entity.components.core:stats.level"}, 10]},
    {"<": [
      {"var": "entity.components.core:health.current"},
      {"*": [{"var": "entity.components.core:health.max"}, 0.5]}
    ]}
  ]
}]
```

### 3. Modular Design

Break complex scopes into smaller, reusable pieces:

```
// Base scopes
my_mod:all_weapons := entities(core:item)[{"condition_ref": "core:item-is-weapon"}]
my_mod:equipped_items := actor.core:equipment.equipped[]

// Composed scope
my_mod:equipped_weapons := my_mod:equipped_items[{"condition_ref": "core:item-is-weapon"}]
```

### 4. Error Handling

Design scopes to handle edge cases:

```
// Handle missing components gracefully
actor.core:inventory.items[] | none

// Provide fallbacks for missing data
target | actor  // Use actor if no target
```

### 5. Testing Patterns

Test scopes with various scenarios:

- Empty entity sets
- Missing components
- Null/undefined values
- Large datasets (performance)
- Circular references

## Common Patterns Library

### Get All Other Actors

```
core:other_actors := entities(core:actor)[{
  "!=": [{"var": "id"}, {"var": "actor.id"}]
}]
```

### Actors at Current Location

```
core:actors_here := entities(core:actor)[{
  "==": [
    {"var": "entity.components.core:position.locationId"},
    {"var": "actor.components.core:position.locationId"}
  ]
}]
```

### Items in Inventory

```
core:inventory_items := actor.core:inventory.items[]
```

### Available Actions Targets

```
// Combine multiple potential targets
my_mod:action_targets :=
  entities(core:actor)[{"condition_ref": "core:valid-target"}] +
  entities(core:item)[{"condition_ref": "core:interactable"}]
```

### Health-Based Selection

```
// Low health allies
my_mod:wounded_allies := entities(core:actor)[{
  "and": [
    {"condition_ref": "core:is-ally"},
    {"<": [
      {"var": "entity.components.core:health.current"},
      {"*": [{"var": "entity.components.core:health.max"}, 0.3]}
    ]}
  ]
}]
```

### Distance-Based Selection

```
// Nearby actors (using positioning component)
positioning:nearby_actors := entities(core:actor)[{
  "and": [
    {"condition_ref": "positioning:entity-at-location"},
    {"condition_ref": "positioning:within-interaction-range"}
  ]
}]
```

### Equipment Checks

```
// Actors with weapons equipped
combat:armed_actors := entities(core:actor)[{
  "and": [
    {"!=": [{"var": "entity.components.core:equipment.weapon"}, null]},
    {"!=": [{"var": "entity.components.core:equipment.weapon"}, "none"]}
  ]
}]
```

### Clothing State Checks

```
// Actors with exposed torso
intimacy:exposed_torso := entities(core:actor)[{
  "or": [
    {"==": [{"var": "entity.topmost_clothing.torso_upper"}, null]},
    {"condition_ref": "clothing:torso-is-exposed"}
  ]
}]
```

---

This guide covers the complete capabilities of the ScopeDSL system. For quick reference, see [quick-reference.md](quick-reference.md). For debugging help, see [troubleshooting.md](troubleshooting.md).
