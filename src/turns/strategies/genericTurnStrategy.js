import { IActorTurnStrategy } from '../interfaces/IActorTurnStrategy.js';
import { buildDecisionResult } from '../../utils/decisionResult.js';

/**
 * @class GenericTurnStrategy
 * @extends IActorTurnStrategy
 * @description
 * A single turn-strategy for all actor types. It builds action choices,
 * delegates the pick to a decision provider, then creates and returns
 * a frozen DecisionResult.
 */
export class GenericTurnStrategy extends IActorTurnStrategy {
  /**
   * @param {object} deps
   * @param {import('../pipeline/turnActionChoicePipeline.js').TurnActionChoicePipeline} deps.choicePipeline
   * @param {import('../interfaces/ITurnDecisionProvider.js').ITurnDecisionProvider} deps.decisionProvider
   * @param {import('../ports/ITurnActionFactory.js').ITurnActionFactory} deps.turnActionFactory
   * @param {{ debug(message: string): void }} deps.logger
   */
  constructor({ choicePipeline, decisionProvider, turnActionFactory, logger }) {
    super();
    Object.assign(this, {
      choicePipeline,
      decisionProvider,
      turnActionFactory,
      logger,
    });
  }

  /**
   * @async
   * @param {import('../interfaces/ITurnContext.js').ITurnContext} context
   * @returns {Promise<import('../interfaces/IActorTurnStrategy.js').ITurnDecisionResult>}
   */
  async decideAction(context) {
    const actor = context.getActor();
    const actions = await this.choicePipeline.buildChoices(actor, context);

    const meta = await this.decisionProvider.decide(
      actor,
      context,
      actions,
      context.getPromptSignal()
    );

    const composite = actions[meta.chosenIndex - 1];
    const turnAction = this.turnActionFactory.create(
      composite,
      meta.speech ?? null
    );

    const result = buildDecisionResult(turnAction, meta);
    this.logger.debug(
      `[GenericStrategy] ${actor.id} chose ${turnAction.actionDefinitionId}`
    );
    return result;
  }
}
