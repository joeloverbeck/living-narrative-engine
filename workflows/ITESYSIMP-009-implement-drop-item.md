# ITESYSIMP-009: Implement Drop Item Action

**Phase:** 2 - Inventory Management
**Priority:** High
**Estimated Effort:** 2 hours

## Goal

Implement the `drop_item` action to allow actors to place items from their inventory into the current location.

## Context

Drop item enables actors to remove items from inventory and place them in the world. Items become available for others to pick up at that location.

## Tasks

### 1. Create DROP_ITEM_AT_LOCATION Handler

Create `src/logic/operationHandlers/items/dropItemAtLocationHandler.js`:

```javascript
import { assertNonBlankString, assertPresent } from '../../../utils/dependencyUtils.js';

/**
 * Drops an item from inventory at a location, making it available for pickup
 */
class DropItemAtLocationHandler {
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
    const { actorEntity, itemEntity, locationId } = params;

    assertNonBlankString(actorEntity, 'actorEntity', 'DROP_ITEM_AT_LOCATION', this.#logger);
    assertNonBlankString(itemEntity, 'itemEntity', 'DROP_ITEM_AT_LOCATION', this.#logger);
    assertNonBlankString(locationId, 'locationId', 'DROP_ITEM_AT_LOCATION', this.#logger);

    try {
      const inventory = this.#entityManager.getComponent(actorEntity, 'items:inventory');

      if (!inventory) {
        this.#logger.warn(`No inventory on actor`, { actorEntity });
        return { success: false, error: 'no_inventory' };
      }

      if (!inventory.items.includes(itemEntity)) {
        this.#logger.warn(`Item not in inventory`, { actorEntity, itemEntity });
        return { success: false, error: 'item_not_in_inventory' };
      }

      // Remove from inventory and set position
      const updates = [
        {
          entityId: actorEntity,
          componentId: 'items:inventory',
          data: {
            ...inventory,
            items: inventory.items.filter(id => id !== itemEntity)
          }
        },
        {
          entityId: itemEntity,
          componentId: 'positioning:position',
          data: { locationId }
        }
      ];

      await this.#entityManager.batchAddComponentsOptimized(updates);

      this.#eventBus.dispatch({
        type: 'ITEM_DROPPED',
        payload: { actorEntity, itemEntity, locationId }
      });

      this.#logger.debug(`Item dropped at location`, { actorEntity, itemEntity, locationId });
      return { success: true };

    } catch (error) {
      this.#logger.error(`Drop item failed`, error, { actorEntity, itemEntity, locationId });
      return { success: false, error: error.message };
    }
  }
}

export default DropItemAtLocationHandler;
```

### 2. Create drop_item Action

Create `data/mods/items/actions/drop_item.action.json`:

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "items:drop_item",
  "name": "Drop Item",
  "description": "Drop an item from your inventory at your current location",
  "generateCombinations": true,
  "targets": {
    "primary": {
      "scope": "items:actor_inventory_items",
      "placeholder": "item",
      "description": "Item to drop",
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
  "formatTemplate": "Drop {primary.name}"
}
```

### 3. Create Condition

Create `data/mods/items/conditions/event-is-action-drop-item.condition.json`:

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "items:event-is-action-drop-item",
  "description": "Checks if event is the drop_item action",
  "jsonLogic": {
    "==": [
      { "var": "event.payload.actionId" },
      "items:drop_item"
    ]
  }
}
```

### 4. Create Rule

Create `data/mods/items/rules/handle_drop_item.rule.json`:

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "id": "items:handle_drop_item",
  "description": "Handles drop_item action with perception logging",
  "priority": 100,
  "eventType": "ATTEMPT_ACTION",
  "conditions": [
    "items:event-is-action-drop-item"
  ],
  "operations": [
    {
      "type": "GET_COMPONENT",
      "comment": "Get actor's current position",
      "parameters": {
        "entity_id": "{event.payload.actorId}",
        "component_id": "positioning:position",
        "result_variable": "actorPosition"
      }
    },
    {
      "type": "DROP_ITEM_AT_LOCATION",
      "comment": "Remove from inventory and place at location",
      "parameters": {
        "actorEntity": "{event.payload.actorId}",
        "itemEntity": "{event.payload.targetId}",
        "locationId": "{context.actorPosition.locationId}",
        "result_variable": "dropResult"
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
        "template": "{actorName} dropped {itemName}.",
        "result_variable": "logMessage"
      }
    },
    {
      "type": "ADD_PERCEPTION_LOG_ENTRY",
      "comment": "Log the drop for observers",
      "parameters": {
        "location_id": "{context.actorPosition.locationId}",
        "entry": {
          "descriptionText": "{context.logMessage}",
          "timestamp": "{timestamp}",
          "perceptionType": "item_dropped",
          "actorId": "{event.payload.actorId}",
          "itemId": "{event.payload.targetId}"
        }
      }
    },
    {
      "type": "END_TURN",
      "comment": "End actor's turn after dropping item"
    }
  ]
}
```

### 5. Create item_dropped Event

Create `data/mods/items/events/item_dropped.event.json`:

```json
{
  "$schema": "schema://living-narrative-engine/event.schema.json",
  "id": "items:item_dropped",
  "description": "Dispatched when an item is dropped at a location",
  "payloadSchema": {
    "type": "object",
    "properties": {
      "actorEntity": {
        "type": "string",
        "description": "Actor who dropped the item"
      },
      "itemEntity": {
        "type": "string",
        "description": "Item that was dropped"
      },
      "locationId": {
        "type": "string",
        "description": "Location where item was dropped"
      }
    },
    "required": ["actorEntity", "itemEntity", "locationId"]
  }
}
```

### 6. Update Mod Manifest

Add to `data/mods/items/mod-manifest.json`:

```json
{
  "actions": [
    "give_item.action.json",
    "drop_item.action.json"
  ],
  "conditions": [
    "event-is-action-give-item.condition.json",
    "event-is-action-drop-item.condition.json"
  ],
  "rules": [
    "handle_give_item.rule.json",
    "handle_drop_item.rule.json"
  ],
  "events": [
    "item_dropped.event.json"
  ]
}
```

### 7. Register Handler in DI Container

Update `src/dependencyInjection/containerConfig.js`:

```javascript
import DropItemAtLocationHandler from '../logic/operationHandlers/items/dropItemAtLocationHandler.js';

container.register('DROP_ITEM_AT_LOCATION', DropItemAtLocationHandler);
```

### 8. Create Tests

Create integration tests in `tests/integration/mods/items/drop_item_*.test.js` covering:
- Action discovery
- Successful drop
- Item appears at location with position component
- Perception logging
- Turn ending

## Validation

- [ ] Handler follows standalone class pattern with DI
- [ ] Item removed from inventory on drop
- [ ] Item gets positioning:position component with correct locationId
- [ ] Perception logs created
- [ ] Turn ends after successful drop
- [ ] Tests cover discovery and execution
- [ ] All tests pass
- [ ] Mod manifest updated
- [ ] Handler registered in DI container

## Dependencies

- ITESYSIMP-001: Mod structure must exist
- ITESYSIMP-002: Marker components must exist
- ITESYSIMP-003: Data components must exist
- Positioning mod for position component

## Next Steps

After completion, proceed to:
- ITESYSIMP-010: Implement pick_up_item action
