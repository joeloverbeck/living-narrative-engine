/**
 * @module LLMDecisionProvider
 */

import { ITurnDecisionProvider } from '../interfaces/ITurnDecisionProvider.js';
import { assertValidActionIndex } from '../../utils/validationUtils.js';

/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

/**
 * @class LLMDecisionProvider
 * @augments ITurnDecisionProvider
 * @description
 *  Decision provider that delegates to an LLM chooser implementation.
 */
export class LLMDecisionProvider extends ITurnDecisionProvider {
  /**
   * @param {{
   *  llmChooser: import('../../turns/ports/ILLMChooser').ILLMChooser,
   *  logger: import('../../interfaces/coreServices').ILogger
   *  safeEventDispatcher: ISafeEventDispatcher
   * }} deps
   */
  constructor({ llmChooser, logger, safeEventDispatcher }) {
    super();
    /** @protected @type {import('../../turns/ports/ILLMChooser').ILLMChooser} */
    this.llmChooser = llmChooser;
    /** @protected @type {import('../../interfaces/coreServices').ILogger} */
    this.logger = logger;
    /** @protected @type {ISafeEventDispatcher} */
    this.safeEventDispatcher = safeEventDispatcher;
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

    assertValidActionIndex(
      index,
      actions.length,
      'LLMDecisionProvider',
      actor.id,
      this.safeEventDispatcher,
      this.logger,
      { llmResult: { index, speech, thoughts, notes } }
    );

    return {
      chosenIndex: index,
      speech,
      thoughts,
      notes,
    };
  }
}
