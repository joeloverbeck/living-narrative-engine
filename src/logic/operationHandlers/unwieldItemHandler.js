/**
 * @file Handler for UNWIELD_ITEM operation
 *
 * Stops wielding an item, releasing grabbing appendages and updating the wielding component.
 * Idempotent - succeeds silently if item is not currently wielded.
 *
 * Operation flow:
 * 1. Validates operation parameters (actorEntity, itemEntity)
 * 2. Retrieves actor's wielding component and verifies item is wielded
 * 3. Unlocks grabbing appendages holding the item
 * 4. Updates or removes wielding component
 * 5. Dispatches items-core:item_unwielded event
 *
 * Related files:
 * @see data/schemas/operations/unwieldItem.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - UnwieldItemHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 */

import {
  assertParamsObject,
  validateStringParam,
} from '../../utils/handlerUtils/paramsUtils.js';
import { unlockAppendagesHoldingItem } from '../../utils/grabbingUtils.js';
import BaseOperationHandler from './baseOperationHandler.js';

const WIELDING_COMPONENT_ID = 'item-handling-states:wielding';
const ITEM_UNWIELDED_EVENT = 'item-handling-states:item_unwielded';

/**
 * @typedef {object} UnwieldItemParams
 * @property {string} actorEntity - Actor unwielding the item
 * @property {string} itemEntity - Item to unwield
 */

/**
 * @typedef {object} WieldingComponentData
 * @property {string[]} [wielded_item_ids] - Array of wielded item IDs
 */

/**
 * Stops wielding an item, releasing grabbing appendages
 *
 * @augments BaseOperationHandler
 */
class UnwieldItemHandler extends BaseOperationHandler {
  /** @type {import('../../entities/entityManager.js').default} */ #entityManager;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */ #dispatcher;

  /**
   * Creates an instance of UnwieldItemHandler.
   *
   * @param {object} deps - Dependencies
   * @param {import('../../interfaces/coreServices.js').ILogger} deps.logger - Logger instance
   * @param {import('../../entities/entityManager.js').default} deps.entityManager - Entity manager
   * @param {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} deps.safeEventDispatcher - Event dispatcher
   */
  constructor({ logger, entityManager, safeEventDispatcher }) {
    super('UnwieldItemHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: [
          'getComponentData',
          'addComponent',
          'removeComponent',
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
   * @param {UnwieldItemParams|null|undefined} params - Raw params object
   * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for diagnostics
   * @returns {{actorEntity: string, itemEntity: string}|null} Normalized values or null when invalid
   */
  #validateParams(params, logger) {
    if (!assertParamsObject(params, this.#dispatcher, 'UNWIELD_ITEM')) {
      return null;
    }

    const { actorEntity, itemEntity } = /** @type {UnwieldItemParams} */ (
      params
    );

    const validatedActor = validateStringParam(
      actorEntity,
      'actorEntity',
      logger,
      this.#dispatcher
    );
    const validatedItem = validateStringParam(
      itemEntity,
      'itemEntity',
      logger,
      this.#dispatcher
    );

    if (!validatedActor || !validatedItem) {
      return null;
    }

    return {
      actorEntity: validatedActor,
      itemEntity: validatedItem,
    };
  }

  /**
   * Execute the unwield item operation
   *
   * @param {UnwieldItemParams} params - Unwield parameters
   * @param {import('../defs.js').ExecutionContext} executionContext - Execution context
   * @returns {Promise<{success: boolean, error?: string}>} Unwield result
   */
  async execute(params, executionContext) {
    const log = this.getLogger(executionContext);

    log.debug('[UNWIELD_ITEM] Handler invoked', {
      rawParams: params,
      executionContext: executionContext ? 'present' : 'missing',
    });

    // Validation
    const validated = this.#validateParams(params, log);
    if (!validated) {
      log.warn('[UNWIELD_ITEM] Parameter validation failed', {
        rawParams: params,
      });
      return { success: false, error: 'validation_failed' };
    }

    const { actorEntity, itemEntity } = validated;
    log.debug('[UNWIELD_ITEM] Parameters validated', {
      actorEntity,
      itemEntity,
    });

    try {
      // Check wielding component
      const wieldingData = /** @type {WieldingComponentData|null} */ (
        this.#entityManager.getComponentData(actorEntity, WIELDING_COMPONENT_ID)
      );

      if (!wieldingData) {
        log.debug(
          '[UNWIELD_ITEM] No wielding component on actor, idempotent success',
          { actorEntity }
        );
        return { success: true };
      }

      const wieldedItemIds = wieldingData.wielded_item_ids || [];
      log.debug('[UNWIELD_ITEM] Current wielded items', {
        actorEntity,
        wieldedItemIds,
      });

      // Check if item is wielded
      if (!wieldedItemIds.includes(itemEntity)) {
        log.debug(
          '[UNWIELD_ITEM] Item not in wielded list, idempotent success',
          {
            actorEntity,
            itemEntity,
            wieldedItemIds,
          }
        );
        return { success: true };
      }

      // Unlock grabbing appendages holding this item
      log.debug('[UNWIELD_ITEM] Unlocking grabbing appendages', {
        actorEntity,
        itemEntity,
      });
      const unlockResult = await unlockAppendagesHoldingItem(
        this.#entityManager,
        actorEntity,
        itemEntity
      );
      log.debug('[UNWIELD_ITEM] Appendages unlocked', {
        actorEntity,
        itemEntity,
        unlockedParts: unlockResult.unlockedParts,
      });

      // Update wielding component
      const remainingItems = wieldedItemIds.filter(
        (/** @type {string} */ id) => id !== itemEntity
      );

      if (remainingItems.length === 0) {
        // Remove component entirely if no more wielded items
        log.debug('[UNWIELD_ITEM] Removing empty wielding component', {
          actorEntity,
        });
        await this.#entityManager.removeComponent(
          actorEntity,
          WIELDING_COMPONENT_ID
        );
      } else {
        // Update component with remaining items
        log.debug('[UNWIELD_ITEM] Updating wielding component', {
          actorEntity,
          remainingItems,
        });
        await this.#entityManager.addComponent(
          actorEntity,
          WIELDING_COMPONENT_ID,
          {
            ...wieldingData,
            wielded_item_ids: remainingItems,
          }
        );
      }

      // Dispatch success event
      log.debug('[UNWIELD_ITEM] Dispatching item_unwielded event', {
        eventType: ITEM_UNWIELDED_EVENT,
        actorEntity,
        itemEntity,
        remainingWieldedItems: remainingItems,
      });
      this.#dispatcher.dispatch(ITEM_UNWIELDED_EVENT, {
        actorEntity,
        itemEntity,
        remainingWieldedItems: remainingItems,
      });

      log.debug('[UNWIELD_ITEM] Operation completed successfully', {
        actorEntity,
        itemEntity,
        remainingWieldedItems: remainingItems,
      });
      return { success: true };
    } catch (error) {
      const err = /** @type {Error} */ (error);
      log.error('[UNWIELD_ITEM] Operation failed with exception', err, {
        actorEntity,
        itemEntity,
        errorMessage: err.message,
        errorStack: err.stack,
      });
      return { success: false, error: err.message };
    }
  }
}

export default UnwieldItemHandler;
