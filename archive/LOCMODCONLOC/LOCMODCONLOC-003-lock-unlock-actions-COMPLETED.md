# LOCMODCONLOC-003: Create Lock/Unlock Actions

Status: Completed

Introduce the missing player-facing actions for locking and unlocking blockers with matching keys, using the scopes already shipped in the locks mod.

## Reality check (current state)

- `data/mods/locks/components/openable.component.json` plus lock/ key scopes and conditions already exist and are registered in `mod-manifest.json`.
- No `locks:*connection` actions or rules exist yet; the manifest lists no actions, and `data/mods/locks/README.md` explicitly notes that actions/rules are pending.
- No integration coverage validates that blockers/keys surface through the new scopes.

## File list (expected touches)

- `data/mods/locks/mod-manifest.json` (register new actions)
- `data/mods/locks/actions/lock_connection.action.json`
- `data/mods/locks/actions/unlock_connection.action.json`
- `data/mods/locks/README.md` (document available actions)
- `tests/integration/actions/locks.actions.integration.test.js` (new integration coverage)

## Out of scope

- Rule handlers that mutate lock state.
- Movement condition changes or teleport/go behavior updates.
- Adding new blocker/key content outside of minimal test fixtures.

## Acceptance criteria

- Actions declare targets (`primary` blocker via `locks:blockers_actor_can_lock/unlock`; `secondary` key via `locks:keys_for_blocker` with `contextFrom: "primary"`), require `items:inventory` and `core:position`, and set `generateCombinations: true`.
- Action templates render as `lock {blocker} with {key}` / `unlock {blocker} with {key}` with concise descriptions.
- Integration test demonstrates the actions appear only when the scopes resolve candidates (actor has the matching key and lock state fits) and stay hidden otherwise; runnable via `npm run test:integration -- tests/integration/actions/locks.actions.integration.test.js`.
- Invariants: no changes to `go`/`teleport` definitions; no new mod dependencies added outside `locks` manifest entries.

## Outcome

- Added `locks:lock_connection` and `locks:unlock_connection` actions registered in the locks manifest with required actor components, dual targets, and templates per spec.
- Documented the actions alongside existing scopes/conditions in `data/mods/locks/README.md`.
- Integration test (`tests/integration/actions/locks.actions.integration.test.js`) exercises scope-driven availability for lock/unlock and matching keys.
