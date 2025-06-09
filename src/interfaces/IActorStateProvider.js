/**
 * @file This module contains the interface for building data about an actor's state.
 * @see src/interfaces/IActorStateProvider.js
 */

/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../turns/dtos/AIGameStateDTO.js').AIActorStateDTO} AIActorStateDTO */

/**
 * @interface IActorStateProvider
 * @description Defines the contract for a service that builds the AIActorStateDTO.
 */
export class IActorStateProvider {
  /**
   * Builds the AIActorStateDTO for a given actor.
   * @param {Entity} actor - The AI-controlled entity.
   * @param {ILogger} logger - An instance of the logger.
   * @returns {AIActorStateDTO & {components: Record<string, any>}} The actor's state DTO.
   */
  build(actor, logger) {
    throw new Error("Method 'build(actor, logger)' must be implemented.");
  }
}
