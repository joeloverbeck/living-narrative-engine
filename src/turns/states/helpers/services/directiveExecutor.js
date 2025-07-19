/**
 * @file directiveExecutor.js
 * @description Service responsible for executing directive strategies.
 * Extracted from CommandProcessingWorkflow to improve separation of concerns.
 */

import { BaseService } from '../../../../utils/serviceBase.js';

/**
 * @typedef {import('../../../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 * @typedef {import('../../../interfaces/IDirectiveStrategyResolver.js').IDirectiveStrategyResolver} IDirectiveStrategyResolver
 * @typedef {import('../../../interfaces/ITurnDirectiveStrategy.js').ITurnDirectiveStrategy} ITurnDirectiveStrategy
 * @typedef {import('../../../../types/commandResult.js').CommandResult} CommandResult
 * @typedef {import('../../../../interfaces/ILogger.js').ILogger} ILogger
 * @typedef {import('../../../../actions/errors/unifiedErrorHandler.js').UnifiedErrorHandler} UnifiedErrorHandler
 */

/**
 * @class DirectiveExecutor
 * @augments BaseService
 * @description Handles the execution of directive strategies based on interpreted directives.
 * Provides error handling and state management during directive execution.
 */
export class DirectiveExecutor extends BaseService {
  #logger;
  #directiveStrategyResolver;
  #unifiedErrorHandler;

  /**
   * Creates an instance of DirectiveExecutor.
   *
   * @param {object} dependencies
   * @param {IDirectiveStrategyResolver} dependencies.directiveStrategyResolver - Resolver for directive strategies
   * @param {UnifiedErrorHandler} dependencies.unifiedErrorHandler - Unified error handler
   * @param {ILogger} dependencies.logger - Logger instance
   */
  constructor({ directiveStrategyResolver, unifiedErrorHandler, logger }) {
    super();

    this.#logger = this._init('DirectiveExecutor', logger, {
      directiveStrategyResolver: {
        value: directiveStrategyResolver,
        requiredMethods: ['resolveStrategy'],
      },
      unifiedErrorHandler: {
        value: unifiedErrorHandler,
        requiredMethods: ['handleProcessingError', 'logError'],
      },
    });

    this.#directiveStrategyResolver = directiveStrategyResolver;
    this.#unifiedErrorHandler = unifiedErrorHandler;
  }

  /**
   * Executes the strategy associated with the provided directive.
   *
   * @param {object} params
   * @param {ITurnContext} params.turnContext - Active turn context
   * @param {string} params.directiveType - Directive to execute
   * @param {CommandResult} params.commandResult - Command result to pass to the strategy
   * @param {string} params.stateName - Name of the current state (for logging)
   * @returns {Promise<{executed: boolean, stateChanged: boolean}>} Execution result
   */
  async execute({ turnContext, directiveType, commandResult, stateName }) {
    const actorId = turnContext.getActor()?.id ?? 'UnknownActor';

    try {
      // Resolve the strategy for the directive
      const strategy =
        this.#directiveStrategyResolver.resolveStrategy(directiveType);

      if (!strategy) {
        const errorMsg = `Could not resolve ITurnDirectiveStrategy for directive '${directiveType}' (actor ${actorId})`;
        throw new Error(errorMsg);
      }

      this.#logger.debug(
        `${stateName}: Actor ${actorId} - Resolved strategy ${strategy.constructor.name} for directive ${directiveType}.`
      );

      // Execute the strategy
      await strategy.execute(turnContext, directiveType, commandResult);

      this.#logger.debug(
        `${stateName}: Actor ${actorId} - Directive strategy ${strategy.constructor.name} executed.`
      );

      return { executed: true, stateChanged: false };
    } catch (error) {
      // Handle execution errors
      this.#unifiedErrorHandler.handleProcessingError(error, {
        actorId,
        stage: 'directive_execution',
        additionalContext: {
          stateName,
          directiveType,
          commandSuccess: commandResult.success,
        },
      });

      return { executed: false, stateChanged: false };
    }
  }

  /**
   * Validates that a directive type is valid for execution.
   *
   * @param {string} directiveType - Directive type to validate
   * @returns {boolean} True if directive is valid
   */
  validateDirective(directiveType) {
    if (!directiveType || typeof directiveType !== 'string') {
      this.#logger.error('Invalid directive type', { directiveType });
      return false;
    }

    if (directiveType.trim() === '') {
      this.#logger.error('Empty directive type');
      return false;
    }

    return true;
  }

  /**
   * Checks if a strategy exists for the given directive.
   *
   * @param {string} directiveType - Directive to check
   * @returns {boolean} True if strategy exists
   */
  hasStrategy(directiveType) {
    try {
      const strategy =
        this.#directiveStrategyResolver.resolveStrategy(directiveType);
      return !!strategy;
    } catch (error) {
      this.#logger.debug(`No strategy found for directive: ${directiveType}`, {
        error: error.message,
      });
      return false;
    }
  }
}

export default DirectiveExecutor;
