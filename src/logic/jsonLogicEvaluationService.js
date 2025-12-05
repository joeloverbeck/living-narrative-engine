// src/logic/jsonLogicEvaluationService.js
import jsonLogic from 'json-logic-js';
import { ServiceSetup } from '../utils/serviceInitializerUtils.js';
import { BaseService } from '../utils/serviceBase.js';
import { warnOnBracketPaths } from '../utils/jsonLogicUtils.js';
import { resolveConditionRefs } from '../utils/conditionRefResolver.js';
import * as environmentUtils from '../utils/environmentUtils.js';

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
  /** @private @type {Set<string>} Allowed JSON Logic operations */
  #allowedOperations;

  /**
   * Creates an instance of JsonLogicEvaluationService.
   *
   * @param {object} [dependencies] - The injected services.
   * @param {ILogger} dependencies.logger - Logging service.
   * @param {IGameDataRepository} [dependencies.gameDataRepository] - Repository for accessing condition definitions. Optional for tests.
   * @param {ServiceSetup} [dependencies.serviceSetup] - Optional service setup helper
   * @throws {Error} If required dependencies are missing or invalid.
   */
  constructor({ logger, gameDataRepository, serviceSetup } = {}) {
    super();
    const setup = serviceSetup ?? new ServiceSetup();
    this.#logger = setup.setupService('JsonLogicEvaluationService', logger);

    if (!gameDataRepository) {
      this.#logger.warn(
        'No gameDataRepository provided; condition_ref resolution disabled.'
      );
      this.#gameDataRepository = { getConditionDefinition: () => null };
    } else {
      setup.validateDeps('JsonLogicEvaluationService', this.#logger, {
        gameDataRepository: {
          value: gameDataRepository,
          requiredMethods: ['getConditionDefinition'],
        },
      });
      this.#gameDataRepository = gameDataRepository;
    }

    // Initialize allowed operations whitelist
    this.#allowedOperations = new Set([
      // Comparison operators
      '==',
      '===',
      '!=',
      '!==',
      '>',
      '>=',
      '<',
      '<=',
      // Logical operators
      'and',
      'or',
      'not',
      '!',
      '!!',
      // Conditional
      'if',
      // Data access
      'var',
      'missing',
      'missing_some',
      // Object operations
      'has',
      // Array operations
      'in',
      'cat',
      'substr',
      'merge',
      // Math operations
      '+',
      '-',
      '*',
      '/',
      '%',
      'min',
      'max',
      // String operations
      'toLowerCase',
      'toUpperCase',
      // Type checks
      'some',
      'none',
      'all',
      // Special
      'log',
      // Special syntax (resolved before evaluation, not actual operators)
      'condition_ref',
      'has_component',
      // Anatomy/body part operators
      'hasPartWithComponentValue',
      'hasPartOfType',
      'hasPartOfTypeWithComponentValue',
      // Clothing/equipment operators
      'hasClothingInSlot',
      'hasClothingInSlotLayer',
      'isSocketCovered',
      'isRemovalBlocked',
      // Location/actor operators
      'hasOtherActorsAtLocation',
      // Furniture/positioning operators
      'hasSittingSpaceToRight',
      'canScootCloser',
      'isClosestLeftOccupant',
      'isClosestRightOccupant',
      // Grabbing appendage operators
      'hasFreeGrabbingAppendages',
      'canActorGrabItem',
      'isItemBeingGrabbed',
      // Skills/stats operators
      'getSkillValue',
      // Damage capability operators
      'has_damage_capability',
      // Body part substring matching operators
      'hasPartSubTypeContaining',
    ]);

    // --- ADDED: Register the 'not' operator alias upon instantiation ---
    this.addOperation('not', (a) => !a);

    // --- ADDED: Register the 'has' operator for checking object properties ---
    this.addOperation('has', (object, property) => {
      if (object && typeof object === 'object') {
        return property in object;
      }
      return false;
    });

    const coerceTextMatchOptions = (value, primaryKey) => {
      if (value && typeof value === 'object') {
        return {
          matchAtEnd: Boolean(value.matchAtEnd),
          matchWholeWord: Boolean(value.matchWholeWord),
        };
      }

      return {
        matchAtEnd: primaryKey === 'matchAtEnd' ? Boolean(value) : false,
        matchWholeWord: primaryKey === 'matchWholeWord' ? Boolean(value) : false,
      };
    };

    this.addOperation('matchAtEnd', (value) =>
      coerceTextMatchOptions(value, 'matchAtEnd')
    );
    this.addOperation('matchWholeWord', (value) =>
      coerceTextMatchOptions(value, 'matchWholeWord')
    );

    this.#logger.debug('JsonLogicEvaluationService initialized.', {
      allowedOperationCount: this.#allowedOperations.size,
    });
  }

  /**
   * Get the set of allowed operations.
   *
   * @returns {Set<string>} Copy of allowed operation names
   */
  getAllowedOperations() {
    return new Set(this.#allowedOperations);
  }

  /**
   * Check if an operator is allowed.
   *
   * @param {string} operatorName - Operator name
   * @returns {boolean} True if operator is allowed
   */
  isOperatorAllowed(operatorName) {
    return this.#allowedOperations.has(operatorName);
  }

  /**
   * Validates a JSON Logic rule to ensure it only uses allowed operations.
   * This prevents potential security issues from arbitrary operations.
   *
   * @private
   * @param {any} rule - The rule to validate (can be object, array, or primitive)
   * @param {Set<string>} seenObjects - Track objects to prevent circular references
   * @param {number} depth - Current recursion depth
   * @throws {Error} If rule contains disallowed operations or exceeds depth limit
   */
  #validateJsonLogic(rule, seenObjects = new Set(), depth = 0) {
    const MAX_DEPTH = 50; // Prevent stack overflow from deeply nested rules

    if (depth > MAX_DEPTH) {
      throw new Error(
        `JSON Logic validation error: Maximum nesting depth (${MAX_DEPTH}) exceeded`
      );
    }

    // Handle null/undefined
    if (rule === null || rule === undefined) {
      return;
    }

    // Handle primitives (strings, numbers, booleans)
    if (typeof rule !== 'object') {
      return;
    }

    // Handle circular references using WeakSet for object references
    if (seenObjects.has(rule)) {
      throw new Error(
        'JSON Logic validation error: Circular reference detected'
      );
    }
    seenObjects.add(rule);

    try {
      // Handle arrays - validate each element
      if (Array.isArray(rule)) {
        for (const item of rule) {
          this.#validateJsonLogic(item, seenObjects, depth + 1);
        }
        return;
      }

      // Handle objects - check operations
      const keys = Object.keys(rule);

      // Check for dangerous properties explicitly
      if (
        Object.prototype.hasOwnProperty.call(rule, '__proto__') ||
        Object.prototype.hasOwnProperty.call(rule, 'constructor') ||
        Object.prototype.hasOwnProperty.call(rule, 'prototype')
      ) {
        const dangerousKey = Object.prototype.hasOwnProperty.call(
          rule,
          '__proto__'
        )
          ? '__proto__'
          : Object.prototype.hasOwnProperty.call(rule, 'constructor')
            ? 'constructor'
            : 'prototype';
        throw new Error(
          `JSON Logic validation error: Disallowed property '${dangerousKey}'`
        );
      }

      // Also check using getOwnPropertyNames for additional safety
      const allKeys = Object.getOwnPropertyNames(rule);
      for (const key of allKeys) {
        if (
          key === '__proto__' ||
          key === 'constructor' ||
          key === 'prototype'
        ) {
          throw new Error(
            `JSON Logic validation error: Disallowed property '${key}'`
          );
        }
      }

      // Empty objects are not valid JSON Logic rules (they evaluate to truthy but have no operation)
      if (keys.length === 0) {
        // Allow empty objects - they're harmless and evaluate to the object itself
        return;
      }

      // For single-key objects, check if it's a valid operation
      if (keys.length === 1) {
        const operation = keys[0];
        if (!this.#allowedOperations.has(operation)) {
          throw new Error(
            `JSON Logic validation error: Disallowed operation '${operation}'`
          );
        }
      }

      // Recursively validate all values
      for (const key of keys) {
        this.#validateJsonLogic(rule[key], seenObjects, depth + 1);
      }
    } finally {
      // Remove from seen objects when done processing
      seenObjects.delete(rule);
    }
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
          const comp = context.entity.components?.['core:position'];
          if (comp && comp.error) {
            this.#logger.error('Error retrieving entity position', comp.error);
          }
          this.#logger.debug(
            `    Entity: ${context.entity.id}, Location: ${comp && !comp.error ? comp.locationId : 'unknown'}`
          );
        }
        if (context.actor) {
          const comp = context.actor.components?.['core:position'];
          if (comp && comp.error) {
            this.#logger.error('Error retrieving actor position', comp.error);
          }
          // Add validation to catch undefined actor.id
          if (!context.actor.id) {
            this.#logger.error(
              '[CRITICAL] Actor exists but actor.id is undefined!',
              {
                actorKeys: Object.keys(context.actor || {}),
                hasComponents: !!context.actor.components,
              }
            );
          }
          this.#logger.debug(
            `    Actor: ${context.actor.id}, Location: ${comp && !comp.error ? comp.locationId : 'unknown'}`
          );
        } else {
          // Log when actor is completely missing
          this.#logger.debug('    Actor: undefined (missing from context)');
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
   * Evaluates a JSON Logic rule against a given data context using json-logic-js.
   * Returns the actual result type from the evaluation:
   * - Conditional operators (==, >, and, or, etc.) return boolean
   * - Data transformation operators (cat, substr, +, -, etc.) return their natural types (string, number, array, etc.)
   *
   * @param {object} rule - The JSON Logic rule object to evaluate. Can contain `condition_ref`s.
   * @param {JsonLogicEvaluationContext} context - The data context against which the rule is evaluated.
   * @returns {*} - The evaluation result. Returns false on error.
   */
  evaluate(rule, context) {
    // Validate the rule before resolving condition refs to catch issues early
    try {
      this.#validateJsonLogic(rule);
    } catch (validationError) {
      this.#logger.error('JSON Logic validation failed:', validationError);
      // Return false for invalid rules to prevent execution
      return false;
    }

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

    // Handle null/undefined rules before stringifying
    let ruleSummary = 'null';
    if (resolvedRule !== null && resolvedRule !== undefined) {
      const stringified = JSON.stringify(resolvedRule);
      if (stringified !== undefined) {
        ruleSummary =
          stringified.substring(0, 150) +
          (stringified.length > 150 ? '...' : '');
      }
    }
    this.#logger.debug(
      `Evaluating rule: ${ruleSummary}. Context keys: ${Object.keys(context || {}).join(', ')}`
    );

    // TEMPORARY DIAGNOSTIC: Log condition_ref evaluations
    if (resolvedRule && typeof resolvedRule === 'object' && resolvedRule.condition_ref) {
      this.#logger.debug('[DIAGNOSTIC] Evaluating condition_ref:', {
        conditionRef: resolvedRule.condition_ref,
        contextKeys: Object.keys(context || {}),
        actorId: context?.actor?.id,
        entityId: context?.entity?.id,
      });
    }

    try {
      let rawResult;
      if (
        resolvedRule &&
        typeof resolvedRule === 'object' &&
        !Array.isArray(resolvedRule)
      ) {
        const [op] = Object.keys(resolvedRule);
        const args = resolvedRule[op];

        const isTestEnv = environmentUtils.isTestEnvironment();
        if (
          (op === 'and' || op === 'or') &&
          Array.isArray(args) &&
          !isTestEnv
        ) {
          rawResult = this.#evaluateLogicalGroup(op, args, context);
        } else {
          this.#logger.debug(
            '[JsonLogicEvaluationService] Calling jsonLogic.apply',
            'logic:evaluation',
            {
              op,
              args,
              resolvedRule: JSON.stringify(resolvedRule),
              contextKeys: Object.keys(context || {}),
              stateKeys: context?.state ? Object.keys(context.state) : 'no state'
            }
          );
          rawResult = jsonLogic.apply(resolvedRule, context);
          this.#logger.debug('[JsonLogicEvaluationService] Result from jsonLogic.apply', 'logic:evaluation', rawResult);
        }
      } else {
        this.#logger.debug(
          '[JsonLogicEvaluationService] Calling jsonLogic.apply (else branch)',
          'logic:evaluation',
          {
            resolvedRule: JSON.stringify(resolvedRule),
            contextKeys: Object.keys(context || {}),
            stateKeys: context?.state ? Object.keys(context.state) : 'no state'
          }
        );
        rawResult = jsonLogic.apply(resolvedRule, context);
        this.#logger.debug('[JsonLogicEvaluationService] Result from jsonLogic.apply (else branch)', 'logic:evaluation', rawResult);
      }

      // Return raw result directly - json-logic-js returns correct types for all operators
      // Conditional operators (==, >, <, and, or) naturally return booleans
      // Data transformation operators (cat, substr, +, -, etc.) return their proper types
      this.#logger.debug(
        `Rule evaluation result: ${JSON.stringify(rawResult)} (type: ${typeof rawResult})`
      );
      return rawResult;
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
      // Add to allowed operations to pass validation
      this.#allowedOperations.add(name);
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

  /**
   * Backwards-compatible alias for evaluate().
   * Some subsystems (GOAP planner) previously depended on an
   * evaluateCondition helper on the evaluation service itself.
   *
   * @param {object} condition - JSON Logic rule to evaluate.
   * @param {object} context - Evaluation context object.
   * @returns {boolean} True when the condition evaluates to a truthy value.
   */
  evaluateCondition(condition, context) {
    return this.evaluate(condition, context);
  }

  /**
   * Removes a custom operation from the underlying json-logic-js instance.
   * Used primarily for test cleanup to prevent operator contamination.
   *
   * @param {string} name - The name of the custom operator to remove.
   */
  removeOperation(name) {
    try {
      jsonLogic.rm_operation(name);
      // Remove from allowed operations
      this.#allowedOperations.delete(name);
      this.#logger.debug(
        `Custom JSON Logic operation "${name}" removed successfully.`
      );
    } catch (error) {
      this.#logger.error(
        `Failed to remove custom JSON Logic operation "${name}":`,
        error
      );
      // Don't throw - this is cleanup code
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
