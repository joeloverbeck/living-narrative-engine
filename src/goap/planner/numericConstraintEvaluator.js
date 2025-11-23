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

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import { createPlanningStateView } from './planningStateView.js';
import { GOAP_EVENTS } from '../events/goapEvents.js';
import { emitGoapEvent } from '../events/goapEventFactory.js';
import { recordNumericConstraintFallback } from './numericConstraintDiagnostics.js';

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
  #goapEventDispatcher;

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
   * @param params.jsonLogicEvaluationService
   * @param {object} params.logger - Logger instance
   * @param params.goapEventDispatcher
   */
  constructor({
    jsonLogicEvaluator,
    jsonLogicEvaluationService,
    logger,
    goapEventDispatcher,
  }) {
    this.#logger = ensureValidLogger(
      logger,
      'NumericConstraintEvaluator.constructor'
    );

    const evaluator = jsonLogicEvaluator ?? jsonLogicEvaluationService;

    validateDependency(evaluator, 'JsonLogicEvaluationService', this.#logger, {
      requiredMethods: ['evaluate'],
    });

    this.#jsonLogicEvaluator = evaluator;
    this.#goapEventDispatcher = goapEventDispatcher ?? null;
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
   * @param options
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
  calculateDistance(constraint, context, options = {}) {
    if (!constraint || !context) {
      return null;
    }

    try {
      const parsed = this.#parseNumericConstraint(constraint);
      if (!parsed) {
        this.#handleNumericFallback({
          metadata: options.metadata,
          reason: 'invalid-constraint',
        });
        return null;
      }

      const { operator, varPath, targetValue } = parsed;
      let currentValue;
      let activeStateView = options.stateView || null;

      if (activeStateView) {
        currentValue = activeStateView.assertPath(varPath, {
          path: varPath,
          goalId: options.metadata?.goalId,
          taskId: options.metadata?.taskId,
          origin: 'NumericConstraintEvaluator',
        });
      } else {
        activeStateView = createPlanningStateView(context?.state ?? context, {
          metadata: { origin: 'NumericConstraintEvaluator', ...options.metadata },
        });
        currentValue = activeStateView.assertPath(varPath, {
          path: varPath,
          goalId: options.metadata?.goalId,
          taskId: options.metadata?.taskId,
          origin: 'NumericConstraintEvaluator',
        });
      }

      if (typeof currentValue !== 'number' || typeof targetValue !== 'number') {
        this.#logger.debug(
          `Cannot calculate distance - non-numeric values: current=${currentValue} (${typeof currentValue}), target=${targetValue} (${typeof targetValue})`,
          { varPath, constraint }
        );
        this.#handleNumericFallback({
          metadata: options.metadata,
          stateView: activeStateView,
          varPath,
          operator,
          reason: 'non-numeric-value',
        });
        return null;
      }

      return this.#computeDistance(operator, currentValue, targetValue);
    } catch (err) {
      this.#logger.warn(
        `Failed to calculate distance: ${err.message}`,
        { constraint, context },
        err
      );
      this.#handleNumericFallback({
        metadata: options.metadata,
        stateView: options.stateView || null,
        reason: 'calculation-error',
      });
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
    }
  }

  #handleNumericFallback({ metadata = {}, stateView, varPath = null, operator = null, reason = 'numeric-fallback' }) {
    const actorId =
      metadata.actorId ||
      stateView?.getActorId() ||
      stateView?.getEvaluationContext()?.actor?.id ||
      null;
    const payload = {
      actorId: actorId || 'unknown',
      goalId: metadata.goalId || null,
      origin: metadata.origin || 'NumericConstraintEvaluator',
      varPath,
      operator,
      reason,
    };
    const adapterEnabled = process.env.GOAP_NUMERIC_ADAPTER === '1';

    if (adapterEnabled) {
      recordNumericConstraintFallback(payload);

      if (this.#goapEventDispatcher) {
        try {
          emitGoapEvent(
            this.#goapEventDispatcher,
            GOAP_EVENTS.NUMERIC_CONSTRAINT_FALLBACK,
            {
              actorId: payload.actorId,
              goalId: payload.goalId,
              origin: payload.origin,
              operator: payload.operator,
              missingPath: payload.varPath || null,
              reason: payload.reason,
            },
            {
              actorId: payload.actorId,
              goalId: payload.goalId,
            }
          );
        } catch (error) {
          this.#logger.warn('Failed to emit numeric constraint fallback event', {
            error,
            payload,
          });
        }
      }
    }

    if (process.env.GOAP_NUMERIC_STRICT === '1') {
      const err = new Error(
        `[GOAP_NUMERIC_STRICT] Numeric constraint fallback${payload.varPath ? ` at ${payload.varPath}` : ''}`
      );
      err.code = 'GOAP_NUMERIC_CONSTRAINT_FALLBACK';
      throw err;
    }
  }
}

export default NumericConstraintEvaluator;
