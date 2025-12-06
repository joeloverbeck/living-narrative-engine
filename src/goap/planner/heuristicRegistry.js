/**
 * @file Heuristic Registry for GOAP planning
 * Central registry for selecting and delegating to heuristic implementations.
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';

/**
 * Heuristic Registry
 *
 * Provides centralized access to heuristic implementations for A* search.
 * Supports heuristic selection by name with fallback behavior.
 *
 * Built-in heuristics:
 * - 'goal-distance': Simple goal distance (count unsatisfied conditions)
 * - 'rpg': Relaxed planning graph (advanced, considers task structure)
 * - 'zero': Dijkstra fallback (guaranteed optimal, but slow)
 */
class HeuristicRegistry {
  #goalDistanceHeuristic;
  #relaxedPlanningGraphHeuristic;
  #logger;
  #heuristics;

  /**
   * @param {object} params
   * @param {object} params.goalDistanceHeuristic - Goal distance heuristic implementation
   * @param {object} params.relaxedPlanningGraphHeuristic - RPG heuristic implementation
   * @param {object} params.logger - Logger instance
   */
  constructor({
    goalDistanceHeuristic,
    relaxedPlanningGraphHeuristic,
    logger,
  }) {
    this.#logger = ensureValidLogger(logger, 'HeuristicRegistry.constructor');

    // Validate heuristic dependencies
    validateDependency(
      goalDistanceHeuristic,
      'IGoalDistanceHeuristic',
      this.#logger,
      {
        requiredMethods: ['calculate'],
      }
    );

    validateDependency(
      relaxedPlanningGraphHeuristic,
      'IRelaxedPlanningGraphHeuristic',
      this.#logger,
      {
        requiredMethods: ['calculate'],
      }
    );

    this.#goalDistanceHeuristic = goalDistanceHeuristic;
    this.#relaxedPlanningGraphHeuristic = relaxedPlanningGraphHeuristic;

    // Register built-in heuristics
    this.#heuristics = new Map([
      ['goal-distance', this.#goalDistanceHeuristic],
      ['rpg', this.#relaxedPlanningGraphHeuristic],
      ['zero', { calculate: () => 0 }], // Dijkstra fallback (admissible, h=0)
    ]);

    this.#logger.debug('HeuristicRegistry initialized with 3 heuristics', {
      heuristics: Array.from(this.#heuristics.keys()),
    });
  }

  /**
   * Get heuristic implementation by name
   *
   * @param {string} name - Heuristic identifier ('goal-distance', 'rpg', 'zero')
   * @returns {object} Heuristic with calculate(state, goal, tasks) method
   * @example
   * const heuristic = registry.get('rpg');
   * const h = heuristic.calculate(state, goal, tasks);
   */
  get(name) {
    if (!name || typeof name !== 'string') {
      this.#logger.warn(
        `HeuristicRegistry.get: Invalid name '${name}', falling back to 'goal-distance'`
      );
      return this.#heuristics.get('goal-distance');
    }

    if (!this.#heuristics.has(name)) {
      this.#logger.warn(
        `HeuristicRegistry.get: Unknown heuristic '${name}', falling back to 'goal-distance'`
      );
      return this.#heuristics.get('goal-distance');
    }

    return this.#heuristics.get(name);
  }

  /**
   * Calculate heuristic value using named heuristic
   *
   * @param {string} name - Heuristic to use ('goal-distance', 'rpg', 'zero')
   * @param {object} state - Current world state (PlanningNode format)
   * @param {object} goal - Goal conditions to satisfy
   * @param {Array} tasks - Available task library (optional for some heuristics)
   * @returns {number} Heuristic estimate (admissible, >= 0)
   * @example
   * const h = registry.calculate('rpg', state, goal, tasks);
   * // Returns: estimated minimum actions to reach goal
   */
  calculate(name, state, goal, tasks = []) {
    try {
      const heuristic = this.get(name);
      const result = heuristic.calculate(state, goal, tasks);

      // Validate result (must be non-negative for admissibility)
      if (typeof result !== 'number' || result < 0) {
        this.#logger.warn(
          `HeuristicRegistry.calculate: Heuristic '${name}' returned invalid value ${result}, using Infinity`
        );
        return Infinity;
      }

      return result;
    } catch (err) {
      this.#logger.error(
        `HeuristicRegistry.calculate: Heuristic '${name}' threw error, returning Infinity`,
        err
      );
      return Infinity;
    }
  }

  /**
   * Get list of available heuristic names
   *
   * @returns {Array<string>} Array of registered heuristic names
   */
  getAvailableHeuristics() {
    return Array.from(this.#heuristics.keys());
  }

  /**
   * Check if heuristic is registered
   *
   * @param {string} name - Heuristic name to check
   * @returns {boolean} True if heuristic exists
   */
  has(name) {
    return this.#heuristics.has(name);
  }
}

export default HeuristicRegistry;
