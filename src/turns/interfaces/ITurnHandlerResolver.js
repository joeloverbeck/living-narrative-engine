// src/core/interfaces/ITurnHandlerResolver.js

/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('./ITurnHandler.js').ITurnHandler} ITurnHandler */

// --- ITurnHandlerResolver ---
/**
 * @interface ITurnHandlerResolver
 * @classdesc Defines the contract for a service responsible for resolving the appropriate
 * turn handler based on the actor entity. This helps decouple the game loop from specific
 * handler implementations.
 */
export class ITurnHandlerResolver {
  /**
   * Resolves the correct turn handler implementation for the given actor entity.
   * @function resolveHandler
   * @async
   * @param {Entity} actor - The entity whose turn handler needs to be resolved.
   * @returns {Promise<ITurnHandler | null>} A promise that resolves with the appropriate
   * ITurnHandler instance for the actor, or null if no specific handler is found or applicable.
   * @throws {Error} Implementations might throw if the actor is invalid or a critical
   * error occurs during resolution.
   */
  async resolveHandler(actor) {
    throw new Error(
      'ITurnHandlerResolver.resolveHandler method not implemented.'
    );
  }
}
