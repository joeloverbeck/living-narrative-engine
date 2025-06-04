// src/core/interfaces/ITurnHandler.js
// --- FILE START (Entire file content as requested) ---

/** @typedef {import('../../entities/entity.js').default} Entity */

/**
 * @interface ITurnHandler
 * @classdesc Defines the contract for handling the specific logic required during a single
 * entity's turn. Implementations will vary based on the type of entity (e.g., PlayerTurnHandler,
 * AITurnHandler). It receives the actor and is responsible for initiating their action(s)
 * for that turn. Turn completion is signaled externally (e.g., via an event port), not
 * by the resolution of the promise returned by `startTurn`.
 */
export class ITurnHandler {
  /**
   * Initiates the logic required for the specified actor's turn.
   * For a player, this might involve enabling input and prompting for a command.
   * For an AI, this might involve starting the evaluation of state and choosing an action.
   * The handler should signal completion externally (e.g., via `ITurnEndPort`) once the
   * actor's turn activities are finished.
   * @function startTurn // <<< RENAMED from handleTurn (Ticket #7)
   * @async
   * @param {Entity} actor - The entity whose turn is being handled.
   * @returns {Promise<void>} A promise that resolves when the turn *initiation*
   * is complete (e.g., the first prompt is sent, AI evaluation begins), or rejects
   * if a critical error occurs during initiation itself. This promise DOES NOT
   * represent the completion of the entire turn.
   * @throws {Error} Implementations might throw if a critical error occurs during
   * the turn initiation process that prevents it from starting.
   */
  async startTurn(actor) {
    // <<< RENAMED from handleTurn
    throw new Error('ITurnHandler.startTurn method not implemented.');
  }

  /**
   * Optional: A method to gracefully shut down the handler, potentially
   * forcing an end to any active turn it's managing.
   * @function destroy
   * @returns {void | Promise<void>}
   */
  destroy() {
    // Default implementation does nothing, override if needed.
  }
}
// --- FILE END ---
