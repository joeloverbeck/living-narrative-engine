/**
 * @file Numeric Constraint Evaluator for GOAP planning
 * Evaluates numeric comparison operators and calculates distances to goal satisfaction.
 * Supports backward chaining for MODIFY_COMPONENT operations.
 * @example
 * // Evaluate if constraint is satisfied
 * const satisfied = evaluator.evaluateConstraint(
 *   { '<=': [{ var: 'actor.hunger' }, 30] },
 *   { actor: { hunger: 25 } }
 * );
 *
 * // Calculate distance to satisfaction
 * const distance = evaluator.calculateDistance(
 *   { '<=': [{ var: 'actor.hunger' }, 30] },
 *   { actor: { hunger: 80 } }
 * ); // Returns 50
 */

import jsonLogic from 'json-logic-js';
import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';

/**
 * Numeric Constraint Evaluator
 *
 * Evaluates numeric constraints (>, <, >=, <=, ==) and calculates the distance
 * from current values to goal satisfaction. Used by GOAP planner for backward
 * chaining with MODIFY_COMPONENT operations.
 *
 * @property {object} jsonLogicEvaluator - JSON Logic evaluation service
 * @property {object} logger - Logger instance
 */
class NumericConstraintEvaluator {
  #jsonLogicEvaluator;
  #logger;

  /**
   * Supported numeric comparison operators
   *
   * @private
   */
  static #NUMERIC_OPERATORS = ['>', '<', '>=', '<=', '=='];

  /**
   * Creates a numeric constraint evaluator instance
   *
   * @param {object} params - Constructor parameters
   * @param {object} params.jsonLogicEvaluator - Service to evaluate JSON Logic expressions
   * @param {object} params.logger - Logger instance
   */
  constructor({ jsonLogicEvaluator, jsonLogicEvaluationService, logger }) {
    this.#logger = ensureValidLogger(
      logger,
      'NumericConstraintEvaluator.constructor'
    );

    const evaluator = jsonLogicEvaluator ?? jsonLogicEvaluationService;

    validateDependency(evaluator, 'JsonLogicEvaluationService', this.#logger, {
      requiredMethods: ['evaluate'],
    });

    this.#jsonLogicEvaluator = evaluator;
  }

  /**
   * Evaluates if a constraint is satisfied
   *
   * @param {object} constraint - JSON Logic expression
   * @param {object} context - Current state context
   * @returns {boolean} True if constraint satisfied
   * @example
   * evaluateConstraint({ '<=': [{ var: 'hunger' }, 30] }, { hunger: 25 })
   * // Returns true
   */
  evaluateConstraint(constraint, context) {
    try {
      return this.#jsonLogicEvaluator.evaluate(constraint, context);
    } catch (err) {
      this.#logger.warn(
        `Failed to evaluate constraint: ${err.message}`,
        { constraint, context },
        err
      );
      return false;
    }
  }

  /**
   * Calculates distance to satisfy constraint
   *
   * Returns the numeric distance from the current value to the point where
   * the constraint would be satisfied. Returns 0 if already satisfied.
   * Returns null if the constraint is not numeric or cannot be evaluated.
   *
   * @param {object} constraint - JSON Logic numeric constraint
   * @param {object} context - Current state context
   * @returns {number|null} Distance value or null if not numeric
   * @example
   * // Current hunger is 80, goal is <= 30
   * calculateDistance({ '<=': [{ var: 'hunger' }, 30] }, { hunger: 80 })
   * // Returns 50
   * @example
   * // Already satisfied
   * calculateDistance({ '<=': [{ var: 'hunger' }, 30] }, { hunger: 25 })
   * // Returns 0
   */
  calculateDistance(constraint, context) {
    if (!constraint || !context) {
      return null;
    }

    try {
      const parsed = this.#parseNumericConstraint(constraint);
      if (!parsed) {
        return null;
      }

      const { operator, varPath, targetValue } = parsed;
      const currentValue = this.#extractValue(varPath, context);

      if (typeof currentValue !== 'number' || typeof targetValue !== 'number') {
        this.#logger.debug(
          `Cannot calculate distance - non-numeric values: current=${currentValue} (${typeof currentValue}), target=${targetValue} (${typeof targetValue})`,
          { varPath, constraint }
        );
        return null;
      }

      return this.#computeDistance(operator, currentValue, targetValue);
    } catch (err) {
      this.#logger.warn(
        `Failed to calculate distance: ${err.message}`,
        { constraint, context },
        err
      );
      return null;
    }
  }

  /**
   * Determines if constraint is numeric type
   *
   * @param {object} constraint - JSON Logic expression
   * @returns {boolean} True if numeric constraint
   * @example
   * isNumericConstraint({ '>=': [{ var: 'health' }, 50] }) // true
   * isNumericConstraint({ has_component: ['core:actor'] }) // false
   */
  isNumericConstraint(constraint) {
    if (!constraint || typeof constraint !== 'object') {
      return false;
    }

    const keys = Object.keys(constraint);
    return keys.some((key) => NumericConstraintEvaluator.#NUMERIC_OPERATORS.includes(key));
  }

  /**
   * Parses a numeric constraint to extract operator, variable path, and target value
   *
   * @private
   * @param {object} constraint - JSON Logic expression
   * @returns {{operator: string, varPath: string, targetValue: number}|null} Parsed constraint or null
   * @example
   * #parseNumericConstraint({ '<=': [{ var: 'hunger' }, 30] })
   * // Returns { operator: '<=', varPath: 'hunger', targetValue: 30 }
   */
  #parseNumericConstraint(constraint) {
    if (!constraint || typeof constraint !== 'object') {
      return null;
    }

    // Find the numeric operator
    const operator = NumericConstraintEvaluator.#NUMERIC_OPERATORS.find((op) =>
      Object.prototype.hasOwnProperty.call(constraint, op)
    );

    if (!operator) {
      return null;
    }

    const operands = constraint[operator];
    if (!Array.isArray(operands) || operands.length !== 2) {
      return null;
    }

    // Extract variable path and target value
    // JSON Logic format: { 'op': [{ var: 'path' }, targetValue] }
    const [varExpr, targetValue] = operands;

    if (!varExpr || typeof varExpr !== 'object' || !varExpr.var) {
      return null;
    }

    return {
      operator,
      varPath: varExpr.var,
      targetValue,
    };
  }

  /**
   * Computes distance based on operator and values
   *
   * @private
   * @param {string} operator - Comparison operator (>, <, >=, <=, ==)
   * @param {number} currentValue - Current state value
   * @param {number} targetValue - Target value from constraint
   * @returns {number|null} Distance to satisfaction or null if invalid
   * @example
   * // For <=: current 80, target 30 → distance 50
   * #computeDistance('<=', 80, 30) // Returns 50
   * @example
   * // For >=: current 30, target 50 → distance 20
   * #computeDistance('>=', 30, 50) // Returns 20
   */
  #computeDistance(operator, currentValue, targetValue) {
    switch (operator) {
      case '>':
      case '>=':
        // Need currentValue to be >= targetValue
        // If current is 30 and target is 50, distance is 20
        return currentValue >= targetValue ? 0 : targetValue - currentValue;

      case '<':
      case '<=':
        // Need currentValue to be <= targetValue
        // If current is 80 and target is 30, distance is 50
        return currentValue <= targetValue ? 0 : currentValue - targetValue;

      case '==':
        // Need exact match
        return Math.abs(currentValue - targetValue);

      default:
        return null;
    }
  }

  /**
   * Extracts a value from context using JSON Logic var resolution
   * Handles dual-format state by trying nested format first, then flat hash format.
   *
   * Dual-format state structure:
   * - Nested: state.actor.components['core:needs'] (component IDs may have colons)
   * - Flat: state['actor_id:core:needs'] (entity:component hash keys)
   *
   * @private
   * @param {string} varPath - Variable path (e.g., 'state.actor.components.core:needs.hunger')
   * @param {object} context - Context object with dual-format state
   * @returns {number|string|boolean|object|undefined} Extracted value or undefined if not found
   * @example
   * // Nested format extraction
   * #extractValue('state.actor.components.core:needs.hunger', 
   *   { state: { actor: { components: { 'core:needs': { hunger: 50 } } } } })
   * // Returns 50
   * @example
   * // Flat format fallback
   * #extractValue('state.actor.components.core:needs.hunger',
   *   { state: { 'actor_id:core:needs': { hunger: 50 }, actor: { id: 'actor_id' } } })
   * // Returns 50
   */
  #extractValue(varPath, context) {
    try {
      // Try standard JSON Logic resolution first (works for simple paths)
      const standardValue = jsonLogic.apply({ var: varPath }, context);
      if (standardValue !== undefined && standardValue !== null) {
        this.#logger.debug(`Extracted value via standard resolution: ${standardValue}`, {
          varPath,
        });
        return standardValue;
      }

      // If standard resolution failed and path contains component reference,
      // try dual-format state extraction
      if (varPath.includes('components.')) {
        const dualFormatValue = this.#extractFromDualFormat(varPath, context);
        if (dualFormatValue !== undefined && dualFormatValue !== null) {
          this.#logger.debug(`Extracted value via dual-format resolution: ${dualFormatValue}`, {
            varPath,
          });
          return dualFormatValue;
        }
      }

      this.#logger.debug(`Could not extract value at path '${varPath}'`);
      return undefined;
    } catch (err) {
      this.#logger.debug(`Failed to extract value at path '${varPath}': ${err.message}`);
      return undefined;
    }
  }

  /**
   * Extracts value from dual-format state structure
   * Handles paths like 'state.actor.components.core:needs.hunger' where component IDs contain colons.
   *
   * Strategy:
   * 1. Parse the path to extract state prefix, actor reference, component ID, and field
   * 2. Try nested format: state.actor.components['componentId'].field
   * 3. Try flat format: state['actorId:componentId'].field
   *
   * @private
   * @param {string} varPath - Variable path containing 'components.'
   * @param {object} context - Context object with dual-format state
   * @returns {number|string|boolean|object|undefined} Extracted value or undefined
   * @example
   * // Path: state.actor.components.core:needs.hunger
   * // Nested: state.actor.components['core:needs'].hunger
   * // Flat: state['test_actor:core:needs'].hunger (if actor.id = 'test_actor')
   */
  #extractFromDualFormat(varPath, context) {
    // Parse path: 'state.actor.components.core:needs.hunger'
    // Expected format: <prefix>.components.<componentId>.<field>
    const componentsIndex = varPath.indexOf('components.');
    if (componentsIndex === -1) {
      return undefined;
    }

    const prefix = varPath.substring(0, componentsIndex - 1); // 'state.actor'
    const afterComponents = varPath.substring(componentsIndex + 'components.'.length); // 'core:needs.hunger'

    // Split remaining path at the LAST dot to separate component ID from field
    // This handles 'core:needs.hunger' → componentId='core:needs', field='hunger'
    const lastDotIndex = afterComponents.lastIndexOf('.');
    if (lastDotIndex === -1) {
      // No field specified, just component ID
      return this.#extractComponent(prefix, afterComponents, context);
    }

    const componentId = afterComponents.substring(0, lastDotIndex); // 'core:needs'
    const field = afterComponents.substring(lastDotIndex + 1); // 'hunger'

    // Try nested format first: navigate to prefix, then get component, then field
    try {
      const prefixObj = jsonLogic.apply({ var: prefix }, context);
      if (prefixObj && prefixObj.components && prefixObj.components[componentId]) {
        const value = prefixObj.components[componentId][field];
        if (value !== undefined && value !== null) {
          return value;
        }
      }
    } catch (err) {
      // Nested format failed, continue to flat format
      this.#logger.debug(`Nested format extraction failed for ${varPath}: ${err.message}`);
    }

    // Try flat format: state['actorId:componentId'].field
    try {
      const stateObj = jsonLogic.apply({ var: prefix.split('.')[0] }, context); // Get 'state'
      if (!stateObj) {
        return undefined;
      }

      // Get actor object to find actor ID
      const actorRef = prefix.split('.').slice(1).join('.'); // 'actor'
      const actorObj = jsonLogic.apply({ var: actorRef }, { context: stateObj });

      let actorId;
      if (actorObj && actorObj.id) {
        actorId = actorObj.id;
      } else {
        // Try to infer actor ID from flat keys (format: 'actorId:componentId')
        const flatKeys = Object.keys(stateObj).filter((k) => k.includes(':'));
        if (flatKeys.length > 0) {
          actorId = flatKeys[0].split(':')[0];
        }
      }

      if (actorId) {
        const flatKey = `${actorId}:${componentId}`;
        const componentData = stateObj[flatKey];
        if (componentData && componentData[field] !== undefined) {
          return componentData[field];
        }
      }
    } catch (err) {
      this.#logger.debug(`Flat format extraction failed for ${varPath}: ${err.message}`);
    }

    return undefined;
  }

  /**
   * Extracts component object (without field access)
   *
   * @private
   * @param {string} prefix - Path prefix (e.g., 'state.actor')
   * @param {string} componentId - Component ID (e.g., 'core:needs')
   * @param {object} context - Context object
   * @returns {object|undefined} Component object or undefined
   */
  #extractComponent(prefix, componentId, context) {
    try {
      const prefixObj = jsonLogic.apply({ var: prefix }, context);
      if (prefixObj && prefixObj.components && prefixObj.components[componentId]) {
        return prefixObj.components[componentId];
      }
    } catch (err) {
      this.#logger.debug(`Component extraction failed for ${componentId}: ${err.message}`);
    }
    return undefined;
  }
}

export default NumericConstraintEvaluator;
