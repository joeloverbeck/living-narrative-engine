/**
 * @module LLMDecisionProvider
 */

import { ITurnDecisionProvider } from '../interfaces/ITurnDecisionProvider.js';

/**
 * @class LLMDecisionProvider
 * @extends ITurnDecisionProvider
 * @description
 *  Decision provider that delegates to an LLM chooser implementation.
 */
export class LLMDecisionProvider extends ITurnDecisionProvider {
  /**
   * @param {{ llmChooser: import('../../turns/ports/ILLMChooser').ILLMChooser }} deps
   */
  constructor({ llmChooser }) {
    super();
    /** @protected @type {import('../../turns/ports/ILLMChooser').ILLMChooser} */
    this.llmChooser = llmChooser;
  }

  /**
   * @override
   * @async
   * @param {import('../../entities/entity.js').default} actor
   * @param {import('../interfaces/ITurnContext.js').ITurnContext} context
   * @param {import('../dtos/actionComposite.js').ActionComposite[]} actions
   * @param {AbortSignal} [abortSignal]
   * @returns {Promise<import('../../turns/interfaces/ITurnDecisionProvider').ITurnDecisionResult>}
   */
  async decide(actor, context, actions, abortSignal) {
    const { index, speech, thoughts, notes } = await this.llmChooser.choose({
      actor,
      context,
      actions,
      abortSignal,
    });

    return {
      chosenIndex: index,
      speech,
      thoughts,
      notes,
    };
  }
}
