// File: src/turns/orchestration/aiDecisionOrchestrator.js

/**
 * @module turns/orchestration/aiDecisionOrchestrator
 * @description Pure service orchestrating discovery → index → LLM → validation → turn-action.
 */

/** @typedef {import('../ports/IAIDecisionOrchestrator.js').IAIDecisionOrchestrator} IAIDecisionOrchestrator */
/** @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../interfaces/IActionDiscoveryService.js').IActionDiscoveryService} IActionDiscoveryService */
/** @typedef {import('../ports/IActionIndexer.js').IActionIndexer} IActionIndexer */
/** @typedef {import('../ports/ILLMChooser.js').ILLMChooser} ILLMChooser */
/** @typedef {import('../ports/ITurnActionFactory.js').ITurnActionFactory} ITurnActionFactory */
/** @typedef {import('../interfaces/IAIFallbackActionFactory.js').IAIFallbackActionFactory} IAIFallbackActionFactory */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

import { NoActionsDiscoveredError, InvalidIndexError } from '../errors';

/**
 * @implements {IAIDecisionOrchestrator}
 */
export class AIDecisionOrchestrator {
  /**
   * @param {{
   *   discoverySvc: IActionDiscoveryService,
   *   indexer: IActionIndexer,
   *   llmChooser: ILLMChooser,
   *   turnActionFactory: ITurnActionFactory,
   *   fallbackFactory: IAIFallbackActionFactory,
   *   logger: ILogger
   * }} deps
   */
  constructor({
    discoverySvc,
    indexer,
    llmChooser,
    turnActionFactory,
    fallbackFactory,
    logger,
  }) {
    this.discoverySvc = discoverySvc;
    this.indexer = indexer;
    this.llmChooser = llmChooser;
    this.turnActionFactory = turnActionFactory;
    this.fallbackFactory = fallbackFactory;
    this.logger = logger;
  }

  /**
   * Decide the next action based on actor and context.
   *
   * @param {{ actor: Entity, context: ITurnContext }} params
   * @returns {Promise<{ kind: 'success', action: import('../interfaces/IActorTurnStrategy.js').ITurnAction, extractedData: { speech: string|null } }>}
   * @throws {NoActionsDiscoveredError|InvalidIndexError}
   */
  async decide({ actor, context }) {
    const actorId = actor.id;

    // 1. Discover
    const discovered = await this.discoverySvc.getValidActions(actor, context);

    // 2. Index
    const indexed = this.indexer.index(discovered, actorId);
    if (!indexed.length) {
      throw new NoActionsDiscoveredError(actorId);
    }

    // 3. LLM choice
    const { index, speech } = await this.llmChooser.choose({
      actor,
      context,
      actions: indexed,
      abortSignal: context.getPromptSignal(),
    });

    // 4. Validate index
    const isValid =
      Number.isInteger(index) && index > 0 && index <= indexed.length;
    if (!isValid) {
      throw new InvalidIndexError(index, indexed.length);
    }

    // 5. Build action
    const composite = indexed[index - 1];
    const action = this.turnActionFactory.create(composite, speech);

    return {
      kind: 'success',
      action,
      extractedData: { speech },
    };
  }

  /**
   * Helper that wraps decide() and returns a fallback on error.
   *
   * @param {{ actor: Entity, context: ITurnContext }} args
   * @returns {Promise<{ kind: 'fallback', action: import('../interfaces/IActorTurnStrategy.js').ITurnAction, extractedData: { speech: null } }>}
   */
  async decideOrFallback(args) {
    try {
      return await this.decide(args);
    } catch (err) {
      const fb = this.fallbackFactory.create(err.name, err, args.actor.id);
      return {
        kind: 'fallback',
        action: fb,
        extractedData: { speech: null },
      };
    }
  }
}
