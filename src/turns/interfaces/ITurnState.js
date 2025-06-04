// src/core/turnStates/ITurnState.js
// --- FILE START ---

/**
 * @typedef {import('../handlers/baseTurnHandler.js').BaseTurnHandler} BaseTurnHandler
 * // ^ States still need BaseTurnHandler for _transitionToState, passed via constructor.
 * @typedef {import('./ITurnContext.js').ITurnContext} ITurnContext
 * @typedef {import('../../entities/entity.js').default} Entity
 * @typedef {import('../../commands/commandProcessor.js').CommandResult} CommandResult
 * @typedef {import('../constants/turnDirectives.js').default} TurnDirectiveEnum
 * @typedef {import('../../constants/eventIds.js').SystemEventPayloads} SystemEventPayloads
 * @typedef {import('../../constants/eventIds.js').TURN_ENDED_ID} TURN_ENDED_ID_TYPE
 */

/**
 * @interface ITurnState
 * @description
 * Defines the contract for all concrete state classes that manage a specific phase
 * of an actor's turn lifecycle. Each state is responsible for handling specific
 * actions or events relevant to that phase and can trigger transitions to subsequent states
 * via the BaseTurnHandler instance it holds. States primarily interact with turn-specific
 * data and services through the ITurnContext.
 */
export class ITurnState {
  /**
   * Called when the BaseTurnHandler transitions into this state.
   * Allows the state to perform setup operations.
   *
   * @async
   * @param {BaseTurnHandler} handler - The BaseTurnHandler instance managing this state.
   * States use this for transitions (handler._transitionToState) and to get ITurnContext (handler.getTurnContext).
   * @param {ITurnState} [previousState] - The state from which the transition occurred.
   * @returns {Promise<void>} A promise that resolves when state entry logic is complete.
   */
  async enterState(handler, previousState) {
    throw new Error(
      'ITurnState.enterState must be implemented by concrete states.'
    );
  }

  /**
   * Called when the BaseTurnHandler transitions out of this state.
   * Allows the state to perform cleanup operations.
   *
   * @async
   * @param {BaseTurnHandler} handler - The BaseTurnHandler instance managing this state.
   * @param {ITurnState} [nextState] - The state to which the handler is transitioning.
   * @returns {Promise<void>} A promise that resolves when state exit logic is complete.
   */
  async exitState(handler, nextState) {
    throw new Error(
      'ITurnState.exitState must be implemented by concrete states.'
    );
  }

  /**
   * Handles the initiation of an actor's turn.
   * Typically called by BaseTurnHandler.startTurn() delegating to the current (e.g., Idle) state.
   * The state will use handler.getTurnContext() to access the ITurnContext prepared by the handler.
   *
   * @async
   * @param {BaseTurnHandler} handler - The BaseTurnHandler instance.
   * @param {Entity} actorEntity - The entity whose turn is to be started (already set in ITurnContext by handler).
   * @returns {Promise<void>}
   * @throws {Error} If the current state cannot handle turn initiation.
   */
  async startTurn(handler, actorEntity) {
    throw new Error(
      'ITurnState.startTurn must be implemented or is not applicable for this state.'
    );
  }

  /**
   * Handles a command string submitted by an actor.
   * The state accesses command details and actor via handler.getTurnContext().
   *
   * @async
   * @param {BaseTurnHandler} handler - The BaseTurnHandler instance.
   * @param {string} commandString - The command string.
   * @param {Entity} actorEntity - The actor who submitted the command (for verification against context).
   * @returns {Promise<void>}
   * @throws {Error} If the current state cannot handle command submissions.
   */
  async handleSubmittedCommand(handler, commandString, actorEntity) {
    throw new Error(
      'ITurnState.handleSubmittedCommand must be implemented or is not applicable.'
    );
  }

  /**
   * Handles the `core:turn_ended` system event.
   * The state accesses event details and current actor via handler.getTurnContext().
   *
   * @async
   * @param {BaseTurnHandler} handler - The BaseTurnHandler instance.
   * @param {SystemEventPayloads[TURN_ENDED_ID_TYPE]} payload - The event payload.
   * @returns {Promise<void>}
   * @throws {Error} If the current state cannot handle this event.
   */
  async handleTurnEndedEvent(handler, payload) {
    throw new Error(
      'ITurnState.handleTurnEndedEvent must be implemented or is not applicable.'
    );
  }

  /**
   * Handles the result from ICommandProcessor.processCommand().
   * The state uses handler.getTurnContext() to access ITurnContext for services like ICommandOutcomeInterpreter.
   *
   * @async
   * @param {BaseTurnHandler} handler - The BaseTurnHandler instance.
   * @param {Entity} actor - The actor (from ITurnContext).
   * @param {CommandResult} cmdProcResult - The result from ICommandProcessor.
   * @param {string} commandString - The original command string.
   * @returns {Promise<void>}
   * @throws {Error} If the current state cannot handle this action.
   */
  async processCommandResult(handler, actor, cmdProcResult, commandString) {
    throw new Error(
      'ITurnState.processCommandResult must be implemented or is not applicable.'
    );
  }

  /**
   * Handles a TurnDirective from ICommandOutcomeInterpreter.
   * The state uses handler.getTurnContext() for current actor and services.
   *
   * @async
   * @param {BaseTurnHandler} handler - The BaseTurnHandler instance.
   * @param {Entity} actor - The actor (from ITurnContext).
   * @param {TurnDirectiveEnum} directive - The directive.
   * @param {CommandResult} [cmdProcResult] - The original command result.
   * @returns {Promise<void>}
   * @throws {Error} If the current state cannot handle this directive.
   */
  async handleDirective(handler, actor, directive, cmdProcResult) {
    throw new Error(
      'ITurnState.handleDirective must be implemented or is not applicable.'
    );
  }

  /**
   * Handles cleanup if the BaseTurnHandler is destroyed while this state is active.
   *
   * @async
   * @param {BaseTurnHandler} handler - The BaseTurnHandler instance being destroyed.
   * @returns {Promise<void>}
   */
  async destroy(handler) {
    throw new Error(
      'ITurnState.destroy must be implemented by concrete states.'
    );
  }

  /**
   * Returns a string identifier for the state.
   *
   * @returns {string} The name of the state.
   */
  getStateName() {
    throw new Error(
      'ITurnState.getStateName must be implemented by concrete states.'
    );
  }
}

// --- FILE END ---
