/**
 * @file This module is the main handler of a turn for a human character.
 * @see src/turns/handlers/humanTurnHandler.js
 */

import ActorTurnHandler from './actorTurnHandler.js';

/** @typedef {import('../../interfaces/IPromptCoordinator.js').IPromptCoordinator} IPromptCoordinator */

/**
 * @class HumanTurnHandler
 * @augments ActorTurnHandler
 * @description Thin wrapper that configures ActorTurnHandler for human players.
 */
class HumanTurnHandler extends ActorTurnHandler {
  /**
   * @param {object} deps
   * @param {import('../../interfaces/coreServices.js').ILogger} deps.logger
   * @param {import('../interfaces/ITurnStateFactory.js').ITurnStateFactory} deps.turnStateFactory
   * @param {import('../ports/ITurnEndPort.js').ITurnEndPort} deps.turnEndPort
   * @param {import('../interfaces/ITurnStrategyFactory.js').ITurnStrategyFactory} deps.turnStrategyFactory
   * @param {import('../builders/turnContextBuilder.js').TurnContextBuilder} deps.turnContextBuilder
   */
  constructor({ turnStrategyFactory, ...rest }) {
    super({ ...rest, turnStrategyFactory });
  }
}

export default HumanTurnHandler;
export { HumanTurnHandler };
