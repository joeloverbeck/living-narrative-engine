# Seated Container Interaction Specification

## Overview

This specification describes the implementation of actions that allow seated actors to interact with containers on nearby furniture surfaces. For example, an actor sitting on a stool at a kitchen table should be able to pick up and put down items on that table.

## Problem Statement

The existing `items:take_from_container` and `items:put_in_container` actions have `positioning:sitting_on` as a **forbidden component**. This prevents seated actors from interacting with ANY containers in the location, which is intentional - it prevents unrealistic scenarios like reaching across a room to grab a book from a bookcase while seated on a distant chair.

However, this creates a UX problem for realistic scenarios where:
- An actor sits at a stool placed near a kitchen table
- The table contains items (e.g., jugs of cider and mead)
- The actor should logically be able to reach over and pick up/put down items on the table

### Current Entity Structure

```
┌─────────────────────────────────────────────────────────────┐
│                 fantasy:aldous_kitchen_instance             │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐   │
│  │ fantasy:aldous_kitchen_rustic_wooden_table_instance  │   │
│  │ - definitionId: furniture:rustic_wooden_table        │   │
│  │ - items:container: { contents: [cider, mead], ...}   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────┐ ┌─────────────────────────┐   │
│  │ plain_wooden_stool_1    │ │ plain_wooden_stool_2    │   │
│  │ (actor may be sitting)  │ │ (actor may be sitting)  │   │
│  └─────────────────────────┘ └─────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────┐ ┌─────────────────────────┐   │
│  │ plain_wooden_stool_3    │ │ plain_wooden_stool_4    │   │
│  └─────────────────────────┘ └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

Currently, there is no mechanical relationship between the stools and the table. This spec defines that relationship.

## Solution Design

### Approach

Create new "seated-only" versions of the container interaction actions that:

1. **Require** the actor to be sitting (`positioning:sitting_on` as a required component - opposite of the existing actions)
2. Use a new `furniture:near_furniture` component to track which furniture is "near" other furniture
3. Only allow interaction with containers that are ON nearby furniture

### Why Not Modify Existing Actions?

The existing `take_from_container` and `put_in_container` actions serve a valid purpose - they prevent seated actors from accessing distant containers. We create new actions instead:

- `furniture:take_from_nearby_surface` - Only for seated actors, only targets nearby furniture
- `furniture:put_on_nearby_surface` - Only for seated actors, only targets nearby furniture

---

## Implementation Details

### 1. New Component: `furniture:near_furniture`

**File:** `data/mods/furniture/components/near_furniture.component.json`

**Purpose:** Tracks which furniture entities this piece of furniture is "near" for interaction purposes.

**Schema:**
```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "furniture:near_furniture",
  "description": "Tracks which furniture entities this piece of furniture is 'near' for seated interaction purposes. Actors sitting on this furniture can interact with containers on nearby furniture.",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["nearFurnitureIds"],
    "properties": {
      "nearFurnitureIds": {
        "type": "array",
        "description": "Array of entity instance IDs of furniture that this furniture is near",
        "items": {
          "type": "string",
          "pattern": "^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$"
        },
        "uniqueItems": true,
        "default": []
      }
    }
  }
}
```

**Usage Example:**
```json
{
  "furniture:near_furniture": {
    "nearFurnitureIds": [
      "fantasy:aldous_kitchen_rustic_wooden_table_instance",
      "fantasy:nightstand_instance"
    ]
  }
}
```

**Design Notes:**
- Instance-level configuration (per the user's requirement)
- Supports multiple nearby furniture (sofa near both coffee table and nightstand)
- One-directional relationship (stool is near table, but table doesn't need to know about stool)

---

### 2. New Actions

#### 2.1 Take From Nearby Surface

**File:** `data/mods/furniture/actions/take_from_nearby_surface.action.json`

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

**Key Differences from `items:take_from_container`:**
- `required_components.actor` includes `positioning:sitting_on` (actor MUST be sitting)
- Does NOT have `positioning:sitting_on` in forbidden (existing action forbids it)
- Uses `furniture:open_containers_on_nearby_furniture` scope (new, restricted scope)
- Template includes "reach over" to convey the seated context

#### 2.2 Put On Nearby Surface

**File:** `data/mods/furniture/actions/put_on_nearby_surface.action.json`

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

---

### 3. New Scope

**File:** `data/mods/furniture/scopes/open_containers_on_nearby_furniture.scope`

**Challenge:** The scope needs to:
1. Get the furniture ID from actor's `positioning:sitting_on.furniture_id`
2. Look up that furniture entity's `furniture:near_furniture.nearFurnitureIds` array
3. Find entities that are open containers AND whose ID is in that array

This multi-step lookup cannot be expressed purely in Scope DSL + JSON Logic without a custom operator.

**Scope Definition:**
```
furniture:open_containers_on_nearby_furniture := entities(items:container)[][{"and": [
  {"==": [{"var": "entity.components.items:container.isOpen"}, true]},
  {"==": [
    {"var": "entity.components.core:position.locationId"},
    {"var": "actor.components.core:position.locationId"}
  ]},
  {"isOnNearbyFurniture": [{"var": "entity.id"}]}
]}]
```

**Explanation:**
- Starts with all entities that have `items:container` component
- Filters to only open containers (`isOpen: true`)
- Filters to same location as actor (basic proximity check)
- Uses custom `isOnNearbyFurniture` operator to check if the container's entity ID is in the nearby furniture list

---

### 4. New JSON Logic Operator

**File:** `src/logic/operators/isOnNearbyFurnitureOperator.js`

```javascript
/**
 * @file isOnNearbyFurnitureOperator.js
 * @description JSON Logic operator to check if an entity is on furniture that is
 * "near" the furniture the actor is sitting on.
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * Creates the isOnNearbyFurniture operator.
 *
 * Usage in JSON Logic:
 * {"isOnNearbyFurniture": [{"var": "entity.id"}]}
 *
 * Returns true if:
 * 1. Actor has positioning:sitting_on component
 * 2. The furniture actor is sitting on has furniture:near_furniture component
 * 3. The entity's ID is in the nearFurnitureIds array
 *
 * @param {Object} params - Dependencies
 * @param {Object} params.entityManager - Entity manager for lookups
 * @param {Object} params.logger - Logger instance
 * @returns {Function} The operator function
 */
export function createIsOnNearbyFurnitureOperator({ entityManager, logger }) {
  validateDependency(entityManager, 'IEntityManager', logger, {
    requiredMethods: ['getEntityInstance', 'getComponent'],
  });

  return function isOnNearbyFurniture(entityId) {
    try {
      // Get context - actor should be available in the evaluation context
      const context = this;
      const actorId = context?.actor?.id;

      if (!actorId) {
        logger.debug('isOnNearbyFurniture: No actor in context');
        return false;
      }

      // Check if actor is sitting
      const sittingOn = entityManager.getComponent(actorId, 'positioning:sitting_on');
      if (!sittingOn) {
        logger.debug(`isOnNearbyFurniture: Actor ${actorId} is not sitting`);
        return false;
      }

      const furnitureId = sittingOn.furniture_id;
      if (!furnitureId) {
        logger.debug('isOnNearbyFurniture: No furniture_id in sitting_on component');
        return false;
      }

      // Get the near_furniture component from the furniture
      const nearFurniture = entityManager.getComponent(furnitureId, 'furniture:near_furniture');
      if (!nearFurniture || !Array.isArray(nearFurniture.nearFurnitureIds)) {
        logger.debug(`isOnNearbyFurniture: Furniture ${furnitureId} has no near_furniture relationships`);
        return false;
      }

      // Check if the entity is in the nearby furniture list
      const isNearby = nearFurniture.nearFurnitureIds.includes(entityId);
      logger.debug(`isOnNearbyFurniture: Entity ${entityId} nearby=${isNearby}`);

      return isNearby;
    } catch (err) {
      logger.error('isOnNearbyFurniture operator error:', err);
      return false;
    }
  };
}

export default createIsOnNearbyFurnitureOperator;
```

**Registration in `src/logic/jsonLogicCustomOperators.js`:**
```javascript
import { createIsOnNearbyFurnitureOperator } from './operators/isOnNearbyFurnitureOperator.js';

// In the registerCustomOperators function:
jsonLogic.add_operation('isOnNearbyFurniture',
  createIsOnNearbyFurnitureOperator({ entityManager, logger })
);
```

**Token in `src/dependencyInjection/tokens/tokens-core.js`:**
```javascript
IsOnNearbyFurnitureOperator: 'IsOnNearbyFurnitureOperator',
```

---

### 5. New Conditions

#### 5.1 Event Is Action Take From Nearby Surface

**File:** `data/mods/furniture/conditions/event-is-action-take-from-nearby-surface.condition.json`

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

#### 5.2 Event Is Action Put On Nearby Surface

**File:** `data/mods/furniture/conditions/event-is-action-put-on-nearby-surface.condition.json`

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

---

### 6. New Rules

#### 6.1 Handle Take From Nearby Surface

**File:** `data/mods/furniture/rules/handle_take_from_nearby_surface.rule.json`

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

#### 6.2 Handle Put On Nearby Surface

**File:** `data/mods/furniture/rules/handle_put_on_nearby_surface.rule.json`

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

---

### 7. Entity Instance Updates

Each stool instance needs the `furniture:near_furniture` component added:

#### 7.1 plain_wooden_stool_1.entity.json

**File:** `data/mods/fantasy/entities/instances/plain_wooden_stool_1.entity.json`

```json
{
    "$schema": "http://example.com/schemas/entity-instance.schema.json",
    "instanceId": "fantasy:plain_wooden_stool_1_instance",
    "definitionId": "furniture:plain_wooden_stool",
    "componentOverrides": {
        "core:name": {
            "text": "plain wooden stool #1"
        },
        "core:position": {
            "locationId": "fantasy:aldous_kitchen_instance"
        },
        "furniture:near_furniture": {
            "nearFurnitureIds": ["fantasy:aldous_kitchen_rustic_wooden_table_instance"]
        }
    }
}
```

Apply similar changes to:
- `plain_wooden_stool_2.entity.json`
- `plain_wooden_stool_3.entity.json`
- `plain_wooden_stool_4.entity.json`

---

### 8. Mod Manifest Update

**File:** `data/mods/furniture/mod-manifest.json`

Add new content entries:

```json
{
  "id": "furniture",
  "version": "1.0.0",
  "name": "Furniture",
  "description": "Furniture entities and seated interaction mechanics",
  "dependencies": {
    "core": "^1.0.0",
    "items": "^1.0.0",
    "positioning": "^1.0.0"
  },
  "content": {
    "entities": [
      "entities/definitions/bar_stools.entity.json",
      ... (existing entries) ...
    ],
    "components": [
      "components/near_furniture.component.json"
    ],
    "actions": [
      "actions/take_from_nearby_surface.action.json",
      "actions/put_on_nearby_surface.action.json"
    ],
    "conditions": [
      "conditions/event-is-action-take-from-nearby-surface.condition.json",
      "conditions/event-is-action-put-on-nearby-surface.condition.json"
    ],
    "rules": [
      "rules/handle_take_from_nearby_surface.rule.json",
      "rules/handle_put_on_nearby_surface.rule.json"
    ],
    "scopes": [
      "scopes/open_containers_on_nearby_furniture.scope"
    ]
  }
}
```

---

## Edge Cases

| Edge Case | Expected Behavior |
|-----------|-------------------|
| Actor sitting but furniture has no `near_furniture` component | Scope returns empty set → action not discovered |
| Actor sitting but `nearFurnitureIds` is empty array | Scope returns empty set → action not discovered |
| Nearby furniture exists but has no `items:container` component | Filtered out by scope (requires `items:container`) |
| Nearby furniture has container but it's closed (`isOpen: false`) | Filtered out by scope (`isOpen: true` required) |
| Multiple furniture pieces in `nearFurnitureIds` | All nearby furniture with open containers are available as targets |
| Actor sitting on furniture that IS a container | Use existing `items:take_from_container` - our scope filters for NEARBY furniture only |
| Nearby furniture in different location | Filtered out by location check in scope |

---

## Testing Requirements

All tests should follow patterns in `docs/testing/mod-testing-guide.md` and use `ModTestFixture`.

### Action Discovery Tests

**File:** `tests/integration/mods/furniture/takeFromNearbySurfaceActionDiscovery.test.js`

| Test Case | Description |
|-----------|-------------|
| Action discovered when seated near container | Actor sitting on stool with `near_furniture` pointing to table with open container |
| Action NOT discovered when standing | Actor not sitting (no `positioning:sitting_on` component) |
| Action NOT discovered when no near_furniture | Sitting furniture has no `furniture:near_furniture` component |
| Action NOT discovered when nearFurnitureIds empty | `nearFurnitureIds` is `[]` |
| Action NOT discovered when no container | Nearby furniture has no `items:container` component |
| Action NOT discovered when container closed | Nearby furniture has `items:container` with `isOpen: false` |
| Action discovered for multiple nearby | Multiple furniture in `nearFurnitureIds`, action available for each with container |
| Secondary targets resolve correctly | Container contents appear as secondary targets |

**File:** `tests/integration/mods/furniture/putOnNearbySurfaceActionDiscovery.test.js`

| Test Case | Description |
|-----------|-------------|
| Action discovered when seated near container with inventory | Actor sitting, has items in inventory, near open container |
| Action NOT discovered when inventory empty | Actor has no items in inventory |
| (All other cases from take action) | Same discovery requirements |

### Rule Execution Tests

**File:** `tests/integration/mods/furniture/takeFromNearbySurfaceRuleExecution.test.js`

| Test Case | Description |
|-----------|-------------|
| Item successfully transferred | Item moves from container to actor's inventory |
| Capacity validation failure | Actor inventory full, failure event dispatched |
| Correct success event dispatched | `item_taken_from_nearby_surface` perception type |
| Correct failure event dispatched | `take_from_nearby_surface_failed` perception type |
| Actor description regenerated | `REGENERATE_DESCRIPTION` called after success |

**File:** `tests/integration/mods/furniture/putOnNearbySurfaceRuleExecution.test.js`

| Test Case | Description |
|-----------|-------------|
| Item successfully transferred | Item moves from actor's inventory to container |
| Capacity validation failure | Container full, failure event dispatched |
| Correct success event dispatched | `item_put_on_nearby_surface` perception type |
| Correct failure event dispatched | `put_on_nearby_surface_failed` perception type |

### Custom Operator Unit Tests

**File:** `tests/unit/logic/operators/isOnNearbyFurnitureOperator.test.js`

| Test Case | Description |
|-----------|-------------|
| Returns false when actor not sitting | No `positioning:sitting_on` component |
| Returns false when no near_furniture | Furniture has no `furniture:near_furniture` component |
| Returns false when entity not in list | Entity ID not in `nearFurnitureIds` array |
| Returns true when entity in list | Entity ID is in `nearFurnitureIds` array |
| Handles errors gracefully | Returns false on exceptions |

---

## File Summary

### Files to Create (14 total)

| File | Location |
|------|----------|
| `near_furniture.component.json` | `data/mods/furniture/components/` |
| `take_from_nearby_surface.action.json` | `data/mods/furniture/actions/` |
| `put_on_nearby_surface.action.json` | `data/mods/furniture/actions/` |
| `open_containers_on_nearby_furniture.scope` | `data/mods/furniture/scopes/` |
| `event-is-action-take-from-nearby-surface.condition.json` | `data/mods/furniture/conditions/` |
| `event-is-action-put-on-nearby-surface.condition.json` | `data/mods/furniture/conditions/` |
| `handle_take_from_nearby_surface.rule.json` | `data/mods/furniture/rules/` |
| `handle_put_on_nearby_surface.rule.json` | `data/mods/furniture/rules/` |
| `isOnNearbyFurnitureOperator.js` | `src/logic/operators/` |
| `takeFromNearbySurfaceActionDiscovery.test.js` | `tests/integration/mods/furniture/` |
| `putOnNearbySurfaceActionDiscovery.test.js` | `tests/integration/mods/furniture/` |
| `takeFromNearbySurfaceRuleExecution.test.js` | `tests/integration/mods/furniture/` |
| `putOnNearbySurfaceRuleExecution.test.js` | `tests/integration/mods/furniture/` |
| `isOnNearbyFurnitureOperator.test.js` | `tests/unit/logic/operators/` |

### Files to Modify (7 total)

| File | Change |
|------|--------|
| `data/mods/furniture/mod-manifest.json` | Add new content references |
| `data/mods/fantasy/entities/instances/plain_wooden_stool_1.entity.json` | Add `furniture:near_furniture` |
| `data/mods/fantasy/entities/instances/plain_wooden_stool_2.entity.json` | Add `furniture:near_furniture` |
| `data/mods/fantasy/entities/instances/plain_wooden_stool_3.entity.json` | Add `furniture:near_furniture` |
| `data/mods/fantasy/entities/instances/plain_wooden_stool_4.entity.json` | Add `furniture:near_furniture` |
| `src/logic/jsonLogicCustomOperators.js` | Register `isOnNearbyFurniture` operator |
| `src/dependencyInjection/tokens/tokens-core.js` | Add `IsOnNearbyFurnitureOperator` token |

---

## Implementation Order

1. Create `furniture:near_furniture` component schema
2. Create `isOnNearbyFurnitureOperator.js` operator
3. Register operator in `jsonLogicCustomOperators.js`
4. Add token to `tokens-core.js`
5. Create `open_containers_on_nearby_furniture.scope`
6. Create condition files
7. Create action files
8. Create rule files
9. Update stool entity instances with `furniture:near_furniture`
10. Update `furniture/mod-manifest.json`
11. Create unit tests for operator
12. Create integration tests for action discovery
13. Create integration tests for rule execution
14. Run full test suite and validation

---

## Related Files

- `data/mods/items/actions/take_from_container.action.json` - Existing action pattern
- `data/mods/items/rules/handle_take_from_container.rule.json` - Existing rule pattern
- `data/mods/items/scopes/open_containers_at_location.scope` - Existing scope pattern
- `data/mods/positioning/components/sitting_on.component.json` - Sitting detection
- `docs/testing/mod-testing-guide.md` - Testing patterns
