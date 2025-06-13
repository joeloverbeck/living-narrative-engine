// File: src/turns/orchestration/aiDecisionOrchestrator.js

import { IAIDecisionOrchestrator } from '../ports/IAIDecisionOrchestrator';

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
export class AIDecisionOrchestrator extends IAIDecisionOrchestrator {
  /**
   * @param {{
   * discoverySvc: IActionDiscoveryService,
   * indexer: IActionIndexer,
   * llmChooser: ILLMChooser,
   * turnActionFactory: ITurnActionFactory,
   * fallbackFactory: IAIFallbackActionFactory,
   * logger: ILogger
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
    super();

    this.discoverySvc = discoverySvc;
    this.indexer = indexer;
    this.llmChooser = llmChooser;
    this.turnActionFactory = turnActionFactory;
    this.fallbackFactory = fallbackFactory;
    this.logger = logger;
  }

  /**
   * Decide the next action for an actor, preserving all LLM metadata.
   *
   * @param {{ actor: Entity, context: ITurnContext }} params
   * @returns {Promise<{
   * kind: 'success',
   * action: import('../interfaces/IActorTurnStrategy.js').ITurnAction,
   * extractedData: { speech: string|null, thoughts: string|null, notes: string[]|null }
   * }>}
   * @throws {NoActionsDiscoveredError|InvalidIndexError}
   */
  async decide({ actor, context }) {
    const actorId = actor.id;

    /* ---------------------------------------------------------------------- */
    /* 1. Discover all candidate actions                                      */
    /* ---------------------------------------------------------------------- */
    const discovered = await this.discoverySvc.getValidActions(actor, context);

    /* ---------------------------------------------------------------------- */
    /* 2. Index them for the current turn                                     */
    /* ---------------------------------------------------------------------- */
    const indexed = this.indexer.index(discovered, actorId);
    if (!indexed.length) {
      throw new NoActionsDiscoveredError(actorId);
    }

    /* ---------------------------------------------------------------------- */
    /* 3. Ask the LLM which action to take                                    */
    /* ---------------------------------------------------------------------- */
    const { index, speech, thoughts, notes } = await this.llmChooser.choose({
      actor,
      context,
      actions: indexed,
      abortSignal: context.getPromptSignal(),
    });

    /* ---------------------------------------------------------------------- */
    /* 4. Validate the chosen index                                           */
    /* ---------------------------------------------------------------------- */
    const isValid =
      Number.isInteger(index) && index > 0 && index <= indexed.length;
    if (!isValid) {
      throw new InvalidIndexError(index, indexed.length);
    }

    /* ---------------------------------------------------------------------- */
    /* 5. Build the concrete turn-action                                      */
    /* ---------------------------------------------------------------------- */
    const composite = indexed[index - 1];
    const action = this.turnActionFactory.create(composite, speech);

    /* ---------------------------------------------------------------------- */
    /* 6. Return the full result incl. metadata                               */
    /* ---------------------------------------------------------------------- */
    // TKT-012: Normalize the extracted data to guarantee key presence.
    const meta = {
      speech: speech ?? null,
      thoughts: thoughts ?? null,
      notes: notes ?? null,
    };
    return { kind: 'success', action, extractedData: meta };
  }

  /**
   * Same as `decide`, but always returns a value —
   * falling back to a simple “wait” action on any error.
   *
   * @param {{ actor: Entity, context: ITurnContext }} args
   * @returns {Promise<{
   * kind: 'success'|'fallback',
   * action: import('../interfaces/IActorTurnStrategy.js').ITurnAction,
   * extractedData: { speech: string|null, thoughts: string|null, notes: string[]|null }
   * }>}
   */
  async decideOrFallback(args) {
    try {
      return await this.decide(args);
    } catch (err) {
      const fb = this.fallbackFactory.create(err.name, err, args.actor.id);

      // TKT-012: Normalize the extracted data to guarantee key presence.
      // `AIFallbackActionFactory` may provide speech, but not other metadata.
      const meta = {
        speech: fb.speech ?? null,
        thoughts: null,
        notes: null,
      };
      return {
        kind: 'fallback',
        action: fb,
        extractedData: meta,
      };
    }
  }
}
