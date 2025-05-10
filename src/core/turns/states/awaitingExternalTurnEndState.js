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
// TurnEndingState is not directly used for transitions here, but for context
// import {TurnEndingState} from './turnEndingState.js';
import {TurnIdleState} from './turnIdleState.js';

import {TURN_ENDED_ID} from '../../constants/eventIds.js'; // Constant import

/**
 * @class AwaitingExternalTurnEndState
 * @extends AbstractTurnState_Base
 * @implements {ITurnState_Interface}
 * @description
 * Entered when the system must wait for an external `core:turn_ended` event.
 * Manages subscription to this event via ITurnContext.
 */
export class AwaitingExternalTurnEndState extends AbstractTurnState {
    /** @private @type {function|undefined} */
    #unsubscribeTurnEndedFn;

    /**
     * @param {BaseTurnHandler} handler
     */
    constructor(handler) {
        super(handler);
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
        await super.enterState(handler, previousState); // Handles logging via this._getTurnContext()

        const turnCtx = this._getTurnContext(); // Must exist
        const logger = turnCtx ? turnCtx.getLogger() : handler.getLogger();

        if (!turnCtx) {
            logger.error(`${this.getStateName()}: Critical - ITurnContext not available. Transitioning to Idle.`);
            handler._resetTurnStateAndResources(`critical-entry-no-context-${this.getStateName()}`);
            await handler._transitionToState(new TurnIdleState(handler));
            return;
        }

        const actor = turnCtx.getActor();
        if (!actor) {
            logger.error(`${this.getStateName()}: No actor in ITurnContext. Transitioning to Idle.`);
            turnCtx.endTurn(new Error("No actor in context for AwaitingExternalTurnEndState"));
            return;
        }
        const actorId = actor.id;

        // Inform the handler (via TurnContext) that we are now awaiting an external event.
        try {
            turnCtx.setAwaitingExternalEvent(true, actorId);
            logger.debug(`${this.getStateName()}: Successfully marked actor ${actorId} as awaiting external event via ITurnContext.`);
        } catch (flagErr) {
            logger.error(`${this.getStateName()}: Failed to mark actor ${actorId} as awaiting external event via ITurnContext: ${flagErr.message}`, flagErr);
            turnCtx.endTurn(flagErr); // End turn if critical setup fails
            return;
        }

        try {
            logger.debug(`${this.getStateName()}: Subscribing to ${TURN_ENDED_ID} events for actor ${actorId}.`);
            const subMan = turnCtx.getSubscriptionManager(); // From ITurnContext
            this.#unsubscribeTurnEndedFn = subMan.subscribeToTurnEnded(
                /** @param {SystemEventPayloads[TURN_ENDED_ID_TYPE]} payload */
                (payload) => this.handleTurnEndedEvent(handler, payload) // Pass handler
            );

            if (typeof this.#unsubscribeTurnEndedFn !== 'function') {
                logger.warn(`${this.getStateName()}: subscribeToTurnEnded did not return an unsubscribe function for ${actorId}.`);
            }
        } catch (subErr) {
            logger.error(`${this.getStateName()}: Failed subscribing for ${TURN_ENDED_ID} for ${actorId}. Error: ${subErr.message}`, subErr);
            // Ensure flag is cleared if subscription fails
            try {
                turnCtx.setAwaitingExternalEvent(false, actorId);
            } catch (e) { /* ignore cleanup error */
            }
            turnCtx.endTurn(subErr); // End turn via ITurnContext
            return;
        }
        logger.info(`${this.getStateName()}: Successfully subscribed – awaiting ${TURN_ENDED_ID} for actor ${actorId}.`);
    }

    /**
     * @override
     * @param {BaseTurnHandler} handler
     * @param {ITurnState_Interface} [nextState]
     */
    async exitState(handler, nextState) {
        const turnCtx = this._getTurnContext();
        const logger = turnCtx ? turnCtx.getLogger() : handler.getLogger();
        const actorId = turnCtx?.getActor()?.id ?? 'N/A';

        if (this.#unsubscribeTurnEndedFn) {
            logger.debug(`${this.getStateName()}: Unsubscribing from ${TURN_ENDED_ID} for actor ${actorId}.`);
            try {
                this.#unsubscribeTurnEndedFn();
            } catch (err) {
                logger.warn(`${this.getStateName()}: Error unsubscribing from ${TURN_ENDED_ID} for ${actorId}: ${err.message}`);
            }
            this.#unsubscribeTurnEndedFn = undefined;
        }

        // Clear the awaiting flag when exiting this state, unless transitioning to another state that also waits (unlikely here)
        // This is important if the turn ends for reasons other than the event itself (e.g. error, handler destroy)

        if (turnCtx && turnCtx.isAwaitingExternalEvent()) { // Check if still marked as awaiting
            try {
                logger.debug(`${this.getStateName()}: Clearing awaiting external event flag for actor ${actorId} on exit via ITurnContext.`);
                turnCtx.setAwaitingExternalEvent(false, actorId);
            } catch (flagErr) {
                logger.warn(`${this.getStateName()}: Failed to clear awaiting external event flag for ${actorId} on exit: ${flagErr.message}`);

            }
        }

        await super.exitState(handler, nextState); // Handles logging
    }

    /**
     * @override
     * @param {BaseTurnHandler} handler
     * @param {SystemEventPayloads[TURN_ENDED_ID_TYPE]} payload
     */
    async handleTurnEndedEvent(handler, payload) {
        const turnCtx = this._getTurnContext();
        const logger = turnCtx ? turnCtx.getLogger() : handler.getLogger();

        if (!turnCtx || !turnCtx.getActor()) {
            logger.warn(`${this.getStateName()}: ${TURN_ENDED_ID} received, but no active ITurnContext/actor. Payload for ${payload?.entityId}. Ignoring.`);
            await this.#doCleanupSubscription(logger); // Cleanup if somehow stuck here
            return;
        }

        const waitingActorId = turnCtx.getActor().id;
        const payloadActorId = payload?.entityId;

        // Check if this state is still the active one and if the handler expects this event.
        // The `turnCtx.isAwaitingExternalEvent()` check is crucial.
        if (!turnCtx.isAwaitingExternalEvent()) {
            logger.warn(`${this.getStateName()}: ${TURN_ENDED_ID} for ${payloadActorId} received, but ITurnContext (for ${waitingActorId}) is no longer awaiting an external event. May have been handled or timed out. Cleaning up subscription.`);
            await this.#doCleanupSubscription(logger);
            return;
        }

        if (payloadActorId !== waitingActorId) {
            logger.debug(`${this.getStateName()}: ${TURN_ENDED_ID} for ${payloadActorId} ignored; current actor is ${waitingActorId}.`);
            return;
        }

        logger.info(`${this.getStateName()}: Matched ${TURN_ENDED_ID} for actor ${payloadActorId}. Ending turn via ITurnContext.`);
        const errorForTurnEnd = payload?.error instanceof Error ? payload.error : (payload?.error ? new Error(String(payload.error)) : null);
        turnCtx.endTurn(errorForTurnEnd); // This will trigger the handler's _handleTurnEnd
    }

    /** @private */
    async #doCleanupSubscription(logger) {
        if (this.#unsubscribeTurnEndedFn) {
            logger.debug(`${this.getStateName()}: #doCleanupSubscription - Unsubscribing from ${TURN_ENDED_ID}.`);
            try {
                this.#unsubscribeTurnEndedFn();
            } catch (err) {
                logger.warn(`${this.getStateName()}: #doCleanupSubscription - Error during unsubscription: ${err.message}`);
            }
            this.#unsubscribeTurnEndedFn = undefined;
        }
    }

    /**
     * @override
     * @param {BaseTurnHandler} handler
     * @param {string} commandString
     * @param {Entity} actorEntity
     */
    async handleSubmittedCommand(handler, commandString, actorEntity) {
        const turnCtx = this._getTurnContext();
        const logger = turnCtx ? turnCtx.getLogger() : handler.getLogger();
        const actorId = turnCtx?.getActor()?.id ?? 'N/A';
        const msg = `${this.getStateName()}: Unexpected command "${commandString}" from ${actorEntity?.id} received while awaiting external turn end for ${actorId}.`;
        logger.error(msg);
        if (turnCtx) {
            turnCtx.endTurn(new Error(msg)); // End current turn with error
        } else {
            await handler._handleTurnEnd(actorId, new Error(msg)); // Fallback
        }
    }

    /** @override */
    async destroy(handler) {
        const turnCtx = this._getTurnContext();
        const logger = turnCtx ? turnCtx.getLogger() : handler.getLogger();
        const actorId = turnCtx?.getActor()?.id ?? 'N/A_destroy';

        logger.warn(`${this.getStateName()}: Handler destroyed while awaiting external turn end for ${actorId}.`);
        await this.#doCleanupSubscription(logger); // Ensure unsubscription

        if (turnCtx && turnCtx.getActor()) {
            logger.debug(`${this.getStateName()}: Notifying turn end for ${actorId} due to destruction via ITurnContext.`);
            turnCtx.endTurn(new Error(`Handler destroyed while ${actorId} was in ${this.getStateName()}.`));
        } else {
            logger.warn(`${this.getStateName()}: Handler destroyed, but no active ITurnContext/actor. No specific turn to end.`);
        }
        await super.destroy(handler);
    }

    // Other methods like startTurn, processCommandResult, handleDirective
    // rely on AbstractTurnState's default "not applicable" behavior.
}

// --- FILE END ---