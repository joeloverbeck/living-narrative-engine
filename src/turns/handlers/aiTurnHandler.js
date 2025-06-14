// src/turns/handlers/aiTurnHandler.js
// ****** MODIFIED FILE ******
// ──────────────────────────────────────────────────────────────────────────────
//  AITurnHandler Class (Refactored for Dependency Injection)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {import('../../entities/entity.js').default} Entity
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../ports/ITurnEndPort.js').ITurnEndPort} ITurnEndPort
 * @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 * @typedef {import('../interfaces/ITurnStateFactory.js').ITurnStateFactory} ITurnStateFactory
 * @typedef {import('../interfaces/IAIPlayerStrategyFactory.js').IAIPlayerStrategyFactory} IAIPlayerStrategyFactory
 * @typedef {import('../interfaces/ITurnContextFactory.js').ITurnContextFactory} ITurnContextFactory
 */

import { BaseTurnHandler } from './baseTurnHandler.js';
import { assertValidActor } from '../../utils/actorValidation.js';

/**
 * @class AITurnHandler
 * @augments BaseTurnHandler
 * @description
 * Handles turns for AI-controlled actors. Relies on injected factories and services for its operations.
 * This refactored class orchestrates the AI turn by delegating creation of strategies
 * and contexts to specialized factories, simplifying its own responsibilities.
 */
export class AITurnHandler extends BaseTurnHandler {
  /** @type {ITurnEndPort} */
  #turnEndPort;
  /** @type {IAIPlayerStrategyFactory} */
  #aiPlayerStrategyFactory;
  /** @type {ITurnContextFactory} */
  #turnContextFactory;

  /**
   * Creates an instance of AITurnHandler.
   *
   * @param {object} dependencies - The dependencies required by the handler.
   * @param {ILogger} dependencies.logger - The logging service.
   * @param {ITurnStateFactory} dependencies.turnStateFactory - Factory for creating turn states.
   * @param {ITurnEndPort} dependencies.turnEndPort - Port for signaling the end of a turn.
   * @param {IAIPlayerStrategyFactory} dependencies.aiPlayerStrategyFactory - Factory for creating AI strategies.
   * @param {ITurnContextFactory} dependencies.turnContextFactory - Factory for creating turn contexts.
   */
  constructor({
    logger,
    turnStateFactory,
    turnEndPort,
    aiPlayerStrategyFactory,
    turnContextFactory,
  }) {
    super({ logger, turnStateFactory });
    if (!turnEndPort) throw new Error('AITurnHandler: Invalid ITurnEndPort');
    if (!aiPlayerStrategyFactory)
      throw new Error('AITurnHandler: Invalid IAIPlayerStrategyFactory');
    if (!turnContextFactory)
      throw new Error('AITurnHandler: Invalid ITurnContextFactory');

    this.#turnEndPort = turnEndPort;
    this.#aiPlayerStrategyFactory = aiPlayerStrategyFactory;
    this.#turnContextFactory = turnContextFactory;

    const initialState = this._turnStateFactory.createInitialState(this);
    this._setInitialState(initialState);
    this._logger.debug(
      `${this.constructor.name} initialized with simplified dependencies.`
    );
  }

  /**
   * Retrieves the port for signaling the end of a turn.
   * This is used by states (e.g., TurnEndingState) to finalize the turn process.
   *
   * @override
   * @returns {ITurnEndPort}
   */
  getTurnEndPort() {
    return this.#turnEndPort;
  }

  /**
   * Starts the turn for the given AI actor.
   * It creates a strategy and a turn context, then delegates control to the current state.
   *
   * @param {Entity} actor - The AI-controlled entity whose turn it is.
   * @override
   */
  async startTurn(actor) {
    this._logger.debug(
      `${this.constructor.name}.startTurn called for AI actor ${actor?.id}.`
    );
    super._assertHandlerActive();
    assertValidActor(actor, this._logger, `${this.constructor.name}.startTurn`);
    this._setCurrentActorInternal(actor);
    const aiStrategy = this.#aiPlayerStrategyFactory.create();
    const newTurnContext = this.#turnContextFactory.create({
      actor: actor,
      strategy: aiStrategy,
      onEndTurnCallback: (errorOrNull) =>
        this._handleTurnEnd(actor.id, errorOrNull),
      handlerInstance: this,
    });
    this._setCurrentTurnContextInternal(newTurnContext);
    if (!this._currentState) {
      this._logger.error(
        `${this.constructor.name}.startTurn: _currentState is null for actor ${actor.id}. This should have been set by turnStateFactory.`
      );
      const fallbackInitialState =
        this._turnStateFactory.createInitialState(this);
      if (fallbackInitialState) {
        this._logger.warn(
          `${this.constructor.name}.startTurn: Attempting to set initial state again.`
        );
        this._setInitialState(fallbackInitialState);
        if (!this._currentState)
          throw new Error(
            'AITurnHandler: _currentState is null, and recovery failed.'
          );
      } else {
        throw new Error(
          'AITurnHandler: _currentState is null, and turnStateFactory failed to provide a state.'
        );
      }
    }
    await this._currentState.startTurn(this, actor);
  }

  /**
   * @override
   * @param {string} [logContext]
   */
  _resetTurnStateAndResources(logContext = 'N/A') {
    super._resetTurnStateAndResources(logContext);
    // This method is now clean of obsolete state flags.
  }

  // NOTE: The `destroy` method is intentionally removed. The BaseTurnHandler's
  // `destroy` method is now sufficient, as this class no longer holds
  // direct references to resources like the LLMAdapter that need special cleanup.
}

export default AITurnHandler;
