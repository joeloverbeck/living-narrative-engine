/**
 * @file Handler for REMOVE_LYING_CLOSENESS operation
 *
 * Removes lying-based closeness relationships when actors stand up from furniture, while
 * preserving manually-established closeness through conservative heuristics.
 *
 * Operation flow:
 * 1. Validate parameters (furniture_id, actor_id) and component states
 * 2. Find all other actors lying on the same furniture
 * 3. Remove lying-based closeness (furniture relationships only, preserve manual ones)
 * 4. Update or remove closeness components based on remaining partners
 * 5. Update movement locks for all affected actors
 *
 * Related files:
 * @see data/schemas/operations/removeLyingCloseness.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - RemoveLyingClosenessHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 * @augments BaseOperationHandler
 */

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager
 * @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 * @typedef {import('../defs.js').ExecutionContext} ExecutionContext
 */

import BaseOperationHandler from './baseOperationHandler.js';
import { ComponentStateValidator } from '../../utils/componentStateValidator.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { updateMovementLock } from '../../utils/movementUtils.js';
import { tryWriteContextVariable } from '../../utils/contextVariableUtils.js';
import { ensureEvaluationContext } from '../../utils/evaluationContextUtils.js';
import * as closenessCircleService from '../services/closenessCircleService.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';
import { assertNonBlankString } from '../../utils/dependencyUtils.js';

/**
 * @class RemoveLyingClosenessHandler
 * @augments BaseOperationHandler
 * @description Removes automatic closeness relationships when actors stand up from lying on furniture,
 * while preserving manually-established closeness relationships created through get_close actions.
 * Uses conservative heuristics to distinguish between lying-based and manual relationships.
 */
class RemoveLyingClosenessHandler extends BaseOperationHandler {
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {ISafeEventDispatcher} */
  #dispatcher;
  /** @type {typeof closenessCircleService} */
  #closenessCircleService;
  /** @type {ComponentStateValidator} */
  #componentStateValidator;

  /**
   * Create a new RemoveLyingClosenessHandler instance.
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
    super('RemoveLyingClosenessHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: [
          'getComponentData',
          'addComponent',
          'removeComponent',
          'getEntitiesWithComponent',
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
   * Execute the remove lying closeness operation.
   *
   * @param {object} parameters - Operation parameters.
   * @param {string} parameters.furniture_id - ID of the furniture entity.
   * @param {string} parameters.actor_id - ID of the actor who just stood up.
   * @param {string} [parameters.result_variable] - Optional variable name to store result.
   * @param {ExecutionContext} executionContext - Execution context for the operation.
   * @returns {Promise<void>}
   */
  async execute(parameters, executionContext) {
    const logger = this.getLogger(executionContext);

    try {
      // Phase 1: Parameter validation
      this.#validateParameters(parameters, logger);

      // Phase 2: Component state validation
      this.#validateComponentState(parameters);

      // Get departing actor's current closeness state
      const departingActorCloseness = this.#entityManager.getComponentData(
        parameters.actor_id,
        'positioning:closeness'
      );

      // Validate departing actor's closeness component
      this.#componentStateValidator.validateClosenessComponent(
        parameters.actor_id,
        departingActorCloseness,
        'remove lying closeness operation'
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

      // Identify who was lying on the same furniture
      const formerLyingActors = this.#getFormerLyingOccupants(
        parameters.furniture_id,
        parameters.actor_id
      );

      if (formerLyingActors.length === 0) {
        // No other actors affected - no closeness to remove
        logger.info('No formerly lying actors found', {
          actorId: parameters.actor_id,
          furnitureId: parameters.furniture_id,
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

      // Remove only lying-based closeness relationships
      const updatedPartnerData = this.#removeLyingBasedCloseness(
        parameters.actor_id,
        formerLyingActors,
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
      const allAffectedActors = [parameters.actor_id, ...formerLyingActors];
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
      logger.info('Lying closeness removed successfully', {
        actorId: parameters.actor_id,
        furnitureId: parameters.furniture_id,
        formerLyingActors: formerLyingActors,
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
      logger.error('Failed to remove lying closeness', {
        furnitureId: parameters.furniture_id,
        actorId: parameters.actor_id,
        error: error.message,
      });

      safeDispatchError(
        this.#dispatcher,
        'REMOVE_LYING_CLOSENESS_FAILED',
        {
          furnitureId: parameters.furniture_id,
          actorId: parameters.actor_id,
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
   * Phase 1: Enhanced parameter validation
   *
   * @param {object} parameters - Operation parameters
   * @param {ILogger} logger - Logger instance
   * @throws {InvalidArgumentError} When parameter validation fails
   * @private
   */
  #validateParameters(parameters, logger) {
    try {
      assertNonBlankString(
        parameters.furniture_id,
        'furniture_id',
        'remove lying closeness',
        logger
      );
      assertNonBlankString(
        parameters.actor_id,
        'actor_id',
        'remove lying closeness',
        logger
      );
    } catch (error) {
      throw new InvalidArgumentError(
        `Parameter validation failed for remove lying closeness: ${error.message}`
      );
    }
  }

  /**
   * Phase 2: Component state validation
   *
   * @param {object} parameters - Operation parameters
   * @throws {Error} When furniture component is missing
   * @private
   */
  #validateComponentState(parameters) {
    const furnitureComponent = this.#entityManager.getComponentData(
      parameters.furniture_id,
      'lying:allows_lying_on'
    );

    if (!furnitureComponent) {
      throw new Error(
        `Furniture ${parameters.furniture_id} missing allows_lying_on component`
      );
    }
  }

  /**
   * Get entity IDs of actors who are currently lying on the same furniture.
   * This method finds actors who REMAIN lying on the furniture after the departing actor has stood up.
   *
   * @param {string} furnitureId - ID of the furniture entity.
   * @param {string} departingActorId - ID of the actor who is standing up.
   * @returns {string[]} Array of actor entity IDs currently lying on the same furniture.
   * @private
   */
  #getFormerLyingOccupants(furnitureId, departingActorId) {
    // Get all entities with lying_down component
    const allLyingEntities = this.#entityManager.getEntitiesWithComponent(
      'positioning:lying_down'
    );

    // Filter for actors lying on the SAME furniture, excluding the departing actor
    const lyingActors = [];

    for (const entity of allLyingEntities) {
      const entityId = entity.id;

      if (entityId === departingActorId) {
        continue; // Skip the actor who just stood up
      }

      const lyingComponent = this.#entityManager.getComponentData(
        entityId,
        'positioning:lying_down'
      );

      if (lyingComponent && lyingComponent.furniture_id === furnitureId) {
        lyingActors.push(entityId);
      }
    }

    return lyingActors;
  }

  /**
   * Remove lying-based closeness relationships using conservative heuristics.
   * Only removes relationships between the departing actor and actors currently lying on the same furniture.
   * Preserves all other relationships as they may be manually established.
   *
   * @param {string} departingActorId - Actor leaving the furniture.
   * @param {string[]} formerLyingActors - Actors currently lying on the same furniture.
   * @param {string[]} currentPartners - Current partners of the departing actor.
   * @returns {Record<string, string[]>} Updated partner data for all affected actors.
   * @private
   */
  #removeLyingBasedCloseness(
    departingActorId,
    formerLyingActors,
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
      // Remove former lying actors from departing actor's list (these are lying-based)
      let updatedPartners = departingActorCloseness.partners.filter(
        (partner) => !this.#isLyingBasedRelationship(partner, formerLyingActors)
      );

      // Use closeness circle service to deduplicate and sort the partners array
      updatedPartners = this.#closenessCircleService.repair(updatedPartners);
      updatedPartnerData[departingActorId] = updatedPartners;
    } else {
      // Even if no closeness component, ensure we track that it should have no partners
      updatedPartnerData[departingActorId] = [];
    }

    // Process all current partners to ensure bidirectional consistency
    // This includes both lying and non-lying partners
    for (const partnerId of currentPartners) {
      const partnerCloseness = this.#entityManager.getComponentData(
        partnerId,
        'positioning:closeness'
      );

      if (partnerCloseness && Array.isArray(partnerCloseness.partners)) {
        let updatedPartners = [...partnerCloseness.partners];

        // Only remove the departing actor if this partner was lying on same furniture
        // Non-lying partners keep their manual relationships
        if (formerLyingActors.includes(partnerId)) {
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
   * Determine if a relationship is likely lying-based using conservative heuristics.
   * Conservative approach: Only remove if partner was lying on same furniture.
   * This could be enhanced with relationship type tracking in future versions.
   *
   * @param {string} partnerId - ID of the partner actor.
   * @param {string[]} formerLyingActors - Actors who were lying on same furniture.
   * @returns {boolean} True if the relationship is likely lying-based.
   * @private
   */
  #isLyingBasedRelationship(partnerId, formerLyingActors) {
    // Conservative heuristic: Only remove if partner was lying on same furniture
    // This preserves manual relationships while removing lying-based ones
    return formerLyingActors.includes(partnerId);
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
        // From BaseOperationHandler
        safeDispatchError(
          this.#dispatcher,
          'REMOVE_LYING_CLOSENESS: failed updating movement lock',
          { actorId, error: err.message, stack: err.stack },
          this.logger
        );
      }
    }
  }
}

export default RemoveLyingClosenessHandler;
