/**
 * @file This module contains the handler for turns for AI-controlled actors.
 * @see src/turns/handlers/aiTurnHandler.js
 */

import { GenericTurnHandler } from './genericTurnHandler.js';

/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../ports/ITurnEndPort.js').ITurnEndPort} ITurnEndPort */
/** @typedef {import('../interfaces/ITurnStateFactory.js').ITurnStateFactory} ITurnStateFactory */
/** @typedef {import('../interfaces/ITurnStrategyFactory.js').ITurnStrategyFactory} ITurnStrategyFactory */

/** @typedef {import('../builders/turnContextBuilder.js').TurnContextBuilder} TurnContextBuilder */

/**
 * @class AITurnHandler
 * @augments GenericTurnHandler
 * @description Handles turns for AI-controlled actors.
 */
export class AITurnHandler extends GenericTurnHandler {
  /**
   * Creates an instance of AITurnHandler.
   *
   * @param {object} dependencies - The dependencies required by the handler.
   * @param {ILogger} dependencies.logger - The logging service.
   * @param {ITurnStateFactory} dependencies.turnStateFactory - Factory for creating turn states.
   * @param {ITurnEndPort} dependencies.turnEndPort - Port for signaling the end of a turn.
   * @param {ITurnStrategyFactory} dependencies.strategyFactory - Factory for creating AI strategies.
   * @param {TurnContextBuilder} dependencies.turnContextBuilder - Builder for creating turn contexts.
   */
  constructor({
    logger,
    turnStateFactory,
    turnEndPort,
    strategyFactory,
    turnContextBuilder,
  }) {
    super({
      logger,
      turnStateFactory,
      turnEndPort,
      strategyFactory,
      turnContextBuilder,
    });

    const initialState = this._turnStateFactory.createInitialState(this);
    this._setInitialState(initialState);
    this._logger.debug(
      `${this.constructor.name} initialized with simplified dependencies.`
    );
  }

  /**
   * Starts the turn for the given AI actor.
   * The core logic now resides in the GenericTurnHandler.
   *
   * @param {Entity} actor - The AI-controlled entity whose turn it is.
   * @override
   */
  async startTurn(actor) {
    await super.startTurn(actor);
  }
}

export default AITurnHandler;
