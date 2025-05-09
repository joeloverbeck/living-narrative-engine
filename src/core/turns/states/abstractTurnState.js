// src/core/turnStates/AbstractTurnState.js
// --- FILE START ---

/**
 * @typedef {import('../handlers/playerTurnHandler.js').default} PlayerTurnHandler
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
 */
export class AbstractTurnState extends ITurnState {
    /**
     * The context (PlayerTurnHandler) in which this state operates.
     * Provides access to shared resources (logger, services) and state transition methods.
     * @protected
     * @readonly
     * @type {PlayerTurnHandler}
     */
    _context;

    /**
     * Creates an instance of AbstractTurnState.
     * @param {PlayerTurnHandler} context - The PlayerTurnHandler instance that manages this state.
     * @throws {Error} If the context is not provided.
     */
    constructor(context) {
        super();
        if (!context) {
            const errorMessage = "AbstractTurnState Constructor: PlayerTurnHandler context must be provided.";
            console.error(errorMessage); // Use console.error as logger might not be available yet
            throw new Error(errorMessage);
        }
        this._context = context;
    }

    /**
     * Gets the PlayerTurnHandler context.
     * Provides a controlled way for subclasses to access the context if needed,
     * though direct access to `this._context` is also possible for protected members.
     * @returns {PlayerTurnHandler} The PlayerTurnHandler context.
     */
    getContext() {
        return this._context;
    }

    // --- Interface Methods with Default Implementations ---

    /**
     * Called when the {@link PlayerTurnHandler} transitions into this state.
     * Default implementation is a no-op. Concrete states should override this
     * if they need to perform setup operations.
     *
     * @async
     * @param {PlayerTurnHandler} context - The {@link PlayerTurnHandler} instance.
     * @param {ITurnState_Interface} [previousState] - The state from which the transition occurred.
     * @returns {Promise<void>} A promise that resolves when the state entry logic is complete.
     */
    async enterState(context, previousState) {
        // No-op by default. Subclasses should override.
        // context.logger.debug(`AbstractTurnState: ${this.getStateName()} entered.`);
    }

    /**
     * Called when the {@link PlayerTurnHandler} transitions out of this state.
     * Default implementation is a no-op. Concrete states should override this
     * if they need to perform cleanup operations.
     *
     * @async
     * @param {PlayerTurnHandler} context - The {@link PlayerTurnHandler} instance.
     * @param {ITurnState_Interface} [nextState] - The state to which the handler is transitioning.
     * @returns {Promise<void>} A promise that resolves when the state exit logic is complete.
     */
    async exitState(context, nextState) {
        // No-op by default. Subclasses should override.
        // context.logger.debug(`AbstractTurnState: ${this.getStateName()} exited.`);
    }

    /**
     * Handles the initiation of a player's turn.
     * Default implementation logs a warning, as this method is typically only relevant
     * for an idle or initial state (e.g., `TurnIdleState`).
     *
     * @async
     * @param {PlayerTurnHandler} context - The {@link PlayerTurnHandler} instance.
     * @param {Entity} actor - The player entity whose turn is to be started.
     * @returns {Promise<void>}
     * @throws {Error} If called in a state where it's not applicable and not overridden.
     */
    async startTurn(context, actor) {
        const warningMessage = `Method 'startTurn(actorId: ${actor?.id})' called on state ${this.getStateName()} where it is not expected or handled.`;
        context.logger.warn(warningMessage);
        // Depending on strictness, could throw an error instead or in addition.
        // For now, a warning allows flexibility, but specific states might want to throw.
        throw new Error(`Method 'startTurn()' is not applicable for state ${this.getStateName()}.`);
    }

    /**
     * Handles a command string submitted by the player.
     * Default implementation throws an error, as this method is highly state-specific
     * (e.g., for `AwaitingPlayerInputState`).
     *
     * @async
     * @param {PlayerTurnHandler} context - The {@link PlayerTurnHandler} instance.
     * @param {string} commandString - The command string submitted by the player.
     * @returns {Promise<void>}
     * @throws {Error} Must be implemented by concrete states that handle command submissions.
     */
    async handleSubmittedCommand(context, commandString) {
        const errorMessage = `Method 'handleSubmittedCommand(command: "${commandString}")' must be implemented by concrete state ${this.getStateName()}.`;
        context.logger.error(errorMessage);
        throw new Error(errorMessage);
    }

    /**
     * Handles the `core:turn_ended` system event.
     * Default implementation logs a warning, as this is primarily relevant for
     * `AwaitingExternalTurnEndState`.
     *
     * @async
     * @param {PlayerTurnHandler} context - The {@link PlayerTurnHandler} instance.
     * @param {SystemEventPayloads[TURN_ENDED_ID_TYPE]} payload - The payload of the `core:turn_ended` event.
     * @returns {Promise<void>}
     * @throws {Error} If called in a state where it's not applicable and not overridden by a state that expects it.
     */
    async handleTurnEndedEvent(context, payload) {
        const warningMessage = `Method 'handleTurnEndedEvent(payloadActorId: ${payload?.entityId})' called on state ${this.getStateName()} where it might not be expected or handled.`;
        context.logger.warn(warningMessage);
        // Not throwing an error by default, as some states might passively ignore it.
        // States that *must not* receive this should throw. AwaitingExternalTurnEndState will override.
        // Consider throwing if strictness is required:
        // throw new Error(`Method 'handleTurnEndedEvent()' is not applicable for state ${this.getStateName()}.`);
    }

    /**
     * Handles the result obtained from `ICommandProcessor.processCommand()`.
     * Default implementation throws an error, as this method is typically only relevant
     * for `ProcessingCommandState`.
     *
     * @async
     * @param {PlayerTurnHandler} context - The {@link PlayerTurnHandler} instance.
     * @param {Entity} actor - The actor for whom the command was processed.
     * @param {CommandResult} cmdProcResult - The result from the `ICommandProcessor`.
     * @param {string} commandString - The original command string that was processed.
     * @returns {Promise<void>}
     * @throws {Error} Must be implemented by concrete states that process command results.
     */
    async processCommandResult(context, actor, cmdProcResult, commandString) {
        const errorMessage = `Method 'processCommandResult(actorId: ${actor?.id}, command: "${commandString}")' must be implemented by concrete state ${this.getStateName()}.`;
        context.logger.error(errorMessage);
        throw new Error(errorMessage);
    }

    /**
     * Handles a {@link TurnDirective} received from the `ICommandOutcomeInterpreter`.
     * Default implementation throws an error, as this method is typically only relevant
     * for `ProcessingCommandState`.
     *
     * @async
     * @param {PlayerTurnHandler} context - The {@link PlayerTurnHandler} instance.
     * @param {Entity} actor - The actor whose turn is being handled.
     * @param {TurnDirective} directive - The directive from the `ICommandOutcomeInterpreter`.
     * @param {CommandResult} [cmdProcResult] - The original command processing result.
     * @returns {Promise<void>}
     * @throws {Error} Must be implemented by concrete states that handle turn directives.
     */
    async handleDirective(context, actor, directive, cmdProcResult) {
        const errorMessage = `Method 'handleDirective(actorId: ${actor?.id}, directive: ${directive})' must be implemented by concrete state ${this.getStateName()}.`;
        context.logger.error(errorMessage);
        throw new Error(errorMessage);
    }

    /**
     * Handles cleanup logic specific to this state if the {@link PlayerTurnHandler}
     * is destroyed while this state is active.
     * Default implementation is a no-op with a debug log. Concrete states should
     * override this if they manage resources that need explicit cleanup upon handler destruction.
     *
     * @async
     * @param {PlayerTurnHandler} context - The {@link PlayerTurnHandler} instance being destroyed.
     * @returns {Promise<void>} A promise that resolves when the state-specific cleanup is complete.
     */
    async destroy(context) {
        // No-op by default. Subclasses should override if they acquire resources
        // that need to be released when the handler is destroyed.
        context.logger.debug(`AbstractTurnState: ${this.getStateName()} received destroy call. No state-specific cleanup by default.`);
    }

    /**
     * Returns a string identifier for the state.
     * This default implementation returns the constructor's name.
     * Concrete states can override this if a different naming convention is desired,
     * but it's often sufficient.
     *
     * @returns {string} The name of the state.
     */
    getStateName() {
        return this.constructor.name;
    }
}

// --- FILE END ---