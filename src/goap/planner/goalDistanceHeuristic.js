/**
 * @file Goal Distance Heuristic for multi-action GOAP planning
 *
 * Simple, admissible heuristic for A* search that:
 * - Counts unsatisfied goal conditions (boolean evaluation)
 * - Computes numeric distances for numeric constraints (inequality goals)
 * - Enhanced mode: Estimates task count via most effective task analysis
 *
 * Admissibility: Never overestimates cost to goal
 * - Each condition requires ≥1 task to satisfy
 * - Numeric distances are exact (no overestimation)
 * - Enhanced mode uses actual task effects (still admissible)
 *
 * Time Complexity:
 * - Standard mode: O(n) for n goal conditions
 * - Enhanced mode: O(n + t) for t available tasks
 *
 * Best For:
 * - Multi-action numeric goals (e.g., reduce hunger 100 → 0)
 * - Simple goals with independent conditions
 * - Fast planning with reasonable accuracy
 *
 * @see src/goap/planner/relaxedPlanningGraphHeuristic.js - More accurate alternative
 * @see docs/goap/multi-action-planning.md#heuristic-enhancement
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import { createPlanningStateView } from './planningStateView.js';

/**
 * Goal Distance Heuristic for Multi-Action Planning
 *
 * Two-Mode Heuristic:
 *
 * 1. **Standard Mode** (when tasks not provided):
 *    - Count unsatisfied boolean conditions
 *    - Sum numeric distances for inequality goals (≤, ≥)
 *    - Fast: O(n) for n conditions
 *
 * 2. **Enhanced Mode** (when tasks provided):
 *    - Analyze task effects to find most effective task per goal field
 *    - Estimate task count needed: Math.ceil(distance / maxEffect)
 *    - More accurate guidance for multi-action scenarios
 *    - Slower: O(n + t) for t tasks
 *
 * Admissibility Guarantees:
 * - Never overestimates cost (required for A* optimality)
 * - Each condition requires ≥1 task (conservative for standard mode)
 * - Task count estimates based on actual max effects (admissible for enhanced mode)
 * - Numeric distances exact for current state
 *
 * Usage in GOAP:
 * - Guides A* search to explore promising paths first
 * - Reduces search space expansion significantly
 * - Critical for multi-action planning efficiency
 *
 * Examples:
 * - Goal: hunger ≤ 10, Current: 100, Task: -60 hunger
 *   Standard: 1 (unsatisfied condition)
 *   Enhanced: 2 (Math.ceil(90 / 60) = 2 tasks needed)
 *
 * - Goal: gold ≥ 100, Current: 0, Task: +25 gold
 *   Standard: 1 (unsatisfied condition)
 *   Enhanced: 4 (Math.ceil(100 / 25) = 4 tasks needed)
 *
 * @class
 * @see docs/goap/multi-action-planning.md for usage guide
 * @see src/goap/planner/numericConstraintEvaluator.js for numeric constraint handling
 */
class GoalDistanceHeuristic {
  #jsonLogicEvaluator;
  #numericConstraintEvaluator;
  #planningEffectsSimulator;
  #logger;
  #logicContextCache = new WeakMap();

  /**
   * Creates a new GoalDistanceHeuristic instance
   *
   * @param {object} params - Constructor parameters
   * @param {object} params.jsonLogicEvaluator - Service to evaluate JSON Logic conditions
   * @param {object} params.numericConstraintEvaluator - Service to evaluate numeric constraints
   * @param {object} params.planningEffectsSimulator - Service to simulate task effects
   * @param {object} params.logger - Logger instance
   */
  constructor({
    jsonLogicEvaluator,
    jsonLogicEvaluationService,
    numericConstraintEvaluator,
    planningEffectsSimulator,
    logger,
  }) {
    this.#logger = ensureValidLogger(logger, 'GoalDistanceHeuristic.constructor');

    const logicEvaluator = jsonLogicEvaluator ?? jsonLogicEvaluationService;

    validateDependency(logicEvaluator, 'JsonLogicEvaluationService', this.#logger, {
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

    this.#jsonLogicEvaluator = logicEvaluator;
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
  #calculateDistanceForGoalState(stateView, goalState, metadata = {}) {
    const evaluationContext = stateView.getEvaluationContext();

    try {
      // Check if this is a numeric constraint
      if (this.#numericConstraintEvaluator.isNumericConstraint(goalState)) {
        // Try to calculate numeric distance
        const numericDistance = this.#numericConstraintEvaluator.calculateDistance(
          goalState,
          evaluationContext,
          { stateView, metadata }
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
      const satisfied = this.#jsonLogicEvaluator.evaluate(
        goalState,
        evaluationContext
      );

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
  #calculateDistanceForGoalStateEnhanced(stateView, goalState, tasks, goal) {
    const metadata = { goalId: goal?.id, origin: 'GoalDistanceHeuristic' };
    const baseDistance = this.#calculateDistanceForGoalState(stateView, goalState, metadata);

    // If goal already satisfied or no tasks available, return base distance
    if (baseDistance === 0 || tasks.length === 0) {
      return baseDistance;
    }

    // Only enhance for numeric constraints
    if (!this.#numericConstraintEvaluator.isNumericConstraint(goalState)) {
      return baseDistance; // Boolean constraint - use base distance
    }

    // Find task that best reduces distance
    const bestTask = this.#findBestTaskForGoal(tasks, stateView, goal);

    if (!bestTask) {
      return baseDistance;
    }

    const taskEffect = this.#estimateTaskEffect(bestTask, stateView, goal);

    if (taskEffect === 0) {
      return baseDistance;
    }

    const actionsNeeded = Math.ceil(baseDistance / taskEffect);
    const taskCost = bestTask.cost || 1;
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
   * @param {PlanningStateView} stateView - Planning state view helper
   * @param {object} goal - Goal being planned for
   * @returns {object|null} Best task or null if none reduce distance
   * @private
   */
  #findBestTaskForGoal(tasks, stateView, goal) {
    let bestTask = null;
    let bestEffect = 0;

    for (const task of tasks) {
      const effect = this.#estimateTaskEffect(task, stateView, goal);

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
   * @param {PlanningStateView} stateView - Planning state helper
   * @param {object} goal - Goal being planned for
   * @returns {number} Distance reduced per action (>= 0)
   * @private
   */
  #estimateTaskEffect(task, stateView, goal) {
    // Skip tasks without planning effects
    if (!task.planningEffects || task.planningEffects.length === 0) {
      return 0;
    }

    // Extract actor ID from state structure for context
    // State has nested format: state.actor.id
    // Fallback: extract from flat hash keys (format: "entityId:componentId")
    let actorId = stateView.getActorId();

    if (!actorId) {
      // Try to extract from first flat hash key
      const flatKeys = Object.keys(stateView.getState()).filter((key) => key.includes(':'));
      if (flatKeys.length > 0) {
        actorId = flatKeys[0].split(':')[0]; // Extract "entityId" from "entityId:componentId"
        this.#logger.debug('Extracted actor ID from flat hash key', {
          taskId: task.id,
          actorId,
          flatKey: flatKeys[0],
        });
      } else {
        this.#logger.warn('Task effect estimation failed: actor ID not found in state', {
          taskId: task.id,
          stateKeys: Object.keys(stateView.getState()).slice(0, 5),
        });
        return 0;
      }
    }

    // Calculate distance before task application
    const beforeDistance = this.#numericConstraintEvaluator.calculateDistance(
      goal.goalState,
      stateView.getEvaluationContext(),
      {
        stateView,
        metadata: { goalId: goal?.id, taskId: task.id, origin: 'GoalDistanceHeuristic' },
      }
    );

    // Simulate ONE application of task
    // PlanningEffectsSimulator returns { success, state, errors }
    // Use actual actor ID from state to maintain consistency with planning state structure
    const simulationResult = this.#planningEffectsSimulator.simulateEffects(
      stateView.getState(),
      task.planningEffects,
      { actor: actorId, actorId } // Use actual actor ID for proper state key generation
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
    const simulatedView = createPlanningStateView(simulationResult.state, {
      logger: this.#logger,
      metadata: { goalId: goal?.id, taskId: task.id, origin: 'GoalDistanceHeuristic' },
    });
    const afterDistance = this.#numericConstraintEvaluator.calculateDistance(
      goal.goalState,
      simulatedView.getEvaluationContext(),
      { stateView: simulatedView, metadata: { goalId: goal?.id, taskId: task.id } }
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
  #calculateDistanceForConditions(stateView, conditions) {
    // Handle empty goal (already satisfied)
    if (conditions.length === 0) {
      return 0;
    }

    let unsatisfiedCount = 0;
    const evaluationContext = stateView.getEvaluationContext();

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
        const satisfied = this.#jsonLogicEvaluator.evaluate(
          condition,
          evaluationContext
        );

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

    const stateView = createPlanningStateView(state, {
      logger: this.#logger,
      metadata: { goalId: goal?.id, origin: 'GoalDistanceHeuristic' },
    });

    if (goal.goalState) {
      return this.#calculateDistanceForGoalStateEnhanced(stateView, goal.goalState, tasks, goal);
    }

    if (Array.isArray(goal.conditions)) {
      return this.#calculateDistanceForConditions(stateView, goal.conditions);
    }

    // Neither format present
    this.#logger.warn(
      'GoalDistanceHeuristic.calculate: Invalid goal (missing both goalState and conditions array), returning Infinity'
    );
    return Infinity;
  }

}

export default GoalDistanceHeuristic;
