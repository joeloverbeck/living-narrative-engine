/**
 * @file Operation handler for establishing closeness relationships when actors sit adjacently
 * @see proximityUtils.js
 * @see closenessCircleService.js
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */

import BaseOperationHandler from './baseOperationHandler.js';
import { assertPresent, assertNonBlankString } from '../../utils/dependencyUtils.js';
import {
  findAdjacentOccupants,
  validateProximityParameters,
} from '../../utils/proximityUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { updateMovementLock } from '../../utils/movementUtils.js';
import {
  tryWriteContextVariable,
} from '../../utils/contextVariableUtils.js';
import {
  ensureEvaluationContext,
} from '../../utils/evaluationContextUtils.js';
import * as closenessCircleService from '../services/closenessCircleService.js';

/**
 * @class EstablishSittingClosenessHandler
 * @extends BaseOperationHandler
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
  constructor({ logger, entityManager, safeEventDispatcher, closenessCircleService }) {
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
   * Execute the establish sitting closeness operation.
   *
   * @param {object} parameters - Operation parameters.
   * @param {string} parameters.furniture_id - ID of the furniture entity.
   * @param {string} parameters.actor_id - ID of the actor who just sat down.
   * @param {number} parameters.spot_index - Index of the spot where the actor sat.
   * @param {string} [parameters.result_variable] - Optional variable name to store result.
   * @param {ExecutionContext} executionContext - Execution context for the operation.
   * @returns {Promise<void>}
   */
  async execute(parameters, executionContext) {
    const logger = this.getLogger(executionContext);
    
    try {
      // Validate parameters
      validateProximityParameters(
        parameters.furniture_id,
        parameters.actor_id,
        parameters.spot_index,
        logger
      );

      // Verify furniture has allows_sitting component
      const furnitureComponent = this.#entityManager.getComponentData(
        parameters.furniture_id,
        'positioning:allows_sitting'
      );

      if (!furnitureComponent) {
        throw new Error(
          `Furniture ${parameters.furniture_id} does not have allows_sitting component`
        );
      }

      // Find adjacent occupants
      const adjacentActors = this.#getAdjacentOccupants(
        parameters.furniture_id,
        parameters.spot_index
      );

      if (adjacentActors.length === 0) {
        // No adjacent actors - no closeness established
        logger.info('No adjacent actors found for closeness establishment', {
          actorId: parameters.actor_id,
          furnitureId: parameters.furniture_id,
          spotIndex: parameters.spot_index,
        });

        if (parameters.result_variable) {
          if (!ensureEvaluationContext(executionContext, this.#dispatcher, logger)) {
            return;
          }
          tryWriteContextVariable(
            parameters.result_variable,
            false, // Return false when no closeness was established
            executionContext,
            this.#dispatcher,
            logger
          );
        }
        return;
      }

      // Establish closeness with each adjacent actor
      for (const adjacentActorId of adjacentActors) {
        await this.#establishClosenessRelationships(
          parameters.actor_id,
          adjacentActorId
        );
      }

      // Update movement locks for all affected actors
      const allAffectedActors = [parameters.actor_id, ...adjacentActors];
      await this.#updateMovementLocksForActors(allAffectedActors);

      // Log success
      logger.info('Sitting closeness established successfully', {
        actorId: parameters.actor_id,
        furnitureId: parameters.furniture_id,
        spotIndex: parameters.spot_index,
        adjacentActors: adjacentActors,
      });

      // Store result if requested
      if (parameters.result_variable) {
        if (!ensureEvaluationContext(executionContext, this.#dispatcher, logger)) {
          return;
        }
        tryWriteContextVariable(
          parameters.result_variable,
          true,
          executionContext,
          this.#dispatcher,
          logger
        );
      }
    } catch (error) {
      logger.error('Failed to establish sitting closeness', {
        furnitureId: parameters.furniture_id,
        actorId: parameters.actor_id,
        spotIndex: parameters.spot_index,
        error: error.message,
      });

      safeDispatchError(
        this.#dispatcher,
        'ESTABLISH_SITTING_CLOSENESS_FAILED',
        {
          furnitureId: parameters.furniture_id,
          actorId: parameters.actor_id,
          spotIndex: parameters.spot_index,
          reason: error.message,
        },
        logger
      );

      if (parameters.result_variable) {
        tryWriteContextVariable(
          parameters.result_variable,
          false,
          executionContext,
          this.#dispatcher,
          logger
        );
      }
    }
  }

  /**
   * Get entity IDs of actors in adjacent spots.
   *
   * @param {string} furnitureId - ID of the furniture entity.
   * @param {number} spotIndex - Spot index to find adjacent occupants for.
   * @returns {string[]} Array of adjacent actor entity IDs.
   * @private
   */
  #getAdjacentOccupants(furnitureId, spotIndex) {
    // Retrieve furniture's allows_sitting component
    const furnitureComponent = this.#entityManager.getComponentData(
      furnitureId,
      'positioning:allows_sitting'
    );

    if (!furnitureComponent || !furnitureComponent.spots) {
      return [];
    }

    // Use proximity utility to find adjacent occupants
    return findAdjacentOccupants(furnitureComponent, spotIndex);
  }

  /**
   * Establish closeness relationships between two actors.
   *
   * @param {string} actorId - Main actor ID.
   * @param {string} adjacentActorId - Adjacent actor ID.
   * @returns {Promise<void>}
   * @private
   */
  async #establishClosenessRelationships(actorId, adjacentActorId) {
    // Get existing closeness components
    const actorCloseness = this.#entityManager.getComponentData(
      actorId,
      'positioning:closeness'
    );
    const adjacentCloseness = this.#entityManager.getComponentData(
      adjacentActorId,
      'positioning:closeness'
    );

    // For seated actors, only establish adjacent relationships (not transitive)
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
    if (!adjacentPartners.includes(actorId)) {
      adjacentPartners.push(actorId);
    }

    // Update both actors with their new partners lists
    await this.#entityManager.addComponent(actorId, 'positioning:closeness', {
      partners: actorPartners,
    });
    await this.#entityManager.addComponent(adjacentActorId, 'positioning:closeness', {
      partners: adjacentPartners,
    });
  }

  /**
   * Update movement locks for a list of actors.
   *
   * @param {string[]} actorIds - Array of actor IDs to update.
   * @returns {Promise<void>}
   * @private
   */
  async #updateMovementLocksForActors(actorIds) {
    for (const id of actorIds) {
      try {
        await updateMovementLock(this.#entityManager, id, true);
      } catch (err) {
        const logger = this.logger; // From BaseOperationHandler
        safeDispatchError(
          this.#dispatcher,
          'ESTABLISH_SITTING_CLOSENESS: failed locking movement',
          { id, error: err.message, stack: err.stack },
          logger
        );
      }
    }
  }
}

export default EstablishSittingClosenessHandler;