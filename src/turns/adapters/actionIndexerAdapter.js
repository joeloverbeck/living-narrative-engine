// src/turns/adapters/actionIndexerAdapter.js

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
 * delegating calls to index() through to ActionIndexingService.indexActions().
 * This version includes defensive guards to ensure correct usage.
 */
export class ActionIndexerAdapter extends IActionIndexer {
  /**
   * @param {import('../services/actionIndexingService.js').ActionIndexingService} actionIndexingService
   * The core service responsible for indexing actions per actor turn.
   */
  constructor(actionIndexingService) {
    super();

    // --- Constructor Guard ---
    // This guard ensures the adapter cannot be created without a valid dependency.
    // It checks that the provided service is an object and has the method we need.
    if (
      !actionIndexingService ||
      typeof actionIndexingService.indexActions !== 'function'
    ) {
      throw new TypeError(
        'ActionIndexerAdapter: constructor requires a valid actionIndexingService instance with an indexActions method.'
      );
    }

    /** @private */
    this._svc = actionIndexingService;
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
    // These guards check the types of the arguments at runtime, preventing bad
    // data from being passed deeper into the application logic.
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

    // If all guards pass, proceed with the actual logic.
    return this._svc.indexActions(actorId, actions);
  }
}
