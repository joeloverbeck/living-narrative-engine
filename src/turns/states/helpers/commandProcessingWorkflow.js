/**
 * @file commandProcessingWorkflow.js
 * @description Workflow for dispatching a command, interpreting the result,
 *   and executing the resolved directive for a ProcessingCommandState.
 *   Refactored to have better separation of concerns with clearer method responsibilities.
 */

/**
 * @typedef {import('../../../types/stateTypes.js').ProcessingCommandStateLike} ProcessingCommandStateLike
 * @typedef {import('../../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 * @typedef {import('../../../entities/entity.js').default} Entity
 * @typedef {import('../../interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction
 * @typedef {import('../../../commands/interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor
 * @typedef {import('../../../commands/interfaces/ICommandOutcomeInterpreter.js').ICommandOutcomeInterpreter} ICommandOutcomeInterpreter
 * @typedef {import('../../interfaces/IDirectiveStrategyResolver.js').IDirectiveStrategyResolver} IDirectiveStrategyResolver
 * @typedef {import('../../../types/commandResult.js').CommandResult} CommandResult
 */

import { ServiceLookupError } from './getServiceFromContext.js';
import { ProcessingExceptionHandler } from './processingExceptionHandler.js';
import { finishProcessing } from './processingErrorUtils.js';
import { getLogger } from './contextUtils.js';

/**
 * @class CommandProcessingWorkflow
 * @description Orchestrates command processing with clear separation of dispatch, interpretation, and execution phases.
 * Each phase is handled by a dedicated private method for better maintainability and testability.
 */
export class CommandProcessingWorkflow {
  _state;
  _exceptionHandler;
  _commandProcessor;
  _commandOutcomeInterpreter;
  _directiveStrategyResolver;
  _commandDispatcher;
  _resultInterpreter;
  _directiveExecutor;

  /**
   * Creates the workflow instance.
   *
   * @param {ProcessingCommandStateLike} state - Owning state instance.
   * @param {ProcessingExceptionHandler} [exceptionHandler] - Optional handler for errors.
   * @param {ICommandProcessor} commandProcessor - Injected command processor.
   * @param {ICommandOutcomeInterpreter} commandOutcomeInterpreter - Injected outcome interpreter.
   * @param {IDirectiveStrategyResolver} directiveStrategyResolver - Injected directive resolver.
   * @param {CommandDispatcher} [commandDispatcher] - Service for command dispatch.
   * @param {ResultInterpreter} [resultInterpreter] - Service for result interpretation.
   * @param {DirectiveExecutor} [directiveExecutor] - Service for directive execution.
   */
  constructor({
    state,
    exceptionHandler,
    commandProcessor,
    commandOutcomeInterpreter,
    directiveStrategyResolver,
    commandDispatcher,
    resultInterpreter,
    directiveExecutor,
  }) {
    this._state = state;

    if (!commandProcessor) {
      throw new Error(
        'CommandProcessingWorkflow: commandProcessor is required.'
      );
    }
    if (!commandOutcomeInterpreter) {
      throw new Error(
        'CommandProcessingWorkflow: commandOutcomeInterpreter is required.'
      );
    }
    if (!directiveStrategyResolver) {
      throw new Error(
        'CommandProcessingWorkflow: directiveStrategyResolver is required.'
      );
    }

    // If no specific exceptionHandler is provided, create a default one.
    // Use the state's own robust logger resolution for the default handler.
    this._exceptionHandler =
      exceptionHandler ||
      new ProcessingExceptionHandler(getLogger(null, this._state._handler));

    // Store the injected services for use by the workflow
    this._commandProcessor = commandProcessor;
    this._commandOutcomeInterpreter = commandOutcomeInterpreter;
    this._directiveStrategyResolver = directiveStrategyResolver;

    // Store optional service modules for separation of concerns
    this._commandDispatcher = commandDispatcher;
    this._resultInterpreter = resultInterpreter;
    this._directiveExecutor = directiveExecutor;
  }

  /**
   * Creates standardized error context for logging and handling.
   *
   * @private
   * @param {string} phase - The phase where the error occurred (dispatch, interpretation, execution)
   * @param {Error} error - The error that occurred
   * @param {string} actorId - The actor ID
   * @param {object} [additionalContext] - Additional context information
   * @returns {object} Error context object
   */
  _createErrorContext(phase, error, actorId, additionalContext = {}) {
    return {
      phase: `command_processing_${phase}`,
      error: error.message,
      stack: error.stack,
      actorId,
      stateName: this._state.getStateName(),
      timestamp: Date.now(),
      ...additionalContext,
    };
  }

  /**
   * Validates the turn context is still valid for the expected actor.
   *
   * @private
   * @param {ITurnContext} turnCtx - Turn context to validate
   * @param {string} expectedActorId - Expected actor ID
   * @returns {boolean} True if valid, false otherwise
   */
  _isContextValid(turnCtx, expectedActorId) {
    if (!turnCtx || typeof turnCtx.getActor !== 'function') {
      return false;
    }

    const currentActorId = turnCtx.getActor()?.id;
    return currentActorId === expectedActorId;
  }

  /**
   * Dispatches the provided action via CommandDispatcher service or ICommandProcessor.
   *
   * @private
   * @param {ITurnContext} turnCtx - Current turn context.
   * @param {Entity} actor - Actor executing the command.
   * @param {ITurnAction} turnAction - Action to process.
   * @returns {Promise<{activeTurnCtx: ITurnContext, commandResult: CommandResult}|null>} The active context and command result, or `null` on error.
   */
  async _dispatchAction(turnCtx, actor, turnAction) {
    // Use CommandDispatcher service if available for better separation of concerns
    if (this._commandDispatcher) {
      const result = await this._commandDispatcher.dispatch({
        turnContext: turnCtx,
        actor,
        turnAction,
        stateName: this._state.getStateName(),
      });

      if (!result) {
        return null;
      }

      // Validate context after dispatch using the service
      const isValid = this._commandDispatcher.validateContextAfterDispatch({
        turnContext: result.turnContext,
        expectedActorId: actor.id,
        stateName: this._state.getStateName(),
      });

      if (!isValid) {
        return null;
      }

      return {
        activeTurnCtx: result.turnContext,
        commandResult: result.commandResult,
      };
    }

    // Fallback to original implementation
    const logger = turnCtx.getLogger();
    const actorId = actor.id;
    const stateName = this._state.getStateName();

    // Validate command processor availability
    if (!this._commandProcessor) {
      const error = new ServiceLookupError(
        'ICommandProcessor could not be resolved from the constructor.'
      );
      const errorContext = this._createErrorContext(
        'dispatch',
        error,
        actorId,
        {
          actionId: turnAction.actionDefinitionId,
        }
      );
      logger.error('Command processor not available', errorContext);
      await this._exceptionHandler.handle(turnCtx, error, actorId);
      return null;
    }

    logger.debug(
      `${stateName}: Invoking commandProcessor.dispatchAction() for actor ${actorId}, actionId: ${turnAction.actionDefinitionId}.`
    );

    try {
      // Dispatch the action
      const commandResult = await this._commandProcessor.dispatchAction(
        actor,
        turnAction
      );

      // Validate processing state
      if (!this._state.isProcessing) {
        // Processing flag cleared during dispatch - this can happen with fast operations or state transitions
        // This is a handled edge case - workflow will stop safely
        logger.debug(
          `${stateName}: processing flag became false after dispatch for ${actorId} (handled edge case).`
        );
        return null;
      }

      // Get and validate the active context
      const activeTurnCtx = this._state._getTurnContext();
      if (!this._isContextValid(activeTurnCtx, actorId)) {
        const currentActorId = activeTurnCtx?.getActor?.()?.id ?? 'N/A';
        const error = new Error(
          'Context invalid/changed after action dispatch.'
        );
        const errorContext = this._createErrorContext(
          'dispatch',
          error,
          actorId,
          {
            currentActorId,
            actionId: turnAction.actionDefinitionId,
          }
        );

        logger.warn(
          `${stateName}: Context validation failed after dispatch`,
          errorContext
        );

        const contextForException = this._isContextValid(
          activeTurnCtx,
          currentActorId
        )
          ? activeTurnCtx
          : turnCtx;

        await this._exceptionHandler.handle(
          contextForException,
          error,
          actorId,
          false
        );
        return null;
      }

      logger.debug(
        `${stateName}: Action dispatch completed for actor ${actorId}. Result success: ${commandResult.success}.`
      );

      return { activeTurnCtx, commandResult };
    } catch (dispatchError) {
      // Handle unexpected errors during dispatch
      const errorContext = this._createErrorContext(
        'dispatch',
        dispatchError,
        actorId,
        {
          actionId: turnAction.actionDefinitionId,
          commandString: turnAction.commandString,
        }
      );
      logger.error('Error during action dispatch', errorContext);
      await this._exceptionHandler.handle(turnCtx, dispatchError, actorId);
      return null;
    }
  }

  /**
   * Interprets a command result into a directive using ResultInterpreter service or fallback.
   *
   * @private
   * @param {ITurnContext} activeTurnCtx - Active turn context after dispatch.
   * @param {string} actorId - Actor ID for logging.
   * @param {object} commandResult - Result from dispatch.
   * @returns {Promise<{directiveType: string}|null>} The directive type or `null` on error.
   */
  async _interpretCommandResult(activeTurnCtx, actorId, commandResult) {
    // Use ResultInterpreter service if available for better separation of concerns
    if (this._resultInterpreter) {
      return await this._resultInterpreter.interpret({
        commandResult,
        turnContext: activeTurnCtx,
        actorId,
        stateName: this._state.getStateName(),
      });
    }

    // Fallback to original implementation
    const logger = activeTurnCtx.getLogger();
    const stateName = this._state.getStateName();

    try {
      // Validate interpreter availability
      if (!this._commandOutcomeInterpreter) {
        throw new Error('Command outcome interpreter not available');
      }

      // Interpret the command result
      const directiveType = await this._commandOutcomeInterpreter.interpret(
        commandResult,
        activeTurnCtx
      );

      // Validate the directive type
      if (!directiveType || typeof directiveType !== 'string') {
        throw new Error(`Invalid directive type returned: ${directiveType}`);
      }

      logger.debug(
        `${stateName}: Actor ${actorId} - Dispatch result interpreted to directive: ${directiveType}`
      );

      return { directiveType };
    } catch (interpretError) {
      // Handle interpretation errors with consistent error context
      const errorContext = this._createErrorContext(
        'interpretation',
        interpretError,
        actorId,
        {
          commandSuccess: commandResult.success,
          commandError: commandResult.error,
        }
      );
      logger.error('Error during result interpretation', errorContext);
      await this._exceptionHandler.handle(
        activeTurnCtx,
        interpretError,
        actorId
      );
      return null;
    }
  }

  /**
   * Executes the strategy associated with the provided directive using DirectiveExecutor service or fallback.
   *
   * @private
   * @param {ITurnContext} activeTurnCtx - Active turn context after dispatch.
   * @param {string} directiveType - Directive to execute.
   * @param {object} result - Command result passed to the strategy.
   * @returns {Promise<void>} Resolves when the strategy completes.
   */
  async _executeDirectiveStrategy(activeTurnCtx, directiveType, result) {
    // Use DirectiveExecutor service if available for better separation of concerns
    if (this._directiveExecutor) {
      const executionResult = await this._directiveExecutor.execute({
        turnContext: activeTurnCtx,
        directiveType,
        commandResult: result,
        stateName: this._state.getStateName(),
      });

      // Handle state management after execution
      if (executionResult.executed) {
        const logger = activeTurnCtx.getLogger();
        const actorId = activeTurnCtx.getActor()?.id ?? 'UnknownActor';
        const stateName = this._state.getStateName();

        // Check processing state after execution
        if (!this._state.isProcessing) {
          logger.debug(
            `${stateName}: Processing flag false after directive strategy for ${actorId}.`
          );
          return;
        }

        // Check if state has changed
        const currentState = this._state._handler.getCurrentState();
        if (currentState !== this._state) {
          logger.debug(
            `${stateName}: Directive strategy executed for ${actorId}, state changed from ${stateName} to ${currentState?.getStateName() ?? 'Unknown'}.`
          );
          finishProcessing(this._state);
          return;
        }

        logger.debug(
          `${stateName}: Directive strategy executed for ${actorId}, state remains ${stateName}.`
        );
        finishProcessing(this._state);
      }
      return;
    }

    // Fallback to original implementation
    const logger = activeTurnCtx.getLogger();
    const actorId = activeTurnCtx.getActor()?.id ?? 'UnknownActor';
    const stateName = this._state.getStateName();

    try {
      // Validate strategy resolver availability
      if (!this._directiveStrategyResolver) {
        throw new Error('Directive strategy resolver not available');
      }

      // Resolve the strategy for the directive
      const strategy =
        this._directiveStrategyResolver.resolveStrategy(directiveType);
      if (!strategy) {
        throw new Error(
          `Could not resolve ITurnDirectiveStrategy for directive '${directiveType}'`
        );
      }

      logger.debug(
        `${stateName}: Actor ${actorId} - Resolved strategy ${strategy.constructor.name} for directive ${directiveType}.`
      );

      // Execute the strategy
      await strategy.execute(activeTurnCtx, directiveType, result);

      logger.debug(
        `${stateName}: Actor ${actorId} - Directive strategy ${strategy.constructor.name} executed.`
      );

      // Check processing state after execution
      if (!this._state.isProcessing) {
        logger.debug(
          `${stateName}: Processing flag false after directive strategy for ${actorId}.`
        );
        return;
      }

      // Check if state has changed
      const currentState = this._state._handler.getCurrentState();
      if (currentState !== this._state) {
        logger.debug(
          `${stateName}: Directive strategy executed for ${actorId}, state changed from ${stateName} to ${currentState?.getStateName() ?? 'Unknown'}.`
        );
        finishProcessing(this._state);
        return;
      }

      logger.debug(
        `${stateName}: Directive strategy executed for ${actorId}, state remains ${stateName}.`
      );
      finishProcessing(this._state);
    } catch (executionError) {
      // Handle execution errors with consistent error context
      const errorContext = this._createErrorContext(
        'execution',
        executionError,
        actorId,
        {
          directiveType,
          commandSuccess: result.success,
        }
      );
      logger.error('Error during directive execution', errorContext);
      await this._exceptionHandler.handle(
        activeTurnCtx,
        executionError,
        actorId
      );
    }
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
      // Standardized error handling for the workflow
      const ctxForError = this._state._getTurnContext() ?? turnCtx;
      const actorIdForHandler = ctxForError?.getActor?.()?.id ?? actorId;

      // Ensure we have a proper Error object
      const processingError =
        error instanceof Error
          ? error
          : new Error(String(error.message || error));

      // Preserve stack trace if available
      if (!(error instanceof Error) && error.stack) {
        processingError.stack = error.stack;
      }

      // Create consistent error context
      const errorContext = this._createErrorContext(
        'workflow',
        processingError,
        actorIdForHandler,
        {
          actionId: turnAction.actionDefinitionId,
          commandString: turnAction.commandString,
          errorType: error.constructor.name,
        }
      );

      // Log the error with full context
      const logger = ctxForError?.getLogger?.() ?? turnCtx.getLogger();
      logger.error('Error in command processing workflow', errorContext);

      // Handle the error through the exception handler
      await this._exceptionHandler.handle(
        ctxForError || turnCtx,
        processingError,
        actorIdForHandler
      );
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
