/**
 * @file Provides a decision provider that delegates action choice to a custom
 * callback.
 */

import { AbstractDecisionProvider } from './abstractDecisionProvider.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

/**
 * @typedef {(
 *  actor: import('../../entities/entity.js').default,
 *  context: import('../interfaces/ITurnContext.js').ITurnContext,
 *  actions: import('../dtos/actionComposite.js').ActionComposite[],
 *  abortSignal?: AbortSignal
 * ) => Promise<{ index: number, speech?: string|null, thoughts?: string|null, notes?: Array<{text: string, subject: string, context?: string, timestamp?: string}>|null }>} DecisionDelegate
 * Callback used by decision providers to select an action.
 */

/**
 * @class DelegatingDecisionProvider
 * @augments AbstractDecisionProvider
 * @description
 *  Generic decision provider that simply forwards the choose logic to a
 *  provided delegate function.
 */
export class DelegatingDecisionProvider extends AbstractDecisionProvider {
  /**
   * @type {DecisionDelegate}
   * @private
   */
  #delegate;

  /**
   * @param {object} deps - Constructor dependencies
   * @param {DecisionDelegate} deps.delegate -
   *        Delegate function performing the actual choice logic.
   * @param {import('../../interfaces/coreServices').ILogger} deps.logger - Logger for error reporting
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher - Event dispatcher for validation errors
   * @returns {void}
   */
  constructor({ delegate, logger, safeEventDispatcher }) {
    super({ logger, safeEventDispatcher });
    validateDependency(delegate, 'delegate', logger, { isFunction: true });
    this.#delegate = delegate;
  }

  /**
   * @protected
   * @override
   */
  async choose(actor, context, actions, abortSignal) {
    return this.#delegate(actor, context, actions, abortSignal);
  }
}

export default DelegatingDecisionProvider;
