# ITESYSIMP-017: Implement Put In Container Action

**Phase:** 4 - Advanced Features
**Priority:** Medium
**Estimated Effort:** 2 hours

## Goal

Implement the `put_in_container` action to allow actors to store items from their inventory into open containers.

## Context

Put in container completes the container interaction loop - actors can now store items for later retrieval. This enables storage gameplay and item organization.

## Tasks

### 1. Create PUT_IN_CONTAINER Handler

Create `src/logic/operationHandlers/items/putInContainerHandler.js`:

```javascript
import { assertNonBlankString, assertPresent } from '../../../utils/dependencyUtils.js';

/**
 * Puts an item from actor's inventory into a container
 */
class PutInContainerHandler {
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

    assertNonBlankString(actorEntity, 'actorEntity', 'PUT_IN_CONTAINER', this.#logger);
    assertNonBlankString(containerEntity, 'containerEntity', 'PUT_IN_CONTAINER', this.#logger);
    assertNonBlankString(itemEntity, 'itemEntity', 'PUT_IN_CONTAINER', this.#logger);

    try {
      const inventory = this.#entityManager.getComponent(actorEntity, 'items:inventory');
      const container = this.#entityManager.getComponent(containerEntity, 'items:container');

      if (!inventory) {
        this.#logger.warn(`No inventory on actor`, { actorEntity });
        return { success: false, error: 'no_inventory' };
      }

      if (!container) {
        this.#logger.warn(`No container component`, { containerEntity });
        return { success: false, error: 'not_a_container' };
      }

      if (!container.isOpen) {
        this.#logger.debug(`Container is closed`, { containerEntity });
        return { success: false, error: 'container_closed' };
      }

      if (!inventory.items.includes(itemEntity)) {
        this.#logger.warn(`Item not in inventory`, { actorEntity, itemEntity });
        return { success: false, error: 'item_not_in_inventory' };
      }

      // Remove from inventory, add to container
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
          entityId: containerEntity,
          componentId: 'items:container',
          data: {
            ...container,
            contents: [...container.contents, itemEntity]
          }
        }
      ];

      await this.#entityManager.batchAddComponentsOptimized(updates);

      this.#eventBus.dispatch({
        type: 'ITEM_PUT_IN_CONTAINER',
        payload: { actorEntity, containerEntity, itemEntity }
      });

      this.#logger.debug(`Item put in container`, { actorEntity, containerEntity, itemEntity });
      return { success: true };

    } catch (error) {
      this.#logger.error(`Put in container failed`, error, { actorEntity, containerEntity, itemEntity });
      return { success: false, error: error.message };
    }
  }
}

export default PutInContainerHandler;
```

### 2. Create VALIDATE_CONTAINER_CAPACITY Handler

Create `src/logic/operationHandlers/items/validateContainerCapacityHandler.js`:

```javascript
import { assertNonBlankString, assertPresent } from '../../../utils/dependencyUtils.js';

/**
 * Validates if adding an item would exceed container capacity
 */
class ValidateContainerCapacityHandler {
  #entityManager;
  #logger;

  constructor({ entityManager, logger }) {
    assertPresent(entityManager, 'entityManager is required');
    assertPresent(logger, 'logger is required');

    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  async execute(params, executionContext) {
    const { containerEntity, itemEntity } = params;

    assertNonBlankString(containerEntity, 'containerEntity', 'VALIDATE_CONTAINER_CAPACITY', this.#logger);
    assertNonBlankString(itemEntity, 'itemEntity', 'VALIDATE_CONTAINER_CAPACITY', this.#logger);

    try {
      const container = this.#entityManager.getComponent(containerEntity, 'items:container');
      const itemProps = this.#entityManager.getComponent(itemEntity, 'items:physical_properties');

      if (!container) {
        return { valid: false, reason: 'not_a_container' };
      }

      if (!itemProps) {
        return { valid: false, reason: 'no_properties' };
      }

      // Check item count
      if (container.contents.length >= container.capacity.maxItems) {
        return { valid: false, reason: 'max_items_exceeded' };
      }

      // Calculate total weight
      let currentWeight = 0;
      for (const itemId of container.contents) {
        const props = this.#entityManager.getComponent(itemId, 'items:physical_properties');
        if (props) currentWeight += props.weight;
      }

      const newWeight = currentWeight + itemProps.weight;
      if (newWeight > container.capacity.maxWeight) {
        return { valid: false, reason: 'max_weight_exceeded' };
      }

      return { valid: true };

    } catch (error) {
      this.#logger.error(`Container capacity validation failed`, error, { containerEntity, itemEntity });
      return { valid: false, reason: error.message };
    }
  }
}

export default ValidateContainerCapacityHandler;
```

### 3. Create open_containers_at_location Scope

Create `data/mods/items/scopes/open_containers_at_location.scope`:

```
items:openable_containers_at_location[{"==": [{"var": "entity.items:container.isOpen"}, true]}]
```

**Description:** Returns only open containers at the actor's location by filtering openable containers for isOpen = true.

### 4. Create put_in_container Action

Create `data/mods/items/actions/put_in_container.action.json`:

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "items:put_in_container",
  "name": "Put In Container",
  "description": "Put an item from your inventory into an open container",
  "generateCombinations": true,
  "targets": {
    "primary": {
      "scope": "items:open_containers_at_location",
      "placeholder": "container",
      "description": "Container to put item in",
      "contextFrom": "actor"
    },
    "secondary": {
      "scope": "items:actor_inventory_items",
      "placeholder": "item",
      "description": "Item to put in container",
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
  "formatTemplate": "Put {secondary.name} in {primary.name}"
}
```

### 5. Create Condition and Rule

Create condition and rule files following existing patterns, with capacity validation similar to give_item.

### 6. Create Event

Create `data/mods/items/events/item_put_in_container.event.json` following the pattern of other item events.

### 7. Update Mod Manifest

Add all new components to manifest.

### 8. Register Handlers in DI Container

Update `src/dependencyInjection/containerConfig.js`:

```javascript
import PutInContainerHandler from '../logic/operationHandlers/items/putInContainerHandler.js';
import ValidateContainerCapacityHandler from '../logic/operationHandlers/items/validateContainerCapacityHandler.js';

container.register('PUT_IN_CONTAINER', PutInContainerHandler);
container.register('VALIDATE_CONTAINER_CAPACITY', ValidateContainerCapacityHandler);
```

### 9. Create Tests

Create comprehensive tests covering:
- Put item in open container
- Closed container prevents putting
- Container capacity validation (weight and count)
- Item removed from inventory
- Item added to container contents
- Perception logging
- Turn ending

## Validation

- [ ] Both handlers follow standalone class pattern with DI
- [ ] Scope correctly filters for open containers
- [ ] Item removed from inventory
- [ ] Item added to container contents
- [ ] Closed containers prevent putting
- [ ] Container capacity validated (weight and count)
- [ ] Perception logs created
- [ ] Turn ends after successful put
- [ ] Tests cover all scenarios
- [ ] All tests pass
- [ ] Mod manifest updated
- [ ] Handlers registered in DI container

## Dependencies

- ITESYSIMP-012: Container component must exist
- ITESYSIMP-013: Open container action must exist
- ITESYSIMP-003: Inventory component must exist

## Next Steps

After completion, proceed to:
- ITESYSIMP-018: Phase 4 comprehensive tests
- ITESYSIMP-019: Final integration and documentation
