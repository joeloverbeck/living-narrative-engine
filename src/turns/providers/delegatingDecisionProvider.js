/**
 * @file Provides a decision provider that delegates action choice to a custom
 * callback.
 */

import { AbstractDecisionProvider } from './abstractDecisionProvider.js';

/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

/**
 * @class DelegatingDecisionProvider
 * @augments AbstractDecisionProvider
 * @description
 *  Generic decision provider that simply forwards the choose logic to a
 *  provided delegate function.
 */
export class DelegatingDecisionProvider extends AbstractDecisionProvider {
  /**
   * @param {object} deps - Constructor dependencies
   * @param {(actor: import('../../entities/entity.js').default,
   *  context: import('../interfaces/ITurnContext.js').ITurnContext,
   *  actions: import('../dtos/actionComposite.js').ActionComposite[],
   *  abortSignal?: AbortSignal
   * ) => Promise<{ index: number, speech?: string|null, thoughts?: string|null, notes?: string[]|null }>} deps.delegate
   *        Delegate function performing the actual choice logic.
   * @param {import('../../interfaces/coreServices').ILogger} deps.logger - Logger for error reporting
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher - Event dispatcher for validation errors
   */
  constructor({ delegate, logger, safeEventDispatcher }) {
    super({ logger, safeEventDispatcher });
    if (typeof delegate !== 'function') {
      throw new Error(
        'DelegatingDecisionProvider requires a delegate function'
      );
    }
    this._delegate = delegate;
  }

  /**
   * @protected
   * @override
   */
  async choose(actor, context, actions, abortSignal) {
    return this._delegate(actor, context, actions, abortSignal);
  }
}

export default DelegatingDecisionProvider;
