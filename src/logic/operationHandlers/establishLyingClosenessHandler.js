/**
 * @file Handler for ESTABLISH_LYING_CLOSENESS operation
 *
 * Establishes bidirectional closeness relationships between ALL actors lying on the same furniture,
 * with validation and movement lock updates.
 *
 * Operation flow:
 * 1. Validate parameters (furniture_id, actor_id) and component states
 * 2. Find all other actors lying on the same furniture
 * 3. For each lying actor, establish bidirectional closeness relationship
 * 4. Update movement locks for all affected actors
 * 5. Validate final state consistency and dispatch success event
 *
 * Related files:
 * @see data/schemas/operations/establishLyingCloseness.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - EstablishLyingClosenessHandler token
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
import { updateMovementLock } from '../../utils/movementUtils.js';
import { tryWriteContextVariable } from '../../utils/contextVariableUtils.js';
import * as closenessCircleService from '../services/closenessCircleService.js';
import { ComponentStateValidator } from '../../utils/componentStateValidator.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';
import { assertNonBlankString } from '../../utils/dependencyUtils.js';

/**
 * @class EstablishLyingClosenessHandler
 * @augments BaseOperationHandler
 * @description Establishes closeness relationships between all actors lying on the same furniture.
 * When an actor lies down, this handler automatically creates closeness relationships with ALL
 * other actors lying on the same furniture piece.
 */
class EstablishLyingClosenessHandler extends BaseOperationHandler {
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {ISafeEventDispatcher} */
  #dispatcher;
  /** @type {typeof closenessCircleService} */
  #closenessCircleService;

  /**
   * Create a new EstablishLyingClosenessHandler instance.
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
    super('EstablishLyingClosenessHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData', 'addComponent', 'getEntitiesWithComponent'],
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
   * Execute the establish lying closeness operation using phased execution.
   *
   * @param {object} parameters - Operation parameters.
   * @param {string} parameters.furniture_id - ID of the furniture entity.
   * @param {string} parameters.actor_id - ID of the actor who just lay down.
   * @param {string} [parameters.result_variable] - Optional variable name to store result.
   * @param {ExecutionContext} executionContext - Execution context for the operation.
   * @returns {Promise<object>} Operation result with success status and otherLyingActors
   */
  async execute(parameters, executionContext) {
    const logger = this.getLogger(executionContext);
    const operationId = `establish_lying_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Phase 1: Enhanced parameter validation
      this.#validateParameters(parameters, operationId, logger);

      // Phase 2: Component state validation
      await this.#validateComponentState(parameters, logger);

      // Phase 3: Find all other lying actors on same furniture
      const otherLyingActors = await this.#findValidatedLyingActors(
        parameters,
        logger
      );

      if (otherLyingActors.length === 0) {
        return this.#handleNoOtherActors(
          parameters,
          operationId,
          executionContext,
          logger
        );
      }

      // Phase 4: Establish closeness with all lying actors
      await this.#establishClosenessWithValidation(
        parameters,
        otherLyingActors,
        operationId,
        executionContext,
        logger
      );

      // Phase 5: Validate final state
      await this.#validateFinalState(parameters, otherLyingActors, logger);

      return this.#handleSuccess(
        parameters,
        otherLyingActors,
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
      assertNonBlankString(
        parameters.furniture_id,
        'furniture_id',
        'establish lying closeness',
        logger
      );
      assertNonBlankString(
        parameters.actor_id,
        'actor_id',
        'establish lying closeness',
        logger
      );
    } catch (error) {
      throw new InvalidArgumentError(
        `Parameter validation failed for establish lying closeness: ${error.message}`
      );
    }
  }

  /**
   * Phase 2: Component state validation using enhanced validator
   *
   * @param {object} parameters - Operation parameters
   * @param {ILogger} logger - Logger instance
   * @returns {Promise<void>}
   * @throws {Error} When furniture component is missing
   * @throws {InvalidArgumentError} When component state is invalid
   * @private
   */
  async #validateComponentState(parameters, logger) {
    const validator = new ComponentStateValidator({ logger });

    const furnitureComponent = this.#entityManager.getComponentData(
      parameters.furniture_id,
      'positioning:allows_lying_on'
    );

    if (!furnitureComponent) {
      throw new Error(
        `Furniture ${parameters.furniture_id} missing allows_lying_on component`
      );
    }

    const actorClosenessComponent = this.#entityManager.getComponentData(
      parameters.actor_id,
      'positioning:closeness'
    );

    validator.validateClosenessComponent(
      parameters.actor_id,
      actorClosenessComponent,
      'establish lying closeness'
    );
  }

  /**
   * Phase 3: Find and validate all other actors lying on same furniture
   *
   * @param {object} parameters - Operation parameters
   * @param {ILogger} logger - Logger instance
   * @returns {Promise<string[]>} Array of validated lying actor IDs (excluding current actor)
   * @private
   */
  async #findValidatedLyingActors(parameters, logger) {
    // Get all entities with lying_down component
    const allLyingEntities = this.#entityManager.getEntitiesWithComponent(
      'positioning:lying_down'
    );

    // Filter for actors lying on the SAME furniture, excluding the current actor
    const otherLyingActors = [];

    for (const entity of allLyingEntities) {
      // Extract entity ID (getEntitiesWithComponent returns entity objects, not IDs)
      const entityId = entity.id;

      if (entityId === parameters.actor_id) {
        continue; // Skip the actor who just lay down
      }

      const lyingComponent = this.#entityManager.getComponentData(
        entityId,
        'positioning:lying_down'
      );

      // Check if they're lying on the same furniture
      if (lyingComponent?.furniture_id === parameters.furniture_id) {
        // Actor is lying on same furniture - add to list
        // Note: closeness component will be created/updated during establishment phase
        otherLyingActors.push(entityId);
      }
    }

    return otherLyingActors;
  }

  /**
   * Phase 4: Establish closeness relationships with validation
   *
   * @param {object} parameters - Operation parameters
   * @param {string[]} otherLyingActors - Array of other lying actor IDs
   * @param {string} _operationId - Unique operation identifier (unused)
   * @param {ExecutionContext} _executionContext - Execution context (unused)
   * @param {ILogger} _logger - Logger instance (unused)
   * @returns {Promise<void>}
   * @private
   */
  async #establishClosenessWithValidation(
    parameters,
    otherLyingActors,
    _operationId,
    _executionContext,
    _logger
  ) {
    // For lying actors, establish closeness with ALL other actors on same furniture
    // Each actor should have bidirectional closeness with all others

    for (const otherActorId of otherLyingActors) {
      // Get current components
      const actorCloseness = this.#entityManager.getComponentData(
        parameters.actor_id,
        'positioning:closeness'
      );
      const otherCloseness = this.#entityManager.getComponentData(
        otherActorId,
        'positioning:closeness'
      );

      // Get current partners lists or initialize empty arrays
      const actorPartners = Array.isArray(actorCloseness?.partners)
        ? [...actorCloseness.partners]
        : [];
      const otherPartners = Array.isArray(otherCloseness?.partners)
        ? [...otherCloseness.partners]
        : [];

      // Add each actor to the other's partners list if not already present
      if (!actorPartners.includes(otherActorId)) {
        actorPartners.push(otherActorId);
      }
      if (!otherPartners.includes(parameters.actor_id)) {
        otherPartners.push(parameters.actor_id);
      }

      // Use closeness circle service's repair function to ensure uniqueness and sorting
      const repairedActorPartners =
        this.#closenessCircleService.repair(actorPartners);
      const repairedOtherPartners =
        this.#closenessCircleService.repair(otherPartners);

      // Update both actors with their new partners lists
      await this.#entityManager.addComponent(
        parameters.actor_id,
        'positioning:closeness',
        {
          partners: repairedActorPartners,
        }
      );
      await this.#entityManager.addComponent(
        otherActorId,
        'positioning:closeness',
        {
          partners: repairedOtherPartners,
        }
      );
    }

    // Update movement locks for all affected actors
    await updateMovementLock(this.#entityManager, parameters.actor_id, true);
    for (const otherActorId of otherLyingActors) {
      await updateMovementLock(this.#entityManager, otherActorId, true);
    }
  }

  /**
   * Phase 5: Validate final state consistency
   *
   * @param {object} parameters - Operation parameters
   * @param {string[]} otherLyingActors - Array of other lying actor IDs
   * @param {ILogger} logger - Logger instance
   * @returns {Promise<void>}
   * @private
   */
  async #validateFinalState(parameters, otherLyingActors, logger) {
    const validator = new ComponentStateValidator({ logger });

    try {
      // Validate bidirectional relationships were created
      for (const otherActorId of otherLyingActors) {
        validator.validateBidirectionalCloseness(
          this.#entityManager,
          parameters.actor_id,
          otherActorId
        );
      }
    } catch (error) {
      logger.error('Final state validation failed', {
        error: error.message,
        actorId: parameters.actor_id,
        otherLyingActors,
      });
      // Don't throw - closeness was established, just log the inconsistency
    }
  }

  /**
   * Handle scenario when no other lying actors are found
   *
   * @param {object} parameters - Operation parameters
   * @param {string} operationId - Unique operation identifier
   * @param {ExecutionContext} executionContext - Execution context
   * @param {ILogger} logger - Logger instance
   * @returns {object} Success result object
   * @private
   */
  #handleNoOtherActors(parameters, operationId, executionContext, logger) {
    logger.info('No other lying actors found, closeness establishment skipped', {
      operationId,
      actorId: parameters.actor_id,
      furnitureId: parameters.furniture_id,
    });

    if (parameters.result_variable) {
      tryWriteContextVariable(
        parameters.result_variable,
        true, // Operation succeeded (no other actors is valid)
        executionContext,
        this.#dispatcher,
        logger
      );
    }

    return { success: true, otherLyingActors: [] };
  }

  /**
   * Handle successful operation completion
   *
   * @param {object} parameters - Operation parameters
   * @param {string[]} otherLyingActors - Array of other lying actor IDs
   * @param {string} operationId - Unique operation identifier
   * @param {ExecutionContext} executionContext - Execution context
   * @param {ILogger} logger - Logger instance
   * @returns {object} Success result object
   * @private
   */
  #handleSuccess(
    parameters,
    otherLyingActors,
    operationId,
    executionContext,
    logger
  ) {
    logger.info('Lying closeness established successfully', {
      operationId,
      actorId: parameters.actor_id,
      furnitureId: parameters.furniture_id,
      otherLyingActors: otherLyingActors,
      relationshipsEstablished: otherLyingActors.length,
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
    this.#dispatcher.dispatch('positioning:lying_closeness_established', {
      actorId: parameters.actor_id,
      furnitureId: parameters.furniture_id,
      otherLyingActors: otherLyingActors,
      operationId,
    });

    return { success: true, otherLyingActors };
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
    logger.error('Lying closeness establishment failed', {
      operationId,
      actorId: parameters.actor_id,
      furnitureId: parameters.furniture_id,
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
      'Lying closeness establishment failed',
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

export default EstablishLyingClosenessHandler;
