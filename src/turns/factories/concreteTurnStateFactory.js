// src/turns/factories/ConcreteTurnStateFactory.js
// ──────────────────────────────────────────────────────────────────────────────

// src/turns/factories/ConcreteTurnStateFactory.js
// ****** CORRECTED FILE ******

import { ITurnStateFactory } from '../interfaces/ITurnStateFactory.js';
import { TurnIdleState } from '../states/turnIdleState.js';
import { TurnEndingState } from '../states/turnEndingState.js';
import { AwaitingPlayerInputState } from '../states/awaitingPlayerInputState.js';
import { ProcessingCommandState } from '../states/processingCommandState.js'; // <-- Import added

/**
 * @typedef {import('../handlers/baseTurnHandler.js').BaseTurnHandler} BaseTurnHandler
 * @typedef {import('../interfaces/ITurnState.js').ITurnState} ITurnState
 * @typedef {import('../interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction
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
    return new AwaitingPlayerInputState(handler);
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
}

// --- FILE END ---
