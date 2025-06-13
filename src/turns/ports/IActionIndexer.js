// src/turns/ports/IActionIndexer.js
/**
 * @interface IActionIndexer
 * @description Indexes a list of discovered actions for a given actor.
 * @function index
 * @param {DiscoveredActionInfo[]} actions - List of discovered actions.
 * @param {string} actorId - The ID of the actor.
 * @returns {ActionComposite[]} Ordered list of action composites.
 */
export class IActionIndexer {
  /**
   * Indexes a list of discovered actions for the actor.
   *
   * @param {DiscoveredActionInfo[]} actions
   * @param {string} actorId
   * @returns {ActionComposite[]}
   */
  index(actions, actorId) {
    throw new Error('Interface method');
  }
}
