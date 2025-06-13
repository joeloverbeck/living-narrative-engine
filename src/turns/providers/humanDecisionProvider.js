/**
 * @file Provides a human decision provider mapping prompt outputs to the
 *       ITurnDecisionProvider interface.
 */

import { ITurnDecisionProvider } from '../interfaces/ITurnDecisionProvider.js';

/**
 * @class HumanDecisionProvider
 * @extends ITurnDecisionProvider
 * @description
 *   Orchestrates a human prompt to select an action, resolving either by
 *   integer index or by action ID lookup.
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
    this.actionIndexingService = actionIndexingService;
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

    // 2) resolve an integer index if needed
    let chosenIndex = promptRes.index;
    if (!Number.isInteger(chosenIndex)) {
      const composite = this.actionIndexingService.resolve(
        actor.id,
        promptRes.action.id
      );
      chosenIndex = composite.index;
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
