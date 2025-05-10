// src/core/turnStates/turnIdleState.js
// --- FILE START ---

/**
 * @typedef {import('../handlers/playerTurnHandler.js').default} PlayerTurnHandler
 * @typedef {import('../../../entities/entity.js').default} Entity
 * @typedef {import('./ITurnState.js').ITurnState} ITurnState_Interface
 * @typedef {import('./abstractTurnState.js').AbstractTurnState} AbstractTurnState_Base
 * @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 */

import {AbstractTurnState} from './abstractTurnState.js';
// The AwaitingPlayerInputState is required for the transition in startTurn.
import {AwaitingPlayerInputState} from './awaitingPlayerInputState.js';


/**
 * @class TurnIdleState
 * @extends AbstractTurnState_Base
 * @implements {ITurnState_Interface}
 * @description
 * Represents the state of the PlayerTurnHandler when no turn is currently active.
 * This is the initial state of the handler before `startTurn()` is called for the
 * first time, and the state to which the handler returns after a turn has fully
 * completed and been reset, or after the handler itself has been reset/destroyed.
 */
export class TurnIdleState extends AbstractTurnState {
    /**
     * Creates an instance of TurnIdleState.
     * @param {PlayerTurnHandler} handlerContext - The PlayerTurnHandler instance that manages this state.
     */
    constructor(handlerContext) {
        super(handlerContext);
    }

    /**
     * Returns the unique identifier for this state.
     * @override
     * @returns {string} The state name "TurnIdleState".
     */
    getStateName() {
        return "TurnIdleState";
    }

    /**
     * Called when the {@link PlayerTurnHandler} transitions into this state.
     * Logs entry and ensures the handler is in a clean, idle state by resetting
     * turn-specific resources (which includes clearing the ITurnContext on the handler)
     * and clearing the current actor on the handler.
     * @override
     * @async
     * @param {PlayerTurnHandler} handlerContext - The {@link PlayerTurnHandler} instance.
     * @param {ITurnState_Interface} [previousState] - The state from which the transition occurred.
     * @returns {Promise<void>}
     */
    async enterState(handlerContext, previousState) {
        const previousStateName = previousState?.getStateName() ?? 'None';
        const logger = handlerContext.getLogger(); // Use the handler's main logger

        logger.info(`${this.getStateName()}: Entered. Previous state: ${previousStateName}.`);

        logger.debug(`${this.getStateName()}: Ensuring clean state by calling handlerContext._resetTurnStateAndResources().`);
        // _resetTurnStateAndResources clears subscriptions, resets currentActor on handler to null,
        // nullifies ITurnContext on handler, and other turn-specific flags.
        handlerContext._resetTurnStateAndResources(`enterState-${this.getStateName()}`);

        // Explicitly setting currentActor on handler to null.
        // BaseTurnHandler._resetTurnStateAndResources calls _setCurrentActorInternal(null).
        // This is redundant if _resetTurnStateAndResources is comprehensive but kept for explicitness if needed by specific PlayerTurnHandler logic.
        if (handlerContext.getCurrentActor() !== null) {
            logger.debug(`${this.getStateName()}: Explicitly setting currentActor on handler to null via _setCurrentActorInternal.`);
            handlerContext._setCurrentActorInternal(null); // Corrected to use protected method
        }
        logger.debug(`${this.getStateName()}: Entry complete. Handler is now idle.`);
    }

    /**
     * Called when the {@link PlayerTurnHandler} transitions out of this state.
     * Logs exit from this state.
     * @override
     * @async
     * @param {PlayerTurnHandler} handlerContext - The {@link PlayerTurnHandler} instance.
     * @param {ITurnState_Interface} [nextState] - The state to which the handler is transitioning.
     * @returns {Promise<void>}
     */
    async exitState(handlerContext, nextState) {
        const nextStateName = nextState?.getStateName() ?? 'None';
        // At this point, if transitioning to a state that uses TurnContext,
        // the TurnContext should have been created by handler's startTurn method.
        const turnCtx = this._getTurnContext(); // Uses this._handlerContext which is set by AbstractTurnState constructor
        const logger = turnCtx ? turnCtx.getLogger() : handlerContext.getLogger(); // Fallback to handler's logger

        logger.info(`${this.getStateName()}: Exiting. Transitioning to ${nextStateName}.`);
        await super.exitState(handlerContext, nextState); // Call super for consistent logging from AbstractTurnState if it provides any
    }

    /**
     * Initiates a new turn for the specified actor.
     * This method relies on the handler's `startTurn` (e.g. PlayerTurnHandler.startTurn) having already
     * created and set up the {@link ITurnContext}. This state's `startTurn` primarily
     * validates that a turn context is now available for the actor and then
     * transitions the handler to the {@link AwaitingPlayerInputState}.
     * @override
     * @async
     * @param {PlayerTurnHandler} handlerContext - The {@link PlayerTurnHandler} instance.
     * @param {Entity} actorEntity - The player entity whose turn is to be started.
     * @returns {Promise<void>}
     * @throws {Error} If the actor is invalid, ITurnContext is not set, or transition fails.
     */
    async startTurn(handlerContext, actorEntity) {
        const turnCtx = this._getTurnContext(); // This uses this._handlerContext.getTurnContext()
        // Logger for this method's operations. If turnCtx exists, use its logger, otherwise handler's.
        const logger = turnCtx ? turnCtx.getLogger() : handlerContext.getLogger();

        logger.info(`${this.getStateName()}: Received startTurn for actor ${actorEntity?.id ?? 'UNKNOWN'}.`);

        if (!actorEntity || typeof actorEntity.id === 'undefined') {
            const errorMsg = `${this.getStateName()}: startTurn called with invalid actorEntity. Actor is required.`;
            logger.error(errorMsg);
            throw new Error(errorMsg); // This error should be caught by the caller (e.g., handler's startTurn)
        }

        if (!turnCtx) {
            const errorMsg = `${this.getStateName()}: startTurn called, but ITurnContext is not available on the handler. This indicates an issue in the handler's startTurn implementation.`;
            logger.error(errorMsg);
            // Attempt to reset to a clean state if possible, though this is a critical failure.
            // This logic assumes handlerContext has _setCurrentActorInternal and _transitionToState.
            if (typeof handlerContext._setCurrentActorInternal === 'function') {
                handlerContext._setCurrentActorInternal(null);
            }
            await handlerContext._transitionToState(new TurnIdleState(handlerContext)); // Re-enter idle
            throw new Error(errorMsg);
        }

        const contextActor = turnCtx.getActor();
        if (!contextActor || contextActor.id !== actorEntity.id) {
            const errorMsg = `${this.getStateName()}: Actor in TurnContext ('${contextActor?.id}') does not match actor provided to startTurn ('${actorEntity.id}').`;
            logger.error(errorMsg);
            if (typeof handlerContext._setCurrentActorInternal === 'function') {
                handlerContext._setCurrentActorInternal(null); // Corrected method
            }
            await handlerContext._transitionToState(new TurnIdleState(handlerContext)); // Re-enter idle
            throw new Error(errorMsg);
        }

        logger.debug(`${this.getStateName()}: ITurnContext confirmed for actor ${contextActor.id}. Preparing to transition to AwaitingPlayerInputState.`);
        try {
            await handlerContext._transitionToState(new AwaitingPlayerInputState(handlerContext));
            logger.info(`${this.getStateName()}: Successfully transitioned to AwaitingPlayerInputState for actor ${contextActor.id}.`);
        } catch (error) {
            logger.error(`${this.getStateName()}: Failed to transition to AwaitingPlayerInputState for actor ${contextActor.id}. Error: ${error.message}`, error);
            if (typeof handlerContext._setCurrentActorInternal === 'function') {
                handlerContext._setCurrentActorInternal(null); // Clear actor if transition failed
            }
            if (handlerContext._resetTurnStateAndResources) {
                handlerContext._resetTurnStateAndResources(`failure-in-idle-startTurn-transition`);
            }
            await handlerContext._transitionToState(new TurnIdleState(handlerContext));
            throw error;
        }
    }

    /**
     * Handles command submissions. This method should not be called when the handler is idle.
     * @override
     */
    async handleSubmittedCommand(handlerContext, commandString) {
        const logger = handlerContext.getLogger();
        const message = `${this.getStateName()}: Command ('${commandString}') submitted but no turn is active.`;
        logger.warn(message); // Corrected from direct access to _getTurnContext()?.getLogger()
        return super.handleSubmittedCommand(handlerContext, commandString); // Throws error
    }

    /**
     * Handles turn ended events. This method should not be called when the handler is idle.
     * @override
     */
    async handleTurnEndedEvent(handlerContext, payload) {
        const logger = handlerContext.getLogger();
        const message = `${this.getStateName()}: handleTurnEndedEvent called but no turn is active. Actor in payload: ${payload?.entityId}.`;
        logger.warn(message);
        return super.handleTurnEndedEvent(handlerContext, payload); // Base implementation logs warning
    }

    /**
     * Handles processing of command results. Not applicable for idle state.
     * @override
     */
    async processCommandResult(handlerContext, actor, cmdProcResult, commandString) {
        const logger = handlerContext.getLogger();
        const message = `${this.getStateName()}: processCommandResult called but no turn is active/processing. Actor: ${actor?.id}.`;
        logger.warn(message);
        return super.processCommandResult(handlerContext, actor, cmdProcResult, commandString); // Throws error
    }

    /**
     * Handles turn directives. Not applicable for idle state.
     * @override
     */
    async handleDirective(handlerContext, actor, directive, cmdProcResult) {
        const logger = handlerContext.getLogger();
        const message = `${this.getStateName()}: handleDirective called but no turn is active/processing. Actor: ${actor?.id}, Directive: ${directive}.`;
        logger.warn(message);
        return super.handleDirective(handlerContext, actor, directive, cmdProcResult); // Throws error
    }

    /**
     * Handles the destruction of the handler context while in this state.
     * @override
     */
    async destroy(handlerContext) {
        const logger = handlerContext.getLogger(); // Use handler's main logger
        logger.info(`${this.getStateName()}: PlayerTurnHandler is being destroyed while in idle state.`);
        logger.debug(`${this.getStateName()}: Calling _resetTurnStateAndResources during destroy to ensure clean state.`);
        if (typeof handlerContext._resetTurnStateAndResources === 'function') {
            handlerContext._resetTurnStateAndResources(`destroy-${this.getStateName()}`);
        }
        logger.debug(`${this.getStateName()}: Destroy handling complete.`);
        // No call to super.destroy() here as per original state file, assuming BaseTurnHandler's destroy manages overall flow.
    }
}

// --- FILE END ---