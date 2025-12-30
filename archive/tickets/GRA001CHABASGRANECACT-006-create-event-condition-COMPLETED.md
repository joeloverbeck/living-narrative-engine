# GRA001CHABASGRANECACT-006: Create Event Condition for grab_neck_target

## Summary
Create the `event-is-action-grab-neck-target.condition.json` file that checks if the current event is the `grab_neck_target` action. This condition is used by the rule to match events.

## Status
Completed

## Reassessed Assumptions
- `data/mods/grabbing/actions/grab_neck_target.action.json` already exists with ID `grabbing:grab_neck_target`, so this ticket is unblocked.
- Existing `event-is-action-*` conditions in the grabbing mod use `event.payload.actionId` with a description that references the triggering event; this ticket should follow that pattern.
- `data/mods/grabbing/mod-manifest.json` does not yet reference the new condition; updating the manifest remains out of scope for this ticket.

## File List (Files to Touch)

### Files to Create
- `data/mods/grabbing/conditions/event-is-action-grab-neck-target.condition.json`

## Out of Scope

**DO NOT modify or touch:**
- `data/mods/grabbing/conditions/event-is-action-grab-neck.condition.json` (deleted in separate ticket)
- `data/mods/grabbing/conditions/event-is-action-squeeze-neck-with-both-hands.condition.json`
- `data/mods/grabbing/mod-manifest.json` (content update in separate ticket)
- Any action files
- Any rule files
- Any test files
- Any files in `data/mods/grabbing-states/`
- Any source code in `src/`

## Implementation Details

### event-is-action-grab-neck-target.condition.json Content

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "grabbing:event-is-action-grab-neck-target",
  "description": "Checks if the current event is the grab_neck_target action",
  "logic": {
    "==": [{ "var": "event.payload.actionId" }, "grabbing:grab_neck_target"]
  }
}
```

### Design Notes
- Standard event-checking condition pattern
- Uses `event.payload.actionId` to match against the action ID
- Follows naming convention: `event-is-action-{action-name}`
- The action ID `grabbing:grab_neck_target` must match exactly

## Acceptance Criteria

### Tests That Must Pass
- `npm run validate` completes without errors
- Condition schema validation passes (valid against condition.schema.json)

### Invariants That Must Remain True
- Condition ID follows `modId:event-is-action-{action}` pattern
- Condition ID namespace (`grabbing`) matches the containing mod ID
- Logic checks `event.payload.actionId` equality
- Action ID string matches exactly: `grabbing:grab_neck_target`
- Old condition file is NOT modified (separate deletion ticket)
- No changes to any existing condition functionality

## Verification Steps

1. File exists: `data/mods/grabbing/conditions/event-is-action-grab-neck-target.condition.json`
2. JSON is syntactically valid
3. `npm run validate` passes
4. Condition follows established pattern from other `event-is-action-*` conditions

## Dependencies
- GRA001CHABASGRANECACT-005 (action must exist with matching ID) - already satisfied

## Blocked By
- None

## Blocks
- GRA001CHABASGRANECACT-007 (rule uses this condition)

## Outcome
- Created `event-is-action-grab-neck-target.condition.json` following the existing event condition pattern.
- Left `data/mods/grabbing/mod-manifest.json` unchanged as scoped; validation reports the new file as unregistered until the manifest update lands.
