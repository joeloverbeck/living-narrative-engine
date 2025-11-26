# NONDETACTSYS-015: Add can_cut Component to Weapon Entities

## Summary

Add the `damage-types:can_cut` marker component to existing weapon entity definitions that logically deal cutting damage (swords, axes, knives, etc.). This enables these weapons to be used with the `swing_at_target` action.

## Files to Modify

Weapon entity files in `data/mods/weapons/entities/definitions/` that deal cutting damage. The exact list depends on what weapons exist in the codebase.

**Expected files to modify** (verify existence first):

| File | Weapon Type | Should Have can_cut |
|------|-------------|---------------------|
| `longsword.entity.json` | Sword | ✅ Yes |
| `shortsword.entity.json` | Sword | ✅ Yes |
| `dagger.entity.json` | Knife | ✅ Yes |
| `axe.entity.json` | Axe | ✅ Yes |
| `battleaxe.entity.json` | Axe | ✅ Yes |
| `scimitar.entity.json` | Sword | ✅ Yes |
| `mace.entity.json` | Blunt | ❌ No |
| `hammer.entity.json` | Blunt | ❌ No |
| `club.entity.json` | Blunt | ❌ No |
| `staff.entity.json` | Blunt | ❌ No |

## Implementation Details

### Component Addition Pattern

For each cutting weapon entity, add to the `components` object:

```json
{
  "components": {
    "weapons:weapon": { ... },
    "damage-types:can_cut": {}
  }
}
```

### Example: longsword.entity.json

Before:
```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "weapons:longsword",
  "name": "Longsword",
  "components": {
    "weapons:weapon": {
      "weaponType": "sword",
      "damageType": "slashing"
    },
    "core:portable": {}
  }
}
```

After:
```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "weapons:longsword",
  "name": "Longsword",
  "components": {
    "weapons:weapon": {
      "weaponType": "sword",
      "damageType": "slashing"
    },
    "core:portable": {},
    "damage-types:can_cut": {}
  }
}
```

### Weapon Classification Guide

| Weapon Type | Damage Type | can_cut? |
|-------------|-------------|----------|
| Swords (any) | Slashing | ✅ |
| Axes (any) | Slashing | ✅ |
| Knives/Daggers | Slashing/Piercing | ✅ |
| Cleavers | Slashing | ✅ |
| Maces | Bludgeoning | ❌ |
| Hammers | Bludgeoning | ❌ |
| Clubs | Bludgeoning | ❌ |
| Staves | Bludgeoning | ❌ |
| Spears | Piercing | ❌ |
| Arrows | Piercing | ❌ |

## Out of Scope

- **DO NOT** modify the damage-types mod
- **DO NOT** create new weapon entities
- **DO NOT** add other damage type markers (can_pierce, can_bludgeon)
- **DO NOT** modify weapon stats or other components
- **DO NOT** create tests (entity validation is automatic)

## Acceptance Criteria

### Tests That Must Pass

```bash
# Validate all entity definitions
npm run validate

# Validate weapons mod specifically
npm run validate:mod:weapons

# Full test suite
npm run test:ci
```

### Verification Checklist

1. [ ] All cutting weapons have `damage-types:can_cut` component
2. [ ] No blunt/piercing-only weapons have `damage-types:can_cut`
3. [ ] Component is empty object `{}` (marker component)
4. [ ] All modified entity files pass schema validation
5. [ ] No other component changes made

### Invariants That Must Remain True

- [ ] Only adding `damage-types:can_cut` component
- [ ] Not modifying any other weapon properties
- [ ] Not modifying any non-weapon entities
- [ ] All entities continue to pass schema validation
- [ ] Existing weapon functionality unchanged

## Dependencies

- **Depends on**:
  - NONDETACTSYS-002 (damage-types mod with can_cut component)
- **Blocked by**: NONDETACTSYS-002
- **Blocks**: Nothing (but swing_at_target won't work without this)

## Pre-Implementation Steps

1. **List existing weapons**:
   ```bash
   ls data/mods/weapons/entities/definitions/
   ```

2. **Identify cutting weapons**:
   - Check each weapon's `weaponType` or `damageType` property
   - Classify as cutting or non-cutting

3. **Document the final list** of files to modify before starting

## Reference Files

| File | Purpose |
|------|---------|
| `data/mods/weapons/entities/definitions/` | Directory to scan |
| `data/mods/items/entities/definitions/belt.entity.json` | Marker component pattern |
| `data/schemas/entity-definition.schema.json` | Entity schema reference |
