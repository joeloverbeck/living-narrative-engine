# LOCMODCONLOC-005: Integrate Locks with Movement Exits

Update movement gating so exits respect `locks:openable` state while preserving dimensional portal behavior.

## File list (expected touches)
- `data/mods/movement/conditions/exit-is-unblocked.condition.json`
- `data/mods/locks/conditions/blocker-permits-entry.condition.json` (or inline logic if avoiding dependency)
- `data/mods/locks/mod-manifest.json` (if adding helper condition)
- `tests/unit/mods/movement/conditions/exit-is-unblocked.test.js`
- `tests/integration/locks/movement_visibility.integration.test.js`

## Out of scope
- Creating or modifying actions/rules within the `locks` mod beyond the entry helper condition.
- Changing teleport or dimensional portal action definitions; only their visibility/allowance via existing scopes is affected.
- New narrative content outside test fixtures needed for coverage.

## Acceptance criteria
- `exit-is-unblocked` allows exits without blockers and exits whose blocker either lacks `locks:openable` or has `locks:openable.isLocked === false`; locked blockers hide exits from `movement:clear_directions`.
- Dimensional portals (`movement:is_dimensional_portal`) continue to behave as before; regression test covers unaffected portal travel.
- Tests verify visible vs hidden exits for locked/unlocked blockers and legacy blockers without `locks:openable`; `npm run test:unit -- tests/unit/mods/movement/conditions/exit-is-unblocked.test.js` and `npm run test:integration -- tests/integration/locks/movement_visibility.integration.test.js` pass.
- Invariants: no changes to action templates (`go`, `teleport`); movement manifest dependencies stay stable (only optional condition references added).
