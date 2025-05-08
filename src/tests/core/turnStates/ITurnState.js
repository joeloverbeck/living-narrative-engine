// src/core/turnStates/ITurnState.js
// --- FILE START ---

/**
 * @typedef {import('../handlers/playerTurnHandler.js').default} PlayerTurnHandler
 * @typedef {import('../../entities/entity.js').default} Entity
 * @typedef {import('../commandProcessor.js').CommandResult} CommandResult
 * @typedef {import('../constants/turnDirectives.js').default} TurnDirective
 * @typedef {import('../constants/eventIds.js').SystemEventPayloads} SystemEventPayloads
 * @typedef {import('../constants/eventIds.js').TURN_ENDED_ID} TURN_ENDED_ID_TYPE
 */

/**
 * @interface ITurnState
 * @description
 * Defines the contract for all concrete state classes that manage a specific phase
 * of a player's turn lifecycle within the {@link PlayerTurnHandler}. Each state is responsible
 * for handling specific actions or events relevant to that phase and transitioning
 * the {@link PlayerTurnHandler} (the context) to subsequent states.
 */
export class ITurnState {
    /**
     * Called when the {@link PlayerTurnHandler} transitions into this state.
     * This method allows the state to perform any setup operations required
     * when it becomes active, such as initializing resources, subscribing to events,
     * or logging entry into the state.
     *
     * @async
     * @param {PlayerTurnHandler} context - The {@link PlayerTurnHandler} instance managing this state.
     * Provides access to shared resources (logger, services) and state transition methods.
     * @param {ITurnState} [previousState] - The state from which the transition occurred, if any.
     * @returns {Promise<void>} A promise that resolves when the state entry logic is complete.
     */
    async enterState(context, previousState) {
        throw new Error("ITurnState.enterState must be implemented by concrete states.");
    }

    /**
     * Called when the {@link PlayerTurnHandler} transitions out of this state.
     * This method allows the state to perform any cleanup operations required
     * before it becomes inactive, such as releasing resources, unsubscribing from events,
     * or logging exit from the state.
     *
     * @async
     * @param {PlayerTurnHandler} context - The {@link PlayerTurnHandler} instance managing this state.
     * @param {ITurnState} [nextState] - The state to which the handler is transitioning, if known.
     * @returns {Promise<void>} A promise that resolves when the state exit logic is complete.
     */
    async exitState(context, nextState) {
        throw new Error("ITurnState.exitState must be implemented by concrete states.");
    }

    /**
     * Handles the initiation of a player's turn. This method is typically called
     * when the handler is in a state like `TurnIdleState` and `PlayerTurnHandler.startTurn()`
     * delegates the operation to the current state.
     *
     * @async
     * @param {PlayerTurnHandler} context - The {@link PlayerTurnHandler} instance.
     * @param {Entity} actor - The player entity whose turn is to be started.
     * @returns {Promise<void>} A promise that resolves when the turn initiation logic
     * within this state is complete (e.g., player prompted, transitions to `AwaitingPlayerInputState`).
     * @throws {Error} If the current state cannot handle turn initiation or if a critical error occurs.
     */
    async startTurn(context, actor) {
        throw new Error("ITurnState.startTurn must be implemented by concrete states or is not applicable for this state.");
    }

    /**
     * Handles a command string submitted by the player. This is typically relevant
     * for states like `AwaitingPlayerInputState`. The state will process or delegate
     * the command and then transition the context accordingly.
     *
     * @async
     * @param {PlayerTurnHandler} context - The {@link PlayerTurnHandler} instance.
     * @param {string} commandString - The command string submitted by the player.
     * @returns {Promise<void>} A promise that resolves when command handling is complete,
     * potentially after transitioning to a new state (e.g., `ProcessingCommandState`).
     * @throws {Error} If the current state cannot handle command submissions or an error occurs.
     */
    async handleSubmittedCommand(context, commandString) {
        throw new Error("ITurnState.handleSubmittedCommand must be implemented by concrete states or is not applicable for this state.");
    }

    /**
     * Handles the `core:turn_ended` system event. This is primarily relevant for
     * the `AwaitingExternalTurnEndState`, allowing it to react when an external
     * process signals the conclusion of the current actor's turn.
     *
     * @async
     * @param {PlayerTurnHandler} context - The {@link PlayerTurnHandler} instance.
     * @param {SystemEventPayloads[TURN_ENDED_ID_TYPE]} payload - The payload of the `core:turn_ended` event.
     * @returns {Promise<void>} A promise that resolves when the event handling is complete,
     * potentially after transitioning to `TurnEndingState`.
     * @throws {Error} If the current state cannot handle this event or an error occurs.
     */
    async handleTurnEndedEvent(context, payload) {
        throw new Error("ITurnState.handleTurnEndedEvent must be implemented by concrete states or is not applicable for this state.");
    }

    /**
     * Handles the result obtained from `ICommandProcessor.processCommand()`.
     * This method is typically called within `ProcessingCommandState` after the command
     * processor has finished. The state will then likely use `ICommandOutcomeInterpreter`.
     *
     * @async
     * @param {PlayerTurnHandler} context - The {@link PlayerTurnHandler} instance.
     * @param {Entity} actor - The actor for whom the command was processed.
     * @param {CommandResult} cmdProcResult - The result from the `ICommandProcessor`.
     * @param {string} commandString - The original command string that was processed.
     * @returns {Promise<void>} A promise that resolves when the processing of the command result is complete.
     * @throws {Error} If the current state cannot handle this action or an error occurs.
     */
    async processCommandResult(context, actor, cmdProcResult, commandString) {
        throw new Error("ITurnState.processCommandResult must be implemented by concrete states or is not applicable for this state.");
    }

    /**
     * Handles a {@link TurnDirective} received from the `ICommandOutcomeInterpreter`.
     * This method is typically called within `ProcessingCommandState` after the outcome
     * interpreter has provided a directive on how to proceed with the turn.
     *
     * @async
     * @param {PlayerTurnHandler} context - The {@link PlayerTurnHandler} instance.
     * @param {Entity} actor - The actor whose turn is being handled.
     * @param {TurnDirective} directive - The directive from the `ICommandOutcomeInterpreter`.
     * @param {CommandResult} [cmdProcResult] - The original command processing result, if relevant for the directive.
     * @returns {Promise<void>} A promise that resolves when the directive has been handled,
     * which usually involves transitioning to a new state.
     * @throws {Error} If the current state cannot handle this directive or an error occurs.
     */
    async handleDirective(context, actor, directive, cmdProcResult) {
        throw new Error("ITurnState.handleDirective must be implemented by concrete states or is not applicable for this state.");
    }

    /**
     * Handles cleanup logic specific to this state if the {@link PlayerTurnHandler}
     * is destroyed while this state is active. This allows the state to release any
     * resources it exclusively holds or perform any final actions before the handler is fully dismantled.
     *
     * @async
     * @param {PlayerTurnHandler} context - The {@link PlayerTurnHandler} instance being destroyed.
     * @returns {Promise<void>} A promise that resolves when the state-specific cleanup is complete.
     */
    async destroy(context) {
        throw new Error("ITurnState.destroy must be implemented by concrete states.");
    }

    /**
     * Returns a string identifier for the state, primarily useful for logging and debugging.
     *
     * @returns {string} The name of the state (e.g., "TurnIdleState", "AwaitingPlayerInputState").
     */
    getStateName() {
        throw new Error("ITurnState.getStateName must be implemented by concrete states.");
    }
}

// --- FILE END ---