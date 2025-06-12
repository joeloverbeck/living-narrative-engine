// src/turns/adapters/actionIndexerAdapter.js

/**
 * @file Adapter exposing the existing ActionIndexingService
 *       through the IActionIndexer port.
 */

import { IActionIndexer } from '../ports/IActionIndexer.js';

/**
 * @class ActionIndexerAdapter
 * @implements {IActionIndexer}
 * @description
 * Adapts an instance of ActionIndexingService to the IActionIndexer interface,
 * delegating calls to index() through to ActionIndexingService.indexActions().
 */
export class ActionIndexerAdapter extends IActionIndexer {
  /**
   * @param {import('../services/actionIndexingService.js').ActionIndexingService} actionIndexingService
   *        The core service responsible for indexing actions per actor turn.
   */
  constructor(actionIndexingService) {
    super();
    /** @private */
    this._svc = actionIndexingService;
  }

  /**
   * Indexes a list of discovered actions for the given actor.
   *
   * @param {import('../../interfaces/IActionDiscoveryService.js').DiscoveredActionInfo[]} actions
   *        The actions to index.
   * @param {string} actorId - The ID of the actor whose turn this is.
   * @returns {import('../dtos/actionComposite.js').ActionComposite[]}
   *          The ordered array of action composites.
   */
  index(actions, actorId) {
    return this._svc.indexActions(actorId, actions);
  }
}
