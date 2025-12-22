# PASTHRBREACT-002: Add Pass-Through-Breach Action + Condition

**Status**: Completed
**Priority**: High

## Overview
Define the new `movement:pass_through_breach` action with primary/secondary targets and add the matching event condition used by the movement rule. The action should mirror `movement:go` prerequisites unless the spec is updated.

## Updated Assumptions (post-audit)
- `breaching:breached_blockers_at_location` and `movement:destinations_for_breached_blocker` scopes already exist, but they are not yet listed in their respective mod manifests.
- Movement mod currently has no dependency on the `breaching` mod, even though the new action will reference a breaching scope.
- No existing action or condition files implement `movement:pass_through_breach` or `movement:event-is-action-pass-through-breach`.

## File List
- `data/mods/movement/actions/pass_through_breach.action.json`
- `data/mods/movement/conditions/event-is-action-pass-through-breach.condition.json`
- `data/mods/movement/mod-manifest.json`
- `data/mods/breaching/mod-manifest.json`
- `tests/integration/mods/movement/actionLoading.test.js`
- `tests/integration/mods/movement/teleport_action_discovery.test.js`

## Out of Scope
- Do not implement the movement rule logic (handled in a separate ticket).
- Do not change the `movement:go` action or its prerequisites.
- Do not adjust lighting rules or sense-aware perception behavior.

## Acceptance Criteria
### Specific tests that must pass
- `npm run test:integration -- tests/integration/mods/movement/actionLoading.test.js --runInBand`
- `npm run test:integration -- tests/integration/mods/movement/teleport_action_discovery.test.js --runInBand`

### Invariants that must remain true
- The new action uses `contextFrom: "primary"` for the destination target and `generateCombinations: true`.
- No existing action IDs, templates, or prerequisites are modified.
- Action discovery for `movement:go` and `movement:teleport` remains unchanged.

## Scope (updated)
- Add the `movement:pass_through_breach` action referencing the existing breached-blocker scopes.
- Add the `movement:event-is-action-pass-through-breach` condition.
- Register the new action/condition and the already-present scopes in mod manifests.
- Add the `breaching` mod dependency to `movement` so the action’s scopes resolve reliably.

## Outcome
- Shipped the action + condition, and wired both into the movement mod manifest.
- Registered the pre-existing breached-blocker scopes in their manifests and added the breaching dependency.
- Added/expanded integration tests to assert the new action structure and manifest wiring.
