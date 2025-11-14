/**
 * @file Goal Distance Heuristic for GOAP planning
 * Simple heuristic that counts the number of unsatisfied goal conditions.
 * Admissible: each condition requires at least 1 action to satisfy.
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';

/**
 * Goal Distance Heuristic
 *
 * Calculates heuristic value by counting unsatisfied goal conditions.
 * This is a simple, fast, admissible heuristic suitable for goals with
 * independent conditions.
 *
 * @property {number} Time Complexity: O(n) where n = number of conditions
 * @property {boolean} Admissible: Yes (each condition requires ≥1 action)
 * @property {string} Best for: Simple goals with independent conditions
 */
class GoalDistanceHeuristic {
  #jsonLogicEvaluator;
  #logger;

  /**
   * @param {object} params
   * @param {object} params.jsonLogicEvaluator - Service to evaluate JSON Logic conditions
   * @param {object} params.logger - Logger instance
   */
  constructor({ jsonLogicEvaluator, logger }) {
    this.#logger = ensureValidLogger(logger, 'GoalDistanceHeuristic.constructor');

    validateDependency(jsonLogicEvaluator, 'JsonLogicEvaluationService', this.#logger, {
      requiredMethods: ['evaluate'],
    });

    this.#jsonLogicEvaluator = jsonLogicEvaluator;
  }

  /**
   * Calculate heuristic value as number of unsatisfied goal conditions
   *
   * @param {object} state - Current world state (PlanningNode format: "entityId:componentId:path" → value)
   * @param {object} goal - Goal with conditions array to satisfy
   * @param {Array} _tasks - Available tasks (unused by this heuristic, for interface compatibility)
   * @returns {number} Number of unsatisfied conditions (admissible, >= 0)
   *
   * @example
   * const state = { "entity-1:core:hungry": true, "entity-1:core:health": 50 };
   * const goal = {
   *   conditions: [
   *     { condition: { "!": { "has_component": ["entity-1", "core:hungry"] } } },
   *     { condition: { ">": [{ "var": "state.entity-1:core:health" }, 80] } }
   *   ]
   * };
   * // Returns: 2 (both conditions unsatisfied)
   */
  calculate(state, goal, _tasks = []) {
    // Validate inputs
    if (!state || typeof state !== 'object') {
      this.#logger.warn('GoalDistanceHeuristic.calculate: Invalid state, returning Infinity');
      return Infinity;
    }

    if (!goal || !Array.isArray(goal.conditions)) {
      this.#logger.warn(
        'GoalDistanceHeuristic.calculate: Invalid goal (missing conditions array), returning Infinity'
      );
      return Infinity;
    }

    // Handle empty goal (already satisfied)
    if (goal.conditions.length === 0) {
      return 0;
    }

    let unsatisfiedCount = 0;

    for (const conditionObj of goal.conditions) {
      try {
        // Each condition has a JSON Logic expression in the 'condition' field
        const condition = conditionObj.condition;

        if (!condition) {
          this.#logger.warn(
            'GoalDistanceHeuristic.calculate: Condition missing "condition" field, treating as unsatisfied'
          );
          unsatisfiedCount++;
          continue;
        }

        // Evaluate condition against state
        // Context provides state for JSON Logic variable resolution
        const satisfied = this.#jsonLogicEvaluator.evaluate(condition, { state });

        if (!satisfied) {
          unsatisfiedCount++;
        }
      } catch (err) {
        // If condition evaluation fails, treat as unsatisfied (conservative)
        this.#logger.warn(
          `GoalDistanceHeuristic.calculate: Failed to evaluate condition, treating as unsatisfied: ${err.message}`
        );
        unsatisfiedCount++;
      }
    }

    return unsatisfiedCount;
  }
}

export default GoalDistanceHeuristic;
