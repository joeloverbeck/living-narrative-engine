# UNWITEOPE-006: Simplify handle_unwield_item.rule.json

**Status: ✅ COMPLETED**

## Summary

Replace the 5 discrete unwielding operations in `handle_unwield_item.rule.json` with a single `UNWIELD_ITEM` operation, significantly simplifying the rule while preserving all functionality.

## Files to Modify

| File                                                  | Change                                        |
| ----------------------------------------------------- | --------------------------------------------- |
| `data/mods/items/rules/handle_unwield_item.rule.json` | Replace 5 operations with single UNWIELD_ITEM |

## Implementation Details

### Current Rule Structure (13 operations)

1. `GET_NAME` (actor)
2. `GET_NAME` (target)
3. `QUERY_COMPONENT` (actor position)
4. `SET_VARIABLE` (logMessage)
5. `SET_VARIABLE` (perceptionType)
6. `SET_VARIABLE` (locationId)
7. `SET_VARIABLE` (targetId)
8. **`QUERY_COMPONENT` (grabbing requirements)** - TO BE REMOVED
9. **`UNLOCK_GRABBING`** - TO BE REMOVED
10. **`MODIFY_ARRAY_FIELD` (remove from wielded_item_ids)** - TO BE REMOVED
11. **`QUERY_COMPONENT` (check remaining items)** - TO BE REMOVED
12. **`IF` / `REMOVE_COMPONENT`** - TO BE REMOVED
13. `REGENERATE_DESCRIPTION`
14. `macro: core:logSuccessAndEndTurn`

### New Rule Structure (9 operations)

1. `GET_NAME` (actor) - KEEP
2. `GET_NAME` (target) - KEEP
3. `QUERY_COMPONENT` (actor position) - KEEP
4. `SET_VARIABLE` (logMessage) - KEEP
5. `SET_VARIABLE` (perceptionType) - KEEP
6. `SET_VARIABLE` (locationId) - KEEP
7. `SET_VARIABLE` (targetId) - KEEP
8. **`UNWIELD_ITEM`** - NEW (replaces operations 8-12)
9. `REGENERATE_DESCRIPTION` - KEEP
10. `macro: core:logSuccessAndEndTurn` - KEEP

### Operations to Remove

Remove these 5 operations (currently at positions 8-12):

```json
// REMOVE: QUERY_COMPONENT for grabbing requirements
{
  "type": "QUERY_COMPONENT",
  "comment": "Get target's grabbing requirements to know how many appendages to unlock",
  "parameters": {
    "entity_ref": "target",
    "component_type": "anatomy:requires_grabbing",
    "result_variable": "targetGrabbingReqs",
    "missing_value": { "handsRequired": 1 }
  }
}

// REMOVE: UNLOCK_GRABBING
{
  "type": "UNLOCK_GRABBING",
  "comment": "Release the appendages that were holding this item",
  "parameters": {
    "actor_id": "{event.payload.actorId}",
    "count": "{context.targetGrabbingReqs.handsRequired}",
    "item_id": "{event.payload.targetId}"
  }
}

// REMOVE: MODIFY_ARRAY_FIELD
{
  "type": "MODIFY_ARRAY_FIELD",
  "comment": "Remove the item from wielded_item_ids array",
  "parameters": {
    "entity_ref": "actor",
    "component_type": "positioning:wielding",
    "field": "wielded_item_ids",
    "mode": "remove_by_value",
    "value": "{event.payload.targetId}"
  }
}

// REMOVE: QUERY_COMPONENT for checking remaining
{
  "type": "QUERY_COMPONENT",
  "comment": "Check if any items remain in wielding component",
  "parameters": {
    "entity_ref": "actor",
    "component_type": "positioning:wielding",
    "result_variable": "currentWielding"
  }
}

// REMOVE: IF / REMOVE_COMPONENT
{
  "type": "IF",
  "comment": "Remove wielding component if no items remain",
  "parameters": {
    "condition": { "==": [{ "var": "context.currentWielding.wielded_item_ids.length" }, 0] },
    "then_actions": [
      {
        "type": "REMOVE_COMPONENT",
        "parameters": {
          "entity_ref": "actor",
          "component_type": "positioning:wielding"
        }
      }
    ]
  }
}
```

### New Operation to Add

Insert after `SET_VARIABLE` for targetId, before `REGENERATE_DESCRIPTION`:

```json
{
  "type": "UNWIELD_ITEM",
  "comment": "Stop wielding the item, releasing appendages and cleaning up wielding state",
  "parameters": {
    "actorEntity": "{event.payload.actorId}",
    "itemEntity": "{event.payload.targetId}"
  }
}
```

**Note**: Parameter names are `actorEntity` and `itemEntity` (matching the schema and handler), not `actor_id` and `item_id` as originally assumed.

### Complete New Rule

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_unwield_item",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "items:event-is-action-unwield-item"
  },
  "actions": [
    {
      "type": "GET_NAME",
      "parameters": {
        "entity_ref": "actor",
        "result_variable": "actorName"
      }
    },
    {
      "type": "GET_NAME",
      "parameters": {
        "entity_ref": "target",
        "result_variable": "targetName"
      }
    },
    {
      "type": "QUERY_COMPONENT",
      "comment": "Get actor's position for perception event",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "core:position",
        "result_variable": "actorPosition"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} stops wielding {context.targetName}."
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "perceptionType",
        "value": "action_target_general"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "locationId",
        "value": "{context.actorPosition.locationId}"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "targetId",
        "value": "{event.payload.targetId}"
      }
    },
    {
      "type": "UNWIELD_ITEM",
      "comment": "Stop wielding the item, releasing appendages and cleaning up wielding state",
      "parameters": {
        "actorEntity": "{event.payload.actorId}",
        "itemEntity": "{event.payload.targetId}"
      }
    },
    {
      "type": "REGENERATE_DESCRIPTION",
      "comment": "Update actor description to remove wielding activity",
      "parameters": { "entity_ref": "actor" }
    },
    {
      "comment": "Log success and end turn",
      "macro": "core:logSuccessAndEndTurn"
    }
  ]
}
```

## Out of Scope

- **DO NOT** create the schema (UNWITEOPE-001)
- **DO NOT** create the handler (UNWITEOPE-002)
- **DO NOT** modify DI registrations (UNWITEOPE-003)
- **DO NOT** create unit tests (UNWITEOPE-004)
- **DO NOT** modify handle_drop_item.rule.json (UNWITEOPE-005)
- **DO NOT** create integration tests (UNWITEOPE-007)
- **DO NOT** modify any other rule files
- **DO NOT** change operations that are being kept (GET_NAME, SET_VARIABLE, etc.)

## Acceptance Criteria

### Tests That Must Pass

```bash
# Validate rule schema
npm run validate

# Validate items mod
npm run validate:mod:items

# Full CI validation
npm run test:ci
```

### Manual Verification Checklist

1. [ ] Operations 8-12 from original rule are removed
2. [ ] Single `UNWIELD_ITEM` operation added in their place
3. [ ] Parameters use correct event payload references
4. [ ] Comment clearly explains purpose
5. [ ] GET_NAME, QUERY_COMPONENT (position), SET_VARIABLE operations unchanged
6. [ ] REGENERATE_DESCRIPTION and macro unchanged
7. [ ] JSON syntax is valid
8. [ ] Rule passes schema validation

### Invariants That Must Remain True

- [ ] Rule schema validation passes
- [ ] Kept operations remain exactly as before
- [ ] Operation order preserves correct data flow
- [ ] Parameter references match event payload structure
- [ ] `npm run validate` passes
- [ ] `npm run test:ci` passes
- [ ] No modifications to files outside the file list

## Dependencies

- **Depends on**: UNWITEOPE-001 (schema), UNWITEOPE-002 (handler), UNWITEOPE-003 (DI registration)
- **Blocked by**: UNWITEOPE-003
- **Blocks**: UNWITEOPE-007 (integration tests need both rules updated)

## Reference Files

| File                                                  | Purpose                       |
| ----------------------------------------------------- | ----------------------------- |
| `data/mods/items/rules/handle_drop_item.rule.json`    | Related rule being updated    |
| `data/mods/items/rules/handle_wield_weapon.rule.json` | Similar wielding rule pattern |
| `data/schemas/operations/unwieldItem.schema.json`     | Operation schema definition   |

## Benefits of Simplification

| Metric            | Before                | After               |
| ----------------- | --------------------- | ------------------- |
| Operations        | 14                    | 10                  |
| Lines of JSON     | ~130                  | ~80                 |
| Logic duplication | With drop_item        | None                |
| Error points      | 5 (for unwield logic) | 1                   |
| Maintainability   | Complex conditional   | Simple encapsulated |

## Outcome

### What Changed vs. Originally Planned

**Planned Changes:**

- Replace 5 discrete unwielding operations with single `UNWIELD_ITEM` operation

**Actual Changes:**

- ✅ Replaced 5 operations (QUERY_COMPONENT, UNLOCK_GRABBING, MODIFY_ARRAY_FIELD, QUERY_COMPONENT, IF/REMOVE_COMPONENT) with single `UNWIELD_ITEM` operation
- ✅ Rule simplified from 14 operations to 10 operations

**Discrepancies Corrected:**

- **Parameter naming**: Ticket originally specified `actor_id` and `item_id`, but the actual schema uses `actorEntity` and `itemEntity`. Ticket updated to reflect correct parameter names matching the handler and schema.

### Verification

- `npm run validate` → ✅ PASSED (0 violations across 44 mods)
- Unit tests → ✅ 31 tests passed (`unwieldItemHandler.test.js`)
- Integration tests → ✅ 540 tests passed across 73 test suites (items mod)
- Full test suite → ✅ 37,552 tests passed across 2,255 test suites

### Files Modified

| File                                                  | Change                                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| `data/mods/items/rules/handle_unwield_item.rule.json` | Replaced 5 discrete unwielding operations with single `UNWIELD_ITEM` operation |

### Completion Date

2025-11-27
