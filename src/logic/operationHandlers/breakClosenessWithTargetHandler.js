/**
 * @file Handler for BREAK_CLOSENESS_WITH_TARGET operation
 *
 * Breaks closeness relationship between actor and specific target with conditional component removal
 * based on remaining partners. Ensures symmetric bidirectional state management.
 *
 * Operation flow:
 * 1. Validate parameters (actor_id, target_id must be different)
 * 2. Retrieve current closeness states for both actor and target
 * 3. Remove target from actor's partners list, conditionally remove/update component
 * 4. Remove actor from target's partners list, conditionally remove/update component
 * 5. Dispatch success event and optional result variable
 *
 * Related files:
 * @see data/schemas/operations/breakClosenessWithTarget.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - BreakClosenessWithTargetHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 * @augments BaseOperationHandler
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */

import BaseOperationHandler from './baseOperationHandler.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { tryWriteContextVariable } from '../../utils/contextVariableUtils.js';
import * as closenessCircleService from '../services/closenessCircleService.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';
import { assertNonBlankString } from '../../utils/dependencyUtils.js';

/**
 * @class BreakClosenessWithTargetHandler
 * @augments BaseOperationHandler
 * @description Breaks closeness relationship between actor and specific target with conditional
 * component removal. When an actor pushes a target or otherwise breaks closeness with them:
 * - Removes target from actor's partners array
 * - If actor's partners array becomes empty → removes component
 * - If actor still has other partners → updates component
 * - Applies same conditional logic to target side for symmetric state management
 */
class BreakClosenessWithTargetHandler extends BaseOperationHandler {
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {ISafeEventDispatcher} */
  #dispatcher;
  /** @type {typeof closenessCircleService} */
  #closenessCircleService;

  /**
   * Create a new BreakClosenessWithTargetHandler instance.
   *
   * @param {object} deps - Dependency injection object.
   * @param {ILogger} deps.logger - Logger instance.
   * @param {IEntityManager} deps.entityManager - Entity manager for component operations.
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher - Event dispatcher for error handling.
   * @param {typeof closenessCircleService} deps.closenessCircleService - Service for closeness circle operations.
   */
  constructor({
    logger,
    entityManager,
    safeEventDispatcher,
    closenessCircleService,
  }) {
    super('BreakClosenessWithTargetHandler', {
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
      closenessCircleService: {
        value: closenessCircleService,
        requiredMethods: ['repair'],
      },
    });
    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
    this.#closenessCircleService = closenessCircleService;
  }

  /**
   * Execute the break closeness with target operation using phased execution.
   *
   * @param {object} parameters - Operation parameters.
   * @param {string} parameters.actor_id - ID of the actor breaking closeness.
   * @param {string} parameters.target_id - ID of the target to break closeness with.
   * @param {string} [parameters.result_variable] - Optional variable name to store result.
   * @param {ExecutionContext} executionContext - Execution context for the operation.
   * @returns {Promise<object>} Operation result with success status
   */
  async execute(parameters, executionContext) {
    const logger = this.getLogger(executionContext);
    const operationId = `break_closeness_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // DEBUG: Log handler invocation
    console.log('[BREAK_CLOSENESS_HANDLER] Execute called with:', parameters);

    try {
      // Phase 1: Parameter validation
      this.#validateParameters(parameters, logger);

      // Phase 2: Get current closeness states
      const { actorCloseness, targetCloseness } =
        await this.#getCurrentClosenessStates(parameters, logger);

      // Phase 3: Handle actor side (conditional removal)
      await this.#updateActorCloseness(
        parameters.actor_id,
        parameters.target_id,
        actorCloseness,
        logger
      );

      // Phase 4: Handle target side (conditional removal)
      await this.#updateTargetCloseness(
        parameters.target_id,
        parameters.actor_id,
        targetCloseness,
        logger
      );

      return this.#handleSuccess(
        parameters,
        operationId,
        executionContext,
        logger
      );
    } catch (error) {
      return this.#handleError(
        error,
        parameters,
        operationId,
        executionContext,
        logger
      );
    }
  }

  /**
   * Phase 1: Validate operation parameters
   *
   * @param {object} parameters - Operation parameters
   * @param {ILogger} logger - Logger instance
   * @throws {InvalidArgumentError} When parameter validation fails
   * @private
   */
  #validateParameters(parameters, logger) {
    try {
      assertNonBlankString(
        parameters.actor_id,
        'actor_id',
        'BreakClosenessWithTargetHandler parameter validation',
        logger
      );
      assertNonBlankString(
        parameters.target_id,
        'target_id',
        'BreakClosenessWithTargetHandler parameter validation',
        logger
      );

      if (parameters.actor_id === parameters.target_id) {
        throw new InvalidArgumentError(
          'actor_id and target_id cannot be the same'
        );
      }
    } catch (error) {
      throw new InvalidArgumentError(
        `Parameter validation failed for break closeness with target: ${error.message}`
      );
    }
  }

  /**
   * Phase 2: Get current closeness component states for both entities
   *
   * @param {object} parameters - Operation parameters
   * @param {ILogger} logger - Logger instance
   * @returns {Promise<{actorCloseness: object|undefined, targetCloseness: object|undefined}>} Current closeness states
   * @private
   */
  async #getCurrentClosenessStates(parameters, logger) {
    const actorCloseness = this.#entityManager.getComponentData(
      parameters.actor_id,
      'personal-space-states:closeness'
    );
    const targetCloseness = this.#entityManager.getComponentData(
      parameters.target_id,
      'personal-space-states:closeness'
    );

    logger.debug('Retrieved current closeness states', {
      actorId: parameters.actor_id,
      targetId: parameters.target_id,
      actorHasCloseness: !!actorCloseness,
      targetHasCloseness: !!targetCloseness,
      actorPartners: actorCloseness?.partners || [],
      targetPartners: targetCloseness?.partners || [],
    });

    return { actorCloseness, targetCloseness };
  }

  /**
   * Phase 3: Update actor's closeness with conditional removal
   * Actor hasn't moved, only loses the specific target from partners.
   *
   * @param {string} actorId - ID of the actor
   * @param {string} targetId - ID of the target to remove
   * @param {object|undefined} closeness - Current closeness component
   * @param {ILogger} logger - Logger instance
   * @returns {Promise<void>}
   * @private
   */
  async #updateActorCloseness(actorId, targetId, closeness, logger) {
    if (!closeness || !Array.isArray(closeness.partners)) {
      logger.warn(
        'Actor has no closeness component or invalid partners array',
        {
          actorId,
          targetId,
          hasCloseness: !!closeness,
          partnersType: closeness ? typeof closeness.partners : 'undefined',
        }
      );
      return;
    }

    // Remove target from partners array
    const updatedPartners = closeness.partners.filter(
      (partnerId) => partnerId !== targetId
    );

    // Repair partners list (deduplicate and sort)
    const repairedPartners =
      this.#closenessCircleService.repair(updatedPartners);

    logger.debug('Actor closeness update', {
      actorId,
      targetId,
      originalPartners: closeness.partners,
      updatedPartners: repairedPartners,
      becomesEmpty: repairedPartners.length === 0,
    });

    // Conditional removal based on remaining partners
    if (repairedPartners.length === 0) {
      // No more partners → remove component
      await this.#entityManager.removeComponent(
        actorId,
        'personal-space-states:closeness'
      );

      logger.info('Removed actor closeness component (no remaining partners)', {
        actorId,
        targetId,
      });
    } else {
      // Still has partners → update component
      await this.#entityManager.addComponent(actorId, 'personal-space-states:closeness', {
        partners: repairedPartners,
      });

      logger.info(
        'Updated actor closeness component (has remaining partners)',
        {
          actorId,
          targetId,
          remainingPartners: repairedPartners,
        }
      );
    }
  }

  /**
   * Phase 4: Update target's closeness with conditional removal
   * Target was forcefully pushed, loses the actor from partners.
   *
   * @param {string} targetId - ID of the target
   * @param {string} actorId - ID of the actor to remove
   * @param {object|undefined} closeness - Current closeness component
   * @param {ILogger} logger - Logger instance
   * @returns {Promise<void>}
   * @private
   */
  async #updateTargetCloseness(targetId, actorId, closeness, logger) {
    if (!closeness || !Array.isArray(closeness.partners)) {
      logger.warn(
        'Target has no closeness component or invalid partners array',
        {
          targetId,
          actorId,
          hasCloseness: !!closeness,
          partnersType: closeness ? typeof closeness.partners : 'undefined',
        }
      );
      return;
    }

    // Remove actor from partners array
    const updatedPartners = closeness.partners.filter(
      (partnerId) => partnerId !== actorId
    );

    // Repair partners list (deduplicate and sort)
    const repairedPartners =
      this.#closenessCircleService.repair(updatedPartners);

    logger.debug('Target closeness update', {
      targetId,
      actorId,
      originalPartners: closeness.partners,
      updatedPartners: repairedPartners,
      becomesEmpty: repairedPartners.length === 0,
    });

    // Conditional removal based on remaining partners
    if (repairedPartners.length === 0) {
      // No more partners → remove component
      await this.#entityManager.removeComponent(
        targetId,
        'personal-space-states:closeness'
      );

      logger.info(
        'Removed target closeness component (no remaining partners)',
        {
          targetId,
          actorId,
        }
      );
    } else {
      // Still has partners → update component
      await this.#entityManager.addComponent(
        targetId,
        'personal-space-states:closeness',
        {
          partners: repairedPartners,
        }
      );

      logger.info(
        'Updated target closeness component (has remaining partners)',
        {
          targetId,
          actorId,
          remainingPartners: repairedPartners,
        }
      );
    }
  }

  /**
   * Handle successful operation completion
   *
   * @param {object} parameters - Operation parameters
   * @param {string} operationId - Unique operation identifier
   * @param {ExecutionContext} executionContext - Execution context
   * @param {ILogger} logger - Logger instance
   * @returns {object} Success result object
   * @private
   */
  #handleSuccess(parameters, operationId, executionContext, logger) {
    logger.info('Closeness with target broken successfully', {
      operationId,
      actorId: parameters.actor_id,
      targetId: parameters.target_id,
    });

    if (parameters.result_variable) {
      tryWriteContextVariable(
        parameters.result_variable,
        true,
        executionContext,
        this.#dispatcher,
        logger
      );
    }

    // Dispatch success event
    this.#dispatcher.dispatch('positioning:closeness_with_target_broken', {
      actorId: parameters.actor_id,
      targetId: parameters.target_id,
      operationId,
    });

    return { success: true };
  }

  /**
   * Handle operation error with comprehensive logging
   *
   * @param {Error} error - The error that occurred
   * @param {object} parameters - Operation parameters
   * @param {string} operationId - Unique operation identifier
   * @param {ExecutionContext} executionContext - Execution context
   * @param {ILogger} logger - Logger instance
   * @returns {object} Error result object
   * @private
   */
  #handleError(error, parameters, operationId, executionContext, logger) {
    logger.error('Break closeness with target failed', {
      operationId,
      actorId: parameters.actor_id,
      targetId: parameters.target_id,
      error: error.message,
      errorType: error.constructor.name,
    });

    if (parameters.result_variable) {
      tryWriteContextVariable(
        parameters.result_variable,
        false,
        executionContext,
        this.#dispatcher,
        logger
      );
    }

    // Dispatch error event
    safeDispatchError(
      this.#dispatcher,
      'Break closeness with target failed',
      {
        actorId: parameters.actor_id,
        targetId: parameters.target_id,
        operationId,
        error: error.message,
      },
      logger
    );

    return { success: false, error: error.message };
  }
}

export default BreakClosenessWithTargetHandler;
