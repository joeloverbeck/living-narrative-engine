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
 * Orchestrates a human prompt to select an action, resolving either by
 * integer index or by action ID lookup.
 */
export class HumanDecisionProvider extends ITurnDecisionProvider {
  /**
   * @param {object} deps
   * @param {import('../../interfaces/IPromptCoordinator').IPromptCoordinator} deps.promptCoordinator
   * @param {import('../services/actionIndexingService').ActionIndexingService} deps.actionIndexingService
   * @param {import('../../interfaces/coreServices').ILogger} deps.logger
   */
  constructor({ promptCoordinator, actionIndexingService, logger }) {
    super();
    this.promptCoordinator = promptCoordinator;
    this.actionIndexingService = actionIndexingService; // Kept for potential future use, though not used in the corrected 'decide' method.
    this.logger = logger;
  }

  /**
   * @async
   * @override
   * @param {import('../../entities/entity.js').default} actor
   * @param {import('../interfaces/ITurnContext.js').ITurnContext} context
   * @param {import('../dtos/actionComposite.js').ActionComposite[]} actions
   * @param {AbortSignal} [abortSignal]
   * @returns {Promise<import('../interfaces/ITurnDecisionProvider').ITurnDecisionResult>}
   */
  async decide(actor, context, actions, abortSignal) {
    // 1) prompt the user
    const promptRes = await this.promptCoordinator.prompt(actor, {
      cancellationSignal: abortSignal,
    });

    // 2) Resolve the integer index from the prompt result.
    // The prompt may return the index directly (e.g., from a button click `chosenIndex`)
    // or an action object/ID (as we've seen from PromptSession).
    let chosenIndex = promptRes.chosenIndex;

    // Fallback if index isn't a number, but we have an action ID.
    if (!Number.isInteger(chosenIndex)) {
      const actionId = promptRes.action?.id;
      if (typeof actionId === 'string') {
        // We have an ID. Find its corresponding composite in the `actions` array
        // that was passed into this method.
        const matchingComposite = actions.find((comp) => comp.id === actionId);

        if (matchingComposite) {
          chosenIndex = matchingComposite.index;
        } else {
          this.logger.error(
            `HumanDecisionProvider: Could not find action with ID "${actionId}" in the list of available actions for actor ${actor.id}.`,
            { availableActions: actions.map((a) => a.id) }
          );
          // Throw an error to prevent proceeding with an invalid choice.
          throw new Error(`Action "${actionId}" is not a valid choice.`);
        }
      }
    }

    // Final validation before returning.
    if (!Number.isInteger(chosenIndex)) {
      this.logger.error(
        `HumanDecisionProvider: Failed to determine a valid integer index for actor ${actor.id}'s action.`,
        { promptResult: promptRes }
      );
      throw new Error('Could not resolve the chosen action to a valid index.');
    }

    // 3) return standardized result
    return {
      chosenIndex,
      speech: promptRes.speech ?? null,
      thoughts: promptRes.thoughts ?? null,
      notes: promptRes.notes ?? null,
    };
  }
}
