# THRITEATTAR-004: Create Event Condition for Throw Item Action

## Summary

Create the event condition that checks if the current event is a `throw_item_at_target` action. This condition is used by the rule to trigger the appropriate handling logic.

## Files to Create

| File | Purpose |
|------|---------|
| `data/mods/ranged/conditions/event-is-action-throw-item-at-target.condition.json` | Event condition for action matching |

## Implementation Details

### event-is-action-throw-item-at-target.condition.json

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "ranged:event-is-action-throw-item-at-target",
  "description": "Checks if the current event is a throw_item_at_target action",
  "rule": {
    "==": [
      { "var": "event.payload.actionId" },
      "ranged:throw_item_at_target"
    ]
  }
}
```

### Condition Logic

The condition uses JSON Logic to:
1. Access the `actionId` property from the event payload
2. Compare it to the string `"ranged:throw_item_at_target"`
3. Return `true` if they match, `false` otherwise

This follows the standard event-is-action condition pattern used throughout the codebase.

## Out of Scope

- **DO NOT** modify any existing condition files
- **DO NOT** modify the condition schema
- **DO NOT** create the action (THRITEATTAR-003)
- **DO NOT** create the rule that uses this condition (THRITEATTAR-008)
- **DO NOT** create test files

## Acceptance Criteria

### Tests That Must Pass

1. `npm run validate` completes without errors
2. Condition JSON passes schema validation against `condition.schema.json`
3. Condition is valid JSON (parseable without errors)
4. JSON Logic syntax is valid

### Invariants That Must Remain True

1. All existing conditions continue to function correctly
2. Condition ID `ranged:event-is-action-throw-item-at-target` is unique across all mods
3. The referenced action ID matches exactly: `ranged:throw_item_at_target`
4. JSON Logic operators (`==`, `var`) are valid

## Validation Commands

```bash
# Verify JSON is valid
node -e "JSON.parse(require('fs').readFileSync('data/mods/ranged/conditions/event-is-action-throw-item-at-target.condition.json'))"

# Run project validation
npm run validate
```

## Reference Files

For understanding condition patterns:
- `data/mods/weapons/conditions/event-is-action-swing-at-target.condition.json` - Similar event condition

## Dependencies

- THRITEATTAR-001 (mod structure must exist)
- THRITEATTAR-003 (action ID must match exactly)

## Blocks

- THRITEATTAR-008 (rule uses this condition via `condition_ref`)

## Outcome

- Created `data/mods/ranged/conditions/event-is-action-throw-item-at-target.condition.json`.
- Added the new condition to `data/mods/ranged/mod-manifest.json` (required for ecosystem validation).
- Verified with `npm run validate:ecosystem` (Passed).
- Verified JSON validity.