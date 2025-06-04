// src/core/turnStates/awaitingExternalTurnEndState.js
// --- FILE START ---

/**
 * @typedef {import('../handlers/baseTurnHandler.js').BaseTurnHandler} BaseTurnHandler
 * @typedef {import('../../entities/entity.js').default} Entity
 * @typedef {import('../interfaces/ITurnState.js').ITurnState} ITurnState_Interface
 * @typedef {import('./abstractTurnState.js').AbstractTurnState} AbstractTurnState_Base
 * @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 * @typedef {import('../../constants/eventIds.js').SystemEventPayloads} SystemEventPayloads
 * @typedef {import('../../constants/eventIds.js').TURN_ENDED_ID} TURN_ENDED_ID_TYPE
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 */

import { AbstractTurnState } from './abstractTurnState.js';
import { TurnIdleState } from './turnIdleState.js'; // For error recovery if context is missing
import { TURN_ENDED_ID } from '../../constants/eventIds.js'; // Constant import
// Eagerly import PlayerTurnHandler for type checking if needed, or define an interface for isTerminatingNormally
// For now, we'll rely on a property check or a method on BaseTurnHandler if we introduce it.
// import PlayerTurnHandler from '../handlers/playerTurnHandler.js';

/**
 * @class AwaitingExternalTurnEndState
 * @augments AbstractTurnState_Base
 * @implements {ITurnState_Interface}
 * @description
 * Entered when the system must wait for an external `core:turn_ended` event.
 * This state relies exclusively on ITurnContext for all its operations,
 * including event subscription, managing awaiting status, and ending the turn.
 */
export class AwaitingExternalTurnEndState extends AbstractTurnState {
     * @private
  #unsubscribeTurnEndedFn;

  /**
   * @param {BaseTurnHandler} handler
   */
  constructor(handler) {
    super(handler);
    this.#unsubscribeTurnEndedFn = undefined;
  }

  /** @override */
  getStateName() {
    return 'AwaitingExternalTurnEndState';
  }

  /**
   * @override
   * @param {BaseTurnHandler} handler
   * @param {ITurnState_Interface} [previousState]
   */
  async enterState(handler, previousState) {
    const turnCtx = this._getTurnContext();
    await super.enterState(handler, previousState); // Handles initial logging

    if (!turnCtx) {
      const fallbackLogger = handler.getLogger();
      fallbackLogger.error(
        `${this.getStateName()}: Critical - ITurnContext not available on entry. Transitioning to Idle.`
      );
      handler._resetTurnStateAndResources(
        `critical-entry-no-context-${this.getStateName()}`
      );
      await handler._transitionToState(new TurnIdleState(handler));
      return;
    }

    const logger = turnCtx.getLogger();
    const actor = turnCtx.getActor();

    if (!actor) {
      logger.error(
        `${this.getStateName()}: No actor in ITurnContext. Ending turn.`
      );
      try {
        turnCtx.endTurn(
          new Error(
            `${this.getStateName()}: No actor in ITurnContext on entry.`
          )
        );
      } catch (e) {
        logger.error(
          `${this.getStateName()}: Error calling turnCtx.endTurn due to no actor: ${e.message}`,
          e
        );
        handler._resetTurnStateAndResources(
          `critical-entry-no-actor-endturn-failed-${this.getStateName()}`
        );
        await handler._transitionToState(new TurnIdleState(handler));
      }
      return;
    }
    const actorId = actor.id;

    try {
      logger.debug(
        `${this.getStateName()}: Calling turnCtx.setAwaitingExternalEvent(true, ${actorId}).`
      );
      turnCtx.setAwaitingExternalEvent(true, actorId);
      logger.debug(
        `${this.getStateName()}: Successfully marked actor ${actorId} as awaiting external event via ITurnContext.`
      );

      logger.debug(
        `${this.getStateName()}: Subscribing to ${TURN_ENDED_ID} events for actor ${actorId} via SubscriptionLifecycleManager.`
      );
      const subMan = turnCtx.getSubscriptionManager();
      const returnedUnsubscribeFn = subMan.subscribeToTurnEnded(
        /** @param {SystemEventPayloads[TURN_ENDED_ID_TYPE]} payload */
        (payload) => this.handleTurnEndedEvent(handler, payload)
      );

      if (typeof returnedUnsubscribeFn === 'function') {
        this.#unsubscribeTurnEndedFn = returnedUnsubscribeFn; // Store the token
        logger.info(
          `${this.getStateName()}: Successfully initiated subscription via SubscriptionLifecycleManager – awaiting ${TURN_ENDED_ID} for actor ${actorId}.`
        );
      } else {
        // SubscriptionLifecycleManager.subscribeToTurnEnded itself should log if the underlying subscription fails.
        // This state just notes that it didn't receive a valid token, implying the managed subscription might not be active.
        logger.warn(
          `${this.getStateName()}: SubscriptionLifecycleManager.subscribeToTurnEnded did not return an unsubscribe function for ${actorId}. The subscription might not be active as expected.`
        );
        this.#unsubscribeTurnEndedFn = undefined; // Ensure it's falsy
      }
    } catch (error) {
      logger.error(
        `${this.getStateName()}: Error during enterState setup for actor ${actorId}: ${error.message}`,
        error
      );
      try {
        if (turnCtx.isAwaitingExternalEvent()) {
          logger.debug(
            `${this.getStateName()}: Attempting to clear awaiting flag for ${actorId} due to setup error.`
          );
          turnCtx.setAwaitingExternalEvent(false, actorId);
        }
      } catch (clearFlagError) {
        logger.error(
          `${this.getStateName()}: Failed to clear awaiting flag for ${actorId} during error recovery: ${clearFlagError.message}`,
          clearFlagError
        );
      }
      if (turnCtx && typeof turnCtx.endTurn === 'function') {
        turnCtx.endTurn(error);
      } else {
        logger.error(
          `${this.getStateName()}: Cannot end turn during setup error for ${actorId} as ITurnContext became invalid.`
        );
        handler._resetTurnStateAndResources(
          `critical-setup-error-no-context-${actorId}`
        );
        await handler._transitionToState(new TurnIdleState(handler));
      }
    }
  }

  /**
   * @override
   * @param {BaseTurnHandler} handler
   * @param {ITurnState_Interface} [nextState]
   */
  async exitState(handler, nextState) {
    const turnCtx = this._getTurnContext();
    // Logger from context if available, else handler's logger.
    const logger = turnCtx ? turnCtx.getLogger() : handler.getLogger();
    const actorForLog = turnCtx?.getActor() ?? handler.getCurrentActor(); // Try handler's current actor as fallback
    const actorIdForLog = actorForLog?.id ?? 'N/A_on_exit';

    logger.debug(
      `${this.getStateName()}: Exiting state for actor ${actorIdForLog}. Next state: ${nextState?.getStateName() ?? 'None'}.`
    );

    // 1. Unsubscribe from the core:turn_ended event.
    // This is crucial to prevent this state instance from reacting after it's exited.
    await this.#performUnsubscribe(
      logger,
      `exitState-for-${actorIdForLog}-to-${nextState?.getStateName() ?? 'None'}`
    );

    // 2. Clear the awaiting flag via ITurnContext if still set.
    // This is important if exiting due to destruction or an unexpected transition
    // and the normal handleTurnEndedEvent path wasn't taken.
    // The modified BaseTurnHandler.destroy() defers context clearing, so turnCtx should be available here
    // if exiting as part of a destroy sequence.
    if (
      turnCtx &&
      typeof turnCtx.isAwaitingExternalEvent === 'function' &&
      typeof turnCtx.setAwaitingExternalEvent === 'function'
    ) {
      try {
        if (turnCtx.isAwaitingExternalEvent()) {
          const currentActorInCtx = turnCtx.getActor();
          const actorIdToClear = currentActorInCtx?.id ?? actorIdForLog; // Best effort
          logger.debug(
            `${this.getStateName()}: Clearing awaiting external event flag for actor ${actorIdToClear} on exit via ITurnContext.`
          );
          turnCtx.setAwaitingExternalEvent(false, actorIdToClear);
        } else {
          const currentActorInCtx = turnCtx.getActor();
          const actorIdToCheck = currentActorInCtx?.id ?? actorIdForLog;
          logger.debug(
            `${this.getStateName()}: Awaiting external event flag was already false for actor ${actorIdToCheck} on exit.`
          );
        }
      } catch (flagErr) {
        const actorIdInError = turnCtx.getActor()?.id ?? actorIdForLog;
        logger.warn(
          `${this.getStateName()}: Failed to clear awaiting external event flag for ${actorIdInError} on exit: ${flagErr.message}`,
          flagErr
        );
      }
    } else if (!turnCtx && handler._isDestroyed) {
      // If context is null AND handler is being destroyed, this is expected with the reordered BaseTurnHandler.destroy().
      // However, with the reorder, turnCtx *should* be available here. This is a fallback.
      logger.debug(
        `${this.getStateName()}: ITurnContext not available on exit for actor ${actorIdForLog} during handler destruction. Flag clearing might have been handled by state.destroy or is no longer possible.`
      );
    } else if (!turnCtx) {
      // Context is null, and it's not (known to be) during handler destruction. This is more unusual.
      logger.warn(
        `${this.getStateName()}: ITurnContext not available on exit for actor ${actorIdForLog}. Cannot clear awaiting flag via context.`
      );
    }

    await super.exitState(handler, nextState); // Handles logging using the (now potentially cleared if not destroy path) context
  }

  /**
   * @override
   * @param {BaseTurnHandler} handler
   * @param {SystemEventPayloads[TURN_ENDED_ID_TYPE]} payload
   */
  async handleTurnEndedEvent(handler, payload) {
    const turnCtx = this._getTurnContext();

    if (!turnCtx) {
      const fallbackLogger = handler.getLogger();
      fallbackLogger.warn(
        `${this.getStateName()}: ${TURN_ENDED_ID} received, but no active ITurnContext. Payload for ${payload?.entityId}. Instance ${this._instanceId || 'N/A'} ignoring and cleaning up.`
      );
      await this.#performUnsubscribe(
        fallbackLogger,
        `no-context-on-event-for-${payload?.entityId}`
      );
      return;
    }

    const logger = turnCtx.getLogger();
    const currentActorInContext = turnCtx.getActor(); // Actor from ITurnContext

    if (!currentActorInContext) {
      logger.warn(
        `${this.getStateName()}: ${TURN_ENDED_ID} received for payload actor ${payload?.entityId}, but no actor in current ITurnContext. Instance ${this._instanceId || 'N/A'} cleaning up subscription and ignoring.`
      );
      await this.#performUnsubscribe(
        logger,
        `no-actor-in-context-for-payload-${payload?.entityId}`
      );
      // Cannot meaningfully end a turn if context has no actor.
      return;
    }

    const waitingActorId = currentActorInContext.id;
    const payloadActorId = payload?.entityId;
    const payloadError = payload?.error;

    logger.debug(
      `${this.getStateName()}: Received ${TURN_ENDED_ID}. Waiting for: ${waitingActorId}, Event for: ${payloadActorId}. Error in payload: ${payloadError ? payloadError.message : 'null'}.`
    );

    // 1. Verify the handler still expects this event for the current actor.
    if (!turnCtx.isAwaitingExternalEvent()) {
      logger.warn(
        `${this.getStateName()}: ${TURN_ENDED_ID} for ${payloadActorId} (context actor ${waitingActorId}) received, but ITurnContext is no longer awaiting an external event. May have been handled, timed out, or state exited/destroyed. Cleaning up subscription.`
      );
      await this.#performUnsubscribe(
        logger,
        `not-awaiting-event-for-${payloadActorId}`
      );
      return;
    }

    // 2. Verify the received event is for the correct actor.
    if (payloadActorId !== waitingActorId) {
      logger.debug(
        `${this.getStateName()}: ${TURN_ENDED_ID} for ${payloadActorId} ignored; current context actor is ${waitingActorId}.`
      );
      return;
    }

    // Conditions met: Event is for the correct actor, and the context is still awaiting.
    logger.info(
      `${this.getStateName()}: Matched ${TURN_ENDED_ID} for actor ${payloadActorId}. Ending turn via ITurnContext.`
    );
    const errorForTurnEnd =
      payloadError instanceof Error
        ? payloadError
        : payloadError
          ? new Error(String(payloadError))
          : null;

    // Unsubscription and clearing of awaiting flag will happen as part of exitState,
    // which will be triggered by the state transition initiated by endTurn().
    // No need to call #performUnsubscribe or setAwaitingExternalEvent(false) here directly
    // if the state transition path correctly calls exitState.
    try {
      turnCtx.endTurn(errorForTurnEnd); // This will trigger the handler's _handleTurnEnd, leading to state transition.
    } catch (e) {
      logger.error(
        `${this.getStateName()}: Error calling turnCtx.endTurn for actor ${payloadActorId}: ${e.message}`,
        e
      );
      // If endTurn itself fails, we're in a bad spot.
      // Attempt to clean up this state's subscription at least.
      await this.#performUnsubscribe(
        logger,
        `endTurn-failed-for-${payloadActorId}`
      );
      // The handler might need to be reset by a higher-level mechanism.
      // We could also try to force a transition to Idle directly on the handler if we know this state is stuck.
      // This might involve handler._resetTurnStateAndResources() and handler._transitionToState(new TurnIdleState(handler))
      // but that's aggressive for a state to do to its handler.
    }
  }

  /**
   * Helper to unsubscribe if needed, e.g. in error paths or unexpected situations.
   * @private
   * @param {ILogger} logger
   * @param {string} reasonForLog
   */
  async #performUnsubscribe(logger, reasonForLog) {
    if (this.#unsubscribeTurnEndedFn) {
      // Check if this state instance believes it has an active subscription token
      const turnCtx = this._getTurnContext();
      if (turnCtx) {
        try {
          const subMan = turnCtx.getSubscriptionManager();
          logger.debug(
            `${this.getStateName()}: Requesting unsubscription from ${TURN_ENDED_ID} via SubscriptionLifecycleManager due to: ${reasonForLog}.`
          );
          subMan.unsubscribeFromTurnEnded(); // Manager handles actual unsubscription and flag clearing
        } catch (e) {
          logger.error(
            `${this.getStateName()}: Error obtaining/using SubscriptionManager to unsubscribe for ${TURN_ENDED_ID}: ${e.message}`,
            e
          );
        }
      } else {
        logger.warn(
          `${this.getStateName()}: Cannot notify SubscriptionLifecycleManager to unsubscribe from ${TURN_ENDED_ID}. No ITurnContext available (reason: ${reasonForLog}).`
        );
      }
      this.#unsubscribeTurnEndedFn = undefined; // Clear the token for this state instance
    } else {
      logger.debug(
        `${this.getStateName()}: Unsubscribe call for ${TURN_ENDED_ID} (reason: ${reasonForLog}), but no active unsubscribe token found or already cleared for this state instance.`
      );
    }
  }

  /**
   * @override
   * @param {BaseTurnHandler} handler
   * @param {string} commandString
   * @param {Entity} actorEntityFromSubscriptionCallback - Actor who submitted command (passed by caller like AwaitingPlayerInputState)
   */
  async handleSubmittedCommand(
    handler,
    commandString,
    actorEntityFromSubscriptionCallback
  ) {
    const turnCtx = this._getTurnContext();

    if (!turnCtx) {
      const fallbackLogger = handler.getLogger();
      const msg = `${this.getStateName()}: Unexpected command "${commandString}" from ${actorEntityFromSubscriptionCallback?.id} received, but no ITurnContext. Ending turn for an unknown actor if possible.`;
      fallbackLogger.error(msg);
      // Cannot call turnCtx.endTurn(). Handler must try to recover.
      // This situation implies a severe issue. The handler might reset.
      // For now, log and potentially the handler itself will reset if this state remains.
      // If this state is active, _handleTurnEnd should be called on handler.
      // This will call PlayerTurnHandler._handleTurnEnd
      handler._handleTurnEnd(
        actorEntityFromSubscriptionCallback?.id ||
          `unknown-actor-no-ctx-cmd-${this.getStateName()}`,
        new Error(msg)
      );
      return;
    }

    const logger = turnCtx.getLogger();
    const contextActor = turnCtx.getActor(); // Actor from context
    const contextActorId = contextActor?.id ?? 'N/A_in_context';

    const msg = `${this.getStateName()}: Unexpected command "${commandString}" from entity ${actorEntityFromSubscriptionCallback?.id} received while awaiting external turn end for context actor ${contextActorId}.`;
    logger.error(msg);

    // End the turn for the actor currently in context
    turnCtx.endTurn(new Error(msg));
  }

  /**
   * @override
   * @param {BaseTurnHandler} handler
   */
  async destroy(handler) {
    // With the BaseTurnHandler.destroy() reordering, ITurnContext might still be available here.
    const turnCtx = this._getTurnContext();
    const logger = turnCtx ? turnCtx.getLogger() : handler.getLogger(); // Use best available logger

    // Determine actor ID for logging more reliably
    let actorIdForLog = 'N/A_at_state_destroy';
    if (turnCtx && typeof turnCtx.getActor === 'function') {
      const actor = turnCtx.getActor();
      if (actor && typeof actor.id !== 'undefined') {
        actorIdForLog = actor.id;
      }
    } else if (typeof handler.getCurrentActor === 'function') {
      // Fallback to handler's actor
      const handlerActor = handler.getCurrentActor();
      if (handlerActor && typeof handlerActor.id !== 'undefined') {
        actorIdForLog = handlerActor.id;
      }
    }

    // The "Handler destroyed while awaiting..." original log message is an observation.
    // It indicates this state was active when handler.destroy() was called.
    // This can be normal if TurnManager is cleaning up.
    logger.info(
      `${this.getStateName()}: State instance destroy() called for actor ${actorIdForLog}. Performing state-specific cleanup. Handler is being destroyed: ${handler._isDestroyed}.`
    );

    // 1. Ensure unsubscription happens. This is the primary responsibility of this state's destroy.
    await this.#performUnsubscribe(
      logger,
      `state-destroy-for-${actorIdForLog}`
    );

    // 2. Clear the awaiting flag if context is available and flag is set.
    // This is a "last chance" cleanup for the flag this state manages.
    // It's particularly relevant if destroy is called for reasons *other* than the
    // normal core:turn_ended -> handleTurnEndedEvent -> exitState flow.
    if (
      turnCtx &&
      typeof turnCtx.isAwaitingExternalEvent === 'function' &&
      typeof turnCtx.setAwaitingExternalEvent === 'function'
    ) {
      if (turnCtx.isAwaitingExternalEvent()) {
        try {
          const actorIdInCtx = turnCtx.getActor()?.id ?? actorIdForLog;
          logger.debug(
            `${this.getStateName()} (destroy): Clearing awaiting external event flag for ${actorIdInCtx} via ITurnContext during state destruction.`
          );
          turnCtx.setAwaitingExternalEvent(false, actorIdInCtx);
        } catch (flagErr) {
          logger.warn(
            `${this.getStateName()} (destroy): Failed to clear awaiting flag for ${turnCtx.getActor()?.id ?? actorIdForLog} during state destruction: ${flagErr.message}`
          );
        }
      }
    } else if (handler._isDestroyed) {
      // If no context but handler is being destroyed
      logger.debug(
        `${this.getStateName()} (destroy): ITurnContext not available for actor ${actorIdForLog} during state destruction (handler is being destroyed). Flag clearing likely handled or not possible.`
      );
    } else {
      // No context, and not clear if handler is being destroyed (should be rare if called from handler.destroy)
      logger.warn(
        `${this.getStateName()} (destroy): ITurnContext not available for actor ${actorIdForLog} during state destruction. Cannot clear awaiting flag via context.`
      );
    }

    // CRITICAL: DO NOT call turnCtx.endTurn() here.
    // If this state is being destroyed because its handler is being destroyed (e.g., by TurnManager
    // after a turn successfully ended), calling endTurn() again would be redundant and could
    // lead to re-entrant calls to PlayerTurnHandler._handleTurnEnd and further state transitions
    // on an already dismantling handler. The BaseTurnHandler.destroy() sequence itself is
    // responsible for ensuring the handler transitions to an Idle state and resources are reset.

    await super.destroy(handler); // Calls AbstractTurnState's destroy for its logging.
    logger.debug(
      `${this.getStateName()}: State-specific destroy handling for actor ${actorIdForLog} complete.`
    );
  }

  // Other ITurnState methods like startTurn, processCommandResult, handleDirective
  // will rely on AbstractTurnState's default behavior (log error & throw) as they
  // are not expected to be called in AwaitingExternalTurnEndState.
}

// --- FILE END ---
