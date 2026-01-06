/**
 * @file Expression Evaluator Service - Evaluates expression prerequisites.
 */

import { validateDependency } from '../utils/dependencyUtils.js';
import { resolveConditionRefs } from '../utils/conditionRefResolver.js';

/**
 * Evaluates expression prerequisites and returns matching expressions.
 */
class ExpressionEvaluatorService {
  #expressionRegistry;
  #jsonLogicEvaluationService;
  #gameDataRepository;
  #logger;

  /**
   * @param {object} deps
   * @param {object} deps.expressionRegistry
   * @param {object} deps.jsonLogicEvaluationService
   * @param {object} deps.gameDataRepository
   * @param {object} deps.logger
   */
  constructor({
    expressionRegistry,
    jsonLogicEvaluationService,
    gameDataRepository,
    logger,
  }) {
    validateDependency(expressionRegistry, 'ExpressionRegistry', logger, {
      requiredMethods: ['getExpressionsByPriority'],
    });
    validateDependency(
      jsonLogicEvaluationService,
      'IJsonLogicEvaluationService',
      logger,
      {
        requiredMethods: ['evaluate'],
      }
    );
    validateDependency(gameDataRepository, 'IGameDataRepository', logger, {
      requiredMethods: ['getConditionDefinition'],
    });
    validateDependency(logger, 'logger');

    this.#expressionRegistry = expressionRegistry;
    this.#jsonLogicEvaluationService = jsonLogicEvaluationService;
    this.#gameDataRepository = gameDataRepository;
    this.#logger = logger;
  }

  /**
   * Evaluate all expressions and return the highest priority match.
   *
   * @param {object} context - Expression evaluation context.
   * @returns {object|null} Highest priority matching expression or null.
   */
  evaluate(context) {
    const expressions = this.#expressionRegistry.getExpressionsByPriority();
    this.#logger.info(
      `Expression evaluation: considering ${expressions.length} expressions`
    );

    const matchingExpressions = this.#evaluateExpressions(expressions, context);

    if (matchingExpressions.length > 0) {
      const matchIds = matchingExpressions.map(
        (expression) => expression?.id ?? 'unknown'
      );
      this.#logger.info(
        `Expression evaluation: matched ${matchingExpressions.length} expressions [${matchIds.join(', ')}]`
      );

      const selectedExpression = matchingExpressions[0];
      this.#logger.info(
        `Expression evaluation: selected expression ${selectedExpression?.id ?? 'unknown'}`
      );
      return selectedExpression;
    }

    this.#logger.info('Expression evaluation: no match');
    return null;
  }

  /**
   * Evaluate all expressions and return all matches.
   *
   * @param {object} context - Expression evaluation context.
   * @returns {object[]} All matching expressions sorted by priority.
   */
  evaluateAll(context) {
    const expressions = this.#expressionRegistry.getExpressionsByPriority();
    return this.#evaluateExpressions(expressions, context);
  }

  /**
   * Evaluate a single expression's prerequisites.
   *
   * @private
   * @param {object} expression
   * @param {object} context
   * @returns {boolean}
   */
  #evaluatePrerequisites(expression, context) {
    const prerequisites = Array.isArray(expression?.prerequisites)
      ? expression.prerequisites
      : [];

    for (const prerequisite of prerequisites) {
      if (!prerequisite?.logic) {
        this.#logger.warn(
          `Expression ${expression?.id ?? 'unknown'} has prerequisite without logic, skipping`
        );
        continue;
      }

      try {
        const resolvedLogic = resolveConditionRefs(
          prerequisite.logic,
          this.#gameDataRepository,
          this.#logger
        );
        const result = this.#jsonLogicEvaluationService.evaluate(
          resolvedLogic,
          context
        );

        if (!result) {
          this.#logger.debug(
            `Expression ${expression?.id ?? 'unknown'} prerequisite failed`,
            { logic: prerequisite.logic }
          );
          return false;
        }
      } catch (err) {
        this.#logger.error(
          `Error evaluating expression ${expression?.id ?? 'unknown'} prerequisite`,
          err
        );
        return false;
      }
    }

    return true;
  }

  /**
   * Evaluate all expressions and return matches in the provided order.
   *
   * @private
   * @param {object[]} expressions
   * @param {object} context
   * @returns {object[]}
   */
  #evaluateExpressions(expressions, context) {
    const matchingExpressions = [];

    for (const expression of expressions) {
      if (this.#evaluatePrerequisites(expression, context)) {
        matchingExpressions.push(expression);
      }
    }

    return matchingExpressions;
  }
}

export default ExpressionEvaluatorService;
