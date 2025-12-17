# DATDRISENAFF-009: Add Smell to Creatures Mod Noses

## Description

Add `anatomy:provides_smell` component to all 5 creature nose/muzzle/nostril entities in the anatomy-creatures mod.

This ticket is part of the data-driven sensory affordances rollout described in `specs/data-driven-sensory-affordances.spec.md`.

## Files to Touch

### MODIFY (5 files)

#### Standard Noses (2 files)
- `data/mods/anatomy-creatures/entities/definitions/beaver_folk_nose.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/cat_folk_nose.entity.json`

#### Muzzle (1 file)
- `data/mods/anatomy-creatures/entities/definitions/hyena_muzzle.entity.json`

#### Nostrils (Amphibian Olfactory - 2 files)
- `data/mods/anatomy-creatures/entities/definitions/newt_nostril.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/toad_nostril.entity.json`

### ADD (1 file)
- `tests/unit/anatomy/anatomyCreaturesNosesProvidesSmell.test.js`

## Out of Scope

- Do NOT modify component definitions
- Do NOT modify eyes or ears
- Do NOT modify anatomy mod entities
- Do NOT modify runtime JavaScript code (engine/services/UI)
- Do NOT change any existing component data in these files

## Implementation Details

### Modification Pattern

Each entity file modification adds ONE component entry to the `components` object:

```json
{
  "components": {
    "existing:component1": { ... },
    "existing:component2": { ... },
    "anatomy:provides_smell": {}
  }
}
```

### Note on Varied Naming

Different creatures have different olfactory organ names:
- **Noses**: Standard mammalian olfactory organs
- **Muzzles**: Extended snouts with olfactory function (hyena)
- **Nostrils**: Amphibian olfactory organs (newt, toad)

All provide the same smell capability despite different anatomical structures.

### Example Entity Structure (before)

```json
{
  "id": "anatomy-creatures:hyena_muzzle",
  "components": {
    "anatomy:part": { "subType": "nose", ... },
    "anatomy:part_health": { ... },
    "core:description": { ... }
  }
}
```

### Example Entity Structure (after)

```json
{
  "id": "anatomy-creatures:hyena_muzzle",
  "components": {
    "anatomy:part": { "subType": "nose", ... },
    "anatomy:part_health": { ... },
    "core:description": { ... },
    "anatomy:provides_smell": {}
  }
}
```

## Acceptance Criteria

### Tests That Must Pass
- `npm run validate` passes
- Relevant Jest test(s) for anatomy-creatures sensory markers pass
- JSON structure remains valid for all 5 files
- All entities load correctly during game startup

### Invariants That Must Remain True
- All existing components in each entity must remain unchanged
- Entity IDs must not change
- No component data should be modified, only new component added
- File formatting should remain consistent

## Risk Assessment

**Low Risk** - Simple JSON additions with no logic changes. Easy rollback.

## Dependencies

- DATDRISENAFF-001 must be completed first (component definition must exist)

## Estimated Diff Size

~5 lines in data (1 per file) + one small unit test file

## Status

- [x] Completed

## Outcome

- Added `anatomy:provides_smell` marker components to the 5 targeted anatomy-creatures nose/muzzle/nostril entities.
- Added a focused unit test to prevent regressions by asserting those entities continue to include the smell affordance marker.
