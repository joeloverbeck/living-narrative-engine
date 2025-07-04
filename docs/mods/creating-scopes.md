# Creating New Scopes

## What is a Scope?

A **scope** defines what entities can be targeted by an action. Think of it as answering the question: "What can I interact with when I use this action?"

For example:

- A "pet" action might target only your pets
- A "talk" action might target people in the same room
- A "pick up" action might target items on the ground

Scopes use a simple language called **Scope-DSL** (Domain Specific Language) that lets you describe these relationships without needing to write code.

## File Placement

Scope files go in your mod's `scopes` directory:

```
data/mods/your-mod-name/scopes/
├── pets.scope
├── nearby_items.scope
└── friends.scope
```

**File naming rules:**

- Use lowercase letters, numbers, and underscores
- End with `.scope`
- Use descriptive names that explain what the scope targets
- Examples: `pets.scope`, `nearby_items.scope`, `friendly_npcs.scope`

## Scope-DSL Grammar Reference

### Basic Building Blocks

**Source Nodes** (where to start):

- `actor` - The person performing the action
- `location` - The current room/area
- `entities(component)` - All entities with a specific component
- `entities(!component)` - All entities **without** a specific component

**Navigation** (how to move through data):

- `component.field` - Access a field within a component
- `component.field[]` - Access an array and iterate over each item

**Filters** (how to narrow down results):

- `[{"==": [{"var": "field"}, "value"]}]` - Only include items where field equals value
- `[{"!=": [{"var": "field"}, "value"]}]` - Exclude items where field equals value

**Combining** (how to merge multiple sources):

- `scope1 + scope2` - Combine results from two different scopes

### Quick Reference

| Pattern                                 | Meaning                                   | Example                                                   |
| --------------------------------------- | ----------------------------------------- | --------------------------------------------------------- |
| `actor`                                 | The person doing the action               | `actor`                                                   |
| `location`                              | Current room                              | `location`                                                |
| `entities(core:item)`                   | All items in the game                     | `entities(core:item)`                                     |
| `entities(!core:item)`                  | All entities _without_ the item component | `entities(!core:item)`                                    |
| `component.field`                       | Access a field                            | `actor.core:inventory.items`                              |
| `component.field[]`                     | Iterate over array                        | `actor.core:inventory.items[]`                            |
| `[{"==": [{"var": "field"}, "value"]}]` | Filter by equality                        | `[{"==": [{"var": "entity.id"}, "pet1"]}]`                |
| `scope1 + scope2`                       | Combine scopes (union)                    | `actor.core:inventory.items[] + entities(core:item)[...]` |

For the complete grammar, see [Scope-DSL Specification](../scope-dsl.md).

## Step-by-Step Example: "Pets" Scope

Let's create a scope that finds all pets belonging to the actor. We'll build this step by step.

### Step 1: Plan Your Scope

First, think about what you want to target:

- **Goal**: Find all pets owned by the actor
- **Data structure**: Pets are stored in `actor.core:pets.petList[]`
- **Component**: Pets have a `core:pet` component

### Step 2: Start with the Actor

Begin with the actor (the person performing the action):

```
actor
```

### Step 3: Navigate to Pet Data

Access the pets component and its pet list:

```
actor.core:pets.petList[]
```

**Explanation:**

- `actor` - Start with the person doing the action
- `core:pets` - Access their pets component
- `petList` - Access the list of pet IDs
- `[]` - Iterate over each pet ID in the list

### Step 4: Test Your Scope

Create the file `data/mods/your-mod/scopes/pets.scope`:

```
actor.core:pets.petList[]
```

### Step 5: Use in an Action

Reference your scope in an action definition:

```json
{
  "id": "your-mod:pet_action",
  "name": "Pet",
  "target_domain": "pets",
  "template": "pet {target}"
}
```

### Step 6: Advanced Filtering (Optional)

If you want to only target friendly pets, you need to filter the list. This requires a specific two-step pattern: first iterate, then filter.

```
actor.core:pets.petList[][{"==": [{"var": "entity.components.core:pet.temperament"}, "friendly"]}]
```

**Explanation:**

- `actor.core:pets.petList`: Accesses the list of pet IDs.
- `[]`: The **first** pair of brackets is the **iterator**. It tells the engine to process each pet ID from the list.
- `[...]`: The **second** pair of brackets is the **filter**. It contains the JSON Logic that is applied to each entity as it's being iterated over. Only entities that pass the filter are included in the final result.

This `[iterator][filter]` pattern is widespread when you need to select a subset of entities from a larger group.

## Common Patterns

### 1. Items in Actor's Inventory

Get all item entities from the actor's inventory component.

```
actor.core:inventory.items[]
```

### 2. Entities in Current Location

Start with all entities that have a position, then filter them to the current location.

```
entities(core:position)[][{"==": [{"var": "entity.components.core:position.locationId"}, {"var": "location.id"}]}]
```

### 3. Items in Current Location

```
entities(core:item)[{"==": [{"var": "entity.components.core:position.locationId"}, {"var": "location.id"}]}]
```

### 4. People in Current Location (excluding actor)

Same as above, but add a second condition to the filter to exclude the actor.

```
entities(core:character)[][{"and": [
{"==": [{"var": "entity.components.core:position.locationId"}, {"var": "location.id"}]},
{"!=": [{"var": "entity.id"}, {"var": "actor.id"}]}
]}]
```

### 5. Combining Inventory and Location Items

Get items from the actor's inventory and items on the ground in the current location.

```
actor.core:inventory.items[] + entities(core:item)[][{"==": [{"var": "entity.components.core:position.locationId"}, {"var": "location.id"}]}]
```

### 6. Filtering by a Component's Data

Get all entities with a `core:weapon` component whose weapon type is "sword".

```
entities(core:weapon)[][{"==": [{"var": "entity.components.core:weapon.type"}, "sword"]}]
```

## Linting & Common Errors

### Common Syntax Errors

**❌ Missing brackets for array iteration:**

```
actor.core:pets.petList  // Wrong - missing []
```

**✅ Correct:**

```
actor.core:pets.petList[]  // Right - includes []
```

**❌ Wrong component ID format:**

```
actor.pets.petList[]  // Wrong - missing mod: prefix
```

**✅ Correct:**

```
actor.core:pets.petList[]  // Right - includes mod: prefix
```

**❌ Invalid JSON Logic syntax:**

```
[{"==": "entity.id", "pet1"}]  // Wrong - missing proper structure
```

**✅ Correct:**

```
[{"==": [{"var": "entity.id"}, "pet1"]}]  // Right - proper JSON Logic
```

### Common Logic Errors

**❌ Trying to access non-existent components:**
This is safe but will result in an empty list.

```
actor.core:magic.spells[]  // Returns nothing if core:magic doesn't exist
```

**✅ Best Practice: Start with entities that have the component:**
This is more efficient and clearer.

```
entities(core:magic)[].spells[]
```

**❌ Exceeding Expression Depth (Max 4):**
Expressions cannot chain more than 4 property access (`.`) or filter (`[...]`) steps after the source node. This prevents overly complex and slow scopes.

```
// This has a depth of 5, which is an error.
actor.a.b.c.d.e // ❌
```

**✅ Keep expression depth at 4 or less:**

```
actor.a.b.c.d // ✅
```

**❌ Creating an Infinite Loop (Cycle):**
The engine will also detect and prevent scopes that reference themselves in a loop.

```
actor.leader.follower.leader // ❌ The engine would throw a ScopeCycleError.
```

### Testing Your Scope

1. **Check syntax**: Ensure your scope file has no syntax errors
2. **Test with simple data**: Start with basic examples before adding filters
3. **Verify component names**: Make sure component IDs match your data structure
4. **Test edge cases**: What happens when no entities match?

### Debugging Tips

**Use comments to document your scope:**

```
// Get all friendly pets owned by the actor
actor.core:pets.petList[][{"==": [{"var": "entity.components.core:pet.temperament"}, "friendly"]}]
```

**Break complex scopes into parts:**

```
// Step 1: Get all pets
actor.core:pets.petList[]
// Step 2: Filter to friendly pets only
[{"==": [{"var": "entity.components.core:pet.temperament"}, "friendly"]}]
```

**Test incrementally:**

1. Start with `actor` - does this work?
2. Add `actor.core:pets` - does this work?
3. Add `actor.core:pets.petList[]` - does this work?
4. Add filters - do they work?

## Best Practices

### 1. Use Descriptive Names

- `pets.scope` ✅ (clear what it targets)
- `scope1.scope` ❌ (unclear purpose)

### 2. Keep Scopes Simple

- Start simple, add complexity only when needed
- Break complex scopes into multiple files if possible

### 3. Document Your Scopes

- Add comments explaining what the scope does
- Include examples of expected data structure

### 4. Test Thoroughly

- Test with empty data (no pets, no items, etc.)
- Test with edge cases (very large lists, missing components)

### 5. Follow Naming Conventions

- Use lowercase with underscores for file names
- Use descriptive component and field names

## Getting Help

If you're stuck:

1. **Check existing scopes** in `data/mods/core/scopes/` for examples
2. **Read the full grammar** in [Scope-DSL Specification](../scope-dsl.md)
3. **Test with simple examples** first
4. **Use comments** to document what you're trying to achieve

Remember: Scopes are just a way to describe "what can I target?" in a simple, readable format. Start simple and build up complexity as needed!
