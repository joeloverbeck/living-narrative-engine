// src/turns/turnManager.js
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
  PLAYER_TYPE_COMPONENT_ID,
} from '../constants/componentIds.js';
import {
  TURN_ENDED_ID,
  SYSTEM_ERROR_OCCURRED_ID,
  TURN_PROCESSING_STARTED,
  TURN_PROCESSING_ENDED,
} from '../constants/eventIds.js';
import { ITurnManager } from './interfaces/ITurnManager.js';
import RoundManager from './roundManager.js';
import TurnCycle from './turnCycle.js';
import TurnEventSubscription from './turnEventSubscription.js';
import { RealScheduler } from '../scheduling/index.js';
import { safeDispatch } from '../utils/eventHelpers.js';
import { logStart, logEnd, logError } from '../utils/loggerUtils.js';
import { safeDispatchError } from '../utils/safeDispatchErrorUtils.js';
import { dispatchSystemErrorEvent } from '../utils/systemErrorDispatchUtils.js';

/**
 * @class TurnManager
 * @implements {ITurnManager}
 * @classdesc Manages the overall turn lifecycle. Determines the next actor,
 * initiates their turn via the appropriate handler, and waits for a turn completion
 * event (`core:turn_ended`) before advancing to the next turn or round.
 * Dispatches semantic events like 'core:turn_started' and SYSTEM_ERROR_OCCURRED_ID.
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
  /** @type {RoundManager} */
  #roundManager;
  /** @type {TurnCycle} */
  #turnCycle;
  /** @type {import('../scheduling').IScheduler} */
  #scheduler;

  /** @type {boolean} */
  #isRunning = false;
  /** @type {Entity | null} */
  #currentActor = null;
  /** @type {ITurnHandler | null} */
  #currentHandler = null;
  /** @type {import('./turnEventSubscription.js').default} */
  #eventSubscription;

  /**
   * Creates an instance of TurnManager.
   *
   * @param {object} options - The dependencies for the TurnManager.
   * @param {ITurnOrderService} options.turnOrderService - Service for managing turn order within a round.
   * @param {EntityManager} options.entityManager - Service for managing entities.
   * @param {ILogger} options.logger - Logging service.
   * @param {IValidatedEventDispatcher} options.dispatcher - Service for dispatching events AND subscribing.
   * @param {ITurnHandlerResolver} options.turnHandlerResolver - Service to resolve the correct turn handler.
   * @param {RoundManager} [options.roundManager] - Optional RoundManager instance for testing.
   * @param {import('../scheduling').IScheduler} [options.scheduler] - Scheduler implementation for timeouts.
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
      roundManager,
      scheduler = new RealScheduler(),
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
      typeof logger.warn !== 'function' ||
      typeof logger.error !== 'function'
    ) {
      const errorMsg = `${className} requires a valid ILogger instance.`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    if (
      !dispatcher ||
      typeof dispatcher.dispatch !== 'function' ||
      typeof dispatcher.subscribe !== 'function'
    ) {
      const errorMsg = `${className} requires a valid IValidatedEventDispatcher instance (with dispatch and subscribe methods).`;
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
    if (
      !scheduler ||
      typeof scheduler.setTimeout !== 'function' ||
      typeof scheduler.clearTimeout !== 'function'
    ) {
      const errorMsg = `${className} requires a valid IScheduler instance.`;
      (logger || console).error(errorMsg);
      throw new Error(errorMsg);
    }
    // --- End Dependency Validation ---

    this.#turnOrderService = turnOrderService;
    this.#entityManager = entityManager;
    this.#logger = logger;
    this.#dispatcher = dispatcher;
    this.#turnHandlerResolver = turnHandlerResolver;
    this.#roundManager =
      roundManager || new RoundManager(turnOrderService, entityManager, logger);
    this.#turnCycle = new TurnCycle(turnOrderService, logger);
    this.#scheduler = scheduler;
    this.#eventSubscription = new TurnEventSubscription(
      dispatcher,
      logger,
      scheduler
    );

    // --- State Initialization (reset flags) ---
    this.#isRunning = false;
    this.#currentActor = null;
    this.#currentHandler = null;
    // --- End State Initialization ---

    logStart(this.#logger, 'TurnManager initialized successfully.');
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
    this.#roundManager.resetFlags(); // Reset round flags on start
    logStart(this.#logger, 'Turn Manager started.');

    try {
      this.#eventSubscription.subscribe((ev) => this.#handleTurnEndedEvent(ev));
    } catch (error) {
      safeDispatchError(
        this.#dispatcher,
        `Failed to subscribe to ${TURN_ENDED_ID}. Turn advancement will likely fail.`,
        { error: error.message }
      );
      await this.#dispatchSystemError(
        `Failed to subscribe to ${TURN_ENDED_ID}. Game cannot proceed reliably.`,
        error
      );
      await this.stop();
      return;
    }
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
      this.#logger.debug(
        'TurnManager.stop() called but manager is already stopped.'
      );
      return;
    }
    this.#isRunning = false;
    this.#eventSubscription.unsubscribe();

    if (
      this.#currentHandler &&
      typeof this.#currentHandler.destroy === 'function'
    ) {
      try {
        logStart(
          this.#logger,
          `Calling destroy() on current handler (${this.#currentHandler.constructor?.name || 'Unknown'}) for actor ${this.#currentActor?.id || 'N/A'}`
        );
        await Promise.resolve(this.#currentHandler.destroy());
      } catch (destroyError) {
        logError(
          this.#logger,
          'Error calling destroy() on current handler during stop',
          destroyError
        );
      }
    }

    this.#currentActor = null;
    this.#currentHandler = null;

    try {
      await this.#turnCycle.clear();
      this.#logger.debug('Turn order service current round cleared.');
    } catch (error) {
      safeDispatchError(
        this.#dispatcher,
        'Error clearing turn order service during stop',
        { error: error.message }
      );
    }
    logEnd(this.#logger, 'Turn Manager stopped.');
  }

  /**
   * Retrieves the entity instance whose turn it is currently.
   *
   * @returns {Entity | null} The entity currently taking its turn, or `null`.
   */
  getCurrentActor() {
    const actor = this.#currentActor;
    console.log('TurnManager.getCurrentActor: currentActor =', actor?.id);
    return actor;
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
   * Handles system-level errors by dispatching SYSTEM_ERROR_OCCURRED_ID.
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

    logStart(this.#logger, 'TurnManager.advanceTurn() initiating...');
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
      const nextEntity = await this.#turnCycle.nextActor();
      console.log('TurnManager.advanceTurn: nextActor =', nextEntity?.id);

      if (!nextEntity) {
        // TurnCycle.nextActor() returns null only when the queue is empty
        // (TurnCycle calls isEmpty() first, then getNextEntity() only if not empty)
        this.#logger.debug(
          'Turn queue is empty. Preparing for new round or stopping.'
        );

        // --- NEW CHECK: Stop if previous round had no success ---
        if (this.#roundManager.inProgress && !this.#roundManager.hadSuccess) {
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

        // --- Start new round using RoundManager ---
        this.#logger.debug('Attempting to start a new round.');
        try {
          await this.#roundManager.startRound();
          this.#logger.debug(
            'New round started, recursively calling advanceTurn() to process the first turn.'
          );
          await this.advanceTurn(); // Recursive call to process the first turn of the new round
          return;
        } catch (roundError) {
          // Restore original error handling for test compatibility
          safeDispatchError(
            this.#dispatcher,
            'Critical error during turn advancement logic',
            { error: roundError.message }
          );
          await this.#dispatchSystemError(
            'System Error: No active actors found to start a round. Stopping game.',
            roundError.message
          );
          await this.stop();
          return;
        }
        // --- End Start new round ---
      } else {
        // Queue is not empty, process next turn
        this.#logger.debug('Queue not empty, processing next entity.');

        this.#currentActor = nextEntity; // Set the new current actor
        const actorId = this.#currentActor.id;
        const isActor = this.#currentActor.hasComponent(ACTOR_COMPONENT_ID);

        // Determine entity type using new player_type component
        let entityType = 'ai'; // default
        if (this.#currentActor.hasComponent(PLAYER_TYPE_COMPONENT_ID)) {
          const playerTypeData = this.#currentActor.getComponentData(
            PLAYER_TYPE_COMPONENT_ID
          );
          entityType = playerTypeData?.type === 'human' ? 'player' : 'ai';
        } else if (this.#currentActor.hasComponent(PLAYER_COMPONENT_ID)) {
          // Fallback to old player component for backward compatibility
          entityType = 'player';
        }

        if (!isActor) {
          this.#logger.warn(
            `Entity ${actorId} is not an actor. Skipping turn advancement for this entity.`
          );
          this.#currentActor = null; // Clear current actor for non-actor entities
          return;
        }

        this.#logger.debug(
          `>>> Starting turn initiation for Entity: ${actorId} (${entityType}) <<<`
        );
        await safeDispatch(
          this.#dispatcher,
          'core:turn_started',
          {
            entityId: actorId,
            entityType: entityType,
            entity: this.#currentActor, // Include full entity for component access
          },
          this.#logger
        );

        await safeDispatch(
          this.#dispatcher,
          TURN_PROCESSING_STARTED,
          {
            entityId: actorId,
            actorType: entityType,
          },
          this.#logger
        );

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

        console.log(
          'TurnManager: handler =',
          handler,
          'handler.startTurn =',
          typeof handler?.startTurn
        );
        handler.startTurn(this.#currentActor).catch((startTurnError) => {
          const errorMsg = `Error during handler.startTurn() initiation for entity ${actorId} (${handlerName}): ${startTurnError.message}`;
          safeDispatchError(
            this.#dispatcher,
            `Error initiating turn for ${actorId}`,
            { error: startTurnError.message, handlerName }
          );
          this.#dispatchSystemError(
            `Error initiating turn for ${actorId}.`,
            startTurnError
          ).catch((e) =>
            logError(
              this.#logger,
              'Failed to dispatch system error after startTurn failure',
              e
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
      safeDispatchError(
        this.#dispatcher,
        'System Error during turn advancement',
        { error: error.message }
      );
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
      this.#roundManager.endTurn(true);
    }

    const currentActor = this.#currentActor;
    const endedIsPlayer = currentActor?.hasComponent(PLAYER_COMPONENT_ID);

    const actorType = endedIsPlayer ? 'player' : 'ai';
    this.#dispatcher
      .dispatch(TURN_PROCESSING_ENDED, {
        entityId: endedActorId,
        actorType,
      })
      .catch((dispatchError) =>
        safeDispatchError(
          this.#dispatcher,
          `Failed to dispatch ${TURN_PROCESSING_ENDED} for ${endedActorId}`,
          { error: dispatchError.message }
        )
      );

    this.#logger.debug(
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
        logStart(
          this.#logger,
          `Calling destroy() on handler (${handlerToDestroy.constructor?.name || 'Unknown'}) for completed turn ${endedActorId}`
        );
        // destroy() can be async, handle its promise to catch errors
        Promise.resolve(handlerToDestroy.destroy()).catch((destroyError) =>
          logError(
            this.#logger,
            `Error destroying handler for ${endedActorId} after turn end`,
            destroyError
          )
        );
      }
    }

    // Advance the turn asynchronously via the subscription's scheduler.
    this.advanceTurn().catch((advanceTurnError) => {
      safeDispatchError(
        this.#dispatcher,
        'Error during scheduled turn advancement',
        { error: advanceTurnError.message, entityId: endedActorId }
      );
      // This is a critical failure in turn advancement, dispatch system error and stop.
      this.#dispatchSystemError(
        'Critical error during scheduled turn advancement.',
        advanceTurnError
      ).catch((e) =>
        logError(
          this.#logger,
          'Failed to dispatch system error for advanceTurn failure',
          e
        )
      );
      this.stop().catch((e) =>
        this.#logger.error(
          `Failed to stop manager after advanceTurn failure: ${e.message}`
        )
      );
    });
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
      detailsOrError instanceof Error
        ? detailsOrError.stack
        : new Error().stack;

    await dispatchSystemErrorEvent(
      this.#dispatcher,
      message,
      {
        raw: detailString,
        stack: stackString,
        timestamp: new Date().toISOString(),
      },
      this.#logger
    );
  }
}

export default TurnManager;

// --- FILE END ---
