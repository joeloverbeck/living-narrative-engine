/**
 * @module LLMDecisionProvider
 */

import { AbstractDecisionProvider } from './abstractDecisionProvider.js';

/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

/**
 * @class LLMDecisionProvider
 * @augments AbstractDecisionProvider
 * @description
 *  Decision provider that delegates to an LLM chooser implementation.
 */
export class LLMDecisionProvider extends AbstractDecisionProvider {
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
    super({ logger, safeEventDispatcher });
    /** @protected @type {import('../../turns/ports/ILLMChooser').ILLMChooser} */
    this.llmChooser = llmChooser;
  }

  /**
   * Delegates decision making to an LLM chooser.
   *
   * @async
   * @protected
   * @override
   * @param {import('../../entities/entity.js').default} actor - Acting entity
   * @param {import('../interfaces/ITurnContext.js').ITurnContext} context - Turn context
   * @param {import('../dtos/actionComposite.js').ActionComposite[]} actions - Indexed action list
   * @param {AbortSignal} [abortSignal] - Optional cancellation signal
   * @returns {Promise<{ index: number, speech?: string|null, thoughts?: string|null, notes?: string[]|null }>} Result selected by the LLM
   */
  async choose(actor, context, actions, abortSignal) {
    const { index, speech, thoughts, notes } = await this.llmChooser.choose({
      actor,
      context,
      actions,
      abortSignal,
    });
    return { index, speech, thoughts, notes };
  }
}
