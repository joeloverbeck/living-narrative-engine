# OPEHANARCANA-018: VALIDATED_ITEM_TRANSFER Handler Implementation

**Status:** Ready
**Priority:** Medium (Phase 3)
**Estimated Effort:** 2 days
**Dependencies:** OPEHANARCANA-017 (schema)

---

## Objective

Implement the `ValidatedItemTransferHandler` class that:

1. Validates destination capacity (inventory or container)
2. On failure: dispatches failure event and ends turn
3. On success: performs transfer, dispatches success event, ends turn

This handler will reduce inventory rules from ~180 lines to ~15 lines (92% reduction).

---

## Files to Touch

### New Files

- `src/logic/operationHandlers/validatedItemTransferHandler.js`

### Files NOT to Touch

- DI registration files (OPEHANARCANA-019)
- Test files (OPEHANARCANA-019)
- preValidationUtils.js (OPEHANARCANA-019)

---

## Out of Scope

**DO NOT modify:**

- Any existing operation handlers
- Any rule files
- DI container or token files
- preValidationUtils.js
- Any test files
- Schema files (done in OPEHANARCANA-017)
- Bidirectional closeness files (Phase 2)

---

## Implementation Details

### Handler Structure

```javascript
/**
 * @file ValidatedItemTransferHandler - Consolidates inventory validation + transfer + logging
 * @see transferItemHandler.js for transfer logic reference
 */

import BaseOperationHandler from './baseOperationHandler.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * Validates destination capacity and transfers an item, handling both
 * success and failure paths with appropriate events and logging.
 *
 * Used by: give_item, pick_up_item, put_in_container, take_from_container
 */
class ValidatedItemTransferHandler extends BaseOperationHandler {
  #entityManager;
  #inventoryService;
  #eventBus;
  #logger;

  constructor({ entityManager, inventoryService, eventBus, logger }) {
    super();
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getEntityById', 'getComponentData'],
    });
    validateDependency(inventoryService, 'IInventoryService', logger, {
      requiredMethods: [
        'validateCapacity',
        'transferItem',
        'pickUpItem',
        'dropItem',
      ],
    });
    validateDependency(eventBus, 'IEventBus', logger, {
      requiredMethods: ['dispatch'],
    });
    this.#entityManager = entityManager;
    this.#inventoryService = inventoryService;
    this.#eventBus = eventBus;
    this.#logger = logger;
  }

  /**
   * @param {Object} context - Execution context
   * @returns {Object} Updated context with success/failure status
   */
  async execute(context) {
    const { event, parameters } = context;
    const {
      from_entity_ref,
      to_entity_ref,
      item_entity_ref = 'item',
      validation_type = 'inventory',
      transfer_type,
      success_message_template,
      failure_message_template,
      perception_type = 'item_transfer',
      failure_perception_type = 'item_transfer_failed',
    } = parameters;

    // Resolve entity IDs from refs
    const fromEntityId = this.#resolveEntityRef(from_entity_ref, event);
    const toEntityId = this.#resolveEntityRef(to_entity_ref, event);
    const itemId = this.#resolveEntityRef(item_entity_ref, event);

    // Resolve names for message templates
    const names = await this.#resolveNames(
      fromEntityId,
      toEntityId,
      itemId,
      event
    );

    // Step 1: Validate capacity if required
    if (validation_type !== 'none') {
      const isValid = await this.#validateCapacity(
        toEntityId,
        itemId,
        validation_type
      );

      if (!isValid) {
        return this.#handleFailure(context, {
          fromEntityId,
          toEntityId,
          itemId,
          names,
          failure_message_template,
          failure_perception_type,
          event,
        });
      }
    }

    // Step 2: Perform the transfer
    await this.#performTransfer(
      transfer_type,
      fromEntityId,
      toEntityId,
      itemId
    );

    // Step 3: Handle success
    return this.#handleSuccess(context, {
      fromEntityId,
      toEntityId,
      itemId,
      names,
      success_message_template,
      perception_type,
      event,
    });
  }

  #resolveEntityRef(ref, event) {
    switch (ref) {
      case 'actor':
        return event.payload.actorId;
      case 'target':
        return event.payload.targetId;
      case 'secondary':
        return event.payload.secondaryId;
      case 'item':
        return event.payload.itemId || event.payload.secondaryId;
      case 'location':
        const actorPosition = this.#entityManager.getComponentData(
          event.payload.actorId,
          'core:position'
        );
        return actorPosition?.locationId;
      default:
        return ref; // Assume it's a direct entity ID
    }
  }

  async #resolveNames(fromId, toId, itemId, event) {
    return {
      actorName: this.#getEntityName(event.payload.actorId),
      targetName: this.#getEntityName(event.payload.targetId),
      itemName: this.#getEntityName(itemId),
      fromName: this.#getEntityName(fromId),
      toName: this.#getEntityName(toId),
    };
  }

  #getEntityName(entityId) {
    if (!entityId) return 'Unknown';

    const actorComp = this.#entityManager.getComponentData(
      entityId,
      'core:actor'
    );
    if (actorComp?.name) return actorComp.name;

    const itemComp = this.#entityManager.getComponentData(
      entityId,
      'core:item'
    );
    if (itemComp?.name) return itemComp.name;

    const locationComp = this.#entityManager.getComponentData(
      entityId,
      'core:location'
    );
    if (locationComp?.name) return locationComp.name;

    return entityId;
  }

  async #validateCapacity(toEntityId, itemId, validationType) {
    try {
      if (validationType === 'inventory') {
        return await this.#inventoryService.validateCapacity(
          toEntityId,
          itemId
        );
      } else if (validationType === 'container') {
        return await this.#inventoryService.validateContainerCapacity(
          toEntityId,
          itemId
        );
      }
      return true;
    } catch (err) {
      this.#logger.warn(`Capacity validation failed: ${err.message}`);
      return false;
    }
  }

  async #performTransfer(transferType, fromId, toId, itemId) {
    switch (transferType) {
      case 'inventory_to_inventory':
        await this.#inventoryService.transferItem(fromId, toId, itemId);
        break;
      case 'location_to_inventory':
        await this.#inventoryService.pickUpItem(toId, itemId, fromId);
        break;
      case 'inventory_to_location':
        await this.#inventoryService.dropItem(fromId, itemId, toId);
        break;
      case 'inventory_to_container':
        await this.#inventoryService.putInContainer(fromId, toId, itemId);
        break;
      case 'container_to_inventory':
        await this.#inventoryService.takeFromContainer(toId, fromId, itemId);
        break;
      default:
        throw new Error(`Unknown transfer type: ${transferType}`);
    }
  }

  #formatMessage(template, names) {
    return template
      .replace(/{actorName}/g, names.actorName)
      .replace(/{targetName}/g, names.targetName)
      .replace(/{itemName}/g, names.itemName)
      .replace(/{fromName}/g, names.fromName)
      .replace(/{toName}/g, names.toName);
  }

  async #handleFailure(context, opts) {
    const { names, failure_message_template, failure_perception_type, event } =
      opts;

    const message = this.#formatMessage(failure_message_template, names);

    // Dispatch failure perception event
    const position = this.#entityManager.getComponentData(
      event.payload.actorId,
      'core:position'
    );

    this.#eventBus.dispatch({
      type: 'PERCEPTIBLE_EVENT',
      payload: {
        perceptionType: failure_perception_type,
        message,
        locationId: position?.locationId,
        actorId: event.payload.actorId,
        targetId: event.payload.targetId,
      },
    });

    // Set context for END_TURN
    context.logMessage = message;
    context.success = false;
    context.turnEnded = true;

    this.#logger.debug(
      'ValidatedItemTransferHandler: Transfer failed due to capacity',
      {
        message,
      }
    );

    return context;
  }

  async #handleSuccess(context, opts) {
    const { names, success_message_template, perception_type, event } = opts;

    const message = this.#formatMessage(success_message_template, names);

    // Dispatch success perception event
    const position = this.#entityManager.getComponentData(
      event.payload.actorId,
      'core:position'
    );

    this.#eventBus.dispatch({
      type: 'PERCEPTIBLE_EVENT',
      payload: {
        perceptionType: perception_type,
        message,
        locationId: position?.locationId,
        actorId: event.payload.actorId,
        targetId: event.payload.targetId,
      },
    });

    // Set context for macro
    context.logMessage = message;
    context.success = true;
    context.perceptionType = perception_type;
    context.locationId = position?.locationId;

    this.#logger.debug('ValidatedItemTransferHandler: Transfer succeeded', {
      message,
    });

    return context;
  }
}

export default ValidatedItemTransferHandler;
```

---

## Key Design Decisions

1. **Entity refs**: Support symbolic refs (`actor`, `target`, `item`) and direct IDs
2. **Transfer types**: Enumerate all possible transfer scenarios
3. **Dual path handling**: Built-in success/failure branching
4. **Event dispatch**: Automatically dispatch appropriate perception events
5. **Message templating**: Support common variable substitutions
6. **Context setup**: Set up context for subsequent macro calls

---

## Acceptance Criteria

### Tests That Must Pass

1. **File compiles without errors:**

   ```bash
   npm run typecheck
   ```

2. **ESLint passes:**

   ```bash
   npx eslint src/logic/operationHandlers/validatedItemTransferHandler.js
   ```

3. **No runtime import errors:**
   ```bash
   node -e "import('./src/logic/operationHandlers/validatedItemTransferHandler.js').then(() => console.log('OK'))"
   ```

### Invariants That Must Remain True

1. Handler extends `BaseOperationHandler`
2. Handler follows dependency injection pattern
3. Handler returns context (not void)
4. All existing operation handlers remain unchanged

---

## Reference Files

- Base class: `src/logic/operationHandlers/baseOperationHandler.js`
- Transfer pattern: `src/logic/operationHandlers/transferItemHandler.js`
- Validation pattern: `src/logic/operationHandlers/validateInventoryCapacityHandler.js`
- Event dispatch: `src/logic/operationHandlers/dispatchPerceptibleEventHandler.js`
