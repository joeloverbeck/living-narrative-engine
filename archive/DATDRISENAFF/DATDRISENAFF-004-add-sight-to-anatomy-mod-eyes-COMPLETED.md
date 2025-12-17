# DATDRISENAFF-004: Add Sight to Anatomy Mod Eyes

**Status: ✅ COMPLETED**

## Description

Add `anatomy:provides_sight` component to all 12 human eye entity definitions in the anatomy mod.

## Files to Touch

### MODIFY (12 files)
- `data/mods/anatomy/entities/definitions/human_eye_amber.entity.json`
- `data/mods/anatomy/entities/definitions/human_eye_blue.entity.json`
- `data/mods/anatomy/entities/definitions/human_eye_blue_hooded.entity.json`
- `data/mods/anatomy/entities/definitions/human_eye_brown.entity.json`
- `data/mods/anatomy/entities/definitions/human_eye_brown_almond.entity.json`
- `data/mods/anatomy/entities/definitions/human_eye_cobalt.entity.json`
- `data/mods/anatomy/entities/definitions/human_eye_gray_hooded.entity.json`
- `data/mods/anatomy/entities/definitions/human_eye_green.entity.json`
- `data/mods/anatomy/entities/definitions/human_eye_hazel_almond.entity.json`
- `data/mods/anatomy/entities/definitions/human_eye_hazel_hooded.entity.json`
- `data/mods/anatomy/entities/definitions/human_eye_pale_blue_round.entity.json`
- `data/mods/anatomy/entities/definitions/human_eye_red_hooded.entity.json`

## Out of Scope

- Do NOT modify component definitions
- Do NOT modify ears or noses
- Do NOT modify anatomy-creatures entities
- Do NOT modify any JavaScript code
- Do NOT change any existing component data in these files

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

### Example Entity Structure (before)

```json
{
  "id": "anatomy:human_eye_amber",
  "components": {
    "anatomy:part": { "subType": "eye", ... },
    "anatomy:part_health": { ... },
    "core:description": { ... }
  }
}
```

### Example Entity Structure (after)

```json
{
  "id": "anatomy:human_eye_amber",
  "components": {
    "anatomy:part": { "subType": "eye", ... },
    "anatomy:part_health": { ... },
    "core:description": { ... },
    "anatomy:provides_sight": {}
  }
}
```

## Acceptance Criteria

### Tests That Must Pass
- `npm run validate` passes
- JSON structure remains valid for all 12 files
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

~12 lines (1 line per file)

---

## Outcome

### Actual vs Planned Changes

**Planned**: Add `anatomy:provides_sight` marker component to 12 human eye entity files.

**Actual**: Exactly as planned. Added `"anatomy:provides_sight": {}` to the components object of all 12 human eye entity definitions.

### Verification Results

- ✅ `npm run validate` passed (0 violations across 65 mods)
- ✅ All 27 unit tests in `sensoryCapabilityService.test.js` passed
- ✅ All existing component data preserved unchanged
- ✅ Entity IDs unchanged
- ✅ File formatting consistent

### Test Coverage Assessment

No new tests were added. The existing test suite in `tests/unit/perception/services/sensoryCapabilityService.test.js` already comprehensively covers:
- Component-based affordance detection pattern
- Exotic creatures with `anatomy:provides_sight`
- Partial damage scenarios
- Dismemberment cases
- Multi-sense organs

### Files Modified

All 12 entity files listed above received identical changes: adding the `"anatomy:provides_sight": {}` component.

### Completion Date

2025-12-17
