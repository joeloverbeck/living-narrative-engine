# UNWITEACT-002: Create `event-is-action-unwield-item.condition.json` File

## Status: ✅ COMPLETED

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

---

## Outcome

### Completion Date: 2025-11-26

### What Was Actually Changed vs Originally Planned

**Planned:**

- Create `data/mods/weapons/conditions/event-is-action-unwield-item.condition.json`

**Actual:**

- Created `data/mods/weapons/conditions/event-is-action-unwield-item.condition.json` exactly as specified

### Assumption Validation

All ticket assumptions were verified correct:

1. ✅ Reference condition file `event-is-action-wield-threateningly.condition.json` exists with matching structure
2. ✅ Conditions directory exists at `data/mods/weapons/conditions/`
3. ✅ Pattern matches exactly - only differences are id, description, and action ID value

### Verification Results

1. ✅ `npm run validate` - Schema validation passed (0 violations)
2. ✅ `npx jest tests/integration/mods/weapons/` - All 95 tests pass
3. ✅ File is valid JSON
4. ✅ ID field `weapons:event-is-action-unwield-item` matches filename pattern
5. ✅ No existing files modified

### New/Modified Tests

No new tests were required for this ticket. The condition file is a data-only JSON file that will be tested by:

- Schema validation (via `npm run validate`)
- Rule execution tests in UNWITEACT-007 (when the rule uses this condition)

The existing 95 weapons integration tests all continue to pass, confirming no regressions.
