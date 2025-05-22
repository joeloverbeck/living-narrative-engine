// src/core/turnStates/turnIdleState.js
// --- FILE START ---

/**
 * @typedef {import('../handlers/baseTurnHandler.js').BaseTurnHandler} BaseTurnHandler
 * @typedef {import('../../entities/entity.js').default} Entity
 * @typedef {import('../interfaces/ITurnState.js').ITurnState} ITurnState_Interface
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
 * It interacts exclusively through ITurnContext for operational needs and
 * BaseTurnHandler for state transitions.
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
     * @param {BaseTurnHandler} handler - The BaseTurnHandler managing this state.
     * @param {ITurnState_Interface} [previousState] - The state from which the transition occurred.
     */
    async enterState(handler, previousState) {
        // AbstractTurnState.enterState logs entry. ITurnContext is likely null here.
        await super.enterState(handler, previousState); // Uses this._handler internally

        // Use handler's logger as ITurnContext is typically null or being cleared when entering Idle.
        const logger = handler.getLogger();

        logger.debug(`${this.getStateName()}: Ensuring clean state by calling handler._resetTurnStateAndResources().`);
        // The handler is responsible for resetting its own per-turn state and resources.
        // This call ensures that any previous turn's context, actor, or flags are cleared.
        handler._resetTurnStateAndResources(`enterState-${this.getStateName()}`);

        logger.debug(`${this.getStateName()}: Entry complete. Handler is now idle.`);
    }

    /**
     * @override
     * @param {BaseTurnHandler} handler - The BaseTurnHandler managing this state.
     * @param {ITurnState_Interface} [nextState] - The state to which the handler is transitioning.
     */
    async exitState(handler, nextState) {
        // When exiting Idle to start a new turn, ITurnContext should have been created by the concrete handler's startTurn().
        // AbstractTurnState.exitState will use this._getTurnContext() to log with actor ID if context is available.
        await super.exitState(handler, nextState); // Uses this._handler internally
    }

    /**
     * @override
     * @param {BaseTurnHandler} handler - The BaseTurnHandler instance.
     * @param {Entity} actorEntity - The entity whose turn is to be started.
     */
    async startTurn(handler, actorEntity) {
        // The concrete handler (e.g., one derived from BaseTurnHandler) is responsible for creating and setting
        // the ITurnContext before calling this state's startTurn method.
        // This state must then verify the context via this._getTurnContext().

        // Retrieve ITurnContext via the method provided by AbstractTurnState.
        const turnCtx = this._getTurnContext();
        // Use ITurnContext's logger if available; otherwise, fallback to handler's logger.
        const logger = turnCtx ? turnCtx.getLogger() : handler.getLogger();

        const actorIdForLog = actorEntity?.id ?? 'UNKNOWN_ENTITY';
        logger.info(`${this.getStateName()}: Received startTurn for actor ${actorIdForLog}.`);

        if (!actorEntity || typeof actorEntity.id === 'undefined') {
            const errorMsg = `${this.getStateName()}: startTurn called with invalid actorEntity.`;
            logger.error(errorMsg);
            // As per technical hints, if context is invalid, re-transition to TurnIdleState.
            // Ensure resources are reset before re-idling.
            handler._resetTurnStateAndResources(`invalid-actor-${this.getStateName()}`);
            await handler._transitionToState(new TurnIdleState(handler)); // Stay in Idle
            throw new Error(errorMsg); // Propagate error after attempting recovery
        }

        // Validate the presence and correctness of ITurnContext.
        if (!turnCtx) {
            const errorMsg = `${this.getStateName()}: ITurnContext is missing or invalid. Expected concrete handler to set it up. Actor: ${actorIdForLog}.`;
            logger.error(errorMsg);
            handler._resetTurnStateAndResources(`missing-context-${this.getStateName()}`);
            await handler._transitionToState(new TurnIdleState(handler)); // Re-transition to Idle
            throw new Error(errorMsg);
        }

        const contextActor = turnCtx.getActor();
        if (!contextActor || contextActor.id !== actorEntity.id) {
            const errorMsg = `${this.getStateName()}: Actor in ITurnContext ('${contextActor?.id}') does not match actor provided to state's startTurn ('${actorEntity.id}').`;
            logger.error(errorMsg);
            handler._resetTurnStateAndResources(`actor-mismatch-${this.getStateName()}`);
            await handler._transitionToState(new TurnIdleState(handler)); // Re-transition to Idle
            throw new Error(errorMsg);
        }

        // All services and data needed by TurnIdleState are accessed via ITurnContext.
        // (In this case, primarily for logging and actor verification).
        logger.debug(`${this.getStateName()}: ITurnContext confirmed for actor ${contextActor.id}. Transitioning to AwaitingPlayerInputState.`);
        try {
            // Transition to AwaitingPlayerInputState via handler._transitionToState().
            // AwaitingPlayerInputState constructor takes the handler instance.
            await handler._transitionToState(new AwaitingPlayerInputState(handler));
            logger.info(`${this.getStateName()}: Successfully transitioned to AwaitingPlayerInputState for actor ${contextActor.id}.`);
        } catch (error) {
            logger.error(`${this.getStateName()}: Failed to transition to AwaitingPlayerInputState for ${contextActor.id}. Error: ${error.message}`, error);
            // Attempt to recover by resetting and re-entering Idle.
            handler._resetTurnStateAndResources(`transition-fail-${this.getStateName()}`);
            await handler._transitionToState(new TurnIdleState(handler)); // Re-transition to Idle
            throw error; // Re-throw after attempting recovery
        }
    }

    /** @override */
    async handleSubmittedCommand(handler, commandString, actorEntity) {
        // Idle state should not handle commands. Logging should use ITurnContext if available (though unlikely here),
        // or handler's logger. AbstractTurnState's default implementation logs an error and throws.
        const turnCtx = this._getTurnContext();
        const logger = turnCtx ? turnCtx.getLogger() : handler.getLogger();
        const actorIdForLog = actorEntity?.id ?? 'UNKNOWN_ENTITY';
        const message = `${this.getStateName()}: Command ('${commandString}') submitted by ${actorIdForLog} but no turn is active (handler is Idle).`;
        logger.warn(message);
        // Delegate to AbstractTurnState which will log an error and throw.
        return super.handleSubmittedCommand(handler, commandString, actorEntity);
    }

    /** @override */
    async handleTurnEndedEvent(handler, payload) {
        // Idle state should not typically handle turn_ended events directly as no turn is active.
        // AbstractTurnState's default implementation logs a warning.
        const turnCtx = this._getTurnContext();
        const logger = turnCtx ? turnCtx.getLogger() : handler.getLogger();
        const payloadActorId = payload?.entityId ?? 'UNKNOWN_ENTITY';
        const message = `${this.getStateName()}: handleTurnEndedEvent called (for ${payloadActorId}) but no turn is active (handler is Idle).`;
        logger.warn(message);
        // Delegate to AbstractTurnState.
        return super.handleTurnEndedEvent(handler, payload);
    }

    /** @override */
    async processCommandResult(handler, actor, cmdProcResult, commandString) {
        // Idle state should not be processing command results.
        // AbstractTurnState's default implementation logs an error and throws.
        const turnCtx = this._getTurnContext();
        const logger = turnCtx ? turnCtx.getLogger() : handler.getLogger();
        const actorIdForLog = actor?.id ?? 'UNKNOWN_ENTITY';
        const message = `${this.getStateName()}: processCommandResult called (for ${actorIdForLog}) but no turn is active.`;
        logger.warn(message);
        return super.processCommandResult(handler, actor, cmdProcResult, commandString);
    }

    /** @override */
    async handleDirective(handler, actor, directive, cmdProcResult) {
        // Idle state should not be handling directives.
        // AbstractTurnState's default implementation logs an error and throws.
        const turnCtx = this._getTurnContext();
        const logger = turnCtx ? turnCtx.getLogger() : handler.getLogger();
        const actorIdForLog = actor?.id ?? 'UNKNOWN_ENTITY';
        const message = `${this.getStateName()}: handleDirective called (for ${actorIdForLog}) but no turn is active.`;
        logger.warn(message);
        return super.handleDirective(handler, actor, directive, cmdProcResult);
    }

    /** @override */
    async destroy(handler) {
        // ITurnContext is expected to be null. Use handler's logger.
        const logger = handler.getLogger();
        logger.info(`${this.getStateName()}: BaseTurnHandler is being destroyed while in idle state.`);
        // BaseTurnHandler.destroy() already calls _resetTurnStateAndResources.
        // AbstractTurnState.destroy() just logs.
        await super.destroy(handler); // Ensures logging from AbstractTurnState
        logger.debug(`${this.getStateName()}: Destroy handling complete.`);
    }
}

// --- FILE END ---