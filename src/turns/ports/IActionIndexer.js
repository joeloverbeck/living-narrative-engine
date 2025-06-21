/**
 * @interface IActionIndexer
 * @description Defines the contract for a service that indexes a list of
 * discovered actions for a given actor's turn.
 * @function index
 * @param {import('../../interfaces/IActionDiscoveryService.js').DiscoveredActionInfo[]} actions - List of discovered actions.
 * @param {string} actorId - The ID of the actor.
 * @returns {import('../dtos/actionComposite.js').ActionComposite[]} Ordered list of action composites.
 */
export class IActionIndexer {
  /**
   * Signals the beginning of an actor's turn, allowing the indexer to clear
   * any prior-turn state for that actor.
   * This method is optional; calling code should use optional chaining: `indexer.beginTurn?.(actorId)`.
   *
   * @param {string} actorId The ID of the actor whose turn is beginning.
   * @returns {void}
   */
  beginTurn(actorId) {
    // Interface method, not meant for direct execution.
  }

  /**
   * Indexes a list of discovered actions for the actor.
   *
   * @param {import('../../interfaces/IActionDiscoveryService.js').DiscoveredActionInfo[]} actions
   * @param {string} actorId
   * @returns {import('../dtos/actionComposite.js').ActionComposite[]}
   */
  index(actions, actorId) {
    throw new Error('Interface method');
  }

  /**
   * Resolves a previously indexed list by numeric choice.
   *
   * @param {string} actorId
   * @param {number} chosenIndex
   * @returns {import('../dtos/actionComposite.js').ActionComposite}
   */
  resolve(actorId, chosenIndex) {
    throw new Error('Interface method');
  }
}
