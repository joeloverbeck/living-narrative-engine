# NONDETACTSYS-015: Add can_cut Component to Weapon Entities

**Status**: ✅ COMPLETED

## Summary

Add the `damage-types:can_cut` marker component to existing weapon entity definitions that logically deal cutting damage. This enables these weapons to be used with the `swing_at_target` action.

## Corrected Assumptions

**Original ticket assumptions were incorrect.** Key corrections:

| Original Assumption                                  | Actual Reality                                                               |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| Weapons in `data/mods/weapons/entities/definitions/` | Directory is empty; weapons are in `data/mods/fantasy/entities/definitions/` |
| `weapons:weapon` has `weaponType` property           | Pure marker component with no properties                                     |
| `weapons:weapon` has `damageType` property           | Does not exist                                                               |
| Many weapon files exist                              | Only 3 weapon entities exist                                                 |

## Files to Modify

Weapon entity files with `weapons:weapon` component in `data/mods/fantasy/entities/definitions/`:

| File                                       | Weapon Type     | Should Have can_cut | Rationale                                                                                     |
| ------------------------------------------ | --------------- | ------------------- | --------------------------------------------------------------------------------------------- |
| `threadscar_melissa_longsword.entity.json` | Longsword       | ✅ Yes              | Swords deal slashing damage                                                                   |
| `vespera_rapier.entity.json`               | Rapier          | ✅ Yes              | Rapiers can slash                                                                             |
| `vespera_main_gauche.entity.json`          | Parrying dagger | ❌ No               | "needle-thin, purpose-built for finding gaps... rather than broad slashing" - piercing weapon |

## Implementation Details

### Component Addition Pattern

For each cutting weapon entity, add to the `components` object:

```json
{
  "components": {
    "weapons:weapon": {},
    "damage-types:can_cut": {}
  }
}
```

**Note**: `weapons:weapon` is a pure marker component with no properties.

### Example: threadscar_melissa_longsword.entity.json

Before:

```json
{
  "components": {
    "weapons:weapon": {},
    ...
  }
}
```

After:

```json
{
  "components": {
    "weapons:weapon": {},
    "damage-types:can_cut": {},
    ...
  }
}
```

## Out of Scope

- **DO NOT** modify the damage-types mod
- **DO NOT** create new weapon entities
- **DO NOT** add other damage type markers (can_pierce, can_bludgeon)
- **DO NOT** modify weapon stats or other components

## Acceptance Criteria

### Tests That Must Pass

```bash
# Validate all entity definitions
npm run validate

# Full test suite
npm run test:ci
```

### Verification Checklist

1. [x] All cutting weapons have `damage-types:can_cut` component
2. [x] No piercing-only weapons have `damage-types:can_cut`
3. [x] Component is empty object `{}` (marker component)
4. [x] All modified entity files pass schema validation
5. [x] No other component changes made

## Dependencies

- **Depends on**:
  - NONDETACTSYS-002 (damage-types mod with can_cut component) ✅
- **Blocked by**: None (NONDETACTSYS-002 completed)
- **Blocks**: Nothing (but swing_at_target won't work without this)

## Reference Files

| File                                                       | Purpose                              |
| ---------------------------------------------------------- | ------------------------------------ |
| `data/mods/fantasy/entities/definitions/`                  | Directory containing weapon entities |
| `data/mods/damage-types/components/can_cut.component.json` | Marker component definition          |
| `data/schemas/entity-definition.schema.json`               | Entity schema reference              |

## Outcome

### Originally Planned vs Actual Changes

| Aspect                     | Original Plan                                                                      | Actual Implementation                                         |
| -------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Files to modify            | 6+ files in `weapons/entities/definitions/`                                        | 2 files in `fantasy/entities/definitions/`                    |
| `weapons:weapon` structure | Assumed `weaponType`/`damageType` properties                                       | Pure marker component (empty)                                 |
| Weapons found              | longsword, shortsword, dagger, axe, battleaxe, scimitar, mace, hammer, club, staff | Only 3 weapons: longsword, rapier, main-gauche                |
| Main-gauche classification | Not mentioned                                                                      | Classified as piercing-only (no can_cut) based on description |

### Files Modified

1. `data/mods/fantasy/entities/definitions/threadscar_melissa_longsword.entity.json` - Added `damage-types:can_cut`
2. `data/mods/fantasy/entities/definitions/vespera_rapier.entity.json` - Added `damage-types:can_cut`

### Files NOT Modified (Intentionally)

- `data/mods/fantasy/entities/definitions/vespera_main_gauche.entity.json` - Piercing weapon, not cutting

### Tests Added

- `tests/integration/mods/weapons/weaponCanCutComponentValidation.test.js` (14 tests)
  - Validates cutting weapons have `damage-types:can_cut`
  - Validates piercing weapons do NOT have `damage-types:can_cut`
  - Validates component structure integrity
  - Validates entity ID preservation

### Validation Results

- `npm run validate` - PASSED
- `npm run test:ci` weapon tests - PASSED (14/14)
- Existing weapon tests - PASSED (18/18)
