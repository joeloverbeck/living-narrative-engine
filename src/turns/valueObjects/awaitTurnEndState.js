// src/turns/valueObjects/awaitTurnEndState.js

/**
 * @file Defines an immutable value object to represent the state of awaiting a turn-end event.
 * @module AwaitTurnEndState
 */

/**
 * @description An immutable value object representing whether the system is waiting for an external turn-end event, and for which actor.
 * @class AwaitTurnEndState
 */
export class AwaitTurnEndState {
  /** @type {boolean} */
  #isWaiting;
  /** @type {string|null} */
  #actorId;

  /**
   * @private
   * @param {boolean} isWaiting
   * @param {string|null} actorId
   */
  constructor(isWaiting, actorId = null) {
    this.#isWaiting = isWaiting;
    this.#actorId = actorId;
    Object.freeze(this);
  }

  /**
   * Represents the idle state where no event is being awaited.
   *
   * @private
   * @type {AwaitTurnEndState}
   */
  static #IDLE_STATE = new AwaitTurnEndState(false, null);

  /**
   * Factory method for the idle (non-waiting) state.
   *
   * @returns {AwaitTurnEndState} The singleton idle instance.
   */
  static idle() {
    return AwaitTurnEndState.#IDLE_STATE;
  }

  /**
   * Factory method for the state of waiting for a specific actor's turn to end.
   *
   * @param {string|null} actorId - The ID of the actor being waited for.
   * @returns {AwaitTurnEndState} A new, frozen instance representing the waiting state.
   */
  static waitingFor(actorId) {
    if (!actorId || typeof actorId !== 'string' || actorId.trim() === '') {
      // It's valid to wait for an unknown actor in some edge cases.
      return new AwaitTurnEndState(true, null);
    }
    return new AwaitTurnEndState(true, actorId);
  }

  /**
   * Checks if this state represents an active wait.
   *
   * @returns {boolean} True if waiting, false otherwise.
   */
  isWaiting() {
    return this.#isWaiting;
  }

  /**
   * Gets the ID of the actor being waited for.
   *
   * @returns {string|null} The actor's ID, or null if not waiting or if the actor is unknown.
   */
  getActorId() {
    return this.#actorId;
  }

  /**
   * Provides a string representation for logging purposes.
   *
   * @returns {string}
   */
  toString() {
    if (!this.#isWaiting) {
      return 'State: Idle';
    }
    return `State: Waiting for Actor '${this.#actorId ?? 'ANY'}'`;
  }
}
