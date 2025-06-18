/**
 * @file Provides a simple GOAP-based decision provider.
 */

import { DelegatingDecisionProvider } from './delegatingDecisionProvider.js';

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
   */
  constructor({ logger, safeEventDispatcher }) {
    const delegate = async (_actor, _context, _actions) => {
      return { index: 1 };
    };
    super({ delegate, logger, safeEventDispatcher });
  }
}

export default GoapDecisionProvider;
