# Scope-DSL Specification

## Overview

The Scope-DSL (Domain Specific Language) is a declarative language for defining action scopes in the Living Narrative Engine. It allows modders to specify how to find potential targets for actions without requiring hardcoded JavaScript implementations.

The DSL provides a way to traverse entity relationships, access components, and filter results using JSON Logic expressions, making the scope system fully data-driven and moddable.

## 1. Grammar (EBNF)

```ebnf
scope_expression = source_node, { edge_expression } ;
source_node = "actor" | "location" | "entities", "(", component_id, ")" ;
edge_expression = edge_syntax, [ filter_expression ] ;
edge_syntax = identifier | identifier, "[", "]" | "[", "]" ;
filter_expression = "[", json_logic_object, "]" ;
identifier = letter, { letter | digit | "_" } ;
component_id = [ "!" ], identifier, ":", identifier ;
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

### `location`

- **Description**: The current location entity where the action is taking place. The location is derived from the runtime context in which the scope is being evaluated.
- **Type**: Location entity reference.
- **Parameters**: None.
- **Context**: Available when the action context provides a location.
- **Examples**:
  - `location` - refers to the current location entity.

### `entities(ComponentId)`

- **Description**: All entities that have (or do not have) the specified component.
- **Type**: Set of entity references.
- **Parameters**:
  - `ComponentId`: Component identifier in format `mod:component_name`. To find entities without the component, prefix the ID with an exclamation mark (`!`).
- **Context**: Available globally.
- **Examples**:
  - `entities(core:item)` - all entities with the `core:item` component.
  - `entities(!core:hostile)` - all entities that do not have the `core:hostile` component.

## 3. Edge Syntax

### Identifier Edges

- **Format**: `identifier`
- **Description**: Navigate to a property of an object or a component of an entity. The identifier can be a simple property name or a full component ID (e.g., `core:inventory`).
- **Examples**:
  - `core:inventory` - access the inventory component.
  - `items` - access the items array within a component.
  - `followers` - access the followers array within a component.

### Array Edges

- **Format**: `identifier[]`
- **Description**: Navigate to a property that is an array and iterate over its elements.
- **Examples**:
  - `items[]` - iterate over each item in the items array.
  - `followers[]` - iterate over each follower in the followers array.
  - `exits[]` - iterate over each exit in the exits array.

### Standalone Array Iteration

- **Format**: `[]`
- **Description**: When used directly after a source node that returns a set of entities (like `entities(...)`), this iterates over that set. It is essential for applying filters to an initial set of entities.
- **Examples**:
  - `entities(core:item)[]` - functionally a pass-through, but prepares the set for filtering.
  - `entities(core:item)[][{"==":[...]}]]` - a common pattern to get all items, then iterate and filter them. The first `[]` is the iterator, the second `[...]` is the filter.
  -

## 4. Filter Syntax

### JSON Logic Filters

- **Format**: `[json_logic_object]`
- **Description**: Filter entities from the preceding part of the expression using JSON Logic.
- **Context**: The JSON Logic context provides the following variables:
  - `entity`: The current entity being evaluated.
  - `actor`: The entity performing the action.
  - `location`: The location entity where the action is taking place.
- **Examples**:
  - `[{"==": [{"var": "entity.components.core:item.type"}, "weapon"]}]` - only entities whose item type is "weapon".
  - `[{"!=": [{"var": "entity.id"}, {"var": "actor.id"}]}]` - exclude the actor from the results.

## 5. Union Operator

### Union (`+`)

- **Format**: `scope_expression + scope_expression`
- **Description**: Combine the results from two separate scope expressions into a single set.
- **Behavior**: Returns the union (unique combination) of the entity sets.
- **Example**: `actor.core:inventory.items[] + entities(core:item)[...]`

## 6. White-space & Comment Rules

### White-space

- **Spaces**: Ignored between tokens.
- **Newlines**: Ignored between tokens.
- **Tabs**: Treated as spaces.

### Comments

- **Format**: `// comment_text`
- **Scope**: From `//` to end of line.
- **Examples**:
  ```
  // Get all items in the actor's inventory
  actor.core:inventory.items[]
  ```

## 7. Expression Depth Limit

### Maximum Depth: 4

- **Definition**: Maximum number of chained property accesses (i.e., uses of `.`) or filters (`[{...}]`) from a source node. **Note**: A bare array iterator (`[]`) does not count towards this limit.
- **Purpose**: Prevent overly complex expressions, infinite recursion, and performance issues.
- **Examples**:
  - `actor.core:inventory.items[].components` (depth: 3) ✅
  - `actor.a.b.c.d` (depth: 4) ✅
  - `actor.a.b.c.d.e` (depth: 5) ❌
  - `entities(core:item)[][][][][].id` (depth: 1) ✅

## 8. Worked Examples

### Example 1: Followers Scope

**Goal**: Get all followers of the actor.

**DSL Expression**:

```
actor.core:leading.followers[]
```

**Explanation**:

- Start from the `actor` (source node).
- Navigate to the `core:leading` component.
- Access the `followers` property of that component.
- Use `[]` to iterate over the `followers` array, returning a set of entity IDs.

### Example 2: Nearby Items Scope

**Goal**: Get all items in the actor's inventory and in the current location.

**DSL Expression**:

```
actor.core:inventory.items[] + entities(core:item)[{"==": [{"var": "entity.components.core:position.locationId"}, {"var": "location.id"}]}]
```

**Explanation**:

- `actor.core:inventory.items[]`: Gets all items from the actor's inventory.
- `+`: Union operator to combine results.
- `entities(core:item)[...]`: Gets all entities that have the `core:item` component and then filters them to only include those in the current `location`.
- `[]`: Iterate over the set of entities

### Example 3: Environment Scope

**Goal**: Get all entities in the current location, excluding the actor.

**DSL Expression**:

```
entities(core:position)[{"and": [{"==": [{"var": "entity.components.core:position.locationId"}, {"var": "location.id"}]}, {"!=": [{"var": "entity.id"}, {"var": "actor.id"}]}]}]
```

**Explanation**:

- `entities(core:position)`: Starts with all entities that have a position component.
- `[...]`: Filters this set. The filter has two conditions joined by an `and`:
  1. The entity's location ID must match the contextual `location.id`.
  2. The entity's ID must not be the same as the `actor.id`.

### Example 4: Location Non-Items Scope

**Goal**: Get all entities in current location that are not items.

**DSL Expression**:

```
entities(!core:item)[{"==": [{"var": "entity.components.core:position.locationId"}, {"var": "location.id"}]}]
```

**Explanation**:

- `entities(!core:item)`: Starts with all entities that do not have the `core:item` component.
- `[...]`: Filters this set to only include entities whose location matches the contextual `location.id`.

### Example 5: Unlocked Exits Scope

**Goal**: Get all unlocked exits from current location

**DSL Expression**:

```
location.core:exits[{"==": [{"var": "locked"}, false]}].target
```

**Explanation**:

- `location`: Start with the current location entity.
- `core:exits`: Access its `core:exits` component, which contains an array of exit objects.
- `[...]`: Filters the array of exit objects to only include those where the `locked` property is `false`.
- `.target`: For each of the remaining unlocked exit objects, access its `target` property, which contains the ID of the destination room.

**Equivalent to**: New scope for unlocked exits

## 9. Integration with Action Definitions

The scope property in an action's definition (`.action.json` file) tells the engine which entities are potential targets. It should be referenced by name.

For clarity and reusability, scopes should be defined in `.scope` files within a mod's `scopes/` directory. Each `.scope` file can define one or more named scopes.

### `.scope` File Format:

The format is `scope_name := dsl_expression`.

**Example:** `core/scopes/social.scope`

```
// Defines the scope for an actor's followers
followers := actor.core:leading.followers[]
```

### Action Definition

The action then refers to this scope by its name. The engine will automatically resolve `followers` to `core:followers` based on the mod it was loaded from.

**Example:** `core/actions/dismiss.action.json`

```json
{
  "$schema": "http://example.com/schemas/action.schema.json",
  "id": "core:dismiss",
  "commandVerb": "dismiss",
  "name": "Dismiss",
  "description": "Dismisses a follower from your service.",
  "scope": "followers",
  "template": "dismiss {target}",
  "prerequisites": [
    {
      "logic": {
        "condition_ref": "core:target-is-actors-follower"
      },
      "failure_message": "You can only dismiss your own followers."
    }
  ]
}
```

## 10. Implementation Notes

### Parser Requirements

- Must parse the EBNF grammar exactly as specified.
- Must handle white-space and comments correctly.
- Must validate the expression depth limit during parsing.

### Performance Considerations

- The expression depth limit prevents infinite recursion.
- Caching of parsed expressions and/or resolved scopes is used to improve performance during a single game turn.

### Error Handling

- Invalid Syntax: The parser will throw a `ScopeSyntaxError` with detailed line and column information.
- **Cycle Detected**: The engine will throw a `ScopeCycleError` if it detects a circular reference in the expression (e.g., `actor.self.self`), preventing infinite loops.
- Missing components: The engine will handle attempts to access non-existent data gracefully, typically resulting in an empty set for that part of the expression.
- Invalid JSON Logic: Errors within a JSON Logic filter are caught and logged, with the filter evaluating to `false`.
- Depth Limit Exceeded: The parser will throw an error if an expression is more than 4 levels deep.
