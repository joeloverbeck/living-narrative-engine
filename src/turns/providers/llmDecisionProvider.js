/**
 * @module LLMDecisionProvider
 */

import { DelegatingDecisionProvider } from './delegatingDecisionProvider.js';

/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

/**
 * @class LLMDecisionProvider
 * @augments AbstractDecisionProvider
 * @description
 *  Decision provider that delegates to an LLM chooser implementation.
 */
export class LLMDecisionProvider extends DelegatingDecisionProvider {
  /**
   * Creates a new LLMDecisionProvider.
   *
   * @param {{
   *  llmChooser: import('../../turns/ports/ILLMChooser').ILLMChooser,
   *  logger: import('../../interfaces/coreServices').ILogger,
   *  safeEventDispatcher: ISafeEventDispatcher
   * }} deps - Constructor dependencies
   */
  constructor({ llmChooser, logger, safeEventDispatcher }) {
    const delegate = (actor, context, actions, abortSignal) =>
      llmChooser.choose({
        actor,
        context,
        actions,
        abortSignal,
      });

    super({ delegate, logger, safeEventDispatcher });
    /** @protected @type {import('../../turns/ports/ILLMChooser').ILLMChooser} */
    this.llmChooser = llmChooser;
  }
}
