# OXYDROSYS-015: Create breathing events

## Description

Create all event definitions for the breathing system.

## Files to Create

- `data/mods/breathing/events/oxygen_depleted.event.json`
- `data/mods/breathing/events/hypoxia_started.event.json`
- `data/mods/breathing/events/hypoxia_stopped.event.json`
- `data/mods/breathing/events/anoxic_unconsciousness_started.event.json`
- `data/mods/breathing/events/brain_damage_started.event.json`

## Files to Modify

- `data/mods/breathing/mod-manifest.json` - Add events to `content.events` array

## Out of Scope

- Rules that react to these events
- JavaScript handlers that dispatch these events

## Acceptance Criteria

1. **All events valid**: Pass event.schema.json validation
2. **Event IDs**: `breathing:oxygen_depleted`, `breathing:hypoxia_started`, etc.
3. **Payloads defined**: Each event has appropriate payload schema (entityId, etc.)

## Tests That Must Pass

- `npm run validate` - Schema validation

## Invariants

- Event naming follows existing patterns (snake_case)
- All events have payload schemas
