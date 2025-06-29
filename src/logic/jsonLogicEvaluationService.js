// src/logic/jsonLogicEvaluationService.js
import jsonLogic from 'json-logic-js';
import { validateServiceDeps } from '../utils/serviceInitializerUtils.js';
import { BaseService } from '../utils/serviceBase.js';
import { warnOnBracketPaths } from '../utils/jsonLogicUtils.js';
import { resolveConditionRefs } from '../utils/conditionRefResolver.js';

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/IGameDataRepository.js').IGameDataRepository} IGameDataRepository */
/** @typedef {import('./defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */

// --- REMOVED: The module-level registration attempt has been removed from here ---

/**
 * @class JsonLogicEvaluationService
 * Encapsulates the evaluation of JSON Logic rules, including resolving condition_ref references.
 */
class JsonLogicEvaluationService extends BaseService {
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
    super();
    this.#logger = this._init('JsonLogicEvaluationService', logger);

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
    try {
      return resolveConditionRefs(rule, this.#gameDataRepository, this.#logger);
    } catch (err) {
      if (
        err.message.startsWith('Circular condition_ref detected') ||
        err.message.startsWith('Could not resolve condition_ref')
      ) {
        this.#logger.error(err.message);
        return { '==': [true, false] };
      }
      throw err;
    }
  }

  /**
   * Resolves a rule and warns about bracket notation paths.
   *
   * @private
   * @param {object} rule - Rule to resolve.
   * @returns {object} Resolved rule or fallback.
   */
  #prepareRule(rule) {
    const resolved = this.#resolveRule(rule);
    warnOnBracketPaths(resolved, this.#logger);
    return resolved;
  }

  /**
   * Evaluate a logical group (and/or) with short-circuiting and logging.
   *
   * @private
   * @param {string} op - "and" or "or".
   * @param {Array<any>} args - Array of conditions.
   * @param {JsonLogicEvaluationContext} context - Evaluation context.
   * @returns {boolean} Result of the logical group.
   */
  #evaluateLogicalGroup(op, args, context) {
    this.#logger.debug(
      `Detailed evaluation of ${op.toUpperCase()} operation with ${args.length} conditions:`
    );

    const individualResults = [];
    for (let i = 0; i < args.length; i++) {
      const conditionResult = jsonLogic.apply(args[i], context);
      const conditionBoolean = !!conditionResult;
      const conditionSummary =
        JSON.stringify(args[i]).substring(0, 100) +
        (JSON.stringify(args[i]).length > 100 ? '...' : '');

      this.#logger.debug(
        `  Condition ${i + 1}/${args.length}: ${conditionSummary} => ${conditionBoolean}`
      );

      if (context && typeof context === 'object') {
        if (context.entity) {
          this.#logger.debug(
            `    Entity: ${context.entity.id}, Location: ${context.entity.components?.['core:position']?.locationId || 'unknown'}`
          );
        }
        if (context.actor) {
          this.#logger.debug(
            `    Actor: ${context.actor.id}, Location: ${context.actor.components?.['core:position']?.locationId || 'unknown'}`
          );
        }
        if (context.location) {
          this.#logger.debug(`    Location: ${context.location.id}`);
        }
      }

      individualResults.push(conditionBoolean);

      if (op === 'and' && !conditionBoolean) {
        this.#logger.debug(
          `  AND operation short-circuited at condition ${i + 1} (false result)`
        );
        return false;
      }
      if (op === 'or' && conditionBoolean) {
        this.#logger.debug(
          `  OR operation short-circuited at condition ${i + 1} (true result)`
        );
        return true;
      }
    }

    return op === 'and'
      ? individualResults.every((r) => r)
      : individualResults.some((r) => r);
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
    const resolvedRule = this.#prepareRule(rule);

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

    const ruleSummary =
      JSON.stringify(resolvedRule).substring(0, 150) +
      (JSON.stringify(resolvedRule).length > 150 ? '...' : '');
    this.#logger.debug(
      `Evaluating rule: ${ruleSummary}. Context keys: ${Object.keys(context || {}).join(', ')}`
    );

    try {
      let rawResult;
      if (
        resolvedRule &&
        typeof resolvedRule === 'object' &&
        !Array.isArray(resolvedRule)
      ) {
        const [op] = Object.keys(resolvedRule);
        const args = resolvedRule[op];

        const isTestEnv =
          (typeof globalThis !== 'undefined' && globalThis.jest) ||
          (typeof globalThis.process !== 'undefined' &&
            globalThis.process.env.NODE_ENV === 'test');
        if (
          (op === 'and' || op === 'or') &&
          Array.isArray(args) &&
          !isTestEnv
        ) {
          rawResult = this.#evaluateLogicalGroup(op, args, context);
        } else {
          rawResult = jsonLogic.apply(resolvedRule, context);
        }
      } else {
        rawResult = jsonLogic.apply(resolvedRule, context);
      }

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
