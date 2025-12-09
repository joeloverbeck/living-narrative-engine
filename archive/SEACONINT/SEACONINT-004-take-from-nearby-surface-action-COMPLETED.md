# SEACONINT-004: Create take_from_nearby_surface Action

**Status**: COMPLETED
**Priority**: HIGH
**Estimated Effort**: 1-2 hours
**Dependencies**: SEACONINT-003
**Blocks**: SEACONINT-007, SEACONINT-009

## Outcome

**What was originally planned:**
- Create 3 JSON files for the `furniture:take_from_nearby_surface` action
- No code modifications required
- Validation and test passes

**What was actually changed:**
- Created `data/mods/furniture/actions/take_from_nearby_surface.action.json` - Action definition exactly as specified
- Created `data/mods/furniture/conditions/event-is-action-take-from-nearby-surface.condition.json` - Event condition exactly as specified
- Created `data/mods/furniture/rules/handle_take_from_nearby_surface.rule.json` - Rule handler exactly as specified

**Verification performed:**
- `npm run validate` passed with 0 cross-reference violations
- All 72 items mod integration tests passed (547 tests)
- All 1966 integration test suites passed (16058 tests)
- Existing `items:take_from_container` tests continue to pass (31 tests)
- `isOnNearbyFurnitureOperator` unit tests pass (13 tests)

**Discrepancies from plan:**
- None. The ticket assumptions were all correct. All referenced scopes, conditions, and operations existed.

---

## Original Ticket Content

## Objective

Create the `furniture:take_from_nearby_surface` action that allows seated actors to take items from containers on nearby furniture surfaces.

## Files To Create

| File | Purpose |
|------|---------|
| `data/mods/furniture/actions/take_from_nearby_surface.action.json` | Action definition |
| `data/mods/furniture/conditions/event-is-action-take-from-nearby-surface.condition.json` | Event condition |
| `data/mods/furniture/rules/handle_take_from_nearby_surface.rule.json` | Rule handler |

## Files To Modify

None.

## Out of Scope

- **DO NOT** modify existing `items:take_from_container` action
- **DO NOT** modify the furniture mod manifest (handled in SEACONINT-007)
- **DO NOT** create integration tests (handled in SEACONINT-009)
- **DO NOT** modify any engine code
- **DO NOT** create the put action (handled in SEACONINT-005)

## Implementation Details

### 1. Action Definition

Create `data/mods/furniture/actions/take_from_nearby_surface.action.json`:

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "furniture:take_from_nearby_surface",
  "name": "Take From Nearby Surface",
  "description": "While seated, take an item from a container on nearby furniture",
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
      "description": "Container on nearby furniture to take from"
    },
    "secondary": {
      "scope": "items:container_contents",
      "placeholder": "item",
      "description": "Item to take",
      "contextFrom": "primary"
    }
  },
  "prerequisites": [
    {
      "logic": {
        "condition_ref": "anatomy:actor-has-free-grabbing-appendage"
      },
      "failure_message": "You need a free hand to take items from the surface."
    }
  ],
  "template": "reach over and take {secondary.name} from {primary.name}",
  "visual": {
    "backgroundColor": "#004d61",
    "textColor": "#e0f7fa",
    "hoverBackgroundColor": "#006978",
    "hoverTextColor": "#ffffff"
  }
}
```

### 2. Event Condition

Create `data/mods/furniture/conditions/event-is-action-take-from-nearby-surface.condition.json`:

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "furniture:event-is-action-take-from-nearby-surface",
  "description": "Checks if event is the take_from_nearby_surface action",
  "logic": {
    "==": [{ "var": "event.payload.actionId" }, "furniture:take_from_nearby_surface"]
  }
}
```

### 3. Rule Handler

Create `data/mods/furniture/rules/handle_take_from_nearby_surface.rule.json`:

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_take_from_nearby_surface",
  "comment": "Handles take_from_nearby_surface action - seated actor taking from nearby container",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "furniture:event-is-action-take-from-nearby-surface"
  },
  "actions": [
    {
      "type": "VALIDATE_INVENTORY_CAPACITY",
      "comment": "Check if actor can carry the item",
      "parameters": {
        "targetEntity": "{event.payload.actorId}",
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
              "value": "{context.actorName} reaches for {context.itemName} on {context.containerName}, but can't carry it."
            }
          },
          {
            "type": "DISPATCH_PERCEPTIBLE_EVENT",
            "comment": "Log failed take",
            "parameters": {
              "location_id": "{context.actorPosition.locationId}",
              "description_text": "{context.logMessage}",
              "perception_type": "take_from_nearby_surface_failed",
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
            "comment": "End turn after failed take",
            "parameters": {
              "entityId": "{event.payload.actorId}",
              "success": false
            }
          }
        ],
        "else_actions": [
          {
            "type": "TAKE_FROM_CONTAINER",
            "comment": "Move item from container to inventory",
            "parameters": {
              "actorEntity": "{event.payload.actorId}",
              "containerEntity": "{event.payload.targetId}",
              "itemEntity": "{event.payload.secondaryId}",
              "result_variable": "takeResult"
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
              "value": "{context.actorName} reaches over and takes {context.itemName} from {context.containerName}."
            }
          },
          {
            "type": "SET_VARIABLE",
            "comment": "Set perception type for macro",
            "parameters": {
              "variable_name": "perceptionType",
              "value": "item_taken_from_nearby_surface"
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

## Key Design Decisions

1. **Required `positioning:sitting_on`**: This is the opposite of the existing `take_from_container` which FORBIDS sitting
2. **Uses existing operations**: `TAKE_FROM_CONTAINER`, `VALIDATE_INVENTORY_CAPACITY`, etc. are already implemented
3. **Template includes "reach over"**: Conveys the seated context in action descriptions
4. **Distinct perception types**: `item_taken_from_nearby_surface` and `take_from_nearby_surface_failed`

## Acceptance Criteria

### Tests That Must Pass

1. `npm run validate` passes for all three JSON files
2. Action schema validation passes
3. Condition schema validation passes
4. Rule schema validation passes
5. All referenced operations exist (`TAKE_FROM_CONTAINER`, `VALIDATE_INVENTORY_CAPACITY`, etc.)
6. All referenced conditions exist (`anatomy:actor-has-free-grabbing-appendage`)
7. All referenced scopes exist (`furniture:open_containers_on_nearby_furniture`, `items:container_contents`)

### Invariants That Must Remain True

1. Existing `items:take_from_container` action unchanged
2. Standing actors cannot discover this action (requires `positioning:sitting_on`)
3. All schema validations pass
4. No breaking changes to the items mod

## Verification Commands

```bash
# Validate all JSON files
npm run validate

# Ensure no regressions
npm run test:ci
```

## Related Files (For Reference)

- `data/mods/items/actions/take_from_container.action.json` - Existing action to reference
- `data/mods/items/rules/handle_take_from_container.rule.json` - Existing rule pattern
- `data/mods/items/conditions/event-is-action-take-from-container.condition.json` - Existing condition pattern
