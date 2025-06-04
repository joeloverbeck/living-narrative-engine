// src/core/turnManager.js
// --- FILE START ---

/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('./interfaces/ITurnOrderService.js').ITurnOrderService} ITurnOrderService */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('./interfaces/ITurnHandlerResolver.js').ITurnHandlerResolver} ITurnHandlerResolver */
/** @typedef {import('./interfaces/ITurnHandler.js').ITurnHandler} ITurnHandler */
/** @typedef {import('../types/eventTypes.js').SystemEventPayloads} SystemEventPayloads */

/** @typedef {import('./interfaces/ITurnManager.js').ITurnManager} ITurnManagerInterface */

// Import the necessary component ID constants
import {
  ACTOR_COMPONENT_ID,
  PLAYER_COMPONENT_ID,
} from '../constants/componentIds.js';
import {
  TURN_ENDED_ID,
  SYSTEM_ERROR_OCCURRED_ID,
} from '../constants/eventIds.js';
import { ITurnManager } from './interfaces/ITurnManager.js'; // Assuming TURN_ENDED_ID is 'core:turn_ended' and SYSTEM_ERROR_OCCURRED_ID is 'core:system_error_occurred'

/**
 * @class TurnManager
 * @implements {ITurnManager}
 * @classdesc Manages the overall turn lifecycle. Determines the next actor,
 * initiates their turn via the appropriate handler, and waits for a turn completion
 * event (`core:turn_ended`) before advancing to the next turn or round.
 * Dispatches semantic events like 'core:turn_started' and 'core:system_error_occurred'.
 * Includes logic to stop if a round completes with no successful turns.
 */
class TurnManager extends ITurnManager {
  /** @type {ITurnOrderService} */
  #turnOrderService;
  /** @type {EntityManager} */
  #entityManager;
  /** @type {ILogger} */
  #logger;
  /** @type {IValidatedEventDispatcher} */
  #dispatcher;
  /** @type {ITurnHandlerResolver} */
  #turnHandlerResolver;

  /** @type {boolean} */
  #isRunning = false;
  /** @type {Entity | null} */
  #currentActor = null;
  /** @type {ITurnHandler | null} */
  #currentHandler = null;
  /** @type { (() => void) | null } */
  #turnEndedUnsubscribe = null;

  // --- NEW FIELDS ---
  /**
   * Tracks if at least one turn completed successfully within the current round.
   * Reset to false when a new round starts.
   *
   * @type {boolean}
   */
  #roundHadSuccessfulTurn = false;
  /**
   * Tracks if a round is currently considered in progress (i.e., after startNewRound was called successfully).
   * Reset to false when stopped or before starting the very first round.
   *
   * @type {boolean}
   */
  #roundInProgress = false;

  // --- END NEW FIELDS ---

  /**
   * Creates an instance of TurnManager.
   *
   * @param {object} options - The dependencies for the TurnManager.
   * @param {ITurnOrderService} options.turnOrderService - Service for managing turn order within a round.
   * @param {EntityManager} options.entityManager - Service for managing entities.
   * @param {ILogger} options.logger - Logging service.
   * @param {IValidatedEventDispatcher} options.dispatcher - Service for dispatching events AND subscribing.
   * @param {ITurnHandlerResolver} options.turnHandlerResolver - Service to resolve the correct turn handler.
   * @throws {Error} If any required dependency is missing or invalid.
   */
  constructor(options) {
    super();

    const {
      turnOrderService,
      entityManager,
      logger,
      dispatcher,
      turnHandlerResolver,
    } = options || {};
    const className = this.constructor.name;

    // --- Dependency Validation (unchanged) ---
    if (
      !turnOrderService ||
      typeof turnOrderService.clearCurrentRound !== 'function'
    ) {
      const errorMsg = `${className} requires a valid ITurnOrderService instance.`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    if (
      !entityManager ||
      typeof entityManager.getEntityInstance !== 'function'
    ) {
      const errorMsg = `${className} requires a valid EntityManager instance.`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    if (
      !logger ||
      typeof logger.info !== 'function' ||
      typeof logger.warn !== 'function' ||
      typeof logger.error !== 'function'
    ) {
      const errorMsg = `${className} requires a valid ILogger instance.`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    if (
      !dispatcher ||
      typeof dispatcher.dispatchValidated !== 'function' ||
      typeof dispatcher.subscribe !== 'function'
    ) {
      const errorMsg = `${className} requires a valid IValidatedEventDispatcher instance (with dispatchValidated and subscribe methods).`;
      (logger || console).error(errorMsg);
      throw new Error(errorMsg);
    }
    if (
      !turnHandlerResolver ||
      typeof turnHandlerResolver.resolveHandler !== 'function'
    ) {
      const errorMsg = `${className} requires a valid ITurnHandlerResolver instance (with resolveHandler method).`;
      (logger || console).error(errorMsg);
      throw new Error(errorMsg);
    }
    // --- End Dependency Validation ---

    this.#turnOrderService = turnOrderService;
    this.#entityManager = entityManager;
    this.#logger = logger;
    this.#dispatcher = dispatcher;
    this.#turnHandlerResolver = turnHandlerResolver;

    // --- State Initialization (reset flags) ---
    this.#isRunning = false;
    this.#currentActor = null;
    this.#currentHandler = null;
    this.#turnEndedUnsubscribe = null;
    this.#roundHadSuccessfulTurn = false; // Initialize new flag
    this.#roundInProgress = false; // Initialize new flag
    // --- End State Initialization ---

    this.#logger.info('TurnManager initialized successfully.');
  }

  /**
   * Starts the turn management process. Subscribes to turn end events.
   *
   * @async
   * @returns {Promise<void>} A promise that resolves when the manager has successfully started and the first turn advance is initiated.
   */
  async start() {
    if (this.#isRunning) {
      this.#logger.warn(
        'TurnManager.start() called but manager is already running.'
      );
      return;
    }
    this.#isRunning = true;
    this.#roundInProgress = false; // Reset on start
    this.#roundHadSuccessfulTurn = false; // Reset on start
    this.#logger.info('Turn Manager started.');

    this.#subscribeToTurnEnd(); // Subscribe when manager starts
    await this.advanceTurn();
  }

  /**
   * Stops the turn management process. Unsubscribes from turn end events.
   *
   * @async
   * @returns {Promise<void>} A promise that resolves when the manager has successfully stopped.
   */
  async stop() {
    if (!this.#isRunning) {
      this.#logger.info(
        'TurnManager.stop() called but manager is already stopped.'
      );
      return;
    }
    this.#isRunning = false;
    this.#unsubscribeFromTurnEnd(); // Unsubscribe when manager stops

    if (
      this.#currentHandler &&
      typeof this.#currentHandler.destroy === 'function'
    ) {
      try {
        this.#logger.debug(
          `Calling destroy() on current handler (${this.#currentHandler.constructor?.name || 'Unknown'}) for actor ${this.#currentActor?.id || 'N/A'}`
        );
        await Promise.resolve(this.#currentHandler.destroy());
      } catch (destroyError) {
        this.#logger.error(
          `Error calling destroy() on current handler during stop: ${destroyError.message}`,
          destroyError
        );
      }
    }

    this.#currentActor = null;
    this.#currentHandler = null;

    try {
      await this.#turnOrderService.clearCurrentRound();
      this.#roundInProgress = false; // Reset round progress flag on stop/clear
      this.#logger.debug('Turn order service current round cleared.');
    } catch (error) {
      this.#logger.error(
        'Error calling turnOrderService.clearCurrentRound() during stop:',
        error
      );
    }
    this.#logger.info('Turn Manager stopped.');
  }

  /**
   * Retrieves the entity instance whose turn it is currently.
   *
   * @returns {Entity | null} The entity currently taking its turn, or `null`.
   */
  getCurrentActor() {
    return this.#currentActor;
  }

  /**
   * Retrieves the turn handler instance that is currently managing the active turn.
   *
   * @returns {ITurnHandler | null} The currently active turn handler, or `null`.
   */
  getActiveTurnHandler() {
    return this.#currentHandler;
  }

  /**
   * Advances the game state to the next entity's turn, or starts a new round.
   * Resolves the handler, calls its `startTurn` method, and then *waits* for the
   * `core:turn_ended` event before proceeding.
   * Handles system-level errors by dispatching 'core:system_error_occurred'.
   * **Includes logic to stop if a round completes with no successful turns.**
   *
   * @async
   * @private
   * @returns {Promise<void>} A promise that resolves when the next turn has been *initiated*.
   */
  async advanceTurn() {
    if (!this.#isRunning) {
      this.#logger.debug(
        'TurnManager.advanceTurn() called while manager is not running. Returning.'
      );
      return;
    }

    this.#logger.debug('TurnManager.advanceTurn() initiating...');
    // Clear previous actor/handler
    const previousActorIdForLog = this.#currentActor?.id;
    if (previousActorIdForLog) {
      this.#logger.debug(
        `Clearing previous actor ${previousActorIdForLog} and handler before advancing.`
      );
    }
    this.#currentActor = null;
    this.#currentHandler = null;

    try {
      const isQueueEmpty = await this.#turnOrderService.isEmpty();

      if (isQueueEmpty) {
        this.#logger.info(
          'Turn queue is empty. Preparing for new round or stopping.'
        );

        // --- NEW CHECK: Stop if previous round had no success ---
        if (this.#roundInProgress && !this.#roundHadSuccessfulTurn) {
          const errorMsg =
            'No successful turns completed in the previous round. Stopping TurnManager.';
          this.#logger.error(errorMsg);
          await this.#dispatchSystemError(
            'System Error: No progress made in the last round.',
            errorMsg
          );
          await this.stop();
          return; // Stop processing
        }
        // --- END NEW CHECK ---

        // --- Reset for new round ---
        this.#logger.info('Attempting to start a new round.');
        this.#roundHadSuccessfulTurn = false; // Reset success tracker *before* starting new round
        // #roundInProgress will be set to true *after* startNewRound succeeds below
        // --- End Reset ---

        const allEntities = Array.from(
          this.#entityManager.activeEntities.values()
        );
        const actors = allEntities.filter((e) =>
          e.hasComponent(ACTOR_COMPONENT_ID)
        );

        if (actors.length === 0) {
          const errorMsg =
            'Cannot start a new round: No active entities with an Actor component found.';
          this.#logger.error(errorMsg);
          await this.#dispatchSystemError(
            'System Error: No active actors found to start a round. Stopping game.',
            errorMsg
          );
          await this.stop();
          return;
        }

        const actorIds = actors.map((a) => a.id);
        this.#logger.info(
          `Found ${actors.length} actors to start the round: ${actorIds.join(', ')}`
        );
        const strategy = 'round-robin'; // Or determine dynamically

        // Start the new round in the service
        await this.#turnOrderService.startNewRound(actors, strategy);
        this.#roundInProgress = true; // Mark round as officially in progress *after* successful start
        this.#logger.info(
          `Successfully started a new round with ${actors.length} actors using the '${strategy}' strategy.`
        );

        this.#logger.debug(
          'New round started, recursively calling advanceTurn() to process the first turn.'
        );
        await this.advanceTurn(); // Recursive call to process the first turn of the new round
        return;
      } else {
        // Queue is not empty, process next turn
        this.#logger.debug('Queue not empty, retrieving next entity.');
        const nextEntity = await this.#turnOrderService.getNextEntity();

        if (!nextEntity) {
          const errorMsg =
            'Turn order inconsistency: getNextEntity() returned null/undefined when queue was not empty.';
          this.#logger.error(errorMsg);
          await this.#dispatchSystemError(
            'Internal Error: Turn order inconsistency detected. Stopping game.',
            errorMsg
          );
          await this.stop();
          return;
        }

        this.#currentActor = nextEntity; // Set the new current actor
        const actorId = this.#currentActor.id;
        const isPlayer = this.#currentActor.hasComponent(PLAYER_COMPONENT_ID);
        const entityType = isPlayer ? 'player' : 'ai';

        this.#logger.info(
          `>>> Starting turn initiation for Entity: ${actorId} (${entityType}) <<<`
        );
        try {
          await this.#dispatcher.dispatchValidated('core:turn_started', {
            entityId: actorId,
            entityType: entityType,
          });
        } catch (dispatchError) {
          this.#logger.error(
            `Failed to dispatch core:turn_started for ${actorId}: ${dispatchError.message}`,
            dispatchError
          );
          // Continue processing the turn even if event dispatch fails
        }

        this.#logger.debug(`Resolving turn handler for entity ${actorId}...`);
        const handler = await this.#turnHandlerResolver.resolveHandler(
          this.#currentActor
        );
        this.#currentHandler = handler; // Set the new current handler

        if (!handler) {
          this.#logger.warn(
            `Could not resolve a turn handler for actor ${actorId}. Skipping turn and advancing.`
          );
          // Simulate an unsuccessful turn end to allow round progression check
          // Since #handleTurnEndedEvent is now called asynchronously via the event bus,
          // we directly call it here if we want immediate processing for this specific case.
          // However, to maintain consistency with event-driven flow, it might be better
          // to dispatch a dummy 'core:turn_ended' event, but that could be overkill.
          // For now, directly calling #handleTurnEndedEvent (which is not async itself) is okay.
          this.#handleTurnEndedEvent({
            // This will schedule advanceTurn via its own logic
            type: TURN_ENDED_ID,
            payload: {
              entityId: actorId,
              success: false,
              error: new Error(
                `No turn handler resolved for actor ${actorId}.`
              ),
            },
          });
          return;
        }

        const handlerName = handler.constructor?.name || 'resolved handler';
        this.#logger.debug(
          `Calling startTurn on ${handlerName} for entity ${actorId}`
        );

        // Start the turn, but don't await it here. Wait for TURN_ENDED_ID event.
        handler.startTurn(this.#currentActor).catch((startTurnError) => {
          const errorMsg = `Error during handler.startTurn() initiation for entity ${actorId} (${handlerName}): ${startTurnError.message}`;
          this.#logger.error(errorMsg, startTurnError);
          this.#dispatchSystemError(
            `Error initiating turn for ${actorId}.`,
            startTurnError
          ).catch((e) =>
            this.#logger.error(
              `Failed to dispatch system error after startTurn failure: ${e.message}`
            )
          );

          if (this.#currentActor?.id === actorId) {
            this.#logger.warn(
              `Manually handling turn end after startTurn initiation failure for ${actorId}.`
            );
            this.#handleTurnEndedEvent({
              type: TURN_ENDED_ID,
              payload: {
                entityId: actorId,
                success: false,
                error: startTurnError,
              },
            });
          } else {
            this.#logger.warn(
              `startTurn initiation failed for ${actorId}, but current actor changed before manual advance could occur. No advance triggered by this error handler.`
            );
          }
        });
        this.#logger.debug(
          `Turn initiation for ${actorId} started via ${handlerName}. TurnManager now WAITING for '${TURN_ENDED_ID}' event.`
        );
      }
    } catch (error) {
      const errorMsg = `CRITICAL Error during turn advancement logic (before handler initiation): ${error.message}`;
      this.#logger.error(errorMsg, error);
      await this.#dispatchSystemError(
        'System Error during turn advancement. Stopping game.',
        error
      );
      await this.stop();
    }
  }

  /**
   * Subscribes to the event indicating a turn has ended.
   *
   * @private
   */
  #subscribeToTurnEnd() {
    if (this.#turnEndedUnsubscribe) {
      this.#logger.warn(
        'Attempted to subscribe to turn end event, but already subscribed.'
      );
      return;
    }
    try {
      this.#logger.debug(`Subscribing to '${TURN_ENDED_ID}' event.`);

      const handlerCallback = (event) => {
        // MODIFICATION: Use setTimeout to schedule as a macrotask
        setTimeout(() => {
          try {
            // #handleTurnEndedEvent is not an async function itself,
            // but it initiates async operations.
            this.#handleTurnEndedEvent(event);
          } catch (handlerError) {
            // This catch handles synchronous errors thrown directly by #handleTurnEndedEvent
            this.#logger.error(
              `Error processing ${TURN_ENDED_ID} event (setTimeout): ${handlerError.message}`,
              handlerError
            );
            // Note: #dispatchSystemError is async
            this.#dispatchSystemError(
              'Error processing turn ended event (setTimeout).',
              handlerError
            ).catch((e) =>
              this.#logger.error(
                `Failed to dispatch system error after setTimeout event handler failure: ${e.message}`
              )
            );
          }
        }, 0); // Delay of 0 ms, but schedules as a macrotask
      };

      this.#turnEndedUnsubscribe = this.#dispatcher.subscribe(
        TURN_ENDED_ID,
        handlerCallback
      );
      if (typeof this.#turnEndedUnsubscribe !== 'function') {
        this.#turnEndedUnsubscribe = null;
        throw new Error(
          'Subscription function did not return an unsubscribe callback.'
        );
      }
    } catch (error) {
      this.#logger.error(
        `CRITICAL: Failed to subscribe to ${TURN_ENDED_ID}. Turn advancement will likely fail. Error: ${error.message}`,
        error
      );
      this.#dispatchSystemError(
        `Failed to subscribe to ${TURN_ENDED_ID}. Game cannot proceed reliably.`,
        error
      ).catch((e) =>
        this.#logger.error(
          `Failed to dispatch system error after subscription failure: ${e.message}`
        )
      );
      this.stop().catch((e) =>
        this.#logger.error(
          `Error stopping manager after subscription failure: ${e.message}`
        )
      );
    }
  }

  /**
   * Unsubscribes from the turn ended event.
   *
   * @private
   */
  #unsubscribeFromTurnEnd() {
    if (this.#turnEndedUnsubscribe) {
      this.#logger.debug(`Unsubscribing from '${TURN_ENDED_ID}' event.`);
      try {
        this.#turnEndedUnsubscribe();
      } catch (error) {
        this.#logger.error(
          `Error calling unsubscribe function for ${TURN_ENDED_ID}: ${error.message}`,
          error
        );
      } finally {
        this.#turnEndedUnsubscribe = null;
      }
    } else {
      this.#logger.debug(
        'Attempted to unsubscribe from turn end event, but was not subscribed.'
      );
    }
  }

  /**
   * Handles the received TURN_ENDED_ID event.
   * Checks if it matches the current actor, **updates the round success flag**,
   * and advances the turn if appropriate.
   *
   * @param {{ type?: typeof TURN_ENDED_ID, payload: SystemEventPayloads[typeof TURN_ENDED_ID] }} event - The full event object or a simulated payload.
   * @private
   */
  #handleTurnEndedEvent(event) {
    // This method itself is not async
    if (!this.#isRunning) {
      this.#logger.debug(
        `Received '${TURN_ENDED_ID}' but manager is stopped. Ignoring.`
      );
      return;
    }

    const payload = event?.payload;
    if (!payload) {
      this.#logger.warn(
        `Received '${TURN_ENDED_ID}' event but it has no payload. Ignoring. Event:`,
        event
      );
      return;
    }

    const endedActorId = payload.entityId;
    const successStatus = payload.success;

    this.#logger.debug(
      `Received '${TURN_ENDED_ID}' event for entity ${endedActorId}. Success: ${successStatus ?? 'N/A'}. Current actor: ${this.#currentActor?.id || 'None'}`
    );

    if (!this.#currentActor || this.#currentActor.id !== endedActorId) {
      this.#logger.warn(
        `Received '${TURN_ENDED_ID}' for entity ${endedActorId}, but current active actor is ${this.#currentActor?.id || 'None'}. This event will be IGNORED by TurnManager's primary turn cycling logic.`
      );
      return;
    }

    if (successStatus === true) {
      this.#logger.debug(
        `Marking round as having had a successful turn (actor: ${endedActorId}).`
      );
      this.#roundHadSuccessfulTurn = true;
    }

    this.#logger.info(
      `Turn for current actor ${endedActorId} confirmed ended (Internal Status from Event: Success=${successStatus === undefined ? 'N/A' : successStatus}). Advancing turn...`
    );

    const handlerToDestroy = this.#currentHandler;

    this.#currentActor = null;
    this.#currentHandler = null;

    if (handlerToDestroy) {
      if (
        typeof handlerToDestroy.signalNormalApparentTermination === 'function'
      ) {
        handlerToDestroy.signalNormalApparentTermination();
      }
      if (typeof handlerToDestroy.destroy === 'function') {
        this.#logger.debug(
          `Calling destroy() on handler (${handlerToDestroy.constructor?.name || 'Unknown'}) for completed turn ${endedActorId}`
        );
        // destroy() can be async, handle its promise to catch errors
        Promise.resolve(handlerToDestroy.destroy()).catch((destroyError) =>
          this.#logger.error(
            `Error destroying handler for ${endedActorId} after turn end: ${destroyError.message}`,
            destroyError
          )
        );
      }
    }

    // Schedule advanceTurn to run after the current event processing stack clears.
    setTimeout(() => {
      // advanceTurn is async, so if we want to catch errors from it, we should.
      this.advanceTurn().catch((advanceTurnError) => {
        this.#logger.error(
          `Error during scheduled advanceTurn after turn end for ${endedActorId}: ${advanceTurnError.message}`,
          advanceTurnError
        );
        // This is a critical failure in turn advancement, dispatch system error and stop.
        this.#dispatchSystemError(
          'Critical error during scheduled turn advancement.',
          advanceTurnError
        ).catch((e) =>
          this.#logger.error(
            `Failed to dispatch system error for advanceTurn failure: ${e.message}`
          )
        );
        this.stop().catch((e) =>
          this.#logger.error(
            `Failed to stop manager after advanceTurn failure: ${e.message}`
          )
        );
      });
    }, 0);
  }

  /**
   * Helper to dispatch system errors. Extracts message from Error objects.
   *
   * @param {string} message - User-friendly message.
   * @param {string | Error} detailsOrError - Technical details string or an Error object.
   * @returns {Promise<void>}
   * @private
   */
  async #dispatchSystemError(message, detailsOrError) {
    const detailString =
      detailsOrError instanceof Error
        ? detailsOrError.message
        : String(detailsOrError);
    const stackString =
      detailsOrError instanceof Error ? detailsOrError.stack : undefined;
    try {
      await this.#dispatcher.dispatchValidated(SYSTEM_ERROR_OCCURRED_ID, {
        message: message,
        type: 'error',
        details: detailString,
        stack: stackString, // Optionally include stack
      });
    } catch (dispatchError) {
      this.#logger.error(
        `Failed to dispatch ${SYSTEM_ERROR_OCCURRED_ID}: ${dispatchError.message}`,
        dispatchError
      );
    }
  }
}

export default TurnManager;

// --- FILE END ---
