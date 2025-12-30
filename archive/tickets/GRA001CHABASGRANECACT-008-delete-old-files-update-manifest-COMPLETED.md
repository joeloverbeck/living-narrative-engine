# GRA001CHABASGRANECACT-008: Delete Old grab_neck Files and Update Manifest

**STATUS: COMPLETED**

## Summary
Delete the old `grab_neck` action, rule, and condition files, then update the grabbing mod manifest to reference the new files. Also delete the existing action discovery test for the old action.

## Assumption Corrections (As Found)
- The old `grab_neck` action ID still appears in test helpers and other integration tests outside the grabbing mod. This ticket does **not** remove those references; follow-up tickets should update them.
- The grabbing mod manifest currently lists both old and new grab neck assets; this ticket removes only the old entries.

## File List (Files to Touch)

### Files to Delete
- `data/mods/grabbing/actions/grab_neck.action.json`
- `data/mods/grabbing/rules/handle_grab_neck.rule.json`
- `data/mods/grabbing/conditions/event-is-action-grab-neck.condition.json`
- `tests/integration/mods/grabbing/grab_neck_action_discovery.test.js`

### Files to Modify
- `data/mods/grabbing/mod-manifest.json` (update content section)

## Out of Scope

**DO NOT modify or touch:**
- `data/mods/grabbing/actions/grab_neck_target.action.json` (new file, separate ticket)
- `data/mods/grabbing/rules/handle_grab_neck_target.rule.json` (new file, separate ticket)
- `data/mods/grabbing/conditions/event-is-action-grab-neck-target.condition.json` (new file, separate ticket)
- `data/mods/grabbing/actions/squeeze_neck_with_both_hands.action.json` (keep as-is)
- `data/mods/grabbing/rules/handle_squeeze_neck_with_both_hands.rule.json` (keep as-is)
- `data/mods/grabbing/conditions/event-is-action-squeeze-neck-with-both-hands.condition.json` (keep as-is)
- `data/game.json` (separate ticket)
- Any files in `data/mods/grabbing-states/`
- Any source code in `src/`
- New test files (separate tickets)
- Other test/fixture references to `grabbing:grab_neck` outside `tests/integration/mods/grabbing/grab_neck_action_discovery.test.js`, including:
  - `tests/common/mods/ModTestFixture.js`
  - `tests/integration/infrastructure/realModIntegration.test.js`
  - `tests/integration/mods/lethal-violence/tear_out_throat_action.test.js`

## Implementation Details

### Updated mod-manifest.json Content Section

**Before:**
```json
{
  "content": {
    "actions": [
      "grab_neck.action.json",
      "squeeze_neck_with_both_hands.action.json"
    ],
    "rules": [
      "handle_grab_neck.rule.json",
      "handle_squeeze_neck_with_both_hands.rule.json"
    ],
    "conditions": [
      "event-is-action-grab-neck.condition.json",
      "event-is-action-squeeze-neck-with-both-hands.condition.json"
    ]
  }
}
```

**After:**
```json
{
  "content": {
    "actions": [
      "grab_neck_target.action.json",
      "squeeze_neck_with_both_hands.action.json"
    ],
    "rules": [
      "handle_grab_neck_target.rule.json",
      "handle_squeeze_neck_with_both_hands.rule.json"
    ],
    "conditions": [
      "event-is-action-grab-neck-target.condition.json",
      "event-is-action-squeeze-neck-with-both-hands.condition.json"
    ]
  }
}
```

### Deletion Order
1. First update manifest (to avoid referencing deleted files)
2. Then delete old files

### Test File Deletion Rationale
The test file `tests/integration/mods/grabbing/grab_neck_action_discovery.test.js` tests the OLD action. It must be deleted because:
- It references `grab_neck.action.json` which no longer exists
- It tests for `grabbing:grab_neck` action ID which is being replaced
- New tests for the new action are in separate tickets

## Acceptance Criteria

### Tests That Must Pass
- `npm run validate` completes without errors
- `npm run test:integration -- tests/integration/mods/grabbing/squeeze_neck_with_both_hands_action_discovery.test.js` passes
- No references to old `grab_neck` assets remain **within** `data/mods/grabbing/` and the deleted test file

### Invariants That Must Remain True
- `squeeze_neck_with_both_hands` action/rule/condition are NOT modified
- Dependencies section in manifest is NOT modified (handled in ticket 004)
- Only the `content` section is updated to reference new filenames
- Old files are completely removed, not commented out or renamed
- Manifest still references both actions (new grab_neck_target + unchanged squeeze_neck)

## Verification Steps

1. File NOT exists: `data/mods/grabbing/actions/grab_neck.action.json`
2. File NOT exists: `data/mods/grabbing/rules/handle_grab_neck.rule.json`
3. File NOT exists: `data/mods/grabbing/conditions/event-is-action-grab-neck.condition.json`
4. File NOT exists: `tests/integration/mods/grabbing/grab_neck_action_discovery.test.js`
5. File EXISTS: `data/mods/grabbing/actions/grab_neck_target.action.json`
6. File EXISTS: `data/mods/grabbing/rules/handle_grab_neck_target.rule.json`
7. File EXISTS: `data/mods/grabbing/conditions/event-is-action-grab-neck-target.condition.json`
8. Manifest references new filenames
9. `npm run validate` passes
10. `grep -r "grab_neck" data/mods/grabbing/` returns only new files and squeeze_neck_with_both_hands references

## Dependencies
- GRA001CHABASGRANECACT-005 (new action must exist before manifest update)
- GRA001CHABASGRANECACT-006 (new condition must exist before manifest update)
- GRA001CHABASGRANECACT-007 (new rule must exist before manifest update)

## Blocked By
- GRA001CHABASGRANECACT-005
- GRA001CHABASGRANECACT-006
- GRA001CHABASGRANECACT-007

## Blocks
- GRA001CHABASGRANECACT-010 (new tests can't run until old test is removed)
- GRA001CHABASGRANECACT-011 (new tests can't run until old files removed)

## Risk Notes
This ticket involves deletion of files. Ensure git commit is made before this ticket for easy rollback if needed.

## Outcome
- Updated grabbing mod manifest content to drop legacy `grab_neck` entries and keep new `grab_neck_target` entries.
- Removed legacy grab neck action/rule/condition files and the obsolete discovery test; left other `grabbing:grab_neck` test references for follow-up tickets per updated scope.
