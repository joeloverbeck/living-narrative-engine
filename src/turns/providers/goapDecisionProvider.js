/**
 * @file GOAP decision provider for non-sentient actors
 * Uses goal-oriented action planning for creature AI
 */

import { DelegatingDecisionProvider } from './delegatingDecisionProvider.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

/** @typedef {import('./delegatingDecisionProvider.js').DecisionDelegate} DecisionDelegate */

/**
 * Decision provider using GOAP (Goal-Oriented Action Planning).
 * Implements goal-oriented decision making for non-sentient actors using planning.
 *
 * @augments DelegatingDecisionProvider
 */
export class GoapDecisionProvider extends DelegatingDecisionProvider {
  #goalManager;
  #simplePlanner;
  #planCache;
  #entityManager;
  #logger;

  /**
   * Creates a new GoapDecisionProvider
   *
   * @param {object} params - Dependencies
   * @param {object} params.goalManager - Goal manager service (IGoalManager from goapTokens)
   * @param {object} params.simplePlanner - Simple planner service (ISimplePlanner from goapTokens)
   * @param {object} params.planCache - Plan cache service (IPlanCache from goapTokens)
   * @param {object} params.entityManager - Entity manager (IEntityManager from coreTokens)
   * @param {object} params.logger - Logger instance
   * @param {object} params.safeEventDispatcher - Safe event dispatcher
   */
  constructor({
    goalManager,
    simplePlanner,
    planCache,
    entityManager,
    logger,
    safeEventDispatcher,
  }) {
    // Create delegate function for GOAP decision logic
    const delegate = async (actor, turnContext, actions) => {
      return this.#decideActionInternal(actor, turnContext, actions);
    };

    super({ delegate, logger, safeEventDispatcher });

    validateDependency(goalManager, 'IGoalManager', logger, {
      requiredMethods: ['selectGoal', 'isGoalSatisfied'],
    });
    validateDependency(simplePlanner, 'ISimplePlanner', logger, {
      requiredMethods: ['plan', 'validatePlan', 'createPlan'],
    });
    validateDependency(planCache, 'IPlanCache', logger, {
      requiredMethods: ['get', 'set', 'invalidate'],
    });
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getEntityInstance', 'hasComponent', 'getComponentData'],
    });

    this.#goalManager = goalManager;
    this.#simplePlanner = simplePlanner;
    this.#planCache = planCache;
    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  /**
   * Internal decision logic for GOAP agent
   *
   * @param {object} actor - Actor entity object
   * @param {object} turnContext - Turn context from turn system
   * @param {Array<ActionComposite>} actions - Available actions (ActionComposite array with index, actionId, params, etc.)
   * @returns {Promise<object>} Decision result { index: number|null, speech?: string, thoughts?: string, notes?: Array }
   * @private
   */
  async #decideActionInternal(actor, turnContext, actions) {
    const actorId = actor.id;

    this.#logger.debug(`GOAP decision for ${actorId} with ${actions.length} actions`);

    // Step 1: Validate input
    if (!Array.isArray(actions) || actions.length === 0) {
      this.#logger.debug(`No actions available for ${actorId}`);
      return { index: null };
    }

    // Step 2: Build planning context from turn context
    // SimplePlanner expects: { entities: { [id]: { components: {...} } } }
    const planningContext = this.#buildPlanningContext(actor, actions, turnContext);

    // Step 3: Check cached plan
    let plan = this.#planCache.get(actorId);

    // Step 4: Validate cached plan
    if (plan && !this.#simplePlanner.validatePlan(plan, planningContext)) {
      this.#logger.debug(`Cached plan for ${actorId} invalid, replanning`);
      this.#planCache.invalidate(actorId);
      plan = null;
    }

    // Step 5: If no valid plan, create new one
    if (!plan) {
      // Select goal
      const goal = this.#goalManager.selectGoal(actorId, planningContext);

      if (!goal) {
        this.#logger.debug(`No relevant goal for ${actorId}, no action`);
        return { index: null };
      }

      // Check if goal already satisfied
      if (this.#goalManager.isGoalSatisfied(goal, actorId, planningContext)) {
        this.#logger.debug(`Goal ${goal.id} already satisfied for ${actorId}`);
        return { index: null };
      }

      // Plan action - SimplePlanner.plan() takes ActionComposite array directly
      // ActionSelector will filter for actions with planningEffects internally
      const selectedAction = this.#simplePlanner.plan(
        goal,
        actions, // Pass ActionComposite array directly
        actorId,
        planningContext
      );

      if (!selectedAction) {
        this.#logger.debug(`No action found for goal ${goal.id}`);
        return { index: null };
      }

      // Create and cache plan (two-step process)
      plan = this.#simplePlanner.createPlan(selectedAction, goal);
      this.#planCache.set(actorId, plan);
    }

    // Step 6: Execute first step of plan
    const step = plan.steps[0];

    // Find action in ActionComposite array by actionId and targetId
    // ActionComposite structure: { index, actionId, params: { targetId, ... }, ... }
    const actionMatch = actions.find(
      (a) =>
        a.actionId === step.actionId && a.params.targetId === step.targetId
    );

    if (!actionMatch) {
      this.#logger.warn(
        `Planned action ${step.actionId} not in available actions`
      );
      this.#planCache.invalidate(actorId);
      return { index: null };
    }

    this.#logger.info(
      `Actor ${actorId} executing ${step.actionId} for goal ${plan.goalId}`
    );

    // Return full decision structure expected by DelegatingDecisionProvider
    return {
      index: actionMatch.index,
      speech: null,
      thoughts: null,
      notes: null,
    };
  }

  /**
   * Builds planning context structure from turn context and entity manager
   * SimplePlanner/ActionSelector expect: { entities: { [id]: { components: {...} } } }
   *
   * @param {object} actor - Actor entity
   * @param {Array<ActionComposite>} actions - Available actions
   * @param {object} turnContext - Turn context
   * @returns {object} Planning context for SimplePlanner/ActionSelector
   * @private
   */
  #buildPlanningContext(actor, actions, turnContext) {
    const context = {
      entities: {},
      // Include turn context data for goal evaluation
      game: turnContext?.game || {},
    };

    // Add actor to context
    const actorEntity = this.#entityManager.getEntityInstance(actor.id);
    if (actorEntity) {
      context.entities[actor.id] = {
        components: actorEntity.getAllComponents(),
      };
    }

    // Add all entities referenced in actions (targets, tertiary targets)
    const entityIds = new Set();
    for (const action of actions) {
      if (action.params.targetId) {
        entityIds.add(action.params.targetId);
      }
      if (action.params.tertiaryTargetId) {
        entityIds.add(action.params.tertiaryTargetId);
      }
    }

    // Populate entities in context
    for (const entityId of entityIds) {
      const entity = this.#entityManager.getEntityInstance(entityId);
      if (entity) {
        context.entities[entityId] = {
          components: entity.getAllComponents(),
        };
      }
    }

    return context;
  }
}

export default GoapDecisionProvider;
