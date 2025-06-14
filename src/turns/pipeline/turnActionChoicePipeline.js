/**
 * @module src/turns/pipeline/turnActionChoicePipeline.js
 */

import { IActionDiscoveryService } from '../../interfaces/IActionDiscoveryService.js';
import { IActionIndexer } from '../ports/IActionIndexer.js';
import { ITurnContext } from '../interfaces/ITurnContext.js';

/**
 * Centralises action discovery and indexing for both AI and human turn flows.
 *
 * @class TurnActionChoicePipeline
 */
export class TurnActionChoicePipeline {
  /**
   * @param {object} deps
   * @param {IActionDiscoveryService} deps.discoverySvc - Service to discover valid actions.
   * @param {IActionIndexer}        deps.indexer      - Service to index discovered actions.
   * @param {{ debug(message: string): void }} deps.logger - Logger instance.
   */
  constructor({ discoverySvc, indexer, logger }) {
    this.discoverySvc = discoverySvc;
    this.indexer = indexer;
    this.logger = logger;

    // Log initialization once when the pipeline is first created
    this.logger.debug('TurnActionChoicePipeline initialised');
  }

  /**
   * Discovers, indexes, and returns a list of action choices for an actor's turn.
   * @param {import('../../models/entity.js').Entity} actor - The entity whose actions we’re building choices for.
   * @param {ITurnContext} context - The current turn context.
   * @returns {Promise<import('../dtos/actionComposite.js').ActionComposite[]>} Deduped, capped, 1-based indexed action list.
   */
  async buildChoices(actor, context) {
    // Signal the beginning of the turn to clear any prior-turn state.
    this.indexer.beginTurn?.(actor.id); // no-op if not implemented

    this.logger.debug(`[ChoicePipeline] Discovering actions for ${actor.id}`);
    const discovered = await this.discoverySvc.getValidActions(actor, context);

    const indexed = this.indexer.index(discovered, actor.id);
    this.logger.debug(
      `[ChoicePipeline] Actor ${actor.id}: ${indexed.length} choices ready`
    );
    return indexed;
  }
}
