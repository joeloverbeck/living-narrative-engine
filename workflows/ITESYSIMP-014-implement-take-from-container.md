# ITESYSIMP-014: Implement Take From Container Action

**Phase:** 3 - Container System
**Priority:** High
**Estimated Effort:** 2 hours

## Goal

Implement the `take_from_container` action to allow actors to retrieve items from open containers.

## Context

Once a container is open, actors should be able to take items from it. This requires validating the container is open, checking inventory capacity, and updating both container contents and actor inventory.

## Tasks

### 1. Create TAKE_FROM_CONTAINER Handler

Create `src/logic/operationHandlers/items/takeFromContainerHandler.js`:

```javascript
import { assertNonBlankString, assertPresent } from '../../../utils/dependencyUtils.js';

/**
 * Takes an item from a container and adds it to actor's inventory
 */
class TakeFromContainerHandler {
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
    const { actorEntity, containerEntity, itemEntity } = params;

    assertNonBlankString(actorEntity, 'actorEntity', 'TAKE_FROM_CONTAINER', this.#logger);
    assertNonBlankString(containerEntity, 'containerEntity', 'TAKE_FROM_CONTAINER', this.#logger);
    assertNonBlankString(itemEntity, 'itemEntity', 'TAKE_FROM_CONTAINER', this.#logger);

    try {
      const container = this.#entityManager.getComponent(containerEntity, 'items:container');
      const inventory = this.#entityManager.getComponent(actorEntity, 'items:inventory');

      if (!container) {
        this.#logger.warn(`No container component`, { containerEntity });
        return { success: false, error: 'not_a_container' };
      }

      if (!container.isOpen) {
        this.#logger.debug(`Container is closed`, { containerEntity });
        return { success: false, error: 'container_closed' };
      }

      if (!container.contents.includes(itemEntity)) {
        this.#logger.warn(`Item not in container`, { containerEntity, itemEntity });
        return { success: false, error: 'item_not_in_container' };
      }

      if (!inventory) {
        this.#logger.warn(`No inventory on actor`, { actorEntity });
        return { success: false, error: 'no_inventory' };
      }

      // Remove from container, add to inventory
      const updates = [
        {
          entityId: containerEntity,
          componentId: 'items:container',
          data: {
            ...container,
            contents: container.contents.filter(id => id !== itemEntity)
          }
        },
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

      this.#eventBus.dispatch({
        type: 'ITEM_TAKEN_FROM_CONTAINER',
        payload: { actorEntity, containerEntity, itemEntity }
      });

      this.#logger.debug(`Item taken from container`, { actorEntity, containerEntity, itemEntity });
      return { success: true };

    } catch (error) {
      this.#logger.error(`Take from container failed`, error, { actorEntity, containerEntity, itemEntity });
      return { success: false, error: error.message };
    }
  }
}

export default TakeFromContainerHandler;
```

### 2. Create container_contents Scope

Create `data/mods/items/scopes/container_contents.scope`:

```
target.items:container.contents[]
```

**Description:** Returns item IDs from a container's contents. Uses `target` reference to access the container entity.

### 3. Create take_from_container Action

Create `data/mods/items/actions/take_from_container.action.json`:

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "items:take_from_container",
  "name": "Take From Container",
  "description": "Take an item from an open container",
  "generateCombinations": true,
  "targets": {
    "primary": {
      "scope": "items:openable_containers_at_location",
      "placeholder": "container",
      "description": "Container to take from",
      "contextFrom": "actor"
    },
    "secondary": {
      "scope": "items:container_contents",
      "placeholder": "item",
      "description": "Item to take",
      "contextFrom": "primary"
    }
  },
  "conditions": [
    {
      "type": "COMPONENT_PROPERTY_EQUALS",
      "entityRef": "primary",
      "componentId": "items:container",
      "property": "isOpen",
      "value": true
    }
  ],
  "formatTemplate": "Take {secondary.name} from {primary.name}"
}
```

### 4. Create Condition

Create `data/mods/items/conditions/event-is-action-take-from-container.condition.json`:

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "items:event-is-action-take-from-container",
  "description": "Checks if event is the take_from_container action",
  "jsonLogic": {
    "==": [
      { "var": "event.payload.actionId" },
      "items:take_from_container"
    ]
  }
}
```

### 5. Create Rule

Create `data/mods/items/rules/handle_take_from_container.rule.json`:

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "id": "items:handle_take_from_container",
  "description": "Handles take_from_container action with capacity validation",
  "priority": 100,
  "eventType": "ATTEMPT_ACTION",
  "conditions": [
    "items:event-is-action-take-from-container"
  ],
  "operations": [
    {
      "type": "VALIDATE_INVENTORY_CAPACITY",
      "comment": "Check if actor can carry the item",
      "parameters": {
        "targetEntity": "{event.payload.actorId}",
        "itemEntity": "{event.payload.secondaryTargetId}",
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
            "template": "{actorName} tried to take {itemName} from {containerName}, but can't carry it.",
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
              "perceptionType": "take_from_container_failed",
              "actorId": "{event.payload.actorId}",
              "containerId": "{event.payload.targetId}",
              "itemId": "{event.payload.secondaryTargetId}",
              "reason": "{context.capacityCheck.reason}"
            }
          }
        }
      ],
      "elseOperations": [
        {
          "type": "TAKE_FROM_CONTAINER",
          "comment": "Move item from container to inventory",
          "parameters": {
            "actorEntity": "{event.payload.actorId}",
            "containerEntity": "{event.payload.targetId}",
            "itemEntity": "{event.payload.secondaryTargetId}",
            "result_variable": "takeResult"
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
            "result_variable": "containerName"
          }
        },
        {
          "type": "GET_NAME",
          "parameters": {
            "entity_ref": "secondaryTarget",
            "result_variable": "itemName"
          }
        },
        {
          "type": "BUILD_MESSAGE",
          "parameters": {
            "template": "{actorName} took {itemName} from {containerName}.",
            "result_variable": "logMessage"
          }
        },
        {
          "type": "ADD_PERCEPTION_LOG_ENTRY",
          "comment": "Log successful take",
          "parameters": {
            "location_id": "{context.actorPosition.locationId}",
            "entry": {
              "descriptionText": "{context.logMessage}",
              "timestamp": "{timestamp}",
              "perceptionType": "item_taken_from_container",
              "actorId": "{event.payload.actorId}",
              "containerId": "{event.payload.targetId}",
              "itemId": "{event.payload.secondaryTargetId}"
            }
          }
        },
        {
          "type": "END_TURN",
          "comment": "End actor's turn after taking item"
        }
      ]
    }
  ]
}
```

### 6. Create Event

Create `data/mods/items/events/item_taken_from_container.event.json`:

```json
{
  "$schema": "schema://living-narrative-engine/event.schema.json",
  "id": "items:item_taken_from_container",
  "description": "Dispatched when an item is taken from a container",
  "payloadSchema": {
    "type": "object",
    "properties": {
      "actorEntity": {
        "type": "string",
        "description": "Actor who took the item"
      },
      "containerEntity": {
        "type": "string",
        "description": "Container the item was taken from"
      },
      "itemEntity": {
        "type": "string",
        "description": "Item that was taken"
      }
    },
    "required": ["actorEntity", "containerEntity", "itemEntity"]
  }
}
```

### 7. Update Mod Manifest

Add to `data/mods/items/mod-manifest.json` as appropriate.

### 8. Register Handler in DI Container

Update `src/dependencyInjection/containerConfig.js`:

```javascript
import TakeFromContainerHandler from '../logic/operationHandlers/items/takeFromContainerHandler.js';

container.register('TAKE_FROM_CONTAINER', TakeFromContainerHandler);
```

### 9. Create Tests

Create comprehensive tests covering:
- Discovery only shows open containers
- Taking from open container succeeds
- Closed container prevents taking
- Item not in container fails gracefully
- Capacity validation prevents overloading
- Container contents updated
- Actor inventory updated
- Perception logging

## Validation

- [ ] Handler follows standalone class pattern with DI
- [ ] Scope correctly accesses container contents via target reference
- [ ] Action only discovers open containers (isOpen = true)
- [ ] Item removed from container contents
- [ ] Item added to actor inventory
- [ ] Closed containers prevent taking
- [ ] Capacity validation works
- [ ] Perception logs created
- [ ] Turn ends after successful take
- [ ] Tests cover all scenarios
- [ ] All tests pass
- [ ] Mod manifest updated
- [ ] Handler registered in DI container

## Dependencies

- ITESYSIMP-012: Container component must exist
- ITESYSIMP-013: Open container action must exist
- ITESYSIMP-004: Capacity validation handler must exist

## Next Steps

After completion, proceed to:
- ITESYSIMP-015: Phase 3 comprehensive tests
