/**
 * @file Handler for CONSUME_ITEM operation
 *
 * Transfers fuel source to metabolic store buffer, validating compatibility and capacity,
 * then removes item from game.
 *
 * Operation flow:
 * 1. Validates operation parameters (consumer_ref, item_ref)
 * 2. Verifies consumer has fuel_converter component
 * 3. Verifies consumer has metabolic_store component
 * 4. Verifies item has fuel_source component
 * 5. Validates fuel tag compatibility (at least one matching tag)
 * 6. Validates buffer has sufficient capacity for item bulk
 * 7. Adds item {bulk, energy_content} to metabolic_store.buffer_storage array
 * 8. Removes item entity from game
 * 9. Dispatches metabolism:item_consumed event
 *
 * Related files:
 * @see data/schemas/operations/consumeItem.schema.json - Operation schema
 * @see data/mods/metabolism/components/metabolic_store.component.json - Target component schema
 * @see data/mods/metabolism/components/fuel_source.component.json - Source component schema
 * @see src/dependencyInjection/tokens/tokens-core.js - ConsumeItemHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 * @augments BaseOperationHandler
 */

import BaseOperationHandler from './baseOperationHandler.js';
import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';

const FUEL_CONVERTER_COMPONENT_ID = 'metabolism:fuel_converter';
const METABOLIC_STORE_COMPONENT_ID = 'metabolism:metabolic_store';
const FUEL_SOURCE_COMPONENT_ID = 'metabolism:fuel_source';
const ITEM_CONSUMED_EVENT = 'metabolism:item_consumed';

/**
 * @typedef {object} ConsumeItemParams
 * @property {string} consumer_ref - Entity ID of the consumer with fuel_converter component
 * @property {string} item_ref - Entity ID of the item with fuel_source component to consume
 */

/**
 * Handler for CONSUME_ITEM operation.
 * Transfers fuel from food item to consumer's fuel converter buffer.
 */
class ConsumeItemHandler extends BaseOperationHandler {
  /** @type {import('../../entities/entityManager.js').default} */ #entityManager;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */ #dispatcher;

  constructor({ logger, entityManager, safeEventDispatcher }) {
    super('ConsumeItemHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: [
          'getComponentData',
          'hasComponent',
          'batchAddComponentsOptimized',
          'removeEntityInstance',
        ],
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
   * Validate parameters for execute.
   *
   * @param {ConsumeItemParams|null|undefined} params - Raw params object
   * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for diagnostics
   * @returns {{consumerRef: string, itemRef: string}|null} Normalized values or null when invalid
   * @private
   */
  #validateParams(params, logger) {
    if (!assertParamsObject(params, this.#dispatcher, 'CONSUME_ITEM')) {
      return null;
    }

    const { consumer_ref, item_ref } = params;

    if (typeof consumer_ref !== 'string' || !consumer_ref.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'CONSUME_ITEM: consumer_ref is required',
        { consumer_ref },
        logger
      );
      return null;
    }

    if (typeof item_ref !== 'string' || !item_ref.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'CONSUME_ITEM: item_ref is required',
        { item_ref },
        logger
      );
      return null;
    }

    return {
      consumerRef: consumer_ref.trim(),
      itemRef: item_ref.trim(),
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

    const { consumerRef, itemRef } = validated;

    try {
      // Get fuel converter component
      const fuelConverter = this.#entityManager.getComponentData(
        consumerRef,
        FUEL_CONVERTER_COMPONENT_ID
      );

      if (!fuelConverter) {
        safeDispatchError(
          this.#dispatcher,
          `CONSUME_ITEM: Consumer does not have fuel_converter component`,
          { consumerId: consumerRef },
          log
        );
        return;
      }

      // Get metabolic store component
      const metabolicStore = this.#entityManager.getComponentData(
        consumerRef,
        METABOLIC_STORE_COMPONENT_ID
      );

      if (!metabolicStore) {
        safeDispatchError(
          this.#dispatcher,
          `CONSUME_ITEM: Consumer does not have metabolic_store component`,
          { consumerId: consumerRef },
          log
        );
        return;
      }

      // Get fuel source component
      const fuelSource = this.#entityManager.getComponentData(
        itemRef,
        FUEL_SOURCE_COMPONENT_ID
      );

      if (!fuelSource) {
        safeDispatchError(
          this.#dispatcher,
          `CONSUME_ITEM: Item does not have fuel_source component`,
          { itemId: itemRef },
          log
        );
        return;
      }

      // Validate fuel tag compatibility
      // fuel_tags is optional array, fuel_type is required string
      const itemTags = fuelSource.fuel_tags || [fuelSource.fuel_type];
      const hasMatchingTag = itemTags.some((tag) =>
        fuelConverter.accepted_fuel_tags.includes(tag)
      );

      if (!hasMatchingTag) {
        safeDispatchError(
          this.#dispatcher,
          `CONSUME_ITEM: Incompatible fuel type. Converter accepts: ${fuelConverter.accepted_fuel_tags.join(', ')}. Item provides: ${itemTags.join(', ')}.`,
          {
            consumerId: consumerRef,
            itemId: itemRef,
            converterTags: fuelConverter.accepted_fuel_tags,
            itemTags,
          },
          log
        );
        return;
      }

      // Validate buffer capacity
      // buffer_storage is an array of {bulk, energy_content} objects
      const currentBulk = metabolicStore.buffer_storage.reduce(
        (sum, item) => sum + item.bulk,
        0
      );
      const availableSpace = metabolicStore.buffer_capacity - currentBulk;
      if (availableSpace < fuelSource.bulk) {
        safeDispatchError(
          this.#dispatcher,
          `CONSUME_ITEM: Insufficient buffer capacity. Available: ${availableSpace}, item bulk: ${fuelSource.bulk}`,
          {
            consumerId: consumerRef,
            itemId: itemRef,
            availableSpace,
            itemBulk: fuelSource.bulk,
          },
          log
        );
        return;
      }

      // Add item to buffer storage array
      const newBufferStorage = [
        ...metabolicStore.buffer_storage,
        {
          bulk: fuelSource.bulk,
          energy_content: fuelSource.energy_content,
        },
      ];

      await this.#entityManager.batchAddComponentsOptimized([
        {
          instanceId: consumerRef,
          componentTypeId: METABOLIC_STORE_COMPONENT_ID,
          componentData: {
            ...metabolicStore,
            buffer_storage: newBufferStorage,
          },
        },
      ]);

      // Remove item entity from game
      this.#entityManager.removeEntityInstance(itemRef);

      // Dispatch success event
      this.#dispatcher.dispatch({
        type: ITEM_CONSUMED_EVENT,
        payload: {
          consumerId: consumerRef,
          itemId: itemRef,
          bulkAdded: fuelSource.bulk,
          energyContent: fuelSource.energy_content,
          newBufferStorage,
        },
      });

      log.debug('Item consumed successfully', {
        consumerId: consumerRef,
        itemId: itemRef,
        bulkAdded: fuelSource.bulk,
        energyContent: fuelSource.energy_content,
        bufferItems: newBufferStorage.length,
      });
    } catch (error) {
      log.error('CONSUME_ITEM operation failed', error, {
        consumerId: consumerRef,
        itemId: itemRef,
      });
      safeDispatchError(
        this.#dispatcher,
        `CONSUME_ITEM: Operation failed - ${error.message}`,
        { consumerId: consumerRef, itemId: itemRef, error: error.message },
        log
      );
    }
  }
}

export default ConsumeItemHandler;
