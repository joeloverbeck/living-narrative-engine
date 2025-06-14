/**
 * @file This module contains the handler for turns for AI-controlled actors.
 * @see src/turns/handlers/aiTurnHandler.js
 */

import ActorTurnHandler from './actorTurnHandler.js';

/**
 * @class AITurnHandler
 * @augments ActorTurnHandler
 * @description Thin wrapper that configures ActorTurnHandler for AI actors.
 */
export class AITurnHandler extends ActorTurnHandler {
  /**
   * @param {object} deps
   * @param {import('../../interfaces/coreServices.js').ILogger} deps.logger
   * @param {import('../interfaces/ITurnStateFactory.js').ITurnStateFactory} deps.turnStateFactory
   * @param {import('../ports/ITurnEndPort.js').ITurnEndPort} deps.turnEndPort
   * @param {import('../interfaces/ITurnStrategyFactory.js').ITurnStrategyFactory} deps.strategyFactory
   * @param {import('../builders/turnContextBuilder.js').TurnContextBuilder} deps.turnContextBuilder
   */
  constructor({ strategyFactory, ...rest }) {
    super({ ...rest, strategyFactory });
  }
}

export default AITurnHandler;
