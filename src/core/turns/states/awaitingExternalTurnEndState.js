// src/core/turnStates/awaitingExternalTurnEndState.js
// --- FILE START ---

/**
 * @typedef {import('../handlers/playerTurnHandler.js').default} PlayerTurnHandler
 * @typedef {import('../../../entities/entity.js').default} Entity
 * @typedef {import('./ITurnState.js').ITurnState} ITurnState_Interface
 * @typedef {import('./abstractTurnState.js').AbstractTurnState} AbstractTurnState_Base
 * @typedef {import('../../constants/eventIds.js').SystemEventPayloads} SystemEventPayloads
 * @typedef {import('../../constants/eventIds.js').TURN_ENDED_ID} TURN_ENDED_ID_TYPE
 */

import {AbstractTurnState} from './abstractTurnState.js';
import {TurnEndingState} from './turnEndingState.js';
import {TurnIdleState} from './turnIdleState.js';

// CONSTANT IMPORTS -----------------------------------------------------------
import {TURN_ENDED_ID} from '../../constants/eventIds.js';

/**
 * @class AwaitingExternalTurnEndState
 * @extends AbstractTurnState_Base
 * @implements {ITurnState_Interface}
 *
 * @description
 * Entered when a command has been processed and the outcome dictates that the
 * {@link PlayerTurnHandler} must wait for an external `core:turn_ended` event
 * before the player's turn can conclude.
 */
export class AwaitingExternalTurnEndState extends AbstractTurnState {
    /**
     * Cached unsubscribe function returned by SubscriptionLifecycleManager.
     * @type {function|undefined}
     * @private
     */
    #unsubscribeTurnEndedFn;

    /**
     * Returns the canonical name for this state.
     * @override
     */
    getStateName() {
        return 'AwaitingExternalTurnEndState';
    }

    // ---------------------------------------------------------------------
    //  State-lifecycle hooks
    // ---------------------------------------------------------------------

    /**
     * {@inheritdoc}
     */
    async enterState(/** @type {PlayerTurnHandler} */ context, previousState) {
        const actor = context.getCurrentActor();
        const actorId = actor?.id ?? 'UNKNOWN_ACTOR';
        context.logger.info(`${this.getStateName()}: Entered. Waiting for external turn end event for actor ${actorId}. Previous state: ${previousState?.getStateName() ?? 'None'}.`);

        // -----------------------------------------------------------------
        //  Preconditions
        // -----------------------------------------------------------------
        if (!actor) {
            const msg = `${this.getStateName()}: No current actor present on entry. Cannot wait for turn end.`;
            context.logger.error(msg);
            await context._transitionToState(new TurnIdleState(context));
            return;
        }

        // If the handler already thinks it is awaiting a turn-ended event, clear that first.
        if (typeof context._clearTurnEndWaitingMechanisms === 'function') {
            context.logger.debug(`${this.getStateName()}: Clearing any residual turn-end waiting mechanisms.`);
            context._clearTurnEndWaitingMechanisms();
        } else {
            context.logger.warn(`${this.getStateName()}: context._clearTurnEndWaitingMechanisms() is not available – potential stale subscription leak.`);
        }

        // -----------------------------------------------------------------
        //  Mark intent in the context – NB: relies on PlayerTurnHandler exposing
        //  non-private helpers, else this will no-op and be logged as a warning.
        // -----------------------------------------------------------------
        try {
            if (typeof context._markAwaitingTurnEnd === 'function') {
                context._markAwaitingTurnEnd(true, actorId);
            } else {
                // Fallback logging – cannot touch #private fields.
                context.logger.warn(`${this.getStateName()}: PlayerTurnHandler did not expose _markAwaitingTurnEnd; internal flags not updated.`);
            }
        } catch (flagErr) {
            context.logger.warn(`${this.getStateName()}: Failed to set awaiting-turn-end flags on context: ${flagErr.message}`);
        }

        // -----------------------------------------------------------------
        //  Subscribe to TURN_ENDED_ID
        // -----------------------------------------------------------------
        try {
            context.logger.debug(`${this.getStateName()}: Subscribing to TURN_ENDED_ID events.`);
            this.#unsubscribeTurnEndedFn = context.subscriptionManager.subscribeToTurnEnded(
                /** @param {SystemEventPayloads[TURN_ENDED_ID_TYPE]} payload */
                (payload) => this.handleTurnEndedEvent(context, payload)
            );

            if (typeof this.#unsubscribeTurnEndedFn !== 'function') {
                context.logger.warn(`${this.getStateName()}: subscribeToTurnEnded did not return an unsubscribe function.`);
            }
        } catch (subErr) {
            context.logger.error(`${this.getStateName()}: Failed subscribing for TURN_ENDED_ID. Error: ${subErr.message}`);
            // Undo flag set so that exitState/destroy don't double-clean.
            try {
                if (typeof context._markAwaitingTurnEnd === 'function') {
                    context._markAwaitingTurnEnd(false);
                }
            } catch {/* ignore */
            }
            // Transition via normal turn-end handler path.
            await context._handleTurnEnd(actorId, subErr);
            return;
        }

        context.logger.info(`${this.getStateName()}: Successfully subscribed – awaiting core:turn_ended for actor ${actorId}.`);
    }

    /**
     * {@inheritdoc}
     */
    async exitState(/** @type {PlayerTurnHandler} */ context, nextState) {
        const actorId = context.getCurrentActor()?.id ?? 'N/A';
        context.logger.info(`${this.getStateName()}: Exiting for actor ${actorId}. Transitioning to ${nextState?.getStateName() ?? 'None'}.`);

        // Unsubscribe and clear flags.
        await this.#doClearWaitingMechanisms(context);
    }

    // ------------------------------------------------------------------
    //  Event handlers & misc public ITurnState API
    // ------------------------------------------------------------------

    /**
     * Handles an incoming core:turn_ended event.
     *
     * @param {PlayerTurnHandler} context
     * @param {SystemEventPayloads[TURN_ENDED_ID_TYPE]} payload
     */
    async handleTurnEndedEvent(context, payload) {
        const waitingActorId = context.getCurrentActor()?.id;
        const payloadActorId = payload?.entityId;

        // Guard – if no longer waiting just clean up and bail out.
        if (!context.isAwaitingExternalTurnEnd?.()) {
            await this.#doClearWaitingMechanisms(context); // inherited private method
            return;
        }

        if (payloadActorId !== waitingActorId) {
            context.logger.debug(`${this.getStateName()}: TURN_ENDED for ${payloadActorId} ignored; waiting for ${waitingActorId}.`);
            return; // early exit – nothing for us to do.
        }

        context.logger.info(`${this.getStateName()}: Matched TURN_ENDED for actor ${payloadActorId}. Ending turn.`);
        await context._handleTurnEnd(payloadActorId, payload?.error instanceof Error ? payload.error : null);
    }

    /**
     * Commands should not arrive while waiting for external event.
     */
    async handleSubmittedCommand(context, commandString) {
        const actorId = context.getCurrentActor()?.id ?? 'N/A';
        const msg = `${this.getStateName()}: Unexpected command "${commandString}" received while awaiting external turn end for ${actorId}.`;
        context.logger.error(msg);
        await context._handleTurnEnd(actorId, new Error(msg));
    }

    // These are inapplicable – just delegate to AbstractTurnState default which warns/throws.
    async startTurn(context, actor) {
        return super.startTurn(context, actor);
    }

    async processCommandResult(context, actor, cmdProcResult, commandString) {
        return super.processCommandResult(context, actor, cmdProcResult, commandString);
    }

    async handleDirective(context, actor, directive, cmdProcResult) {
        return super.handleDirective(context, actor, directive, cmdProcResult);
    }

    /**
     * {@inheritdoc}
     */
    async destroy(/** @type {PlayerTurnHandler} */ context) {
        const actorId = context.getCurrentActor()?.id ?? 'N/A_destroy';
        context.logger.warn(`${this.getStateName()}: PlayerTurnHandler is being destroyed while awaiting external turn end for ${actorId}.`);

        await this.#doClearWaitingMechanisms(context);

        if (context.getCurrentActor()) {
            await context._handleTurnEnd(actorId, new Error('Turn handler destroyed while awaiting external turn end event.'), true);
        }
    }

    // ------------------------------------------------------------------
    //  Internals
    // ------------------------------------------------------------------

    /**
     * Clears subscription and resets flags via context helper, handling any errors internally.
     * @private
     */
    async #doClearWaitingMechanisms(/** @type {PlayerTurnHandler} */ context) {
        if (this.#unsubscribeTurnEndedFn) {
            try {
                this.#unsubscribeTurnEndedFn();
            } catch (err) {
                context.logger.warn(`${this.getStateName()}: Error while unsubscribing from TURN_ENDED_ID: ${err.message}`);
            }
            this.#unsubscribeTurnEndedFn = undefined;
        }

        if (typeof context._clearTurnEndWaitingMechanisms === 'function') {
            context._clearTurnEndWaitingMechanisms();
        }
    }
}

// --- FILE END ---