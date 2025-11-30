# Locks Mod

Foundation for keyed connection blockers that share lock state across exits.

## Current contents
- `mechanisms:openable` component stores whether a blocker is locked, optional open/closed state, the required key ID, optional label text, and who last changed the lock.
- Scopes/conditions for discovering blockers the actor can lock/unlock and keys that match them.
- `locks:lock_connection` and `locks:unlock_connection` actions surface those blockers/keys with multi-target templates.
- Rule handlers flip `mechanisms:openable.isLocked`, validate the actor still holds the matching key, emit perceptible events, and end the turn on success or clear failures.

## Notes
- Depends on `core`, `movement`, and `items` to read exit blockers and key ownership.
- Rules expect multi-target payloads to provide the selected key in `event.payload.secondaryId`.
