# SENLOCLIN-003: Propagate speech across sensorial links

## Overview
Speech propagation already happens through the perceptible event pipeline: `entity_speech.rule.json` dispatches `DISPATCH_PERCEPTIBLE_EVENT`, and `addPerceptionLogEntryHandler.js` fans out log entries across `locations:sensorial_links` with origin prefixing. `dispatchSpeechHandler.js` only emits UI speech bubbles and does not manage perception logs, so no changes are required there.

## Status
Completed

## File List
- `src/logic/operationHandlers/addPerceptionLogEntryHandler.js`
- `data/mods/core/rules/entity_speech.rule.json`
- `data/mods/core/rules/log_perceptible_events.rule.json`
- `tests/unit/logic/operationHandlers/addPerceptionLogEntryHandler.test.js`

## Out of Scope
- UI speech bubble handling (`dispatchSpeechHandler.js`).
- Data updates for dredgers locations or components (already in SENLOCLIN-001).
- Formatting changes for origin-location logs.

## Acceptance Criteria
### Specific tests that must pass
- `npm run test:unit -- addPerceptionLogEntryHandler.test.js`

### Invariants that must remain true
- Sensorial propagation only occurs for the origin location (loop prevention when origin differs).
- Origin-location actors receive the existing unprefixed log format.
- Forwarded messages use the origin location name from `core:name.text`, falling back to `originLocationId`.

## Outcome
Propagation for speech logs was already handled via the perceptible event logging path (`entity_speech.rule.json` → `DISPATCH_PERCEPTIBLE_EVENT` → `addPerceptionLogEntryHandler.js`). The ticket scope was corrected to reflect the existing implementation and tests instead of adding new behavior to `dispatchSpeechHandler.js`.
