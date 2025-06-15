/**
 * @file Provides a human decision provider mapping prompt outputs to the
 * ITurnDecisionProvider interface.
 */

import { AbstractDecisionProvider } from './abstractDecisionProvider.js';

/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

/**
 * @class HumanDecisionProvider
 * @augments AbstractDecisionProvider
 * @description
 * Orchestrates a human prompt to select an action and returns the chosen
 * index and any associated metadata (speech, thoughts).
 */
export class HumanDecisionProvider extends AbstractDecisionProvider {
  /**
   * Creates a new HumanDecisionProvider.
   *
   * @param {object} deps - Constructor dependencies
   * @param {import('../../interfaces/IPromptCoordinator').IPromptCoordinator} deps.promptCoordinator - Coordinator used to prompt the player
   * @param {import('../../interfaces/coreServices').ILogger} deps.logger - Logger for debug output
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher - Event dispatcher for error reporting
   */
  constructor({ promptCoordinator, logger, safeEventDispatcher }) {
    super({ logger, safeEventDispatcher });
    this.promptCoordinator = promptCoordinator;
  }

  /**
   * Prompts the human player for a turn decision.
   *
   * @async
   * @protected
   * @override
   * @param {import('../../entities/entity.js').default} actor - Acting entity
   * @param {import('../interfaces/ITurnContext.js').ITurnContext} context - Turn context
   * @param {import('../dtos/actionComposite.js').ActionComposite[]} actions - Indexed action list
   * @param {AbortSignal} [abortSignal] - Optional cancellation signal
   * @returns {Promise<{ index: number, speech?: string|null, thoughts?: string|null, notes?: string[]|null }>} Result from the prompt
   */
  async choose(actor, context, actions, abortSignal) {
    const promptRes = await this.promptCoordinator.prompt(actor, {
      indexedComposites: actions,
      cancellationSignal: abortSignal,
    });

    const { chosenIndex, speech, thoughts, notes } = promptRes;
    return { index: chosenIndex, speech, thoughts, notes };
  }
}
