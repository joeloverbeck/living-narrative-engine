# ITESYSIMP-004: Implement Operation Handlers

**Phase:** 1 - Core Infrastructure
**Priority:** Critical
**Estimated Effort:** 3 hours

## Goal

Implement the core operation handlers (`TRANSFER_ITEM` and `VALIDATE_INVENTORY_CAPACITY`) as standalone classes with constructor dependency injection.

## Context

Operation handlers execute game logic. They must follow the standalone class pattern with constructor DI, not factory functions. These handlers will be used by rules to transfer items and validate inventory constraints.

## Tasks

### 1. Create TRANSFER_ITEM Handler

Create `src/logic/operationHandlers/items/transferItemHandler.js`:

```javascript
import { assertNonBlankString, assertPresent } from '../../../utils/dependencyUtils.js';

/**
 * Transfers an item from one entity's inventory to another's
 */
class TransferItemHandler {
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
    const { fromEntity, toEntity, itemEntity } = params;

    assertNonBlankString(fromEntity, 'fromEntity', 'TRANSFER_ITEM', this.#logger);
    assertNonBlankString(toEntity, 'toEntity', 'TRANSFER_ITEM', this.#logger);
    assertNonBlankString(itemEntity, 'itemEntity', 'TRANSFER_ITEM', this.#logger);

    try {
      // Get inventories
      const fromInventory = this.#entityManager.getComponent(fromEntity, 'items:inventory');
      const toInventory = this.#entityManager.getComponent(toEntity, 'items:inventory');

      if (!fromInventory || !toInventory) {
        this.#logger.warn(`Missing inventory component for transfer`, { fromEntity, toEntity });
        return { success: false, error: 'missing_inventory' };
      }

      // Check if item exists in source inventory
      if (!fromInventory.items.includes(itemEntity)) {
        this.#logger.warn(`Item not in source inventory`, { fromEntity, itemEntity });
        return { success: false, error: 'item_not_found' };
      }

      // Remove from source, add to destination
      const updates = [
        {
          entityId: fromEntity,
          componentId: 'items:inventory',
          data: {
            ...fromInventory,
            items: fromInventory.items.filter(id => id !== itemEntity)
          }
        },
        {
          entityId: toEntity,
          componentId: 'items:inventory',
          data: {
            ...toInventory,
            items: [...toInventory.items, itemEntity]
          }
        }
      ];

      // Apply atomically
      await this.#entityManager.batchAddComponentsOptimized(updates);

      // Dispatch success event
      this.#eventBus.dispatch({
        type: 'ITEM_TRANSFERRED',
        payload: { fromEntity, toEntity, itemEntity }
      });

      this.#logger.debug(`Item transferred successfully`, { fromEntity, toEntity, itemEntity });
      return { success: true };

    } catch (error) {
      this.#logger.error(`Transfer failed`, error, { fromEntity, toEntity, itemEntity });
      return { success: false, error: error.message };
    }
  }
}

export default TransferItemHandler;
```

### 2. Create VALIDATE_INVENTORY_CAPACITY Handler

Create `src/logic/operationHandlers/items/validateInventoryCapacityHandler.js`:

```javascript
import { assertNonBlankString, assertPresent } from '../../../utils/dependencyUtils.js';

/**
 * Validates if adding an item would exceed inventory capacity
 */
class ValidateInventoryCapacityHandler {
  #entityManager;
  #logger;

  constructor({ entityManager, logger }) {
    assertPresent(entityManager, 'entityManager is required');
    assertPresent(logger, 'logger is required');

    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  async execute(params, executionContext) {
    const { targetEntity, itemEntity } = params;

    assertNonBlankString(targetEntity, 'targetEntity', 'VALIDATE_INVENTORY_CAPACITY', this.#logger);
    assertNonBlankString(itemEntity, 'itemEntity', 'VALIDATE_INVENTORY_CAPACITY', this.#logger);

    try {
      const inventory = this.#entityManager.getComponent(targetEntity, 'items:inventory');
      const itemProps = this.#entityManager.getComponent(itemEntity, 'items:physical_properties');

      if (!inventory) {
        this.#logger.warn(`No inventory component on target`, { targetEntity });
        return { valid: false, reason: 'no_inventory' };
      }

      if (!itemProps) {
        this.#logger.warn(`No physical properties on item`, { itemEntity });
        return { valid: false, reason: 'no_properties' };
      }

      // Check item count
      if (inventory.items.length >= inventory.capacity.maxItems) {
        this.#logger.debug(`Inventory full (item count)`, { targetEntity });
        return { valid: false, reason: 'max_items_exceeded' };
      }

      // Calculate total weight
      let currentWeight = 0;
      for (const itemId of inventory.items) {
        const props = this.#entityManager.getComponent(itemId, 'items:physical_properties');
        if (props) currentWeight += props.weight;
      }

      const newWeight = currentWeight + itemProps.weight;
      if (newWeight > inventory.capacity.maxWeight) {
        this.#logger.debug(`Inventory full (weight)`, {
          targetEntity,
          currentWeight,
          newWeight,
          maxWeight: inventory.capacity.maxWeight
        });
        return { valid: false, reason: 'max_weight_exceeded' };
      }

      return { valid: true };

    } catch (error) {
      this.#logger.error(`Capacity validation failed`, error, { targetEntity, itemEntity });
      return { valid: false, reason: error.message };
    }
  }
}

export default ValidateInventoryCapacityHandler;
```

### 3. Register Handlers in DI Container

Update `src/dependencyInjection/containerConfig.js`:

```javascript
import TransferItemHandler from '../logic/operationHandlers/items/transferItemHandler.js';
import ValidateInventoryCapacityHandler from '../logic/operationHandlers/items/validateInventoryCapacityHandler.js';

// In the operation handlers registration section:
container.register('TRANSFER_ITEM', TransferItemHandler);
container.register('VALIDATE_INVENTORY_CAPACITY', ValidateInventoryCapacityHandler);
```

### 4. Create Unit Tests

Create `tests/unit/logic/operationHandlers/items/transferItemHandler.test.js` and `validateInventoryCapacityHandler.test.js` following existing handler test patterns.

## Validation

- [ ] Both handlers follow standalone class pattern with constructor DI
- [ ] All dependencies validated with assertPresent
- [ ] Parameters validated with assertNonBlankString
- [ ] Atomic updates using batchAddComponentsOptimized
- [ ] Success/failure events dispatched appropriately
- [ ] Comprehensive error handling with logging
- [ ] Handlers registered in DI container
- [ ] Unit tests cover success and failure scenarios
- [ ] All tests pass

## Dependencies

- ITESYSIMP-001: Mod structure must exist
- ITESYSIMP-003: Data components must exist (inventory, physical_properties)

## Next Steps

After completion, proceed to:
- ITESYSIMP-005: Implement give_item action
