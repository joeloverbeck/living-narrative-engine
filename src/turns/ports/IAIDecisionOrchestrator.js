// File: src/turns/ports/IAIDecisionOrchestrator.js
/**
 * @module turns/ports/IAIDecisionOrchestrator
 * @description Abstract class acting as an interface for any AI-decision orchestrator.
 */

/** @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../../entities/entity.js').default} Entity */

/** @typedef {import('../interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction */

/**
 * Abstract “interface” class.
 * Concrete orchestrators **must** extend this base and implement every method.
 *
 * @abstract
 */
export class IAIDecisionOrchestrator {
  constructor() {
    if (new.target === IAIDecisionOrchestrator) {
      throw new TypeError('IAIDecisionOrchestrator is an abstract class.');
    }
  }

  /**
   * Decide the next turn-action for an actor, preserving all LLM metadata.
   *
   * @abstract
   * @param {{ actor: Entity, context: ITurnContext }} params
   * @returns {Promise<{
   *   kind: 'success',
   *   action: ITurnAction,
   *   extractedData: {
   *     speech: string|null,
   *     thoughts: string|null,
   *     notes: string[]|null
   *   }
   * }>}
   */

  /* eslint-disable class-methods-use-this, no-unused-vars */
  async decide(params) {
    throw new Error('IAIDecisionOrchestrator.decide() must be implemented.');
  }

  /**
   * Same as {@link IAIDecisionOrchestrator#decide}, but guaranteed to
   * return a value by falling back to a safe action on any failure.
   *
   * @abstract
   * @param {{ actor: Entity, context: ITurnContext }} params
   * @returns {Promise<{
   *   kind: 'success'|'fallback',
   *   action: ITurnAction,
   *   extractedData: {
   *     speech: string|null,
   *     thoughts: string|null,
   *     notes: string[]|null
   *   }
   * }>}
   */
  async decideOrFallback(params) {
    throw new Error(
      'IAIDecisionOrchestrator.decideOrFallback() must be implemented.'
    );
  }

  /* eslint-enable class-methods-use-this, no-unused-vars */
}
