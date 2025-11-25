# UNWITEACT-005: Fix `handle_wield_threateningly.rule.json` - Add `LOCK_GRABBING`

## Summary

Fix the existing `handle_wield_threateningly.rule.json` to properly lock grabbing appendages when an item is wielded. Currently, the rule adds items to `positioning:wielding` but does NOT lock the actor's grabbing appendages, creating an inconsistency with the appendage tracking system.

## Dependencies

- None (can be implemented independently of other tickets)

## File to Modify

### `data/mods/weapons/rules/handle_wield_threateningly.rule.json`

**Current state (lines 8-22):**
```json
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
    ...
```

**Required change:** Insert TWO new operations after the second `GET_NAME` (line 22) and BEFORE the `QUERY_COMPONENT` for `core:position`:

```json
{
  "type": "QUERY_COMPONENT",
  "comment": "Get target's grabbing requirements to know how many appendages to lock",
  "parameters": {
    "entity_ref": "target",
    "component_type": "anatomy:requires_grabbing",
    "result_variable": "targetGrabbingReqs",
    "missing_value": { "handsRequired": 1 }
  }
},
{
  "type": "LOCK_GRABBING",
  "comment": "Lock the required number of grabbing appendages for this weapon",
  "parameters": {
    "actor_id": "{event.payload.actorId}",
    "count": "{context.targetGrabbingReqs.handsRequired}",
    "item_id": "{event.payload.targetId}"
  }
}
```

## Complete Modified Actions Array

The `actions` array should look like this after modification (showing insertion point):

```json
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
    "comment": "Get target's grabbing requirements to know how many appendages to lock",
    "parameters": {
      "entity_ref": "target",
      "component_type": "anatomy:requires_grabbing",
      "result_variable": "targetGrabbingReqs",
      "missing_value": { "handsRequired": 1 }
    }
  },
  {
    "type": "LOCK_GRABBING",
    "comment": "Lock the required number of grabbing appendages for this weapon",
    "parameters": {
      "actor_id": "{event.payload.actorId}",
      "count": "{context.targetGrabbingReqs.handsRequired}",
      "item_id": "{event.payload.targetId}"
    }
  },
  {
    "type": "QUERY_COMPONENT",
    "parameters": {
      "entity_ref": "actor",
      "component_type": "core:position",
      "result_variable": "actorPosition"
    }
  },
  ... (rest of existing actions unchanged)
]
```

## Files to Create

None

## Out of Scope

- **DO NOT** modify any other rule files
- **DO NOT** modify the action file `wield_threateningly.action.json`
- **DO NOT** modify any other parts of `handle_wield_threateningly.rule.json` beyond the specified insertion
- **DO NOT** modify the condition file
- **DO NOT** change the `rule_id`, `event_type`, or `condition`
- **DO NOT** modify any operations after the insertion point

## Why This Fix Is Required

### Current Problem
1. Actor wields a two-handed sword
2. `positioning:wielding` component is added with the sword's ID
3. BUT no grabbing appendages are locked
4. Actor can still perform actions requiring free hands
5. `wield_threateningly` prerequisite checks free appendage, but appendage is never actually locked

### After Fix
1. Actor wields a two-handed sword
2. `LOCK_GRABBING` locks 2 appendages, associating them with the sword
3. `positioning:wielding` component is added with the sword's ID
4. Actor's free appendages are reduced by 2
5. Future wield attempts correctly check remaining free appendages
6. Unwield correctly releases the specific appendages holding the sword

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run validate                           # Schema validation passes
npm run test:integration -- --testPathPattern="weapons"  # Existing weapons tests still pass
npm run test:ci                            # Full test suite passes
```

### Manual Verification

1. `handle_wield_threateningly.rule.json` contains the two new operations
2. The new operations are positioned AFTER `GET_NAME` for target and BEFORE `QUERY_COMPONENT` for `core:position`
3. `QUERY_COMPONENT` for `anatomy:requires_grabbing` uses `missing_value: { "handsRequired": 1 }`
4. `LOCK_GRABBING` uses `item_id` parameter to associate appendages with the specific item
5. File is valid JSON and passes schema validation

### Invariants That Must Remain True

1. All existing weapons tests pass (some may need updates - see UNWITEACT-008)
2. The `rule_id` remains `handle_wield_threateningly`
3. The `event_type` remains `core:attempt_action`
4. The `condition` remains `weapons:event-is-action-wield-threateningly`
5. All operations after the insertion point remain unchanged
6. No other files are modified
