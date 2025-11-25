# UNWITEACT-002: Create `event-is-action-unwield-item.condition.json` File

## Summary

Create a condition file that checks if an event is the `unwield_item` action. This condition is used by the rule to trigger only on the appropriate action events.

## Dependencies

- None (can be implemented independently)

## File to Create

### `data/mods/weapons/conditions/event-is-action-unwield-item.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "weapons:event-is-action-unwield-item",
  "description": "True if the event is the unwield_item action",
  "logic": {
    "==": [
      {
        "var": "event.payload.actionId"
      },
      "weapons:unwield_item"
    ]
  }
}
```

## Files to Modify

None

## Out of Scope

- **DO NOT** modify any existing condition files
- **DO NOT** modify the weapons mod manifest
- **DO NOT** create or modify any action or rule files
- **DO NOT** modify any other files in the repository

## Implementation Notes

This condition follows the exact pattern of the existing wield condition. Compare with:

```json
// data/mods/weapons/conditions/event-is-action-wield-threateningly.condition.json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "weapons:event-is-action-wield-threateningly",
  "description": "True if the event is the wield_threateningly action",
  "logic": {
    "==": [
      {
        "var": "event.payload.actionId"
      },
      "weapons:wield_threateningly"
    ]
  }
}
```

The only differences are:
- `id`: `weapons:event-is-action-unwield-item`
- `description`: Updated to reference unwield
- Logic value: `weapons:unwield_item`

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run validate                           # Schema validation passes
npm run test:integration -- --testPathPattern="weapons"  # Existing weapons tests still pass
```

### Manual Verification

1. Condition file exists at `data/mods/weapons/conditions/event-is-action-unwield-item.condition.json`
2. File is valid JSON
3. File passes schema validation against `condition.schema.json`
4. `id` field matches filename pattern

### Invariants That Must Remain True

1. All existing weapons tests pass
2. All existing conditions in the weapons mod remain unchanged
3. `event-is-action-wield-threateningly.condition.json` is NOT modified
4. No changes to any other files in the repository
