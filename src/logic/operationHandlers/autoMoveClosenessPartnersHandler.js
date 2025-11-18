/**
 * @file Handler for AUTO_MOVE_CLOSENESS_PARTNERS operation
 *
 * Automatically relocates all entities in a closeness circle when one member moves to maintain
 * the spatial relationship established through proximity interactions (e.g., sitting together).
 *
 * Operation flow:
 * 1. Validate parameters (actor_id, destination_id, optional previous_location_id)
 * 2. Retrieve closeness component and partners list from actor
 * 3. For each partner, verify position and location match expectations
 * 4. Move partner using SYSTEM_MOVE_ENTITY handler
 * 5. Dispatch entity_moved, entity_exited_location, and entity_entered_location events
 *
 * Related files:
 * @see data/schemas/operations/autoMoveClosenessPartners.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - AutoMoveClosenessPartnersHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 * @augments BaseOperationHandler
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../operationInterpreter.js').default} OperationInterpreter */

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
  /** @type {() => OperationInterpreter} */
  #operationInterpreterResolver;

  /**
   * Create a new AutoMoveClosenessPartnersHandler instance.
   *
   * @param {object} deps - Dependency injection object.
   * @param {ILogger} deps.logger - Logger instance.
   * @param {IEntityManager} deps.entityManager - Entity manager for component operations.
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher - Event dispatcher for error handling.
   * @param {BaseOperationHandler} deps.systemMoveEntityHandler - Handler for SYSTEM_MOVE_ENTITY operations.
   * @param {() => OperationInterpreter} deps.operationInterpreter - Lazy resolver for operation interpreter.
   */
  constructor({
    logger,
    entityManager,
    safeEventDispatcher,
    systemMoveEntityHandler,
    operationInterpreter,
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
      operationInterpreter: {
        value: operationInterpreter,
      },
    });
    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
    this.#moveHandler = systemMoveEntityHandler;
    this.#operationInterpreterResolver = operationInterpreter;
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

    // Skip if partner already at destination (most common in mutual closeness)
    if (position.locationId === destinationId) {
      logger.debug('Partner already at destination, skipping', {
        partnerId,
        destinationId,
        reason: 'likely_mutual_closeness_race',
      });
      return false;
    }

    // If previous location specified, verify partner is actually there
    // Note: This can happen in mutual closeness when both actors try to auto-move each other
    if (previousLocationId && position.locationId !== previousLocationId) {
      logger.debug('Partner not at expected location, skipping', {
        partnerId,
        actorId,
        expectedLocation: previousLocationId,
        actualLocation: position.locationId,
        reason: 'likely_already_moved_by_mutual_closeness',
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
        eventName: 'core:entity_moved',
        entityId: partnerId,
        previousLocationId: position.locationId,
        currentLocationId: destinationId,
        originalCommand: 'system:closeness_auto_move',
      });

      // Dispatch perceptible events
      await this.#dispatchPerceptibleMessages(
        partnerId,
        actorId,
        position.locationId,
        destinationId,
        executionContext
      );

      // Dispatch location exit/enter events
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

  /**
   * Dispatch perceptible messages for the auto-moved partner.
   *
   * @param {string} partnerId - ID of the partner being moved
   * @param {string} actorId - ID of the actor that initiated movement
   * @param {string} previousLocationId - Previous location ID
   * @param {string} destinationId - Destination location ID
   * @param {ExecutionContext} executionContext - Execution context
   * @returns {Promise<void>}
   * @private
   */
  async #dispatchPerceptibleMessages(
    partnerId,
    actorId,
    previousLocationId,
    destinationId,
    executionContext
  ) {
    const logger = this.getLogger(executionContext);

    try {
      // Get the operation interpreter
      const interpreter = this.#operationInterpreterResolver();
      if (!interpreter) {
        logger.warn('Operation interpreter not available, skipping perceptible messages', {
          partnerId,
        });
        return;
      }

      // Get entity names for the message
      const partnerName = this.#entityManager.getComponentData(partnerId, 'core:name');
      const actorName = this.#entityManager.getComponentData(actorId, 'core:name');
      const destinationName = this.#entityManager.getComponentData(
        destinationId,
        'core:name'
      );

      if (!partnerName || !actorName || !destinationName) {
        logger.debug('Missing name components for perceptible message', {
          hasPartnerName: !!partnerName,
          hasActorName: !!actorName,
          hasDestinationName: !!destinationName,
        });
        return;
      }

      const messageText = `${partnerName.text} moves with ${actorName.text} to ${destinationName.text}.`;

      // Dispatch perceptible event to the new location
      await interpreter.execute(
        {
          type: 'DISPATCH_PERCEPTIBLE_EVENT',
          parameters: {
            location_id: destinationId,
            description_text: messageText,
            perception_type: 'character_enter',
            actor_id: partnerId,
            target_id: actorId,
            involved_entities: [],
            contextual_data: {
              initiatorId: actorId,
              originLocationId: previousLocationId,
              reason: 'closeness_auto_move',
            },
          },
        },
        executionContext
      );

      logger.debug('Dispatched perceptible message for auto-moved partner', {
        partnerId,
        message: messageText,
      });
    } catch (error) {
      logger.warn('Failed to dispatch perceptible message for auto-moved partner', {
        partnerId,
        error: error.message,
      });
      // Don't throw - perceptible messages are non-critical
    }
  }
}

export default AutoMoveClosenessPartnersHandler;
