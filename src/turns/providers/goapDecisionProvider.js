/**
 * @file Provides a simple GOAP-based decision provider.
 */

import { DelegatingDecisionProvider } from './delegatingDecisionProvider.js';

/** @typedef {import('./delegatingDecisionProvider.js').DecisionDelegate} DecisionDelegate */

/**
 * @class GoapDecisionProvider
 * @augments DelegatingDecisionProvider
 * @description
 *  Minimal GOAP decision provider placeholder that always selects
 *  the first available action.
 */
export class GoapDecisionProvider extends DelegatingDecisionProvider {
  /**
   * Creates a new GoapDecisionProvider.
   *
   * @param {object} deps - Constructor dependencies
   * @param {import('../../interfaces/coreServices').ILogger} deps.logger - Logger for debug output
   * @param {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} deps.safeEventDispatcher - Dispatcher for validation errors
   * @see DecisionDelegate
   * @returns {void}
   */
  constructor({ logger, safeEventDispatcher }) {
    const delegate = async (_actor, _context, actions) => {
      const firstAction = Array.isArray(actions) ? actions[0] ?? null : null;
      const resolvedIndex =
        firstAction && Number.isInteger(firstAction.index)
          ? firstAction.index
          : 1;

      return { index: resolvedIndex };
    };
    super({ delegate, logger, safeEventDispatcher });
  }
}

export default GoapDecisionProvider;
