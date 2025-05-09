// src/core/turnStates/turnEndingState.js
// -----------------------------------------------------------------------------
//
//  TurnEndingState  – PTH-STATE-008
//
//  This concrete state replaces the ad-hoc logic that used to live inside
//  PlayerTurnHandler._handleTurnEnd.  It is entered whenever a turn is deemed
//  finished (successfully or with an error) from any other active state.
//
//  Responsibilities
//  • Notify ITurnEndPort
//  • Flip the “terminating normally” flag on the context
//  • Hard-reset all per-turn state / subscriptions
//  • Transition the handler to TurnIdleState
//
// -----------------------------------------------------------------------------

/**
 * @typedef {import('../handlers/playerTurnHandler.js').default} PlayerTurnHandler
 * @typedef {import('../../../entities/entity.js').default} Entity
 * @typedef {import('./ITurnState.js').ITurnState} ITurnState_Interface
 */

import {AbstractTurnState} from './abstractTurnState.js';
import {TurnIdleState} from './turnIdleState.js';

/**
 * @class TurnEndingState
 * @extends AbstractTurnState
 * @implements {ITurnState_Interface}
 */
export class TurnEndingState extends AbstractTurnState {

    /** @type {string}   */ #actorToEndId;
    /** @type {Error|null} */ #turnError;

    /**
     * Create a TurnEndingState instance.
     *
     * @param {PlayerTurnHandler} context        – PTH context.
     * @param {string|null}       actorToEndId   – ID of the actor whose turn is ending.
     *                                            If omitted it defaults to the
     *                                            current actor on the context.
     * @param {Error|null}        [turnError]    – Error that caused the turn to end
     *                                            (null → normal success).
     */
    constructor(context, actorToEndId = null, turnError = null) {
        super(context);
        this.#actorToEndId = actorToEndId ?? context.getCurrentActor()?.id ?? 'UNKNOWN_ACTOR';
        this.#turnError = turnError ?? null;
    }

    /** {@inheritdoc} */
    getStateName() {
        return 'TurnEndingState';
    }

    // ---------------------------------------------------------------------
    //  State-life-cycle hooks
    // ---------------------------------------------------------------------

    /** {@inheritdoc} */
    async enterState(/** @type {PlayerTurnHandler} */ context, /* previousState */) {
        const isSuccess = (this.#turnError === null);
        const statusTxt = isSuccess ? 'SUCCESS' : 'FAILURE';
        const currentActorId = context.getCurrentActor()?.id ?? 'none';

        context.logger.info(`${this.getStateName()}: Entered for actor ${this.#actorToEndId} – ${statusTxt}. Current PTH actor: ${currentActorId}.`);

        // -----------------------------------------------------------------
        //  If we really are finalising the actor currently managed by PTH,
        //  mark the termination as “normal” so PlayerTurnHandler.destroy()
        //  does not fire its own failsafe.
        // -----------------------------------------------------------------
        if (currentActorId === this.#actorToEndId) {
            if (typeof context.signalNormalApparentTermination === 'function') {
                context.signalNormalApparentTermination();
            } else {
                // This method always exists on PlayerTurnHandler, but guard anyway.
                context.logger.debug(`${this.getStateName()}: context.signalNormalApparentTermination unavailable; #isTerminatingNormally left untouched.`);
            }

            // Notify the port ------------------------------------------------
            try {
                context.logger.debug(`${this.getStateName()}: Notifying TurnEndPort for ${this.#actorToEndId} (success: ${isSuccess}).`);
                await context.turnEndPort.notifyTurnEnded(this.#actorToEndId, isSuccess);
                context.logger.debug(`${this.getStateName()}: TurnEndPort notification complete.`);
            } catch (notifyErr) {
                context.logger.error(`${this.getStateName()}: CRITICAL – TurnEndPort notify failed for ${this.#actorToEndId}: ${notifyErr.message}`, notifyErr);
                // continue regardless – we still must clean up & transition
            }
        } else {
            context.logger.warn(
                `${this.getStateName()}: Called for actor ${this.#actorToEndId} but current actor is ${currentActorId}. `
                + `TurnEndPort **not** notified by this state.`
            );
        }

        // -----------------------------------------------------------------
        //  Always reset the handler’s per-turn resources.
        // -----------------------------------------------------------------
        context.logger.debug(`${this.getStateName()}: Resetting PTH state/resources (context actor id: ${this.#actorToEndId}).`);
        context._resetTurnStateAndResources(this.#actorToEndId);

        // -----------------------------------------------------------------
        //  Finally drop straight to Idle.
        // -----------------------------------------------------------------
        context.logger.debug(`${this.getStateName()}: Transitioning to TurnIdleState.`);
        await context._transitionToState(new TurnIdleState(context));

        // NOTE: TurnIdleState.enterState performs its own cleanup again; that’s
        // totally fine – it leaves the handler in a guaranteed pristine state.
    }

    /** {@inheritdoc} */
    async exitState(/** @type {PlayerTurnHandler} */ context /* , nextState */) {
        context.logger.info(`${this.getStateName()}: Exiting (this state is transient).`);
    }

    // ---------------------------------------------------------------------
    //  All other ITurnState API – these operations are invalid here.
    // ---------------------------------------------------------------------

    async startTurn(context, actor) {
        const msg = `${this.getStateName()}: startTurn called while turn is terminating (actor ${actor?.id}).`;
        context.logger.error(msg);
        throw new Error(msg);
    }

    async handleSubmittedCommand(context, commandString) {
        const msg = `${this.getStateName()}: handleSubmittedCommand('${commandString}') called during turn finalisation.`;
        context.logger.error(msg);
        throw new Error(msg);
    }

    async handleTurnEndedEvent(context, payload) {
        // The turn is *already* ending; just warn.
        context.logger.warn(`${this.getStateName()}: Ignoring core:turn_ended event for ${payload?.entityId}; already finalising.`);
    }

    async processCommandResult(context, actor, cmdProcResult, commandString) {
        const msg = `${this.getStateName()}: processCommandResult called while ending turn.`;
        context.logger.error(msg);
        throw new Error(msg);
    }

    async handleDirective(context, actor, directive) {
        const msg = `${this.getStateName()}: handleDirective called while ending turn.`;
        context.logger.error(msg);
        throw new Error(msg);
    }

    /** {@inheritdoc} */
    async destroy(/** @type {PlayerTurnHandler} */ context) {
        context.logger.warn(`${this.getStateName()}: PlayerTurnHandler destroyed mid-finalisation for ${this.#actorToEndId}.`);
        // Best-effort reset if something (somehow) hasn’t happened yet.
        context._resetTurnStateAndResources(this.#actorToEndId);
        // Ensure we end up idle.
        try {
            if (!(context._TEST_GET_CURRENT_STATE() instanceof TurnIdleState)) {
                await context._transitionToState(new TurnIdleState(context));
            }
        } catch (err) {
            context.logger.error(`${this.getStateName()}: Failed forced transition to TurnIdleState during destroy: ${err.message}`, err);
        }
    }
}