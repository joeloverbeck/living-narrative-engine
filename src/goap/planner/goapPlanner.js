/**
 * @file GOAP planner implementing A* search for goal-based planning
 * @see planningNode.js
 * @see planningEffectsSimulator.js
 * @see heuristicRegistry.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';

/**
 * GOAP planner using A* algorithm to find action sequences achieving goals
 *
 * State management helpers (GOAPIMPL-018-02):
 * - State hashing for duplicate detection in closed set
 * - Goal satisfaction checking for search termination
 * - Evaluation context building for JSON Logic conditions
 *
 * @class
 */
class GoapPlanner {
  /** @type {import('../../logging/logger.js').default} */
  #logger;

  /** @type {import('../../logic/services/jsonLogicEvaluationService.js').default} */
  #jsonLogicService;

  /**
   * Create new GOAP planner instance
   *
   * @param {object} deps - Dependencies
   * @param {import('../../logging/logger.js').default} deps.logger - Logger instance
   * @param {import('../../logic/services/jsonLogicEvaluationService.js').default} deps.jsonLogicService - JSON Logic evaluation service
   */
  constructor({ logger, jsonLogicService }) {
    this.#logger = ensureValidLogger(logger);

    validateDependency(jsonLogicService, 'JsonLogicEvaluationService', this.#logger, {
      requiredMethods: ['evaluateCondition'],
    });
    this.#jsonLogicService = jsonLogicService;

    this.#logger.info('GoapPlanner initialized');
  }

  /**
   * Create deterministic hash of planning state for deduplication
   *
   * Uses sorted keys to ensure consistent hashing regardless of key insertion order.
   * Critical for closed set duplicate detection in A* search.
   *
   * @param {object} state - Planning state hash
   * @returns {string} JSON string hash
   * @private
   * @example
   * const state = {
   *   'entity-1:core:health': 50,
   *   'entity-1:core:hungry': true
   * };
   * const hash = this.#hashState(state);
   * // Returns: '{"entity-1:core:health":50,"entity-1:core:hungry":true}'
   */
  #hashState(state) {
    if (!state || typeof state !== 'object') {
      this.#logger.warn('Invalid state for hashing', { state });
      return JSON.stringify({});
    }

    try {
      // Sort keys for deterministic hashing
      const sortedKeys = Object.keys(state).sort();
      const sortedState = {};

      for (const key of sortedKeys) {
        sortedState[key] = state[key];
      }

      return JSON.stringify(sortedState);
    } catch (err) {
      this.#logger.error('State hashing failed', err, { state });
      return JSON.stringify({});
    }
  }

  /**
   * Check if current state satisfies goal condition
   *
   * Evaluates goal.goalState JSON Logic condition against planning state.
   * Used to detect when A* search has reached the goal.
   *
   * @param {object} state - Current planning state
   * @param {object} goal - Goal definition with goalState condition
   * @returns {boolean} True if goal satisfied
   * @private
   * @example
   * const goal = {
   *   goalState: { '==': [{ 'var': 'actor.core.hungry' }, false] }
   * };
   * const satisfied = this.#goalSatisfied(state, goal);
   */
  #goalSatisfied(state, goal) {
    if (!goal || !goal.goalState) {
      this.#logger.warn('Invalid goal structure', { goal });
      return false;
    }

    try {
      // Build evaluation context from state
      const context = this.#buildEvaluationContext(state);

      // Evaluate goal condition
      const result = this.#jsonLogicService.evaluateCondition(
        goal.goalState,
        context
      );

      this.#logger.debug('Goal satisfaction check', {
        goalId: goal.id,
        satisfied: result,
      });

      return !!result; // Coerce to boolean
    } catch (err) {
      this.#logger.error('Goal evaluation error', err, {
        goalId: goal.id,
        state,
      });
      return false; // Conservative: assume not satisfied
    }
  }

  /**
   * Build JSON Logic evaluation context from planning state
   *
   * Converts flat state hash format to nested object structure for JSON Logic.
   * Enables conditions like { 'var': 'actor.core.hungry' } to resolve correctly.
   *
   * @param {object} state - Planning state hash
   * @returns {object} Evaluation context
   * @private
   * @example
   * const state = {
   *   'entity-1:core:hungry': true,
   *   'entity-1:core:health': 50
   * };
   * const context = this.#buildEvaluationContext(state);
   * // Returns: {
   * //   'entity-1': {
   * //     core: { hungry: true, health: 50 }
   * //   }
   * // }
   */
  #buildEvaluationContext(state) {
    if (!state || typeof state !== 'object') {
      this.#logger.warn('Invalid state for context building', { state });
      return {};
    }

    const context = {};

    try {
      for (const [key, value] of Object.entries(state)) {
        // Parse key format: "entityId:componentId" or "entityId:componentId:field"
        const parts = key.split(':');

        if (parts.length < 2) {
          this.#logger.debug('Invalid state key format', { key });
          continue;
        }

        const [entityId, componentId, ...fieldPath] = parts;

        // Initialize entity if needed
        if (!context[entityId]) {
          context[entityId] = {};
        }

        // Initialize component if needed
        if (!context[entityId][componentId]) {
          context[entityId][componentId] = {};
        }

        // Set value
        if (fieldPath.length === 0) {
          // Simple component: "entity:component" => value
          context[entityId][componentId] = value;
        } else {
          // Nested field: "entity:component:field" => value
          const field = fieldPath.join(':'); // Rejoin in case field has colons
          context[entityId][componentId][field] = value;
        }
      }

      return context;
    } catch (err) {
      this.#logger.error('Context building failed', err, { state });
      return {};
    }
  }

  /**
   * TEST-ONLY METHODS
   * These public methods expose private helpers for unit testing.
   * DO NOT use in production code - they exist solely for test coverage.
   */

  /**
   * Test-only accessor for #hashState
   *
   * @param {object} state - Planning state
   * @returns {string} State hash
   */
  testHashState(state) {
    return this.#hashState(state);
  }

  /**
   * Test-only accessor for #goalSatisfied
   *
   * @param {object} state - Planning state
   * @param {object} goal - Goal definition
   * @returns {boolean} Whether goal is satisfied
   */
  testGoalSatisfied(state, goal) {
    return this.#goalSatisfied(state, goal);
  }

  /**
   * Test-only accessor for #buildEvaluationContext
   *
   * @param {object} state - Planning state
   * @returns {object} Evaluation context
   */
  testBuildEvaluationContext(state) {
    return this.#buildEvaluationContext(state);
  }
}

export default GoapPlanner;
