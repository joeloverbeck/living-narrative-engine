/**
 * @file Goal state evaluator for GOAP planning
 * Evaluates goal state conditions using ScopeDSL and JSON Logic
 */

import { validateDependency, assertPresent } from '../../utils/dependencyUtils.js';
import { string } from '../../utils/validationCore.js';

/**
 * Evaluates goal state conditions
 */
class GoalStateEvaluator {
  #logger;
  #jsonLogicEvaluator;
  #entityManager;

  /**
   * Creates a new GoalStateEvaluator instance
   *
   * @param {object} params - Dependencies
   * @param {object} params.logger - Logger instance
   * @param {object} params.jsonLogicEvaluator - JSON Logic evaluator
   * @param {object} params.entityManager - Entity manager
   */
  constructor({
    logger,
    jsonLogicEvaluator,
    entityManager
  }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug']
    });
    validateDependency(jsonLogicEvaluator, 'JsonLogicEvaluationService', logger, {
      requiredMethods: ['evaluate']
    });
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getEntityInstance', 'hasComponent', 'getComponentData']
    });

    this.#logger = logger;
    this.#jsonLogicEvaluator = jsonLogicEvaluator;
    this.#entityManager = entityManager;
  }

  /**
   * Evaluates if goal state condition is met
   *
   * @param {object} goalState - Goal state condition (JSON Logic)
   * @param {string} actorId - Entity ID of actor
   * @param {object} context - World state context
   * @returns {boolean} True if goal state satisfied
   */
  evaluate(goalState, actorId, context) {
    assertPresent(goalState, 'Goal state is required');
    string.assertNonBlank(actorId, 'actorId', 'evaluate', this.#logger);

    try {
      // Goal states are JSON Logic conditions (per goal.schema.json)
      return this.#evaluateJsonLogic(goalState, actorId, context);
    } catch (error) {
      this.#logger.error('Failed to evaluate goal state', error);
      return false;
    }
  }

  /**
   * Calculates distance to goal state (for heuristic)
   *
   * @param {object} goalState - Goal state condition
   * @param {string} actorId - Entity ID of actor
   * @param {object} context - World state context
   * @returns {number} Distance metric (0 = satisfied)
   */
  calculateDistance(goalState, actorId, context) {
    assertPresent(goalState, 'Goal state is required');
    string.assertNonBlank(actorId, 'actorId', 'calculateDistance', this.#logger);

    try {
      // If goal satisfied, distance is 0
      if (this.evaluate(goalState, actorId, context)) {
        return 0;
      }

      // For Tier 1, use simple heuristic
      // Tier 2 can implement more sophisticated distance calculation
      return 1;
    } catch (error) {
      this.#logger.error('Failed to calculate distance', error);
      return Infinity;
    }
  }

  // Private helper methods

  #evaluateJsonLogic(logic, actorId, context) {
    // Enrich context with actor entity
    const enrichedContext = {
      ...context,
      actor: this.#entityManager.getEntityInstance(actorId),
      actorId
    };

    // Standard JSON Logic evaluation
    const result = this.#jsonLogicEvaluator.evaluate(logic, enrichedContext);
    return !!result;
  }
}

export default GoalStateEvaluator;
