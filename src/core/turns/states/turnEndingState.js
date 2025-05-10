// src/core/turnStates/turnEndingState.js
// -----------------------------------------------------------------------------
//  TurnEndingState - Handles the final steps of ending a turn.
// -----------------------------------------------------------------------------

/**
 * @typedef {import('../handlers/baseTurnHandler.js').BaseTurnHandler} BaseTurnHandler
 * @typedef {import('../../../entities/entity.js').default} Entity
 * @typedef {import('./ITurnState.js').ITurnState} ITurnState_Interface
 * @typedef {import('./abstractTurnState.js').AbstractTurnState} AbstractTurnState_Base
 * @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext // Added
 */

import {AbstractTurnState} from './abstractTurnState.js';
import {TurnIdleState} from './turnIdleState.js';

/**
 * @class TurnEndingState
 * @extends {AbstractTurnState_Base}
 * @implements {ITurnState_Interface}
 * @description
 * This state is entered when a turn concludes (successfully or with an error).
 * It notifies the ITurnEndPort, signals normal termination if applicable,
 * resets per-turn resources on the handler, and transitions to TurnIdleState.
 */
export class TurnEndingState extends AbstractTurnState {
    /** @type {string} */ #actorToEndId;
    /** @type {Error|null} */ #turnError;

    /**
     * @param {BaseTurnHandler} handler - The BaseTurnHandler instance.
     * @param {string} actorToEndId - ID of the actor whose turn is ending.
     * @param {Error|null} [turnError=null] - Error if turn ended abnormally.
     */
    constructor(handler, actorToEndId, turnError = null) {
        super(handler);
        // Get current actor from handler for logging, but actorToEndId is paramount.
        const currentHandlerActor = handler.getCurrentActor(); // Can be null
        this.#actorToEndId = actorToEndId || currentHandlerActor?.id || 'UNKNOWN_ACTOR_ENDING';
        this.#turnError = turnError || null;

        const logger = handler.getLogger(); // Use handler's logger as context might be gone/going
        logger.debug(`${this.getStateName()} constructed for actor ${this.#actorToEndId}. Error: ${this.#turnError ? this.#turnError.message : 'null'}`);
    }

    /** @override */
    getStateName() {
        return 'TurnEndingState';
    }

    /**
     * @override
     * @param {BaseTurnHandler} handler
     * @param {ITurnState_Interface} [previousState]
     */
    async enterState(handler, previousState) {
        // AbstractTurnState.enterState will log. At this point, ITurnContext for the *ending* turn might still be present.
        // Or it might have been cleared if _handleTurnEnd was called after a reset.
        // We use this._getTurnContext() which will fetch it from this._handler.
        await super.enterState(handler, previousState);

        const turnCtxForEndingTurn = this._getTurnContext(); // Context of the turn that is NOW ending.
        const logger = turnCtxForEndingTurn ? turnCtxForEndingTurn.getLogger() : handler.getLogger();

        const isSuccess = (this.#turnError === null);
        const statusTxt = isSuccess ? 'SUCCESS' : 'FAILURE';
        const contextActorId = turnCtxForEndingTurn?.getActor()?.id;

        logger.info(`${this.getStateName()}: Entered for target actor ${this.#actorToEndId} – ${statusTxt}. Context actor: ${contextActorId ?? 'None'}.`);

        // Signal normal termination if this ending state corresponds to the handler's current actor context.
        // This helps PlayerTurnHandler.destroy() to not force-end an already ending turn.
        if (contextActorId === this.#actorToEndId && typeof handler.signalNormalApparentTermination === 'function') {
            logger.debug(`${this.getStateName()}: Signaling normal apparent termination for ${this.#actorToEndId}.`);
            handler.signalNormalApparentTermination();
        } else if (contextActorId !== this.#actorToEndId && typeof handler.signalNormalApparentTermination === 'function') {
            logger.warn(`${this.getStateName()}: Ending turn for ${this.#actorToEndId}, but handler's context actor is ${contextActorId}. Normal termination signal not sent for PTH specifics.`);
        }

        // Notify ITurnEndPort using the ITurnContext of the ending turn if available.
        if (turnCtxForEndingTurn && turnCtxForEndingTurn.getActor()?.id === this.#actorToEndId) {
            try {
                const turnEndPort = turnCtxForEndingTurn.getTurnEndPort(); // From ITurnContext
                logger.debug(`${this.getStateName()}: Notifying TurnEndPort for ${this.#actorToEndId} (success: ${isSuccess}).`);
                await turnEndPort.notifyTurnEnded(this.#actorToEndId, this.#turnError);
                logger.debug(`${this.getStateName()}: TurnEndPort notification for ${this.#actorToEndId} complete.`);
            } catch (notifyErr) {
                logger.error(`${this.getStateName()}: CRITICAL – TurnEndPort notify failed for ${this.#actorToEndId}: ${notifyErr.message}`, notifyErr);
            }
        } else {
            logger.warn(`${this.getStateName()}: ITurnContext not available or mismatched for ${this.#actorToEndId} when trying to notify TurnEndPort. Port not notified by this state.`);
        }

        // Reset handler's per-turn resources. This is crucial.
        // It will clear the ITurnContext and currentActor on the handler.
        logger.debug(`${this.getStateName()}: Resetting handler's state/resources for actor ${this.#actorToEndId}.`);
        handler._resetTurnStateAndResources(`enterState-${this.getStateName()}-${this.#actorToEndId}`);

        // Transition to TurnIdleState.
        logger.debug(`${this.getStateName()}: Transitioning to TurnIdleState.`);
        await handler._transitionToState(new TurnIdleState(handler)); // TurnIdleState constructor takes handler
    }

    /**
     * @override
     * @param {BaseTurnHandler} handler
     * @param {ITurnState_Interface} [nextState]
     */
    async exitState(handler, nextState) {
        // This state is transient; AbstractTurnState.exitState will log using this._getTurnContext().
        // By the time this is called, context is already cleared by _resetTurnStateAndResources.
        // So, the logger will fall back to handler.getLogger().
        await super.exitState(handler, nextState);
        // Note: The log from super.exitState might say "Actor: N/A" as context is gone.
    }

    /** @override */
    async destroy(handler) {
        // Logger from handler as context is likely gone.
        const logger = handler.getLogger();
        logger.warn(`${this.getStateName()}: Handler destroyed mid-finalisation for ${this.#actorToEndId}. Resources should have been reset.`);
        // Ensure resources are reset if somehow not done.
        handler._resetTurnStateAndResources(`destroy-${this.getStateName()}-${this.#actorToEndId}`);
        // Attempt to force to Idle if not already there.
        if (!(handler._currentState instanceof TurnIdleState)) { // Accessing protected _currentState for check
            try {
                await handler._transitionToState(new TurnIdleState(handler));
            } catch (err) {
                logger.error(`${this.getStateName()}: Failed forced transition to TurnIdleState during destroy: ${err.message}`, err);
            }
        }
        await super.destroy(handler);
    }

    // All other ITurnState API methods are invalid here and will use AbstractTurnState defaults.
}

// --- FILE END ---