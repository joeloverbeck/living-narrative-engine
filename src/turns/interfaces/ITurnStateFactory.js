// src/turns/interfaces/ITurnStateFactory.js

/**
 * @typedef {import('./ITurnState.js').ITurnState} ITurnState
 * @typedef {import('./ITurnStateHost.js').ITurnStateHost} ITurnStateHost
 * @typedef {import('../interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction
 */

/**
 * @class ITurnStateFactory
 * @interface
 * @description
 * Defines the interface for a factory that creates various turn state instances.
 */
export class ITurnStateFactory {
  /**
   * Creates an initial turn state instance (typically an Idle state).
   *
   * @param {ITurnStateHost} handler
   * @returns {ITurnState} The created initial turn state.
   */
  createInitialState(handler) {
    throw new Error(
      'ITurnStateFactory.createInitialState must be implemented by concrete classes.'
    );
  }

  /**
   * Creates an idle turn state instance.
   *
   * @param {ITurnStateHost} handler
   * @returns {ITurnState} The created idle turn state.
   */
  createIdleState(handler) {
    throw new Error(
      'ITurnStateFactory.createIdleState must be implemented by concrete classes.'
    );
  }

  /**
   * Creates an ending turn state instance.
   *
   * @param {ITurnStateHost} handler
   * @param {string} actorId - The ID of the actor whose turn is ending.
   * @param {Error|null} error - Any error that occurred during the turn.
   * @returns {ITurnState} The created ending turn state.
   */
  createEndingState(handler, actorId, error) {
    throw new Error(
      'ITurnStateFactory.createEndingState must be implemented by concrete classes.'
    );
  }

  /**
   * Creates an Awaiting Player Input state instance.
   *
   * @param {ITurnStateHost} handler
   * @returns {ITurnState} The created awaiting player input state.
   */
  createAwaitingInputState(handler) {
    throw new Error(
      'ITurnStateFactory.createAwaitingInputState must be implemented by concrete classes.'
    );
  }

  /**
   * Creates a Processing Command state instance.
   *
   * @param {ITurnStateHost} handler
   * @param {string} commandString - The command string to be processed.
   * @param {ITurnAction} turnAction - The turn action associated with the command.
   * @returns {ITurnState} The created processing command state.
   */
  createProcessingCommandState(handler, commandString, turnAction) {
    throw new Error(
      'ITurnStateFactory.createProcessingCommandState must be implemented by concrete classes.'
    );
  }

  /**
   * Creates an Awaiting External Turn End state instance.
   * This state pauses execution and waits for a specific event to signal the turn has concluded.
   *
   * @param {ITurnStateHost} handler - The handler that owns the state machine.
   * @returns {ITurnState} The created awaiting external turn end state.
   */
  createAwaitingExternalTurnEndState(handler) {
    throw new Error(
      'ITurnStateFactory.createAwaitingExternalTurnEndState must be implemented by concrete classes.'
    );
  }
}
