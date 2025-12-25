/**
 * @file Handler for DRINK_FROM operation
 *
 * Consumes a single serving from a liquid container, tracking volume and managing empty state.
 *
 * Operation flow:
 * 1. Validates operation parameters (actorEntity, containerEntity)
 * 2. Verifies container has liquid_container and drinkable components
 * 3. Checks container is not empty and has sufficient volume for serving size
 * 4. Reduces current volume by serving size, updating liquid_container component
 * 5. If volume reaches zero, adds empty component and removes drinkable component
 * 6. Dispatches drinking:liquid_consumed event
 *
 * Related files:
 * @see data/schemas/operations/drinkFrom.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - DrinkFromHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 * @augments BaseOperationHandler
 */

import BaseOperationHandler from './baseOperationHandler.js';
import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import { safeDispatchError } from '../../utils/staticErrorDispatcher.js';
import { tryWriteContextVariable } from '../../utils/contextVariableUtils.js';
import {
  DRINKABLE_COMPONENT_ID,
  EMPTY_COMPONENT_ID,
  LIQUID_CONTAINER_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../constants/componentIds.js';
import { LIQUID_CONSUMED_EVENT_ID } from '../../constants/eventIds.js';

/**
 * @typedef {object} DrinkFromParams
 * @property {string} actorEntity - Entity ID of the actor drinking
 * @property {string} containerEntity - Entity ID of the liquid container
 * @property {string} [result_variable] - Optional variable name to store operation result
 */

/**
 * @typedef {object} DrinkFromResult
 * @property {boolean} success - Whether the operation succeeded
 * @property {string} [error] - Error message if failed
 * @property {number} [volumeConsumed] - Milliliters consumed if successful
 * @property {string} [flavorText] - Flavor text from container if successful
 */

/**
 * Handler for DRINK_FROM operation.
 * Consumes a single serving from a liquid container, tracking volume and managing empty state.
 */
class DrinkFromHandler extends BaseOperationHandler {
  /** @type {import('../../entities/entityManager.js').default} */ #entityManager;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */ #dispatcher;

  constructor({ logger, entityManager, safeEventDispatcher }) {
    super('DrinkFromHandler', {
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
   * @param {DrinkFromParams|null|undefined} params - Raw params object
   * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for diagnostics
   * @returns {{actorEntity: string, containerEntity: string}|null} Normalized values or null when invalid
   * @private
   */
  #validateParams(params, logger) {
    if (!assertParamsObject(params, this.#dispatcher, 'DRINK_FROM')) {
      return null;
    }

    const { actorEntity, containerEntity } = params;

    if (typeof actorEntity !== 'string' || !actorEntity.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'DRINK_FROM: actorEntity is required',
        { actorEntity },
        logger
      );
      return null;
    }

    if (typeof containerEntity !== 'string' || !containerEntity.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'DRINK_FROM: containerEntity is required',
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
   * Execute the drink from operation
   *
   * @param {DrinkFromParams} params - Operation parameters
   * @param {import('../defs.js').ExecutionContext} executionContext - Execution context
   * @returns {Promise<DrinkFromResult>} Operation result
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
        return {
          success: false,
          error: 'Actor does not have position component',
        };
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

      // Check volume
      const currentVolume = liquidData.currentVolumeMilliliters || 0;
      const servingSize = liquidData.servingSizeMilliliters || 0;

      if (currentVolume <= 0) {
        log.debug('Container has no liquid', {
          containerEntity,
          currentVolume,
        });
        return { success: false, error: 'Container has no liquid' };
      }

      if (currentVolume < servingSize) {
        log.debug('Insufficient volume in container', {
          containerEntity,
          currentVolume,
          servingSize,
        });
        return { success: false, error: 'Insufficient volume in container' };
      }

      // Calculate consumption
      const volumeConsumed = Math.min(servingSize, currentVolume);
      const newVolume = currentVolume - volumeConsumed;

      // Prepare updates
      if (newVolume <= 0) {
        // Container becomes empty
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
        await this.#entityManager.batchAddComponentsOptimized(
          [
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
          ],
          true
        );

        log.debug('Container emptied', {
          containerEntity,
          volumeConsumed,
        });
      } else {
        // Still has liquid
        await this.#entityManager.batchAddComponentsOptimized(
          [
            {
              instanceId: containerEntity,
              componentTypeId: LIQUID_CONTAINER_COMPONENT_ID,
              componentData: {
                currentVolumeMilliliters: newVolume,
                maxCapacityMilliliters: liquidData.maxCapacityMilliliters,
                servingSizeMilliliters: liquidData.servingSizeMilliliters,
                isRefillable: liquidData.isRefillable,
                flavorText: liquidData.flavorText || '',
              },
            },
          ],
          true
        );

        log.debug('Volume reduced', {
          containerEntity,
          volumeConsumed,
          newVolume,
        });
      }

      // Dispatch consumption event
      this.#dispatcher.dispatch(LIQUID_CONSUMED_EVENT_ID, {
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
      if (
        result_variable &&
        typeof result_variable === 'string' &&
        result_variable.trim()
      ) {
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
      log.error('Drink from operation failed', error, {
        actorEntity,
        containerEntity,
      });
      return { success: false, error: error.message };
    }
  }
}

export default DrinkFromHandler;
