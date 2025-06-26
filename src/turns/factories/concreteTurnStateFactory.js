// src/turns/factories/ConcreteTurnStateFactory.js
// ──────────────────────────────────────────────────────────────────────────────

import { ITurnStateFactory } from '../interfaces/ITurnStateFactory.js';
import { AwaitingActorDecisionState } from '../states/awaitingActorDecisionState.js';
import { AwaitingExternalTurnEndState } from '../states/awaitingExternalTurnEndState.js';
import { ProcessingCommandState } from '../states/processingCommandState.js';
import { TurnEndingState } from '../states/turnEndingState.js';
import { TurnIdleState } from '../states/turnIdleState.js';
import TurnDirectiveStrategyResolver from '../strategies/turnDirectiveStrategyResolver.js';

/**
 * @typedef {import('../handlers/baseTurnHandler.js').BaseTurnHandler} BaseTurnHandler
 * @typedef {import('../interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction
 * @typedef {import('../interfaces/ITurnState.js').ITurnState} ITurnState
 * @typedef {import('../../interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor
 */

/**
 * @class ConcreteTurnStateFactory
 * @implements {ITurnStateFactory}
 * @description
 * Concrete factory for creating various turn state instances.
 */
export class ConcreteTurnStateFactory extends ITurnStateFactory {
  #commandProcessor;

  /**
   * @param {object} deps Dependencies
   * @param {ICommandProcessor} deps.commandProcessor The command processor.
   */
  constructor({ commandProcessor }) {
    super();
    if (!commandProcessor) {
      throw new Error('ConcreteTurnStateFactory: commandProcessor is required.');
    }
    this.#commandProcessor = commandProcessor;
  }

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
   * @param {Function} directiveResolver - Resolver for command directives.
   */
  createProcessingCommandState(
    handler,
    commandString,
    turnAction,
    directiveResolver
  ) {
    return new ProcessingCommandState({
      handler,
      commandProcessor: this.#commandProcessor,
      commandString,
      turnAction,
      directiveResolver,
    });
  }

  /**
   * @override
   * @param {BaseTurnHandler} handler
   */
  createAwaitingExternalTurnEndState(handler) {
    return new AwaitingExternalTurnEndState(handler);
  }
}
