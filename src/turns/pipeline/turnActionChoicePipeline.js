/**
 * @module src/turns/pipeline/turnActionChoicePipeline.js
 */

import { IAvailableActionsProvider } from '../../interfaces/IAvailableActionsProvider.js';
import { ITurnContext } from '../interfaces/ITurnContext.js';

/**
 * Centralises action discovery and indexing for both AI and human turn flows.
 *
 * @class TurnActionChoicePipeline
 */
export class TurnActionChoicePipeline {
  /**
   * @param {object} deps
   * @param {IAvailableActionsProvider} deps.availableActionsProvider - Provider that caches and returns indexed actions.
   * @param {{ debug(message: string): void }} deps.logger - Logger instance.
   */
  constructor({ availableActionsProvider, logger }) {
    this.availableActionsProvider = availableActionsProvider;
    this.logger = logger;

    // Log initialization once when the pipeline is first created
    this.logger.debug('TurnActionChoicePipeline initialised');
  }

  /**
   * Discovers, indexes, and returns a list of action choices for an actor's turn.
   *
   * @param {import('../../entities/entity.js').Entity} actor - The entity whose actions we’re building choices for.
   * @param {ITurnContext} context - The current turn context.
   * @returns {Promise<import('../dtos/actionComposite.js').ActionComposite[]>} Deduped, capped, 1-based indexed action list.
   */
  async buildChoices(actor, context) {
    this.logger.debug(`[ChoicePipeline] Fetching actions for ${actor.id}`);
    const actions = await this.availableActionsProvider.get(
      actor,
      context,
      this.logger
    );
    this.logger.debug(
      `[ChoicePipeline] Actor ${actor.id}: ${actions.length} choices ready`
    );
    return actions;
  }
}
