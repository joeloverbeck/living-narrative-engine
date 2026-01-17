/**
 * @file Expression Evaluator Service - Evaluates expression prerequisites.
 */

import { validateDependency } from '../utils/dependencyUtils.js';
import { resolveConditionRefs } from '../utils/conditionRefResolver.js';
import ExpressionPrerequisiteError from './ExpressionPrerequisiteError.js';

const PREREQ_ERROR_PREFIX = 'EXPR_PREREQ_ERROR';
const PREREQ_ERROR_CODES = {
  invalidLogic: 'EXPR_PREREQ_INVALID_LOGIC',
  missingVar: 'EXPR_PREREQ_MISSING_VAR',
  evaluationError: 'EXPR_PREREQ_EVALUATION_ERROR',
};

/**
 * Evaluates expression prerequisites and returns matching expressions.
 */
class ExpressionEvaluatorService {
  #expressionRegistry;
  #jsonLogicEvaluationService;
  #gameDataRepository;
  #logger;
  #strictMode;

  /**
   * @param {object} deps
   * @param {object} deps.expressionRegistry
   * @param {object} deps.jsonLogicEvaluationService
   * @param {object} deps.gameDataRepository
   * @param {object} deps.logger
   * @param {boolean} [deps.strictMode=false]
   */
  constructor({
    expressionRegistry,
    jsonLogicEvaluationService,
    gameDataRepository,
    logger,
    strictMode = false,
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
    this.#strictMode = Boolean(strictMode);
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

    for (let index = 0; index < prerequisites.length; index += 1) {
      const prerequisite = prerequisites[index];
      const prerequisiteIndex = index + 1;
      if (!prerequisite?.logic) {
        if (this.#strictMode) {
          const error = new Error('Missing prerequisite logic');
          const prerequisiteError = this.#logPrerequisiteError({
            category: 'invalid-logic',
            code: PREREQ_ERROR_CODES.invalidLogic,
            error,
            expression,
            prerequisiteIndex,
            logic: null,
            resolvedLogic: null,
            context,
          });
          throw prerequisiteError;
        }
        this.#logger.warn(
          `Expression ${expression?.id ?? 'unknown'} has prerequisite without logic, skipping`
        );
        continue;
      }

      try {
        const resolvedLogic = this.#resolvePrerequisiteLogic(prerequisite.logic);
        let result;
        try {
          result = this.#jsonLogicEvaluationService.evaluate(
            resolvedLogic,
            context
          );
        } catch (error) {
          const prerequisiteError = this.#logPrerequisiteError({
            category: 'evaluation-error',
            code: PREREQ_ERROR_CODES.evaluationError,
            error,
            expression,
            prerequisiteIndex,
            logic: prerequisite.logic,
            resolvedLogic,
            context,
          });
          if (this.#strictMode) {
            throw prerequisiteError;
          }
          return false;
        }

        if (!result) {
          const missingPaths = this.#findMissingVarPaths(resolvedLogic, context);
          let traceResult;
          try {
            traceResult = this.#jsonLogicEvaluationService.evaluateWithTrace(
              resolvedLogic,
              context
            );
          } catch (error) {
            const prerequisiteError = this.#logPrerequisiteError({
              category: 'evaluation-error',
              code: PREREQ_ERROR_CODES.evaluationError,
              error,
              expression,
              prerequisiteIndex,
              logic: prerequisite.logic,
              resolvedLogic,
              context,
            });
            if (this.#strictMode) {
              throw prerequisiteError;
            }
            return false;
          }
          const failure = traceResult?.failure;
          const isValidationFailure = failure?.op === 'validation';
          const isEvaluationError =
            typeof failure?.reason === 'string' &&
            failure.reason.startsWith('Evaluation error');
          if (missingPaths.length > 0 || isValidationFailure || isEvaluationError) {
            const category = missingPaths.length
              ? 'missing-var'
              : isValidationFailure
                ? 'invalid-logic'
                : 'evaluation-error';
            const code = missingPaths.length
              ? PREREQ_ERROR_CODES.missingVar
              : isValidationFailure
                ? PREREQ_ERROR_CODES.invalidLogic
                : PREREQ_ERROR_CODES.evaluationError;
            const prerequisiteError = this.#logPrerequisiteError({
              category,
              code,
              error: failure,
              expression,
              prerequisiteIndex,
              logic: prerequisite.logic,
              resolvedLogic,
              context,
            });
            if (this.#strictMode) {
              throw prerequisiteError;
            }
          }
          this.#logger.debug(
            `Expression ${expression?.id ?? 'unknown'} prerequisite failed`,
            { logic: prerequisite.logic }
          );
          return false;
        }
      } catch (err) {
        const prerequisiteError = this.#logPrerequisiteError({
          category: 'invalid-logic',
          code: PREREQ_ERROR_CODES.invalidLogic,
          error: err,
          expression,
          prerequisiteIndex,
          logic: prerequisite.logic,
          resolvedLogic: null,
          context,
        });
        if (this.#strictMode) {
          throw prerequisiteError;
        }
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
        if (this.#strictMode) {
          results.push({
            index,
            status: 'failed',
            message: 'Missing logic; strict mode enabled.',
          });
          passed = false;
          break;
        } else {
          results.push({
            index,
            status: 'skipped',
            message: 'Missing logic; prerequisite skipped.',
          });
          continue;
        }
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
   * Get resolved values for referenced var paths.
   *
   * @private
   * @param {object} logic
   * @param {object} context
   * @returns {Array<{path: string, value: any, missing: boolean, hasDefault: boolean}>}
   */
  #getReferencedVarValues(logic, context) {
    const refs = this.#collectVarPaths(logic);
    const seen = new Set();
    const values = [];

    for (const ref of refs) {
      if (!ref.path) {
        continue;
      }
      const key = `${ref.path}:${ref.hasDefault ? 'default' : 'nodefault'}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      const missing =
        ref.path.includes('[') ||
        ref.path.includes(']') ||
        !this.#hasPath(context, ref.path);
      const rawValue = missing ? undefined : this.#getValueAtPath(context, ref.path);
      values.push({
        path: ref.path,
        value: this.#summarizeValue(rawValue),
        missing,
        hasDefault: ref.hasDefault,
      });
    }

    return values;
  }

  /**
   * Read a dotted path value from an object.
   *
   * @private
   * @param {object} context
   * @param {string} path
   * @returns {any}
   */
  #getValueAtPath(context, path) {
    if (!context || typeof context !== 'object') {
      return undefined;
    }
    if (path === '') {
      return context;
    }

    const segments = path.split('.');
    let current = context;
    for (const segment of segments) {
      if (current === null || current === undefined) {
        return undefined;
      }
      const key =
        Array.isArray(current) && /^[0-9]+$/.test(segment)
          ? Number(segment)
          : segment;
      current = current[key];
    }
    return current;
  }

  /**
   * Summarize a value for logging without leaking full context.
   *
   * @private
   * @param {any} value
   * @returns {any}
   */
  #summarizeValue(value) {
    if (value === null || value === undefined) {
      return value;
    }
    const valueType = typeof value;
    if (valueType === 'string') {
      return value.length > 120 ? `${value.slice(0, 120)}...` : value;
    }
    if (valueType === 'number' || valueType === 'boolean') {
      return value;
    }
    if (Array.isArray(value)) {
      return { type: 'array', length: value.length };
    }
    if (valueType === 'object') {
      const keys = Object.keys(value);
      return {
        type: 'object',
        keyCount: keys.length,
        keys: keys.slice(0, 5),
      };
    }
    return valueType;
  }

  /**
   * Summarize logic into a compact single-line string.
   *
   * @private
   * @param {any} logic
   * @returns {string}
   */
  #summarizeLogic(logic) {
    if (logic === undefined) {
      return 'undefined';
    }
    if (logic === null) {
      return 'null';
    }
    if (typeof logic === 'string') {
      return logic.length > 180 ? `${logic.slice(0, 180)}...` : logic;
    }
    try {
      const serialized = JSON.stringify(logic);
      if (serialized === undefined) {
        return '[unserializable]';
      }
      return serialized.length > 180
        ? `${serialized.slice(0, 180)}...`
        : serialized;
    } catch {
      return '[unserializable]';
    }
  }

  /**
   * Log a structured prerequisite error.
   *
   * @private
   * @param {object} details
   */
  #logPrerequisiteError({
    category,
    code,
    error,
    expression,
    prerequisiteIndex,
    logic,
    resolvedLogic,
    context,
  }) {
    const expressionId = expression?.id ?? 'unknown';
    const modId =
      typeof expression?.modId === 'string'
        ? expression.modId
        : typeof expression?.mod?.id === 'string'
          ? expression.mod.id
          : typeof expression?.mod === 'string'
            ? expression.mod
            : undefined;
    const logicSummary = this.#summarizeLogic(logic);
    const resolvedLogicSummary = resolvedLogic
      ? this.#summarizeLogic(resolvedLogic)
      : undefined;
    const vars = this.#getReferencedVarValues(
      resolvedLogic ?? logic ?? {},
      context
    );
    const errorMessage =
      error && typeof error.message === 'string'
        ? error.message
        : error && typeof error.reason === 'string'
          ? error.reason
          : '';
    const message = `${PREREQ_ERROR_PREFIX} ${code}: Expression ${expressionId} prerequisite ${prerequisiteIndex} ${category}${errorMessage ? ` (${errorMessage})` : ''}`;

    const prerequisiteError = new ExpressionPrerequisiteError({
      message,
      code,
      category,
      expressionId,
      modId,
      prerequisiteIndex,
      logicSummary,
      resolvedLogicSummary,
      vars,
    });

    this.#logger.error(
      `${PREREQ_ERROR_PREFIX} ${prerequisiteError.code}`,
      prerequisiteError.toJSON()
    );

    return prerequisiteError;
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
      try {
        if (this.#evaluatePrerequisites(expression, context)) {
          matchingExpressions.push(expression);
        }
      } catch (error) {
        if (error instanceof ExpressionPrerequisiteError) {
          continue;
        }
        throw error;
      }
    }

    return matchingExpressions;
  }
}

export default ExpressionEvaluatorService;
