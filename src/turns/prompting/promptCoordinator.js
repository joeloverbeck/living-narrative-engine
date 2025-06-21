/**
 * @file Orchestrates the player prompting flow by coordinating between various services.
 * @see src/turns/prompting/promptCoordinator.js
 */

import { PromptSession } from './promptSession.js';
import { validateDependency } from '../../utils/validationUtils.js';
import IPromptCoordinator from '../../interfaces/IPromptCoordinator';

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../ports/IPromptOutputPort.js').IPromptOutputPort} IPromptOutputPort
 * @typedef {import('../interfaces/IPlayerTurnEvents.js').IPlayerTurnEvents} IPlayerTurnEvents
 * @typedef {import('../ports/IActionIndexer.js').IActionIndexer} IActionIndexer
 * @typedef {import('../../entities/entity.js').default} Entity
 */

/**
 * @typedef {object} PromptCoordinatorDependencies
 * @property {ILogger} logger
 * @property {IPromptOutputPort} promptOutputPort
 * @property {IActionIndexer} actionIndexingService
 * @property {IPlayerTurnEvents} playerTurnEvents
 */

/**
 * @class PromptCoordinator
 * @description Orchestrates the process of prompting an actor for an action.
 * It now indexes every discovered action and presents choices by **integer index**.
 */
class PromptCoordinator extends IPromptCoordinator {
  /** @type {ILogger} */ #logger;
  /** @type {IPromptOutputPort} */ #promptOutputPort;
  /** @type {IActionIndexer} */ #actionIndexer;
  /** @type {IPlayerTurnEvents} */ #playerTurnEvents;

  /** @type {PromptSession | null} */
  #activeSession = null;

  /**
   * @param {PromptCoordinatorDependencies} deps
   */
  constructor({
    logger,
    promptOutputPort,
    actionIndexingService: actionIndexer,
    playerTurnEvents,
  }) {
    super();

    validateDependency(logger, 'logger', console, {
      requiredMethods: ['info', 'error', 'debug', 'warn'],
    });
    validateDependency(promptOutputPort, 'promptOutputPort', logger, {
      requiredMethods: ['prompt'],
    });
    validateDependency(actionIndexer, 'actionIndexingService', logger, {
      requiredMethods: ['index', 'resolve'],
    });
    validateDependency(playerTurnEvents, 'playerTurnEvents', logger);

    this.#logger = logger;
    this.#promptOutputPort = promptOutputPort;
    this.#actionIndexer = actionIndexer;
    this.#playerTurnEvents = playerTurnEvents;

    this.#logger.debug('PromptCoordinator initialised.');
  }

  /**
   * Initiates a prompt for a given actor, cancelling any existing prompt.
   *
   * @param {Entity} actor
   * @param {object} [options]
   * @param {AbortSignal} [options.cancellationSignal]
   * @returns {Promise<PlayerPromptResolution>}
   */
  /**
   * Presents the already-indexed choices to the player and resolves their selection.
   *
   * @param {Entity} actor
   * @param {object}  options
   * @param {ActionComposite[]} options.indexedComposites   // <-- REQUIRED now
   * @param {AbortSignal}       [options.cancellationSignal]
   * @returns {Promise<PlayerPromptResolution>}
   */
  async prompt(actor, { indexedComposites, cancellationSignal } = {}) {
    if (!Array.isArray(indexedComposites) || indexedComposites.length === 0) {
      throw new Error(
        'PromptCoordinator.prompt: indexedComposites array is required and cannot be empty.'
      );
    }
    if (cancellationSignal?.aborted) {
      throw new DOMException('Prompt operation was aborted.', 'AbortError');
    }

    // ─── Send the choices to the UI ───
    const actionsForPrompt = indexedComposites.map((c) => ({
      index: c.index,
      actionId: c.actionId,
      commandString: c.commandString,
      params: c.params,
      description: c.description,
    }));
    await this.#promptOutputPort.prompt(actor.id, actionsForPrompt);

    // ─── Spawn the session ───
    const session = new PromptSession({
      actorId: actor.id,
      eventBus: this.#playerTurnEvents,
      logger: this.#logger,
      abortSignal: cancellationSignal,
      actionIndexingService: this.#actionIndexer, // <— same singleton
    });
    this.#activeSession = session;

    const p = session.run();
    p.finally(
      () =>
        (this.#activeSession =
          this.#activeSession === session ? null : this.#activeSession)
    );
    return p;
  }

  /** Cancels the currently active prompt, if any. */
  cancelCurrentPrompt() {
    if (this.#activeSession) {
      this.#logger.info('Externally cancelling the current prompt.');
      this.#activeSession.cancel();
    } else {
      this.#logger.debug(
        'cancelCurrentPrompt called, but no active prompt to cancel.'
      );
    }
  }
}

export default PromptCoordinator;
