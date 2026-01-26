/**
 * @file Handler for EAT_FROM operation
 *
 * Consumes a single serving from a food item, tracking servings and managing consumed state.
 *
 * Operation flow:
 * 1. Validates operation parameters (actorEntity, foodEntity)
 * 2. Verifies food has food_container and edible components
 * 3. Checks food is not consumed and has sufficient servings (>1)
 * 4. Reduces current servings by 1, updating food_container component
 * 5. If servings reach zero, adds consumed component and removes edible component
 * 6. Dispatches food:food_consumed event
 *
 * Related files:
 * @see data/schemas/operations/eatFrom.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - EatFromHandler token
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
  EDIBLE_COMPONENT_ID,
  CONSUMED_COMPONENT_ID,
  FOOD_CONTAINER_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../constants/componentIds.js';
import { FOOD_CONSUMED_EVENT_ID } from '../../constants/eventIds.js';

/**
 * @typedef {object} EatFromParams
 * @property {string} actorEntity - Entity ID of the actor eating
 * @property {string} foodEntity - Entity ID of the food item
 * @property {string} [result_variable] - Optional variable name to store operation result
 */

/**
 * @typedef {object} EatFromResult
 * @property {boolean} success - Whether the operation succeeded
 * @property {string} [error] - Error message if failed
 * @property {number} [servingsConsumed] - Number of servings consumed if successful
 * @property {string} [flavorText] - Flavor text from food if successful
 */

/**
 * Handler for EAT_FROM operation.
 * Consumes a single serving from a food item, tracking servings and managing consumed state.
 */
class EatFromHandler extends BaseOperationHandler {
  /** @type {import('../../entities/entityManager.js').default} */ #entityManager;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */ #dispatcher;

  constructor({ logger, entityManager, safeEventDispatcher }) {
    super('EatFromHandler', {
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
   * @param {EatFromParams|null|undefined} params - Raw params object
   * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for diagnostics
   * @returns {{actorEntity: string, foodEntity: string}|null} Normalized values or null when invalid
   * @private
   */
  #validateParams(params, logger) {
    if (!assertParamsObject(params, this.#dispatcher, 'EAT_FROM')) {
      return null;
    }

    const { actorEntity, foodEntity } = params;

    if (typeof actorEntity !== 'string' || !actorEntity.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'EAT_FROM: actorEntity is required',
        { actorEntity },
        logger
      );
      return null;
    }

    if (typeof foodEntity !== 'string' || !foodEntity.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'EAT_FROM: foodEntity is required',
        { foodEntity },
        logger
      );
      return null;
    }

    return {
      actorEntity: actorEntity.trim(),
      foodEntity: foodEntity.trim(),
    };
  }

  /**
   * Execute the eat from operation
   *
   * @param {EatFromParams} params - Operation parameters
   * @param {import('../defs.js').ExecutionContext} executionContext - Execution context
   * @returns {Promise<EatFromResult>} Operation result
   */
  async execute(params, executionContext) {
    const log = this.getLogger(executionContext);

    // Validation
    const validated = this.#validateParams(params, log);
    if (!validated) {
      return { success: false, error: 'validation_failed' };
    }

    const { actorEntity, foodEntity } = validated;
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

      // Check food components
      const foodData = this.#entityManager.getComponentData(
        foodEntity,
        FOOD_CONTAINER_COMPONENT_ID
      );
      if (!foodData) {
        log.warn('Item is not a food container', {
          foodEntity,
        });
        return { success: false, error: 'Item is not a food container' };
      }

      const hasEdible = this.#entityManager.hasComponent(
        foodEntity,
        EDIBLE_COMPONENT_ID
      );
      if (!hasEdible) {
        log.warn('Item is not edible', {
          foodEntity,
        });
        return { success: false, error: 'Item is not edible' };
      }

      // Check food not already consumed
      const isConsumed = this.#entityManager.hasComponent(
        foodEntity,
        CONSUMED_COMPONENT_ID
      );
      if (isConsumed) {
        log.debug('Food is already consumed', {
          foodEntity,
        });
        return { success: false, error: 'Food is already consumed' };
      }

      // Check servings
      const currentServings = foodData.currentServings || 0;

      if (currentServings <= 0) {
        log.debug('Food has no servings', {
          foodEntity,
          currentServings,
        });
        return { success: false, error: 'Food has no servings' };
      }

      if (currentServings < 2) {
        log.debug('Insufficient servings for eat_from (need >1)', {
          foodEntity,
          currentServings,
        });
        return {
          success: false,
          error: 'Insufficient servings - use eat_entirely instead',
        };
      }

      // Calculate consumption (always 1 serving)
      const servingsConsumed = 1;
      const newServings = currentServings - servingsConsumed;

      // Update food container component
      if (newServings <= 0) {
        // Food becomes consumed
        const updates = [
          {
            instanceId: foodEntity,
            componentTypeId: CONSUMED_COMPONENT_ID,
            componentData: {},
          },
        ];

        await this.#entityManager.batchAddComponentsOptimized(updates, true);

        // Remove edible component
        await this.#entityManager.removeComponent(foodEntity, EDIBLE_COMPONENT_ID);

        // Set servings to 0
        await this.#entityManager.batchAddComponentsOptimized(
          [
            {
              instanceId: foodEntity,
              componentTypeId: FOOD_CONTAINER_COMPONENT_ID,
              componentData: {
                currentServings: 0,
                maxServings: foodData.maxServings,
                flavorText: foodData.flavorText || '',
                tags: foodData.tags || [],
              },
            },
          ],
          true
        );

        log.debug('Food consumed completely', {
          foodEntity,
          servingsConsumed,
        });
      } else {
        // Still has servings
        await this.#entityManager.batchAddComponentsOptimized(
          [
            {
              instanceId: foodEntity,
              componentTypeId: FOOD_CONTAINER_COMPONENT_ID,
              componentData: {
                currentServings: newServings,
                maxServings: foodData.maxServings,
                flavorText: foodData.flavorText || '',
                tags: foodData.tags || [],
              },
            },
          ],
          true
        );

        log.debug('Servings reduced', {
          foodEntity,
          servingsConsumed,
          newServings,
        });
      }

      // Dispatch consumption event
      this.#dispatcher.dispatch(FOOD_CONSUMED_EVENT_ID, {
        actorId: actorEntity,
        foodId: foodEntity,
        servingsConsumed,
        servingsRemaining: newServings,
      });

      // Return success with flavor text
      const result = {
        success: true,
        servingsConsumed,
        flavorText: foodData.flavorText || '',
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
      log.error('Eat from operation failed', error, {
        actorEntity,
        foodEntity,
      });
      return { success: false, error: error.message };
    }
  }
}

export default EatFromHandler;
