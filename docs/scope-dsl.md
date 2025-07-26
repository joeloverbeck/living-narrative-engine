# Scope-DSL Specification

## Overview

The Scope-DSL (Domain Specific Language) is a declarative language for defining action scopes in the Living Narrative Engine. It allows modders to specify how to find potential targets for actions without requiring hardcoded JavaScript implementations.

The DSL provides a way to traverse entity relationships, access components, and filter results using JSON Logic expressions, making the scope system fully data-driven and moddable.

## 1. Grammar (EBNF)

```ebnf
scope_expression = source_node, { edge_expression } ;
source_node = "actor" | "location" | ( "entities", "(", component_id, ")" ) ;
edge_expression = edge_syntax, [ filter_expression ] ;
edge_syntax = identifier | identifier, "[", "]" | "[", "]" ;
filter_expression = "[", json_logic_object, "]" ;
identifier = letter, { letter | digit | "_" } ;
component_id = [ "!" ], identifier, ":", identifier ;
letter = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M" | "N" | "O" | "P" | "Q" | "R" | "S" | "T" | "U" | "V" | "W" | "X" | "Y" | "Z" | "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i" | "j" | "k" | "l" | "m" | "n" | "o" | "p" | "q" | "r" | "s" | "t" | "u" | "v" | "w" | "x" | "y" | "z" ;
digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" ;
json_logic_object = /* Standard JSON Logic object as defined in json-logic for modders.md */ ;
union_expression = scope_expression, ( "+" | "|" ), scope_expression ;
max_expression_depth = 6 ;
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
- **Parameters**: None. The `location` source node does not accept parameters.
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
- **Description**: Navigate to a property that is an array and iterate over its elements. The engine automatically filters out null and undefined values from the array during iteration.
- **Behavior**: Non-string entity IDs are automatically filtered out when the array is expected to contain entity references.
- **Examples**:
  - `items[]` - iterate over each item in the items array.
  - `followers[]` - iterate over each follower in the followers array.
  - `exits[]` - iterate over each exit in the exits array.

### Standalone Array Iteration

- **Format**: `[]`
- **Description**: When used directly after a source node that returns a set of entities (like `entities(...)`), this iterates over that set. **This is mandatory for applying filters to entities from an `entities()` source**.
- **Critical Pattern**: For filtering entities from `entities()` sources, you **must** use the pattern `entities(component)[][filter]`:
  - First `[]` - **Required** iterator that prepares the entity set for filtering
  - Second `[...]` - The filter expression
- **Examples**:
  - `entities(core:item)[]` - prepares items for subsequent filtering
  - `entities(core:item)[][{"==": [{"var": "entity.id"}, "item1"]}]` - **correct** filtering pattern
  - `entities(core:item)[{"==": [{"var": "entity.id"}, "item1"]}]` - ❌ **incorrect** - missing required iterator

## 4. Special Resolvers

### Clothing Target Resolution

The Scope DSL supports specialized clothing operations for efficient clothing item targeting. These operations provide a much simpler alternative to complex JSON Logic expressions.

#### System Architecture

The clothing system uses a two-stage resolution process:
1. **Clothing Field Resolution** - Creates clothing access objects with layer and slot data
2. **Slot Access Resolution** - Extracts specific items from clothing slots with layer priority

#### Layer Priority System

Clothing layers are prioritized in the following order (highest to lowest priority):
- `outer` - Jackets, coats, outerwear
- `base` - Shirts, pants, basic clothing  
- `underwear` - Undergarments

#### Basic Syntax

```dsl
// Get all topmost clothing items (highest priority per slot)
all_removable := actor.topmost_clothing[]

// Get specific slot's topmost item (layer priority applied)
upper_shirt := actor.topmost_clothing.torso_upper
lower_pants := actor.topmost_clothing.torso_lower

// Get items from specific layers only
all_outer := actor.outer_clothing[]
all_base := actor.base_clothing[]
all_underwear := actor.underwear[]
```

#### Supported Clothing Fields

- `topmost_clothing` - Returns topmost layer items (outer > base > underwear priority)
- `all_clothing` - Returns items from all layers (no priority filtering)
- `outer_clothing` - Returns only outer layer items
- `base_clothing` - Returns only base layer items  
- `underwear` - Returns only underwear layer items

#### Supported Clothing Slots

- `torso_upper` - Upper torso clothing (shirts, jackets)
- `torso_lower` - Lower torso clothing (pants, skirts)
- `legs` - Leg clothing (stockings, leg warmers)
- `feet` - Footwear (shoes, boots, socks)
- `head_gear` - Head covering (hats, helmets)
- `hands` - Hand covering (gloves, mittens)
- `left_arm_clothing` - Left arm covering
- `right_arm_clothing` - Right arm covering

#### Implementation Details

**Clothing Access Objects**: The clothing fields (`topmost_clothing`, etc.) create special objects with:
- `__clothingSlotAccess: true` - Marker for clothing access objects
- `__isClothingAccessObject: true` - Additional validation marker
- `mode` - The layer mode (`topmost`, `all`, `outer`, `base`, `underwear`)
- `equipped` - The raw equipment data from the `clothing:equipment` component

**Slot Access**: When accessing a slot (e.g., `.torso_upper`), the system:
1. Validates the slot name against supported slots
2. Applies layer priority based on the clothing access object's mode
3. Returns the highest priority item for that slot

#### Advanced Examples

```dsl
// Remove all topmost clothing items with iteration
all_removable := actor.topmost_clothing[]

// Access specific slot with automatic layer priority
jacket := actor.topmost_clothing.torso_upper

// Get all outer layer items (jackets, coats, etc.)
outer_garments := actor.outer_clothing[]

// Combine with filters to find waterproof clothing
waterproof := actor.topmost_clothing[][{"in": ["waterproof", {"var": "entity.components.core:tags.tags"}]}]

// Union of specific slots
upper_and_lower := actor.topmost_clothing.torso_upper | actor.topmost_clothing.torso_lower

// Complex clothing queries with multiple layers
removable_items := actor.outer_clothing[] | actor.base_clothing.torso_upper
```

#### Error Handling

- **Missing Equipment Component**: Returns empty clothing access object with `equipped: {}`
- **Invalid Slot Names**: Ignored by slot access resolver (falls back to standard field resolution)
- **Empty Slot Data**: Returns empty sets gracefully
- **Non-String Entity IDs**: Filtered out during resolution

## 5. Filter Syntax

### JSON Logic Filters

- **Format**: `[json_logic_object]`
- **Description**: Filter entities from the preceding part of the expression using JSON Logic.
- **Context**: The JSON Logic context provides the following variables:
  - `entity`: The current entity being evaluated.
  - `actor`: The entity performing the action.
  - `location`: The location entity where the action is taking place.
- **Condition References**: JSON Logic filters can reference condition definitions using `condition_ref`:
  - `[{"condition_ref": "core:target-is-not-self"}]` - reference to a condition file.
  - `[{"and": [{"condition_ref": "core:target-is-actor"}, {"!=": [{"var": "entity.id"}, {"var": "actor.id"}]}]}]` - combining condition references with inline logic.
- **Examples**:
  - `[{"==": [{"var": "entity.components.core:item.type"}, "weapon"]}]` - only entities whose item type is "weapon".
  - `[{"!=": [{"var": "entity.id"}, {"var": "actor.id"}]}]` - exclude the actor from the results.
  - `[{"condition_ref": "core:target-is-not-self"}]` - use a condition reference for filtering.

## 6. Union Operators

### Union (`+` or `|`)

- **Format**: `scope_expression + scope_expression` or `scope_expression | scope_expression`
- **Description**: Combine the results from two separate scope expressions into a single set.
- **Behavior**: Returns the union (unique combination) of the entity sets. Both operators (`+` and `|`) produce **identical** results at both the parsing and resolution level.
- **Parsing**: Both operators are right-associative, meaning `a | b | c` is parsed as `a | (b | c)`.
- **Implementation**: Both operators generate identical AST structures and resolution behavior - they are true aliases of each other.
- **Examples**:
  - `actor.core:inventory.items[] + entities(core:item)[][]`
  - `actor.followers | actor.partners`
  - `actor.topmost_clothing.torso_upper | actor.topmost_clothing.torso_lower`
  - `entities(core:actor) + entities(core:npc)` ≡ `entities(core:actor) | entities(core:npc)`

**Implementation Note**: The pipe operator (`|`) was added as an alternative syntax for unions. Both `+` and `|` produce **completely identical** parsing trees and resolution behavior - choose whichever feels more natural for your use case.

## 7. White-space & Comment Rules

### White-space

- **Spaces**: Ignored between tokens.
- **Newlines**: Ignored between tokens (both Unix LF and Windows CRLF line endings are supported).
- **Tabs**: Treated as spaces.

### Comments

- **Format**: `// comment_text`
- **Scope**: From `//` to end of line.
- **Examples**:
  ```
  // Get all items in the actor's inventory
  actor.core:inventory.items[]
  ```

## 8. Expression Depth Limit

### Maximum Depth: 6

- **Definition**: Maximum number of chained property accesses (i.e., uses of `.`) or filters (`[{...}]`) from a source node.
- **Purpose**: Prevent overly complex expressions, infinite recursion, and performance issues.

#### Depth Calculation Rules

The engine calculates depth by counting different node types that contribute to expression complexity:

**Depth-Contributing Operations**:
- **Step nodes** (`.field`) - Each property access adds 1 to depth
- **Filter nodes** (`[{...}]`) - Each filter expression adds 1 to depth  
- **ArrayIterationStep nodes** (`[]`) - Each array iteration adds 1 to depth

**Special Cases**:
- **Source nodes** (`actor`, `location`, `entities()`) - Do not count towards depth (depth starts at 0)
- **Union nodes** (`+`, `|`) - Do not count towards depth (each side calculated independently)
- **Bare array iterator after source** - `entities(core:item)[]` - The `[]` immediately after `entities()` does count towards depth

#### Depth Calculation Examples

```dsl
// Depth 0: Source only
actor                                    // depth: 0 ✅

// Depth 1: Single step
actor.followers                          // depth: 1 ✅

// Depth 2: Step + array iteration  
actor.followers[]                        // depth: 2 ✅

// Depth 3: Multiple steps
actor.core:inventory.items               // depth: 3 ✅

// Depth 4: Steps + array iteration
actor.core:inventory.items[]             // depth: 4 ✅

// Depth 5: Steps + array + filter
actor.core:inventory.items[][filter]     // depth: 5 ✅

// Depth 6: Maximum allowed
actor.a.b.c.d.e.f                       // depth: 6 ✅

// Depth 7: Exceeds limit  
actor.a.b.c.d.e.f.g                     // depth: 7 ❌

// Special case: entities() with iterator
entities(core:item)[]                    // depth: 1 ✅ ([] counts)
entities(core:item)[][filter]            // depth: 2 ✅

// Union operations (each side calculated separately)
actor.followers + location.npcs          // left: depth 1, right: depth 1 ✅
```

#### Implementation Notes

- Depth is validated during AST traversal, not just parsing
- Each branch of a union is validated independently  
- Cycle detection runs before depth validation
- Exceeding depth limit throws `ScopeDepthError` with descriptive message

## 9. Worked Examples

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

### Example 6: Using Condition References

**Goal**: Get entities at location and that aren't the actor.

```
environment := entities(core:position)[
    {
  "and": [
    { "condition_ref": "core:entity-at-location" },
    { "condition_ref": "core:entity-is-not-current-actor" }
  ]
}]
```

**Explanation**:

- `entities(core:position)`: Get all entities that have the `core:position` component.
- `[{"and": [{ "condition_ref": "core:entity-at-location" },{"condition_ref": "core:entity-is-not-current-actor" }]}]`: Entities at the same context location, that aren't the actor.

## 10. Integration with Action Definitions

The scope property in an action's definition (`.action.json` file) tells the engine which entities are potential targets. It should be referenced by name.

For clarity and reusability, scopes should be defined in `.scope` files within a mod's `scopes/` directory. Each `.scope` file can define one or more named scopes.

### `.scope` File Format:

The format is `scope_name := dsl_expression`. Multiple scope definitions can exist in a single file.

**Scope Naming**: When defining scopes, use simple names without mod prefixes. The engine automatically namespaces scopes based on which mod they're loaded from. For example, a scope named `followers` in the `core` mod becomes `core:followers` at runtime.

**Example:** `core/scopes/social.scope`

```
// Defines the scope for an actor's followers
followers := actor.core:leading.followers[]

// Multiple scopes can be defined in one file
leaders := actor.core:following.leaders[]
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
        "condition_ref": "core:target-is-follower-of-actor"
      },
      "failure_message": "You can only dismiss your own followers."
    }
  ]
}
```

## 11. Data Validation and Type Safety

### Automatic Type Filtering

The scope engine automatically validates and filters data types to ensure type safety:

- **Entity ID Validation**: Only string entity IDs are accepted. Non-string values (numbers, objects, etc.) are automatically filtered out from results.
- **Null/Undefined Filtering**: When iterating over arrays, null and undefined values are automatically removed from the results.
- **Missing Data Handling**: Accessing non-existent properties returns empty sets or undefined values that are safely handled by subsequent operations.

### Internal Node Types

The parser creates different node types for different operations:

- **Step**: Created for property access (e.g., `.followers`)
- **ArrayIterationStep**: Created specifically for array iteration (e.g., `[]`)
- **Filter**: Created for JSON Logic filter expressions
- **Union**: Created for union operations

This distinction allows the engine to optimize different types of operations appropriately.

## 12. Implementation Notes

### Parser Requirements

- Must parse the EBNF grammar exactly as specified.
- Must handle white-space and comments correctly.
- Must validate the expression depth limit during parsing.

### Performance Considerations

- **Depth Limiting**: The expression depth limit (6) prevents infinite recursion and constrains evaluation complexity.
- **Caching Strategy**: Scope results are cached per game turn - the same scope expression will only be evaluated once per turn for efficiency.
- **Union Optimization**: Union operations use Set-based deduplication for optimal performance with large result sets.
- **Trace Context**: The engine supports optional trace context for debugging and performance monitoring of scope evaluations.

#### Performance Characteristics (Validated by Tests)

**Scope Resolution Times**:
- Simple scopes (`actor`, `location`): < 1ms  
- Complex filtering: < 10ms for moderate datasets
- Large dataset unions (2000+ entities): < 100ms target
- Deep expressions (depth 6): Performance scales linearly with depth

**Memory Usage**:
- Clothing access objects: Minimal overhead with lazy evaluation
- Filter contexts: Built on-demand and garbage collected post-evaluation
- Union results: Memory-efficient Set-based storage with automatic deduplication

**Scalability Factors**:
- **Entity Count**: Linear scaling for entity-based operations
- **Expression Depth**: Linear performance degradation per depth level  
- **Filter Complexity**: JSON Logic evaluation time depends on filter expression complexity
- **Union Size**: Set operations remain efficient even with large result sets

#### Best Practices for Performance

1. **Minimize Expression Depth**: Prefer shallower expressions where possible
2. **Use Efficient Filters**: Simple equality checks perform better than complex logic
3. **Cache-Friendly Patterns**: Reuse the same scope expressions within a turn
4. **Union Optimization**: Order union operands by expected result size (smaller first)

### Error Handling

- Invalid Syntax: The parser will throw a `ScopeSyntaxError` with detailed line and column information.
- **Cycle Detected**: The engine will throw a `ScopeCycleError` if it detects a circular reference in the expression (e.g., `actor.self.self`), preventing infinite loops.
- Missing components or fields: The engine will handle attempts to access non-existent data gracefully. Missing components return empty sets, while missing fields within components return undefined values that are filtered out during array operations. This ensures that scope expressions never throw errors due to missing data.
- Invalid JSON Logic: Errors within a JSON Logic filter are caught and logged, with the filter evaluating to `false`.
- Depth Limit Exceeded: The parser will throw an error if an expression is more than 6 levels deep.

## 13. Common Pitfalls and Best Practices

### Common Syntax Errors

**❌ CRITICAL ERROR: Missing iterator for entities() filter**

```
entities(core:position)[{"==": [{"var": "entity.id"}, "test"]}]
```

This syntax is **invalid** and will cause scope resolution to fail. The iterator `[]` between `entities()` and the filter is **mandatory**, not optional.

**✅ CORRECT: Include iterator before filter**

```
entities(core:position)[][{"==": [{"var": "entity.id"}, "test"]}]
```

The correct pattern is **always**: `entities(component)[]` for iteration, then `[filter]` for filtering. This double-bracket pattern is required by the scope resolution engine and cannot be omitted.

### Best Practices

1. **Always use iterator `[]` with entities() before filtering**: The pattern `entities(component)[][filter]` ensures proper AST generation and context propagation.

2. **Validate actor entity context**: When writing custom resolvers or extensions, always validate that the actor entity has a valid string ID.

3. **Test with edge cases**: Test your scopes with:
   - Empty entity sets
   - Missing components
   - Null/undefined values in arrays
   - Invalid entity IDs

4. **Use descriptive scope names**: Name your scopes clearly to indicate what they target (e.g., `potential_leaders` instead of `scope1`).

5. **Document complex filters**: Add comments in your `.scope` files to explain complex JSON Logic filters.

### Debugging Tips

If you encounter "actorEntity has invalid ID" errors:

1. Check your scope syntax - ensure you're using the correct `entities()[][filter]` pattern
2. Verify that the actor entity is properly initialized with a valid string ID
3. Check that context is properly propagated through the resolution chain

### Migration Guide

**CRITICAL**: If you have existing scopes with the pattern `entities(component)[filter]`, you **must** update them to:

```
entities(component)[][filter]
```

This is not optional - the single-bracket pattern will cause scope resolution failures. The double-bracket pattern is mandatory for proper AST generation and context propagation in the scope resolution engine.
