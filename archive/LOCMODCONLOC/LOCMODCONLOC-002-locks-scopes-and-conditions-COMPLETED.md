# LOCMODCONLOC-002: Add Locks Scopes and Conditions

Define scopes and conditions that identify lockable blockers, gated by key ownership, to support upcoming lock/unlock actions. Follow the logic in `specs/locks-mod-connection-locking.md`.

## Status

- Completed.

## Current state check

- `locks` mod only contains the `locks:openable` component and a manifest that lists no scopes/conditions/actions.
- No existing locks scopes or conditions are present; no tests beyond the component schema checks.
- Movement and items mods remain unchanged; keep them untouched for this ticket.

## Scope

- Add the scopes and conditions needed for lock/unlock targeting per the spec (locked vs unlocked blockers, key ownership, and secondary key resolution via `contextFrom`).
- Wire the new content into `data/mods/locks/mod-manifest.json`.
- Add focused unit tests for these scopes and conditions.
- Do not add actions/rules or change movement/items logic.

## File list (expected touches)

- `data/mods/locks/mod-manifest.json` (add new content entries)
- `data/mods/locks/scopes/blockers_actor_can_unlock.scope`
- `data/mods/locks/scopes/blockers_actor_can_lock.scope`
- `data/mods/locks/scopes/keys_for_blocker.scope`
- `data/mods/locks/conditions/blocker-has-openable.condition.json`
- `data/mods/locks/conditions/blocker-is-locked.condition.json`
- `data/mods/locks/conditions/blocker-is-unlocked.condition.json`
- `data/mods/locks/conditions/actor-has-key-for-blocker.condition.json`
- `data/mods/locks/conditions/event-is-action-lock-connection.condition.json`
- `data/mods/locks/conditions/event-is-action-unlock-connection.condition.json`
- `tests/unit/mods/locks/scopes.test.js`
- `tests/unit/mods/locks/conditions.test.js`

## Out of scope

- Action definitions or rule handlers.
- Movement condition updates (`movement:exit-is-unblocked`).
- Inventory schema changes or new item content.

## Acceptance criteria

- Scopes implement the filtering logic described in the spec (locked vs unlocked blockers, key ownership, contextFrom linking secondary target keys to the selected blocker).
- Conditions match the spec semantics and mirror event guards used by other mods (multi-target `core:attempt_action` shape included).
- Added tests cover positive/negative cases for scopes and conditions; `npm run test:unit -- tests/unit/mods/locks` passes.
- Invariants: no changes to existing `items` or `movement` scopes/conditions; existing tests unrelated to locks continue to pass.

## Outcome

- Implemented locks conditions and scopes with component value lookups from blocker IDs, plus unit tests for scopes and conditions.
- Added a JSON Logic operator to fetch component values so conditions can read `locks:openable` fields when only blocker IDs are present.
