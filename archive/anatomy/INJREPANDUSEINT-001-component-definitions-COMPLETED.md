# INJREPANDUSEINT-001: Component Definitions

**Status: COMPLETED**

## Description

Create the four new component JSON schemas for vital organs, dying state, death marker, and damage propagation configuration.

## File List

| File | Action |
|------|--------|
| `data/mods/anatomy/components/vital_organ.component.json` | CREATE |
| `data/mods/anatomy/components/dying.component.json` | CREATE |
| `data/mods/anatomy/components/dead.component.json` | CREATE |
| `data/mods/anatomy/components/damage_propagation.component.json` | CREATE |

## Out of Scope

- Event definitions (INJREPANDUSEINT-002)
- Service implementations
- Entity updates
- Any JavaScript code changes

## Acceptance Criteria

### Tests That Must Pass

- `npm run validate` passes for all four component files
- `npm run test:unit` continues to pass

### Invariants

- Component IDs follow `anatomy:*` namespace pattern
- `vital_organ` schema includes:
  - `organType` (enum: brain, heart, spine)
  - `deathMessage` (optional string)
- `dying` schema includes:
  - `turnsRemaining` (integer >= 0)
  - `causeOfDying` (string)
  - `stabilizedBy` (string|null)
- `dead` schema includes:
  - `causeOfDeath` (string)
  - `vitalOrganDestroyed` (string|null)
  - `killedBy` (string|null)
  - `deathTimestamp` (integer)
- `damage_propagation` schema includes:
  - `rules` array with:
    - `childSocketId` (string)
    - `baseProbability` (number 0-1)
    - `damageFraction` (number 0-1)
    - `damageTypeModifiers` (object, optional)

## Dependencies

None

## Reference

See `specs/injury-reporting-and-user-interface.md` sections 4.1-4.4 for detailed schema specifications.

---

## Outcome

**Completed: 2025-12-02**

### What Was Changed

All 4 component JSON files were created exactly as specified in the ticket:

1. **`data/mods/anatomy/components/vital_organ.component.json`**
   - Created with `organType` enum (brain, heart, spine) and optional `deathMessage`

2. **`data/mods/anatomy/components/dying.component.json`**
   - Created with `turnsRemaining`, `causeOfDying`, and `stabilizedBy` fields

3. **`data/mods/anatomy/components/dead.component.json`**
   - Created with `causeOfDeath`, `vitalOrganDestroyed`, `killedBy`, and `deathTimestamp` fields

4. **`data/mods/anatomy/components/damage_propagation.component.json`**
   - Created with `rules` array containing propagation configuration

### Tests Added

Updated `tests/unit/schemas/core-and-anatomy.allComponents.schema.test.js`:
- Added valid payloads for all 4 new components
- Added invalid payloads for all 4 new components

### Validation Results

- `npm run validate`: **PASSED** (0 violations across 47 mods)
- `npm run test:unit`: **38309 tests passed**
