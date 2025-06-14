/**
 * @file Utility for ProcessingCommandState that handles command processing logic.
 */

/**
 * @typedef {import('../processingCommandState.js').ProcessingCommandState} ProcessingCommandState
 * @typedef {import('../../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 * @typedef {import('../../../entities/entity.js').default} Entity
 * @typedef {import('../../interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction
 */

import TurnDirectiveStrategyResolver from '../../strategies/turnDirectiveStrategyResolver.js';
import { getServiceFromContext } from './getServiceFromContext.js';
import { handleProcessingException } from './handleProcessingException.js';

/**
 * Executes the main command processing workflow.
 *
 * @param {ProcessingCommandState} state - Owning state instance.
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
  const logger = turnCtx.getLogger();
  const actorId = actor.id;

  try {
    const commandProcessor = await getServiceFromContext(
      state,
      turnCtx,
      'getCommandProcessor',
      'ICommandProcessor',
      actorId
    );
    if (!commandProcessor) {
      return; // Error handled by getServiceFromContext
    }

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
      return;
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
      await handleProcessingException(
        state,
        contextForException,
        new Error('Context invalid/changed after action dispatch.'),
        actorId,
        false
      );
      return;
    }

    const commandResultForInterpreter = {
      success: success,
      turnEnded: !success,
      originalInput: turnAction.commandString || turnAction.actionDefinitionId,
      actionResult: { actionId: turnAction.actionDefinitionId },
      error: success ? undefined : errorResult?.error,
      internalError: success ? undefined : errorResult?.internalError,
    };

    logger.debug(
      `${state.getStateName()}: Action dispatch completed for actor ${actorId}. Result success: ${commandResultForInterpreter.success}.`
    );

    const outcomeInterpreter = await getServiceFromContext(
      state,
      activeTurnCtx,
      'getCommandOutcomeInterpreter',
      'ICommandOutcomeInterpreter',
      actorId
    );
    if (!outcomeInterpreter) {
      return; // Error handled by getServiceFromContext
    }

    const directiveType = await outcomeInterpreter.interpret(
      commandResultForInterpreter,
      activeTurnCtx
    );
    logger.debug(
      `${state.getStateName()}: Actor ${actorId} - Dispatch result interpreted to directive: ${directiveType}`
    );

    const directiveStrategy =
      TurnDirectiveStrategyResolver.resolveStrategy(directiveType);
    if (!directiveStrategy) {
      const errorMsg = `${state.getStateName()}: Could not resolve ITurnDirectiveStrategy for directive '${directiveType}' (actor ${actorId}).`;
      logger.error(errorMsg);
      await handleProcessingException(
        state,
        activeTurnCtx,
        new Error(errorMsg),
        actorId
      );
      return;
    }
    logger.debug(
      `${state.getStateName()}: Actor ${actorId} - Resolved strategy ${directiveStrategy.constructor.name} for directive ${directiveType}.`
    );

    await directiveStrategy.execute(
      activeTurnCtx,
      directiveType,
      commandResultForInterpreter
    );
    logger.debug(
      `${state.getStateName()}: Actor ${actorId} - Directive strategy ${directiveStrategy.constructor.name} executed.`
    );

    if (state._isProcessing && state._handler._currentState === state) {
      logger.debug(
        `${state.getStateName()}: Directive strategy executed for ${actorId}, state remains ${state.getStateName()}. Processing complete for this state instance.`
      );
      state._isProcessing = false;
    } else if (state._isProcessing) {
      logger.debug(
        `${state.getStateName()}: Directive strategy executed for ${actorId}, but state changed from ${state.getStateName()} to ${state._handler._currentState?.getStateName() ?? 'Unknown'}. Processing considered complete for previous state instance.`
      );
      state._isProcessing = false;
    }
  } catch (error) {
    const errorHandlingCtx = state._getTurnContext() ?? turnCtx;
    const actorIdForHandler = errorHandlingCtx?.getActor?.()?.id ?? actorId;
    const processingError =
      error instanceof Error
        ? error
        : new Error(String(error.message || error));
    if (!(error instanceof Error) && error.stack) {
      processingError.stack = error.stack;
    }
    await handleProcessingException(
      state,
      errorHandlingCtx || turnCtx,
      processingError,
      actorIdForHandler
    );
  } finally {
    if (state._isProcessing && state._handler._currentState === state) {
      const finalLogger =
        state._getTurnContext()?.getLogger() ?? turnCtx.getLogger();
      finalLogger.warn(
        `${state.getStateName()}: _isProcessing was unexpectedly true at the end of _processCommandInternal for ${actorId}. Forcing to false.`
      );
      state._isProcessing = false;
    }
  }
}

export default processCommandInternal;
