# UNWITEACT-004: Create `handle_unwield_item.rule.json` File

**Status**: COMPLETED

## Outcome

### What Was Actually Changed vs Originally Planned

**Originally Planned:**
- Create `handle_unwield_item.rule.json` file
- Ticket initially stated "Files to Modify: None" (incorrect assumption)

**Actually Changed:**
1. **Created**: `data/mods/weapons/rules/handle_unwield_item.rule.json` - as planned
2. **Modified**: `data/mods/weapons/mod-manifest.json` - added `anatomy` dependency (deviation from original plan)
   - **Reason**: The rule uses `anatomy:requires_grabbing` component, which requires declaring the `anatomy` mod as a dependency for cross-reference validation to pass
3. **Created**: `tests/integration/mods/weapons/unwield_item_rule_execution.test.js` - 7 integration tests

**Ticket Corrections Made:**
- Updated "Files to Modify" section to include manifest modification
- Removed incorrect invariant "No changes to any other files"

**Tests:**
- All 102 weapons tests pass (95 existing + 7 new)
- Schema validation passes (`npm run validate`)

---

## Summary

Create the rule file that handles the `unwield_item` action execution. This rule:
1. Queries the item's grabbing requirements
2. Unlocks the appropriate number of grabbing appendages
3. Removes the item from the `wielded_item_ids` array
4. Removes the `positioning:wielding` component if no items remain
5. Regenerates the actor's description

## Dependencies

- **UNWITEACT-002** (condition file) must be completed - the rule references `weapons:event-is-action-unwield-item`

## File to Create

### `data/mods/weapons/rules/handle_unwield_item.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_unwield_item",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "weapons:event-is-action-unwield-item"
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
      "type": "QUERY_COMPONENT",
      "comment": "Get target's grabbing requirements to know how many appendages to unlock",
      "parameters": {
        "entity_ref": "target",
        "component_type": "anatomy:requires_grabbing",
        "result_variable": "targetGrabbingReqs",
        "missing_value": { "handsRequired": 1 }
      }
    },
    {
      "type": "UNLOCK_GRABBING",
      "comment": "Release the appendages that were holding this item",
      "parameters": {
        "actor_id": "{event.payload.actorId}",
        "count": "{context.targetGrabbingReqs.handsRequired}",
        "item_id": "{event.payload.targetId}"
      }
    },
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
    },
    {
      "type": "QUERY_COMPONENT",
      "comment": "Check if any items remain in wielding component",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "positioning:wielding",
        "result_variable": "currentWielding"
      }
    },
    {
      "type": "IF",
      "comment": "Remove wielding component if no items remain",
      "parameters": {
        "condition": {
          "==": [
            { "var": "context.currentWielding.wielded_item_ids.length" },
            0
          ]
        },
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

## Files to Modify

### `data/mods/weapons/mod-manifest.json`

**Reason**: The rule uses `anatomy:requires_grabbing` component, requiring an `anatomy` dependency.

Add to `dependencies` array:
```json
{
  "id": "anatomy",
  "version": "1.0.0"
}
```

## Out of Scope

- **DO NOT** modify `handle_wield_threateningly.rule.json` (that's UNWITEACT-005)
- **DO NOT** modify any existing rules
- **DO NOT** modify any components, actions, or conditions

## Key Operations Explained

### 1. `QUERY_COMPONENT` for `anatomy:requires_grabbing`
```json
{
  "type": "QUERY_COMPONENT",
  "parameters": {
    "entity_ref": "target",
    "component_type": "anatomy:requires_grabbing",
    "result_variable": "targetGrabbingReqs",
    "missing_value": { "handsRequired": 1 }
  }
}
```
- Queries the item for its grabbing requirements
- If the component is missing, defaults to `{ "handsRequired": 1 }`
- This ensures single-handed weapons work even without the component

### 2. `UNLOCK_GRABBING`
```json
{
  "type": "UNLOCK_GRABBING",
  "parameters": {
    "actor_id": "{event.payload.actorId}",
    "count": "{context.targetGrabbingReqs.handsRequired}",
    "item_id": "{event.payload.targetId}"
  }
}
```
- Releases the specified number of grabbing appendages
- Uses `item_id` to only release appendages holding THIS specific item
- Critical for proper appendage tracking when wielding multiple items

### 3. `MODIFY_ARRAY_FIELD` with `remove_by_value`
```json
{
  "type": "MODIFY_ARRAY_FIELD",
  "parameters": {
    "entity_ref": "actor",
    "component_type": "positioning:wielding",
    "field": "wielded_item_ids",
    "mode": "remove_by_value",
    "value": "{event.payload.targetId}"
  }
}
```
- Removes the item ID from the `wielded_item_ids` array
- Uses `remove_by_value` mode to find and remove the specific item

### 4. `IF` condition for component cleanup
```json
{
  "type": "IF",
  "parameters": {
    "condition": {
      "==": [
        { "var": "context.currentWielding.wielded_item_ids.length" },
        0
      ]
    },
    "then_actions": [...]
  }
}
```
- Checks if the array is now empty
- If empty, removes the entire `positioning:wielding` component
- This keeps the ECS clean and prevents the action from showing when not wielding

### 5. `REGENERATE_DESCRIPTION`
- Updates the actor's description to remove "wielding" activity metadata
- Ensures the actor's appearance reflects their current state

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run validate                           # Schema validation passes
npm run test:integration -- --testPathPattern="weapons"  # Existing weapons tests still pass
```

### Manual Verification

1. Rule file exists at `data/mods/weapons/rules/handle_unwield_item.rule.json`
2. File is valid JSON
3. File passes schema validation against `rule.schema.json`
4. `rule_id` is `handle_unwield_item`
5. `event_type` is `core:attempt_action`
6. `condition.condition_ref` is `weapons:event-is-action-unwield-item` (created in UNWITEACT-002)
7. All operations use correct syntax and parameters

### Invariants That Must Remain True

1. All existing weapons tests pass
2. `handle_wield_threateningly.rule.json` is NOT modified
