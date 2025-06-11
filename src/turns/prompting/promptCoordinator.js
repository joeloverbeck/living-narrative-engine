/**
 * @file Orchestrates the player prompting flow by coordinating between various services.
 * @see src/turns/prompting/promptCoordinator.js
 */

import { PromptError } from '../../errors/promptError.js';
import { PromptSession } from './promptSession.js';
import { validateDependency } from '../../utils/validationUtils.js';

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../interfaces/IActionDiscoveryService.js').IActionDiscoveryService} IActionDiscoveryService
 * @typedef {import('../ports/IPromptOutputPort.js').IPromptOutputPort} IPromptOutputPort
 * @typedef {import('./actionContextBuilder.js').default} ActionContextBuilder
 * @typedef {import('../interfaces/IPlayerTurnEvents.js').IPlayerTurnEvents} IPlayerTurnEvents
 * @typedef {import('../../entities/entity.js').default} Entity
 */

/**
 * @typedef {object} PromptCoordinatorDependencies
 * @property {ILogger} logger
 * @property {IActionDiscoveryService} actionDiscoveryService
 * @property {IPromptOutputPort} promptOutputPort
 * @property {ActionContextBuilder} actionContextBuilder
 * @property {IPlayerTurnEvents} playerTurnEvents - An event subscription service for player input events.
 */

/**
 * @class PromptCoordinator
 * @description Orchestrates the process of prompting an actor for an action. It ensures only one prompt is active
 * at a time, handling discovery, presentation, and session management.
 * @exports PromptCoordinator
 */
class PromptCoordinator {
  /** @type {ILogger} */
  #logger;

  /** @type {IActionDiscoveryService} */
  #actionDiscoveryService;

  /** @type {IPromptOutputPort} */
  #promptOutputPort;

  /** @type {ActionContextBuilder} */
  #actionContextBuilder;

  /** @type {IPlayerTurnEvents} */
  #playerTurnEvents;

  /**
   * The currently active prompt session. Only one prompt can be active at a time.
   * @type {PromptSession | null}
   */
  #activeSession = null;

  /**
   * @param {PromptCoordinatorDependencies} deps
   */
  constructor({
    logger,
    actionDiscoveryService,
    promptOutputPort,
    actionContextBuilder,
    playerTurnEvents,
  }) {
    // The utility falls back to `console`, so it's safe to validate the logger first.
    validateDependency(logger, 'logger', console, {
      requiredMethods: ['info', 'error', 'debug', 'warn'],
    });
    validateDependency(
      actionDiscoveryService,
      'actionDiscoveryService',
      logger,
      {
        requiredMethods: ['getValidActions'],
      }
    );
    validateDependency(promptOutputPort, 'promptOutputPort', logger, {
      requiredMethods: ['prompt'],
    });
    validateDependency(actionContextBuilder, 'actionContextBuilder', logger, {
      requiredMethods: ['buildContext'],
    });
    validateDependency(playerTurnEvents, 'playerTurnEvents', logger);

    this.#logger = logger;
    this.#actionDiscoveryService = actionDiscoveryService;
    this.#promptOutputPort = promptOutputPort;
    this.#actionContextBuilder = actionContextBuilder;
    this.#playerTurnEvents = playerTurnEvents;

    this.#logger.debug('PromptCoordinator initialized.');
  }

  /**
   * Initiates a prompt for a given actor, cancelling any existing prompt.
   *
   * @param {Entity} actor - The actor to prompt for an action.
   * @param {object} [options]
   * @param {AbortSignal} [options.cancellationSignal] - An AbortSignal to cancel the entire prompt operation.
   * @returns {Promise<PlayerPromptResolution>} A promise that resolves with the player's chosen action and speech.
   * @throws {DOMException<'AbortError'>} If the provided signal is aborted.
   * @throws {PromptError} If action discovery fails or other prompt-related issues occur.
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

    let actions;
    try {
      this.#logger.debug(`Building context for actor ${actor.id}...`);
      const ctx = await this.#actionContextBuilder.buildContext(actor);

      this.#logger.debug(`Discovering actions for actor ${actor.id}...`);
      actions = await this.#actionDiscoveryService.getValidActions(actor, ctx);

      this.#logger.debug(
        `Displaying ${actions.length} actions to actor ${actor.id}.`
      );
      await this.#promptOutputPort.prompt(actor.id, actions);
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

    const session = new PromptSession({
      actorId: actor.id,
      actions,
      eventBus: this.#playerTurnEvents,
      logger: this.#logger,
      abortSignal: cancellationSignal,
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

  /**
   * Externally cancels the currently active prompt, if one exists.
   */
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
