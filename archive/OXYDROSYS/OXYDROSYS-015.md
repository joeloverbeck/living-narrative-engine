# OXYDROSYS-015: Create breathing events

## Status: COMPLETED

## Description

Create all event definitions for the breathing system.

## Notes/Assumptions

- The existing `DEPLETE_OXYGEN` handler dispatches `breathing-states:oxygen_depleted`, so the oxygen depletion event belongs to the `breathing-states` mod (not `breathing`).
- Oxygen depletion payloads must align with `DepleteOxygenHandler` (`entityId`, `organCount`, `depletionResults`, `timestamp`).
- Hypoxia/anoxia events remain in the `breathing` mod and are definitions only (no rule/handler wiring yet).

## Files to Create

- `data/mods/breathing-states/events/oxygen_depleted.event.json`
- `data/mods/breathing/events/hypoxia_started.event.json`
- `data/mods/breathing/events/hypoxia_stopped.event.json`
- `data/mods/breathing/events/anoxic_unconsciousness_started.event.json`
- `data/mods/breathing/events/brain_damage_started.event.json`

## Files to Modify

- `data/mods/breathing/mod-manifest.json` - Add events to `content.events` array
- `data/mods/breathing-states/mod-manifest.json` - Add oxygen depletion event to `content.events` array

## Out of Scope

- Rules that react to these events
- JavaScript handlers that dispatch these events

## Acceptance Criteria

1. **All events valid**: Pass event.schema.json validation
2. **Event IDs**: `breathing-states:oxygen_depleted`, `breathing:hypoxia_started`, etc.
3. **Payloads defined**: Each event has appropriate payload schema (entityId, etc.), with `oxygen_depleted` matching the handler payload.

## Tests That Must Pass

- `npm run validate` - Schema validation

## Invariants

- Event naming follows existing patterns (snake_case)
- All events have payload schemas

## Outcome

- Added event definitions for breathing hypoxia/anoxia stages and registered them in the breathing mod manifest.
- Defined `breathing-states:oxygen_depleted` to match the existing handler payload and registered it in the breathing-states manifest.
- No rule or handler changes required; this was definition-only work aligned to existing code.
