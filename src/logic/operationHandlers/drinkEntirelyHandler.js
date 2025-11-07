/**
 * @file Operation handler for drinking all remaining liquid from a container
 * @see drinkFromHandler.js
 */

import BaseOperationHandler from './baseOperationHandler.js';
import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import { safeDispatchError } from '../../utils/staticErrorDispatcher.js';
import { tryWriteContextVariable } from '../../utils/contextVariableUtils.js';

const LIQUID_CONTAINER_COMPONENT_ID = 'items:liquid_container';
const DRINKABLE_COMPONENT_ID = 'items:drinkable';
const EMPTY_COMPONENT_ID = 'items:empty';
const POSITION_COMPONENT_ID = 'core:position';
const LIQUID_CONSUMED_ENTIRELY_EVENT = 'items:liquid_consumed_entirely';

/**
 * @typedef {object} DrinkEntirelyParams
 * @property {string} actorEntity - Entity ID of the actor drinking
 * @property {string} containerEntity - Entity ID of the liquid container
 * @property {string} [result_variable] - Optional variable name to store operation result
 */

/**
 * @typedef {object} DrinkEntirelyResult
 * @property {boolean} success - Whether the operation succeeded
 * @property {string} [error] - Error message if failed
 * @property {number} [volumeConsumed] - Total milliliters consumed if successful
 * @property {string} [flavorText] - Flavor text from container if successful
 */

/**
 * Handler for DRINK_ENTIRELY operation.
 * Consumes all remaining liquid from a container, always resulting in an empty container.
 */
class DrinkEntirelyHandler extends BaseOperationHandler {
  /** @type {import('../../entities/entityManager.js').default} */ #entityManager;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */ #dispatcher;

  constructor({ logger, entityManager, safeEventDispatcher }) {
    super('DrinkEntirelyHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: [
          'getComponentData',
          'hasComponent',
          'batchAddComponentsOptimized',
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
   * @param {DrinkEntirelyParams|null|undefined} params - Raw params object
   * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for diagnostics
   * @returns {{actorEntity: string, containerEntity: string}|null} Normalized values or null when invalid
   * @private
   */
  #validateParams(params, logger) {
    if (!assertParamsObject(params, this.#dispatcher, 'DRINK_ENTIRELY')) {
      return null;
    }

    const { actorEntity, containerEntity } = params;

    if (typeof actorEntity !== 'string' || !actorEntity.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'DRINK_ENTIRELY: actorEntity is required',
        { actorEntity },
        logger
      );
      return null;
    }

    if (typeof containerEntity !== 'string' || !containerEntity.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'DRINK_ENTIRELY: containerEntity is required',
        { containerEntity },
        logger
      );
      return null;
    }

    return {
      actorEntity: actorEntity.trim(),
      containerEntity: containerEntity.trim(),
    };
  }

  /**
   * Execute the drink entirely operation
   *
   * @param {DrinkEntirelyParams} params - Operation parameters
   * @param {import('../defs.js').ExecutionContext} executionContext - Execution context
   * @returns {Promise<DrinkEntirelyResult>} Operation result
   */
  async execute(params, executionContext) {
    const log = this.getLogger(executionContext);

    // Validation
    const validated = this.#validateParams(params, log);
    if (!validated) {
      return { success: false, error: 'validation_failed' };
    }

    const { actorEntity, containerEntity } = validated;
    const { result_variable } = params;

    try {
      // Check actor position
      const actorPosition = this.#entityManager.getComponentData(
        actorEntity,
        POSITION_COMPONENT_ID
      );
      if (!actorPosition) {
        log.warn('Actor does not have position component', {
          actorEntity,
        });
        return { success: false, error: 'Actor does not have position component' };
      }

      // Check container components
      const liquidData = this.#entityManager.getComponentData(
        containerEntity,
        LIQUID_CONTAINER_COMPONENT_ID
      );
      if (!liquidData) {
        log.warn('Container is not a liquid container', {
          containerEntity,
        });
        return { success: false, error: 'Container is not a liquid container' };
      }

      const hasDrinkable = this.#entityManager.hasComponent(
        containerEntity,
        DRINKABLE_COMPONENT_ID
      );
      if (!hasDrinkable) {
        log.warn('Container is not drinkable', {
          containerEntity,
        });
        return { success: false, error: 'Container is not drinkable' };
      }

      // Check container not empty
      const isEmpty = this.#entityManager.hasComponent(
        containerEntity,
        EMPTY_COMPONENT_ID
      );
      if (isEmpty) {
        log.debug('Container is empty', {
          containerEntity,
        });
        return { success: false, error: 'Container is empty' };
      }

      // NOTE: Co-location check removed - items in inventory don't have position components.
      // Items in inventory are always accessible to the actor, so no position check is needed.
      // This aligns with the ECS architecture where inventory items are locationless.
      // See: pickUpItemFromLocationHandler.js (removes position when adding to inventory)

      // Get current volume (consume all regardless of serving size)
      const volumeConsumed = liquidData.currentVolumeMilliliters || 0;

      if (volumeConsumed <= 0) {
        log.debug('Container has no liquid', {
          containerEntity,
          volumeConsumed,
        });
        return { success: false, error: 'Container has no liquid' };
      }

      // Always empty the container completely
      const updates = [
        {
          instanceId: containerEntity,
          componentTypeId: EMPTY_COMPONENT_ID,
          componentData: {},
        },
      ];

      await this.#entityManager.batchAddComponentsOptimized(updates, true);

      // Remove drinkable component
      await this.#entityManager.removeComponent(
        containerEntity,
        DRINKABLE_COMPONENT_ID
      );

      // Set volume to 0
      await this.#entityManager.batchAddComponentsOptimized([
        {
          instanceId: containerEntity,
          componentTypeId: LIQUID_CONTAINER_COMPONENT_ID,
          componentData: {
            currentVolumeMilliliters: 0,
            maxCapacityMilliliters: liquidData.maxCapacityMilliliters,
            servingSizeMilliliters: liquidData.servingSizeMilliliters,
            isRefillable: liquidData.isRefillable,
            flavorText: liquidData.flavorText || '',
          },
        },
      ], true);

      log.debug('Container completely emptied', {
        containerEntity,
        volumeConsumed,
      });

      // Dispatch consumption event
      this.#dispatcher.dispatch(LIQUID_CONSUMED_ENTIRELY_EVENT, {
        actorEntity,
        containerEntity,
        volumeConsumed,
      });

      // Return success with flavor text
      const result = {
        success: true,
        volumeConsumed,
        flavorText: liquidData.flavorText || '',
      };

      // Store result in context if result_variable provided
      if (result_variable && typeof result_variable === 'string' && result_variable.trim()) {
        tryWriteContextVariable(
          result_variable.trim(),
          result,
          executionContext,
          undefined,
          log
        );
      }

      return result;
    } catch (error) {
      log.error('Drink entirely operation failed', error, {
        actorEntity,
        containerEntity,
      });
      return { success: false, error: error.message };
    }
  }
}

export default DrinkEntirelyHandler;
