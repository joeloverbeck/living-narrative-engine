/**
 * @file Utility for ProcessingCommandState that handles command processing logic.
 */

/**
 * @typedef {import('../../../types/stateTypes.js').ProcessingCommandStateLike} ProcessingCommandStateLike
 * @typedef {import('../../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 * @typedef {import('../../../entities/entity.js').default} Entity
 * @typedef {import('../../interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction
 */

import {
  getServiceFromContext,
  ServiceLookupError,
} from './getServiceFromContext.js';
import { ProcessingExceptionHandler } from './processingExceptionHandler.js';
import { finishProcessing } from './processingErrorUtils.js';

/**
 * @description Uses {@link ProcessingExceptionHandler} to handle an error.
 * @param {ProcessingCommandStateLike} state - Owning state instance.
 * @param {ITurnContext} turnCtx - Context for error handling.
 * @param {Error} error - Error to handle.
 * @param {string} actorId - Actor ID for logging.
 * @returns {Promise<void>} Resolves when handling completes.
 */
async function handleProcessingException(state, turnCtx, error, actorId) {
  const exceptionHandler = new ProcessingExceptionHandler(state);
  await exceptionHandler.handle(turnCtx, error, actorId);
}

/**
 * Dispatches the provided action via ICommandProcessor.
 *
 * @param {ProcessingCommandStateLike} state - Owning state instance.
 * @param {ITurnContext} turnCtx - Current turn context.
 * @param {Entity} actor - Actor executing the command.
 * @param {ITurnAction} turnAction - Action to process.
 * @returns {Promise<{activeTurnCtx: ITurnContext, commandResult: object}|null>} The active context and command result, or `null` on error.
 */
export async function dispatchAction(state, turnCtx, actor, turnAction) {
  const logger = turnCtx.getLogger();
  const actorId = actor.id;

  const commandProcessor = await getServiceFromContext(
    state,
    turnCtx,
    'getCommandProcessor',
    'ICommandProcessor',
    actorId
  );

  logger.debug(
    `${state.getStateName()}: Invoking commandProcessor.dispatchAction() for actor ${actorId}, actionId: ${turnAction.actionDefinitionId}.`
  );

  const { success, errorResult } = await commandProcessor.dispatchAction(
    actor,
    turnAction
  );

  if (!state._isProcessing) {
    logger.warn(
      `${state.getStateName()}: Processing flag became false after commandProcessor.dispatchAction() for ${actorId}. Aborting further processing.`
    );
    return null;
  }

  const activeTurnCtx = state._getTurnContext();
  if (
    !activeTurnCtx ||
    typeof activeTurnCtx.getActor !== 'function' ||
    activeTurnCtx.getActor()?.id !== actorId
  ) {
    logger.warn(
      `${state.getStateName()}: Context is invalid, has changed, or actor mismatch after commandProcessor.dispatchAction() for ${actorId}. Current context actor: ${activeTurnCtx?.getActor?.()?.id ?? 'N/A'}. Aborting further processing.`
    );
    const contextForException =
      activeTurnCtx && typeof activeTurnCtx.getActor === 'function'
        ? activeTurnCtx
        : turnCtx;
    const exceptionHandler = new ProcessingExceptionHandler(state);
    await exceptionHandler.handle(
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
    error: success ? undefined : errorResult?.error,
    internalError: success ? undefined : errorResult?.internalError,
  };

  logger.debug(
    `${state.getStateName()}: Action dispatch completed for actor ${actorId}. Result success: ${commandResult.success}.`
  );

  return { activeTurnCtx, commandResult };
}

/**
 * Interprets a command result into a directive.
 *
 * @param {ProcessingCommandStateLike} state - Owning state instance.
 * @param {ITurnContext} activeTurnCtx - Active turn context after dispatch.
 * @param {string} actorId - Actor ID for logging.
 * @param {object} commandResult - Result from {@link dispatchAction}.
 * @returns {Promise<{directiveType: string}|null>} The directive type or `null` on error.
 */
export async function interpretCommandResult(
  state,
  activeTurnCtx,
  actorId,
  commandResult
) {
  const outcomeInterpreter = await getServiceFromContext(
    state,
    activeTurnCtx,
    'getCommandOutcomeInterpreter',
    'ICommandOutcomeInterpreter',
    actorId
  );

  const directiveType = await outcomeInterpreter.interpret(
    commandResult,
    activeTurnCtx
  );
  activeTurnCtx
    .getLogger()
    .debug(
      `${state.getStateName()}: Actor ${actorId} - Dispatch result interpreted to directive: ${directiveType}`
    );

  return { directiveType };
}

/**
 * Executes the strategy associated with the provided directive.
 *
 * @param {ProcessingCommandStateLike} state - Owning state instance.
 * @param {ITurnContext} activeTurnCtx - Active turn context after dispatch.
 * @param {string} directiveType - Directive to execute.
 * @param {object} result - Command result passed to the strategy.
 * @returns {Promise<void>} Resolves when the strategy completes.
 */
export async function executeDirectiveStrategy(
  state,
  activeTurnCtx,
  directiveType,
  result
) {
  const logger = activeTurnCtx.getLogger();
  const actorId = activeTurnCtx.getActor()?.id ?? 'UnknownActor';

  const directiveStrategy =
    state._directiveResolver.resolveStrategy(directiveType);
  if (!directiveStrategy) {
    const errorMsg = `${state.getStateName()}: Could not resolve ITurnDirectiveStrategy for directive '${directiveType}' (actor ${actorId}).`;
    logger.error(errorMsg);
    const exceptionHandler = new ProcessingExceptionHandler(state);
    await exceptionHandler.handle(activeTurnCtx, new Error(errorMsg), actorId);
    return;
  }

  logger.debug(
    `${state.getStateName()}: Actor ${actorId} - Resolved strategy ${directiveStrategy.constructor.name} for directive ${directiveType}.`
  );

  await directiveStrategy.execute(activeTurnCtx, directiveType, result);
  logger.debug(
    `${state.getStateName()}: Actor ${actorId} - Directive strategy ${directiveStrategy.constructor.name} executed.`
  );

  if (state._isProcessing && state._handler.getCurrentState() === state) {
    logger.debug(
      `${state.getStateName()}: Directive strategy executed for ${actorId}, state remains ${state.getStateName()}. Processing complete for this state instance.`
    );
    finishProcessing(state);
  } else if (state._isProcessing) {
    logger.debug(
      `${state.getStateName()}: Directive strategy executed for ${actorId}, but state changed from ${state.getStateName()} to ${state._handler.getCurrentState()?.getStateName() ?? 'Unknown'}. Processing considered complete for previous state instance.`
    );
    finishProcessing(state);
  }
}

/**
 * Executes the main command processing workflow.
 *
 * @param {ProcessingCommandStateLike} state - Owning state instance.
 * @param {ITurnContext} turnCtx - Current turn context.
 * @param {Entity} actor - Actor executing the command.
 * @param {ITurnAction} turnAction - Action to process.
 * @returns {Promise<void>} Resolves when processing completes.
 */
export async function processCommandInternal(
  state,
  turnCtx,
  actor,
  turnAction
) {
  const actorId = actor.id;

  try {
    const dispatchResult = await dispatchAction(
      state,
      turnCtx,
      actor,
      turnAction
    );
    if (!dispatchResult) {
      return;
    }

    const { activeTurnCtx, commandResult } = dispatchResult;

    const interpretation = await interpretCommandResult(
      state,
      activeTurnCtx,
      actorId,
      commandResult
    );
    if (!interpretation) {
      return;
    }

    const { directiveType } = interpretation;

    await executeDirectiveStrategy(
      state,
      activeTurnCtx,
      directiveType,
      commandResult
    );
  } catch (error) {
    const ctxForError = state._getTurnContext() ?? turnCtx;
    const actorIdForHandler = ctxForError?.getActor?.()?.id ?? actorId;
    const processingError =
      error instanceof Error
        ? error
        : new Error(String(error.message || error));
    if (!(error instanceof Error) && error.stack) {
      processingError.stack = error.stack;
    }
    if (error instanceof ServiceLookupError) {
      await handleProcessingException(
        state,
        ctxForError || turnCtx,
        processingError,
        actorIdForHandler
      );
    } else {
      const exceptionHandler = new ProcessingExceptionHandler(state);
      await exceptionHandler.handle(
        ctxForError || turnCtx,
        processingError,
        actorIdForHandler
      );
    }
  } finally {
    if (state._isProcessing && state._handler.getCurrentState() === state) {
      const finalLogger =
        state._getTurnContext()?.getLogger() ?? turnCtx.getLogger();
      finalLogger.warn(
        `${state.getStateName()}: _isProcessing was unexpectedly true at the end of _processCommandInternal for ${actorId}. Forcing to false.`
      );
      finishProcessing(state);
    }
  }
}

export default processCommandInternal;
