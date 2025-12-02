# WEADAMCAPREF-011: Remove can_cut component

## Summary

Remove the deprecated `damage-types:can_cut` marker component from the codebase. This is the final cleanup ticket, removing backward compatibility for the old marker-based system.

## Dependencies

- WEADAMCAPREF-006 (swing_at_target no longer requires can_cut)
- WEADAMCAPREF-007 (scope no longer checks can_cut)
- WEADAMCAPREF-009 (weapons have damage_capabilities component)
- WEADAMCAPREF-010 (loader infrastructure removed)

## Files to Touch

| File | Action | Description |
|------|--------|-------------|
| `data/mods/damage-types/components/can_cut.component.json` | DELETE | Deprecated component |
| `data/mods/damage-types/mod-manifest.json` | UPDATE | Remove can_cut reference |
| `data/mods/fantasy/entities/definitions/vespera_rapier.entity.json` | UPDATE | Remove can_cut component |
| `data/mods/fantasy/entities/definitions/vespera_main_gauche.entity.json` | UPDATE | Remove can_cut component |
| `data/mods/fantasy/entities/definitions/rill_practice_stick.entity.json` | UPDATE | Remove can_cut component (if present) |
| `data/mods/fantasy/entities/definitions/threadscar_melissa_longsword.entity.json` | UPDATE | Remove can_cut component |

## Out of Scope

- Service changes
- Rule changes
- JavaScript code changes
- Adding new components or functionality

## Implementation Details

### Delete Component File

Remove `data/mods/damage-types/components/can_cut.component.json`.

### Update Manifest

In `data/mods/damage-types/mod-manifest.json`, remove can_cut from components array:

**Before**:
```json
{
  "components": [
    "components/can_cut.component.json",
    "components/damage_capabilities.component.json"
  ]
}
```

**After**:
```json
{
  "components": [
    "components/damage_capabilities.component.json"
  ]
}
```

### Update Weapon Entities

Remove `"damage-types:can_cut": {}` from each weapon entity file.

**Before**:
```json
{
  "components": {
    "weapons:weapon": {},
    "damage-types:can_cut": {},
    "damage-types:damage_capabilities": { ... }
  }
}
```

**After**:
```json
{
  "components": {
    "weapons:weapon": {},
    "damage-types:damage_capabilities": { ... }
  }
}
```

## Acceptance Criteria

### Tests That Must Pass

1. `npm run validate` - All mod validation passes
2. `npm run test:ci` - All tests pass

### Verification Steps

1. Search codebase for `can_cut` - should find no references except possibly documentation
2. Search entity files for `damage-types:can_cut` - should find none
3. Game loads without errors about missing can_cut component
4. Combat functionality works (swing_at_target still discovers for slashing weapons)

### Invariants That Must Remain True

1. No entity references `damage-types:can_cut`
2. `damage-types` mod manifest is valid JSON
3. Weapon entities have `damage-types:damage_capabilities` component
4. Action discovery for `swing_at_target` works via `has_damage_capability` operator
5. Scope `wielded_cutting_weapons` works via `has_damage_capability` operator

## Risk Assessment

**Low Risk**: This removal is safe because:
1. All consumers (action, scope) were already migrated to use `damage_capabilities`
2. Weapons already have `damage_capabilities` component
3. This is purely cleanup of unused code

## Estimated Size

- 1 component file deleted (~10 lines)
- 1 manifest file updated (~1 line)
- 4 entity files updated (~1 line each)
