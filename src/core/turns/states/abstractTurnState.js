// src/core/turnStates/abstractTurnState.js
// --- FILE START ---

/**
 * @typedef {import('../handlers/playerTurnHandler.js').default} PlayerTurnHandler
 * @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 * @typedef {import('../../../entities/entity.js').default} Entity
 * @typedef {import('../../commandProcessor.js').CommandResult} CommandResult
 * @typedef {import('../constants/turnDirectives.js').default} TurnDirective
 * @typedef {import('../../constants/eventIds.js').SystemEventPayloads} SystemEventPayloads
 * @typedef {import('../../constants/eventIds.js').TURN_ENDED_ID} TURN_ENDED_ID_TYPE
 * @typedef {import('./ITurnState.js').ITurnState} ITurnState_Interface // Renamed to avoid conflict with class
 */

import {ITurnState} from './ITurnState.js';

/**
 * @class AbstractTurnState
 * @implements {ITurnState_Interface}
 * @description
 * An abstract base class for turn states, implementing the {@link ITurnState_Interface}.
 * It provides default implementations for common state methods, some of which
 * may throw "Not Implemented" errors to enforce implementation in concrete subclasses.
 * This class is designed to reduce boilerplate in concrete state implementations.
 * States are constructed with a PlayerTurnHandler instance, which they use for
 * orchestrating state transitions and accessing the shared {@link ITurnContext}.
 */
export class AbstractTurnState extends ITurnState {
    /**
     * The PlayerTurnHandler (acting as the state machine's context) in which this state operates.
     * Provides access to state transition methods and the current {@link ITurnContext}.
     * @protected
     * @readonly
     * @type {PlayerTurnHandler} // Should ideally be BaseTurnHandler or a more generic handler type
     */
    _handlerContext;

    /**
     * Creates an instance of AbstractTurnState.
     * @param {PlayerTurnHandler} handlerContext - The PlayerTurnHandler instance that manages this state
     * and provides access to the ITurnContext.
     * @throws {Error} If the handlerContext is not provided.
     */
    constructor(handlerContext) {
        super();
        if (!handlerContext) {
            const errorMessage = "AbstractTurnState Constructor: PlayerTurnHandler context (handlerContext) must be provided.";
            console.error(errorMessage); // Use console.error as logger might not be available
            throw new Error(errorMessage);
        }
        this._handlerContext = handlerContext;
    }

    /**
     * Gets the PlayerTurnHandler context.
     * @returns {PlayerTurnHandler} The PlayerTurnHandler context.
     * @deprecated States should prefer accessing data via `getTurnContext()` and use
     * `_handlerContext` primarily for state transitions or direct handler methods.
     */
    getContext() {
        return this._handlerContext;
    }

    /**
     * Retrieves the current ITurnContext from the handler.
     * This is the primary way states should access actor, logger, services, etc.
     * @protected
     * @returns {ITurnContext | null} The current ITurnContext, or null if no turn is active.
     */
    _getTurnContext() {
        // Ensure _handlerContext itself is valid before trying to call methods on it.
        if (!this._handlerContext || typeof this._handlerContext.getTurnContext !== 'function') {
            // This case should ideally be prevented by the constructor guard,
            // but as a failsafe:
            console.error(`${this.getStateName()}: _handlerContext is invalid or missing getTurnContext method.`);
            return null;
        }
        const turnCtx = this._handlerContext.getTurnContext();
        if (!turnCtx) {
            // Use getLogger() on _handlerContext, which should be a BaseTurnHandler instance.
            // Ensure getLogger() exists and returns a valid logger.
            const handlerLogger = (typeof this._handlerContext.getLogger === 'function') ? this._handlerContext.getLogger() : console;
            if (handlerLogger && typeof handlerLogger.warn === 'function') {
                handlerLogger.warn(`${this.getStateName()}: Attempted to access ITurnContext via _getTurnContext(), but none is currently active on the handler.`);
            } else {
                // Fallback if logger is not standard
                console.warn(`${this.getStateName()}: Attempted to access ITurnContext via _getTurnContext(), but none is currently active on the handler. (Fallback logger)`);
            }
        }
        return turnCtx;
    }


    // --- Interface Methods with Default Implementations ---

    /**
     * Called when the {@link PlayerTurnHandler} transitions into this state.
     * Default implementation logs entry. Concrete states should override this
     * if they need to perform setup operations, and typically call super.enterState().
     *
     * @async
     * @param {PlayerTurnHandler} handlerContext - The {@link PlayerTurnHandler} instance.
     * @param {ITurnState_Interface} [previousState] - The state from which the transition occurred.
     * @returns {Promise<void>} A promise that resolves when the state entry logic is complete.
     */
    async enterState(handlerContext, previousState) {
        const turnCtx = this._getTurnContext(); // Use internal helper to get context
        const logger = turnCtx ? turnCtx.getLogger() : handlerContext.getLogger(); // Fallback to handler's logger
        const actorIdForLog = turnCtx?.getActor()?.id ?? 'N/A';
        logger.info(`${this.getStateName()}: Entered. Actor: ${actorIdForLog}. Previous state: ${previousState?.getStateName() ?? 'None'}.`);
    }

    /**
     * Called when the {@link PlayerTurnHandler} transitions out of this state.
     * Default implementation logs exit. Concrete states should override this
     * if they need to perform cleanup operations, and typically call super.exitState().
     *
     * @async
     * @param {PlayerTurnHandler} handlerContext - The {@link PlayerTurnHandler} instance.
     * @param {ITurnState_Interface} [nextState] - The state to which the handler is transitioning.
     * @returns {Promise<void>} A promise that resolves when the state exit logic is complete.
     */
    async exitState(handlerContext, nextState) {
        const turnCtx = this._getTurnContext();
        const logger = turnCtx ? turnCtx.getLogger() : handlerContext.getLogger();
        const actorIdForLog = turnCtx?.getActor()?.id ?? 'N/A';
        logger.info(`${this.getStateName()}: Exiting. Actor: ${actorIdForLog}. Transitioning to ${nextState?.getStateName() ?? 'None'}.`);
    }

    /**
     * Handles the initiation of a player's turn.
     * Default implementation logs a warning and throws an error.
     *
     * @async
     * @param {PlayerTurnHandler} handlerContext - The {@link PlayerTurnHandler} instance.
     * @param {Entity} actor - The player entity whose turn is to be started.
     * @returns {Promise<void>}
     * @throws {Error} If called in a state where it's not applicable and not overridden.
     */
    async startTurn(handlerContext, actor) {
        const logger = handlerContext.getLogger(); // Use handler's main logger
        const actorIdForLog = actor?.id ?? 'UNKNOWN_ACTOR_IN_START_TURN';
        const warningMessage = `Method 'startTurn(actorId: ${actorIdForLog})' called on state ${this.getStateName()} where it is not expected or handled.`;
        logger.warn(warningMessage);
        throw new Error(`Method 'startTurn()' is not applicable for state ${this.getStateName()}.`);
    }

    /**
     * Handles a command string submitted by the player.
     * Default implementation logs an error and throws an error.
     *
     * @async
     * @param {PlayerTurnHandler} handlerContext - The {@link PlayerTurnHandler} instance.
     * @param {string} commandString - The command string submitted by the player.
     * @returns {Promise<void>}
     * @throws {Error} Must be implemented by concrete states that handle command submissions.
     */
    async handleSubmittedCommand(handlerContext, commandString) {
        const logger = handlerContext.getLogger();
        const errorMessage = `Method 'handleSubmittedCommand(command: "${commandString}")' must be implemented by concrete state ${this.getStateName()}.`;
        logger.error(errorMessage);
        throw new Error(errorMessage);
    }

    /**
     * Handles the `core:turn_ended` system event.
     * Default implementation logs a warning.
     *
     * @async
     * @param {PlayerTurnHandler} handlerContext - The {@link PlayerTurnHandler} instance.
     * @param {SystemEventPayloads[TURN_ENDED_ID_TYPE]} payload - The payload of the `core:turn_ended` event.
     * @returns {Promise<void>}
     */
    async handleTurnEndedEvent(handlerContext, payload) {
        const logger = handlerContext.getLogger();
        const warningMessage = `Method 'handleTurnEndedEvent(payloadActorId: ${payload?.entityId})' called on state ${this.getStateName()} where it might not be expected or handled.`;
        logger.warn(warningMessage);
        // Default is no-op after warning. Specific states (like AwaitingExternalTurnEndState) will override.
    }

    /**
     * Handles the result obtained from `ICommandProcessor.processCommand()`.
     * Default implementation logs an error and throws an error.
     *
     * @async
     * @param {PlayerTurnHandler} handlerContext - The {@link PlayerTurnHandler} instance.
     * @param {Entity} actor - The actor for whom the command was processed.
     * @param {CommandResult} cmdProcResult - The result from the `ICommandProcessor`.
     * @param {string} commandString - The original command string that was processed.
     * @returns {Promise<void>}
     * @throws {Error} Must be implemented by concrete states that process command results.
     */
    async processCommandResult(handlerContext, actor, cmdProcResult, commandString) {
        const logger = handlerContext.getLogger();
        const errorMessage = `Method 'processCommandResult(actorId: ${actor?.id}, command: "${commandString}")' must be implemented by concrete state ${this.getStateName()}.`;
        logger.error(errorMessage);
        throw new Error(errorMessage);
    }

    /**
     * Handles a {@link TurnDirective} received from the `ICommandOutcomeInterpreter`.
     * Default implementation logs an error and throws an error.
     *
     * @async
     * @param {PlayerTurnHandler} handlerContext - The {@link PlayerTurnHandler} instance.
     * @param {Entity} actor - The actor whose turn is being handled.
     * @param {TurnDirective} directive - The directive from the `ICommandOutcomeInterpreter`.
     * @param {CommandResult} [cmdProcResult] - The original command processing result.
     * @returns {Promise<void>}
     * @throws {Error} Must be implemented by concrete states that handle turn directives.
     */
    async handleDirective(handlerContext, actor, directive, cmdProcResult) {
        const logger = handlerContext.getLogger();
        const errorMessage = `Method 'handleDirective(actorId: ${actor?.id}, directive: ${directive})' must be implemented by concrete state ${this.getStateName()}.`;
        logger.error(errorMessage);
        throw new Error(errorMessage);
    }

    /**
     * Handles cleanup logic specific to this state if the {@link PlayerTurnHandler}
     * is destroyed while this state is active.
     * Default implementation logs a debug message. Concrete states should override
     * this if they manage resources that need explicit cleanup.
     *
     * @async
     * @param {PlayerTurnHandler} handlerContext - The {@link PlayerTurnHandler} instance being destroyed.
     * @returns {Promise<void>} A promise that resolves when the state-specific cleanup is complete.
     */
    async destroy(handlerContext) {
        const logger = handlerContext.getLogger(); // Use handler's main logger during destruction
        logger.debug(`AbstractTurnState: ${this.getStateName()} received destroy call. No state-specific cleanup by default.`);
    }

    /**
     * Returns a string identifier for the state.
     * This default implementation returns the constructor's name.
     *
     * @returns {string} The name of the state.
     */
    getStateName() {
        return this.constructor.name;
    }
}

// --- FILE END ---