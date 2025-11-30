# LOCMODCONLOC-004: Implement Lock/Unlock Rule Handlers

Implement the rule handlers that operate the existing `locks:lock_connection` / `locks:unlock_connection` actions using the keyed blocker component defined in `specs/locks-mod-connection-locking.md`.

## Reality check (current state)
- Component, actions, scopes, and conditions already exist under `data/mods/locks`. The mod manifest currently lists no rules.
- There are no rule handler JSON files or tests for the lock/unlock flows; only condition/scope/action coverage exists (`tests/unit/mods/locks/conditions.test.js`, `tests/integration/actions/locks.actions.integration.test.js`).
- `data/mods/locks/README.md` explicitly notes that rule implementation is pending.

## Scope to deliver
- Add rule handlers that subscribe to `core:attempt_action` for `locks:lock_connection` and `locks:unlock_connection`, validate `locks:openable` blockers, and require the actor to possess the matching key. Support multi-target payloads that use `event.payload.secondaryId`.
- On unlock: fail if already unlocked or if the key is missing/mismatched; on success set `isLocked: false`, update `lastChangedBy`, and emit perceptible/logging events. Keep `isOpen` untouched.
- On lock: fail if already locked or the key is missing/mismatched; on success set `isLocked: true`, update `lastChangedBy`, and emit perceptible/logging events.
- Update the locks manifest and README to reflect the new rules; preserve existing public action/condition scope contracts.

## Acceptance criteria
- Rule files exist and are registered in `data/mods/locks/mod-manifest.json`.
- Rules end the turn on success, and emit perceptible/feedback events for both success and failure paths (missing key, wrong key, wrong state).
- Tests cover success, missing-key, wrong-state, and wrong-key paths for both actions. The relevant suites pass: `npm run test:unit -- tests/unit/mods/locks/rules` and any new/updated integration added for the handlers.
- No movement mod changes; key/lock content remains limited to test fixtures.
