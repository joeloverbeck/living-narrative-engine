/**
 * @file Operation handler for automatically moving closeness circle partners
 * @description When an entity in a closeness circle moves to a new location, this handler
 * automatically relocates all partners to maintain the closeness circle integrity.
 * @see src/logic/operationHandlers/autoMoveFollowersHandler.js - Reference pattern
 * @see data/mods/positioning/rules/closeness_auto_move.rule.json - Event trigger rule
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */

import BaseOperationHandler from './baseOperationHandler.js';
import { assertNonBlankString, assertPresent } from '../../utils/dependencyUtils.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';

const POSITION_COMPONENT_ID = 'core:position';
const CLOSENESS_COMPONENT_ID = 'positioning:closeness';

/**
 * @class AutoMoveClosenessPartnersHandler
 * @augments BaseOperationHandler
 * @description Automatically relocates all closeness circle members when one moves.
 * This ensures that actors in a closeness circle stay together when one member moves to
 * a different location, maintaining the proximity relationship established by getting close.
 */
class AutoMoveClosenessPartnersHandler extends BaseOperationHandler {
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {ISafeEventDispatcher} */
  #dispatcher;
  /** @type {BaseOperationHandler} */
  #moveHandler;

  /**
   * Create a new AutoMoveClosenessPartnersHandler instance.
   *
   * @param {object} deps - Dependency injection object.
   * @param {ILogger} deps.logger - Logger instance.
   * @param {IEntityManager} deps.entityManager - Entity manager for component operations.
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher - Event dispatcher for error handling.
   * @param {BaseOperationHandler} deps.systemMoveEntityHandler - Handler for SYSTEM_MOVE_ENTITY operations.
   */
  constructor({
    logger,
    entityManager,
    safeEventDispatcher,
    systemMoveEntityHandler,
  }) {
    super('AutoMoveClosenessPartnersHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData'],
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
      systemMoveEntityHandler: {
        value: systemMoveEntityHandler,
        requiredMethods: ['execute'],
      },
    });
    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
    this.#moveHandler = systemMoveEntityHandler;
  }

  /**
   * Execute the auto-move closeness partners operation.
   *
   * @param {object} parameters - Operation parameters.
   * @param {string} parameters.actor_id - ID of the entity that initiated movement.
   * @param {string} parameters.destination_id - Target location ID.
   * @param {string} [parameters.previous_location_id] - Optional previous location for validation.
   * @param {ExecutionContext} executionContext - Execution context for the operation.
   * @returns {Promise<object>} Operation result with success status
   */
  async execute(parameters, executionContext) {
    const logger = this.getLogger(executionContext);

    try {
      // Phase 1: Validate parameters
      this.#validateParameters(parameters, logger);

      const { actor_id, destination_id, previous_location_id } = parameters;

      // Phase 2: Get closeness component
      const closenessComponent = this.#entityManager.getComponentData(
        actor_id,
        CLOSENESS_COMPONENT_ID
      );

      if (!closenessComponent || !Array.isArray(closenessComponent.partners)) {
        logger.debug('Actor has no closeness partners to move', {
          actorId: actor_id,
          hasCloseness: !!closenessComponent,
        });
        return { success: true, partnersMoved: 0 };
      }

      const partners = closenessComponent.partners;

      if (partners.length === 0) {
        logger.debug('Actor has empty partners array', { actorId: actor_id });
        return { success: true, partnersMoved: 0 };
      }

      // Phase 3: Move all partners
      logger.info('Moving closeness partners', {
        actorId: actor_id,
        destination: destination_id,
        partnerCount: partners.length,
      });

      let movedCount = 0;
      for (const partnerId of partners) {
        const moved = await this.#moveSinglePartner(
          partnerId,
          actor_id,
          destination_id,
          previous_location_id,
          executionContext
        );
        if (moved) movedCount++;
      }

      logger.info('Closeness partners moved successfully', {
        actorId: actor_id,
        totalPartners: partners.length,
        movedCount,
      });

      return { success: true, partnersMoved: movedCount };
    } catch (error) {
      logger.error('Auto-move closeness partners failed', {
        actorId: parameters.actor_id,
        error: error.message,
        errorType: error.constructor.name,
      });

      safeDispatchError(
        this.#dispatcher,
        'Auto-move closeness partners failed',
        {
          actorId: parameters.actor_id,
          destinationId: parameters.destination_id,
          error: error.message,
        },
        logger
      );

      return { success: false, error: error.message };
    }
  }

  /**
   * Validate operation parameters.
   *
   * @param {object} parameters - Operation parameters
   * @param {ILogger} logger - Logger instance
   * @throws {InvalidArgumentError} When parameter validation fails
   * @private
   */
  #validateParameters(parameters, logger) {
    try {
      assertPresent(parameters, 'Parameters required for auto-move closeness partners');
      assertNonBlankString(
        parameters.actor_id,
        'actor_id',
        'AutoMoveClosenessPartnersHandler parameter validation',
        logger
      );
      assertNonBlankString(
        parameters.destination_id,
        'destination_id',
        'AutoMoveClosenessPartnersHandler parameter validation',
        logger
      );

      // previous_location_id is optional
      if (
        parameters.previous_location_id !== undefined &&
        typeof parameters.previous_location_id !== 'string'
      ) {
        throw new InvalidArgumentError(
          'previous_location_id must be a string when provided'
        );
      }
    } catch (error) {
      throw new InvalidArgumentError(
        `Parameter validation failed for auto-move closeness partners: ${error.message}`
      );
    }
  }

  /**
   * Move a single partner to the destination location.
   *
   * @param {string} partnerId - ID of the partner to move
   * @param {string} actorId - ID of the actor that initiated movement
   * @param {string} destinationId - Target location ID
   * @param {string|undefined} previousLocationId - Optional previous location for validation
   * @param {ExecutionContext} executionContext - Execution context
   * @returns {Promise<boolean>} True if partner was moved, false if skipped
   * @private
   */
  async #moveSinglePartner(
    partnerId,
    actorId,
    destinationId,
    previousLocationId,
    executionContext
  ) {
    const logger = this.getLogger(executionContext);

    // Verify partner still exists and location matches expectation
    const position = this.#entityManager.getComponentData(
      partnerId,
      POSITION_COMPONENT_ID
    );

    if (!position) {
      logger.warn('Partner has no position component, skipping', {
        partnerId,
        actorId,
      });
      return false;
    }

    // If previous location specified, verify partner is actually there
    if (previousLocationId && position.locationId !== previousLocationId) {
      logger.warn('Partner not at expected location, skipping', {
        partnerId,
        actorId,
        expectedLocation: previousLocationId,
        actualLocation: position.locationId,
      });
      return false;
    }

    // Skip if partner already at destination
    if (position.locationId === destinationId) {
      logger.debug('Partner already at destination, skipping', {
        partnerId,
        destinationId,
      });
      return false;
    }

    try {
      // Move the partner using SYSTEM_MOVE_ENTITY
      await this.#moveHandler.execute(
        {
          entity_ref: { entityId: partnerId },
          target_location_id: destinationId,
        },
        executionContext
      );

      logger.debug('Moved closeness partner', {
        partnerId,
        from: position.locationId,
        to: destinationId,
      });

      // Dispatch entity_moved event for the partner
      this.#dispatcher.dispatch('core:entity_moved', {
        entityId: partnerId,
        previousLocationId: position.locationId,
        currentLocationId: destinationId,
        movedBy: actorId,
        reason: 'closeness_auto_move',
      });

      // Dispatch perceptible events
      this.#dispatcher.dispatch('positioning:entity_exited_location', {
        entityId: partnerId,
        locationId: position.locationId,
        newLocationId: destinationId,
      });

      this.#dispatcher.dispatch('positioning:entity_entered_location', {
        entityId: partnerId,
        locationId: destinationId,
        previousLocationId: position.locationId,
      });

      return true;
    } catch (error) {
      logger.error('Failed to move closeness partner', {
        partnerId,
        actorId,
        destinationId,
        error: error.message,
      });

      safeDispatchError(
        this.#dispatcher,
        'Failed to move closeness partner',
        {
          partnerId,
          actorId,
          destinationId,
          error: error.message,
        },
        logger
      );

      return false;
    }
  }
}

export default AutoMoveClosenessPartnersHandler;
