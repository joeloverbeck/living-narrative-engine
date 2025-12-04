# THRITEATTAR-002: Create Throwable Items Scope

## Status: Completed

## Summary

Create the `ranged:throwable_items` scope that returns all portable items that can be thrown - both wielded items AND non-wielded inventory items.

## Files to Create

| File | Purpose |
|------|---------|
| `data/mods/ranged/scopes/throwable_items.scope` | Scope definition for throwable items |

## Implementation Details

### throwable_items.scope

```
// Scope: ranged:throwable_items
// Description: Returns all portable items that can be thrown - both wielded items AND non-wielded inventory items
// Pattern: Union of wielded items and inventory items, filtered by items:portable component

ranged:throwable_items := actor.components.positioning:wielding.wielded_item_ids[][{"has_component": ["items:portable"]}] | actor.components.items:inventory.items[][{"has_component": ["items:portable"]}]
```

### Scope Logic Explanation

1. **First part**: `actor.components.positioning:wielding.wielded_item_ids[][{"has_component": ["items:portable"]}]`
   - Gets wielded item IDs from the positioning:wielding component
   - Filters to only items with `items:portable` component

2. **Union operator**: `|`
   - Combines both sets of items

3. **Second part**: `actor.components.items:inventory.items[][{"has_component": ["items:portable"]}]`
   - Gets inventory item IDs from the items:inventory component
   - Filters to only items with `items:portable` component

### Expected Behavior

- Returns portable wielded items (weapons, tools)
- Returns portable inventory items (rocks, potions, misc objects)
- Does NOT return non-portable items
- Returns empty set if no portable items available
- Handles missing components gracefully (returns empty)

## Out of Scope

- **DO NOT** modify any existing scopes in other mods
- **DO NOT** modify the scope DSL engine
- **DO NOT** create any test files (separate ticket)
- **DO NOT** create the action that uses this scope (THRITEATTAR-003)

## Acceptance Criteria

### Tests That Must Pass

1. `npm run scope:lint` completes without errors
2. `npm run validate` completes without errors
3. Scope file is syntactically valid

### Invariants That Must Remain True

1. All existing scopes continue to function correctly
2. Scope DSL syntax is valid per the engine specification
3. The scope ID `ranged:throwable_items` is unique across all mods
4. Component references (`positioning:wielding`, `items:inventory`, `items:portable`) exist

## Validation Commands

```bash
# Lint scope files
npm run scope:lint

# Run project validation
npm run validate
```

## Reference Files

For understanding existing scope patterns:
- `data/mods/items/scopes/wielded_items.scope` - Wielded items scope pattern
- `data/mods/items/scopes/non_wielded_inventory_items.scope` - Inventory items scope pattern

## Dependencies

- THRITEATTAR-001 (mod structure must exist first)

## Blocks

- THRITEATTAR-003 (action definition needs this scope)

## Outcome

- Created `data/mods/ranged/scopes/throwable_items.scope` with the specified content.
- Updated `data/mods/ranged/mod-manifest.json` to register the new scope (required for validation to pass).
- Verified with `npm run scope:lint` (117 scopes valid).
- Verified with `npm run validate` (0 violations).
- Verified component references (`items:portable`, `positioning:wielding`, `items:inventory`) exist in the codebase.
