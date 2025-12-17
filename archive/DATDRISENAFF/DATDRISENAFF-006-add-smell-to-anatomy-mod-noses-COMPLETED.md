# DATDRISENAFF-006: Add Smell to Anatomy Mod Noses

## Status

COMPLETED (2025-12-17)

## Description

Add `anatomy:provides_smell` component to all 3 humanoid nose entity definitions in the anatomy mod.

## Files to Touch

### MODIFY (3 files)
- `data/mods/anatomy/entities/definitions/humanoid_nose.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_nose_small.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_nose_scarred.entity.json`

### MODIFY (tests)
- `tests/integration/mods/anatomy/sensoryAffordanceMarkers.integration.test.js`

## Out of Scope

- Do NOT modify component definitions
- Do NOT modify eyes or ears
- Do NOT modify anatomy-creatures entities
- Do NOT modify runtime JavaScript code (tests may be updated/added)
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

### Example Entity Structure (before)

```json
{
  "id": "anatomy:humanoid_nose",
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
  "id": "anatomy:humanoid_nose",
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
- `npm run test:integration -- --runInBand tests/integration/mods/anatomy/sensoryAffordanceMarkers.integration.test.js` passes
- JSON structure remains valid for all 3 files
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

~6-12 lines (3 entity JSON additions + a few test assertions)

## Outcome

- Added `anatomy:provides_smell` marker to the three humanoid nose entity definitions (including the small/scarred variants).
- Updated the existing sensory affordance marker integration test to assert the smell marker is present on those nose entities (no runtime code changes).
