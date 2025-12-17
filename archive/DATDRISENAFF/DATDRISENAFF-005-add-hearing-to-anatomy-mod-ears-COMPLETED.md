# DATDRISENAFF-005: Add Hearing to Anatomy Mod Ears

**Status: ✅ COMPLETED**

## Description

Add `anatomy:provides_hearing` component to the humanoid ear entity definition in the anatomy mod.

## Files to Touch

### MODIFY (1 file)
- `data/mods/anatomy/entities/definitions/humanoid_ear.entity.json`

### ADD (optional, if missing coverage)
- `tests/integration/mods/anatomy/sensoryAffordanceMarkers.integration.test.js`

## Out of Scope

- Do NOT modify component definitions
- Do NOT modify eyes or noses
- Do NOT modify anatomy-creatures entities
- Do NOT modify any *production* JavaScript code (tests may be added/updated)
- Do NOT change any existing component data in this file

## Implementation Details

### Modification Pattern

Add ONE component entry to the `components` object:

```json
{
  "components": {
    "existing:component1": { ... },
    "existing:component2": { ... },
    "anatomy:provides_hearing": {}
  }
}
```

### Example Entity Structure (before)

```json
{
  "id": "anatomy:humanoid_ear",
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
  "id": "anatomy:humanoid_ear",
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
- `npm run validate` passes (mod + schema validation)
- `npm run validate:ecosystem` passes (cross-mod references / manifests)
- Relevant Jest suite(s) covering anatomy mod data continue to pass (run targeted tests with `--runInBand` when scoping to a single file)
- JSON structure remains valid
- Entity loads correctly during game startup

### Invariants That Must Remain True
- All existing components in the entity must remain unchanged
- Entity ID must not change
- No component data should be modified, only new component added
- File formatting should remain consistent

## Risk Assessment

**Low Risk** - Single JSON addition with no logic changes. Easy rollback.

## Dependencies

- DATDRISENAFF-001 must be completed first (component definition + manifest entry must exist)

## Estimated Diff Size

~1 line

---

## Outcome

### Actual vs Planned Changes

**Planned**: Add `anatomy:provides_hearing` marker component to `anatomy:humanoid_ear`.

**Actual**:
- Added `"anatomy:provides_hearing": {}` to `data/mods/anatomy/entities/definitions/humanoid_ear.entity.json`.
- Added a small integration test to lock in the content invariant that the humanoid ear advertises hearing affordance.

### Verification Results

- ✅ `npm run validate` passed
- ✅ `npm run validate:ecosystem` passed
- ✅ `npm run test:integration -- --runInBand tests/integration/mods/anatomy/sensoryAffordanceMarkers.integration.test.js tests/integration/anatomy/humanMaleBodyGraph.integration.test.js` passed
