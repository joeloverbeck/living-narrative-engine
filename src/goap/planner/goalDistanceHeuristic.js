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
 * Calculates heuristic value by counting unsatisfied goal conditions or computing
 * numeric distances for numeric constraints. This is a simple, fast, admissible
 * heuristic suitable for goals with independent conditions and numeric constraints.
 *
 * Enhanced with multi-action cost estimation that estimates the number of actions
 * needed to reach a goal by finding the most effective task and calculating how
 * many applications would be required.
 *
 * Time Complexity: O(n) where n = number of conditions (O(t) for enhanced with t tasks)
 * Admissibility: Yes (each condition requires ≥1 action, numeric distances are exact)
 * Best for: Simple goals with independent conditions and numeric goals
 */
class GoalDistanceHeuristic {
  #jsonLogicEvaluator;
  #numericConstraintEvaluator;
  #planningEffectsSimulator;
  #logger;

  /**
   * Creates a new GoalDistanceHeuristic instance
   *
   * @param {object} params - Constructor parameters
   * @param {object} params.jsonLogicEvaluator - Service to evaluate JSON Logic conditions
   * @param {object} params.numericConstraintEvaluator - Service to evaluate numeric constraints
   * @param {object} params.planningEffectsSimulator - Service to simulate task effects
   * @param {object} params.logger - Logger instance
   */
  constructor({ jsonLogicEvaluator, numericConstraintEvaluator, planningEffectsSimulator, logger }) {
    this.#logger = ensureValidLogger(logger, 'GoalDistanceHeuristic.constructor');

    validateDependency(jsonLogicEvaluator, 'JsonLogicEvaluationService', this.#logger, {
      requiredMethods: ['evaluate'],
    });

    validateDependency(
      numericConstraintEvaluator,
      'NumericConstraintEvaluator',
      this.#logger,
      {
        requiredMethods: ['isNumericConstraint', 'calculateDistance'],
      }
    );

    validateDependency(
      planningEffectsSimulator,
      'IPlanningEffectsSimulator',
      this.#logger,
      {
        requiredMethods: ['simulateEffects'],
      }
    );

    this.#jsonLogicEvaluator = jsonLogicEvaluator;
    this.#numericConstraintEvaluator = numericConstraintEvaluator;
    this.#planningEffectsSimulator = planningEffectsSimulator;
  }

  /**
   * Calculate distance for goalState format (single condition)
   *
   * @param {object} state - Current planning state
   * @param {object} goalState - Goal condition (JSON Logic expression)
   * @returns {number} Distance to goal (0 if satisfied, numeric distance if numeric constraint, 1 otherwise)
   * @private
   */
  #calculateDistanceForGoalState(state, goalState) {
    try {
      // Check if this is a numeric constraint
      if (this.#numericConstraintEvaluator.isNumericConstraint(goalState)) {
        // Try to calculate numeric distance
        // Pass state directly as context (not wrapped in { state })
        const numericDistance = this.#numericConstraintEvaluator.calculateDistance(
          goalState,
          state
        );

        // If numeric distance is successfully calculated, use it
        if (numericDistance !== null && numericDistance !== undefined) {
          return numericDistance;
        }

        // Fall through to boolean evaluation if numeric calculation fails
        this.#logger.warn(
          'GoalDistanceHeuristic: Numeric constraint detected but distance calculation returned null, falling back to boolean evaluation'
        );
      }

      // Evaluate goal condition against state (boolean evaluation)
      // Context provides state for JSON Logic variable resolution
      const satisfied = this.#jsonLogicEvaluator.evaluate(goalState, { state });

      // If already satisfied, distance is 0; otherwise 1 (at least 1 action needed)
      return satisfied ? 0 : 1;
    } catch (err) {
      // If condition evaluation fails, treat as unsatisfied (conservative)
      this.#logger.warn(
        `GoalDistanceHeuristic: Failed to evaluate goalState, treating as unsatisfied: ${err.message}`
      );
      return 1;
    }
  }

  /**
   * Calculate distance for goalState format with optional task-based estimation.
   *
   * Enhanced version that estimates the number of actions needed by finding the
   * most effective task and calculating: ⌈distance / taskEffect⌉ × taskCost
   *
   * This provides better A* guidance than raw distance alone.
   *
   * @param {object} state - Current planning state
   * @param {object} goalState - Goal condition (JSON Logic expression)
   * @param {Array<object>} tasks - Available tasks for multi-action estimation
   * @param {object} goal - Full goal object (for logging)
   * @returns {number} Distance to goal (enhanced with task estimation if tasks provided)
   * @private
   */
  #calculateDistanceForGoalStateEnhanced(state, goalState, tasks, goal) {
    // Get base distance using existing logic
    const baseDistance = this.#calculateDistanceForGoalState(state, goalState);

    // If goal already satisfied or no tasks available, return base distance
    if (baseDistance === 0 || tasks.length === 0) {
      return baseDistance;
    }

    // Only enhance for numeric constraints
    if (!this.#numericConstraintEvaluator.isNumericConstraint(goalState)) {
      return baseDistance; // Boolean constraint - use base distance
    }

    // Find task that best reduces distance
    const bestTask = this.#findBestTaskForGoal(tasks, state, goal);

    if (!bestTask) {
      // No task can reduce distance → use base distance as pessimistic estimate
      return baseDistance;
    }

    // Estimate number of actions needed
    const taskEffect = this.#estimateTaskEffect(bestTask, state, goal);

    if (taskEffect === 0) {
      // Task doesn't reduce distance
      return baseDistance;
    }

    const actionsNeeded = Math.ceil(baseDistance / taskEffect);
    const taskCost = bestTask.cost || 1; // Default cost is 1
    const estimatedCost = actionsNeeded * taskCost;

    this.#logger.debug('Enhanced heuristic calculation', {
      baseDistance,
      taskId: bestTask.id,
      taskEffect,
      actionsNeeded,
      taskCost,
      estimatedCost,
    });

    return estimatedCost; // Admissible: actual cost >= estimated cost
  }

  /**
   * Find the task that most effectively reduces distance to goal.
   *
   * "Most effective" = largest distance reduction per action
   *
   * @param {Array<object>} tasks - Available tasks from task library
   * @param {object} state - Current world state
   * @param {object} goal - Goal being planned for
   * @returns {object|null} Best task or null if none reduce distance
   * @private
   */
  #findBestTaskForGoal(tasks, state, goal) {
    let bestTask = null;
    let bestEffect = 0;

    for (const task of tasks) {
      const effect = this.#estimateTaskEffect(task, state, goal);

      if (effect > bestEffect) {
        bestEffect = effect;
        bestTask = task;
      }
    }

    return bestTask;
  }

  /**
   * Estimate how much a single application of a task reduces distance to goal.
   *
   * @param {object} task - Task to estimate (must have planningEffects)
   * @param {object} state - Current world state
   * @param {object} goal - Goal being planned for
   * @returns {number} Distance reduced per action (>= 0)
   * @private
   */
  #estimateTaskEffect(task, state, goal) {
    // Skip tasks without planning effects
    if (!task.planningEffects || task.planningEffects.length === 0) {
      return 0;
    }

    // Calculate distance before task application
    // CRITICAL: Pass state directly, NOT wrapped in { state }
    const beforeDistance = this.#numericConstraintEvaluator.calculateDistance(
      goal.goalState,
      state // Direct state, not { state }
    );

    // Simulate ONE application of task
    // PlanningEffectsSimulator returns { success, state, errors }
    const simulationResult = this.#planningEffectsSimulator.simulateEffects(
      state,
      task.planningEffects,
      { actor: { id: 'heuristic-simulation' } } // Temporary actor for simulation
    );

    // Handle simulation failure
    if (!simulationResult.success) {
      this.#logger.debug('Task simulation failed during effect estimation', {
        taskId: task.id,
        errors: simulationResult.errors,
      });
      return 0; // Can't estimate effect if simulation fails
    }

    // Calculate distance after task application
    // CRITICAL: Pass state directly, NOT wrapped in { state }
    const afterDistance = this.#numericConstraintEvaluator.calculateDistance(
      goal.goalState,
      simulationResult.state // Direct state from simulation result
    );

    // Return absolute reduction in distance (beforeDistance - afterDistance)
    // Use max(0, ...) to ensure non-negative (task might increase distance)
    const reduction = Math.max(0, beforeDistance - afterDistance);

    this.#logger.debug('Task effect estimation', {
      taskId: task.id,
      beforeDistance,
      afterDistance,
      reduction,
    });

    return reduction;
  }

  /**
   * Calculate distance for conditions array format (legacy)
   *
   * @param {object} state - Current planning state
   * @param {Array} conditions - Array of condition objects
   * @returns {number} Count of unsatisfied conditions
   * @private
   */
  #calculateDistanceForConditions(state, conditions) {
    // Handle empty goal (already satisfied)
    if (conditions.length === 0) {
      return 0;
    }

    let unsatisfiedCount = 0;

    for (const conditionObj of conditions) {
      try {
        // Each condition has a JSON Logic expression in the 'condition' field
        const condition = conditionObj.condition;

        if (!condition) {
          this.#logger.warn(
            'GoalDistanceHeuristic: Condition missing "condition" field, treating as unsatisfied'
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
          `GoalDistanceHeuristic: Failed to evaluate condition, treating as unsatisfied: ${err.message}`
        );
        unsatisfiedCount++;
      }
    }

    return unsatisfiedCount;
  }

  /**
   * Calculate heuristic value as number of unsatisfied goal conditions or numeric distance
   *
   * @param {object} state - Current world state (PlanningNode format: "entityId:componentId:path" → value)
   * @param {object} goal - Goal with goalState or conditions array to satisfy
   * @param {Array} tasks - Available tasks (used for enhanced multi-action estimation)
   * @returns {number} Distance to goal (numeric distance for numeric constraints, count otherwise)
   * @example
   * // Numeric constraint
   * const state = { "actor:core:needs": { hunger: 80 } };
   * const goal = {
   *   goalState: { "<=": [{ "var": "state.actor:core:needs.hunger" }, 30] }
   * };
   * // Returns: 50 (numeric distance)
   * @example
   * // Enhanced with tasks
   * const state = { "actor:core:needs": { hunger: 100 } };
   * const goal = {
   *   goalState: { "<=": [{ "var": "state.actor:core:needs.hunger" }, 10] }
   * };
   * const tasks = [
   *   { id: 'eat', cost: 5, planningEffects: [...] } // reduces 60 hunger
   * ];
   * // Returns: 10 (⌈90/60⌉ × 5 = 2 × 5 = 10) instead of 90
   * @example
   * // Boolean conditions (legacy)
   * const state = { "entity-1:core:hungry": true, "entity-1:core:health": 50 };
   * const goal = {
   *   conditions: [
   *     { condition: { "!": { "has_component": ["entity-1", "core:hungry"] } } },
   *     { condition: { ">": [{ "var": "state.entity-1:core:health" }, 80] } }
   *   ]
   * };
   * // Returns: 2 (both conditions unsatisfied)
   */
  calculate(state, goal, tasks = []) {
    // Validate inputs
    if (!state || typeof state !== 'object') {
      this.#logger.warn('GoalDistanceHeuristic.calculate: Invalid state, returning Infinity');
      return Infinity;
    }

    // Support both goalState (current format) and conditions array (legacy)
    if (!goal) {
      this.#logger.warn(
        'GoalDistanceHeuristic.calculate: Invalid goal (null/undefined), returning Infinity'
      );
      return Infinity;
    }

    // Handle goalState format (single condition) - supports numeric constraints
    if (goal.goalState) {
      return this.#calculateDistanceForGoalStateEnhanced(state, goal.goalState, tasks, goal);
    }

    // Handle conditions array format (legacy) - no numeric evaluation
    if (Array.isArray(goal.conditions)) {
      return this.#calculateDistanceForConditions(state, goal.conditions);
    }

    // Neither format present
    this.#logger.warn(
      'GoalDistanceHeuristic.calculate: Invalid goal (missing both goalState and conditions array), returning Infinity'
    );
    return Infinity;
  }
}

export default GoalDistanceHeuristic;
