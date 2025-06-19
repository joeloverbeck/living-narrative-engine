// src/turns/interfaces/ITurnLifecycleState.js
/**
 * @typedef {import("../../constants/eventIds.js").SystemEventPayloads} SystemEventPayloads
 * @typedef {import("../../constants/eventIds.js").TURN_ENDED_ID} TURN_ENDED_ID_TYPE
 */

/**
 * @interface ITurnLifecycleState
 * @description Interface for states involved in starting or ending
 * an actor's turn.
 */
export class ITurnLifecycleState {
  /**
   * Called when a new turn begins for the provided actor.
   *
   * @param {import('./ITurnStateHost.js').ITurnStateHost} handler
   * @param {import('../../entities/entity.js').default} actorEntity
   * @returns {Promise<void>}
   */
  async startTurn(handler, actorEntity) {
    throw new Error('ITurnLifecycleState.startTurn must be implemented.');
  }

  /**
   * Handles a `core:turn_ended` event payload.
   *
   * @param {import('./ITurnStateHost.js').ITurnStateHost} handler
   * @param {SystemEventPayloads[TURN_ENDED_ID_TYPE]} payload
   * @returns {Promise<void>}
   */
  async handleTurnEndedEvent(handler, payload) {
    throw new Error(
      'ITurnLifecycleState.handleTurnEndedEvent must be implemented.'
    );
  }
}
