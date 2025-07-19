/**
 * @file commandDispatcher.js
 * @description Service responsible for dispatching commands through the command processor.
 * Extracted from CommandProcessingWorkflow to improve separation of concerns.
 */

import { BaseService } from '../../../../utils/serviceBase.js';
import { ServiceLookupError } from '../getServiceFromContext.js';

/**
 * @typedef {import('../../../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 * @typedef {import('../../../../entities/entity.js').default} Entity
 * @typedef {import('../../../interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction
 * @typedef {import('../../../../commands/interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor
 * @typedef {import('../../../../types/commandResult.js').CommandResult} CommandResult
 * @typedef {import('../../../../interfaces/ILogger.js').ILogger} ILogger
 * @typedef {import('../../../../actions/errors/unifiedErrorHandler.js').UnifiedErrorHandler} UnifiedErrorHandler
 */

/**
 * @class CommandDispatcher
 * @augments BaseService
 * @description Handles the dispatch of actions through the command processor.
 * Provides error handling and validation of the dispatch process.
 */
export class CommandDispatcher extends BaseService {
  #logger;
  #commandProcessor;
  #unifiedErrorHandler;

  /**
   * Creates an instance of CommandDispatcher.
   *
   * @param {object} dependencies
   * @param {ICommandProcessor} dependencies.commandProcessor - Command processor for dispatching actions
   * @param {UnifiedErrorHandler} dependencies.unifiedErrorHandler - Unified error handler
   * @param {ILogger} dependencies.logger - Logger instance
   */
  constructor({ commandProcessor, unifiedErrorHandler, logger }) {
    super();

    this.#logger = this._init('CommandDispatcher', logger, {
      commandProcessor: {
        value: commandProcessor,
        requiredMethods: ['dispatchAction'],
      },
      unifiedErrorHandler: {
        value: unifiedErrorHandler,
        requiredMethods: ['handleProcessingError', 'logError'],
      },
    });

    this.#commandProcessor = commandProcessor;
    this.#unifiedErrorHandler = unifiedErrorHandler;
  }

  /**
   * Dispatches an action through the command processor.
   *
   * @param {object} params
   * @param {ITurnContext} params.turnContext - Current turn context
   * @param {Entity} params.actor - Actor executing the command
   * @param {ITurnAction} params.turnAction - Action to process
   * @param {string} params.stateName - Name of the current state (for logging)
   * @returns {Promise<{commandResult: CommandResult, turnContext: ITurnContext}|null>}
   *   The command result and active context, or null on error
   */
  async dispatch({ turnContext, actor, turnAction, stateName }) {
    const actorId = actor.id;

    if (!this.#commandProcessor) {
      const error = new ServiceLookupError(
        'ICommandProcessor could not be resolved from the constructor.'
      );
      this.#unifiedErrorHandler.handleProcessingError(error, {
        actorId,
        stage: 'dispatch',
        additionalContext: { stateName },
      });
      return null;
    }

    this.#logger.debug(
      `${stateName}: Invoking commandProcessor.dispatchAction() for actor ${actorId}, actionId: ${turnAction.actionDefinitionId}.`
    );

    try {
      // Dispatch the action
      const commandResult = await this.#commandProcessor.dispatchAction(
        actor,
        turnAction
      );

      this.#logger.debug(
        `${stateName}: Action dispatch completed for actor ${actorId}. Result success: ${commandResult.success}.`
      );

      return { commandResult, turnContext };
    } catch (error) {
      // Handle dispatch errors
      this.#unifiedErrorHandler.handleProcessingError(error, {
        actorId,
        stage: 'dispatch',
        actionDef: {
          id: turnAction.actionDefinitionId,
          name: turnAction.commandString,
        },
        additionalContext: {
          stateName,
          commandString: turnAction.commandString,
        },
      });
      return null;
    }
  }

  /**
   * Validates the turn context after dispatch to ensure it's still valid.
   *
   * @param {object} params
   * @param {ITurnContext} params.turnContext - Turn context to validate
   * @param {string} params.expectedActorId - Expected actor ID
   * @param {string} params.stateName - Name of the current state (for logging)
   * @returns {boolean} True if context is valid, false otherwise
   */
  validateContextAfterDispatch({ turnContext, expectedActorId, stateName }) {
    if (!turnContext || typeof turnContext.getActor !== 'function') {
      this.#logger.warn(
        `${stateName}: Turn context is invalid after dispatch for actor ${expectedActorId}.`
      );
      return false;
    }

    const currentActorId = turnContext.getActor()?.id;
    if (currentActorId !== expectedActorId) {
      this.#logger.warn(
        `${stateName}: Context actor changed after dispatch. Expected: ${expectedActorId}, Current: ${currentActorId ?? 'N/A'}.`
      );
      return false;
    }

    return true;
  }
}

export default CommandDispatcher;
