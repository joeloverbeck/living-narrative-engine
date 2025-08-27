# ScopeDSL Quick Reference

## Basic Syntax

```
mod_id:scope_name := expression
```

## Sources

| Source | Description | Example |
|--------|-------------|---------|
| `actor` | Current actor | `actor` |
| `location` | Current location | `location` |
| `target` | Current target | `target` |
| `entities(component)` | All entities with component | `entities(core:actor)` |
| `none` | Empty set | `none` |
| `self` | Current entity | `self` |

## Operators

| Operator | Purpose | Example |
|----------|---------|---------|
| `.` | Property access | `actor.core:stats` |
| `[]` | Array iteration | `actor.items[]` |
| `+` or `\|` | Union | `actor + location` |
| `:` | Namespace | `core:actor` |
| `[{...}]` | Filter | `entities[{">": [...]}]` |

## JSON Logic Operators

### Comparison
- `==` Equal
- `!=` Not equal
- `>` Greater than
- `>=` Greater or equal
- `<` Less than
- `<=` Less or equal

### Logical
- `and` All conditions must be true
- `or` At least one condition must be true
- `not` Negation

### Arithmetic
- `+` Addition
- `-` Subtraction
- `*` Multiplication
- `/` Division
- `%` Modulo

### Variables
- `{"var": "path"}` Access variable
- `{"var": "entity.components.core:stats.level"}` Component access

## Common Filter Patterns

### Basic Comparison
```
[{">": [{"var": "entity.components.core:stats.level"}, 5]}]
```

### AND Condition
```
[{
  "and": [
    {"condition1"},
    {"condition2"}
  ]
}]
```

### OR Condition
```
[{
  "or": [
    {"condition1"},
    {"condition2"}
  ]
}]
```

### Condition Reference
```
[{"condition_ref": "core:condition-name"}]
```

### Not Equal to Current Actor
```
[{"!=": [{"var": "id"}, {"var": "actor.id"}]}]
```

### Same Location
```
[{
  "==": [
    {"var": "entity.components.core:position.locationId"},
    {"var": "actor.components.core:position.locationId"}
  ]
}]
```

## Special Resolvers

### Clothing
- `actor.topmost_clothing[]` - Topmost items by layer
- `actor.all_clothing[]` - All clothing
- `actor.outer_clothing[]` - Outer layer only
- `actor.underwear[]` - Underwear layer only
- `actor.topmost_clothing.slot_name` - Specific slot

### Common Component Paths
- `actor.core:stats.level` - Actor level
- `actor.core:health.current` - Current health
- `actor.core:inventory.items[]` - Inventory items
- `actor.core:position.locationId` - Actor's location
- `location.core:exits[]` - Location exits

## Complete Examples

### All Other Actors at Location
```
my_mod:other_actors_here := entities(core:actor)[{
  "and": [
    {"!=": [{"var": "id"}, {"var": "actor.id"}]},
    {
      "==": [
        {"var": "entity.components.core:position.locationId"},
        {"var": "actor.components.core:position.locationId"}
      ]
    }
  ]
}]
```

### High-Level Actors
```
my_mod:veterans := entities(core:actor)[{
  ">": [{"var": "entity.components.core:stats.level"}, 10]
}]
```

### Items with Quantity > 1
```
my_mod:stackable_items := actor.core:inventory.items[{
  ">": [{"var": "quantity"}, 1]
}]
```

### Union of Multiple Sources
```
my_mod:all_targets := 
  entities(core:actor) + 
  entities(core:item) + 
  entities(furniture:seat)
```

### Wounded Allies (< 30% health)
```
my_mod:wounded := entities(core:actor)[{
  "and": [
    {"condition_ref": "core:is-ally"},
    {
      "<": [
        {"var": "entity.components.core:health.current"},
        {"*": [{"var": "entity.components.core:health.max"}, 0.3]}
      ]
    }
  ]
}]
```

### Complex Nested Filter
```
my_mod:special_targets := entities(core:actor)[{
  "and": [
    {">=": [{"var": "entity.components.core:stats.level"}, 5]},
    {
      "or": [
        {"condition_ref": "core:is-hostile"},
        {
          "and": [
            {"condition_ref": "core:is-neutral"},
            {"<": [{"var": "entity.components.core:health.current"}, 50]}
          ]
        }
      ]
    }
  ]
}]
```

## Performance Tips

1. **Filter at source**: `entities(core:actor)[filter]` not `entities(core:actor)[] then filter`
2. **Use specific components**: `entities(core:actor)` not `entities(core:position)` for actors
3. **Avoid deep nesting**: Limit to ~5 levels of property access
4. **Cache complex filters**: Use condition_ref for reusable filters
5. **Early termination**: Put most restrictive conditions first in AND

## File Structure

```
mods/
  your_mod/
    scopes/
      *.scope       # Your scope definitions
    conditions/
      *.json        # Reusable condition definitions
```

## Debugging Checklist

- ✅ Scope ID includes mod namespace (`mod:scope` not `scope`)
- ✅ Component IDs include namespace (`core:actor` not `actor`)
- ✅ JSON Logic syntax is valid
- ✅ Variables use correct path (`entity.components.X` not `entity.X`)
- ✅ Arrays use `[]` for iteration
- ✅ Quotes around string values in JSON Logic
- ✅ Condition references exist and are loaded
- ✅ No circular scope references