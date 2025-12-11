# SEACONINT-005: Create put_on_nearby_surface Action

**Status**: COMPLETED
**Priority**: HIGH
**Estimated Effort**: 1-2 hours
**Actual Effort**: ~30 minutes
**Dependencies**: SEACONINT-003
**Blocks**: SEACONINT-007, SEACONINT-009
**Completed**: 2025-12-09

## Outcome

### What Was Actually Changed vs Originally Planned

**Originally Planned**:
- Create 3 JSON files for the put_on_nearby_surface action

**Actually Changed**:
- Created exactly the 3 files as specified, with no deviations from the ticket specification

### Files Created

| File | Status |
|------|--------|
| `data/mods/furniture/actions/put_on_nearby_surface.action.json` | ✅ Created |
| `data/mods/furniture/conditions/event-is-action-put-on-nearby-surface.condition.json` | ✅ Created |
| `data/mods/furniture/rules/handle_put_on_nearby_surface.rule.json` | ✅ Created |

### Assumption Validation

All ticket assumptions were verified as correct:
- ✅ `PUT_IN_CONTAINER` operation exists in preValidationUtils.js
- ✅ `VALIDATE_CONTAINER_CAPACITY` operation exists in preValidationUtils.js
- ✅ `furniture:open_containers_on_nearby_furniture` scope exists (from SEACONINT-003)
- ✅ `items:actor_inventory_items` scope exists in items mod
- ✅ `anatomy:actor-has-free-grabbing-appendage` condition exists
- ✅ Pattern mirrors SEACONINT-004's take action implementation

### Test Results

- ✅ `npm run validate` passed with 0 violations across 55 mods
- ✅ All 547 items integration tests passed
- ✅ All 906 positioning tests passed
- ✅ All 13 isOnNearbyFurniture operator tests passed

### Notes

- Integration tests for action discovery and rule execution are handled by SEACONINT-009
- No ticket corrections were needed - assumptions matched the codebase exactly
- Implementation follows the exact pattern of `take_from_nearby_surface` (SEACONINT-004)

---

## Original Ticket Content

## Objective

Create the `furniture:put_on_nearby_surface` action that allows seated actors to put items from their inventory onto containers on nearby furniture surfaces.

## Files To Create

| File | Purpose |
|------|---------|
| `data/mods/furniture/actions/put_on_nearby_surface.action.json` | Action definition |
| `data/mods/furniture/conditions/event-is-action-put-on-nearby-surface.condition.json` | Event condition |
| `data/mods/furniture/rules/handle_put_on_nearby_surface.rule.json` | Rule handler |

## Files To Modify

None.

## Out of Scope

- **DO NOT** modify existing `containers:put_in_container` action
- **DO NOT** modify the furniture mod manifest (handled in SEACONINT-007)
- **DO NOT** create integration tests (handled in SEACONINT-009)
- **DO NOT** modify any engine code
- **DO NOT** create the take action (handled in SEACONINT-004)

## Implementation Details

### 1. Action Definition

Create `data/mods/furniture/actions/put_on_nearby_surface.action.json`:

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "furniture:put_on_nearby_surface",
  "name": "Put On Nearby Surface",
  "description": "While seated, place an item in a container on nearby furniture",
  "generateCombinations": true,
  "required_components": {
    "actor": ["items:inventory", "positioning:sitting_on"]
  },
  "forbidden_components": {
    "actor": [
      "positioning:fallen",
      "positioning:restraining"
    ]
  },
  "targets": {
    "primary": {
      "scope": "furniture:open_containers_on_nearby_furniture",
      "placeholder": "container",
      "description": "Container on nearby furniture to put item in"
    },
    "secondary": {
      "scope": "items:actor_inventory_items",
      "placeholder": "item",
      "description": "Inventory item to place"
    }
  },
  "prerequisites": [
    {
      "logic": {
        "condition_ref": "anatomy:actor-has-free-grabbing-appendage"
      },
      "failure_message": "You need a free hand to place items on the surface."
    }
  ],
  "template": "reach over and put {secondary.name} on {primary.name}",
  "visual": {
    "backgroundColor": "#004d61",
    "textColor": "#e0f7fa",
    "hoverBackgroundColor": "#006978",
    "hoverTextColor": "#ffffff"
  }
}
```

### 2. Event Condition

Create `data/mods/furniture/conditions/event-is-action-put-on-nearby-surface.condition.json`:

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "furniture:event-is-action-put-on-nearby-surface",
  "description": "Checks if event is the put_on_nearby_surface action",
  "logic": {
    "==": [{ "var": "event.payload.actionId" }, "furniture:put_on_nearby_surface"]
  }
}
```

### 3. Rule Handler

Create `data/mods/furniture/rules/handle_put_on_nearby_surface.rule.json`:

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_put_on_nearby_surface",
  "comment": "Handles put_on_nearby_surface action - seated actor putting item on nearby container",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "furniture:event-is-action-put-on-nearby-surface"
  },
  "actions": [
    {
      "type": "VALIDATE_CONTAINER_CAPACITY",
      "comment": "Check if container has capacity for the item",
      "parameters": {
        "containerEntity": "{event.payload.targetId}",
        "itemEntity": "{event.payload.secondaryId}",
        "result_variable": "capacityCheck"
      }
    },
    {
      "type": "IF",
      "comment": "Branch based on capacity validation",
      "parameters": {
        "condition": {
          "==": [{ "var": "context.capacityCheck.valid" }, false]
        },
        "then_actions": [
          {
            "type": "QUERY_COMPONENT",
            "comment": "Get actor position for logging",
            "parameters": {
              "entity_ref": "actor",
              "component_type": "core:position",
              "result_variable": "actorPosition"
            }
          },
          {
            "type": "GET_NAME",
            "comment": "Get actor name",
            "parameters": {
              "entity_ref": "actor",
              "result_variable": "actorName"
            }
          },
          {
            "type": "GET_NAME",
            "comment": "Get container name",
            "parameters": {
              "entity_ref": "target",
              "result_variable": "containerName"
            }
          },
          {
            "type": "GET_NAME",
            "comment": "Get item name",
            "parameters": {
              "entity_ref": "{event.payload.secondaryId}",
              "result_variable": "itemName"
            }
          },
          {
            "type": "SET_VARIABLE",
            "comment": "Prepare failure message",
            "parameters": {
              "variable_name": "logMessage",
              "value": "{context.actorName} tries to put {context.itemName} on {context.containerName}, but it won't fit."
            }
          },
          {
            "type": "DISPATCH_PERCEPTIBLE_EVENT",
            "comment": "Log failed put",
            "parameters": {
              "location_id": "{context.actorPosition.locationId}",
              "description_text": "{context.logMessage}",
              "perception_type": "put_on_nearby_surface_failed",
              "actor_id": "{event.payload.actorId}",
              "target_id": "{event.payload.targetId}",
              "involved_entities": ["{event.payload.secondaryId}"],
              "contextual_data": {
                "reason": "{context.capacityCheck.reason}"
              }
            }
          },
          {
            "type": "END_TURN",
            "comment": "End turn after failed put",
            "parameters": {
              "entityId": "{event.payload.actorId}",
              "success": false
            }
          }
        ],
        "else_actions": [
          {
            "type": "PUT_IN_CONTAINER",
            "comment": "Move item from inventory to container",
            "parameters": {
              "actorEntity": "{event.payload.actorId}",
              "containerEntity": "{event.payload.targetId}",
              "itemEntity": "{event.payload.secondaryId}",
              "result_variable": "putResult"
            }
          },
          {
            "type": "QUERY_COMPONENT",
            "comment": "Get actor position for logging",
            "parameters": {
              "entity_ref": "actor",
              "component_type": "core:position",
              "result_variable": "actorPosition"
            }
          },
          {
            "type": "GET_NAME",
            "comment": "Get actor name",
            "parameters": {
              "entity_ref": "actor",
              "result_variable": "actorName"
            }
          },
          {
            "type": "GET_NAME",
            "comment": "Get container name",
            "parameters": {
              "entity_ref": "target",
              "result_variable": "containerName"
            }
          },
          {
            "type": "GET_NAME",
            "comment": "Get item name",
            "parameters": {
              "entity_ref": "{event.payload.secondaryId}",
              "result_variable": "itemName"
            }
          },
          {
            "type": "SET_VARIABLE",
            "comment": "Prepare success message",
            "parameters": {
              "variable_name": "logMessage",
              "value": "{context.actorName} reaches over and puts {context.itemName} on {context.containerName}."
            }
          },
          {
            "type": "SET_VARIABLE",
            "comment": "Set perception type for macro",
            "parameters": {
              "variable_name": "perceptionType",
              "value": "item_put_on_nearby_surface"
            }
          },
          {
            "type": "SET_VARIABLE",
            "comment": "Set location for macro",
            "parameters": {
              "variable_name": "locationId",
              "value": "{context.actorPosition.locationId}"
            }
          },
          {
            "type": "SET_VARIABLE",
            "comment": "Set target for macro",
            "parameters": {
              "variable_name": "targetId",
              "value": "{event.payload.targetId}"
            }
          },
          {
            "type": "REGENERATE_DESCRIPTION",
            "comment": "Regenerate actor description to reflect inventory changes",
            "parameters": {
              "entity_ref": "{event.payload.actorId}"
            }
          },
          {
            "comment": "Display success message and end turn",
            "macro": "core:logSuccessAndEndTurn"
          }
        ]
      }
    }
  ]
}
```

## Key Differences from SEACONINT-004 (Take Action)

| Aspect | Take Action | Put Action |
|--------|-------------|------------|
| Secondary scope | `containers-core:container_contents` | `items:actor_inventory_items` |
| Secondary contextFrom | `primary` | (none - actor's inventory) |
| Validation operation | `VALIDATE_INVENTORY_CAPACITY` | `VALIDATE_CONTAINER_CAPACITY` |
| Transfer operation | `TAKE_FROM_CONTAINER` | `PUT_IN_CONTAINER` |
| Success perception | `item_taken_from_nearby_surface` | `item_put_on_nearby_surface` |
| Failure perception | `take_from_nearby_surface_failed` | `put_on_nearby_surface_failed` |
| Template | "reach over and take" | "reach over and put" |

## Acceptance Criteria

### Tests That Must Pass

1. ✅ `npm run validate` passes for all three JSON files
2. ✅ Action schema validation passes
3. ✅ Condition schema validation passes
4. ✅ Rule schema validation passes
5. ✅ All referenced operations exist (`PUT_IN_CONTAINER`, `VALIDATE_CONTAINER_CAPACITY`, etc.)
6. ✅ All referenced conditions exist (`anatomy:actor-has-free-grabbing-appendage`)
7. ✅ All referenced scopes exist (`furniture:open_containers_on_nearby_furniture`, `items:actor_inventory_items`)

### Invariants That Must Remain True

1. ✅ Existing `containers:put_in_container` action unchanged
2. ✅ Standing actors cannot discover this action (requires `positioning:sitting_on`)
3. ✅ Actors with empty inventory cannot discover this action (no secondary targets)
4. ✅ All schema validations pass
5. ✅ No breaking changes to the items mod

## Verification Commands

```bash
# Validate all JSON files
npm run validate

# Ensure no regressions
npm run test:ci
```

## Related Files (For Reference)

- `data/mods/containers/actions/put_in_container.action.json` - Existing action to reference
- `data/mods/containers/rules/handle_put_in_container.rule.json` - Existing rule pattern
- `data/mods/containers/conditions/event-is-action-put-in-container.condition.json` - Existing condition pattern
