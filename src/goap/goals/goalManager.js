/**
 * @file Goal manager for GOAP planning
 * Selects highest-priority relevant goals for actors
 */

import { validateDependency, assertPresent } from '../../utils/dependencyUtils.js';
import { string } from '../../utils/validationCore.js';

/**
 * Manages goal selection for GOAP actors
 */
class GoalManager {
  #logger;
  #gameDataRepository;
  #goalStateEvaluator;
  #jsonLogicEvaluator;
  #entityManager;

  /**
   * Creates a new GoalManager instance
   *
   * @param {object} params - Dependencies
   * @param {object} params.logger - Logger instance
   * @param {object} params.gameDataRepository - Game data repository
   * @param {object} params.goalStateEvaluator - Goal state evaluator
   * @param {object} params.jsonLogicEvaluator - JSON Logic evaluator
   * @param {object} params.entityManager - Entity manager
   */
  constructor({
    logger,
    gameDataRepository,
    goalStateEvaluator,
    jsonLogicEvaluator,
    entityManager
  }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug']
    });
    validateDependency(gameDataRepository, 'IGameDataRepository', logger, {
      requiredMethods: ['getGoalDefinition', 'getAllGoalDefinitions']
    });
    validateDependency(goalStateEvaluator, 'IGoalStateEvaluator', logger, {
      requiredMethods: ['evaluate', 'calculateDistance']
    });
    validateDependency(jsonLogicEvaluator, 'JsonLogicEvaluationService', logger, {
      requiredMethods: ['evaluate']
    });
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getEntityInstance', 'hasComponent', 'getComponentData']
    });

    this.#logger = logger;
    this.#gameDataRepository = gameDataRepository;
    this.#goalStateEvaluator = goalStateEvaluator;
    this.#jsonLogicEvaluator = jsonLogicEvaluator;
    this.#entityManager = entityManager;
  }

  /**
   * Selects the highest-priority relevant goal for an actor
   *
   * @param {string} actorId - Entity ID of actor
   * @param {object} context - World state context
   * @returns {object | null} Selected goal or null
   */
  selectGoal(actorId, context) {
    string.assertNonBlank(actorId, 'actorId', 'selectGoal', this.#logger);
    assertPresent(context, 'Context is required');

    this.#logger.debug(`Selecting goal for actor: ${actorId}`);

    try {
      // Step 1: Get all goals for actor
      const goals = this.getGoalsForActor(actorId);

      if (goals.length === 0) {
        this.#logger.debug(`No goals available for ${actorId}`);
        return null;
      }

      // Step 2: Filter to relevant goals
      const relevant = goals.filter(goal =>
        this.isRelevant(goal, actorId, context)
      );

      if (relevant.length === 0) {
        this.#logger.debug(`No relevant goals for ${actorId}`);
        return null;
      }

      // Step 3: Filter out already satisfied goals
      const unsatisfied = relevant.filter(goal =>
        !this.isGoalSatisfied(goal, actorId, context)
      );

      if (unsatisfied.length === 0) {
        this.#logger.debug(`All relevant goals already satisfied for ${actorId}`);
        return null;
      }

      // Step 4: Sort by priority (descending)
      unsatisfied.sort((a, b) => b.priority - a.priority);

      // Step 5: Return highest priority
      const selected = unsatisfied[0];
      this.#logger.info(`Selected goal ${selected.id} (priority ${selected.priority}) for ${actorId}`);

      return selected;
    } catch (error) {
      this.#logger.error(`Failed to select goal for ${actorId}`, error);
      return null;
    }
  }

  /**
   * Evaluates if a goal is relevant for an actor
   *
   * @param {object} goal - Goal definition
   * @param {string} actorId - Entity ID of actor
   * @param {object} context - World state context
   * @returns {boolean} True if relevant
   */
  isRelevant(goal, actorId, context) {
    assertPresent(goal, 'Goal is required');
    string.assertNonBlank(actorId, 'actorId', 'isRelevant', this.#logger);

    try {
      if (!goal.relevance) {
        // No relevance condition means always relevant
        return true;
      }

      // Prepare context with actor
      const enrichedContext = {
        ...context,
        actor: this.#entityManager.getEntityInstance(actorId),
        actorId
      };

      // Evaluate relevance condition using JSON Logic
      const result = this.#jsonLogicEvaluator.evaluate(
        goal.relevance,
        enrichedContext
      );

      return !!result;
    } catch (error) {
      this.#logger.error(`Failed to evaluate relevance for goal ${goal.id}`, error);
      return false;
    }
  }

  /**
   * Evaluates if goal state is satisfied
   *
   * @param {object} goal - Goal definition
   * @param {string} actorId - Entity ID of actor
   * @param {object} context - World state context
   * @returns {boolean} True if goal achieved
   */
  isGoalSatisfied(goal, actorId, context) {
    assertPresent(goal, 'Goal is required');
    string.assertNonBlank(actorId, 'actorId', 'isGoalSatisfied', this.#logger);

    try {
      return this.#goalStateEvaluator.evaluate(
        goal.goalState,
        actorId,
        context
      );
    } catch (error) {
      this.#logger.error(`Failed to evaluate goal state for ${goal.id}`, error);
      return false;
    }
  }

  /**
   * Gets all goals for an actor's mod set
   *
   * @param {string} actorId - Entity ID of actor
   * @returns {Array<object>} List of goals
   */
  getGoalsForActor(actorId) {
    string.assertNonBlank(actorId, 'actorId', 'getGoalsForActor', this.#logger);

    try {
      // Get actor's loaded mods
      const actor = this.#entityManager.getEntityInstance(actorId);
      if (!actor) {
        this.#logger.warn(`Actor not found: ${actorId}`);
        return [];
      }

      // For now, get all goals from all loaded mods
      // Could be filtered by actor type/components in future
      const goals = this.#gameDataRepository.getAllGoalDefinitions();

      return goals;
    } catch (error) {
      this.#logger.error(`Failed to get goals for ${actorId}`, error);
      return [];
    }
  }
}

export default GoalManager;
