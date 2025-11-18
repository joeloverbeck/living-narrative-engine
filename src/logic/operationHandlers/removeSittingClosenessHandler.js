/**
 * @file Handler for REMOVE_SITTING_CLOSENESS operation
 *
 * Removes sitting-based closeness relationships when actors stand up from furniture, while
 * preserving manually-established closeness through conservative heuristics.
 *
 * Operation flow:
 * 1. Validate parameters (furniture_id, actor_id, spot_index) and component states
 * 2. Identify formerly adjacent actors using proximity utilities
 * 3. Remove sitting-based closeness (adjacent relationships only, preserve manual ones)
 * 4. Update or remove closeness components based on remaining partners
 * 5. Update movement locks for all affected actors
 *
 * Related files:
 * @see data/schemas/operations/removeSittingCloseness.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - RemoveSittingClosenessHandler token
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
import {
  getAdjacentSpots,
  validateProximityParameters,
} from '../../utils/proximityUtils.js';
import { ComponentStateValidator } from '../../utils/componentStateValidator.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { updateMovementLock } from '../../utils/movementUtils.js';
import { tryWriteContextVariable } from '../../utils/contextVariableUtils.js';
import { ensureEvaluationContext } from '../../utils/evaluationContextUtils.js';
import * as closenessCircleService from '../services/closenessCircleService.js';

/**
 * @class RemoveSittingClosenessHandler
 * @augments BaseOperationHandler
 * @description Removes automatic closeness relationships when actors stand up from furniture,
 * while preserving manually-established closeness relationships created through get_close actions.
 * Uses conservative heuristics to distinguish between sitting-based and manual relationships.
 */
class RemoveSittingClosenessHandler extends BaseOperationHandler {
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {ISafeEventDispatcher} */
  #dispatcher;
  /** @type {typeof closenessCircleService} */
  #closenessCircleService;
  /** @type {ComponentStateValidator} */
  #componentStateValidator;

  /**
   * Create a new RemoveSittingClosenessHandler instance.
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
    super('RemoveSittingClosenessHandler', {
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
    this.#componentStateValidator = new ComponentStateValidator({ logger });
  }

  /**
   * Execute the remove sitting closeness operation.
   *
   * @param {object} parameters - Operation parameters.
   * @param {string} parameters.furniture_id - ID of the furniture entity.
   * @param {string} parameters.actor_id - ID of the actor who just stood up.
   * @param {number} parameters.spot_index - Index of the spot the actor vacated.
   * @param {string} [parameters.result_variable] - Optional variable name to store result.
   * @param {ExecutionContext} executionContext - Execution context for the operation.
   * @returns {Promise<void>}
   */
  async execute(parameters, executionContext) {
    const logger = this.getLogger(executionContext);

    try {
      // Phase 1: Parameter validation
      validateProximityParameters(
        parameters.furniture_id,
        parameters.actor_id,
        parameters.spot_index,
        logger
      );

      // Phase 2: Component state validation
      const furnitureComponent = this.#entityManager.getComponentData(
        parameters.furniture_id,
        'positioning:allows_sitting'
      );
      this.#componentStateValidator.validateFurnitureComponent(
        parameters.furniture_id,
        furnitureComponent,
        'remove sitting closeness operation'
      );

      // Get departing actor's current closeness state
      const departingActorCloseness = this.#entityManager.getComponentData(
        parameters.actor_id,
        'positioning:closeness'
      );

      // Validate departing actor's closeness component
      this.#componentStateValidator.validateClosenessComponent(
        parameters.actor_id,
        departingActorCloseness,
        'remove sitting closeness operation'
      );

      if (
        !departingActorCloseness ||
        !Array.isArray(departingActorCloseness.partners) ||
        departingActorCloseness.partners.length === 0
      ) {
        // No closeness to remove - operation succeeds with no action needed
        logger.info('No closeness relationships to remove', {
          actorId: parameters.actor_id,
          furnitureId: parameters.furniture_id,
          spotIndex: parameters.spot_index,
        });

        if (parameters.result_variable) {
          if (
            !ensureEvaluationContext(executionContext, this.#dispatcher, logger)
          ) {
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
        return;
      }

      // Identify who was adjacent before standing up
      const formerAdjacentActors = this.#getFormerAdjacentOccupants(
        parameters.furniture_id,
        parameters.spot_index
      );

      if (formerAdjacentActors.length === 0) {
        // No adjacent actors affected - no closeness to remove
        logger.info('No formerly adjacent actors found', {
          actorId: parameters.actor_id,
          furnitureId: parameters.furniture_id,
          spotIndex: parameters.spot_index,
        });

        if (parameters.result_variable) {
          if (
            !ensureEvaluationContext(executionContext, this.#dispatcher, logger)
          ) {
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
        return;
      }

      // Remove only sitting-based closeness relationships
      const updatedPartnerData = this.#removeSittingBasedCloseness(
        parameters.actor_id,
        formerAdjacentActors,
        departingActorCloseness.partners
      );

      // Apply component updates for all affected actors
      for (const [actorId, updatedPartners] of Object.entries(
        updatedPartnerData
      )) {
        if (updatedPartners.length === 0) {
          // Remove component if no partners remain
          await this.#entityManager.removeComponent(
            actorId,
            'positioning:closeness'
          );
        } else {
          // Update component with remaining partners
          await this.#entityManager.addComponent(
            actorId,
            'positioning:closeness',
            {
              partners: updatedPartners,
            }
          );
        }
      }

      // Update movement locks for affected actors
      const allAffectedActors = [parameters.actor_id, ...formerAdjacentActors];
      await this.#updateMovementLocksAfterRemoval(allAffectedActors);

      // Phase 3: Final state validation
      for (const actorId of Object.keys(updatedPartnerData)) {
        const finalClosenessComponent = this.#entityManager.getComponentData(
          actorId,
          'positioning:closeness'
        );
        this.#componentStateValidator.validateClosenessComponent(
          actorId,
          finalClosenessComponent,
          'post-removal validation'
        );
      }

      // Log success
      logger.info('Sitting closeness removed successfully', {
        actorId: parameters.actor_id,
        furnitureId: parameters.furniture_id,
        spotIndex: parameters.spot_index,
        formerAdjacentActors: formerAdjacentActors,
        removedRelationships: Object.keys(updatedPartnerData).length,
      });

      // Store result if requested
      if (parameters.result_variable) {
        if (
          !ensureEvaluationContext(executionContext, this.#dispatcher, logger)
        ) {
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
      logger.error('Failed to remove sitting closeness', {
        furnitureId: parameters.furniture_id,
        actorId: parameters.actor_id,
        spotIndex: parameters.spot_index,
        error: error.message,
      });

      safeDispatchError(
        this.#dispatcher,
        'REMOVE_SITTING_CLOSENESS_FAILED',
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
   * Get entity IDs of actors who were in spots adjacent to the vacated spot.
   *
   * @param {string} furnitureId - ID of the furniture entity.
   * @param {number} vacatedSpotIndex - Spot index that was just vacated.
   * @returns {string[]} Array of formerly adjacent actor entity IDs.
   * @private
   */
  #getFormerAdjacentOccupants(furnitureId, vacatedSpotIndex) {
    // Get current furniture state (after actor has stood up)
    const furnitureComponent = this.#entityManager.getComponentData(
      furnitureId,
      'positioning:allows_sitting'
    );

    if (!furnitureComponent || !Array.isArray(furnitureComponent.spots)) {
      return [];
    }

    // Calculate which spots were adjacent to the vacated spot
    const adjacentSpotIndices = getAdjacentSpots(
      vacatedSpotIndex,
      furnitureComponent.spots.length
    );

    // Find actors currently occupying those adjacent spots
    const adjacentActors = [];
    for (const spotIndex of adjacentSpotIndices) {
      const occupant = furnitureComponent.spots[spotIndex];
      if (occupant && occupant !== null) {
        adjacentActors.push(occupant);
      }
    }

    return adjacentActors;
  }

  /**
   * Remove sitting-based closeness relationships using conservative heuristics.
   * Only removes relationships between the departing actor and formerly adjacent actors.
   * Preserves all other relationships as they may be manually established.
   *
   * @param {string} departingActorId - Actor leaving the furniture.
   * @param {string[]} formerAdjacentActors - Actors who were adjacent to the departing actor.
   * @param {string[]} currentPartners - Current partners of the departing actor.
   * @returns {Record<string, string[]>} Updated partner data for all affected actors.
   * @private
   */
  #removeSittingBasedCloseness(
    departingActorId,
    formerAdjacentActors,
    currentPartners
  ) {
    const updatedPartnerData = {};

    // Process the departing actor first
    const departingActorCloseness = this.#entityManager.getComponentData(
      departingActorId,
      'positioning:closeness'
    );
    if (
      departingActorCloseness &&
      Array.isArray(departingActorCloseness.partners)
    ) {
      // Remove former adjacent actors from departing actor's list (these are sitting-based)
      let updatedPartners = departingActorCloseness.partners.filter(
        (partner) =>
          !this.#isSittingBasedRelationship(partner, formerAdjacentActors)
      );

      // Use closeness circle service to deduplicate and sort the partners array
      updatedPartners = this.#closenessCircleService.repair(updatedPartners);
      updatedPartnerData[departingActorId] = updatedPartners;
    } else {
      // Even if no closeness component, ensure we track that it should have no partners
      updatedPartnerData[departingActorId] = [];
    }

    // Process all current partners to ensure bidirectional consistency
    // This includes both adjacent and non-adjacent partners
    for (const partnerId of currentPartners) {
      const partnerCloseness = this.#entityManager.getComponentData(
        partnerId,
        'positioning:closeness'
      );

      if (partnerCloseness && Array.isArray(partnerCloseness.partners)) {
        let updatedPartners = [...partnerCloseness.partners];

        // Only remove the departing actor if this partner was adjacent
        // Non-adjacent partners keep their manual relationships
        if (formerAdjacentActors.includes(partnerId)) {
          updatedPartners = updatedPartners.filter(
            (partner) => partner !== departingActorId
          );
        }

        // Use closeness circle service to deduplicate and sort the partners array
        updatedPartners = this.#closenessCircleService.repair(updatedPartners);
        updatedPartnerData[partnerId] = updatedPartners;
      }
      // Note: If a partner doesn't have a closeness component, we don't add them to updatedPartnerData
      // This preserves the existing state (no component = no closeness)
    }

    return updatedPartnerData;
  }

  /**
   * Determine if a relationship is likely sitting-based using conservative heuristics.
   * Conservative approach: Only remove if partner was adjacent and likely sitting-based.
   * This could be enhanced with relationship type tracking in future versions.
   *
   * @param {string} partnerId - ID of the partner actor.
   * @param {string[]} formerAdjacentActors - Actors who were formerly adjacent.
   * @returns {boolean} True if the relationship is likely sitting-based.
   * @private
   */
  #isSittingBasedRelationship(partnerId, formerAdjacentActors) {
    // Conservative heuristic: Only remove if partner was adjacent
    // This preserves manual relationships while removing sitting-based ones
    return formerAdjacentActors.includes(partnerId);
  }

  /**
   * Update movement locks for actors after closeness removal.
   * Actors who no longer have any closeness relationships get their movement unlocked.
   *
   * @param {string[]} actorIds - Array of actor IDs to potentially update.
   * @returns {Promise<void>}
   * @private
   */
  async #updateMovementLocksAfterRemoval(actorIds) {
    for (const actorId of actorIds) {
      try {
        // Check if actor still has closeness relationships
        const closenessComponent = this.#entityManager.getComponentData(
          actorId,
          'positioning:closeness'
        );

        // If no closeness component or empty partners, unlock movement
        const shouldUnlock =
          !closenessComponent ||
          !Array.isArray(closenessComponent.partners) ||
          closenessComponent.partners.length === 0;

        if (shouldUnlock) {
          await updateMovementLock(this.#entityManager, actorId, false);
        }
      } catch (err) {
        const logger = this.logger; // From BaseOperationHandler
        safeDispatchError(
          this.#dispatcher,
          'REMOVE_SITTING_CLOSENESS: failed updating movement lock',
          { actorId, error: err.message, stack: err.stack },
          logger
        );
      }
    }
  }
}

export default RemoveSittingClosenessHandler;
