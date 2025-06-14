/**
 * @typedef {import('./IActorTurnStrategy.js').IActorTurnStrategy} IActorTurnStrategy
 */

/**
 * @class IAIPlayerStrategyFactory
 * @interface
 * @description
 * Defines the interface for a factory that creates AI player turn strategies.
 * Concrete implementations of this factory are expected to receive their dependencies
 * via their constructor, caching them for use in the create method.
 */
export class IAIPlayerStrategyFactory {
  /**
   * Creates a new AI player strategy instance using the dependencies
   * provided to the factory's constructor.
   *
   * @param {string} actorId - The ID of the actor for whom the strategy is being created.
   * @returns {IActorTurnStrategy} The created AI player strategy.
   * @throws {Error} If the method is not implemented by a concrete class.
   */
  create(actorId) {
    throw new Error(
      `IAIPlayerStrategyFactory.create must be implemented by concrete classes. ActorID: ${actorId}`
    );
  }
}
