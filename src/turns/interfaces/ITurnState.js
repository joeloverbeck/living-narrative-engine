import { ICommandHandlingState } from './iCommandHandlingState.js';
import { ITurnLifecycleState } from './iTurnLifecycleState.js';
// src/turns/states/ITurnState.js
// ──────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {import('../interfaces/ITurnStateHost.js').ITurnStateHost} ITurnStateHost
 * @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 * @typedef {import('../../entities/entity.js').default} Entity
 * @typedef {import('../../types/commandResult.js').CommandResult} CommandResult
 * @typedef {import('../constants/turnDirectives.js').default} TurnDirectiveEnum
 * @typedef {import('../../constants/eventIds.js').TURN_ENDED_ID} TURN_ENDED_ID_TYPE
 */

/**
 * @interface ITurnState
 * @implements {ICommandHandlingState}
 * @implements {ITurnLifecycleState}
 * @description
 * Contract for all concrete state classes that manage a specific phase
 * of an actor's turn lifecycle.  States trigger transitions through the
 * {@link ITurnStateHost} instance supplied to every method.
 */
export class ITurnState {
  /**
   * Called when the host transitions into this state.
   *
   * @async
   * @param {ITurnStateHost} handler        - The object implementing {@link ITurnStateHost}.
   * @param {ITurnState}     [previousState] - The state from which the transition occurred.
   * @returns {Promise<void>}
   */
  async enterState(handler, previousState) {
    throw new Error(
      'ITurnState.enterState must be implemented by concrete states.'
    );
  }

  /**
   * Called when the host transitions out of this state.
   *
   * @async
   * @param {ITurnStateHost} handler    - The state-host object.
   * @param {ITurnState}     [nextState] - The state to which the host is transitioning.
   * @returns {Promise<void>}
   */
  async exitState(handler, nextState) {
    throw new Error(
      'ITurnState.exitState must be implemented by concrete states.'
    );
  }

  /**
   * Handles the initiation of an actor's turn.
   * Typically invoked by the host's `startTurn` delegating to the current state.
   *
   * @async
   * @param {ITurnStateHost} handler      - The host instance.
   * @param {Entity}         actorEntity  - The actor whose turn is starting.
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
   *
   * @async
   * @param {ITurnStateHost} handler        - The host instance.
   * @param {string}         commandString  - The raw command string.
   * @param {Entity}         actorEntity    - The submitting actor.
   * @returns {Promise<void>}
   */
  async handleSubmittedCommand(handler, commandString, actorEntity) {
    throw new Error(
      'ITurnState.handleSubmittedCommand must be implemented or is not applicable.'
    );
  }

  /**
   * Handles the `core:turn_ended` system event.
   *
   * @async
   * @param {ITurnStateHost}                          handler  - The host instance.
   * @param {SystemEventPayloads[TURN_ENDED_ID_TYPE]} payload  - Event payload.
   * @returns {Promise<void>}
   */
  async handleTurnEndedEvent(handler, payload) {
    throw new Error(
      'ITurnState.handleTurnEndedEvent must be implemented or is not applicable.'
    );
  }

  /**
   * Handles the result from `ICommandProcessor.processCommand`.
   *
   * @async
   * @param {ITurnStateHost} handler         - The host instance.
   * @param {Entity}         actor           - The actor from the current context.
   * @param {CommandResult}  cmdProcResult   - Processor result.
   * @param {string}         commandString   - Original command.
   * @returns {Promise<void>}
   */
  async processCommandResult(handler, actor, cmdProcResult, commandString) {
    throw new Error(
      'ITurnState.processCommandResult must be implemented or is not applicable.'
    );
  }

  /**
   * Handles a TurnDirective from `ICommandOutcomeInterpreter`.
   *
   * @async
   * @param {ITurnStateHost}  handler        - The host instance.
   * @param {Entity}          actor          - The actor.
   * @param {TurnDirectiveEnum} directive    - Directive to handle.
   * @param {CommandResult}   [cmdProcResult] - Original command result.
   * @returns {Promise<void>}
   */
  async handleDirective(handler, actor, directive, cmdProcResult) {
    throw new Error(
      'ITurnState.handleDirective must be implemented or is not applicable.'
    );
  }

  /**
   * Called if the host is destroyed while this state is active.
   *
   * @async
   * @param {ITurnStateHost} handler - The host being destroyed.
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
   * @returns {string}
   */
  getStateName() {
    throw new Error(
      'ITurnState.getStateName must be implemented by concrete states.'
    );
  }

  /**
   * True if this state represents an idle system with no active turn.
   *
   * @returns {boolean}
   */
  isIdle() {
    throw new Error(
      'ITurnState.isIdle must be implemented by concrete states.'
    );
  }

  /**
   * True if this state is handling the conclusion of a turn.
   *
   * @returns {boolean}
   */
  isEnding() {
    throw new Error(
      'ITurnState.isEnding must be implemented by concrete states.'
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────────
