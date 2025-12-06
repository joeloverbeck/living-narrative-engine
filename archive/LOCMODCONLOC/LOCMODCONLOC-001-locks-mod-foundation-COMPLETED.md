# LOCMODCONLOC-001: Establish Locks Mod Foundation

**Status:** Completed

Set up the new `locks` mod skeleton and the stateful `locks:openable` component so keyed blockers have a place to store lock metadata.

## Reality check

- There is no `data/mods/locks/` directory or manifest yet, so the mod is absent from the game load order.
- No component schema or tests exist for `locks:openable`; validation currently has nothing to load for this mod.
- Existing `movement` and `items` manifests are present and must stay unchanged.

## Scope (updated)

- Create the `locks` mod scaffold with manifest, README, and the `locks:openable` component schema from `specs/locks-mod-connection-locking.md`.
- Register the new mod in `data/game.json` so it loads and validates with the rest of the ecosystem.
- Add a schema validation test for `locks:openable` to document defaults and required fields.
- Keep movement conditions/scopes and any lock/unlock actions or rules out of scope for this ticket.

## File list (expected touches)

- `data/mods/locks/mod-manifest.json`
- `data/mods/locks/README.md`
- `data/mods/locks/components/openable.component.json`
- `data/game.json` (register mod)
- `tests/unit/mods/locks/components/openable.test.js`

## Out of scope

- Movement condition or scope changes (keep `movement:exit-is-unblocked` unchanged).
- Action, scope, or rule definitions for locking/unlocking.
- Adding new blocker/key content beyond minimal examples in README.

## Acceptance criteria

- New mod manifest declares dependencies on `core`, `movement`, and `items`, lists the `locks:openable` component in its content block, and is referenced by `data/game.json`.
- `locks:openable` component schema matches the spec fields (`isLocked` default true, optional `isOpen`, required `requiredKeyId`, optional `lockLabel`, optional `lastChangedBy`).
- `npm run validate:quick` succeeds (covers manifest/component schema wiring) and the new component schema test passes.
- Invariants: existing `movement` and `items` mod manifests remain unchanged; no existing component schemas are modified or removed.

## Outcome

- Added the `locks` mod scaffold (manifest with `core`/`movement`/`items` dependencies and README) plus the `locks:openable` component schema with defaults and namespaced ID validation.
- Registered the mod in `data/game.json` so it participates in validation/load order and created a focused unit test that captures required fields and allowed options.
- Left movement logic and lock/unlock actions untouched; work remains scoped to schema and wiring as planned.
