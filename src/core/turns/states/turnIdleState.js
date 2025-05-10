// src/core/turnStates/turnIdleState.js
// --- FILE START ---

/**
 * @typedef {import('../handlers/baseTurnHandler.js').BaseTurnHandler} BaseTurnHandler
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
 * Represents the state of the BaseTurnHandler when no turn is currently active.
 * This is the initial state of the handler and the state to which it returns
 * after a turn has fully completed or the handler is reset.
 */
export class TurnIdleState extends AbstractTurnState {
    /**
     * Creates an instance of TurnIdleState.
     * @param {BaseTurnHandler} handler - The BaseTurnHandler instance that manages this state.
     */
    constructor(handler) {
        super(handler);
    }

    /** @override */
    getStateName() {
        return "TurnIdleState";
    }

    /**
     * @override
     * @param {BaseTurnHandler} handler
     * @param {ITurnState_Interface} [previousState]
     */
    async enterState(handler, previousState) {
        // AbstractTurnState.enterState logs entry. It uses this._getTurnContext() for actorId.
        // At this point, ITurnContext is likely null as we are entering Idle.
        await super.enterState(handler, previousState); // Uses this._handler internally

        const logger = handler.getLogger(); // Get logger from handler (context is likely null)

        logger.debug(`${this.getStateName()}: Ensuring clean state by calling handler._resetTurnStateAndResources().`);
        // _resetTurnStateAndResources clears ITurnContext, currentActor, and other turn-specific flags on the handler.
        // It's crucial this is called by the handler itself.
        handler._resetTurnStateAndResources(`enterState-${this.getStateName()}`);

        // BaseTurnHandler._resetTurnStateAndResources already calls _setCurrentActorInternal(null).
        // No need to call it again here explicitly if base class handles it.
        logger.debug(`${this.getStateName()}: Entry complete. Handler is now idle.`);
    }

    /**
     * @override
     * @param {BaseTurnHandler} handler
     * @param {ITurnState_Interface} [nextState]
     */
    async exitState(handler, nextState) {
        // AbstractTurnState.exitState logs exit. It uses this._getTurnContext().
        // When exiting Idle to start a new turn, ITurnContext should have been created by handler.startTurn().
        await super.exitState(handler, nextState); // Uses this._handler internally
        // Additional logging from AbstractTurnState.exitState happens after this if any.
    }

    /**
     * @override
     * @param {BaseTurnHandler} handler
     * @param {Entity} actorEntity
     */
    async startTurn(handler, actorEntity) {
        // handler.startTurn() (e.g. PlayerTurnHandler.startTurn) should have:
        // 1. Set the current actor on the handler.
        // 2. Created and set the ITurnContext on the handler via _setCurrentTurnContextInternal.
        // This state's job is to validate that and transition.

        const turnCtx = this._getTurnContext(); // Retrieves ITurnContext from this._handler
        const logger = turnCtx ? turnCtx.getLogger() : handler.getLogger(); // Prefer context's logger

        logger.info(`${this.getStateName()}: Received startTurn for actor ${actorEntity?.id ?? 'UNKNOWN_ENTITY'}.`);

        if (!actorEntity || typeof actorEntity.id === 'undefined') {
            const errorMsg = `${this.getStateName()}: startTurn called with invalid actorEntity.`;
            logger.error(errorMsg);
            throw new Error(errorMsg);
        }

        if (!turnCtx) {
            const errorMsg = `${this.getStateName()}: ITurnContext not available on the handler after handler.startTurn() was called. This indicates an issue in the concrete handler's startTurn implementation.`;
            logger.error(errorMsg);
            // Attempt to recover by resetting and re-entering Idle.
            handler._resetTurnStateAndResources(`critical-no-context-${this.getStateName()}`);
            await handler._transitionToState(new TurnIdleState(handler));
            throw new Error(errorMsg);
        }

        const contextActor = turnCtx.getActor();
        if (!contextActor || contextActor.id !== actorEntity.id) {
            const errorMsg = `${this.getStateName()}: Actor in ITurnContext ('${contextActor?.id}') does not match actor provided to state's startTurn ('${actorEntity.id}').`;
            logger.error(errorMsg);
            handler._resetTurnStateAndResources(`actor-mismatch-${this.getStateName()}`);
            await handler._transitionToState(new TurnIdleState(handler));
            throw new Error(errorMsg);
        }

        logger.debug(`${this.getStateName()}: ITurnContext confirmed for actor ${contextActor.id}. Transitioning to AwaitingPlayerInputState.`);
        try {
            // AwaitingPlayerInputState constructor takes the handler instance.
            await handler._transitionToState(new AwaitingPlayerInputState(handler));
            logger.info(`${this.getStateName()}: Successfully transitioned to AwaitingPlayerInputState for actor ${contextActor.id}.`);
        } catch (error) {
            logger.error(`${this.getStateName()}: Failed to transition to AwaitingPlayerInputState for ${contextActor.id}. Error: ${error.message}`, error);
            handler._resetTurnStateAndResources(`transition-fail-${this.getStateName()}`);
            await handler._transitionToState(new TurnIdleState(handler)); // Attempt to re-idle
            throw error; // Re-throw after attempting recovery
        }
    }

    /** @override */
    async handleSubmittedCommand(handler, commandString, actorEntity) {
        const logger = handler.getLogger(); // Context likely null
        const message = `${this.getStateName()}: Command ('${commandString}') submitted by ${actorEntity?.id} but no turn is active.`;
        logger.warn(message);
        return super.handleSubmittedCommand(handler, commandString, actorEntity); // Throws error
    }

    /** @override */
    async handleTurnEndedEvent(handler, payload) {
        const logger = handler.getLogger(); // Context likely null
        const message = `${this.getStateName()}: handleTurnEndedEvent called (for ${payload?.entityId}) but no turn is active.`;
        logger.warn(message);
        return super.handleTurnEndedEvent(handler, payload); // Base implementation logs warning
    }

    /** @override */
    async processCommandResult(handler, actor, cmdProcResult, commandString) {
        const logger = handler.getLogger(); // Context likely null
        const message = `${this.getStateName()}: processCommandResult called (for ${actor?.id}) but no turn is active.`;
        logger.warn(message);
        return super.processCommandResult(handler, actor, cmdProcResult, commandString); // Throws error
    }

    /** @override */
    async handleDirective(handler, actor, directive, cmdProcResult) {
        const logger = handler.getLogger(); // Context likely null
        const message = `${this.getStateName()}: handleDirective called (for ${actor?.id}) but no turn is active.`;
        logger.warn(message);
        return super.handleDirective(handler, actor, directive, cmdProcResult); // Throws error
    }

    /** @override */
    async destroy(handler) {
        const logger = handler.getLogger(); // Use handler's main logger
        logger.info(`${this.getStateName()}: BaseTurnHandler is being destroyed while in idle state.`);
        // BaseTurnHandler.destroy() calls _resetTurnStateAndResources.
        // AbstractTurnState.destroy() just logs.
        await super.destroy(handler);
        logger.debug(`${this.getStateName()}: Destroy handling complete.`);
    }
}

// --- FILE END ---