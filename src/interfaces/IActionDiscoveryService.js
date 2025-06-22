// src/interfaces/IActionDiscoveryService.js

/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../entities/entity.js').default} Entity */

/**
 * @typedef {object} DiscoveredActionInfo
 * @property {string} id - The unique ID of the action definition.
 * @property {string} name - The human-readable name of the action.
 * @property {string} command - The formatted command string.
 * @property {string} [description] - Optional. The detailed description of the action.
 * @property {object} params - Parameters for the action (at minimum { targetId?: string }).
 * @property {string} [params.targetId] - Optional target entity or location ID.
 */

/**
 * @typedef {object} DiscoveredActionsResult
 * @property {DiscoveredActionInfo[]} actions - Successfully discovered actions.
 * @property {Error[]} errors - Errors encountered during discovery.
 */

/**
 * @interface IActionDiscoveryService
 * @description Defines the contract for discovering valid actions available to an entity in the current game state.
 */
export class IActionDiscoveryService {
  /**
   * Determines all valid actions that the specified entity can currently perform.
   *
   * @param {Entity} actingEntity - The entity for whom to discover actions.
   * @param {ActionContext} context - The current context, including location and other relevant state.
   * @returns {Promise<DiscoveredActionsResult>}
   * @throws {Error}
   */
  async getValidActions(actingEntity, context) {
    throw new Error(
      'IActionDiscoveryService.getValidActions method not implemented.'
    );
  }
}
