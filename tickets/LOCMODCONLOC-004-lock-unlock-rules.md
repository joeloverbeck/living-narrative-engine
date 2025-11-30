# LOCMODCONLOC-004: Implement Lock/Unlock Rule Handlers

Handle `locks:lock_connection` and `locks:unlock_connection` actions by validating keys, flipping lock state, and emitting perceptible events.

## File list (expected touches)
- `data/mods/locks/mod-manifest.json`
- `data/mods/locks/rules/handle_lock_connection.rule.json`
- `data/mods/locks/rules/handle_unlock_connection.rule.json`
- `data/mods/locks/README.md` (note state changes/messages)
- `tests/unit/mods/locks/rules/handle_lock_connection.test.js`
- `tests/unit/mods/locks/rules/handle_unlock_connection.test.js`
- `tests/integration/locks/lock_state.integration.test.js`

## Out of scope
- Movement scope/condition updates (exit visibility still unchanged here).
- Additional UX polish beyond success/failure messaging and perceptible events.
- Creating new key/blocker content outside test fixtures.

## Acceptance criteria
- Rules subscribe to `core:attempt_action` for the lock/unlock actions, validate the target blocker has `locks:openable`, ensure the actor still holds a matching key, and guard against already-locked/unlocked states with informative failure results.
- Successful unlock sets `isLocked: false` (and updates `lastChangedBy`), successful lock sets `isLocked: true`; optional `isOpen` adjustments stay consistent with the chosen design.
- Success and failure paths dispatch perceptible events/messages analogous to container handling; turns end appropriately after success.
- Unit and integration tests cover success, missing-key, wrong-state, and wrong-key paths; `npm run test:unit -- tests/unit/mods/locks/rules` and `npm run test:integration -- tests/integration/locks/lock_state.integration.test.js` pass.
- Invariants: no modification to `movement` mod files; existing `items` rules remain unchanged.
