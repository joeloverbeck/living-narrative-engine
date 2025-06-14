// src/turns/services/humanDecisionProvider.js

/**
 * @file Provides a human decision provider mapping prompt outputs to the
 * ITurnDecisionProvider interface.
 */

import { ITurnDecisionProvider } from '../interfaces/ITurnDecisionProvider.js';

/**
 * @class HumanDecisionProvider
 * @extends ITurnDecisionProvider
 * @description
 * Orchestrates a human prompt to select an action and returns the chosen
 * index and any associated metadata (speech, thoughts).
 */
export class HumanDecisionProvider extends ITurnDecisionProvider {
  /**
   * @param {object} deps
   * @param {import('../../interfaces/IPromptCoordinator').IPromptCoordinator} deps.promptCoordinator
   * @param {import('../../interfaces/coreServices').ILogger} deps.logger
   */
  constructor({ promptCoordinator, logger }) {
    super();
    this.promptCoordinator = promptCoordinator;
    this.logger = logger;
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
    // 1. Prompt the user for their decision. The prompt system handles showing
    //    the available actions and resolving input to a specific choice.
    const promptRes = await this.promptCoordinator.prompt(actor, {
      cancellationSignal: abortSignal,
    });

    // 2. The prompt result (`promptRes`) should contain `chosenIndex`, which is the
    //    1-based index corresponding to the `actions` array.
    const { chosenIndex, speech, thoughts, notes } = promptRes;

    // 3. Validate that we received a valid integer index. If not, something has
    //    gone wrong in the prompting pipeline.
    if (!Number.isInteger(chosenIndex)) {
      this.logger.error(
        `HumanDecisionProvider: Did not receive a valid integer 'chosenIndex' from the prompt system for actor ${actor.id}.`,
        { promptResult: promptRes }
      );
      throw new Error('Could not resolve the chosen action to a valid index.');
    }

    // 4. Return the standardized decision result. The calling strategy will use
    //    `chosenIndex` to select the correct action from its `actions` array.
    return {
      chosenIndex,
      speech: speech ?? null,
      thoughts: thoughts ?? null,
      notes: notes ?? null,
    };
  }
}
