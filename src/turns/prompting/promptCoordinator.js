/**
 * @file Orchestrates the player prompting flow by coordinating between various services.
 * @see src/turns/prompting/promptCoordinator.js
 */

import { PromptError } from '../../errors/promptError.js';
import { PromptSession } from './promptSession.js';
import { validateDependency } from '../../utils/validationUtils.js';
import IPromptCoordinator from '../../interfaces/IPromptCoordinator';

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../interfaces/IActionDiscoveryService.js').IActionDiscoveryService} IActionDiscoveryService
 * @typedef {import('../ports/IPromptOutputPort.js').IPromptOutputPort} IPromptOutputPort
 * @typedef {import('./actionContextBuilder.js').default} ActionContextBuilder
 * @typedef {import('../interfaces/IPlayerTurnEvents.js').IPlayerTurnEvents} IPlayerTurnEvents
 * @typedef {import('../services/actionIndexingService.js').ActionIndexingService} ActionIndexingService
 * @typedef {import('../../entities/entity.js').default} Entity
 */

/**
 * @typedef {object} PromptCoordinatorDependencies
 * @property {ILogger} logger
 * @property {IActionDiscoveryService} actionDiscoveryService
 * @property {IPromptOutputPort} promptOutputPort
 * @property {ActionContextBuilder} actionContextBuilder
 * @property {ActionIndexingService} actionIndexingService
 * @property {IPlayerTurnEvents} playerTurnEvents
 */

/**
 * @class PromptCoordinator
 * @description Orchestrates the process of prompting an actor for an action.
 * It now indexes every discovered action and presents choices by **integer index**.
 */
class PromptCoordinator extends IPromptCoordinator {
  /** @type {ILogger} */ #logger;
  /** @type {IActionDiscoveryService} */ #actionDiscoveryService;
  /** @type {IPromptOutputPort} */ #promptOutputPort;
  /** @type {ActionContextBuilder} */ #actionContextBuilder;
  /** @type {ActionIndexingService} */ #actionIndexingService;
  /** @type {IPlayerTurnEvents} */ #playerTurnEvents;

  /** @type {PromptSession | null} */
  #activeSession = null;

  /**
   * @param {PromptCoordinatorDependencies} deps
   */
  constructor({
    logger,
    actionDiscoveryService,
    promptOutputPort,
    actionContextBuilder,
    actionIndexingService,
    playerTurnEvents,
  }) {
    super();

    validateDependency(logger, 'logger', console, {
      requiredMethods: ['info', 'error', 'debug', 'warn'],
    });
    validateDependency(
      actionDiscoveryService,
      'actionDiscoveryService',
      logger,
      { requiredMethods: ['getValidActions'] }
    );
    validateDependency(promptOutputPort, 'promptOutputPort', logger, {
      requiredMethods: ['prompt'],
    });
    validateDependency(actionContextBuilder, 'actionContextBuilder', logger, {
      requiredMethods: ['buildContext'],
    });
    validateDependency(actionIndexingService, 'actionIndexingService', logger, {
      requiredMethods: ['indexActions', 'resolve'],
    });
    validateDependency(playerTurnEvents, 'playerTurnEvents', logger);

    this.#logger = logger;
    this.#actionDiscoveryService = actionDiscoveryService;
    this.#promptOutputPort = promptOutputPort;
    this.#actionContextBuilder = actionContextBuilder;
    this.#actionIndexingService = actionIndexingService;
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
  async prompt(actor, { cancellationSignal } = {}) {
    if (cancellationSignal?.aborted) {
      throw new DOMException('Prompt operation was aborted.', 'AbortError');
    }

    if (this.#activeSession) {
      this.#logger.warn('A new prompt is superseding an existing one.');
      this.#activeSession.cancel(
        new PromptError(
          `Prompt for actor ${actor.id} superseded the previous prompt.`,
          null,
          'PROMPT_SUPERSEDED'
        )
      );
    }

    // ─────────────────── Discover & Index ───────────────────
    let discoveredActions;
    let indexedComposites;
    try {
      this.#logger.debug(`Building context for actor ${actor.id}…`);
      const ctx = await this.#actionContextBuilder.buildContext(actor);

      this.#logger.debug(`Discovering actions for actor ${actor.id}…`);
      discoveredActions = await this.#actionDiscoveryService.getValidActions(
        actor,
        ctx
      );

      // **NEW:** 1-based indexing (dedup, cap, O(1) resolve)
      indexedComposites = this.#actionIndexingService.indexActions(
        actor.id,
        discoveredActions
      );

      this.#logger.debug(
        `Displaying ${indexedComposites.length} indexed choices to actor ${actor.id}.`
      );

      await this.#promptOutputPort.prompt(actor.id, indexedComposites);
    } catch (err) {
      if (
        err instanceof PromptError &&
        err.code === 'ACTION_DISCOVERY_FAILED'
      ) {
        this.#logger.error(
          `Action discovery failed for actor ${actor.id}. Surfacing error via output port.`,
          err
        );
        try {
          await this.#promptOutputPort.prompt(actor.id, [], err);
        } catch (portError) {
          this.#logger.error(
            'Failed to send discovery error to promptOutputPort',
            portError
          );
        }
      }
      throw err;
    }

    // ─────────────────── Create Session ───────────────────
    const session = new PromptSession({
      actorId: actor.id,
      eventBus: this.#playerTurnEvents,
      logger: this.#logger,
      abortSignal: cancellationSignal,
      actionIndexingService: this.#actionIndexingService,
    });
    this.#activeSession = session;

    this.#logger.debug(`Prompt session created for actor ${actor.id}.`);

    const sessionPromise = session.run();

    sessionPromise.finally(() => {
      if (this.#activeSession === session) {
        this.#activeSession = null;
        this.#logger.debug(
          `Active session for actor ${actor.id} has ended and been cleared.`
        );
      }
    });

    return sessionPromise;
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
