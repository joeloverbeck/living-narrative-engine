# SENLOCLIN-001: Add sensorial links component and dredgers data

## Overview
Define the new `locations:sensorial_links` component in the locations components registry, author explicit links for the dredgers locations in scope, and wire runtime perception logging to respect those links per `specs/sensorial-location-links.md`.

## File List
- `data/mods/locations/components/sensorial_links.component.json` (new component definition)
- `data/mods/locations/mod-manifest.json` (register component)
- `data/mods/dredgers/entities/definitions/*.location.json` (location entities that need explicit links)
- `data/mods/dredgers/entities/instances/*.location.json` (verify instance ids for targets)
- `src/logic/operationHandlers/addPerceptionLogEntryHandler.js` (propagate logs to linked locations)
- `src/logic/operationHandlers/dispatchPerceptibleEventHandler.js` (origin location metadata)
- `data/mods/core/rules/log_perceptible_events.rule.json` (pass origin metadata)
- `data/schemas/operations/addPerceptionLogEntry.schema.json` (origin metadata parameter)
- `data/schemas/operations/dispatchPerceptibleEvent.schema.json` (origin metadata parameter)
- `data/mods/lighting/mod-manifest.json` (add missing dependency so `validate:fast` passes)
- Relevant unit tests under `tests/unit/logic/operationHandlers/`

## Out of Scope
- UI speech bubble routing changes.
- Any non-dredgers locations or mods besides the single manifest dependency fix needed for validation.
- Additional schema changes beyond the new origin metadata parameters for dispatch/log operations.

## Acceptance Criteria
### Specific tests that must pass
- `npm run validate:fast`
- `npm run test:unit -- tests/unit/logic/operationHandlers/addPerceptionLogEntryHandler.test.js`
- `npm run test:unit -- tests/unit/schemas/addPerceptionLogEntry.schema.test.js`

### Invariants that must remain true
- No changes to `movement:exits` or other navigation components for the dredgers locations.
- No automatic reciprocity is introduced; links remain explicit and directional.
- Location logs in the origin location remain unmodified by data-only changes.
- Explicit recipient lists still bypass location-wide propagation.

## Status
Completed

## Outcome
- Added `locations:sensorial_links` component data for dredgers locations and wired log propagation with origin prefixes plus loop guard support.
- Extended dispatch/log schemas and unit tests to cover `origin_location_id` and sensorial link propagation.
- Added the missing `locations` dependency to the lighting mod manifest so `validate:fast` succeeds.
