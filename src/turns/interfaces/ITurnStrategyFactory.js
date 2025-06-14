// src/turns/factories/turnStrategyFactory.js
/**
 * @file Defines the interface for turn strategy factories.
 * @module turns/factories/turnStrategyFactory
 */

/**
 * @interface ITurnStrategyFactory
 * @description Defines the contract for a factory that creates turn strategies for different actor types.
 * This abstraction allows handlers to be decoupled from concrete strategy implementations.
 */
export class ITurnStrategyFactory {
  /**
   * Creates a turn strategy for an actor.
   *
   * @param {string} actorId - The ID of the actor for whom the strategy is being created.
   * @returns {import('../interfaces/IActorTurnStrategy.js').IActorTurnStrategy} A configured instance of a turn strategy.
   * @throws {Error} If the method is not implemented by a concrete class.
   */
  create(actorId) {
    throw new Error(
      `Not implemented: ITurnStrategyFactory.create. ActorID: ${actorId}`
    );
  }
}
