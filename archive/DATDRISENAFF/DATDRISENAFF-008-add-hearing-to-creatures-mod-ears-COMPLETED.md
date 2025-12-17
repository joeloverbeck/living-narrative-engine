# DATDRISENAFF-008: Add Hearing to Creatures Mod Ears

**Status: ✅ COMPLETED**

## Description

Add `anatomy:provides_hearing` component to all 8 creature ear entities in the anatomy-creatures mod, including tympanums (amphibian hearing organs).

## Files to Touch

### MODIFY (8 files)

#### Standard Ears (6 files)
- `data/mods/anatomy-creatures/entities/definitions/badger_ear.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/cat_ear.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/cat_ear_decorated.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/cat_ear_mottled_brown_gray.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/ermine_ear.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/hyena_ear.entity.json`

#### Tympanums (Amphibian Hearing - 2 files)
- `data/mods/anatomy-creatures/entities/definitions/newt_tympanum.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/toad_tympanum.entity.json`

### ADD (1 file)
- `tests/unit/anatomy/anatomyCreaturesEarsProvidesHearing.test.js`

## Out of Scope

- Do NOT modify component definitions
- Do NOT modify eyes or noses
- Do NOT modify anatomy mod entities
- Do NOT modify any JavaScript code
- Do NOT change any existing component data in these files

## Implementation Details

### Why This Matters

`SensoryCapabilityService` determines `canHear` by scanning an actor’s anatomy parts for the presence of the `anatomy:provides_hearing` marker component (per `specs/data-driven-sensory-affordances.spec.md`). These 8 anatomy-creatures “ear” entities currently do not include that component, so any actor assembled with them will be treated as unable to hear.

### Modification Pattern

Each entity file modification adds ONE component entry to the `components` object:

```json
{
  "components": {
    "existing:component1": { ... },
    "existing:component2": { ... },
    "anatomy:provides_hearing": {}
  }
}
```

### Note on Tympanums

Tympanums are the hearing organs for amphibians (newts, toads). They function as ears and should provide hearing capability even though they're not technically called "ears".

### Example Entity Structure (before)

```json
{
  "id": "anatomy-creatures:cat_ear",
  "components": {
    "anatomy:part": { "subType": "ear", ... },
    "anatomy:part_health": { ... },
    "core:description": { ... }
  }
}
```

### Example Entity Structure (after)

```json
{
  "id": "anatomy-creatures:cat_ear",
  "components": {
    "anatomy:part": { "subType": "ear", ... },
    "anatomy:part_health": { ... },
    "core:description": { ... },
    "anatomy:provides_hearing": {}
  }
}
```

## Acceptance Criteria

### Tests That Must Pass
- `npm run validate` passes
- JSON structure remains valid for all 8 files
- A unit-level regression test asserts these 8 entity definitions contain `anatomy:provides_hearing` (end-to-end coverage for exotic-creature perception remains in DATDRISENAFF-012)

### Invariants That Must Remain True
- All existing components in each entity must remain unchanged
- Entity IDs must not change
- No component data should be modified, only new component added
- File formatting should remain consistent

## Risk Assessment

**Low Risk** - Simple JSON additions with no logic changes. Easy rollback.

## Dependencies

- DATDRISENAFF-001 must be completed first (component definition must exist)
- DATDRISENAFF-002 must be completed (service reads sensory affordance marker components)

## Estimated Diff Size

~20-40 lines (8 JSON entries + 1 small unit test)

---

## Outcome

### Actual vs Planned Changes

**Planned**: Add `anatomy:provides_hearing` marker component to 8 anatomy-creatures ear/tympanum entity files.

**Actual**:
- Added `"anatomy:provides_hearing": {}` to all 8 targeted entity definitions (ears + tympanums).
- Added a focused regression test ensuring these definitions keep the marker component and preserve the expected `anatomy:part.subType`.

### Verification Results

- ✅ `npm run validate` passed
- ✅ `npm run test:unit -- --runInBand tests/unit/anatomy/anatomyCreaturesEarsProvidesHearing.test.js` passed
