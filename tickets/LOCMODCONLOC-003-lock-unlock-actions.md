# LOCMODCONLOC-003: Create Lock/Unlock Actions

Introduce player-facing actions for locking and unlocking blockers with matching keys, wired to the new scopes.

## File list (expected touches)
- `data/mods/locks/mod-manifest.json`
- `data/mods/locks/actions/lock_connection.action.json`
- `data/mods/locks/actions/unlock_connection.action.json`
- `data/mods/locks/README.md` (brief action descriptions)
- `tests/integration/actions/locks.actions.integration.test.js` (new or added cases)

## Out of scope
- Rule handlers that mutate lock state.
- Movement condition changes or teleport/go behavior updates.
- Adding new blocker/key content outside of minimal test fixtures.

## Acceptance criteria
- Actions declare targets (`primary` blocker via `locks:blockers_actor_can_lock/unlock`; `secondary` key via `locks:keys_for_blocker` with `contextFrom: "primary"`), require `items:inventory` and `core:position`, and set `generateCombinations: true`.
- Action templates render as `lock {blocker} with {key}` / `unlock {blocker} with {key}` with concise descriptions.
- Integration test ensures actions surface only when scopes return candidates and hide otherwise; `npm run test:integration -- tests/integration/actions/locks.actions.integration.test.js` passes.
- Invariants: no changes to `go`/`teleport` definitions; no new mod dependencies added outside `locks` manifest entries.
