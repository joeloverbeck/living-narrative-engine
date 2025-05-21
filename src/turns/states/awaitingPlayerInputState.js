// src/core/turns/states/awaitingPlayerInputState.js
// --- FILE START ---

/**
 * @file Defines the AwaitingPlayerInputState class for the turn-based system.
 * @module core/turns/states/awaitingPlayerInputState
 */

import {AbstractTurnState} from './abstractTurnState.js';
import {ProcessingCommandState} from './processingCommandState.js';
// Dynamically import TurnIdleState only when needed
// import {TurnIdleState} from './turnIdleState.js';

/**
 * Represents the state where the system is awaiting an action decision from the current actor's strategy.
 * This state retrieves the actor's turn strategy, invokes it to get an ITurnAction,
 * stores the action in the turn context, and then transitions to ProcessingCommandState.
 * Handles AbortError from strategy.decideAction() gracefully.
 *
 * @class AwaitingPlayerInputState
 * @extends {AbstractTurnState}
 * @implements {ITurnState}
 */
export class AwaitingPlayerInputState extends AbstractTurnState {
    /**
     * Creates an instance of AwaitingPlayerInputState.
     * @param {import('../handlers/baseTurnHandler.js').BaseTurnHandler} handler - The turn handler managing this state.
     */
    constructor(handler) {
        super(handler);
    }

    /**
     * Gets the name of the state.
     * @returns {string} The name of the state.
     * @readonly
     */
    get name() {
        return 'AwaitingPlayerInputState';
    }

    /**
     * Called when the state machine enters this state.
     * Retrieves the actor's turn strategy, invokes it to get an ITurnAction.
     * If successful, stores the action and transitions to ProcessingCommandState.
     * If decideAction is aborted (AbortError), ends the turn gracefully.
     * For other errors, ends the turn with an error.
     * @override
     */
    async enterState() {
        const turnContext = this._getTurnContext();

        if (!turnContext) {
            const logger = this._handler?.getLogger?.() ?? console;
            logger.error(`${this.name}: Critical error - TurnContext is not available. Attempting to reset and idle.`);
            if (this._handler && typeof this._handler._resetTurnStateAndResources === 'function' && typeof this._handler._transitionToState === 'function') {
                this._handler._resetTurnStateAndResources(`critical-no-context-${this.name}`);
                const {TurnIdleState} = await import('./turnIdleState.js');
                this._handler._transitionToState(new TurnIdleState(this._handler));
            } else {
                logger.error(`${this.name}: Cannot reset handler as context and suitable handler methods are unavailable.`);
            }
            return;
        }

        await super.enterState(this._handler, null);
        const logger = turnContext.getLogger();

        const actor = turnContext.getActor();
        if (!actor) {
            logger.error(`${this.name}: No actor found in TurnContext. Ending turn.`);
            turnContext.endTurn(new Error("No actor in context during AwaitingPlayerInputState."));
            return;
        }

        logger.info(`${this.name}: Actor ${actor.id}. Attempting to retrieve turn strategy.`);

        let strategy;
        try {
            if (typeof turnContext.getStrategy !== 'function') {
                const errorMsg = `${this.name}: turnContext.getStrategy() is not a function for actor ${actor.id}.`;
                logger.error(errorMsg);
                turnContext.endTurn(new Error(errorMsg));
                return;
            }
            strategy = turnContext.getStrategy();
            if (!strategy || typeof strategy.decideAction !== 'function') {
                const errorMsg = `${this.name}: No valid IActorTurnStrategy found for actor ${actor.id} or strategy is malformed (missing decideAction).`;
                logger.error(errorMsg, {strategyReceived: strategy});
                turnContext.endTurn(new Error(errorMsg));
                return;
            }
        } catch (error) {
            const errorMsg = `${this.name}: Error retrieving strategy for actor ${actor.id}: ${error.message}`;
            logger.error(errorMsg, {originalError: error});
            turnContext.endTurn(new Error(errorMsg, {cause: error}));
            return;
        }

        const strategyName = strategy?.constructor?.name ?? 'UnknownStrategy';
        logger.info(`${this.name}: Strategy ${strategyName} obtained for actor ${actor.id}. Requesting action decision.`);

        try {
            // strategy.decideAction should now be passed the turnContext, which contains the AbortSignal
            // HumanPlayerStrategy will internally get the signal from the context.
            const turnAction = await strategy.decideAction(turnContext);

            // If decideAction resolved (wasn't aborted and didn't throw other errors)
            if (!turnAction || typeof turnAction.actionDefinitionId === 'undefined') {
                const errorMsg = `${this.name}: Strategy for actor ${actor.id} returned an invalid or null ITurnAction (must have actionDefinitionId).`;
                logger.warn(errorMsg, {receivedAction: turnAction});
                turnContext.endTurn(new Error(errorMsg)); // Ends turn with error
                return;
            }

            logger.info(`${this.name}: Actor ${actor.id} decided action: ${turnAction.actionDefinitionId}. Storing action.`);

            if (typeof turnContext.setChosenAction === 'function') {
                turnContext.setChosenAction(turnAction);
            } else {
                logger.warn(`${this.name}: ITurnContext.setChosenAction() not found. Cannot store action in context.`);
            }

            logger.info(`${this.name}: Transitioning to ProcessingCommandState for actor ${actor.id}.`);
            const commandStringArg = turnAction.commandString ? turnAction.commandString : turnAction.actionDefinitionId;
            await turnContext.requestTransition(ProcessingCommandState, [commandStringArg, turnAction]);

        } catch (error) {
            // --- MODIFICATION: Handle AbortError specifically ---
            if (error && error.name === 'AbortError') {
                // This occurs if decideAction (or the underlying prompt) was cancelled.
                logger.info(`${this.name}: Action decision for actor ${actor.id} was cancelled (aborted). Ending turn gracefully.`);
                // End the turn without an error to signify a controlled cancellation, not a failure.
                // TurnContext.endTurn() itself now calls cancelActivePrompt(), so it's idempotent if called again.
                turnContext.endTurn(null);
            } else {
                // Handle other errors (e.g., PromptError for superseded, validation errors, etc.)
                const errorMsg = `${this.name}: Error during action decision, storage, or transition for actor ${actor.id}: ${error.message}`;
                logger.error(errorMsg, {originalError: error});
                turnContext.endTurn(new Error(errorMsg, {cause: error})); // Ends turn with this new error
            }
            // --- END MODIFICATION ---
        }
    }

    /**
     * Called when the state machine exits this state.
     * @override
     */
    async exitState() {
        await super.exitState(this._handler, null);
        const turnContext = this._getTurnContext();
        const logger = turnContext?.getLogger?.() ?? this._handler?.getLogger?.() ?? console;
        logger.debug(`${this.name}: ExitState cleanup (if any) complete.`);
    }

    /**
     * Handles submitted commands. This method should ideally not be called in the new workflow.
     * If called, it logs a warning and ends the turn.
     * @override
     * @param {import('../handlers/baseTurnHandler.js').BaseTurnHandler} handlerInstance
     * @param {string} commandString
     * @param {import('../../entities/entity.js').default} [actorEntity]
     * @deprecated This method is part of the old workflow and should not be invoked.
     */
    async handleSubmittedCommand(handlerInstance, commandString, actorEntity) {
        const turnContext = this._getTurnContext();
        if (!turnContext) {
            const logger = this._handler?.getLogger?.() ?? console;
            const actorIdForLog = actorEntity?.id ?? 'unknown actor';
            logger.error(`${this.name}: handleSubmittedCommand (for actor ${actorIdForLog}, cmd: "${commandString}") called, but no ITurnContext. Forcing handler reset.`);
            if (this._handler && typeof this._handler._resetTurnStateAndResources === 'function' && typeof this._handler._transitionToState === 'function') {
                this._handler._resetTurnStateAndResources(`no-context-submission-${this.name}`);
                const {TurnIdleState} = await import('./turnIdleState.js');
                this._handler._transitionToState(new TurnIdleState(this._handler));
            } else {
                logger.error(`${this.name}: CRITICAL - No ITurnContext or handler methods to process unexpected command submission or to reset.`);
            }
            return;
        }

        const logger = turnContext.getLogger();
        const currentActorInContext = turnContext.getActor();
        const actorIdInContext = currentActorInContext ? currentActorInContext.id : 'unknown actor in context';

        logger.warn(
            `${this.name}: handleSubmittedCommand was called directly for actor ${actorIdInContext} with command "${commandString}". This is unexpected in the new strategy-driven workflow. Ending turn.`
        );
        turnContext.endTurn(new Error(`Unexpected direct command submission to ${this.name} for actor ${actorIdInContext}. Input should be strategy-driven.`));
    }

    /**
     * Handles the 'core:turn_ended' event.
     * @override
     * @param {import('../handlers/baseTurnHandler.js').BaseTurnHandler} handlerInstance
     * @param {object} payload - The event payload. Expected: { entityId: string, error?: Error }
     */
    async handleTurnEndedEvent(handlerInstance, payload) {
        const currentHandler = handlerInstance || this._handler;
        const turnContext = this._getTurnContext();
        const logger = turnContext?.getLogger?.() ?? currentHandler?.getLogger?.() ?? console;

        if (!turnContext) {
            logger.warn(`${this.name}: handleTurnEndedEvent received but no turn context. Payload: ${JSON.stringify(payload)}. Deferring to superclass.`);
            return super.handleTurnEndedEvent(currentHandler, payload);
        }

        const currentActor = turnContext.getActor();
        const eventActorId = payload?.entityId;

        if (currentActor && eventActorId === currentActor.id) {
            logger.info(`${this.name}: core:turn_ended event received for current actor ${currentActor.id}. Ending turn.`);
            // Pass the error from the payload, if any. This ensures that if the turn ended due to an
            // abort/cancellation that was translated to endTurn(null), that null is passed.
            // If it ended due to a different error, that error is passed.
            turnContext.endTurn(payload.error || null);
        } else {
            logger.debug(`${this.name}: core:turn_ended event for actor ${eventActorId} is not for current context actor ${currentActor?.id}. Deferring to superclass.`);
            await super.handleTurnEndedEvent(currentHandler, payload);
        }
    }

    /**
     * Called when the handler is being destroyed.
     * @override
     * @param {import('../handlers/baseTurnHandler.js').BaseTurnHandler} handlerInstance
     */
    async destroy(handlerInstance) {
        const currentHandler = handlerInstance || this._handler;
        const logger = currentHandler?.getLogger?.() ?? console;
        const turnContext = currentHandler?.getTurnContext?.();
        const actorInContext = turnContext?.getActor();

        if (actorInContext) {
            if (currentHandler && currentHandler._isDestroyed) {
                logger.info(`${this.name}: Handler (actor ${actorInContext.id}) is already being destroyed. Skipping turnContext.endTurn().`);
            } else if (turnContext) {
                // When the handler is destroyed, BaseTurnHandler.destroy() should have already called
                // turnContext.cancelActivePrompt(). Then, this state's destroy is called.
                // The subsequent call to turnContext.endTurn() here will also try to cancel, which is fine (idempotent).
                // The important part is that the prompt promise should have already been rejected with AbortError.
                logger.info(`${this.name}: Handler destroyed while state was active for actor ${actorInContext.id}. Ending turn via turnContext (may trigger AbortError if prompt was active).`);
                const destroyError = new Error(`Turn handler destroyed while actor ${actorInContext.id} was in ${this.name}.`);
                // If endTurn is called with an error, that error will be part of the 'core:turn_ended' event.
                // If the prompt was active, cancelActivePrompt in endTurn ensures it gets an AbortError.
                turnContext.endTurn(destroyError);
            } else {
                logger.warn(`${this.name}: actorInContext (${actorInContext.id}) reported but turnContext is missing during state destroy. Cannot call endTurn.`);
            }
        } else {
            if (turnContext) {
                logger.warn(`${this.name}: Handler destroyed. Actor ID from context: N/A_in_context. No specific turn to end via context if actor is missing.`);
            } else {
                logger.warn(`${this.name}: Handler destroyed. Actor ID from context: N/A_no_context. No specific turn to end via context if actor is missing.`);
            }
        }
        await super.destroy(currentHandler);
    }
}

// --- FILE END ---