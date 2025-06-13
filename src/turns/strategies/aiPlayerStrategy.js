/**
 * @module turns/strategies/aiPlayerStrategy
 * @description
 * Delegates AI turn decisions to a high-level orchestrator.
 */

/** @typedef {import('../ports/IAIDecisionOrchestrator.js').IAIDecisionOrchestrator} IAIDecisionOrchestrator */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction */
/** @typedef {import('../interfaces/IActorTurnStrategy.js').AIStrategyDecision} AIStrategyDecision */

import { IActorTurnStrategy } from '../interfaces/IActorTurnStrategy.js';

export class AIPlayerStrategy extends IActorTurnStrategy {
  /**
   * @param {{ orchestrator: IAIDecisionOrchestrator, logger: ILogger }} deps
   * @throws {Error} If any required dependency is missing or invalid.
   */
  constructor({ orchestrator, logger }) {
    super();
    if (!orchestrator || typeof orchestrator.decideOrFallback !== 'function') {
      throw new Error('Missing required dependency: IAIDecisionOrchestrator.');
    }
    if (!logger || typeof logger.debug !== 'function') {
      throw new Error('Missing required dependency: ILogger.');
    }
    this._orchestrator = orchestrator;
    this._logger = logger;
  }

  /**
   * @async
   * @param {ITurnContext} context - Current game turn context.
   * @returns {Promise<import('../interfaces/ITurnDecisionResult.js').ITurnDecisionResult|import('../interfaces/IActorTurnStrategy.js').ITurnAction>} AI decision or fallback.
   */
  async decideAction(context) {
    if (!context) {
      throw new Error('AIPlayerStrategy received an invalid ITurnContext.');
    }
    let actor;
    try {
      actor = context.getActor();
    } catch (err) {
      throw err;
    }
    if (!actor || !actor.id) {
      throw new Error(
        'AIPlayerStrategy could not retrieve a valid actor from the context.'
      );
    }
    const result = await this._orchestrator.decideOrFallback({
      actor,
      context,
    });
    this._logger.debug(`AI decision for ${actor.id}:`, result);
    return result;
  }
}
