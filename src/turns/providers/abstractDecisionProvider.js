/**
 * @module AbstractDecisionProvider
 */

import { ITurnDecisionProvider } from '../interfaces/ITurnDecisionProvider.js';
import { assertValidActionIndex } from '../../utils/actionIndexUtils.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

/**
 * @abstract
 * @class AbstractDecisionProvider
 * @augments ITurnDecisionProvider
 * @description
 * Provides shared logic for decision providers that select an action index.
 */
export class AbstractDecisionProvider extends ITurnDecisionProvider {
  /** @type {import('../../interfaces/coreServices').ILogger} */ #logger;
  /** @type {ISafeEventDispatcher} */ #safeEventDispatcher;

  /**
   * Base constructor for decision providers.
   *
   * @description Initializes shared dependencies used by decision providers.
   * @param {object} deps - Constructor dependencies
   * @param {import('../../interfaces/coreServices').ILogger} deps.logger - Logger for error reporting
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher - Event dispatcher for validation errors
   * @returns {void}
   */
  constructor({ logger, safeEventDispatcher }) {
    super();
    validateDependency(logger, 'logger', console, {
      requiredMethods: ['error', 'debug'],
    });
    this.#logger = logger;

    validateDependency(
      safeEventDispatcher,
      'safeEventDispatcher',
      this.#logger,
      {
        requiredMethods: ['dispatch'],
      }
    );
    this.#safeEventDispatcher = safeEventDispatcher;
  }

  /**
   * Subclasses must implement action selection logic.
   *
   * @abstract
   * @protected
   * @param {import('../../entities/entity.js').default} _actor - Acting entity
   * @param {import('../interfaces/ITurnContext.js').ITurnContext} _context - Turn context
   * @param {import('../dtos/actionComposite.js').ActionComposite[]} _actions - Indexed action list
   * @param {AbortSignal} [_abortSignal] - Optional cancellation signal
   * @returns {Promise<{ index: number, speech?: string|null, thoughts?: string|null, notes?: string[]|null }>} Selected action information
   */
  async choose(_actor, _context, _actions, _abortSignal) {
    throw new Error('abstract');
  }

  /**
   * @override
   * @async
   * @param {import('../../entities/entity.js').default} actor - Acting entity
   * @param {import('../interfaces/ITurnContext.js').ITurnContext} context - Turn context
   * @param {import('../dtos/actionComposite.js').ActionComposite[]} actions - Indexed action list
   * @param {AbortSignal} [abortSignal] - Optional cancellation signal
   * @returns {Promise<import('../interfaces/ITurnDecisionProvider.js').ITurnDecisionResult>} Finalized decision result
   */
  async decide(actor, context, actions, abortSignal) {
    const { index, speech, thoughts, notes } = await this.choose(
      actor,
      context,
      actions,
      abortSignal
    );

    assertValidActionIndex(
      index,
      actions.length,
      this.constructor.name,
      actor.id,
      this.#safeEventDispatcher,
      this.#logger,
      { result: { index, speech, thoughts, notes } }
    );

    return {
      chosenIndex: index,
      speech: speech ?? null,
      thoughts: thoughts ?? null,
      notes: notes ?? null,
    };
  }
}
