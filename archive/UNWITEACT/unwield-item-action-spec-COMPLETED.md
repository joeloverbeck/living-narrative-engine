# Specification: Unwield Item Action/Rule System

## Overview

This specification documents the implementation of the `weapons:unwield_item` action - the inverse of `weapons:wield_threateningly`. It also documents a **required fix** to `handle_wield_threateningly.rule.json` to properly integrate the grabbing appendage system.

## Problem Statement

Currently, the `wield_threateningly` action:
1. Adds items to the `positioning:wielding` component
2. **Does NOT lock grabbing appendages** via `LOCK_GRABBING`

This creates an inconsistency where wielded items don't properly occupy the actor's hands/appendages. The unwield action must use `UNLOCK_GRABBING` to release appendages, and the wield action must be fixed to use `LOCK_GRABBING`.

## Files to Create

### 1. Action: `data/mods/weapons/actions/unwield_item.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "weapons:unwield_item",
  "name": "Unwield Item",
  "description": "Stop wielding an item, freeing up your hands",
  "generateCombinations": true,
  "required_components": {
    "actor": [
      "items:inventory",
      "positioning:wielding"
    ]
  },
  "targets": {
    "primary": {
      "scope": "weapons:wielded_items",
      "placeholder": "target",
      "description": "Item to stop wielding"
    }
  },
  "template": "unwield {target}",
  "visual": {
    "backgroundColor": "#112a46",
    "textColor": "#e6f1ff",
    "hoverBackgroundColor": "#0b3954",
    "hoverTextColor": "#f0f4f8"
  }
}
```

**Key differences from `wield_threateningly`:**
- `required_components.actor` includes `positioning:wielding` (must be currently wielding)
- No `prerequisites` (no need to check for free appendage - we're releasing one)
- Uses new scope `weapons:wielded_items` (items currently being wielded)

---

### 2. Scope: `data/mods/weapons/scopes/wielded_items.scope`

```
weapons:wielded_items := actor.components.positioning:wielding.wielded_item_ids[]
```

This scope returns all entity IDs in the actor's `wielded_item_ids` array, making them available as targets for the unwield action.

---

### 3. Condition: `data/mods/weapons/conditions/event-is-action-unwield-item.condition.json`

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

---

### 4. Rule: `data/mods/weapons/rules/handle_unwield_item.rule.json`

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

**Key operations:**
1. `QUERY_COMPONENT` for `anatomy:requires_grabbing` with default `{ "handsRequired": 1 }`
2. `UNLOCK_GRABBING` with `item_id` to release only appendages holding this specific item
3. `MODIFY_ARRAY_FIELD` with `mode: "remove_by_value"` to remove from `wielded_item_ids`
4. `IF` to check if array is empty, then `REMOVE_COMPONENT`
5. `REGENERATE_DESCRIPTION` to update activity metadata

---

## Files to Fix

### 5. Rule Fix: `data/mods/weapons/rules/handle_wield_threateningly.rule.json`

**Current state:** Missing `LOCK_GRABBING` operation.

**Required changes:** Add these operations after the `GET_NAME` for target (around line 19):

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

These should be inserted **before** the `QUERY_COMPONENT` for `existingWielding` check.

---

## Component References

### `positioning:wielding` Component

**Location:** `data/mods/positioning/components/wielding.component.json`

```json
{
  "dataSchema": {
    "properties": {
      "wielded_item_ids": {
        "type": "array",
        "items": { "type": "string" },
        "uniqueItems": true
      }
    }
  },
  "activityMetadata": {
    "name": "wielding",
    "descriptionKey": "wielding_activity"
  }
}
```

### `anatomy:requires_grabbing` Component

**Location:** `data/mods/anatomy/components/requires_grabbing.component.json`

```json
{
  "dataSchema": {
    "properties": {
      "handsRequired": {
        "type": "integer",
        "minimum": 0,
        "default": 1
      },
      "minGripStrength": {
        "type": "number",
        "minimum": 0
      }
    },
    "required": ["handsRequired"]
  }
}
```

### Operation Schemas

**LOCK_GRABBING:** `data/schemas/operations/lockGrabbing.schema.json`
- `actor_id`: string (required)
- `count`: integer >= 1 (required)
- `item_id`: string (optional) - associates appendages with held item

**UNLOCK_GRABBING:** `data/schemas/operations/unlockGrabbing.schema.json`
- `actor_id`: string (required)
- `count`: integer >= 1 (required)
- `item_id`: string (optional) - only unlock appendages holding this specific item

---

## Test Specifications

### 6. Action Discovery Test: `tests/integration/mods/weapons/unwield_item_action_discovery.test.js`

**Test cases:**

1. **is available when actor is wielding an item**
   - Actor has `positioning:wielding` with item in `wielded_item_ids`
   - Actor has `items:inventory`
   - Action should be discoverable with wielded item as target

2. **is NOT available when actor has no wielding component**
   - Actor has `items:inventory` but no `positioning:wielding`
   - Action should not appear

3. **is NOT available when wielded_item_ids is empty**
   - Actor has `positioning:wielding` with empty array
   - Action should not appear (or component should have been removed)

4. **lists all wielded items as targets**
   - Actor wielding multiple items
   - All items should appear as target options

### 7. Rule Execution Test: `tests/integration/mods/weapons/unwield_item_rule_execution.test.js`

**Test cases:**

1. **successfully removes item from wielded_item_ids**
   - Execute unwield action
   - Verify item removed from array

2. **unlocks correct number of grabbing appendages**
   - Item has `anatomy:requires_grabbing.handsRequired: 2`
   - Verify 2 appendages unlocked after unwield
   - Verify `heldItemId` cleared from those appendages

3. **removes wielding component when last item unwielded**
   - Actor has single wielded item
   - Execute unwield
   - Verify `positioning:wielding` component removed

4. **preserves wielding component when other items remain**
   - Actor wielding 2 items
   - Unwield one item
   - Verify `positioning:wielding` still exists with other item

5. **regenerates actor description**
   - Verify description updated after unwield

6. **defaults to 1 hand if requires_grabbing missing**
   - Item without `anatomy:requires_grabbing` component
   - Verify 1 appendage unlocked

### 8. Wield Threateningly Fix Test Updates

**File:** `tests/integration/mods/weapons/wield_threateningly_rule_execution.test.js`

**Add test cases:**

1. **locks correct number of grabbing appendages**
   - Item has `anatomy:requires_grabbing.handsRequired: 2`
   - Execute wield action
   - Verify 2 appendages locked
   - Verify `heldItemId` set on locked appendages

2. **defaults to 1 hand if requires_grabbing missing**
   - Item without `anatomy:requires_grabbing` component
   - Verify 1 appendage locked

---

## Implementation Order

1. Create scope file `wielded_items.scope`
2. Create condition file `event-is-action-unwield-item.condition.json`
3. Create action file `unwield_item.action.json`
4. Create rule file `handle_unwield_item.rule.json`
5. Fix rule file `handle_wield_threateningly.rule.json` (add LOCK_GRABBING)
6. Create/update tests

---

## Acceptance Criteria

- [ ] `unwield_item` action appears when actor has wielding component
- [ ] Executing unwield removes item from `wielded_item_ids`
- [ ] Executing unwield calls `UNLOCK_GRABBING` with correct count and item_id
- [ ] Wielding component removed when last item unwielded
- [ ] Actor description regenerated after unwield
- [ ] `wield_threateningly` now calls `LOCK_GRABBING`
- [ ] All tests pass
- [ ] Schema validation passes for all new JSON files
