/**
 * @file Simple one-step planner for GOAP
 * Validates planning infrastructure before full A* implementation
 */

import { validateDependency, assertPresent } from '../../utils/dependencyUtils.js';
import { string } from '../../utils/validationCore.js';

/**
 * One-step greedy planner (foundation for future A* planner)
 *
 * Note: goalManager is included as a dependency for future use in Tier 2+.
 * In Tier 1, goal satisfaction checking is handled by the caller (GoapDecisionProvider).
 */
class SimplePlanner {
  #logger;
  #actionSelector;
  // Reserved for future Tier 2+ implementation
  // eslint-disable-next-line no-unused-private-class-members
  #goalManager;

  /**
   * Simple one-step planner for GOAP
   *
   * @param {object} params - Dependencies
   * @param {object} params.logger - Logger instance
   * @param {object} params.actionSelector - Action selector service
   * @param {object} params.goalManager - Goal manager service (reserved for Tier 2+)
   */
  constructor({ logger, actionSelector, goalManager }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug']
    });
    validateDependency(actionSelector, 'IActionSelector', logger, {
      requiredMethods: ['selectAction', 'calculateProgress']
    });
    validateDependency(goalManager, 'IGoalManager', logger, {
      requiredMethods: ['isGoalSatisfied']
    });

    this.#logger = logger;
    this.#actionSelector = actionSelector;
    this.#goalManager = goalManager;
  }

  /**
   * Finds best single action to move toward goal
   *
   * @param {object} goal - Selected goal
   * @param {Array<object>} availableActions - Actions from discovery
   * @param {string} actorId - Entity ID of actor
   * @param {object} context - World state context
   *   Expected structure (built by caller from EntityManager):
   *   {
   *     entities: { [entityId]: { components: { [componentId]: data } } },
   *     targetId: optional target entity ID,
   *     tertiaryTargetId: optional tertiary target entity ID
   *   }
   * @returns {object|null} Best action or null
   */
  plan(goal, availableActions, actorId, context) {
    assertPresent(goal, 'Goal is required');
    assertPresent(availableActions, 'Available actions required');
    string.assertNonBlank(actorId, 'actorId', 'plan', this.#logger);

    this.#logger.debug(`Planning for goal ${goal.id} with ${availableActions.length} actions`);

    try {
      // Use action selector to pick best action
      const selectedAction = this.#actionSelector.selectAction(
        availableActions,
        goal,
        actorId,
        context
      );

      if (!selectedAction) {
        this.#logger.debug(`No action selected for goal ${goal.id}`);
        return null;
      }

      this.#logger.info(`Planned action ${selectedAction.id} for goal ${goal.id}`);
      return selectedAction;
    } catch (error) {
      this.#logger.error(`Failed to plan for goal ${goal.id}`, error);
      return null;
    }
  }

  /**
   * Creates a plan object with single action
   *
   * @param {object} action - Selected action
   * @param {object} goal - Goal being pursued
   * @returns {object} Plan object
   */
  createPlan(action, goal) {
    assertPresent(action, 'Action is required');
    assertPresent(goal, 'Goal is required');

    const plan = {
      goalId: goal.id,
      steps: [
        {
          actionId: action.id,
          targetId: action.targetId || null,
          tertiaryTargetId: action.tertiaryTargetId || null,
          reasoning: this.#generateReasoning(action, goal)
        }
      ],
      createdAt: Date.now(),
      validUntil: null // No expiration for simple planner
    };

    this.#logger.debug(`Created plan: ${JSON.stringify(plan)}`);
    return plan;
  }

  /**
   * Validates if plan is still applicable
   *
   * @param {object} plan - Plan object
   * @param {object} context - Current world state (same structure as plan() context)
   * @returns {boolean} True if plan valid
   */
  validatePlan(plan, context) {
    assertPresent(plan, 'Plan is required');
    assertPresent(context, 'Context is required');

    try {
      // For simple planner, minimal validation
      // More sophisticated validation in Tier 2

      // Check if plan expired (if expiration set)
      if (plan.validUntil && Date.now() > plan.validUntil) {
        this.#logger.debug('Plan expired');
        return false;
      }

      // Check if plan has steps
      if (!plan.steps || plan.steps.length === 0) {
        this.#logger.debug('Plan has no steps');
        return false;
      }

      // Plan is valid
      return true;
    } catch (error) {
      this.#logger.error('Failed to validate plan', error);
      return false;
    }
  }

  // Private helper methods

  #generateReasoning(action, goal) {
    // Generate human-readable reasoning for plan
    const effectCount = action.planningEffects?.effects?.length || 0;
    return `Action ${action.id} has ${effectCount} effects that move toward goal ${goal.id}`;
  }
}

export default SimplePlanner;
