# INJREPANDUSEINT-002: Event Definitions

## Description

Create the four new event JSON schemas for entity dying, entity died, entity stabilized, and internal damage propagated.

## File List

| File | Action |
|------|--------|
| `data/mods/anatomy/events/entity_dying.event.json` | CREATE |
| `data/mods/anatomy/events/entity_died.event.json` | CREATE |
| `data/mods/anatomy/events/entity_stabilized.event.json` | CREATE |
| `data/mods/anatomy/events/internal_damage_propagated.event.json` | CREATE |

## Out of Scope

- Component definitions (INJREPANDUSEINT-001)
- Service implementations that dispatch these events
- UI components that listen to these events

## Acceptance Criteria

### Tests That Must Pass

- `npm run validate` passes for all four event files
- `npm run test:unit` continues to pass

### Invariants

- Event IDs follow `anatomy:*` namespace pattern
- `entity_dying` payload includes:
  - `entityId` (string)
  - `entityName` (string)
  - `turnsRemaining` (integer)
  - `causeOfDying` (string)
  - `timestamp` (integer)
- `entity_died` payload includes:
  - `entityId` (string)
  - `entityName` (string)
  - `causeOfDeath` (string)
  - `vitalOrganDestroyed` (string|null)
  - `killedBy` (string|null)
  - `finalMessage` (string)
  - `timestamp` (integer)
- `entity_stabilized` payload includes:
  - `entityId` (string)
  - `entityName` (string)
  - `stabilizedBy` (string)
  - `timestamp` (integer)
- `internal_damage_propagated` payload includes:
  - `ownerEntityId` (string)
  - `sourcePartId` (string)
  - `sourcePartType` (string)
  - `targetPartId` (string)
  - `targetPartType` (string)
  - `damageAmount` (number)
  - `damageTypeId` (string)
  - `previousState` (string)
  - `newState` (string)
  - `effectsTriggered` (array)
  - `timestamp` (integer)

## Dependencies

None

## Reference

See `specs/injury-reporting-and-user-interface.md` section 6 for detailed event specifications.
