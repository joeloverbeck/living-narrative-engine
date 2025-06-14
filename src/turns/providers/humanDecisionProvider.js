/**
 * @file Provides a human decision provider mapping prompt outputs to the
 * ITurnDecisionProvider interface.
 */

import { ITurnDecisionProvider } from '../interfaces/ITurnDecisionProvider.js';
import { assertValidActionIndex } from '../../utils/validationUtils.js';

/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

/**
 * @class HumanDecisionProvider
 * @augments ITurnDecisionProvider
 * @description
 * Orchestrates a human prompt to select an action and returns the chosen
 * index and any associated metadata (speech, thoughts).
 */
export class HumanDecisionProvider extends ITurnDecisionProvider {
  /**
   * @param {object} deps
   * @param {import('../../interfaces/IPromptCoordinator').IPromptCoordinator} deps.promptCoordinator
   * @param {import('../../interfaces/coreServices').ILogger} deps.logger
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher
   */
  constructor({ promptCoordinator, logger, safeEventDispatcher }) {
    super();
    this.promptCoordinator = promptCoordinator;
    this.logger = logger;
    /** @type {ISafeEventDispatcher} */
    this.safeEventDispatcher = safeEventDispatcher;
  }

  /**
   * Prompts the human player for a turn decision.
   *
   * The core responsibility of this method is to invoke the prompt system
   * and then reliably return the `chosenIndex` and other metadata it receives.
   * The `PromptCoordinator` and `PromptSession` are responsible for the complex
   * logic of discovering actions, indexing them, and resolving the player's
   * input (e.g., a button click) back to a valid index. This provider trusts
   * that the index returned by the prompt system is valid for the `actions`
   * list that was originally generated and passed to the `decideAction` method
   * in the turn strategy.
   *
   * @async
   * @override
   * @param {import('../../entities/entity.js').default} actor - The actor making the decision.
   * @param {import('../interfaces/ITurnContext.js').ITurnContext} context - The current turn's context.
   * @param {import('../dtos/actionComposite.js').ActionComposite[]} actions - The list of available actions. This is passed by the caller but not used directly here, as the prompt system has its own reference.
   * @param {AbortSignal} [abortSignal] - A signal to cancel the operation.
   * @returns {Promise<import('../interfaces/ITurnDecisionProvider').ITurnDecisionResult>}
   */
  async decide(actor, context, actions, abortSignal) {
    // Hand the *already-indexed* list to the prompt system
    const promptRes = await this.promptCoordinator.prompt(actor, {
      indexedComposites: actions,
      cancellationSignal: abortSignal,
    });

    const { chosenIndex, speech, thoughts, notes } = promptRes;

    assertValidActionIndex(
      chosenIndex,
      actions.length,
      'HumanDecisionProvider',
      actor.id,
      this.safeEventDispatcher,
      this.logger,
      { promptResult: promptRes }
    );

    return {
      chosenIndex,
      speech: speech ?? null,
      thoughts: thoughts ?? null,
      notes: notes ?? null,
    };
  }
}
