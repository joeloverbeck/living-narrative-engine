# PASTHRBREACT-003: Implement Pass-Through-Breach Rule

**Status**: Completed
**Priority**: High

## Overview
Create the movement rule that handles the new pass-through-breach action. The rule should mirror the `movement:go` flow for position updates, perceptible events, and end-of-turn behavior, while reading the primary/secondary targets from the multi-target payload.

## Assumptions Recheck (2025-01)
- The action (`movement:pass_through_breach`), condition (`movement:event-is-action-pass-through-breach`), and supporting scopes already exist and are registered in the movement/breaching mod manifests.
- The missing piece is the rule file plus a movement mod manifest entry to wire it into the rules list.
- `movementFlow.test.js` does not cover pass-through-breach; additional integration tests are tracked in PASTHRBREACT-004.

## File List
- `data/mods/movement/rules/pass_through_breach.rule.json`
- `data/mods/movement/rules/go.rule.json` (reference only; do not edit)
- `tests/integration/mods/movement/movementFlow.test.js`
- `data/mods/movement/mod-manifest.json` (register new rule)

## Out of Scope
- Do not change `movement:go` rule behavior or messaging.
- Do not modify any scope definitions or action templates.
- Do not add new engine-side event payload handling.
- Do not add integration tests beyond the existing movement flow coverage (tracked in PASTHRBREACT-004).

## Acceptance Criteria
### Specific tests that must pass
- `npm run test:integration -- tests/integration/mods/movement/movementFlow.test.js --runInBand`

### Invariants that must remain true
- The rule dispatches departure and arrival `DISPATCH_PERCEPTIBLE_EVENT` events using `movement.departure` and `movement.arrival` perception types.
- The actor's `core:position.locationId` updates only once per action execution.
- `core:entity_moved` is dispatched after the position update.

## Outcome
- Added the pass-through-breach rule and registered it in the movement mod manifest.
- Kept `movement:go` behavior untouched and deferred new integration tests to PASTHRBREACT-004.
