/**
 * @file Relaxed Planning Graph Heuristic for GOAP planning
 * Advanced heuristic that builds a planning graph ignoring negative effects.
 * Provides better informed estimates than goal-distance for complex goals.
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import { deepClone } from '../../utils/cloneUtils.js';

/**
 * Relaxed Planning Graph Heuristic
 *
 * Builds a planning graph by forward-chaining task effects until the goal
 * is satisfied. Ignores negative effects (relaxed problem) to ensure admissibility.
 *
 * @property {number} Time Complexity: O(layers × tasks) - reasonable for small domains
 * @property {boolean} Admissible: Yes (relaxed problem is easier than real problem)
 * @property {string} Best for: Complex goals with interdependent conditions
 */
class RelaxedPlanningGraphHeuristic {
  #planningEffectsSimulator;
  #jsonLogicEvaluator;
  #logger;
  #MAX_LAYERS;

  /**
   * @param {object} params
   * @param {object} params.planningEffectsSimulator - Service for state transformation
   * @param {object} params.jsonLogicEvaluator - Service to evaluate JSON Logic conditions
   * @param {object} params.logger - Logger instance
   * @param {number} [params.maxLayers=10] - Maximum graph layers before declaring unsolvable
   */
  constructor({
    planningEffectsSimulator,
    jsonLogicEvaluator,
    jsonLogicEvaluationService,
    logger,
    maxLayers = 10,
  }) {
    this.#logger = ensureValidLogger(
      logger,
      'RelaxedPlanningGraphHeuristic.constructor'
    );

    // Validate dependencies
    validateDependency(
      planningEffectsSimulator,
      'IPlanningEffectsSimulator',
      this.#logger,
      {
        requiredMethods: ['simulateEffects'],
      }
    );

    const logicEvaluator = jsonLogicEvaluator ?? jsonLogicEvaluationService;

    validateDependency(logicEvaluator, 'JsonLogicEvaluationService', this.#logger, {
      requiredMethods: ['evaluate'],
    });

    this.#planningEffectsSimulator = planningEffectsSimulator;
    this.#jsonLogicEvaluator = logicEvaluator;
    this.#MAX_LAYERS = maxLayers;
  }

  /**
   * Calculate heuristic value using relaxed planning graph
   *
   * Expands layers of applicable tasks until goal is satisfied.
   * Returns layer count (minimum actions) or Infinity if unsolvable.
   *
   * @param {object} state - Current world state (PlanningNode format: "entityId:componentId:path" → value)
   * @param {object} goal - Goal with conditions array to satisfy
   * @param {Array} tasks - Available task library for planning
   * @returns {number} Minimum layers to reach goal (admissible, >= 0) or Infinity if unsolvable
   *
   * @example
   * const state = { "entity-1:core:hungry": true };
   * const goal = {
   *   conditions: [
   *     { condition: { "!": { "has_component": ["entity-1", "core:hungry"] } } }
   *   ]
   * };
   * const tasks = [
   *   {
   *     planningPreconditions: [{ condition: { "has_component": ["entity-1", "core:hungry"] } }],
   *     planningEffects: [{ type: "REMOVE_COMPONENT", parameters: { entityId: "entity-1", componentId: "core:hungry" } }]
   *   }
   * ];
   * // Returns: 1 (one task layer needed)
   */
  calculate(state, goal, tasks = []) {
    // Validate inputs
    if (!state || typeof state !== 'object') {
      this.#logger.warn('RelaxedPlanningGraphHeuristic.calculate: Invalid state, returning Infinity');
      return Infinity;
    }

    if (!goal || !Array.isArray(goal.conditions)) {
      this.#logger.warn(
        'RelaxedPlanningGraphHeuristic.calculate: Invalid goal (missing conditions array), returning Infinity'
      );
      return Infinity;
    }

    if (!Array.isArray(tasks)) {
      this.#logger.warn(
        'RelaxedPlanningGraphHeuristic.calculate: Invalid tasks array, returning Infinity'
      );
      return Infinity;
    }

    // Handle empty goal (already satisfied)
    if (goal.conditions.length === 0) {
      return 0;
    }

    // Handle empty task library (no way to progress)
    if (tasks.length === 0) {
      // Check if goal is already satisfied
      if (this.#isGoalSatisfied(goal, state)) {
        return 0;
      }
      // No tasks available and goal not satisfied
      return Infinity;
    }

    // Initialize RPG
    let layer = 0;
    let currentState = deepClone(state);

    // Check if goal already satisfied
    if (this.#isGoalSatisfied(goal, currentState)) {
      return 0;
    }

    // Expand layers until goal satisfied or max layers reached
    while (layer < this.#MAX_LAYERS) {
      layer++;

      // Find applicable tasks in current state
      const applicableTasks = this.#findApplicableTasks(tasks, currentState);

      // If no tasks applicable and goal not satisfied, stuck
      if (applicableTasks.length === 0) {
        this.#logger.debug(
          `RelaxedPlanningGraphHeuristic: No applicable tasks at layer ${layer}, declaring unsolvable`
        );
        return Infinity;
      }

      // Apply effects of all applicable tasks (relaxed = no conflicts)
      const newState = this.#applyAllTaskEffects(applicableTasks, currentState);

      // Check if we made progress (state changed)
      if (this.#statesEqual(newState, currentState)) {
        this.#logger.debug(
          `RelaxedPlanningGraphHeuristic: No progress at layer ${layer}, declaring unsolvable`
        );
        return Infinity;
      }

      currentState = newState;

      // Check if goal satisfied
      if (this.#isGoalSatisfied(goal, currentState)) {
        return layer;
      }
    }

    // Reached max layers without satisfying goal
    this.#logger.debug(
      `RelaxedPlanningGraphHeuristic: Reached max layers (${this.#MAX_LAYERS}), declaring unsolvable`
    );
    return Infinity;
  }

  /**
   * Check if goal is satisfied in current state
   *
   * @private
   * @param {object} goal - Goal with conditions array
   * @param {object} state - Current world state
   * @returns {boolean} True if all goal conditions satisfied
   */
  #isGoalSatisfied(goal, state) {
    for (const conditionObj of goal.conditions) {
      try {
        const condition = conditionObj.condition;
        if (!condition) {
          return false; // Missing condition means not satisfied
        }

        const satisfied = this.#jsonLogicEvaluator.evaluate(condition, { state });
        if (!satisfied) {
          return false;
        }
      } catch (err) {
        // Evaluation error means condition not satisfied
        return false;
      }
    }

    return true; // All conditions satisfied
  }

  /**
   * Find tasks that are applicable in current state
   *
   * @private
   * @param {Array} tasks - Task library
   * @param {object} state - Current world state
   * @returns {Array} Tasks whose preconditions are satisfied
   */
  #findApplicableTasks(tasks, state) {
    const applicable = [];

    for (const task of tasks) {
      if (this.#checkPreconditions(task, state)) {
        applicable.push(task);
      }
    }

    return applicable;
  }

  /**
   * Check if task preconditions are satisfied in state
   *
   * @private
   * @param {object} task - Task with planningPreconditions array
   * @param {object} state - Current world state
   * @returns {boolean} True if all preconditions satisfied
   */
  #checkPreconditions(task, state) {
    // Tasks without preconditions are always applicable
    if (!task.planningPreconditions || task.planningPreconditions.length === 0) {
      return true;
    }

    for (const preconditionObj of task.planningPreconditions) {
      try {
        const condition = preconditionObj.condition;
        if (!condition) {
          return false; // Missing condition means not applicable
        }

        const satisfied = this.#jsonLogicEvaluator.evaluate(condition, { state });
        if (!satisfied) {
          return false;
        }
      } catch (err) {
        // Evaluation error means precondition not satisfied
        return false;
      }
    }

    return true; // All preconditions satisfied
  }

  /**
   * Apply effects of all applicable tasks to state
   *
   * In relaxed planning, we apply all effects optimistically.
   * Conflicts are ignored (relaxed problem is easier).
   *
   * @private
   * @param {Array} tasks - Applicable tasks
   * @param {object} state - Current world state
   * @returns {object} New state with all task effects applied
   */
  #applyAllTaskEffects(tasks, state) {
    let newState = deepClone(state);

    for (const task of tasks) {
      // Skip tasks without effects
      if (!task.planningEffects || task.planningEffects.length === 0) {
        continue;
      }

      try {
        // Build context for effect simulation
        // Use minimal context as we don't have actual entity bindings
        const context = {
          actor: 'planning-actor', // Placeholder for planning
          task: {
            params: {}, // Tasks in relaxed planning don't need real param binding
          },
        };

        // Apply task effects using simulator
        const result = this.#planningEffectsSimulator.simulateEffects(
          newState,
          task.planningEffects,
          context
        );

        if (result.success) {
          newState = result.state;
        }
        // If simulation fails, skip this task's effects (relaxed approach)
      } catch (err) {
        // If effect application fails, skip this task (relaxed approach)
        this.#logger.warn(
          `RelaxedPlanningGraphHeuristic: Failed to apply effects for task, skipping: ${err.message}`
        );
      }
    }

    return newState;
  }

  /**
   * Check if two states are equal (for progress detection)
   *
   * @private
   * @param {object} state1 - First state
   * @param {object} state2 - Second state
   * @returns {boolean} True if states have same keys and values
   */
  #statesEqual(state1, state2) {
    const keys1 = Object.keys(state1).sort();
    const keys2 = Object.keys(state2).sort();

    // Different number of keys
    if (keys1.length !== keys2.length) {
      return false;
    }

    // Different keys
    for (let i = 0; i < keys1.length; i++) {
      if (keys1[i] !== keys2[i]) {
        return false;
      }
    }

    // Compare values (simple equality for now)
    for (const key of keys1) {
      if (JSON.stringify(state1[key]) !== JSON.stringify(state2[key])) {
        return false;
      }
    }

    return true;
  }
}

export default RelaxedPlanningGraphHeuristic;
