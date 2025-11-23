/**
 * @file Handler for CONSUME_ITEM operation
 *
 * Transfers fuel properties from a consumable item to a consumer's metabolic buffer.
 *
 * Operation flow:
 * 1. Validates operation parameters (consumer_ref, item_ref)
 * 2. Resolves entity references from parameters
 * 3. Retrieves metabolism:fuel_source component from item
 * 4. Retrieves metabolism:metabolic_store component from consumer
 * 5. Validates buffer capacity is sufficient
 * 6. Adds fuel to consumer's buffer_storage array
 * 7. Removes consumed item from game
 * 8. Dispatches metabolism:item_consumed event
 *
 * Related files:
 * @see data/schemas/operations/consumeItem.schema.json - Operation schema
 * @see data/mods/metabolism/components/fuel_source.component.json - Item component
 * @see data/mods/metabolism/components/metabolic_store.component.json - Consumer component
 * @see src/dependencyInjection/tokens/tokens-core.js - ConsumeItemHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 * @augments BaseOperationHandler
 */

import BaseOperationHandler from './baseOperationHandler.js';
import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';

const FUEL_SOURCE_COMPONENT_ID = 'metabolism:fuel_source';
const METABOLIC_STORE_COMPONENT_ID = 'metabolism:metabolic_store';
const ITEM_CONSUMED_EVENT = 'metabolism:item_consumed';

/**
 * @typedef {object} ConsumeItemParams
 * @property {string} consumer_ref - Reference to entity with metabolic_store component
 * @property {string} item_ref - Reference to item entity with fuel_source component
 */

/**
 * Handler for CONSUME_ITEM operation.
 * Transfers fuel from consumable item to consumer's metabolic buffer and removes the item.
 */
class ConsumeItemHandler extends BaseOperationHandler {
  /** @type {import('../../entities/entityManager.js').default} */ #entityManager;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */ #dispatcher;

  constructor({ logger, entityManager, safeEventDispatcher }) {
    super('ConsumeItemHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData', 'addComponent', 'removeEntityInstance'],
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
    });
    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
  }

  /**
   * Validate and normalize parameters for execute.
   *
   * @param {ConsumeItemParams|null|undefined} params - Raw params object
   * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for diagnostics
   * @returns {{consumerId: string, itemId: string}|null} Normalized values or null when invalid
   * @private
   */
  #validateParams(params, logger) {
    if (!assertParamsObject(params, this.#dispatcher, 'CONSUME_ITEM')) {
      return null;
    }

    const { consumer_ref, item_ref } = params;

    // Validate consumer reference
    let consumerId;
    if (typeof consumer_ref === 'string' && consumer_ref.trim()) {
      consumerId = consumer_ref.trim();
    } else if (typeof consumer_ref === 'object' && consumer_ref !== null) {
      consumerId = consumer_ref.id || consumer_ref.entityId;
    }

    if (!consumerId) {
      safeDispatchError(
        this.#dispatcher,
        'CONSUME_ITEM: consumer_ref is required and must be a valid string or object',
        { consumer_ref },
        logger
      );
      return null;
    }

    // Validate item reference
    let itemId;
    if (typeof item_ref === 'string' && item_ref.trim()) {
      itemId = item_ref.trim();
    } else if (typeof item_ref === 'object' && item_ref !== null) {
      itemId = item_ref.id || item_ref.entityId;
    }

    if (!itemId) {
      safeDispatchError(
        this.#dispatcher,
        'CONSUME_ITEM: item_ref is required and must be a valid string or object',
        { item_ref },
        logger
      );
      return null;
    }

    return {
      consumerId,
      itemId,
    };
  }

  /**
   * Execute the consume item operation
   *
   * @param {ConsumeItemParams} params - Operation parameters
   * @param {import('../defs.js').ExecutionContext} executionContext - Execution context
   * @returns {Promise<void>}
   */
  async execute(params, executionContext) {
    const log = this.getLogger(executionContext);

    // Validation
    const validated = this.#validateParams(params, log);
    if (!validated) {
      return;
    }

    const { consumerId, itemId } = validated;

    try {
      // Get fuel source component from item
      const fuelSource = this.#entityManager.getComponentData(
        itemId,
        FUEL_SOURCE_COMPONENT_ID
      );

      if (!fuelSource) {
        safeDispatchError(
          this.#dispatcher,
          `CONSUME_ITEM: Item does not have ${FUEL_SOURCE_COMPONENT_ID} component`,
          { itemId },
          log
        );
        return;
      }

      // Get metabolic store component from consumer
      const metabolicStore = this.#entityManager.getComponentData(
        consumerId,
        METABOLIC_STORE_COMPONENT_ID
      );

      if (!metabolicStore) {
        safeDispatchError(
          this.#dispatcher,
          `CONSUME_ITEM: Consumer does not have ${METABOLIC_STORE_COMPONENT_ID} component`,
          { consumerId },
          log
        );
        return;
      }

      // Extract data from components
      const bufferStorage = metabolicStore.buffer_storage || [];
      const bufferCapacity = metabolicStore.buffer_capacity;
      const fuelBulk = fuelSource.bulk;
      const fuelEnergy = fuelSource.energy_content;

      // Calculate current buffer usage
      const currentBufferUsage = bufferStorage.reduce(
        (sum, item) => sum + (item.bulk || 0),
        0
      );

      // Check if there's capacity for this item
      if (currentBufferUsage + fuelBulk > bufferCapacity) {
        safeDispatchError(
          this.#dispatcher,
          'CONSUME_ITEM: Insufficient buffer capacity to consume item',
          { consumerId, itemId, currentBufferUsage, fuelBulk, bufferCapacity },
          log
        );
        return;
      }

      // Add fuel to buffer storage
      const newBufferStorage = [
        ...bufferStorage,
        {
          bulk: fuelBulk,
          energy_content: fuelEnergy,
        },
      ];

      // Update metabolic store with new buffer
      await this.#entityManager.addComponent(
        consumerId,
        METABOLIC_STORE_COMPONENT_ID,
        {
          ...metabolicStore,
          buffer_storage: newBufferStorage,
        }
      );

      // Remove the consumed item from the game
      await this.#entityManager.removeEntityInstance(itemId);

      // Dispatch item consumed event
      this.#dispatcher.dispatch(ITEM_CONSUMED_EVENT, {
        consumerId,
        itemId,
        fuelBulk,
        fuelEnergy,
        newBufferUsage: currentBufferUsage + fuelBulk,
      });

      log.debug('Item consumed successfully', {
        consumerId,
        itemId,
        fuelBulk,
        fuelEnergy,
        newBufferUsage: currentBufferUsage + fuelBulk,
      });
    } catch (error) {
      log.error('Consume item operation failed', error, {
        consumerId,
        itemId,
      });
      safeDispatchError(
        this.#dispatcher,
        `CONSUME_ITEM: Operation failed - ${error.message}`,
        { consumerId, itemId, error: error.message },
        log
      );
    }
  }
}

export default ConsumeItemHandler;
