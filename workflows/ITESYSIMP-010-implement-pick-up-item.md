# ITESYSIMP-010: Implement Pick Up Item Action

**Phase:** 2 - Inventory Management
**Priority:** High
**Estimated Effort:** 2 hours

## Goal

Implement the `pick_up_item` action to allow actors to retrieve items from their current location and add them to inventory.

## Context

Pick up item enables actors to collect items from the world. Items must be at the same location and the actor must have inventory capacity.

## Tasks

### 1. Create PICK_UP_ITEM_FROM_LOCATION Handler

Create `src/logic/operationHandlers/items/pickUpItemFromLocationHandler.js`:

```javascript
import { assertNonBlankString, assertPresent } from '../../../utils/dependencyUtils.js';

/**
 * Picks up an item from a location and adds it to actor's inventory
 */
class PickUpItemFromLocationHandler {
  #entityManager;
  #eventBus;
  #logger;

  constructor({ entityManager, eventBus, logger }) {
    assertPresent(entityManager, 'entityManager is required');
    assertPresent(eventBus, 'eventBus is required');
    assertPresent(logger, 'logger is required');

    this.#entityManager = entityManager;
    this.#eventBus = eventBus;
    this.#logger = logger;
  }

  async execute(params, executionContext) {
    const { actorEntity, itemEntity } = params;

    assertNonBlankString(actorEntity, 'actorEntity', 'PICK_UP_ITEM_FROM_LOCATION', this.#logger);
    assertNonBlankString(itemEntity, 'itemEntity', 'PICK_UP_ITEM_FROM_LOCATION', this.#logger);

    try {
      const inventory = this.#entityManager.getComponent(actorEntity, 'items:inventory');

      if (!inventory) {
        this.#logger.warn(`No inventory on actor`, { actorEntity });
        return { success: false, error: 'no_inventory' };
      }

      // Add to inventory and remove position component
      const updates = [
        {
          entityId: actorEntity,
          componentId: 'items:inventory',
          data: {
            ...inventory,
            items: [...inventory.items, itemEntity]
          }
        }
      ];

      await this.#entityManager.batchAddComponentsOptimized(updates);

      // Remove position component (item no longer in world)
      this.#entityManager.removeComponent(itemEntity, 'positioning:position');

      this.#eventBus.dispatch({
        type: 'ITEM_PICKED_UP',
        payload: { actorEntity, itemEntity }
      });

      this.#logger.debug(`Item picked up`, { actorEntity, itemEntity });
      return { success: true };

    } catch (error) {
      this.#logger.error(`Pick up item failed`, error, { actorEntity, itemEntity });
      return { success: false, error: error.message };
    }
  }
}

export default PickUpItemFromLocationHandler;
```

### 2. Create items_at_location Scope

Create `data/mods/items/scopes/items_at_location.scope`:

```
positioning:entities_at_location[{"and": [
  {"has": [{"var": "entity"}, "items:item"]},
  {"has": [{"var": "entity"}, "items:portable"]}
]}]
```

**Description:** Returns portable items at the actor's current location using positioning mod's entities_at_location scope.

### 3. Create pick_up_item Action

Create `data/mods/items/actions/pick_up_item.action.json`:

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "items:pick_up_item",
  "name": "Pick Up Item",
  "description": "Pick up an item from the current location",
  "generateCombinations": true,
  "targets": {
    "primary": {
      "scope": "items:items_at_location",
      "placeholder": "item",
      "description": "Item to pick up",
      "contextFrom": "actor"
    }
  },
  "conditions": [
    {
      "type": "HAS_COMPONENT",
      "entityRef": "primary",
      "componentId": "items:portable"
    }
  ],
  "formatTemplate": "Pick up {primary.name}"
}
```

### 4. Create Condition

Create `data/mods/items/conditions/event-is-action-pick-up-item.condition.json`:

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "items:event-is-action-pick-up-item",
  "description": "Checks if event is the pick_up_item action",
  "jsonLogic": {
    "==": [
      { "var": "event.payload.actionId" },
      "items:pick_up_item"
    ]
  }
}
```

### 5. Create Rule

Create `data/mods/items/rules/handle_pick_up_item.rule.json`:

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "id": "items:handle_pick_up_item",
  "description": "Handles pick_up_item action with capacity validation and perception logging",
  "priority": 100,
  "eventType": "ATTEMPT_ACTION",
  "conditions": [
    "items:event-is-action-pick-up-item"
  ],
  "operations": [
    {
      "type": "VALIDATE_INVENTORY_CAPACITY",
      "comment": "Check if actor can carry the item",
      "parameters": {
        "targetEntity": "{event.payload.actorId}",
        "itemEntity": "{event.payload.targetId}",
        "result_variable": "capacityCheck"
      }
    },
    {
      "type": "CONDITIONAL_BRANCH",
      "comment": "Branch based on capacity validation",
      "condition": {
        "==": [
          { "var": "context.capacityCheck.valid" },
          false
        ]
      },
      "thenOperations": [
        {
          "type": "GET_COMPONENT",
          "parameters": {
            "entity_id": "{event.payload.actorId}",
            "component_id": "positioning:position",
            "result_variable": "actorPosition"
          }
        },
        {
          "type": "BUILD_MESSAGE",
          "parameters": {
            "template": "{actorName} tried to pick up {itemName}, but can't carry it.",
            "result_variable": "logMessage"
          }
        },
        {
          "type": "ADD_PERCEPTION_LOG_ENTRY",
          "parameters": {
            "location_id": "{context.actorPosition.locationId}",
            "entry": {
              "descriptionText": "{context.logMessage}",
              "timestamp": "{timestamp}",
              "perceptionType": "item_pickup_failed",
              "actorId": "{event.payload.actorId}",
              "itemId": "{event.payload.targetId}",
              "reason": "{context.capacityCheck.reason}"
            }
          }
        }
      ],
      "elseOperations": [
        {
          "type": "PICK_UP_ITEM_FROM_LOCATION",
          "comment": "Add to inventory and remove from world",
          "parameters": {
            "actorEntity": "{event.payload.actorId}",
            "itemEntity": "{event.payload.targetId}",
            "result_variable": "pickupResult"
          }
        },
        {
          "type": "GET_COMPONENT",
          "parameters": {
            "entity_id": "{event.payload.actorId}",
            "component_id": "positioning:position",
            "result_variable": "actorPosition"
          }
        },
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
            "result_variable": "itemName"
          }
        },
        {
          "type": "BUILD_MESSAGE",
          "parameters": {
            "template": "{actorName} picked up {itemName}.",
            "result_variable": "logMessage"
          }
        },
        {
          "type": "ADD_PERCEPTION_LOG_ENTRY",
          "comment": "Log the pickup for observers",
          "parameters": {
            "location_id": "{context.actorPosition.locationId}",
            "entry": {
              "descriptionText": "{context.logMessage}",
              "timestamp": "{timestamp}",
              "perceptionType": "item_picked_up",
              "actorId": "{event.payload.actorId}",
              "itemId": "{event.payload.targetId}"
            }
          }
        },
        {
          "type": "END_TURN",
          "comment": "End actor's turn after successful pickup"
        }
      ]
    }
  ]
}
```

### 6. Create item_picked_up Event

Create `data/mods/items/events/item_picked_up.event.json`:

```json
{
  "$schema": "schema://living-narrative-engine/event.schema.json",
  "id": "items:item_picked_up",
  "description": "Dispatched when an item is picked up from a location",
  "payloadSchema": {
    "type": "object",
    "properties": {
      "actorEntity": {
        "type": "string",
        "description": "Actor who picked up the item"
      },
      "itemEntity": {
        "type": "string",
        "description": "Item that was picked up"
      }
    },
    "required": ["actorEntity", "itemEntity"]
  }
}
```

### 7. Update Mod Manifest

Add to `data/mods/items/mod-manifest.json`:

```json
{
  "actions": [
    "give_item.action.json",
    "drop_item.action.json",
    "pick_up_item.action.json"
  ],
  "conditions": [
    "event-is-action-give-item.condition.json",
    "event-is-action-drop-item.condition.json",
    "event-is-action-pick-up-item.condition.json"
  ],
  "rules": [
    "handle_give_item.rule.json",
    "handle_drop_item.rule.json",
    "handle_pick_up_item.rule.json"
  ],
  "scopes": [
    "actor_inventory_items.scope",
    "close_actors_with_inventory.scope",
    "items_at_location.scope"
  ],
  "events": [
    "item_dropped.event.json",
    "item_picked_up.event.json"
  ]
}
```

### 8. Register Handler in DI Container

Update `src/dependencyInjection/containerConfig.js`:

```javascript
import PickUpItemFromLocationHandler from '../logic/operationHandlers/items/pickUpItemFromLocationHandler.js';

container.register('PICK_UP_ITEM_FROM_LOCATION', PickUpItemFromLocationHandler);
```

### 9. Create Tests

Create comprehensive tests covering:
- Scope discovers items at location
- Action discovery generates correct actions
- Capacity validation prevents overloading
- Item added to inventory
- Position component removed from item
- Perception logging
- Turn ending

## Validation

- [ ] Handler follows standalone class pattern with DI
- [ ] Scope correctly filters for portable items at location
- [ ] Item added to inventory on pickup
- [ ] Position component removed from item
- [ ] Capacity validation prevents overloading
- [ ] Perception logs created for success and failure
- [ ] Turn ends after successful pickup
- [ ] Tests cover all scenarios
- [ ] All tests pass
- [ ] Mod manifest updated
- [ ] Handler registered in DI container

## Dependencies

- ITESYSIMP-001: Mod structure must exist
- ITESYSIMP-002: Marker components must exist
- ITESYSIMP-003: Data components must exist
- ITESYSIMP-004: Capacity validation handler must exist
- Positioning mod for entities_at_location scope

## Next Steps

After completion, proceed to:
- ITESYSIMP-011: Phase 2 comprehensive tests
