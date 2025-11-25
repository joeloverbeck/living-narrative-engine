# UNWITEACT-001: Create `wielded_items.scope` File

## Summary

Create a new scope file that returns all entity IDs of items currently being wielded by an actor. This scope will be used by the `unwield_item` action to provide valid targets (items that can be unwielded).

## Dependencies

- None (can be implemented independently)

## File to Create

### `data/mods/weapons/scopes/wielded_items.scope`

```
weapons:wielded_items := actor.components.positioning:wielding.wielded_item_ids[]
```

This scope:
- Accesses the actor's `positioning:wielding` component
- Retrieves the `wielded_item_ids` array
- Uses the `[]` operator to iterate and return all entity IDs in the array

## Files to Modify

None

## Out of Scope

- **DO NOT** modify any existing scope files
- **DO NOT** modify the `positioning:wielding` component definition
- **DO NOT** modify any action or rule files
- **DO NOT** modify `mod-manifest.json` (scopes are auto-discovered)

## Implementation Notes

The scope follows the established pattern in the weapons mod. Compare with existing scope:

```
# weapons:weapons_in_inventory.scope
weapons:weapons_in_inventory := actor.components.items:inventory.items[]
```

The new scope follows the same pattern but accesses a different component path.

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run validate                           # Schema validation passes
npm run scope:lint                         # Scope DSL validation passes
npm run test:integration -- --testPathPattern="weapons"  # Existing weapons tests still pass
```

### Manual Verification

1. Scope file exists at `data/mods/weapons/scopes/wielded_items.scope`
2. File content matches the spec exactly (single line, correct syntax)
3. No syntax errors when loading scopes

### Invariants That Must Remain True

1. All existing weapons tests pass
2. All existing scopes in the weapons mod remain unchanged
3. No changes to any other files in the repository
