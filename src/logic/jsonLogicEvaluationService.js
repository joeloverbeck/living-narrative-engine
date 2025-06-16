// src/logic/jsonLogicEvaluationService.js
import jsonLogic from 'json-logic-js';
import {
  setupService,
  validateServiceDeps,
} from '../utils/serviceInitializerUtils.js';

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/IGameDataRepository.js').IGameDataRepository} IGameDataRepository */
/** @typedef {import('./defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */

// --- REMOVED: The module-level registration attempt has been removed from here ---

/**
 *
 * @param rule
 * @param logger
 */
function warnOnBracketPaths(rule, logger) {
  if (Array.isArray(rule)) {
    rule.forEach((item) => warnOnBracketPaths(item, logger));
    return;
  }
  if (rule && typeof rule === 'object') {
    if (Object.prototype.hasOwnProperty.call(rule, 'var')) {
      const value = rule.var;
      const path =
        typeof value === 'string'
          ? value
          : Array.isArray(value) && typeof value[0] === 'string'
            ? value[0]
            : null;
      if (path && (path.includes('[') || path.includes(']'))) {
        logger.warn(
          `Invalid var path "${path}" contains unsupported brackets.`
        );
      }
    }
    Object.values(rule).forEach((v) => warnOnBracketPaths(v, logger));
  }
}

/**
 * @class JsonLogicEvaluationService
 * Encapsulates the evaluation of JSON Logic rules, including resolving condition_ref references.
 */
class JsonLogicEvaluationService {
  /** @private @type {ILogger} */
  #logger;
  /** @private @type {IGameDataRepository} */
  #gameDataRepository;

  /**
   * Creates an instance of JsonLogicEvaluationService.
   *
   * @param {object} [dependencies] - The injected services.
   * @param {ILogger} dependencies.logger - Logging service.
   * @param {IGameDataRepository} [dependencies.gameDataRepository] - Repository for accessing condition definitions. Optional for tests.
   * @throws {Error} If required dependencies are missing or invalid.
   */
  constructor({ logger, gameDataRepository } = {}) {
    this.#logger = setupService('JsonLogicEvaluationService', logger);

    if (!gameDataRepository) {
      this.#logger.warn(
        'No gameDataRepository provided; condition_ref resolution disabled.'
      );
      this.#gameDataRepository = { getConditionDefinition: () => null };
    } else {
      validateServiceDeps('JsonLogicEvaluationService', this.#logger, {
        gameDataRepository: {
          value: gameDataRepository,
          requiredMethods: ['getConditionDefinition'],
        },
      });
      this.#gameDataRepository = gameDataRepository;
    }

    // --- ADDED: Register the 'not' operator alias upon instantiation ---
    this.addOperation('not', (a) => !a);

    this.#logger.debug('JsonLogicEvaluationService initialized.');
  }

  /**
   * Recursively resolves all `condition_ref` properties within a rule object
   * into their corresponding logic definitions.
   *
   * @private
   * @param {object | any} rule - The rule or sub-rule to resolve.
   * @returns {object | any} The fully resolved rule.
   */
  #resolveRule(rule) {
    if (!rule || typeof rule !== 'object') {
      return rule;
    }

    if ('condition_ref' in rule) {
      const refId = rule.condition_ref;

      const conditionDef =
        this.#gameDataRepository.getConditionDefinition(refId);

      if (!conditionDef) {
        this.#logger.error(
          `Condition reference "${refId}" not found in data registry.`
        );
        return { '==': [true, false] };
      }

      return this.#resolveRule(conditionDef.logic);
    }

    const resolvedRule = {};
    for (const key in rule) {
      if (Object.prototype.hasOwnProperty.call(rule, key)) {
        const value = rule[key];
        if (Array.isArray(value)) {
          resolvedRule[key] = value.map((item) => this.#resolveRule(item));
        } else {
          resolvedRule[key] = this.#resolveRule(value);
        }
      }
    }
    return resolvedRule;
  }

  /**
   * Evaluates a JSON Logic rule against a given data context using json-logic-js,
   * returning a strict boolean based on the truthiness of the result.
   *
   * @param {object} rule - The JSON Logic rule object to evaluate. Can contain `condition_ref`s.
   * @param {JsonLogicEvaluationContext} context - The data context against which the rule is evaluated.
   * @returns {boolean} - The boolean result. Returns false on error.
   */
  evaluate(rule, context) {
    const resolvedRule = this.#resolveRule(rule);

    if (
      resolvedRule &&
      typeof resolvedRule === 'object' &&
      !Array.isArray(resolvedRule)
    ) {
      const [op] = Object.keys(resolvedRule);
      const args = resolvedRule[op];
      if (op === 'and' && Array.isArray(args) && args.length === 0) {
        this.#logger.debug('Special-case {and: []} ⇒ true (vacuous truth)');
        return true;
      }
      if (op === 'or' && Array.isArray(args) && args.length === 0) {
        this.#logger.debug('Special-case {or: []} ⇒ false (vacuous falsity)');
        return false;
      }
    }

    warnOnBracketPaths(resolvedRule, this.#logger);

    const ruleSummary =
      JSON.stringify(resolvedRule).substring(0, 150) +
      (JSON.stringify(resolvedRule).length > 150 ? '...' : '');
    this.#logger.debug(
      `Evaluating rule: ${ruleSummary}. Context keys: ${Object.keys(context || {}).join(', ')}`
    );

    try {
      const rawResult = jsonLogic.apply(resolvedRule, context);
      const finalBooleanResult = !!rawResult;

      this.#logger.debug(
        `Rule evaluation raw result: ${JSON.stringify(rawResult)}, Final boolean: ${finalBooleanResult}`
      );
      return finalBooleanResult;
    } catch (error) {
      this.#logger.error(
        `Error evaluating JSON Logic rule: ${ruleSummary}. Context keys: ${Object.keys(context || {}).join(', ')}`,
        error
      );
      return false;
    }
  }

  /**
   * Allows adding custom operations to the underlying json-logic-js instance.
   *
   * @param {string} name - The name of the custom operator.
   * @param {Function} func - The function implementing the operator logic.
   */
  addOperation(name, func) {
    try {
      jsonLogic.add_operation(name, func);
      this.#logger.debug(
        `Custom JSON Logic operation "${name}" added successfully.`
      );
    } catch (error) {
      this.#logger.error(
        `Failed to add custom JSON Logic operation "${name}":`,
        error
      );
    }
  }
}

export default JsonLogicEvaluationService;

/**
 * Evaluate a JSON Logic condition using the provided service with additional
 * logging and error handling.
 *
 * @param {JsonLogicEvaluationService} service - Service used to evaluate the condition.
 * @param {object} condition - JSON Logic rule to evaluate.
 * @param {JsonLogicEvaluationContext} ctx - Data context for evaluation.
 * @param {ILogger} logger - Logger for debug/error messages.
 * @param {string} label - Prefix for log statements.
 * @returns {{result: boolean, errored: boolean, error: Error|undefined}} Outcome
 * of the evaluation.
 */
export function evaluateConditionWithLogging(
  service,
  condition,
  ctx,
  logger,
  label
) {
  let rawResult;
  let result = false;
  try {
    rawResult = service.evaluate(condition, ctx);
    logger.debug(`${label} Condition evaluation raw result: ${rawResult}`);
    result = !!rawResult;
  } catch (error) {
    logger.error(
      `${label} Error during condition evaluation. Treating condition as FALSE.`,
      error
    );
    return { result: false, errored: true, error };
  }

  logger.debug(`${label} Condition evaluation final boolean result: ${result}`);
  return { result, errored: false, error: undefined };
}
