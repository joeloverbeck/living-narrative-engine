// src/turns/services/AIGameStateProvider.js
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/IAIGameStateProvider.js').IAIGameStateProvider} IAIGameStateProvider_InterfaceType */
/** @typedef {import('../dtos/AIGameStateDTO.js').AIGameStateDTO} AIGameStateDTO */

// --- Import new service interfaces ---
/** @typedef {import('../../interfaces/IActorStateProvider.js').IActorStateProvider} IActorStateProvider */
/** @typedef {import('../../interfaces/IActorDataExtractor.js').IActorDataExtractor} IActorDataExtractor */
/** @typedef {import('../../interfaces/ILocationSummaryProvider.js').ILocationSummaryProvider} ILocationSummaryProvider */
/** @typedef {import('../../interfaces/IPerceptionLogProvider.js').IPerceptionLogProvider} IPerceptionLogProvider */

import { IAIGameStateProvider } from '../interfaces/IAIGameStateProvider.js';

/**
 * @class AIGameStateProvider
 * @implements {IAIGameStateProvider_InterfaceType}
 * @description Orchestrates the gathering of game state information for an AI actor
 * by delegating to specialized provider services.
 */
export class AIGameStateProvider extends IAIGameStateProvider {
  #actorStateProvider;
  #actorDataExtractor;
  #locationSummaryProvider;
  #perceptionLogProvider;
  #safeEventDispatcher;

  /**
   * @param {object} dependencies
   * @param {IActorStateProvider} dependencies.actorStateProvider
   * @param {IActorDataExtractor} dependencies.actorDataExtractor
   * @param {ILocationSummaryProvider} dependencies.locationSummaryProvider
   * @param {IPerceptionLogProvider} dependencies.perceptionLogProvider
   * @param {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} dependencies.safeEventDispatcher
   */
  constructor({
    actorStateProvider,
    actorDataExtractor,
    locationSummaryProvider,
    perceptionLogProvider,
    safeEventDispatcher,
  }) {
    super();
    this.#actorStateProvider = actorStateProvider;
    this.#actorDataExtractor = actorDataExtractor;
    this.#locationSummaryProvider = locationSummaryProvider;
    this.#perceptionLogProvider = perceptionLogProvider;
    this.#safeEventDispatcher = safeEventDispatcher;
  }

  /**
   * @override
   */
  async buildGameState(actor, turnContext, logger) {
    if (!actor || !actor.id) {
      throw new Error('AIGameStateProvider: Actor is invalid or missing ID.');
    }
    if (!turnContext) {
      throw new Error(
        `AIGameStateProvider: TurnContext is invalid for actor ${actor.id}.`
      );
    }

    logger.debug(
      `AIGameStateProvider: Orchestrating game state build for actor ${actor.id}.`
    );

    // Delegate each part of the state creation to a specialized service
    const actorState = this.#actorStateProvider.build(actor, logger);
    const actorPromptData = this.#actorDataExtractor.extractPromptData(
      actorState,
      actor.id
    );
    const perceptionLog = await this.#perceptionLogProvider.get(
      actor,
      logger,
      this.#safeEventDispatcher
    );
    const locationSummary = await this.#locationSummaryProvider.build(
      actor,
      logger
    );

    /** @type {AIGameStateDTO} */
    const gameState = {
      actorState,
      actorPromptData,
      currentLocation: locationSummary,
      availableActions: null,
      perceptionLog,
    };

    logger.debug(
      `AIGameStateProvider: Successfully orchestrated game state for actor ${actor.id}.`
    );
    return gameState;
  }
}
