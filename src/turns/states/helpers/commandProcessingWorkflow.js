/**
 * @file commandProcessingWorkflow.js
 * @description Workflow for dispatching a command, interpreting the result,
 *   and executing the resolved directive for a ProcessingCommandState.
 */

/**
 * @typedef {import('../../../types/stateTypes.js').ProcessingCommandStateLike} ProcessingCommandStateLike
 * @typedef {import('../../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 * @typedef {import('../../../entities/entity.js').default} Entity
 * @typedef {import('../../interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction
 * @typedef {import('../../../commands/interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor
 * @typedef {import('../../../commands/interfaces/ICommandOutcomeInterpreter.js').ICommandOutcomeInterpreter} ICommandOutcomeInterpreter
 * @typedef {import('../../interfaces/IDirectiveStrategyResolver.js').IDirectiveStrategyResolver} IDirectiveStrategyResolver
 */

import {
  getServiceFromContext,
  ServiceLookupError,
} from './getServiceFromContext.js';
import { ProcessingExceptionHandler } from './processingExceptionHandler.js';
import { finishProcessing } from './processingErrorUtils.js';
import { getLogger } from './contextUtils.js';

/**
 * @class CommandProcessingWorkflow
 * @description Handles command processing steps for a ProcessingCommandState.
 */
export class CommandProcessingWorkflow {
  _state;
  _exceptionHandler;
  _commandProcessor;
  _commandOutcomeInterpreter;
  _directiveStrategyResolver;

  /**
   * Creates the workflow instance.
   *
   * @param {ProcessingCommandStateLike} state - Owning state instance.
   * @param {ProcessingExceptionHandler} [exceptionHandler] - Optional handler for errors.
   * @param {ICommandProcessor} commandProcessor Injected command processor.
   * @param {ICommandOutcomeInterpreter} commandOutcomeInterpreter Injected outcome interpreter.
   */
  constructor({
    state,
    exceptionHandler,
    commandProcessor,
    commandOutcomeInterpreter,
    directiveStrategyResolver,
  }) {
    this._state = state;
    this._commandProcessor = commandProcessor;
    this._commandOutcomeInterpreter = commandOutcomeInterpreter;
    this._directiveStrategyResolver = directiveStrategyResolver;

    if (!this._commandProcessor) {
      throw new Error(
        'CommandProcessingWorkflow: commandProcessor is required.'
      );
    }
    if (!this._commandOutcomeInterpreter) {
      throw new Error(
        'CommandProcessingWorkflow: commandOutcomeInterpreter is required.'
      );
    }
    if (!this._directiveStrategyResolver) {
      throw new Error(
        'CommandProcessingWorkflow: directiveStrategyResolver is required.'
      );
    }

    // If no specific exceptionHandler is provided, create a default one.
    // Use the state's own robust logger resolution for the default handler.
    this._exceptionHandler =
      exceptionHandler ||
      new ProcessingExceptionHandler(getLogger(null, this._state._handler));
  }

  /**
   * Dispatches the provided action via ICommandProcessor.
   *
   * @private
   * @param {ITurnContext} turnCtx - Current turn context.
   * @param {Entity} actor - Actor executing the command.
   * @param {ITurnAction} turnAction - Action to process.
   * @returns {Promise<{activeTurnCtx: ITurnContext, commandResult: object}|null>} The active context and command result, or `null` on error.
   */
  async _dispatchAction(turnCtx, actor, turnAction) {
    const logger = turnCtx.getLogger();
    const actorId = actor.id;

    const commandProcessor = this._commandProcessor;

    if (!commandProcessor) {
      const error = new ServiceLookupError(
        'ICommandProcessor could not be resolved from the constructor.'
      );
      await this._exceptionHandler.handle(turnCtx, error, actorId);
      return null;
    }

    logger.debug(
      `${this._state.getStateName()}: Invoking commandProcessor.dispatchAction() for actor ${actorId}, actionId: ${turnAction.actionDefinitionId}.`
    );

    const { success, commandResult: dispatchCommandResult } =
      await commandProcessor.dispatchAction(actor, turnAction);

    if (!this._state.isProcessing) {
      logger.warn(
        `${this._state.getStateName()}: processing flag became false after dispatch for ${actorId}.`
      );
      return null;
    }

    const activeTurnCtx = this._state._getTurnContext();
    if (
      !activeTurnCtx ||
      typeof activeTurnCtx.getActor !== 'function' ||
      activeTurnCtx.getActor()?.id !== actorId
    ) {
      logger.warn(
        `${this._state.getStateName()}: Context invalid or changed after dispatch for ${actorId}. Current context actor: ${activeTurnCtx?.getActor?.()?.id ?? 'N/A'}.`
      );
      const contextForException =
        activeTurnCtx && typeof activeTurnCtx.getActor === 'function'
          ? activeTurnCtx
          : turnCtx;
      await this._exceptionHandler.handle(
        contextForException,
        new Error('Context invalid/changed after action dispatch.'),
        actorId,
        false
      );
      return null;
    }

    const commandResult = {
      success: success,
      turnEnded: !success,
      originalInput: turnAction.commandString || turnAction.actionDefinitionId,
      actionResult: { actionId: turnAction.actionDefinitionId },
      error: success ? undefined : dispatchCommandResult?.error,
      internalError: success ? undefined : dispatchCommandResult?.internalError,
    };

    logger.debug(
      `${this._state.getStateName()}: Action dispatch completed for actor ${actorId}. Result success: ${commandResult.success}.`
    );

    return { activeTurnCtx, commandResult };
  }

  /**
   * Interprets a command result into a directive.
   *
   * @private
   * @param {ITurnContext} activeTurnCtx - Active turn context after dispatch.
   * @param {string} actorId - Actor ID for logging.
   * @param {object} commandResult - Result from dispatch.
   * @returns {Promise<{directiveType: string}|null>} The directive type or `null` on error.
   */
  async _interpretCommandResult(activeTurnCtx, actorId, commandResult) {
    const outcomeInterpreter = this._commandOutcomeInterpreter;

    const directiveType = await outcomeInterpreter.interpret(
      commandResult,
      activeTurnCtx
    );
    activeTurnCtx
      .getLogger()
      .debug(
        `${this._state.getStateName()}: Actor ${actorId} - Dispatch result interpreted to directive: ${directiveType}`
      );

    return { directiveType };
  }

  /**
   * Executes the strategy associated with the provided directive.
   *
   * @private
   * @param {ITurnContext} activeTurnCtx - Active turn context after dispatch.
   * @param {string} directiveType - Directive to execute.
   * @param {object} result - Command result passed to the strategy.
   * @returns {Promise<void>} Resolves when the strategy completes.
   */
  async _executeDirectiveStrategy(activeTurnCtx, directiveType, result) {
    const logger = activeTurnCtx.getLogger();
    const actorId = activeTurnCtx.getActor()?.id ?? 'UnknownActor';

    const strategy =
      this._directiveStrategyResolver.resolveStrategy(directiveType);
    if (!strategy) {
      const errorMsg = `${this._state.getStateName()}: Could not resolve ITurnDirectiveStrategy for directive '${directiveType}' (actor ${actorId}).`;
      logger.error(errorMsg);
      await this._exceptionHandler.handle(
        activeTurnCtx,
        new Error(errorMsg),
        actorId
      );
      return;
    }

    logger.debug(
      `${this._state.getStateName()}: Actor ${actorId} - Resolved strategy ${strategy.constructor.name} for directive ${directiveType}.`
    );

    await strategy.execute(activeTurnCtx, directiveType, result);
    logger.debug(
      `${this._state.getStateName()}: Actor ${actorId} - Directive strategy ${strategy.constructor.name} executed.`
    );

    if (!this._state.isProcessing) {
      logger.debug(
        `${this._state.getStateName()}: Processing flag false after directive strategy for ${actorId}.`
      );
      return;
    }

    const currentState = this._state._handler.getCurrentState();
    if (currentState !== this._state) {
      logger.debug(
        `${this._state.getStateName()}: Directive strategy executed for ${actorId}, state changed from ${this._state.getStateName()} to ${currentState?.getStateName() ?? 'Unknown'}.`
      );
      finishProcessing(this._state);
      return;
    }

    logger.debug(
      `${this._state.getStateName()}: Directive strategy executed for ${actorId}, state remains ${this._state.getStateName()}.`
    );
    finishProcessing(this._state);
  }

  /**
   * Executes the main command processing workflow.
   *
   * @param {ITurnContext} turnCtx - Current turn context.
   * @param {Entity} actor - Actor executing the command.
   * @param {ITurnAction} turnAction - Action to process.
   * @returns {Promise<void>} Resolves when processing completes.
   */
  async processCommand(turnCtx, actor, turnAction) {
    const actorId = actor.id;

    try {
      const dispatchResult = await this._dispatchAction(
        turnCtx,
        actor,
        turnAction
      );
      if (!dispatchResult) {
        return;
      }

      const { activeTurnCtx, commandResult } = dispatchResult;

      const interpretation = await this._interpretCommandResult(
        activeTurnCtx,
        actorId,
        commandResult
      );
      if (!interpretation) {
        return;
      }

      const { directiveType } = interpretation;

      await this._executeDirectiveStrategy(
        activeTurnCtx,
        directiveType,
        commandResult
      );
    } catch (error) {
      const ctxForError = this._state._getTurnContext() ?? turnCtx;
      const actorIdForHandler = ctxForError?.getActor?.()?.id ?? actorId;
      const processingError =
        error instanceof Error
          ? error
          : new Error(String(error.message || error));
      if (!(error instanceof Error) && error.stack) {
        processingError.stack = error.stack;
      }
      if (error instanceof ServiceLookupError) {
        await this._exceptionHandler.handle(
          ctxForError || turnCtx,
          processingError,
          actorIdForHandler
        );
      } else {
        await this._exceptionHandler.handle(
          ctxForError || turnCtx,
          processingError,
          actorIdForHandler
        );
      }
    } finally {
      if (
        this._state.isProcessing &&
        this._state._handler.getCurrentState() === this._state
      ) {
        const finalLogger =
          this._state._getTurnContext()?.getLogger() ?? turnCtx.getLogger();
        finalLogger.warn(
          `${this._state.getStateName()}: isProcessing was unexpectedly true at the end of _processCommandInternal for ${actorId}. Forcing to false.`
        );
        finishProcessing(this._state);
      }
    }
  }
}

export default CommandProcessingWorkflow;
