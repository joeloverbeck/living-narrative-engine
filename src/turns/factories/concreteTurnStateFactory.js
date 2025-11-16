// src/turns/factories/ConcreteTurnStateFactory.js
// ──────────────────────────────────────────────────────────────────────────────

import { ITurnStateFactory } from '../interfaces/ITurnStateFactory.js';
import { AwaitingActorDecisionState } from '../states/awaitingActorDecisionState.js';
import { AwaitingExternalTurnEndState } from '../states/awaitingExternalTurnEndState.js';
import { ProcessingCommandState } from '../states/processingCommandState.js';
import { TurnEndingState } from '../states/turnEndingState.js';
import { TurnIdleState } from '../states/turnIdleState.js';
import TurnDirectiveStrategyResolver, {
  DEFAULT_STRATEGY_MAP,
} from '../strategies/turnDirectiveStrategyResolver.js';
import { CommandProcessingWorkflow } from '../states/helpers/commandProcessingWorkflow.js';
import { KnowledgeUpdateWorkflow } from '../states/workflows/knowledgeUpdateWorkflow.js';

/**
 * @typedef {import('../interfaces/ITurnStateHost.js').ITurnStateHost} BaseTurnHandler
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
  #commandDispatcher;
  #resultInterpreter;
  #directiveExecutor;
  #knowledgeManager;

  /**
   * @param {object} deps Dependencies
   * @param {ICommandProcessor} deps.commandProcessor The command processor.
   * @param {ICommandOutcomeInterpreter} deps.commandOutcomeInterpreter The command outcome interpreter.
   * @param {CommandDispatcher} [deps.commandDispatcher] Optional command dispatcher service.
   * @param {ResultInterpreter} [deps.resultInterpreter] Optional result interpreter service.
   * @param {DirectiveExecutor} [deps.directiveExecutor] Optional directive executor service.
   * @param {object} [deps.knowledgeManager] Optional GOAP knowledge manager service for updating actor knowledge before decisions.
   */
  constructor({
    commandProcessor,
    commandOutcomeInterpreter,
    commandDispatcher,
    resultInterpreter,
    directiveExecutor,
    knowledgeManager,
  }) {
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
    this.#commandDispatcher = commandDispatcher;
    this.#resultInterpreter = resultInterpreter;
    this.#directiveExecutor = directiveExecutor;
    this.#knowledgeManager = knowledgeManager;
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
    // Create knowledge update workflow factory if KnowledgeManager is available
    const knowledgeUpdateWorkflowFactory = this.#knowledgeManager
      ? (state, ctx, actor) =>
          new KnowledgeUpdateWorkflow(state, ctx, actor, this.#knowledgeManager)
      : null;

    return new AwaitingActorDecisionState(
      handler,
      actionDecisionWorkflowFactory,
      knowledgeUpdateWorkflowFactory
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
    // Create enhanced CommandProcessingWorkflow factory that injects services
    const enhancedCommandProcessingWorkflowFactory =
      commandProcessingWorkflowFactory ||
      ((config) =>
        new CommandProcessingWorkflow({
          ...config,
          commandDispatcher: this.#commandDispatcher,
          resultInterpreter: this.#resultInterpreter,
          directiveExecutor: this.#directiveExecutor,
        }));

    return new ProcessingCommandState({
      handler,
      commandProcessor: this.#commandProcessor,
      commandOutcomeInterpreter: this.#commandOutcomeInterpreter,
      commandString,
      turnAction,
      directiveResolver,
      processingWorkflowFactory,
      commandProcessingWorkflowFactory:
        enhancedCommandProcessingWorkflowFactory,
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
