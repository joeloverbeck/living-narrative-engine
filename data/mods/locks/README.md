# Locks Mod

Foundation for keyed connection blockers that share lock state across exits.

## Current contents
- `locks:openable` component stores whether a blocker is locked, optional open/closed state, the required key ID, optional label text, and who last changed the lock.
- Scopes/conditions for discovering blockers the actor can lock/unlock and keys that match them.
- `locks:lock_connection` and `locks:unlock_connection` actions surface those blockers/keys with multi-target templates.

## Notes
- Depends on `core`, `movement`, and `items` to read exit blockers and key ownership.
- Rules that mutate lock state will land in the follow-up rules ticket.
