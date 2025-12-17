# DATDRISENAFF-010: Add Multi-Sense to Eldritch Tentacle

## Description

Add `anatomy:provides_smell` to the eldritch sensory tentacle entity to represent its chemoreceptive ability. This is an example of a multi-sense organ.

Reference spec: `specs/data-driven-sensory-affordances.spec.md`

## Status

- [ ] In Progress
- [x] Completed

## Assumptions (Revalidated)

- Sensory capability detection is component-driven via `anatomy:provides_*` marker components (see `specs/data-driven-sensory-affordances.spec.md`).
- The `anatomy:provides_smell` component definition already exists in `data/mods/anatomy/components/`, and `anatomy-creatures` depends on the `anatomy` mod, so no manifest changes are required for this ticket.
- Runtime code already queries affordance components (no runtime JS changes required for this ticket).

## Files to Touch

### MODIFY (1 file)
- `data/mods/anatomy-creatures/entities/definitions/eldritch_tentacle_sensory.entity.json`

### MODIFY (optional, tests)
- `tests/integration/mods/anatomy-creatures/krakenEldritchMiscEntitiesLoading.test.js`

## Out of Scope

- Do NOT add `anatomy:provides_sight` (tentacle doesn't see)
- Do NOT add `anatomy:provides_hearing` (tentacle doesn't hear)
- Do NOT modify any other entities
- Do NOT modify component definitions
- Do NOT modify any runtime JavaScript code
- Do NOT change any existing component data in this file
- Test-only changes are allowed if required to lock in the authored data contract

## Implementation Details

### Modification Pattern

Add ONE component entry to the `components` object:

```json
{
  "components": {
    "existing:component1": { ... },
    "existing:component2": { ... },
    "anatomy:provides_smell": {}
  }
}
```

### Rationale

The eldritch sensory tentacle has chemoreceptive capabilities, allowing it to sense chemical compounds in its environment. This is functionally equivalent to smell detection. The tentacle does NOT provide sight or hearing capabilities.

### Example Entity Structure (before)

```json
{
  "id": "anatomy-creatures:eldritch_tentacle_sensory",
  "components": {
    "anatomy:part": { "subType": "tentacle", ... },
    "anatomy:part_health": { ... },
    "core:description": { ... }
  }
}
```

### Example Entity Structure (after)

```json
{
  "id": "anatomy-creatures:eldritch_tentacle_sensory",
  "components": {
    "anatomy:part": { "subType": "tentacle", ... },
    "anatomy:part_health": { ... },
    "core:description": { ... },
    "anatomy:provides_smell": {}
  }
}
```

## Acceptance Criteria

### Tests That Must Pass
- `npm run validate` passes
- `npm run test:unit -- tests/unit/perception/services/sensoryCapabilityService.test.js` passes
- `npm run test:integration -- tests/integration/mods/anatomy-creatures/krakenEldritchMiscEntitiesLoading.test.js` passes
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

- DATDRISENAFF-001 must be completed first (component definition must exist)

## Estimated Diff Size

~1-3 lines (+ a small test if needed)

## Outcome

- Added `anatomy:provides_smell` to `data/mods/anatomy-creatures/entities/definitions/eldritch_tentacle_sensory.entity.json` (marker affordance for chemoreception).
- Strengthened an existing integration test to assert the affordance is present on the authored entity definition.
- No runtime JS changes were required (sensory affordance checks already use `anatomy:provides_*`).
