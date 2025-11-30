# Locks Mod

Foundation for keyed connection blockers that share lock state across exits.

## Current contents
- `locks:openable` component stores whether a blocker is locked, optional open/closed state, the required key ID, optional label text, and who last changed the lock.

## Notes
- Depends on `core`, `movement`, and `items` to read exit blockers and key ownership.
- Actions, scopes, and rules for locking/unlocking will land in follow-up tickets; this ticket only establishes the schema and manifest wiring.
