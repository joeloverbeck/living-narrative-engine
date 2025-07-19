/**
 * @file resultInterpreter.js
 * @description Service responsible for interpreting command results into directives.
 * Extracted from CommandProcessingWorkflow to improve separation of concerns.
 */

import { BaseService } from '../../../../utils/serviceBase.js';

/**
 * @typedef {import('../../../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 * @typedef {import('../../../../commands/interfaces/ICommandOutcomeInterpreter.js').ICommandOutcomeInterpreter} ICommandOutcomeInterpreter
 * @typedef {import('../../../../types/commandResult.js').CommandResult} CommandResult
 * @typedef {import('../../../../interfaces/ILogger.js').ILogger} ILogger
 * @typedef {import('../../../../actions/errors/unifiedErrorHandler.js').UnifiedErrorHandler} UnifiedErrorHandler
 */

/**
 * @class ResultInterpreter
 * @augments BaseService
 * @description Handles the interpretation of command results into turn directives.
 * Provides error handling and logging for the interpretation process.
 */
export class ResultInterpreter extends BaseService {
  #logger;
  #commandOutcomeInterpreter;
  #unifiedErrorHandler;

  /**
   * Creates an instance of ResultInterpreter.
   *
   * @param {object} dependencies
   * @param {ICommandOutcomeInterpreter} dependencies.commandOutcomeInterpreter - Interpreter for command outcomes
   * @param {UnifiedErrorHandler} dependencies.unifiedErrorHandler - Unified error handler
   * @param {ILogger} dependencies.logger - Logger instance
   */
  constructor({ commandOutcomeInterpreter, unifiedErrorHandler, logger }) {
    super();

    this.#logger = this._init('ResultInterpreter', logger, {
      commandOutcomeInterpreter: {
        value: commandOutcomeInterpreter,
        requiredMethods: ['interpret'],
      },
      unifiedErrorHandler: {
        value: unifiedErrorHandler,
        requiredMethods: ['handleProcessingError', 'logError'],
      },
    });

    this.#commandOutcomeInterpreter = commandOutcomeInterpreter;
    this.#unifiedErrorHandler = unifiedErrorHandler;
  }

  /**
   * Interprets a command result into a directive.
   *
   * @param {object} params
   * @param {CommandResult} params.commandResult - Result from command dispatch
   * @param {ITurnContext} params.turnContext - Active turn context
   * @param {string} params.actorId - Actor ID for logging
   * @param {string} params.stateName - Name of the current state (for logging)
   * @returns {Promise<{directiveType: string}|null>} The directive type or null on error
   */
  async interpret({ commandResult, turnContext, actorId, stateName }) {
    try {
      // Interpret the command result
      const directiveType = await this.#commandOutcomeInterpreter.interpret(
        commandResult,
        turnContext
      );

      this.#logger.debug(
        `${stateName}: Actor ${actorId} - Dispatch result interpreted to directive: ${directiveType}`
      );

      // Validate the directive type
      if (!directiveType || typeof directiveType !== 'string') {
        throw new Error(`Invalid directive type returned: ${directiveType}`);
      }

      return { directiveType };
    } catch (error) {
      // Handle interpretation errors
      this.#unifiedErrorHandler.handleProcessingError(error, {
        actorId,
        stage: 'interpretation',
        additionalContext: {
          stateName,
          commandSuccess: commandResult.success,
          commandError: commandResult.error,
        },
      });
      return null;
    }
  }

  /**
   * Validates that a command result is suitable for interpretation.
   *
   * @param {CommandResult} commandResult - Result to validate
   * @returns {boolean} True if result is valid for interpretation
   */
  validateCommandResult(commandResult) {
    if (!commandResult || typeof commandResult !== 'object') {
      this.#logger.error('Invalid command result: not an object', {
        commandResult,
      });
      return false;
    }

    if (typeof commandResult.success !== 'boolean') {
      this.#logger.error('Invalid command result: missing success property', {
        commandResult,
      });
      return false;
    }

    return true;
  }
}

export default ResultInterpreter;
