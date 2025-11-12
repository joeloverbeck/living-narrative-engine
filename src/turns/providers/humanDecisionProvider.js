/**
 * @file Provides a human decision provider mapping prompt outputs to the
 * ITurnDecisionProvider interface.
 */

import { DelegatingDecisionProvider } from './delegatingDecisionProvider.js';
import { validateDependency } from '../../utils/dependencyUtils.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../constants/eventIds.js';

/** @typedef {import('./delegatingDecisionProvider.js').DecisionDelegate} DecisionDelegate */

/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

/**
 * @class HumanDecisionProvider
 * @augments AbstractDecisionProvider
 * @description
 * Orchestrates a human prompt to select an action and returns the chosen
 * index and any associated metadata (speech, thoughts).
 */
export class HumanDecisionProvider extends DelegatingDecisionProvider {
  /** @type {import('../../interfaces/IPromptCoordinator').IPromptCoordinator} */
  #promptCoordinator;
  /**
   * Creates a new HumanDecisionProvider.
   *
   * @param {object} deps - Constructor dependencies
   * @param {import('../../interfaces/IPromptCoordinator').IPromptCoordinator} deps.promptCoordinator - Coordinator used to prompt the player
   * @param {import('../../interfaces/coreServices').ILogger} deps.logger - Logger for debug output
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher - Event dispatcher for error reporting
   * @see DecisionDelegate
   * @returns {void}
   */
  constructor({ promptCoordinator, logger, safeEventDispatcher }) {
    validateDependency(promptCoordinator, 'promptCoordinator', logger, {
      requiredMethods: ['prompt'],
    });
    const delegate = async (actor, _context, actions, abortSignal) => {
      const res = await this.#promptCoordinator.prompt(actor, {
        indexedComposites: actions,
        cancellationSignal: abortSignal,
      });

      const { chosenIndex, speech, thoughts, notes } = res;

      // Validate that human player provided a valid integer index
      if (
        typeof chosenIndex !== 'number' ||
        !Number.isInteger(chosenIndex) ||
        chosenIndex === null
      ) {
        logger.error(
          `HumanDecisionProvider: Did not receive a valid integer 'chosenIndex' from prompt. Got: ${chosenIndex}`
        );
        safeEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
          message: `HumanDecisionProvider: Did not receive a valid integer 'chosenIndex' from prompt. Got: ${chosenIndex}`,
          context: 'HumanDecisionProvider.delegate',
        });
        throw new Error(
          'Could not resolve the chosen action to a valid index.'
        );
      }

      return { index: chosenIndex, speech, thoughts, notes };
    };

    super({ delegate, logger, safeEventDispatcher });
    this.#promptCoordinator = promptCoordinator;
  }
}
