/**
 * @file ActivityFilteringSystem - Filtering logic for activity visibility evaluation
 * Extracted from ActivityDescriptionService as part of ACTDESSERREF-004
 * @see activityDescriptionService.js
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../../utils/loggerUtils.js';

/**
 * ActivityFilteringSystem
 *
 * Handles filtering of activity metadata based on conditions:
 * - Function-based conditions
 * - Property-based conditions (showOnlyIfProperty)
 * - Component requirements (required/forbidden)
 * - Custom JSON logic conditions
 *
 * Dependencies:
 * - IActivityConditionValidator: Validates component and property conditions
 * - IJsonLogicEvaluationService: Evaluates JSON logic expressions
 * - IEntityManager: Resolves target entities for context building
 * - ILogger: Structured logging
 */
class ActivityFilteringSystem {
  #logger;
  #conditionValidator;
  #jsonLogicEvaluationService;
  #entityManager;

  constructor({
    logger,
    conditionValidator,
    jsonLogicEvaluationService,
    entityManager,
  }) {
    this.#logger = ensureValidLogger(logger, 'ActivityFilteringSystem');

    validateDependency(
      conditionValidator,
      'IActivityConditionValidator',
      this.#logger,
      {
        requiredMethods: [
          'isEmptyConditionsObject',
          'matchesPropertyCondition',
          'hasRequiredComponents',
          'hasForbiddenComponents',
          'extractEntityData',
        ],
      }
    );

    validateDependency(
      jsonLogicEvaluationService,
      'IJsonLogicEvaluationService',
      this.#logger,
      { requiredMethods: ['evaluate'] }
    );

    validateDependency(entityManager, 'IEntityManager', this.#logger, {
      requiredMethods: ['getEntityInstance'],
    });

    this.#conditionValidator = conditionValidator;
    this.#jsonLogicEvaluationService = jsonLogicEvaluationService;
    this.#entityManager = entityManager;
  }

  /**
   * Filter activities based on visibility conditions
   *
   * @param {Array} activities - Activity metadata to filter
   * @param {object} entity - Entity context for condition evaluation
   * @returns {Array} Filtered activities that pass visibility checks
   */
  filterByConditions(activities, entity) {
    if (!Array.isArray(activities) || activities.length === 0) {
      return [];
    }

    return activities.filter((activity) => {
      try {
        return this.#evaluateActivityVisibility(activity, entity);
      } catch (error) {
        this.#logger.warn(
          'Failed to evaluate activity visibility for activity metadata',
          error
        );
        return false;
      }
    });
  }

  /**
   * Evaluate visibility of a single activity based on conditions
   *
   * @param {object} activity - Activity metadata with optional conditions
   * @param {object} entity - Entity context
   * @returns {boolean} True if activity should be visible
   * @private
   */
  #evaluateActivityVisibility(activity, entity) {
    if (!activity || activity.visible === false) {
      return false;
    }

    if (typeof activity.condition === 'function') {
      try {
        return activity.condition(entity);
      } catch (error) {
        this.#logger.warn(
          'Condition evaluation failed for activity description entry',
          error
        );
        return false;
      }
    }

    const metadata = activity.metadata ?? activity.activityMetadata ?? {};
    const conditions = activity.conditions ?? metadata.conditions;

    if (
      !conditions ||
      this.#conditionValidator.isEmptyConditionsObject(conditions)
    ) {
      return metadata.shouldDescribeInActivity !== false;
    }

    if (metadata.shouldDescribeInActivity === false) {
      return false;
    }

    if (
      conditions.showOnlyIfProperty &&
      !this.#conditionValidator.matchesPropertyCondition(
        activity,
        conditions.showOnlyIfProperty
      )
    ) {
      return false;
    }

    if (
      Array.isArray(conditions.requiredComponents) &&
      conditions.requiredComponents.length > 0 &&
      !this.#conditionValidator.hasRequiredComponents(
        entity,
        conditions.requiredComponents
      )
    ) {
      return false;
    }

    if (
      Array.isArray(conditions.forbiddenComponents) &&
      conditions.forbiddenComponents.length > 0 &&
      this.#conditionValidator.hasForbiddenComponents(
        entity,
        conditions.forbiddenComponents
      )
    ) {
      return false;
    }

    if (conditions.customLogic) {
      const context = this.#buildLogicContext(activity, entity);

      try {
        const result = this.#jsonLogicEvaluationService.evaluate(
          conditions.customLogic,
          context
        );

        if (!result) {
          return false;
        }
      } catch (error) {
        this.#logger.warn('Failed to evaluate custom logic', error);
        return true; // Fail open on JSON logic errors
      }
    }

    return true;
  }

  /**
   * Build context for JSON logic evaluation
   *
   * @param {object} activity - Activity metadata
   * @param {object} entity - Entity context
   * @returns {object} Logic context with entity, activity, and target data
   * @private
   */
  #buildLogicContext(activity, entity) {
    let targetEntity = null;

    if (activity?.targetEntityId) {
      try {
        targetEntity = this.#entityManager.getEntityInstance(
          activity.targetEntityId
        );
      } catch (error) {
        this.#logger.warn(
          `Failed to resolve target entity '${activity.targetEntityId}' for activity conditions`,
          error
        );
      }
    }

    return {
      entity: this.#conditionValidator.extractEntityData(entity),
      activity: activity?.sourceData ?? {},
      target: targetEntity
        ? this.#conditionValidator.extractEntityData(targetEntity)
        : null,
    };
  }

  /**
   * Get test hooks for testing
   *
   * @returns {object} Test hooks
   */
  getTestHooks() {
    return {
      evaluateActivityVisibility: (activity, entity) =>
        this.#evaluateActivityVisibility(activity, entity),
      buildLogicContext: (activity, entity) =>
        this.#buildLogicContext(activity, entity),
      conditionValidator: this.#conditionValidator,
    };
  }
}

export default ActivityFilteringSystem;
