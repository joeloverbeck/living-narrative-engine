# SENLOCLIN-002: Propagate perceptible events across sensorial links

## Overview
Per `specs/sensorial-location-links.md`, perceptible events should fan out to actors in linked locations with an origin prefix and loop prevention. The propagation logic already lives in `addPerceptionLogEntryHandler.js` (invoked by `log_perceptible_events.rule.json`), so the scope here is to confirm alignment and close the ticket without duplicating behavior in `dispatchPerceptibleEventHandler.js`.

## Status
Completed

## File List
- `src/logic/operationHandlers/addPerceptionLogEntryHandler.js`
- `data/mods/core/rules/log_perceptible_events.rule.json`
- `tests/unit/logic/operationHandlers/addPerceptionLogEntryHandler.test.js`

## Out of Scope
- Speech handling changes (`dispatchSpeechHandler.js`).
- Data updates for locations or components (covered in SENLOCLIN-001).
- Multi-hop propagation or recursive dispatching.
- Changing public handler payload shapes.

## Acceptance Criteria
### Specific tests that must pass
- `npm run test:unit -- addPerceptionLogEntryHandler.test.js`
- `npm run test:unit -- dispatchPerceptibleEventHandler.test.js`

### Invariants that must remain true
- Sensorial propagation only occurs from the origin location (loop prevention).
- Origin-location actors receive the unprefixed message format.
- Forwarded logs are enqueued directly without emitting a new `DISPATCH_PERCEPTIBLE_EVENT` action.

## Outcome
Propagation and loop prevention were already implemented in `addPerceptionLogEntryHandler.js`, so no runtime code changes were required; the ticket was updated to point at the existing handler/tests and to remove the incorrect assumption that `dispatchPerceptibleEventHandler.js` needed new propagation logic.
