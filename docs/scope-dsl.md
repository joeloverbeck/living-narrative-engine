# Scope-DSL Specification

## Overview

The Scope-DSL (Domain Specific Language) is a declarative language for defining action scopes in the Living Narrative Engine. It allows modders to specify how to find potential targets for actions without requiring hardcoded JavaScript implementations.

The DSL provides a way to traverse entity relationships, access components, and filter results using JSON Logic expressions, making the scope system fully data-driven and moddable.

## 1. Grammar (EBNF)

```ebnf
scope_expression = source_node, { edge_expression } ;
source_node = "actor" | "location" | "entities", "(", component_id, ")" ;
edge_expression = edge_syntax, [ filter_expression ] ;
edge_syntax = identifier | identifier, "[", "]" ;
filter_expression = "[", json_logic_object, "]" ;
identifier = letter, { letter | digit | "_" } ;
component_id = identifier, ":", identifier ;
letter = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M" | "N" | "O" | "P" | "Q" | "R" | "S" | "T" | "U" | "V" | "W" | "X" | "Y" | "Z" | "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i" | "j" | "k" | "l" | "m" | "n" | "o" | "p" | "q" | "r" | "s" | "t" | "u" | "v" | "w" | "x" | "y" | "z" ;
digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" ;
json_logic_object = /* Standard JSON Logic object as defined in json-logic for modders.md */ ;
union_expression = scope_expression, "+", scope_expression ;
max_expression_depth = 4 ;
```

## 2. Reserved Source Nodes

### `actor`
- **Description**: The entity performing the action
- **Type**: Entity reference
- **Context**: Always available in action context
- **Example**: `actor` - refers to the acting entity

### `location(x)`
- **Description**: The current location of the specified entity
- **Type**: Location entity reference
- **Parameters**: 
  - `x`: Entity reference (defaults to `actor` if omitted)
- **Context**: Available when entity has a location component
- **Examples**: 
  - `location` - current location of the actor
  - `location(target)` - current location of the target entity

### `entities(ComponentId)`
- **Description**: All entities that have the specified component
- **Type**: Set of entity references
- **Parameters**:
  - `ComponentId`: Component identifier in format `mod:component_name`
- **Context**: Available globally
- **Example**: `entities(core:item)` - all entities with the core:item component

## 3. Edge Syntax

### Identifier Edges
- **Format**: `identifier`
- **Description**: Navigate to a property or component field
- **Examples**:
  - `inventory` - access the inventory component
  - `items` - access the items array within a component
  - `followers` - access the followers array within a component

### Array Edges
- **Format**: `identifier[]`
- **Description**: Navigate to an array property and iterate over its elements
- **Examples**:
  - `items[]` - iterate over each item in the items array
  - `followers[]` - iterate over each follower in the followers array
  - `exits[]` - iterate over each exit in the exits array

## 4. Filter Syntax

### JSON Logic Filters
- **Format**: `[json_logic_object]`
- **Description**: Filter entities using JSON Logic expressions
- **Context**: The JSON Logic context includes:
  - `entity`: The current entity being evaluated
  - `actor`: The acting entity
  - `target`: The target entity (if applicable)
  - `context`: General game context
- **Examples**:
  - `[{"==": [{"var": "entity.components.core:item.type"}, "weapon"]}]` - only weapons
  - `[{"!=": [{"var": "entity.id"}, {"var": "actor.id"}]}]` - exclude the actor

## 5. Union Operator

### Union (`+`)
- **Format**: `scope_expression + scope_expression`
- **Description**: Combine results from multiple scope expressions
- **Behavior**: Returns the union (unique combination) of entity sets
- **Example**: `actor.inventory.items[] + location.entities(core:item)[]`

## 6. White-space & Comment Rules

### White-space
- **Spaces**: Ignored between tokens
- **Newlines**: Ignored between tokens
- **Tabs**: Treated as spaces

### Comments
- **Format**: `// comment_text`
- **Scope**: From `//` to end of line
- **Examples**:
  ```
  actor.inventory.items[] // Get all items in actor's inventory
  location.entities(core:item)[] // Plus all items in current location
  ```

## 7. Expression Depth Limit

### Maximum Depth: 4
- **Definition**: Maximum number of edge traversals from source node
- **Purpose**: Prevent infinite recursion and performance issues
- **Examples**:
  - `actor.inventory.items[].components.core:stats` (depth: 3) ✅
  - `actor.inventory.items[].components.core:stats.attributes.strength` (depth: 5) ❌

## 8. Worked Examples

### Example 1: Followers Scope
**Goal**: Get all followers of the actor

**DSL Expression**:
```
actor.followers[]
```

**Explanation**:
- Start from the `actor` (source node)
- Navigate to the `followers` component
- Use `[]` to iterate over the followers array
- Each element in the array is an entity ID

**Equivalent to**: Current `followers` scope in entityScopeService

### Example 2: Nearby Items Scope
**Goal**: Get all items in actor's inventory and current location

**DSL Expression**:
```
actor.inventory.items[] + location.entities(core:item)[]
```

**Explanation**:
- `actor.inventory.items[]`: Get all items in actor's inventory
- `+`: Union operator to combine results
- `location.entities(core:item)[]`: Get all entities with core:item component in current location
- `[]`: Iterate over the set of entities

**Equivalent to**: Current `nearby` scope in entityScopeService

### Example 3: Environment Scope
**Goal**: Get all entities in the current location (excluding actor)

**DSL Expression**:
```
location.entities(core:entity)[][{"!=": [{"var": "entity.id"}, {"var": "actor.id"}]}]
```

**Explanation**:
- `location`: Get the current location
- `entities(core:entity)[]`: Get all entities in that location
- `[]`: Iterate over the entities
- `[{"!=": [{"var": "entity.id"}, {"var": "actor.id"}]}]`: Filter to exclude the actor

**Equivalent to**: Current `environment` scope in entityScopeService

### Example 4: Location Non-Items Scope
**Goal**: Get all entities in current location that are not items

**DSL Expression**:
```
location.entities(core:entity)[][{"==": [{"var": "entity.components.core:item"}, null]}]
```

**Explanation**:
- `location.entities(core:entity)[]`: Get all entities in current location
- `[]`: Iterate over the entities
- `[{"==": [{"var": "entity.components.core:item"}, null]}]`: Filter to only entities without core:item component

**Equivalent to**: Current `location_non_items` scope in entityScopeService

### Example 5: Unlocked Exits Scope
**Goal**: Get all unlocked exits from current location

**DSL Expression**:
```
location.exits[][{"==": [{"var": "entity.components.core:exit.locked"}, false]}]
```

**Explanation**:
- `location`: Get the current location
- `exits[]`: Get all exits from the location
- `[]`: Iterate over the exits
- `[{"==": [{"var": "entity.components.core:exit.locked"}, false]}]`: Filter to only unlocked exits

**Equivalent to**: New scope for unlocked exits

## 9. Integration with Action Definitions

### Action Schema Update
The `target_domain` field in action definitions will be updated to accept either:
1. **Legacy scope names**: For backward compatibility (`"inventory"`, `"environment"`, etc.)
2. **DSL expressions**: New DSL-based scope definitions

### Example Action Definition
```json
{
  "$schema": "http://example.com/schemas/action.schema.json",
  "id": "intimacy:kiss_cheek",
  "commandVerb": "kiss-cheek",
  "name": "Kiss Cheek",
  "description": "Lean in and softly kiss the target on the cheek.",
  "target_domain": "actor.followers[]",
  "template": "kiss {target}'s cheek",
  "prerequisites": [
    {
      "logic": {
        "condition_ref": "intimacy:target-is-actors-closeness-partner"
      },
      "failure_message": "You can only do that with the person you are currently close to."
    }
  ]
}
```

## 10. Implementation Notes

### Parser Requirements
- Must parse EBNF grammar exactly as specified
- Must handle white-space and comments
- Must validate expression depth limit
- Must integrate with existing JSON Logic evaluator

### Performance Considerations
- Expression depth limit prevents infinite recursion
- Lazy evaluation of filters to avoid unnecessary computation
- Caching of parsed expressions for reuse

### Backward Compatibility
- Legacy scope names (`"inventory"`, `"environment"`, etc.) continue to work
- Gradual migration path for existing mods
- Deprecation warnings for legacy scopes in future versions

### Error Handling
- Invalid syntax: Clear error messages with line/column information
- Missing components: Graceful handling (returns empty set)
- Invalid JSON Logic: Integration with existing JSON Logic error handling
- Depth limit exceeded: Clear error message with suggested fix 