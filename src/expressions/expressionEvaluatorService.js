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
        requiredMethods: ['evaluate', 'evaluateWithTrace'],
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
   * Evaluate all expressions and return matches with diagnostic details.
   *
   * @param {object} context - Expression evaluation context.
   * @returns {{matches: object[], evaluations: Array<{expression: object, passed: boolean, prerequisites: Array<{index: number, status: string, message: string}>>}}}
   */
  evaluateAllWithDiagnostics(context) {
    const expressions = this.#expressionRegistry.getExpressionsByPriority();
    const evaluations = expressions.map((expression) =>
      this.#evaluateExpressionWithDiagnostics(expression, context)
    );
    const matches = evaluations
      .filter((evaluation) => evaluation.passed)
      .map((evaluation) => evaluation.expression);
    return { matches, evaluations };
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
        const resolvedLogic = this.#resolvePrerequisiteLogic(prerequisite.logic);
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
   * Evaluate a single expression with diagnostics.
   *
   * @private
   * @param {object} expression
   * @param {object} context
   * @returns {{expression: object, passed: boolean, prerequisites: Array<{index: number, status: string, message: string}>}}
   */
  #evaluateExpressionWithDiagnostics(expression, context) {
    const prerequisites = Array.isArray(expression?.prerequisites)
      ? expression.prerequisites
      : [];
    const results = [];
    let passed = true;

    for (let index = 0; index < prerequisites.length; index += 1) {
      const prerequisite = prerequisites[index];
      if (!prerequisite?.logic) {
        results.push({
          index,
          status: 'skipped',
          message: 'Missing logic; prerequisite skipped.',
        });
        continue;
      }

      let resolvedLogic;
      try {
        resolvedLogic = this.#resolvePrerequisiteLogic(prerequisite.logic);
      } catch (error) {
        results.push({
          index,
          status: 'failed',
          message: `Condition reference resolution failed: ${error.message}`,
        });
        passed = false;
        break;
      }

      let rawResult = false;
      let traceFailure = null;
      try {
        const traced =
          this.#jsonLogicEvaluationService.evaluateWithTrace(
            resolvedLogic,
            context
          );
        rawResult = traced?.resultBoolean ?? false;
        traceFailure = traced?.failure ?? null;
      } catch (error) {
        results.push({
          index,
          status: 'failed',
          message: `Evaluation error: ${error.message}`,
        });
        passed = false;
        break;
      }

      if (rawResult) {
        results.push({
          index,
          status: 'passed',
          message: 'Passed.',
        });
        continue;
      }

      const missingPaths = this.#findMissingVarPaths(resolvedLogic, context);
      const traceSummary = traceFailure
        ? this.#formatTraceFailure(traceFailure)
        : null;
      const missingSummary =
        missingPaths.length > 0
          ? `Missing context data: ${missingPaths.join(', ')}.`
          : traceSummary ?? `Evaluated to false (result: ${JSON.stringify(rawResult)}).`;

      results.push({
        index,
        status: 'failed',
        message: missingSummary,
      });
      passed = false;
      break;
    }

    return { expression, passed, prerequisites: results };
  }

  /**
   * Resolve a prerequisite's JSON Logic, including condition_ref lookups.
   *
   * @private
   * @param {object} logic
   * @returns {object}
   */
  #resolvePrerequisiteLogic(logic) {
    return resolveConditionRefs(logic, this.#gameDataRepository, this.#logger);
  }

  /**
   * Find missing var paths in JSON Logic relative to the provided context.
   *
   * @private
   * @param {object} logic
   * @param {object} context
   * @returns {string[]}
   */
  #findMissingVarPaths(logic, context) {
    const varRefs = this.#collectVarPaths(logic);
    const missing = [];

    for (const ref of varRefs) {
      if (ref.hasDefault) {
        continue;
      }
      if (!ref.path) {
        continue;
      }
      if (ref.path.includes('[') || ref.path.includes(']')) {
        missing.push(ref.path);
        continue;
      }
      if (!this.#hasPath(context, ref.path)) {
        missing.push(ref.path);
      }
    }

    return Array.from(new Set(missing));
  }

  /**
   * Collect var paths from a JSON Logic tree.
   *
   * @private
   * @param {object|Array|any} logic
   * @returns {Array<{path: string|null, hasDefault: boolean}>}
   */
  #collectVarPaths(logic) {
    const results = [];
    const visited = new Set();

    const walk = (node) => {
      if (!node || typeof node !== 'object') {
        return;
      }
      if (visited.has(node)) {
        return;
      }
      visited.add(node);

      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }

      if (Object.prototype.hasOwnProperty.call(node, 'var')) {
        const value = node.var;
        const isArray = Array.isArray(value);
        const path = isArray ? value[0] : value;
        const hasDefault = isArray && value.length > 1;
        results.push({
          path: typeof path === 'string' ? path : null,
          hasDefault,
        });
      }

      Object.values(node).forEach(walk);
    };

    walk(logic);
    return results;
  }

  /**
   * Check whether a dotted path exists in an object.
   *
   * @private
   * @param {object} context
   * @param {string} path
   * @returns {boolean}
   */
  #hasPath(context, path) {
    if (!context || typeof context !== 'object') {
      return false;
    }
    if (path === '') {
      return true;
    }

    const segments = path.split('.');
    let current = context;
    for (const segment of segments) {
      if (current === null || current === undefined) {
        return false;
      }
      const key =
        Array.isArray(current) && /^[0-9]+$/.test(segment)
          ? Number(segment)
          : segment;
      if (!Object.prototype.hasOwnProperty.call(current, key)) {
        return false;
      }
      current = current[key];
    }
    return true;
  }

  /**
   * Format a trace failure into a readable message.
   *
   * @private
   * @param {object} failure
   * @returns {string}
   */
  #formatTraceFailure(failure) {
    if (!failure || typeof failure !== 'object') {
      return '';
    }

    const ruleSummary = failure.ruleSummary
      ? ` at ${failure.ruleSummary}`
      : '';
    const reason = failure.reason ? `: ${failure.reason}` : '';

    if (Array.isArray(failure.evaluatedArgs) && failure.evaluatedArgs.length) {
      return `Failed${ruleSummary} (${failure.op}) with values ${JSON.stringify(
        failure.evaluatedArgs
      )}${reason}.`;
    }

    return `Failed${ruleSummary} (${failure.op})${reason}.`;
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
