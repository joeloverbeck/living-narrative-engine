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

const HUMAN_PLAYER_TYPE = 'human';

/**
 * Determines whether a player_type component describes a human-controlled actor.
 *
 * @param {{ type?: unknown } | null | undefined} playerTypeData - Raw player_type component payload.
 * @returns {boolean} True when the component denotes a human player.
 */
function isHumanPlayerType(playerTypeData) {
  if (!playerTypeData || typeof playerTypeData.type !== 'string') {
    return false;
  }

  return playerTypeData.type.trim().toLowerCase() === HUMAN_PLAYER_TYPE;
}

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

  /** @type {boolean} */
  #isRunning = false;
  /** @type {Entity | null} */
  #currentActor = null;
  /** @type {ITurnHandler | null} */
  #currentHandler = null;
  /** @type {import('./turnEventSubscription.js').default} */
  #eventSubscription;
  /** @type {import('../scheduling').IScheduler} */
  #scheduler;
  /** @type {import('../events/eventBus.js').default | null} */
  #eventBus = null;

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
      eventBus = null,
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

    this.#logger = logger;
    this.#dispatcher = dispatcher;
    this.#turnHandlerResolver = turnHandlerResolver;
    this.#scheduler = scheduler;
    this.#roundManager =
      roundManager ||
      new RoundManager(turnOrderService, entityManager, logger, dispatcher);
    this.#turnCycle = new TurnCycle(turnOrderService, entityManager, logger);
    this.#eventSubscription = new TurnEventSubscription(
      dispatcher,
      logger,
      scheduler
    );
    this.#eventBus = eventBus;

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

    this.#roundManager.resetFlags();
    logEnd(this.#logger, 'Turn Manager stopped.');
  }

  /**
   * Retrieves the entity instance whose turn it is currently.
   *
   * @returns {Entity | null} The entity currently taking its turn, or `null`.
   */
  getCurrentActor() {
    const actor = this.#currentActor;
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
      const skippedNonActorIds = new Set();

      while (this.#isRunning) {
        const nextEntity = await this.#turnCycle.nextActor();

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
        }

        const actorId = nextEntity?.id ?? 'unknown';
        const hasActorComponent =
          typeof nextEntity?.hasComponent === 'function' &&
          nextEntity.hasComponent(ACTOR_COMPONENT_ID);

        if (!hasActorComponent) {
          this.#logger.warn(
            `Entity ${actorId} is not an actor. Skipping turn advancement for this entity.`
          );

          if (actorId !== 'unknown') {
            if (skippedNonActorIds.has(actorId)) {
              const repeatedEntityMessage =
                `Entity ${actorId} reappeared without an actor component while advancing turns. Stopping turn manager to avoid infinite loop.`;

              this.#logger.error(repeatedEntityMessage);

              safeDispatchError(
                this.#dispatcher,
                'TurnManager encountered a non-actor entity twice while advancing turns. Stopping turn processing to avoid an infinite loop.',
                { entityId: actorId },
                this.#logger
              );

              await this.#dispatchSystemError(
                'System Error: Invalid turn queue entity encountered. Stopping game.',
                repeatedEntityMessage
              );

              await this.stop();
              return;
            }
            skippedNonActorIds.add(actorId);
          }

          // Try the next entity in the queue
          continue;
        }

        // Queue is not empty and we have a valid actor
        this.#logger.debug('Queue not empty, processing next entity.');
        this.#currentActor = nextEntity;
        break;
      }

      if (!this.#isRunning || !this.#currentActor) {
        return;
      }

      const actorId = this.#currentActor.id;

      // Determine entity type using new player_type component
      let entityType = 'ai'; // default
      if (this.#currentActor.hasComponent(PLAYER_TYPE_COMPONENT_ID)) {
        const playerTypeData = this.#currentActor.getComponentData(
          PLAYER_TYPE_COMPONENT_ID
        );
        entityType = isHumanPlayerType(playerTypeData) ? 'player' : 'ai';
      } else if (this.#currentActor.hasComponent(PLAYER_COMPONENT_ID)) {
        // Fallback to old player component for backward compatibility
        entityType = 'player';
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
        this.#handleTurnEndedEvent(
          {
            // This will schedule advanceTurn via its own logic
            type: TURN_ENDED_ID,
            payload: {
              entityId: actorId,
              success: false,
              error: new Error(
                `No turn handler resolved for actor ${actorId}.`
              ),
            },
          },
          { scheduleAdvance: true }
        );
        return;
      }

      const handlerName = handler.constructor?.name || 'resolved handler';
      this.#logger.debug(
        `Calling startTurn on ${handlerName} for entity ${actorId}`
      );

      // Await the startTurn to properly handle errors
      try {
        await handler.startTurn(this.#currentActor);
      } catch (startTurnError) {
        const errorMsg = `Error during handler.startTurn() initiation for entity ${actorId} (${handlerName}): ${startTurnError.message}`;
        safeDispatchError(
          this.#dispatcher,
          `Error initiating turn for ${actorId}`,
          { error: startTurnError.message, handlerName }
        );

        await this.#dispatchSystemError(
          `Error initiating turn for ${actorId}.`,
          startTurnError
        );

        // Always handle turn end for startTurn failures
        this.#logger.warn(
          `Manually handling turn end after startTurn initiation failure for ${actorId}.`
        );
        this.#handleTurnEndedEvent(
          {
            type: TURN_ENDED_ID,
            payload: {
              entityId: actorId,
              success: false,
              error: startTurnError,
            },
          },
          { scheduleAdvance: false }
        );
        return; // Exit early on error
      }
      this.#logger.debug(
        `Turn initiation for ${actorId} started via ${handlerName}. TurnManager now WAITING for '${TURN_ENDED_ID}' event.`
      );
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
   * Note: This method is async to properly await handler destruction before
   * scheduling the next turn advance. This prevents race conditions where
   * the handler's state machine is still running when destruction is called.
   *
   * @param {{ type?: typeof TURN_ENDED_ID, payload: SystemEventPayloads[typeof TURN_ENDED_ID] }} event - The full event object or a simulated payload.
   * @param {{ scheduleAdvance?: boolean }} [options] - Behaviour overrides for post-processing.
   * @private
   */
  async #handleTurnEndedEvent(event, options = {}) {
    const { scheduleAdvance = true } = options;
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

    const successStatus = payload.success;
    let endedActorId = payload.entityId;

    if (typeof endedActorId === 'string') {
      const originalEntityId = endedActorId;
      const trimmedEntityId = originalEntityId.trim();

      if (trimmedEntityId.length === 0) {
        this.#logger.warn(
          `Received '${TURN_ENDED_ID}' event with an entityId comprised only of whitespace. Treating the id as missing.`,
          { originalEntityId }
        );
        endedActorId = '';
      } else if (trimmedEntityId !== originalEntityId) {
        this.#logger.warn(
          `Received '${TURN_ENDED_ID}' event for entity id '${originalEntityId}' with surrounding whitespace. Normalising to '${trimmedEntityId}'.`
        );
        endedActorId = trimmedEntityId;
      } else {
        endedActorId = trimmedEntityId;
      }
    }

    if (!endedActorId) {
      if (!this.#currentActor) {
        this.#logger.warn(
          `Received '${TURN_ENDED_ID}' event without an entityId and no active actor. Ignoring.`,
          event
        );
        return;
      }

      endedActorId = this.#currentActor.id;
      this.#logger.warn(
        `Received '${TURN_ENDED_ID}' event without an entityId. Assuming current actor ${endedActorId} for compatibility.`,
        event
      );
    }

    this.#logger.debug(
      `Received '${TURN_ENDED_ID}' event for entity ${endedActorId}. Success: ${successStatus ?? 'N/A'}. Current actor: ${this.#currentActor?.id || 'None'}`
    );

    if (!this.#currentActor || this.#currentActor.id !== endedActorId) {
      this.#logger.warn(
        `Received '${TURN_ENDED_ID}' for entity ${endedActorId}, but current active actor is ${this.#currentActor?.id || 'None'}. This event will be IGNORED by TurnManager's primary turn cycling logic.`
      );
      return;
    }

    const interpretedSuccess = this.#interpretTurnSuccess(
      successStatus,
      endedActorId
    );

    if (interpretedSuccess) {
      this.#logger.debug(
        `Marking round as having had a successful turn (actor: ${endedActorId}).`
      );
      this.#roundManager.endTurn(true);
    }

    const currentActor = this.#currentActor;

    let actorType = 'ai';
    if (currentActor?.hasComponent(PLAYER_TYPE_COMPONENT_ID)) {
      const playerTypeData = currentActor.getComponentData(
        PLAYER_TYPE_COMPONENT_ID
      );
      actorType = isHumanPlayerType(playerTypeData) ? 'player' : 'ai';
    } else if (currentActor?.hasComponent(PLAYER_COMPONENT_ID)) {
      actorType = 'player';
    }
    const reportProcessingEndedFailure = (details) => {
      safeDispatchError(
        this.#dispatcher,
        `Failed to dispatch ${TURN_PROCESSING_ENDED} for ${endedActorId}`,
        {
          entityId: endedActorId,
          actorType,
          ...details,
        }
      ).catch((error) =>
        logError(
          this.#logger,
          `Failed to dispatch system error after ${TURN_PROCESSING_ENDED} failure for ${endedActorId}`,
          error
        )
      );
    };

    let processingDispatchPromise;
    try {
      processingDispatchPromise = Promise.resolve(
        this.#dispatcher.dispatch(TURN_PROCESSING_ENDED, {
          entityId: endedActorId,
          actorType,
        })
      );
    } catch (dispatchError) {
      processingDispatchPromise = Promise.reject(dispatchError);
    }

    const advanceTurnSafely = () => {
      this.advanceTurn().catch(async (advanceTurnError) => {
        safeDispatchError(
          this.#dispatcher,
          'Error during scheduled turn advancement',
          { error: advanceTurnError.message, entityId: endedActorId }
        );
        // This is a critical failure in turn advancement, dispatch system error and stop.
        try {
          await this.#dispatchSystemError(
            'Critical error during scheduled turn advancement.',
            advanceTurnError
          );
        } catch (e) {
          logError(
            this.#logger,
            'Failed to dispatch system error for advanceTurn failure',
            e
          );
        }

        try {
          await this.stop();
        } catch (e) {
          this.#logger.error(
            `Failed to stop manager after advanceTurn failure: ${e.message}`
          );
        }
      });
    };

    const scheduleAdvanceTurn = () => {
      if (!this.#isRunning) {
        this.#logger.debug(
          `Skipping scheduled turn advancement for ${endedActorId} because the manager stopped before processing completed.`
        );
        return;
      }

      if (!scheduleAdvance) {
        advanceTurnSafely();
        return;
      }

      this.#scheduler.setTimeout(() => {
        advanceTurnSafely();
      }, 0);
    };

    this.#logger.debug(
      `Turn for current actor ${endedActorId} confirmed ended (Internal Status from Event: Success=${successStatus === undefined ? 'N/A' : successStatus}). Proceeding with cleanup and turn advancement...`
    );

    // CRITICAL: Destroy handler BEFORE scheduling advanceTurn to prevent race condition
    // where the handler's state machine is still running when destruction is called.
    // The previous fire-and-forget pattern caused "Handler destroyed while in TurnEndingState" errors.
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
        // AWAIT destruction to ensure handler state machine completes before advancing
        try {
          await handlerToDestroy.destroy();
        } catch (destroyError) {
          logError(
            this.#logger,
            `Error destroying handler for ${endedActorId} after turn end`,
            destroyError
          );
        }
      }
    }

    // Reset recursion counters after turn completes to prevent false warnings
    // across separate turns separated by time
    if (this.#eventBus && typeof this.#eventBus.resetRecursionCounters === 'function') {
      this.#eventBus.resetRecursionCounters();
    }

    // Now dispatch TURN_PROCESSING_ENDED and schedule advanceTurn AFTER handler destruction is complete
    processingDispatchPromise = processingDispatchPromise
      .then((dispatchResult) => {
        if (dispatchResult === false) {
          this.#logger.warn(
            `${TURN_PROCESSING_ENDED} dispatch was rejected by dispatcher for ${endedActorId}.`,
            { actorType }
          );
          reportProcessingEndedFailure({
            error: 'Dispatcher rejected event',
          });
        } else if (dispatchResult !== true && dispatchResult !== undefined) {
          this.#logger.warn(
            `${TURN_PROCESSING_ENDED} dispatch returned unexpected result: ${dispatchResult}`,
            { entityId: endedActorId, actorType }
          );
        }
      })
      .catch((dispatchError) =>
        reportProcessingEndedFailure({
          error: dispatchError?.message || 'Unknown dispatcher error',
          stack: dispatchError?.stack,
        })
      )
      .then(() => {
        scheduleAdvanceTurn();
      });
  }

  /**
   * Normalises the {@link TURN_ENDED_ID} payload's success flag for backward compatibility.
   *
   * @param {unknown} rawSuccess - The raw success value from the event payload.
   * @param {string} actorId - The actor id associated with the event for logging context.
   * @returns {boolean} `true` when the turn should be treated as successful.
   */
  #interpretTurnSuccess(rawSuccess, actorId) {
    if (rawSuccess === true || rawSuccess === false) {
      return rawSuccess;
    }

    if (rawSuccess === undefined) {
      this.#logger.warn(
        `Received '${TURN_ENDED_ID}' event for ${actorId} without a success flag. Assuming success=true for compatibility with legacy emitters.`
      );
      return true;
    }

    if (typeof rawSuccess === 'string') {
      const normalised = rawSuccess.trim().toLowerCase();

      if (normalised === 'true') {
        this.#logger.warn(
          `Received '${TURN_ENDED_ID}' event for ${actorId} with a string success flag ("${rawSuccess}"). Interpreting as success=true for compatibility with legacy emitters.`,
          { receivedType: 'string' }
        );
        return true;
      }

      if (normalised === 'false') {
        this.#logger.warn(
          `Received '${TURN_ENDED_ID}' event for ${actorId} with a string success flag ("${rawSuccess}"). Interpreting as success=false for compatibility with legacy emitters.`,
          { receivedType: 'string' }
        );
        return false;
      }

      this.#logger.warn(
        `Received '${TURN_ENDED_ID}' event for ${actorId} with an unrecognised string success flag ("${rawSuccess}"). Treating as success=false.`,
        { receivedType: 'string' }
      );
      return false;
    }

    if (typeof rawSuccess === 'number') {
      if (rawSuccess === 1) {
        this.#logger.warn(
          `Received '${TURN_ENDED_ID}' event for ${actorId} with numeric success flag (1). Interpreting as success=true for compatibility with legacy emitters.`,
          { receivedType: 'number' }
        );
        return true;
      }

      if (rawSuccess === 0) {
        this.#logger.warn(
          `Received '${TURN_ENDED_ID}' event for ${actorId} with numeric success flag (0). Interpreting as success=false for compatibility with legacy emitters.`,
          { receivedType: 'number' }
        );
        return false;
      }
    }

    this.#logger.warn(
      `Received '${TURN_ENDED_ID}' event for ${actorId} with an unsupported success flag type (${typeof rawSuccess}). Treating as success=false.`,
      { receivedType: typeof rawSuccess }
    );
    return false;
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

    await safeDispatchError(
      this.#dispatcher,
      message,
      {
        error: detailString,
        stack: stackString,
        timestamp: new Date().toISOString(),
      },
      this.#logger
    );
  }
}

export default TurnManager;

// --- FILE END ---
