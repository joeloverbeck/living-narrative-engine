/**
 * @module LLMDecisionProvider
 */

import { DelegatingDecisionProvider } from './delegatingDecisionProvider.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

/** @typedef {import('./delegatingDecisionProvider.js').DecisionDelegate} DecisionDelegate */

/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

/**
 * @class LLMDecisionProvider
 * @augments AbstractDecisionProvider
 * @description
 *  Decision provider that delegates to an LLM chooser implementation.
 */
export class LLMDecisionProvider extends DelegatingDecisionProvider {
  /**
   * @type {import('../../turns/ports/ILLMChooser').ILLMChooser}
   * @private
   */
  #llmChooser;
  /**
   * Creates a new LLMDecisionProvider.
   *
   * @param {{
   *  llmChooser: import('../../turns/ports/ILLMChooser').ILLMChooser,
   *  logger: import('../../interfaces/coreServices').ILogger,
   *  safeEventDispatcher: ISafeEventDispatcher
   * }} deps - Constructor dependencies
   * @see DecisionDelegate
   * @returns {void}
   */
  constructor({ llmChooser, logger, safeEventDispatcher }) {
    validateDependency(llmChooser, 'llmChooser', logger, {
      requiredMethods: ['choose'],
    });
    const delegate = (actor, context, actions, abortSignal) =>
      this.#llmChooser.choose({
        actor,
        context,
        actions,
        abortSignal,
      });

    super({ delegate, logger, safeEventDispatcher });
    this.#llmChooser = llmChooser;
  }
}
