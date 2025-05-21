// src/core/turns/states/awaitingPlayerInputState.js
// --- FILE START ---

/**
 * @file Defines the AwaitingPlayerInputState class for the turn-based system.
 * @module core/turns/states/awaitingPlayerInputState
 */

import {AbstractTurnState} from './abstractTurnState.js';
import {ProcessingCommandState} from './processingCommandState.js';
// Dynamically import TurnIdleState only when needed to avoid circular dependency issues at module load time.
// import {TurnIdleState} from './turnIdleState.js'; // Example if it were needed top-level

// import ITurnAction from '../interfaces/ITurnAction.js'; // Assuming ITurnAction might be needed for type checking
// import IActorTurnStrategy from '../interfaces/IActorTurnStrategy.js'; // For type hinting if needed

/**
 * Represents the state where the system is awaiting an action decision from the current actor's strategy.
 * This state retrieves the actor's turn strategy, invokes it to get an ITurnAction,
 * stores the action in the turn context, and then transitions to ProcessingCommandState.
 *
 * @class AwaitingPlayerInputState
 * @extends {AbstractTurnState}
 * @implements {ITurnState}
 */
export class AwaitingPlayerInputState extends AbstractTurnState {
    /**
     * Creates an instance of AwaitingPlayerInputState.
     * @param {TurnHandler} handler - The turn handler managing this state.
     */
    constructor(handler) {
        super(handler);
    }

    /**
     * Gets the name of the state. Used by AbstractTurnState's getStateName if not overridden.
     * @returns {string} The name of the state.
     * @readonly
     */
    get name() {
        return 'AwaitingPlayerInputState';
    }

    /**
     * Called when the state machine enters this state.
     * @override
     */
    async enterState() {
        // Note: AbstractTurnState's enterState receives handler and previousState as parameters.
        // Here, we use this._handler (set by super constructor) for internal logic
        // and rely on it for calls to super.enterState.

        const turnContext = this._getTurnContext();

        if (!turnContext) {
            const logger = this._handler?.getLogger?.() ?? console;
            logger.error(`${this.name}: Critical error - TurnContext is not available. Attempting to reset and idle.`);
            if (this._handler && typeof this._handler._resetTurnStateAndResources === 'function' && typeof this._handler._transitionToState === 'function') {
                this._handler._resetTurnStateAndResources(`critical-no-context-${this.name}`);
                const {TurnIdleState} = await import('./turnIdleState.js'); // Dynamic import for safety
                this._handler._transitionToState(new TurnIdleState(this._handler));
            } else {
                logger.error(`${this.name}: Cannot reset handler as context and suitable handler methods are unavailable.`);
            }
            return;
        }

        // Now that turnContext is validated, get logger and call super.enterState
        // The first argument to super.enterState is the handler, second is previousState.
        // We pass this._handler and null for previousState.
        await super.enterState(this._handler, null);
        const logger = turnContext.getLogger(); // Get logger from context *after* ensuring context exists.

        const actor = turnContext.getActor();
        if (!actor) {
            logger.error(`${this.name}: No actor found in TurnContext. Ending turn.`);
            // Consistent error message for test matching
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
            // This catch block might be less likely if getStrategy itself doesn't throw often.
            const errorMsg = `${this.name}: Error retrieving strategy for actor ${actor.id}: ${error.message}`;
            logger.error(errorMsg, {originalError: error});
            turnContext.endTurn(new Error(errorMsg, {cause: error}));
            return;
        }

        // Use strategy.constructor.name if available and meaningful, otherwise a placeholder.
        const strategyName = strategy?.constructor?.name ?? 'UnknownStrategy';
        logger.info(`${this.name}: Strategy ${strategyName} obtained for actor ${actor.id}. Requesting action decision.`);

        try {
            const turnAction = await strategy.decideAction(turnContext);

            if (!turnAction || typeof turnAction.actionDefinitionId === 'undefined') {
                // Changed to logger.warn as per typical severity for failed preconditions that are handled.
                const errorMsg = `${this.name}: Strategy for actor ${actor.id} returned an invalid or null ITurnAction (must have actionDefinitionId).`;
                logger.warn(errorMsg, {receivedAction: turnAction});
                turnContext.endTurn(new Error(errorMsg));
                return;
            }

            logger.info(`${this.name}: Actor ${actor.id} decided action: ${turnAction.actionDefinitionId}. Storing action.`);

            if (typeof turnContext.setChosenAction === 'function') {
                turnContext.setChosenAction(turnAction);
            } else {
                logger.warn(`${this.name}: ITurnContext.setChosenAction() not found. Cannot store action in context. ProcessingCommandState might rely on constructor argument.`);
            }

            logger.info(`${this.name}: Transitioning to ProcessingCommandState for actor ${actor.id}.`);

            const commandStringArg = turnAction.commandString ? turnAction.commandString : turnAction.actionDefinitionId;

            // CRITICAL FIX: Added await here
            await turnContext.requestTransition(ProcessingCommandState, [commandStringArg, turnAction]);

        } catch (error) {
            const errorMsg = `${this.name}: Error during action decision, storage, or transition for actor ${actor.id}: ${error.message}`;
            logger.error(errorMsg, {originalError: error});
            turnContext.endTurn(new Error(errorMsg, {cause: error}));
        }
    }

    /**
     * Called when the state machine exits this state.
     * @override
     */
    async exitState() {
        // Pass this._handler to super.exitState. The second argument 'nextState' is null
        // as this state doesn't determine it; the handler does.
        await super.exitState(this._handler, null);

        // Logger for this state's specific exit message.
        // Prioritize context's logger, then handler's, then console.
        const turnContext = this._getTurnContext();
        const logger = turnContext?.getLogger?.() ?? this._handler?.getLogger?.() ?? console;

        logger.debug(`${this.name}: ExitState cleanup (if any) complete.`);
    }

    /**
     * Handles submitted commands. This method should ideally not be called in the new workflow.
     * If called, it logs a warning and ends the turn.
     * Signature matches AbstractTurnState.
     * @param {BaseTurnHandler} handlerInstance - The turn handler instance. (Note: typically this._handler)
     * @param {string} commandString - The command string submitted.
     * @param {Entity} [actorEntity] - The actor entity associated with the command (may be null).
     * @override
     * @deprecated This method is part of the old workflow and should not be invoked.
     */
    async handleSubmittedCommand(handlerInstance, commandString, actorEntity) {
        // `handlerInstance` parameter is often `this._handler` when called internally.
        // Use `this._getTurnContext()` which relies on `this._handler`.
        const turnContext = this._getTurnContext();

        if (!turnContext) {
            // Use this._handler's logger if available, otherwise console.
            const logger = this._handler?.getLogger?.() ?? console;
            const actorIdForLog = actorEntity?.id ?? 'unknown actor';
            logger.error(`${this.name}: handleSubmittedCommand (for actor ${actorIdForLog}, cmd: "${commandString}") called, but no ITurnContext. Forcing handler reset.`);
            if (this._handler && typeof this._handler._resetTurnStateAndResources === 'function' && typeof this._handler._transitionToState === 'function') {
                this._handler._resetTurnStateAndResources(`no-context-submission-${this.name}`);
                const {TurnIdleState} = await import('./turnIdleState.js');
                this._handler._transitionToState(new TurnIdleState(this._handler));
            } else {
                // This case is when this._handler is null or doesn't have the methods.
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
     * @param {BaseTurnHandler} handlerInstance - The turn handler.
     * @param {object} payload - The event payload. Expected: { entityId: string, error?: Error }
     * @override
     */
    async handleTurnEndedEvent(handlerInstance, payload) {
        // Prefer this._handler for consistency if handlerInstance isn't strictly needed for a different context
        const currentHandler = handlerInstance || this._handler;
        const turnContext = this._getTurnContext(); // Relies on this._handler
        const logger = turnContext?.getLogger?.() ?? currentHandler?.getLogger?.() ?? console;

        if (!turnContext) {
            logger.warn(`${this.name}: handleTurnEndedEvent received but no turn context. Payload: ${JSON.stringify(payload)}. Deferring to superclass.`);
            // Pass currentHandler (or this._handler if handlerInstance was null)
            return super.handleTurnEndedEvent(currentHandler, payload);
        }

        const currentActor = turnContext.getActor();
        const eventActorId = payload?.entityId;

        if (currentActor && eventActorId === currentActor.id) {
            logger.info(`${this.name}: core:turn_ended event received for current actor ${currentActor.id}. Ending turn.`);
            turnContext.endTurn(payload.error || null);
        } else {
            logger.debug(`${this.name}: core:turn_ended event for actor ${eventActorId} is not for current context actor ${currentActor?.id}. Deferring to superclass.`);
            await super.handleTurnEndedEvent(currentHandler, payload);
        }
    }

    /**
     * Called when the handler is being destroyed.
     * @param {BaseTurnHandler} handlerInstance - The turn handler.
     * @override
     */
    async destroy(handlerInstance) {
        const currentHandler = handlerInstance || this._handler;
        // Prioritize handler's logger for destruction sequence, as context might be compromised or null.
        const logger = currentHandler?.getLogger?.() ?? console;

        const turnContext = currentHandler?.getTurnContext?.(); // Get context via the handler
        const actorInContext = turnContext?.getActor();

        if (actorInContext) {
            // This branch is for when an actor was active in the context.
            if (currentHandler && currentHandler._isDestroyed) {
                logger.info(`${this.name}: Handler (actor ${actorInContext.id}) is already being destroyed. Skipping turnContext.endTurn().`);
            } else if (turnContext) { // Handler not destroyed yet, and turnContext exists
                logger.info(`${this.name}: Handler destroyed while state was active for actor ${actorInContext.id}. Ending turn via turnContext.`);
                const destroyError = new Error(`Turn handler destroyed while actor ${actorInContext.id} was in ${this.name}.`);
                turnContext.endTurn(destroyError);
            } else {
                // This case (actorInContext true but turnContext false) should ideally not happen.
                // If it does, it implies an inconsistent state.
                logger.warn(`${this.name}: actorInContext (${actorInContext.id}) reported but turnContext is missing during state destroy. Cannot call endTurn.`);
            }
        } else {
            // This branch is for when no actor was active in the context,
            // or the context itself was missing.
            if (turnContext) {
                // Context exists, but getActor() returned null/undefined.
                logger.warn(`${this.name}: Handler destroyed. Actor ID from context: N/A_in_context. No specific turn to end via context if actor is missing.`);
            } else {
                // Context itself is null/undefined.
                logger.warn(`${this.name}: Handler destroyed. Actor ID from context: N/A_no_context. No specific turn to end via context if actor is missing.`);
            }
        }
        await super.destroy(currentHandler);
    }
}

// --- FILE END ---