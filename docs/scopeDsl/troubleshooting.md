# ScopeDSL Troubleshooting Guide

## Common Errors and Solutions

### Syntax Errors

#### Error: "Expected field name after '.'"

```
// Wrong
actor..inventory
actor.

// Correct
actor.core:inventory
```

#### Error: "Expected component identifier"

```
// Wrong
entities()
entities(actor)  // Missing namespace

// Correct
entities(core:actor)
```

#### Error: "Expected opening brace for JSON Logic"

```
// Wrong
entities(core:actor)[
entities(core:actor)[}

// Correct
entities(core:actor)[{"condition": "value"}]
```

#### Error: "Unexpected token"

```
// Wrong
actor + + location
actor | | location

// Correct
actor + location
actor | location
```

### Resolution Errors

#### Error: "Scope not found: X"

**Cause**: Referenced scope doesn't exist or isn't loaded.

**Solutions**:

1. Check scope ID includes namespace: `mod:scope`
2. Verify scope file exists in `mods/mod_name/scopes/`
3. Check for typos in scope ID
4. Ensure dependent mod is loaded (for cross-mod references)

```
// Wrong
my_scope := actor  // Missing namespace

// Correct
my_mod:my_scope := actor
```

#### Error: "Component not found: X"

**Cause**: Trying to access non-existent component.

**Solutions**:

1. Verify component ID includes namespace
2. Check component is defined in mod
3. Handle missing components gracefully

```
// Defensive approach
entities(core:actor)[{
  "and": [
    {"!=": [{"var": "entity.components.my_mod:special"}, null]},
    {"condition_ref": "my_mod:has-special"}
  ]
}]
```

#### Error: "Circular reference detected"

**Cause**: Scope A references B which references A (directly or indirectly).

**Solutions**:

1. Map out scope dependencies
2. Break circular chain with base cases
3. Use union operators instead of references where appropriate

```
// Problematic
mod:scope_a := mod:scope_b
mod:scope_b := mod:scope_a  // Circular!

// Solution: Break the chain
mod:base_scope := entities(core:actor)
mod:scope_a := mod:base_scope[filter_a]
mod:scope_b := mod:base_scope[filter_b]
```

#### Error: "Maximum depth exceeded"

**Cause**: Too many levels of property access or scope references.

**Solutions**:

1. Simplify deep navigation chains
2. Break complex scopes into smaller parts
3. Cache intermediate results

```
// Too deep
actor.a.b.c.d.e.f.g.h.i.j.k

// Better: Break into steps or simplify
actor.core:deep_data.value
```

### Filter Errors

#### Problem: Filter returns empty set unexpectedly

**Common Causes**:

1. Variable path incorrect
2. Type mismatch in comparison
3. Component doesn't exist on entities

**Debugging Steps**:

```
// 1. Test without filter first
entities(core:actor)[]

// 2. Add simple filter
entities(core:actor)[{"!=": [{"var": "id"}, null]}]

// 3. Gradually add complexity
entities(core:actor)[{
  "and": [
    {"!=": [{"var": "id"}, null]},
    {">": [{"var": "entity.components.core:stats.level"}, 5]}
  ]
}]
```

#### Problem: JSON Logic syntax errors

**Variable Access Issues**:

```
// Wrong - incorrect path
{"var": "entity.core:stats.level"}
{"var": "components.core:stats.level"}
{"var": "stats.level"}

// Correct
{"var": "entity.components.core:stats.level"}
```

**String vs Number Comparisons**:

```
// Wrong - comparing string to number
{">": [{"var": "entity.components.core:stats.level"}, "5"]}

// Correct - number to number
{">": [{"var": "entity.components.core:stats.level"}, 5]}
```

**Missing Quotes in String Values**:

```
// Wrong
{"==": [{"var": "entity.components.core:name.value"}, Guard]}

// Correct
{"==": [{"var": "entity.components.core:name.value"}, "Guard"]}
```

### Performance Issues

#### Problem: Scope resolution takes too long

**Solutions**:

1. **Filter at the source**:

```
// Slow
entities(core:position)[]  // Gets all entities with position
// Then filters for actors client-side

// Fast
entities(core:actor)[]  // Only gets actors
```

2. **Use condition references for complex logic**:

```
// Define once in conditions/complex_filter.json
{
  "id": "my_mod:complex_filter",
  "logic": { /* complex 50-line logic */ }
}

// Reference efficiently
entities(core:actor)[{"condition_ref": "my_mod:complex_filter"}]
```

3. **Avoid redundant unions**:

```
// Inefficient
entities(core:actor) + entities(core:actor)  // Duplicates

// Efficient
entities(core:actor)
```

4. **Put restrictive conditions first**:

```
// Better performance
[{
  "and": [
    {"==": [{"var": "entity.components.rare:component"}, true]},  // Few entities
    {">": [{"var": "entity.components.core:stats.level"}, 1]}     // Many entities
  ]
}]
```

### Entity Lookup Debugging

ScopeDSL now enables `runtimeCtx.scopeEntityLookupDebug` automatically whenever `NODE_ENV` is not `production`. Override the defaults (or force-enable in production) by passing either `true` or a configuration object onto the runtime context:

```
runtimeCtx.scopeEntityLookupDebug = {
  enabled: true,
  cacheEvents: ({ type, key }) => telemetry.emit('scopeCache', { type, key }),
  strategyFactory: ({ entityManager }) => ({
    resolve: (id) => entityManager.getEntityInstance(id),
    describeOrder: () => ['custom']
  }),
};
```

With the flag enabled the engine logs which lookup strategy is active, streams cache hit/miss/eviction events through `cacheEvents`, and emits throttled warnings whenever lookups fall back to synthetic component data instead of live entities (as emphasized in `docs/scopeDsl/README.md`). Use these hooks to validate that scopes stay aligned with the live entity model described in the docs. To force this mode outside dev/test, set the environment variable `SCOPE_DSL_LOOKUP_DEBUG=true` (or `false` to disable globally) before starting the engine.

### Edge Cases

#### Handling Null/Undefined Values

**Problem**: Entities with missing data cause errors.

**Solution**: Add null checks:

```
// Defensive filtering
entities(core:actor)[{
  "and": [
    {"!=": [{"var": "entity.components.core:stats"}, null]},
    {"!=": [{"var": "entity.components.core:stats.level"}, null]},
    {">": [{"var": "entity.components.core:stats.level"}, 5]}
  ]
}]
```

#### Empty Arrays

**Problem**: Accessing empty arrays returns nothing.

**Solution**: Provide fallbacks:

```
// With fallback
actor.core:inventory.items[] | none

// Check array exists and has items
entities(core:actor)[{
  "and": [
    {"!=": [{"var": "entity.components.core:inventory.items"}, null]},
    {">": [{"var": "entity.components.core:inventory.items.length"}, 0]}
  ]
}]
```

#### Missing Context Variables

**Problem**: Scope expects context that isn't available.

**Solution**: Use defensive patterns:

```
// Defensive target access
target | actor  // Falls back to actor if no target

// Check context availability
entities(core:actor)[{
  "or": [
    {"==": [{"var": "target"}, null]},  // No target context
    {"condition_ref": "my_mod:target_condition"}  // Has target
  ]
}]
```

## Debugging Techniques

### 1. Progressive Testing

Start simple and add complexity:

```
// Step 1: Basic source
actor

// Step 2: Property access
actor.core:stats

// Step 3: Add filter
actor.core:inventory.items[{">": [{"var": "quantity"}, 1]}]
```

### 2. Component Verification

Verify components exist before using them:

```
// Check what components an entity has
entities(core:actor)[]  // List all actors
// Then check their components in game
```

### 3. Isolate Issues

Test each part independently:

```
// Original complex scope
my_mod:complex := entities(core:actor)[filter1] + entities(core:item)[filter2]

// Test parts separately
my_mod:test1 := entities(core:actor)[filter1]
my_mod:test2 := entities(core:item)[filter2]
my_mod:test3 := my_mod:test1 + my_mod:test2
```

### 4. Use Trace Mode

Enable tracing for detailed resolution info:

- Check which entities are being evaluated
- See filter results at each step
- Identify where empty sets originate

### 5. Validate JSON Logic

Test JSON Logic expressions separately:

1. Extract the filter expression
2. Test with known data
3. Verify expected results

## Error Message Reference

| Error                    | Meaning                        | Common Fix                    |
| ------------------------ | ------------------------------ | ----------------------------- |
| `ScopeSyntaxError`       | Invalid scope syntax           | Check operators and structure |
| `Scope not found`        | Referenced scope doesn't exist | Verify scope ID and loading   |
| `Component not found`    | Component doesn't exist        | Check component registration  |
| `Maximum depth exceeded` | Too many nested operations     | Simplify scope structure      |
| `Circular reference`     | Scopes reference each other    | Break circular dependency     |
| `Invalid AST structure`  | Malformed parsed tree          | Check scope syntax            |
| `Condition not found`    | condition_ref target missing   | Verify condition exists       |
| `Type mismatch`          | Comparing incompatible types   | Check data types in filters   |

## Prevention Checklist

Before deploying scopes:

- [ ] All scope IDs include mod namespace
- [ ] All component IDs include namespace
- [ ] JSON Logic syntax validated
- [ ] No circular references between scopes
- [ ] Null/undefined handling in place
- [ ] Tested with empty entity sets
- [ ] Tested with missing components
- [ ] Performance acceptable (< 200ms for normal use)
- [ ] Comments explain complex logic
- [ ] Fallbacks for missing context

## Getting Help

When reporting issues, include:

1. The exact scope definition
2. Error message received
3. Expected vs actual behavior
4. Entity data being queried
5. Mod dependencies
