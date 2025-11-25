# WEAHANREQFIL-004: Create Grabbable Weapons Scope and Update Manifest

## Summary

Create a new scope file `grabbable_weapons_in_inventory.scope` that filters weapons by hand availability and held status, and add it to the weapons mod manifest.

## Context

The new scope uses the operators from WEAHANREQFIL-001 and WEAHANREQFIL-002 (registered in WEAHANREQFIL-003) to filter the actor's inventory for weapons that:
1. Have the `weapons:weapon` component
2. Can be grabbed by the actor (enough free hands)
3. Are not already being held

This preserves backward compatibility by creating a new scope rather than modifying the existing `weapons_in_inventory` scope.

## Files to Touch

| File | Action | Purpose |
|------|--------|---------|
| `data/mods/weapons/scopes/grabbable_weapons_in_inventory.scope` | CREATE | New scope definition |
| `data/mods/weapons/mod-manifest.json` | MODIFY | Add scope to manifest |
| `tests/integration/mods/weapons/grabbable_weapons_scope.integration.test.js` | CREATE | Integration tests |

## Out of Scope

- **DO NOT** modify `weapons_in_inventory.scope` (preserve backward compatibility)
- **DO NOT** modify any action files (WEAHANREQFIL-005)
- **DO NOT** modify any operator implementations
- **DO NOT** modify any rules or conditions
- **DO NOT** add any new components

## Implementation Details

### New Scope File
Create `data/mods/weapons/scopes/grabbable_weapons_in_inventory.scope`:

```
weapons:grabbable_weapons_in_inventory := actor.components.items:inventory.items[][{"and": [{"!!": {"var": "entity.components.weapons:weapon"}}, {"canActorGrabItem": ["actor", "entity"]}, {"not": {"isItemBeingGrabbed": ["actor", "entity"]}}]}]
```

This scope:
1. Starts with `actor.components.items:inventory.items[]` - iterates inventory items
2. Applies filter with three conditions ANDed together:
   - `{"!!": {"var": "entity.components.weapons:weapon"}}` - is a weapon
   - `{"canActorGrabItem": ["actor", "entity"]}` - actor has enough hands
   - `{"not": {"isItemBeingGrabbed": ["actor", "entity"]}}` - not already held

### Manifest Update
Modify `data/mods/weapons/mod-manifest.json`:

Change:
```json
"scopes": [
  "weapons_in_inventory.scope"
],
```

To:
```json
"scopes": [
  "weapons_in_inventory.scope",
  "grabbable_weapons_in_inventory.scope"
],
```

## Acceptance Criteria

### Tests That Must Pass
Create `tests/integration/mods/weapons/grabbable_weapons_scope.integration.test.js`:

1. **Basic Filtering**
   - `should return weapons when actor has enough free hands`
   - `should exclude weapons requiring more hands than actor has free`
   - `should exclude weapons already being held`
   - `should return empty array when no weapons are grabbable`

2. **Edge Cases**
   - `should default to 1 hand for weapons without anatomy:requires_grabbing`
   - `should include weapons with handsRequired: 0 (rings, etc.)`
   - `should return empty array when actor has no anatomy:body`
   - `should handle actor with multiple grabbing appendages`

3. **Scenario Tests**
   - `should show 1-hand sword when actor has 1 free hand`
   - `should hide 2-hand sword when actor has 1 free hand`
   - `should show 2-hand sword when actor has 2 free hands`
   - `should hide weapon that actor is currently wielding`

### Invariants That Must Remain True

1. Existing `weapons:weapons_in_inventory` scope unchanged
2. All existing tests continue to pass
3. Mod validation passes: `npm run validate:mod:weapons`
4. Scope DSL linting passes: `npm run scope:lint`
5. Manifest schema validation passes

## Dependencies

- **Requires**: WEAHANREQFIL-003 (operators must be registered)
- **Blocks**: WEAHANREQFIL-005 (action update)

## Estimated Scope

- 1 new scope file (1 line)
- 1 line added to manifest
- ~150 lines of integration tests
- Small, focused change
