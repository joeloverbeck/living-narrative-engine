/**
 * @file Adapter exposing the existing ActionIndexingService
 * through the IActionIndexer port.
 */

import { IActionIndexer } from '../ports/IActionIndexer.js';

/**
 * @class ActionIndexerAdapter
 * @implements {IActionIndexer}
 * @description
 * Adapts an instance of ActionIndexingService to the IActionIndexer interface,
 * delegating calls through to the service.
 * This version includes defensive guards to ensure correct usage.
 */
export class ActionIndexerAdapter extends IActionIndexer {
  /** @private */
  _svc;

  /**
   * @param {import('../services/actionIndexingService.js').ActionIndexingService} actionIndexingService
   * The core service responsible for indexing actions per actor turn.
   */
  constructor(actionIndexingService) {
    super();

    // --- Constructor Guard ---
    if (
      !actionIndexingService ||
      typeof actionIndexingService.indexActions !== 'function' ||
      typeof actionIndexingService.resolve !== 'function' ||
      typeof actionIndexingService.beginTurn !== 'function'
    ) {
      throw new TypeError(
        'ActionIndexerAdapter: constructor requires a valid actionIndexingService instance with indexActions, resolve, and beginTurn methods.'
      );
    }

    this._svc = actionIndexingService;
  }

  /**
   * Signals the beginning of an actor's turn, delegating to the underlying service
   * to clear its cache for that actor.
   *
   * @param {string} actorId - The ID of the actor starting their turn.
   */
  beginTurn(actorId) {
    if (typeof actorId !== 'string' || actorId.trim() === '') {
      throw new TypeError(
        `ActionIndexerAdapter.beginTurn: "actorId" parameter must be a non-empty string. Received: ${typeof actorId}`
      );
    }
    this._svc.beginTurn(actorId);
  }

  /**
   * Indexes a list of discovered actions for the given actor.
   *
   * @param {import('../../interfaces/IActionDiscoveryService.js').DiscoveredActionInfo[]} actions
   * The actions to index.
   * @param {string} actorId - The ID of the actor whose turn this is.
   * @returns {import('../dtos/actionComposite.js').ActionComposite[]}
   * The ordered array of action composites.
   */
  index(actions, actorId) {
    // --- Method Argument Guards ---
    if (!Array.isArray(actions)) {
      throw new TypeError(
        `ActionIndexerAdapter.index: "actions" parameter must be an array. Received: ${typeof actions}`
      );
    }
    if (typeof actorId !== 'string' || actorId.trim() === '') {
      throw new TypeError(
        `ActionIndexerAdapter.index: "actorId" parameter must be a non-empty string. Received: ${typeof actorId}`
      );
    }

    return this._svc.indexActions(actorId, actions);
  }

  /**
   * Resolves an indexed action choice for the actor.
   *
   * @param {string} actorId
   * @param {number} chosenIndex
   * @returns {import('../dtos/actionComposite.js').ActionComposite}
   */
  resolve(actorId, chosenIndex) {
    if (typeof actorId !== 'string' || actorId.trim() === '') {
      throw new TypeError(
        `ActionIndexerAdapter.resolve: "actorId" parameter must be a non-empty string. Received: ${typeof actorId}`
      );
    }
    if (!Number.isInteger(chosenIndex)) {
      throw new TypeError(
        `ActionIndexerAdapter.resolve: "chosenIndex" must be an integer. Received: ${typeof chosenIndex}`
      );
    }
    return this._svc.resolve(actorId, chosenIndex);
  }
}
