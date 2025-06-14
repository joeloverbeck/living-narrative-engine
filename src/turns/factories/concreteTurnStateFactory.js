// src/turns/factories/ConcreteTurnStateFactory.js
// ──────────────────────────────────────────────────────────────────────────────

import { ITurnStateFactory } from '../interfaces/ITurnStateFactory.js';
import { AwaitingActorDecisionState } from '../states/awaitingActorDecisionState.js';
import { AwaitingExternalTurnEndState } from '../states/awaitingExternalTurnEndState.js';
import { ProcessingCommandState } from '../states/processingCommandState.js';
import { TurnEndingState } from '../states/turnEndingState.js';
import { TurnIdleState } from '../states/turnIdleState.js';

/**
 * @typedef {import('../handlers/baseTurnHandler.js').BaseTurnHandler} BaseTurnHandler
 * @typedef {import('../interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction
 * @typedef {import('../interfaces/ITurnState.js').ITurnState} ITurnState
 */

/**
 * @class ConcreteTurnStateFactory
 * @implements {ITurnStateFactory}
 * @description
 * Concrete factory for creating various turn state instances.
 */
export class ConcreteTurnStateFactory extends ITurnStateFactory {
  /**
   * @override
   */
  createInitialState(handler) {
    return new TurnIdleState(handler);
  }

  /**
   * @override
   */
  createIdleState(handler) {
    return new TurnIdleState(handler);
  }

  /**
   * @override
   */
  createEndingState(handler, actorId, error) {
    return new TurnEndingState(handler, actorId, error);
  }

  /**
   * @override
   */
  createAwaitingInputState(handler) {
    return new AwaitingActorDecisionState(handler);
  }

  /**
   * @override
   * @param {BaseTurnHandler} handler
   * @param {string} commandString
   * @param {ITurnAction} turnAction
   */
  createProcessingCommandState(handler, commandString, turnAction) {
    return new ProcessingCommandState(handler, commandString, turnAction);
  }

  /**
   * @override
   * @param {BaseTurnHandler} handler
   */
  createAwaitingExternalTurnEndState(handler) {
    return new AwaitingExternalTurnEndState(handler);
  }
}
