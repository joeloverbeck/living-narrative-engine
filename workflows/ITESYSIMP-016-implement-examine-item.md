# ITESYSIMP-016: Implement Examine Item Action

**Phase:** 4 - Advanced Features
**Priority:** Medium
**Estimated Effort:** 1.5 hours

## Goal

Implement the `examine_item` action to allow actors to get detailed descriptions of items in their inventory or at their location.

## Context

Examine provides narrative richness by revealing item descriptions. This is a read-only action that doesn't modify state but creates perception logs for the actor.

## Tasks

### 1. Create EXAMINE_ITEM Handler

Create `src/logic/operationHandlers/items/examineItemHandler.js`:

```javascript
import { assertNonBlankString, assertPresent } from '../../../utils/dependencyUtils.js';

/**
 * Examines an item to reveal its full description
 */
class ExamineItemHandler {
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

    assertNonBlankString(actorEntity, 'actorEntity', 'EXAMINE_ITEM', this.#logger);
    assertNonBlankString(itemEntity, 'itemEntity', 'EXAMINE_ITEM', this.#logger);

    try {
      const description = this.#entityManager.getComponent(itemEntity, 'core:description');

      if (!description) {
        this.#logger.warn(`No description component on item`, { itemEntity });
        return { success: false, error: 'no_description' };
      }

      this.#eventBus.dispatch({
        type: 'ITEM_EXAMINED',
        payload: { actorEntity, itemEntity, description: description.fullDescription }
      });

      this.#logger.debug(`Item examined`, { actorEntity, itemEntity });
      return {
        success: true,
        fullDescription: description.fullDescription,
        shortDescription: description.shortDescription
      };

    } catch (error) {
      this.#logger.error(`Examine item failed`, error, { actorEntity, itemEntity });
      return { success: false, error: error.message };
    }
  }
}

export default ExamineItemHandler;
```

### 2. Create examinable_items Scope

Create `data/mods/items/scopes/examinable_items.scope`:

```
(actor.items:inventory.items[] | items:items_at_location)[{"has": [{"var": "entity"}, "core:description"]}]
```

**Description:** Returns items from actor's inventory OR at their location that have descriptions. Uses union operator `|` and filters for description component.

### 3. Create examine_item Action

Create `data/mods/items/actions/examine_item.action.json`:

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "items:examine_item",
  "name": "Examine Item",
  "description": "Examine an item to see its full description",
  "generateCombinations": true,
  "targets": {
    "primary": {
      "scope": "items:examinable_items",
      "placeholder": "item",
      "description": "Item to examine",
      "contextFrom": "actor"
    }
  },
  "conditions": [
    {
      "type": "HAS_COMPONENT",
      "entityRef": "primary",
      "componentId": "core:description"
    }
  ],
  "formatTemplate": "Examine {primary.name}"
}
```

### 4. Create Condition

Create `data/mods/items/conditions/event-is-action-examine-item.condition.json`:

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "items:event-is-action-examine-item",
  "description": "Checks if event is the examine_item action",
  "jsonLogic": {
    "==": [
      { "var": "event.payload.actionId" },
      "items:examine_item"
    ]
  }
}
```

### 5. Create Rule

Create `data/mods/items/rules/handle_examine_item.rule.json`:

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "id": "items:handle_examine_item",
  "description": "Handles examine_item action with description reveal",
  "priority": 100,
  "eventType": "ATTEMPT_ACTION",
  "conditions": [
    "items:event-is-action-examine-item"
  ],
  "operations": [
    {
      "type": "EXAMINE_ITEM",
      "comment": "Get item description",
      "parameters": {
        "actorEntity": "{event.payload.actorId}",
        "itemEntity": "{event.payload.targetId}",
        "result_variable": "examineResult"
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
      "type": "ADD_PERCEPTION_LOG_ENTRY",
      "comment": "Log examination with full description",
      "parameters": {
        "location_id": "{context.actorPosition.locationId}",
        "entry": {
          "descriptionText": "{actorName} examines {itemName}: {context.examineResult.fullDescription}",
          "timestamp": "{timestamp}",
          "perceptionType": "item_examined",
          "actorId": "{event.payload.actorId}",
          "itemId": "{event.payload.targetId}",
          "fullDescription": "{context.examineResult.fullDescription}"
        }
      }
    }
  ]
}
```

**Note:** Examine does not end turn - it's a free observation action.

### 6. Create Event

Create `data/mods/items/events/item_examined.event.json`:

```json
{
  "$schema": "schema://living-narrative-engine/event.schema.json",
  "id": "items:item_examined",
  "description": "Dispatched when an item is examined",
  "payloadSchema": {
    "type": "object",
    "properties": {
      "actorEntity": {
        "type": "string",
        "description": "Actor who examined the item"
      },
      "itemEntity": {
        "type": "string",
        "description": "Item that was examined"
      },
      "description": {
        "type": "string",
        "description": "Full description revealed"
      }
    },
    "required": ["actorEntity", "itemEntity", "description"]
  }
}
```

### 7. Update Mod Manifest

Add to `data/mods/items/mod-manifest.json` as appropriate.

### 8. Register Handler in DI Container

Update `src/dependencyInjection/containerConfig.js`:

```javascript
import ExamineItemHandler from '../logic/operationHandlers/items/examineItemHandler.js';

container.register('EXAMINE_ITEM', ExamineItemHandler);
```

### 9. Create Tests

Create integration tests covering:
- Examine items in inventory
- Examine items at location
- Scope union of inventory + location items
- Full description revealed
- Perception log created
- Turn NOT ended (free action)
- Missing description handled gracefully

## Validation

- [ ] Handler follows standalone class pattern with DI
- [ ] Scope uses union operator to combine inventory + location items
- [ ] Full description retrieved and returned
- [ ] Perception log includes full description
- [ ] Turn does NOT end (examine is free action)
- [ ] Items without descriptions handled gracefully
- [ ] Tests cover inventory and location examination
- [ ] All tests pass
- [ ] Mod manifest updated
- [ ] Handler registered in DI container

## Dependencies

- ITESYSIMP-001: Mod structure must exist
- ITESYSIMP-006: Scope definitions for inventory/location items
- Core mod for description component

## Next Steps

After completion, proceed to:
- ITESYSIMP-017: Implement put_in_container action
