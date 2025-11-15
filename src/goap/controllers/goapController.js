/**
 * @file GoapController - Orchestrates complete GOAP decision cycle
 * @see specs/goap-system-specs.md lines 164-195
 * @see tickets/GOAPIMPL-021-goap-controller.md
 */

import {
  validateDependency,
  assertPresent,
  assertNonBlankString,
} from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';

/**
 * @typedef {import('../planner/goapPlanner.js').default} GoapPlanner
 * @typedef {import('../refinement/refinementEngine.js').default} RefinementEngine
 * @typedef {import('../planner/planInvalidationDetector.js').default} PlanInvalidationDetector
 * @typedef {import('../services/contextAssemblyService.js').default} ContextAssemblyService
 * @typedef {import('../../logic/jsonLogicEvaluationService.js').default} JsonLogicEvaluationService
 * @typedef {import('../../interfaces/IDataRegistry.js').IDataRegistry} IDataRegistry
 * @typedef {import('../../interfaces/IEventBus.js').IEventBus} IEventBus
 * @typedef {import('../../logging/logger.js').default} Logger
 */

/**
 * Orchestrates the complete GOAP decision cycle for an actor.
 *
 * Flow: goal selection → planning → plan validation → task refinement → action hint extraction
 *
 * Returns action hints (not executable actions) for GoapDecisionProvider to resolve
 * through the standard turn system action discovery pipeline.
 */
class GoapController {
  /** @type {GoapPlanner} */
  // eslint-disable-next-line no-unused-private-class-members -- Will be used in GOAPIMPL-021-02
  #planner;

  /** @type {RefinementEngine} */
  // eslint-disable-next-line no-unused-private-class-members -- Will be used in GOAPIMPL-021-04
  #refinementEngine;

  /** @type {PlanInvalidationDetector} */
  // eslint-disable-next-line no-unused-private-class-members -- Will be used in GOAPIMPL-021-03
  #invalidationDetector;

  /** @type {ContextAssemblyService} */
  // eslint-disable-next-line no-unused-private-class-members -- Will be used in GOAPIMPL-021-02
  #contextAssemblyService;

  /** @type {JsonLogicEvaluationService} */
  #jsonLogicService;

  /** @type {IDataRegistry} */
  #dataRegistry;

  /** @type {IEventBus} */
  // eslint-disable-next-line no-unused-private-class-members -- Will be used in GOAPIMPL-021-05, GOAPIMPL-021-06
  #eventBus;

  /** @type {Logger} */
  #logger;

  /** @type {object|null} Active plan with goal, tasks, and current step */
  // eslint-disable-next-line no-unused-private-class-members -- Will be used in GOAPIMPL-021-03
  #activePlan;

  /**
   * Create new GOAP controller instance
   *
   * @param {object} deps - Dependencies
   * @param {GoapPlanner} deps.goapPlanner - GOAP planner (note: token is IGoapPlanner)
   * @param {RefinementEngine} deps.refinementEngine - Refinement engine
   * @param {PlanInvalidationDetector} deps.planInvalidationDetector - Plan invalidation detector
   * @param {ContextAssemblyService} deps.contextAssemblyService - Context assembly service
   * @param {JsonLogicEvaluationService} deps.jsonLogicService - JSON Logic evaluation service
   * @param {IDataRegistry} deps.dataRegistry - Data registry for goals and tasks
   * @param {IEventBus} deps.eventBus - Event bus
   * @param {Logger} deps.logger - Logger instance
   */
  constructor({
    goapPlanner,
    refinementEngine,
    planInvalidationDetector,
    contextAssemblyService,
    jsonLogicService,
    dataRegistry,
    eventBus,
    logger,
  }) {
    this.#logger = ensureValidLogger(logger);

    validateDependency(goapPlanner, 'IGoapPlanner', this.#logger, {
      requiredMethods: ['plan'],
    });
    validateDependency(refinementEngine, 'IRefinementEngine', this.#logger, {
      requiredMethods: ['refine'],
    });
    validateDependency(
      planInvalidationDetector,
      'IPlanInvalidationDetector',
      this.#logger,
      {
        requiredMethods: ['checkPlanValidity'],
      }
    );
    validateDependency(
      contextAssemblyService,
      'IContextAssemblyService',
      this.#logger,
      {
        requiredMethods: ['assemblePlanningContext'],
      }
    );
    validateDependency(jsonLogicService, 'JsonLogicEvaluationService', this.#logger, {
      requiredMethods: ['evaluate'],
    });
    validateDependency(dataRegistry, 'IDataRegistry', this.#logger, {
      requiredMethods: ['getAll', 'get'],
    });
    validateDependency(eventBus, 'IEventBus', this.#logger, {
      requiredMethods: ['dispatch'],
    });

    this.#planner = goapPlanner;
    this.#refinementEngine = refinementEngine;
    this.#invalidationDetector = planInvalidationDetector;
    this.#contextAssemblyService = contextAssemblyService;
    this.#jsonLogicService = jsonLogicService;
    this.#dataRegistry = dataRegistry;
    this.#eventBus = eventBus;
    this.#activePlan = null;

    this.#logger.info('GoapController initialized');
  }

  /**
   * Execute one GOAP decision cycle for an actor
   *
   * Returns an action hint (action reference + target bindings) for the
   * GoapDecisionProvider to resolve through standard action discovery.
   * Does NOT execute actions directly.
   *
   * @param {object} actor - Actor entity making decision
   * @param {string} actor.id - Actor entity ID
   * @param {object} world - Current world state (structure TBD)
   * @returns {Promise<object|null>} Action hint { actionHint: { actionId, targetBindings } } or null
   */
  async decideTurn(actor, world) {
    assertPresent(actor, 'Actor is required');
    assertNonBlankString(actor.id, 'Actor ID', 'decideTurn', this.#logger);
    assertPresent(world, 'World is required');

    // Stub - will be implemented in subsequent tickets
    this.#logger.debug('GOAP decideTurn called', { actorId: actor.id });
    return null;
  }

  /**
   * Select highest priority relevant goal from goal registry
   *
   * @param {object} actor - Actor entity
   * @param {object} world - World state
   * @returns {object|null} Selected goal or null
   * @private
   */
  #selectGoal(actor, world) {
    // Get all registered goals (from mods, not actor component)
    const allGoals = this.#dataRegistry.getAll('goals');

    if (!allGoals || allGoals.length === 0) {
      this.#logger.debug('No goals registered in system', { actorId: actor.id });
      return null;
    }

    // Build context for relevance evaluation
    const context = this.#contextAssemblyService.assemblePlanningContext(actor.id);

    // Add world state to context
    const evaluationContext = {
      ...context,
      world: world,
    };

    // Filter to only relevant goals
    const relevantGoals = allGoals.filter((goal) =>
      this.#isGoalRelevant(goal, evaluationContext)
    );

    if (relevantGoals.length === 0) {
      this.#logger.debug('No relevant goals for actor', {
        actorId: actor.id,
        totalGoals: allGoals.length,
      });
      return null;
    }

    // Sort by priority (descending - higher priority first)
    const sortedGoals = [...relevantGoals].sort((a, b) => b.priority - a.priority);

    const selectedGoal = sortedGoals[0];

    this.#logger.info('Goal selected', {
      actorId: actor.id,
      goalId: selectedGoal.id,
      priority: selectedGoal.priority,
      relevantCount: relevantGoals.length,
      totalCount: allGoals.length,
    });

    return selectedGoal;
  }

  /**
   * Check if goal relevance condition is satisfied
   *
   * NOTE: This checks RELEVANCE, not GOAL SATISFACTION.
   * - Relevance: "Is this goal applicable right now?" (e.g., low health → healing goal is relevant)
   * - Goal Satisfaction: "Has the goal been achieved?" (checked by planner against goalState)
   *
   * @param {object} goal - Goal to check
   * @param {object} context - Evaluation context (actor + world state)
   * @returns {boolean} True if goal is relevant
   * @private
   */
  #isGoalRelevant(goal, context) {
    if (!goal.relevance) {
      // No relevance condition = always relevant
      this.#logger.debug('Goal has no relevance condition, treating as always relevant', {
        goalId: goal.id,
      });
      return true;
    }

    try {
      // Evaluate relevance condition using JSON Logic service
      // The context contains actor and world state assembled by ContextAssemblyService
      const result = this.#jsonLogicService.evaluate(goal.relevance, context);

      this.#logger.debug('Goal relevance evaluated', {
        goalId: goal.id,
        relevant: Boolean(result),
      });

      return Boolean(result);
    } catch (err) {
      this.#logger.error('Goal relevance evaluation failed', {
        goalId: goal.id,
        error: err.message,
        relevanceCondition: goal.relevance,
      });
      // Treat evaluation errors as not relevant (fail-safe)
      return false;
    }
  }

  /**
   * Validate current active plan against world state
   * To be implemented in GOAPIMPL-021-03 (Plan State Management)
   *
   * @param {object} _world - Current world state
   * @returns {object} Validation result { valid: boolean, ... }
   * @private
   */
  // eslint-disable-next-line no-unused-private-class-members
  #validateActivePlan(_world) {
    // Call planInvalidationDetector.checkPlanValidity()
    return { valid: true };
  }

  /**
   * Advance plan to next step
   * To be implemented in GOAPIMPL-021-03 (Plan State Management)
   *
   * @private
   */
  // eslint-disable-next-line no-unused-private-class-members
  #advancePlan() {
    // Increment activePlan.currentStep
    // Clear activePlan if plan complete
  }

  /**
   * Clear the active plan
   * To be implemented in GOAPIMPL-021-03 (Plan State Management)
   *
   * @private
   */
  // eslint-disable-next-line no-unused-private-class-members
  #clearPlan() {
    this.#activePlan = null;
    this.#logger.debug('Plan cleared');
  }

  /**
   * Extract action hint from refinement step results
   * To be implemented in GOAPIMPL-021-04 (Action Hint Extraction)
   *
   * @param {object} _stepResults - Refinement step results
   * @returns {object|null} Action hint or null
   * @private
   */
  // eslint-disable-next-line no-unused-private-class-members
  #extractActionHint(_stepResults) {
    // Extract actionRef and targetBindings from first step result
    // Return { actionHint: { actionId, targetBindings } }
    return null;
  }

  /**
   * Handle planning failure for a goal
   * To be implemented in GOAPIMPL-021-05 (Failure Handling)
   *
   * @param {object} _goal - Goal that failed to plan
   * @returns {null} Returns null to idle this turn
   * @private
   */
  // eslint-disable-next-line no-unused-private-class-members
  #handlePlanningFailure(_goal) {
    // Dispatch GOAP_PLANNING_FAILED event
    // Return null (idle this turn)
    return null;
  }

  /**
   * Handle refinement failure for a task
   * To be implemented in GOAPIMPL-021-05 (Failure Handling)
   *
   * @param {object} _task - Task that failed to refine
   * @param {object} _refinementResult - Refinement result with failure info
   * @returns {null} Returns null based on fallback behavior
   * @private
   */
  // eslint-disable-next-line no-unused-private-class-members
  #handleRefinementFailure(_task, _refinementResult) {
    // Check refinementResult.fallbackBehavior
    // Handle: 'replan' | 'continue' | 'fail'
    return null;
  }
}

export default GoapController;
