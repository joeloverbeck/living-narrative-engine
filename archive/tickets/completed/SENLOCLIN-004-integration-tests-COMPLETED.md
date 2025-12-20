# SENLOCLIN-004: Integration coverage for sensorial links

## Status
Completed

## Overview
Add focused integration coverage that loads the dredgers location instances and verifies cross-location log propagation, loop-guard behavior, and prefix formatting for both speech and perceptible events. The existing sensorial link behavior already lives in `AddPerceptionLogEntryHandler`, so the integration work should validate the rule wiring and data flow rather than reintroducing handler changes.

## File List
- `tests/integration/core/rules/logPerceptibleEventsRule.integration.test.js`
- `tests/integration/core/rules/entitySpeechRule.integration.test.js`
- `data/mods/dredgers/entities/definitions/*.location.json`
- `data/mods/dredgers/entities/instances/*.location.json`

## Out of Scope
- Runtime handler changes in `src/`.
- Data authoring for the dredgers locations or components.
- Changes to unrelated integration suites.

## Acceptance Criteria
### Specific tests that must pass
- `npm run test:integration -- logPerceptibleEventsRule.integration.test.js --runInBand`
- `npm run test:integration -- entitySpeechRule.integration.test.js --runInBand`

### Invariants that must remain true
- No multi-hop propagation occurs (only the origin location broadcasts and link traversal is skipped when `originLocationId` differs).
- Origin-location logs are unprefixed; linked-location logs are prefixed using `core:name.text` from the origin location.
- Locations without `locations:sensorial_links` remain unchanged by the tests.

## Outcome
Added integration coverage in the core rule tests for perceptible event propagation and speech logging using dredgers location instances, including prefix checks, loop-guard behavior, and no-link behavior; no runtime handler or data changes were required.
