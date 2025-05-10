// src/core/turnStates/awaitingExternalTurnEndState.js
// --- FILE START ---

/**
 * @typedef {import('../handlers/baseTurnHandler.js').BaseTurnHandler} BaseTurnHandler
 * @typedef {import('../../../entities/entity.js').default} Entity
 * @typedef {import('./ITurnState.js').ITurnState} ITurnState_Interface
 * @typedef {import('./abstractTurnState.js').AbstractTurnState} AbstractTurnState_Base
 * @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 * @typedef {import('../../constants/eventIds.js').SystemEventPayloads} SystemEventPayloads
 * @typedef {import('../../constants/eventIds.js').TURN_ENDED_ID} TURN_ENDED_ID_TYPE
 */

import {AbstractTurnState} from './abstractTurnState.js';
import {TurnIdleState} from './turnIdleState.js'; // For error recovery if context is missing
import {TURN_ENDED_ID} from '../../constants/eventIds.js'; // Constant import

/**
 * @class AwaitingExternalTurnEndState
 * @extends AbstractTurnState_Base
 * @implements {ITurnState_Interface}
 * @description
 * Entered when the system must wait for an external `core:turn_ended` event.
 * This state relies exclusively on ITurnContext for all its operations,
 * including event subscription, managing awaiting status, and ending the turn.
 */
export class AwaitingExternalTurnEndState extends AbstractTurnState {
    /** @private @type {function|undefined} */
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
        // Get ITurnContext via the inherited _getTurnContext()
        const turnCtx = this._getTurnContext();

        // Logger should be obtained from ITurnContext.
        // If turnCtx is null, super.enterState will use handler.getLogger() as a fallback.
        await super.enterState(handler, previousState); // Handles initial logging

        if (!turnCtx) {
            const fallbackLogger = handler.getLogger(); // Use handler's logger if context is unavailable
            fallbackLogger.error(`${this.getStateName()}: Critical - ITurnContext not available on entry. Transitioning to Idle.`);
            // No turnCtx to call endTurn() on, so handler must reset and transition.
            handler._resetTurnStateAndResources(`critical-entry-no-context-${this.getStateName()}`);
            await handler._transitionToState(new TurnIdleState(handler));
            return;
        }

        const logger = turnCtx.getLogger(); // Use logger from the valid turnCtx
        const actor = turnCtx.getActor();

        if (!actor) {
            logger.error(`${this.getStateName()}: No actor in ITurnContext. Ending turn.`);
            turnCtx.endTurn(new Error(`${this.getStateName()}: No actor in ITurnContext on entry.`));
            return;
        }
        const actorId = actor.id;

        try {
            // 1. Inform the handler (via TurnContext) that we are now awaiting an external event.
            logger.debug(`${this.getStateName()}: Calling turnCtx.setAwaitingExternalEvent(true, ${actorId}).`);
            turnCtx.setAwaitingExternalEvent(true, actorId);
            logger.debug(`${this.getStateName()}: Successfully marked actor ${actorId} as awaiting external event via ITurnContext.`);

            // 2. Subscribe to the core:turn_ended event using SubscriptionLifecycleManager from ITurnContext.
            logger.debug(`${this.getStateName()}: Subscribing to ${TURN_ENDED_ID} events for actor ${actorId}.`);
            const subMan = turnCtx.getSubscriptionManager();
            this.#unsubscribeTurnEndedFn = subMan.subscribeToTurnEnded(
                /** @param {SystemEventPayloads[TURN_ENDED_ID_TYPE]} payload */
                (payload) => this.handleTurnEndedEvent(handler, payload) // Pass handler for context
            );

            if (typeof this.#unsubscribeTurnEndedFn !== 'function') {
                // This case should ideally be prevented by a robust SubscriptionLifecycleManager.
                logger.warn(`${this.getStateName()}: subscribeToTurnEnded did not return an unsubscribe function for ${actorId}. This is unexpected.`);
                // Proceeding, but unsubscription might fail or not be possible.
            }
            logger.info(`${this.getStateName()}: Successfully subscribed – awaiting ${TURN_ENDED_ID} for actor ${actorId}.`);

        } catch (error) {
            logger.error(`${this.getStateName()}: Error during enterState setup for actor ${actorId}: ${error.message}`, error);
            // Ensure the awaiting flag is cleared if setup fails AFTER it was set.
            // Check if isAwaitingExternalEvent reflects the intended 'true' state before attempting to clear.
            // No direct check available here for "was setAwaitingExternalEvent(true,...) successful before this error?"
            // So, conservatively try to clear it.
            try {
                if (turnCtx.isAwaitingExternalEvent()) { // Check if it was set
                    logger.debug(`${this.getStateName()}: Attempting to clear awaiting flag for ${actorId} due to setup error.`);
                    turnCtx.setAwaitingExternalEvent(false, actorId);
                }
            } catch (clearFlagError) {
                logger.error(`${this.getStateName()}: Failed to clear awaiting flag for ${actorId} during error recovery: ${clearFlagError.message}`, clearFlagError);
            }
            turnCtx.endTurn(error); // End turn via ITurnContext with the original error
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
        const actorIdForLog = turnCtx?.getActor()?.id ?? 'N/A_on_exit';

        logger.debug(`${this.getStateName()}: Exiting state for actor ${actorIdForLog}. Next state: ${nextState?.getStateName() ?? 'None'}.`);

        // 1. Unsubscribe from the core:turn_ended event.
        if (this.#unsubscribeTurnEndedFn) {
            logger.debug(`${this.getStateName()}: Unsubscribing from ${TURN_ENDED_ID} for actor ${actorIdForLog}.`);
            try {
                this.#unsubscribeTurnEndedFn();
            } catch (unsubError) {
                logger.warn(`${this.getStateName()}: Error unsubscribing from ${TURN_ENDED_ID} for ${actorIdForLog}: ${unsubError.message}`, unsubError);
            }
            this.#unsubscribeTurnEndedFn = undefined;
        } else {
            logger.debug(`${this.getStateName()}: No unsubscribe function was stored or it was already cleared for ${actorIdForLog}.`);
        }

        // 2. Clear the awaiting flag via ITurnContext if still set.
        // This is important if exiting due to destruction or an unexpected transition.
        if (turnCtx) { // Only if context is still valid
            try {
                if (turnCtx.isAwaitingExternalEvent()) {
                    const currentActorId = turnCtx.getActor()?.id; // Could be different if context changed, log carefully
                    logger.debug(`${this.getStateName()}: Clearing awaiting external event flag for actor ${currentActorId ?? 'UNKNOWN_ACTOR_CTX'} on exit via ITurnContext.`);
                    turnCtx.setAwaitingExternalEvent(false, currentActorId); // Pass ID from context
                } else {
                    logger.debug(`${this.getStateName()}: Awaiting external event flag was already false for actor ${turnCtx.getActor()?.id ?? 'UNKNOWN_ACTOR_CTX'} on exit.`);
                }
            } catch (flagErr) {
                logger.warn(`${this.getStateName()}: Failed to clear awaiting external event flag for ${turnCtx.getActor()?.id ?? 'UNKNOWN_ACTOR_CTX'} on exit: ${flagErr.message}`, flagErr);
                // Not ending turn here as we are already in the process of exiting the state.
            }
        } else {
            logger.warn(`${this.getStateName()}: ITurnContext not available on exit for actor ${actorIdForLog}. Cannot clear awaiting flag via context.`);
        }

        await super.exitState(handler, nextState); // Handles logging using the (now potentially cleared) context
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
            fallbackLogger.warn(`${this.getStateName()}: ${TURN_ENDED_ID} received, but no active ITurnContext. Payload for ${payload?.entityId}. Ignoring and cleaning up.`);
            await this.#performUnsubscribe(fallbackLogger, 'no-context-on-event');
            return;
        }

        const logger = turnCtx.getLogger();
        const currentActor = turnCtx.getActor(); // Actor from ITurnContext

        if (!currentActor) {
            logger.warn(`${this.getStateName()}: ${TURN_ENDED_ID} received for payload actor ${payload?.entityId}, but no actor in current ITurnContext. Cleaning up subscription and ignoring.`);
            await this.#performUnsubscribe(logger, `no-actor-in-context-for-payload-${payload?.entityId}`);
            // Cannot meaningfully end a turn if context has no actor.
            return;
        }

        const waitingActorId = currentActor.id;
        const payloadActorId = payload?.entityId;
        const payloadError = payload?.error;

        logger.debug(`${this.getStateName()}: Received ${TURN_ENDED_ID}. Waiting for: ${waitingActorId}, Event for: ${payloadActorId}. Error in payload: ${payloadError ? payloadError.message : 'null'}.`);

        // 1. Verify the handler still expects this event for the current actor.
        if (!turnCtx.isAwaitingExternalEvent()) {
            logger.warn(`${this.getStateName()}: ${TURN_ENDED_ID} for ${payloadActorId} (context actor ${waitingActorId}) received, but ITurnContext is no longer awaiting an external event. May have been handled, timed out, or state exited. Cleaning up subscription.`);
            await this.#performUnsubscribe(logger, `not-awaiting-event-for-${payloadActorId}`);
            return;
        }

        // 2. Verify the received event is for the correct actor.
        if (payloadActorId !== waitingActorId) {
            logger.debug(`${this.getStateName()}: ${TURN_ENDED_ID} for ${payloadActorId} ignored; current context actor is ${waitingActorId}.`);
            return;
        }

        // Conditions met: Event is for the correct actor, and the context is still awaiting.
        logger.info(`${this.getStateName()}: Matched ${TURN_ENDED_ID} for actor ${payloadActorId}. Ending turn via ITurnContext.`);
        const errorForTurnEnd = payloadError instanceof Error ? payloadError : (payloadError ? new Error(String(payloadError)) : null);

        // Unsubscribe should happen as part of exitState, which will be triggered by endTurn().
        // No need to call #performUnsubscribe here directly if endTurn correctly leads to exitState.
        turnCtx.endTurn(errorForTurnEnd); // This will trigger the handler's _handleTurnEnd, leading to state transition.
    }

    /**
     * Helper to unsubscribe if needed, e.g. in error paths or unexpected situations.
     * @private
     * @param {ILogger} logger
     * @param {string} reasonForLog
     */
    async #performUnsubscribe(logger, reasonForLog) {
        if (this.#unsubscribeTurnEndedFn) {
            logger.debug(`${this.getStateName()}: Performing unsubscription for ${TURN_ENDED_ID} due to: ${reasonForLog}.`);
            try {
                this.#unsubscribeTurnEndedFn();
            } catch (err) {
                logger.warn(`${this.getStateName()}: Error during manual unsubscription (${reasonForLog}): ${err.message}`);
            }
            this.#unsubscribeTurnEndedFn = undefined;
        }
    }


    /**
     * @override
     * @param {BaseTurnHandler} handler
     * @param {string} commandString
     * @param {Entity} actorEntityFromSubscriptionCallback - Actor who submitted command (passed by caller like AwaitingPlayerInputState)
     */
    async handleSubmittedCommand(handler, commandString, actorEntityFromSubscriptionCallback) {
        const turnCtx = this._getTurnContext();

        if (!turnCtx) {
            const fallbackLogger = handler.getLogger();
            const msg = `${this.getStateName()}: Unexpected command "${commandString}" from ${actorEntityFromSubscriptionCallback?.id} received, but no ITurnContext. Ending turn for an unknown actor if possible.`;
            fallbackLogger.error(msg);
            // Cannot call turnCtx.endTurn(). Handler must try to recover.
            // This situation implies a severe issue. The handler might reset.
            // For now, log and potentially the handler itself will reset if this state remains.
            // If this state is active, _handleTurnEnd should be called on handler.
            handler._handleTurnEnd(actorEntityFromSubscriptionCallback?.id || 'unknown-actor-no-ctx', new Error(msg));
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

    /** @override */
    async destroy(handler) {
        const turnCtx = this._getTurnContext(); // Get context before super.destroy potentially clears it
        const logger = turnCtx ? turnCtx.getLogger() : handler.getLogger();
        const actorIdForLog = turnCtx?.getActor()?.id ?? 'N/A_at_destroy';

        logger.warn(`${this.getStateName()}: Handler destroyed while awaiting external turn end for ${actorIdForLog}.`);

        // 1. Ensure unsubscription happens.
        await this.#performUnsubscribe(logger, `handler-destroy-for-${actorIdForLog}`);

        // 2. Logic to call turnCtx.setAwaitingExternalEvent(false, ...)
        // This should ideally be handled by exitState if destroy leads to it.
        // However, if destroy is abrupt, call it here.
        if (turnCtx) { // Check if context still exists
            if (turnCtx.isAwaitingExternalEvent()) {
                try {
                    logger.debug(`${this.getStateName()} (destroy): Clearing awaiting external event flag for ${actorIdForLog} via ITurnContext.`);
                    turnCtx.setAwaitingExternalEvent(false, actorIdForLog);
                } catch (flagErr) {
                    logger.warn(`${this.getStateName()} (destroy): Failed to clear awaiting flag for ${actorIdForLog}: ${flagErr.message}`);
                }
            }
            // 3. End the turn for the current actor via ITurnContext
            logger.debug(`${this.getStateName()} (destroy): Notifying turn end for ${actorIdForLog} due to destruction via ITurnContext.`);
            turnCtx.endTurn(new Error(`Handler destroyed while ${actorIdForLog} was in ${this.getStateName()}.`));
        } else {
            logger.warn(`${this.getStateName()} (destroy): ITurnContext not available for actor ${actorIdForLog}. Cannot clear flag or end turn via context.`);
            // If no context, but handler is being destroyed, the handler's destroy should reset and move to Idle.
        }

        await super.destroy(handler); // Calls AbstractTurnState's destroy, which logs.
                                      // BaseTurnHandler.destroy will also ensure transition to Idle.
        logger.debug(`${this.getStateName()}: Destroy handling for ${actorIdForLog} complete.`);
    }

    // Other ITurnState methods like startTurn, processCommandResult, handleDirective
    // will rely on AbstractTurnState's default behavior (log error & throw) as they
    // are not expected to be called in AwaitingExternalTurnEndState.
}

// --- FILE END ---