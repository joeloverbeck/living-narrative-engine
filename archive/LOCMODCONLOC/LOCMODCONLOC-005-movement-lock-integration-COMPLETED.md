# Outcome
Extracted `locks:openable` to `mechanisms` mod (as `mechanisms:openable`) to break circular dependency between `locks` and `movement`. `movement` now checks `mechanisms:openable` in `exit-is-unblocked`. Updated all references and added tests.

# LOCMODCONLOC-005: Integrate Locks with Movement Exits (via Mechanisms Mod)

Refactor `mechanisms:openable` into a new `mechanisms` mod to resolve circular dependencies, then update movement gating so exits respect `mechanisms:openable` state while preserving dimensional portal behavior.

## File list (expected touches)
- `data/mods/mechanisms/mod-manifest.json` (new)
- `data/mods/mechanisms/components/openable.component.json` (moved from locks)
- `data/mods/locks/mod-manifest.json` (remove component, add dependency)
- `data/mods/movement/mod-manifest.json` (add dependency)
- `data/mods/movement/conditions/exit-is-unblocked.condition.json`
- `data/mods/locks/conditions/blocker-permits-entry.condition.json` (or inline logic)
- Refactor all `mechanisms:openable` references to `mechanisms:openable` in `data/mods/locks/**` and tests.
- `tests/unit/mods/movement/conditions/exit-is-unblocked.test.js`
- `tests/integration/locks/movement_visibility.integration.test.js`

## Out of scope
- Changing teleport or dimensional portal action definitions.
- New narrative content outside test fixtures.

## Acceptance criteria
- `mechanisms` mod is created and contains the `openable` component.
- `locks` and `movement` mods depend on `mechanisms`.
- `exit-is-unblocked` allows exits without blockers and exits whose blocker either lacks `mechanisms:openable` or has `mechanisms:openable.isLocked === false`.
- Locked blockers hide exits from `movement:clear_directions`.
- Dimensional portals (`movement:is_dimensional_portal`) continue to behave as before.
- Tests verify visible vs hidden exits for locked/unlocked blockers.
- Regression tests ensure `locks` functionality (locking/unlocking) still works with the new component ID.
