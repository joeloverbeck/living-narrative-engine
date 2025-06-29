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
 * @typedef {import('../../commands/interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor
 * @typedef {import('../../commands/interfaces/ICommandOutcomeInterpreter.js').ICommandOutcomeInterpreter} ICommandOutcomeInterpreter
 */

/**
 * @class ConcreteTurnStateFactory
 * @implements {ITurnStateFactory}
 * @description
 * Concrete factory for creating various turn state instances.
 */
export class ConcreteTurnStateFactory extends ITurnStateFactory {
  #commandProcessor;
  #commandOutcomeInterpreter;

  /**
   * @param {object} deps Dependencies
   * @param {ICommandProcessor} deps.commandProcessor The command processor.
   * @param {ICommandOutcomeInterpreter} deps.commandOutcomeInterpreter The command outcome interpreter.
   */
  constructor({ commandProcessor, commandOutcomeInterpreter }) {
    super();
    if (!commandProcessor) {
      throw new Error(
        'ConcreteTurnStateFactory: commandProcessor is required.'
      );
    }
    if (!commandOutcomeInterpreter) {
      throw new Error(
        'ConcreteTurnStateFactory: commandOutcomeInterpreter is required.'
      );
    }
    this.#commandProcessor = commandProcessor;
    this.#commandOutcomeInterpreter = commandOutcomeInterpreter;
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
  createAwaitingInputState(handler, actionDecisionWorkflowFactory) {
    return new AwaitingActorDecisionState(
      handler,
      actionDecisionWorkflowFactory
    );
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
    directiveResolver,
    processingWorkflowFactory,
    commandProcessingWorkflowFactory
  ) {
    return new ProcessingCommandState({
      handler,
      commandProcessor: this.#commandProcessor,
      commandOutcomeInterpreter: this.#commandOutcomeInterpreter,
      commandString,
      turnAction,
      directiveResolver,
      processingWorkflowFactory,
      commandProcessingWorkflowFactory,
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
