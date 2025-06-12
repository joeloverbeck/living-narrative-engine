// src/turns/ports/IAIDecisionOrchestrator.js
/**
 * @interface IAIDecisionOrchestrator
 * @description High-level service that converts actor+context into a strategy decision.
 * @method decide
 * @param {{ actor: Entity, context: ITurnContext }} params - The parameters for decision.
 * @returns {StrategyDecision}
 */
export class IAIDecisionOrchestrator {
  /**
   * Decides the strategy based on actor and context.
   * @param {{ actor: Entity, context: ITurnContext }} params
   * @returns {StrategyDecision}
   */
  decide(params) {
    throw new Error('Interface method');
  }
}
