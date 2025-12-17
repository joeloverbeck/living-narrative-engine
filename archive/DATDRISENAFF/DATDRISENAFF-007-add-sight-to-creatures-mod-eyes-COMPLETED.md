# DATDRISENAFF-007: Add Sight to Creatures Mod Eyes

**Status: ✅ COMPLETED**

## Description

Add `anatomy:provides_sight` component to all 13 creature eye entities in the anatomy-creatures mod, including exotic types with non-standard subTypes. **This is the critical fix for exotic creatures.**

## Files to Touch

### MODIFY (13 files)

#### Standard Eyes (8 files)
- `data/mods/anatomy-creatures/entities/definitions/chicken_eye_amber_concentric.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/feline_eye_abyssal_black_glow.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/feline_eye_amber_slit.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/feline_eye_gold_slit.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/feline_eye_ice_blue_slit.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/hyena_eye.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/newt_eye.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/toad_eye.entity.json`

#### Exotic Eyes - THE CRITICAL FIX (5 files)
- `data/mods/anatomy-creatures/entities/definitions/eldritch_baleful_eye.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/eldritch_compound_eye_stalk.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/eldritch_sensory_stalk.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/eldritch_surface_eye.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/tortoise_eye.entity.json`

## Out of Scope

- Do NOT modify component definitions
- Do NOT modify ears or noses
- Do NOT modify anatomy mod entities
- Do NOT modify any JavaScript code
- Do NOT change any existing component data in these files
- Do NOT modify the `subType` values (keep exotic names like `eldritch_baleful_eye`)

## Implementation Details

### Modification Pattern

Each entity file modification adds ONE component entry to the `components` object:

```json
{
  "components": {
    "existing:component1": { ... },
    "existing:component2": { ... },
    "anatomy:provides_sight": {}
  }
}
```

### Why This Matters

`SensoryCapabilityService` currently determines `canSee` by scanning an entity’s anatomy parts for the presence of the `anatomy:provides_sight` marker component (per `specs/data-driven-sensory-affordances.spec.md`). These 13 anatomy-creatures eye entities currently **do not** include that component, so any actor assembled with them will be treated as unable to see.

This affects both:
- **Standard** creature eyes (even if their `subType` is `"eye"`)
- **Exotic** creature eyes (with non-standard `subType` values like `eldritch_baleful_eye`, `tortoise_eye`)

**Before this fix**: Eldritch creatures incorrectly classified as unable to see.
**After this fix**: Eldritch creatures correctly identified as having sight capability.

### Example Exotic Eye Structure (before)

```json
{
  "id": "anatomy-creatures:eldritch_baleful_eye",
  "components": {
    "anatomy:part": { "subType": "eldritch_baleful_eye", ... },
    "anatomy:part_health": { ... },
    "core:description": { ... }
  }
}
```

### Example Exotic Eye Structure (after)

```json
{
  "id": "anatomy-creatures:eldritch_baleful_eye",
  "components": {
    "anatomy:part": { "subType": "eldritch_baleful_eye", ... },
    "anatomy:part_health": { ... },
    "core:description": { ... },
    "anatomy:provides_sight": {}
  }
}
```

## Acceptance Criteria

### Tests That Must Pass
- `npm run validate` passes
- JSON structure remains valid for all 13 files
- All entities load correctly during game startup
- A unit-level regression test asserts these 13 entity definitions contain `anatomy:provides_sight` (integration coverage for end-to-end capability detection remains in DATDRISENAFF-012)

### Invariants That Must Remain True
- All existing components in each entity must remain unchanged
- Entity IDs must not change
- **subType values must NOT be modified** (keep exotic names)
- No component data should be modified, only new component added
- File formatting should remain consistent

## Risk Assessment

**Low Risk** - Simple JSON additions with no logic changes. Easy rollback.

## Dependencies

- DATDRISENAFF-001 must be completed first (component definition must exist)
- DATDRISENAFF-002 must be completed (service reads sensory affordance marker components)

## Estimated Diff Size

~30-60 lines (13 JSON entries + 1 small unit test)

---

## Outcome

### Actual vs Planned Changes

**Planned**: Add `anatomy:provides_sight` marker component to 13 anatomy-creatures eye entity files (including exotic subTypes).

**Actual**:
- Added `"anatomy:provides_sight": {}` to all 13 targeted entity definitions (standard + exotic).
- Added a small regression test ensuring these entity definitions keep the marker component and preserve expected `anatomy:part.subType`.

### Verification Results

- ✅ `npm run validate` passed
- ✅ `npm run test:unit -- --runInBand tests/unit/anatomy/anatomyCreaturesEyesProvidesSight.test.js` passed
