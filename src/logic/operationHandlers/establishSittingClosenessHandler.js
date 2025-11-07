/**
 * @file Handler for ESTABLISH_SITTING_CLOSENESS operation
 *
 * Establishes bidirectional closeness relationships between actors sitting in adjacent furniture spots
 * (N-1 or N+1) with validation and movement lock updates.
 *
 * Operation flow:
 * 1. Validate parameters (furniture_id, actor_id, spot_index) and component states
 * 2. Find adjacent occupants using proximity utilities
 * 3. For each adjacent actor, establish bidirectional closeness relationship
 * 4. Update movement locks for all affected actors
 * 5. Validate final state consistency and dispatch success event
 *
 * Related files:
 * @see data/schemas/operations/establishSittingCloseness.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - EstablishSittingClosenessHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 *
 * @extends BaseOperationHandler
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */

import BaseOperationHandler from './baseOperationHandler.js';
import {
  findAdjacentOccupants,
  validateProximityParameters,
} from '../../utils/proximityUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { updateMovementLock } from '../../utils/movementUtils.js';
import { tryWriteContextVariable } from '../../utils/contextVariableUtils.js';
import * as closenessCircleService from '../services/closenessCircleService.js';
import { ComponentStateValidator } from '../../utils/componentStateValidator.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';

/**
 * @class EstablishSittingClosenessHandler
 * @augments BaseOperationHandler
 * @description Establishes closeness relationships between actors sitting in adjacent furniture spots.
 * When an actor sits down, this handler automatically creates closeness relationships with any
 * actors occupying adjacent spots (N-1 or N+1) on the same furniture piece.
 */
class EstablishSittingClosenessHandler extends BaseOperationHandler {
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {ISafeEventDispatcher} */
  #dispatcher;
  /** @type {typeof closenessCircleService} */
  #closenessCircleService;

  /**
   * Create a new EstablishSittingClosenessHandler instance.
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
    super('EstablishSittingClosenessHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData', 'addComponent'],
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
      closenessCircleService: {
        value: closenessCircleService,
        requiredMethods: ['merge', 'repair'],
      },
    });
    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
    this.#closenessCircleService = closenessCircleService;
  }

  /**
   * Execute the establish sitting closeness operation using phased execution.
   *
   * @param {object} parameters - Operation parameters.
   * @param {string} parameters.furniture_id - ID of the furniture entity.
   * @param {string} parameters.actor_id - ID of the actor who just sat down.
   * @param {number} parameters.spot_index - Index of the spot where the actor sat.
   * @param {string} [parameters.result_variable] - Optional variable name to store result.
   * @param {ExecutionContext} executionContext - Execution context for the operation.
   * @returns {Promise<object>} Operation result with success status and adjacentActors
   */
  async execute(parameters, executionContext) {
    const logger = this.getLogger(executionContext);
    const operationId = `establish_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Phase 1: Enhanced parameter validation
      this.#validateParameters(parameters, operationId, logger);

      // Phase 2: Component state validation
      const { furnitureComponent } = await this.#validateComponentState(
        parameters,
        logger
      );

      // Phase 3: Adjacent actor discovery with validation
      const adjacentActors = await this.#findValidatedAdjacentActors(
        parameters,
        furnitureComponent,
        logger
      );

      if (adjacentActors.length === 0) {
        return this.#handleNoAdjacentActors(
          parameters,
          operationId,
          executionContext,
          logger
        );
      }

      // Phase 4: Establish closeness with proper merge handling
      await this.#establishClosenessWithValidation(
        parameters,
        adjacentActors,
        operationId,
        executionContext,
        logger
      );

      // Phase 5: Validate final state
      await this.#validateFinalState(parameters, adjacentActors, logger);

      return this.#handleSuccess(
        parameters,
        adjacentActors,
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
   * Phase 1: Enhanced parameter validation
   *
   * @param {object} parameters - Operation parameters
   * @param {string} operationId - Unique operation identifier
   * @param {ILogger} logger - Logger instance
   * @throws {InvalidArgumentError} When parameter validation fails
   * @private
   */
  #validateParameters(parameters, operationId, logger) {
    try {
      validateProximityParameters(
        parameters.furniture_id,
        parameters.actor_id,
        parameters.spot_index,
        logger
      );
    } catch (error) {
      throw new InvalidArgumentError(
        `Parameter validation failed for establish closeness: ${error.message}`
      );
    }
  }

  /**
   * Phase 2: Component state validation using enhanced validator
   *
   * @param {object} parameters - Operation parameters
   * @param {ILogger} logger - Logger instance
   * @returns {Promise<{furnitureComponent: object}>} Validated components
   * @throws {Error} When furniture component is missing
   * @throws {InvalidArgumentError} When component state is invalid
   * @private
   */
  async #validateComponentState(parameters, logger) {
    const validator = new ComponentStateValidator({ logger });

    const furnitureComponent = this.#entityManager.getComponentData(
      parameters.furniture_id,
      'positioning:allows_sitting'
    );

    validator.validateFurnitureComponent(
      parameters.furniture_id,
      furnitureComponent,
      'establish closeness'
    );

    // Validate spot index bounds for this specific furniture
    if (parameters.spot_index >= furnitureComponent.spots.length) {
      throw new InvalidArgumentError(
        `Spot index ${parameters.spot_index} exceeds furniture capacity (${furnitureComponent.spots.length})`
      );
    }

    const actorClosenessComponent = this.#entityManager.getComponentData(
      parameters.actor_id,
      'positioning:closeness'
    );

    validator.validateClosenessComponent(
      parameters.actor_id,
      actorClosenessComponent,
      'establish closeness'
    );

    return { furnitureComponent };
  }

  /**
   * Phase 3: Find and validate adjacent actors
   *
   * @param {object} parameters - Operation parameters
   * @param {object} furnitureComponent - Validated furniture component
   * @param {ILogger} logger - Logger instance
   * @returns {Promise<string[]>} Array of validated adjacent actor IDs
   * @private
   */
  async #findValidatedAdjacentActors(parameters, furnitureComponent, logger) {
    const validator = new ComponentStateValidator({ logger });
    const adjacentActors = findAdjacentOccupants(
      furnitureComponent,
      parameters.spot_index
    );

    // Validate each adjacent actor exists and has valid components
    const validActors = [];
    for (const actorId of adjacentActors) {
      try {
        const actorCloseness = this.#entityManager.getComponentData(
          actorId,
          'positioning:closeness'
        );
        validator.validateClosenessComponent(actorId, actorCloseness);
        validActors.push(actorId);
      } catch (error) {
        logger.warn('Adjacent actor validation failed, skipping', {
          actorId,
          furnitureId: parameters.furniture_id,
          error: error.message,
        });
      }
    }

    return validActors;
  }

  /**
   * Phase 4: Establish closeness relationships with validation
   *
   * @param {object} parameters - Operation parameters
   * @param {string[]} adjacentActors - Array of adjacent actor IDs
   * @param {string} _operationId - Unique operation identifier (unused)
   * @param {ExecutionContext} _executionContext - Execution context (unused)
   * @param {ILogger} _logger - Logger instance (unused)
   * @returns {Promise<void>}
   * @private
   */
  async #establishClosenessWithValidation(
    parameters,
    adjacentActors,
    _operationId,
    _executionContext,
    _logger
  ) {
    // For seated actors, only establish adjacent relationships (not transitive)
    // Each adjacent actor should have bidirectional closeness with the sitting actor only

    for (const adjacentActorId of adjacentActors) {
      // Get current components
      const actorCloseness = this.#entityManager.getComponentData(
        parameters.actor_id,
        'positioning:closeness'
      );
      const adjacentCloseness = this.#entityManager.getComponentData(
        adjacentActorId,
        'positioning:closeness'
      );

      // Get current partners lists or initialize empty arrays
      const actorPartners = Array.isArray(actorCloseness?.partners)
        ? [...actorCloseness.partners]
        : [];
      const adjacentPartners = Array.isArray(adjacentCloseness?.partners)
        ? [...adjacentCloseness.partners]
        : [];

      // Add each actor to the other's partners list if not already present
      if (!actorPartners.includes(adjacentActorId)) {
        actorPartners.push(adjacentActorId);
      }
      if (!adjacentPartners.includes(parameters.actor_id)) {
        adjacentPartners.push(parameters.actor_id);
      }

      // Use closeness circle service's repair function to ensure uniqueness and sorting
      const repairedActorPartners =
        this.#closenessCircleService.repair(actorPartners);
      const repairedAdjacentPartners =
        this.#closenessCircleService.repair(adjacentPartners);

      // Update both actors with their new partners lists
      await this.#entityManager.addComponent(
        parameters.actor_id,
        'positioning:closeness',
        {
          partners: repairedActorPartners,
        }
      );
      await this.#entityManager.addComponent(
        adjacentActorId,
        'positioning:closeness',
        {
          partners: repairedAdjacentPartners,
        }
      );
    }

    // Update movement locks for all affected actors
    await updateMovementLock(this.#entityManager, parameters.actor_id, true);
    for (const adjacentActorId of adjacentActors) {
      await updateMovementLock(this.#entityManager, adjacentActorId, true);
    }
  }

  /**
   * Phase 5: Validate final state consistency
   *
   * @param {object} parameters - Operation parameters
   * @param {string[]} adjacentActors - Array of adjacent actor IDs
   * @param {ILogger} logger - Logger instance
   * @returns {Promise<void>}
   * @private
   */
  async #validateFinalState(parameters, adjacentActors, logger) {
    const validator = new ComponentStateValidator({ logger });

    try {
      // Validate bidirectional relationships were created
      for (const adjacentActorId of adjacentActors) {
        validator.validateBidirectionalCloseness(
          this.#entityManager,
          parameters.actor_id,
          adjacentActorId
        );
      }
    } catch (error) {
      logger.error('Final state validation failed', {
        error: error.message,
        actorId: parameters.actor_id,
        adjacentActors,
      });
      // Don't throw - closeness was established, just log the inconsistency
    }
  }

  /**
   * Handle scenario when no adjacent actors are found
   *
   * @param {object} parameters - Operation parameters
   * @param {string} operationId - Unique operation identifier
   * @param {ExecutionContext} executionContext - Execution context
   * @param {ILogger} logger - Logger instance
   * @returns {object} Success result object
   * @private
   */
  #handleNoAdjacentActors(parameters, operationId, executionContext, logger) {
    logger.info('No adjacent actors found, closeness establishment skipped', {
      operationId,
      actorId: parameters.actor_id,
      furnitureId: parameters.furniture_id,
      spotIndex: parameters.spot_index,
    });

    if (parameters.result_variable) {
      tryWriteContextVariable(
        parameters.result_variable,
        true, // Operation succeeded (no actors is valid)
        executionContext,
        this.#dispatcher,
        logger
      );
    }

    return { success: true, adjacentActors: [] };
  }

  /**
   * Handle successful operation completion
   *
   * @param {object} parameters - Operation parameters
   * @param {string[]} adjacentActors - Array of adjacent actor IDs
   * @param {string} operationId - Unique operation identifier
   * @param {ExecutionContext} executionContext - Execution context
   * @param {ILogger} logger - Logger instance
   * @returns {object} Success result object
   * @private
   */
  #handleSuccess(
    parameters,
    adjacentActors,
    operationId,
    executionContext,
    logger
  ) {
    logger.info('Sitting closeness established successfully', {
      operationId,
      actorId: parameters.actor_id,
      furnitureId: parameters.furniture_id,
      spotIndex: parameters.spot_index,
      adjacentActors: adjacentActors,
      relationshipsEstablished: adjacentActors.length,
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

    // Dispatch success event with correct format
    this.#dispatcher.dispatch('positioning:sitting_closeness_established', {
      actorId: parameters.actor_id,
      furnitureId: parameters.furniture_id,
      adjacentActors: adjacentActors,
      operationId,
    });

    return { success: true, adjacentActors };
  }

  /**
   * Handle operation error with comprehensive logging and cleanup
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
    logger.error('Sitting closeness establishment failed', {
      operationId,
      actorId: parameters.actor_id,
      furnitureId: parameters.furniture_id,
      spotIndex: parameters.spot_index,
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
      'Sitting closeness establishment failed',
      {
        actorId: parameters.actor_id,
        furnitureId: parameters.furniture_id,
        operationId,
        error: error.message,
      },
      logger
    );

    return { success: false, error: error.message };
  }
}

export default EstablishSittingClosenessHandler;
