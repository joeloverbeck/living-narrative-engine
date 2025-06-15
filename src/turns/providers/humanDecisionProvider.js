/**
 * @file Provides a human decision provider mapping prompt outputs to the
 * ITurnDecisionProvider interface.
 */

import { DelegatingDecisionProvider } from './delegatingDecisionProvider.js';

/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

/**
 * @class HumanDecisionProvider
 * @augments AbstractDecisionProvider
 * @description
 * Orchestrates a human prompt to select an action and returns the chosen
 * index and any associated metadata (speech, thoughts).
 */
export class HumanDecisionProvider extends DelegatingDecisionProvider {
  /**
   * Creates a new HumanDecisionProvider.
   *
   * @param {object} deps - Constructor dependencies
   * @param {import('../../interfaces/IPromptCoordinator').IPromptCoordinator} deps.promptCoordinator - Coordinator used to prompt the player
   * @param {import('../../interfaces/coreServices').ILogger} deps.logger - Logger for debug output
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher - Event dispatcher for error reporting
   */
  constructor({ promptCoordinator, logger, safeEventDispatcher }) {
    const delegate = async (actor, _context, actions, abortSignal) => {
      const res = await promptCoordinator.prompt(actor, {
        indexedComposites: actions,
        cancellationSignal: abortSignal,
      });

      const { chosenIndex, speech, thoughts, notes } = res;
      return { index: chosenIndex, speech, thoughts, notes };
    };

    super({ delegate, logger, safeEventDispatcher });
    this.promptCoordinator = promptCoordinator;
  }
}
