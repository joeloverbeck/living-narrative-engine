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
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';
import { GOAP_EVENTS } from '../events/goapEvents.js';
import { emitGoapEvent } from '../events/goapEventFactory.js';
import {
  GOAP_PLANNER_CONTRACT,
  createPlannerContractSnapshot,
} from '../planner/goapPlannerContractDefinition.js';
import {
  registerPlanningStateDiagnosticsEventBus,
  getPlanningStateDiagnostics as getPlanningStateDiagnosticsSnapshot,
} from '../planner/planningStateDiagnostics.js';
import { GOAP_DEBUGGER_DIAGNOSTICS_CONTRACT } from '../debug/goapDebuggerDiagnosticsContract.js';
import { createGoapEventDispatcher } from '../debug/goapEventDispatcher.js';

export const GOAP_CONTROLLER_DIAGNOSTICS_CONTRACT_VERSION =
  GOAP_DEBUGGER_DIAGNOSTICS_CONTRACT.version;

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
   
  #planner;

  /** @type {RefinementEngine} */
   
  #refinementEngine;

  /** @type {PlanInvalidationDetector} */
   
  #invalidationDetector;

  /** @type {ContextAssemblyService} */
   
  #contextAssemblyService;

  /** @type {JsonLogicEvaluationService} */
  #jsonLogicService;

  /** @type {IDataRegistry} */
  #dataRegistry;

  /** @type {IEventBus} */
  #eventDispatcher;

  /** @type {IParameterResolutionService} */
  #parameterResolutionService;

  /** @type {Logger} */
  #logger;

  /** @type {object|null} Active plan with goal, tasks, and current step */
   
  #activePlan;

  /** @type {Map<string, Array<{reason: string, timestamp: number}>>} Failed goals tracking */
  #failedGoals;

  /** @type {Map<string, Array<{reason: string, timestamp: number}>>} Failed tasks tracking */
  #failedTasks;

  /** @type {number} Recursion depth for 'continue' fallback strategy */
  #recursionDepth;

  /** @type {string|null} Current actor ID for recursive decideTurn calls */
  #currentActor;

  /** @type {object|null} Current world state for recursive decideTurn calls */
  #currentWorld;

  /** @type {Map<string, object>} Dependency diagnostics keyed by dependency token */
  #dependencyDiagnostics;

  /** @type {Map<string, object>} Task library diagnostics keyed by actorId */
  #taskLibraryDiagnostics;

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
   * @param {IParameterResolutionService} deps.parameterResolutionService - Parameter resolution service
   */
  constructor({
    goapPlanner,
    refinementEngine,
    planInvalidationDetector,
    contextAssemblyService,
    jsonLogicService,
    jsonLogicEvaluationService,
    dataRegistry,
    eventBus,
    goapEventDispatcher,
    logger,
    parameterResolutionService,
  }) {
    this.#logger = ensureValidLogger(logger);

    validateDependency(
      goapPlanner,
      GOAP_PLANNER_CONTRACT.dependencyName,
      this.#logger,
      {
        requiredMethods: GOAP_PLANNER_CONTRACT.requiredMethods,
      }
    );
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
    const logicService = jsonLogicService ?? jsonLogicEvaluationService;

    validateDependency(logicService, 'JsonLogicEvaluationService', this.#logger, {
      requiredMethods: ['evaluate'],
    });
    validateDependency(dataRegistry, 'IDataRegistry', this.#logger, {
      requiredMethods: ['getAll', 'get'],
    });
    if (goapEventDispatcher) {
      validateDependency(goapEventDispatcher, 'IGoapEventDispatcher', this.#logger, {
        requiredMethods: ['dispatch', 'getComplianceSnapshot', 'getComplianceForActor'],
      });
    } else {
      validateDependency(eventBus, 'IEventBus', this.#logger, {
        requiredMethods: ['dispatch'],
      });
    }
    validateDependency(parameterResolutionService, 'IParameterResolutionService', this.#logger, {
      requiredMethods: ['resolve'],
    });

    this.#planner = goapPlanner;
    this.#refinementEngine = refinementEngine;
    this.#invalidationDetector = planInvalidationDetector;
    this.#contextAssemblyService = contextAssemblyService;
    this.#jsonLogicService = logicService;
    this.#dataRegistry = dataRegistry;
    this.#eventDispatcher =
      goapEventDispatcher ?? createGoapEventDispatcher(eventBus, this.#logger);
    this.#parameterResolutionService = parameterResolutionService;
    this.#activePlan = null;
    this.#dependencyDiagnostics = new Map();
    this.#taskLibraryDiagnostics = new Map();

    // Initialize failure tracking (GOAPIMPL-021-05)
    this.#failedGoals = new Map();
    this.#failedTasks = new Map();
    this.#recursionDepth = 0;
    this.#currentActor = null;
    this.#currentWorld = null;

    this.#logger.info('GoapController initialized');

    this.#recordDependencyDiagnostics(
      createPlannerContractSnapshot(this.#planner)
    );

    registerPlanningStateDiagnosticsEventBus(this.#eventDispatcher);
  }

  /**
   * Dispatch GOAP lifecycle event
   *
   * ISafeEventDispatcher handles errors internally, so no try-catch needed.
   * Events use 'goap:event_name' namespace pattern.
   *
   * @param {string} eventType - Event type from GOAP_EVENTS
   * @param {object} payload - Event payload (NO timestamp - handled by EventBus)
   * @private
   */
  #dispatchEvent(eventType, payload = {}, context) {
    emitGoapEvent(this.#eventDispatcher, eventType, payload, context);

    this.#logger.debug('GOAP event dispatched', {
      eventType,
      payload,
      context,
    });
  }

  /**
   * Capture task library diagnostics from the planner for the active actor.
   *
   * @param {string} actorId - Actor identifier
   * @private
   */
  #captureTaskLibraryDiagnostics(actorId) {
    if (
      !actorId ||
      typeof this.#planner.getTaskLibraryDiagnostics !== 'function'
    ) {
      return;
    }

    const diagnostics = this.#planner.getTaskLibraryDiagnostics();
    if (!diagnostics) {
      return;
    }

    this.#taskLibraryDiagnostics.set(actorId, {
      ...diagnostics,
      timestamp: Date.now(),
    });
  }

  /**
   * Record dependency diagnostics for debugger + telemetry.
   * @param {object} snapshot - Output of createPlannerContractSnapshot
   */
  #recordDependencyDiagnostics(snapshot) {
    if (!snapshot || !snapshot.dependency) {
      return;
    }

    const enriched = {
      ...snapshot,
      timestamp: Date.now(),
      status:
        Array.isArray(snapshot.missingMethods) && snapshot.missingMethods.length > 0
          ? 'warn'
          : 'ok',
    };

    this.#dependencyDiagnostics.set(snapshot.dependency, enriched);

    this.#dispatchEvent(GOAP_EVENTS.DEPENDENCY_VALIDATED, enriched);

    if (enriched.status === 'warn') {
      this.#logger.warn('GOAP_DEPENDENCY_WARN: Missing dependency methods', enriched);
    } else {
      this.#logger.debug('GOAP dependency validated', enriched);
    }
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

    // Store current actor/world for recursive decideTurn calls (GOAPIMPL-021-05)
    // Only reset recursion depth on top-level calls (not recursive calls)
    if (this.#recursionDepth === 0) {
      this.#currentActor = actor.id;
      this.#currentWorld = world;
    }

    // 1. Check if we have active plan
    if (this.#activePlan) {
      // 2. Validate plan still applicable
      const validation = this.#validateActivePlan(world);

      if (!validation.valid) {
        // 3. Plan invalidated → clear and replan
        // Dispatch replanning started event
        this.#dispatchEvent(
          GOAP_EVENTS.REPLANNING_STARTED,
          {
            goalId: this.#activePlan.goal.id,
            previousStep: this.#activePlan.currentStep,
          },
          {
            actorId: actor.id,
            goalId: this.#activePlan.goal.id,
          }
        );

        this.#clearPlan(`Invalidated: ${validation.reason}`);

        // Will trigger replanning in next iteration
      }
    }

    // 4. Need new plan?
    if (!this.#activePlan) {
      // 5. Select goal (implemented in GOAPIMPL-021-02)
      const goal = this.#selectGoal(actor, world);

      if (!goal) {
        this.#logger.debug('No goals to pursue', { actorId: actor.id });
        return null; // No goals → idle
      }

      // 6. Plan to achieve goal
      // Dispatch planning started event
      this.#dispatchEvent(
        GOAP_EVENTS.PLANNING_STARTED,
        {
          actorId: actor.id,
          goalId: goal.id,
        },
        {
          actorId: actor.id,
          goalId: goal.id,
        }
      );

      // Extract state hash from world object
      const initialState = world.state || world;
      let planResult;
      try {
        planResult = this.#planner.plan(
          actor.id, // actorId string, not actor object
          goal,
          initialState, // symbolic state hash
          {} // options
        );
      } catch (error) {
        this.#captureTaskLibraryDiagnostics(actor.id);
        if (
          error?.code === 'GOAP_SETUP_MISSING_ACTOR' ||
          error?.code === GOAP_PLANNER_FAILURES.INVALID_EFFECT_DEFINITION
        ) {
          return this.#handlePlanningFailure(goal, {
            code: error.code,
            reason: error.message,
          });
        }
        throw error;
      }

      this.#captureTaskLibraryDiagnostics(actor.id);

      if (!planResult || !planResult.tasks) {
        // 7. Planning failed → handle failure (GOAPIMPL-021-05)
        const plannerFailure =
          typeof this.#planner.getLastFailure === 'function'
            ? this.#planner.getLastFailure()
            : null;
        return this.#handlePlanningFailure(goal, plannerFailure);
      }

      // Dispatch planning completed event
      this.#dispatchEvent(
        GOAP_EVENTS.PLANNING_COMPLETED,
        {
          actorId: actor.id,
          goalId: goal.id,
          planLength: planResult.tasks.length,
          tasks: planResult.tasks.map((t) => t.taskId),
        },
        {
          actorId: actor.id,
          goalId: goal.id,
        }
      );

      if (planResult.tasks.length === 0) {
        this.#logger.info('Planner returned empty plan (goal already satisfied)', {
          actorId: actor.id,
          goalId: goal.id,
        });
        return null;
      }

      // 8. Create and store plan
      this.#activePlan = this.#createPlan(goal, planResult.tasks, actor.id);
    }

    // 9. Get current task
    const task = this.#getCurrentTask();

    if (!task) {
      // Plan exhausted but still active → shouldn't happen
      this.#logger.error('Active plan has no current task', {
        plan: this.#activePlan,
      });
      this.#clearPlan('No current task');
      return null;
    }

    // 10. Refine task to step results
    const refinementResult = await this.#refineTask(task, actor);

    // 11. Check replan flag FIRST (before success check)
    if (refinementResult.replan) {
      this.#logger.info('Refinement requested replan', {
        taskId: task.taskId,
        reason: refinementResult.error,
      });
      this.#clearPlan('Refinement requested replan');
      return null; // Will trigger replanning next turn
    }

    // 12. Check skipped flag (task was optional and conditions not met)
    if (refinementResult.skipped) {
      this.#logger.info('Task skipped, advancing to next task', {
        taskId: task.taskId,
      });
      const planContinues = this.#advancePlan();
      if (!planContinues) {
        this.#clearPlan('Goal achieved (last task skipped)');
      }
      return null; // Retry next turn with next task
    }

    if (!refinementResult.success) {
      // 13. Refinement failed → handle failure (GOAPIMPL-021-05)
      return this.#handleRefinementFailure(task, refinementResult);
    }

    // Dispatch task refined event
    this.#dispatchEvent(
      GOAP_EVENTS.TASK_REFINED,
      {
        actorId: actor.id,
        taskId: task.taskId,
        stepsGenerated: refinementResult.stepResults?.length || 0,
        actionRefs: refinementResult.stepResults?.map((s) => s.actionRef) || [],
      },
      {
        actorId: actor.id,
        goalId: this.#activePlan?.goal?.id,
        taskId: task.taskId,
      }
    );

    // 14. Extract action hint from refinement result
    const actionHint = await this.#extractActionHint(refinementResult, task, actor);

    if (!actionHint) {
      this.#logger.error('Failed to extract action hint', {
        taskId: task.taskId,
        methodId: refinementResult.methodId,
      });
      return this.#handleRefinementFailure(task, refinementResult);
    }

    // 15. Advance plan for next turn
    const planContinues = this.#advancePlan();

    if (!planContinues) {
      // 16. Plan complete → clear plan (event already dispatched in #advancePlan)
      this.#clearPlan('Goal achieved');
    }

    // 17. Return action hint for GoapDecisionProvider
    return { actionHint };
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

    // Dispatch goal selected event
    this.#dispatchEvent(
      GOAP_EVENTS.GOAL_SELECTED,
      {
        actorId: actor.id,
        goalId: selectedGoal.id,
        priority: selectedGoal.priority,
      },
      {
        actorId: actor.id,
        goalId: selectedGoal.id,
      }
    );

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
   
  /**
   * Create new plan from goal and planner result
   *
   * @param {object} goal - Goal to achieve
   * @param {Array<object>} tasks - Tasks from planner
   * @param {string} actorId - Actor entity ID (REQUIRED for validation)
   * @returns {object} Active plan structure
   * @private
   */
  #createPlan(goal, tasks, actorId) {
    assertPresent(goal, 'Goal is required');
    assertPresent(tasks, 'Tasks are required');
    assertNonBlankString(actorId, 'Actor ID', '#createPlan', this.#logger);

    if (!Array.isArray(tasks) || tasks.length === 0) {
      throw new InvalidArgumentError('Tasks must be non-empty array');
    }

    const plan = {
      goal: goal,
      tasks: tasks,
      currentStep: 0,
      actorId: actorId,
      createdAt: Date.now(),
      lastValidated: Date.now(),
    };

    this.#logger.info('Plan created', {
      goalId: goal.id,
      taskCount: tasks.length,
      actorId: actorId,
    });

    return plan;
  }

  /**
   * Get current task from active plan
   *
   * @returns {object|null} Current task or null if no plan
   * @private
   */
  #getCurrentTask() {
    if (!this.#activePlan) {
      return null;
    }

    if (this.#activePlan.currentStep >= this.#activePlan.tasks.length) {
      return null;
    }

    return this.#activePlan.tasks[this.#activePlan.currentStep];
  }

  /**
   * Validate current active plan against world state
   *
   * @param {object} world - Current world state (contains state hash)
   * @returns {object} Validation result { valid: boolean, invalidatedAt?, task?, reason?, diagnostics? }
   * @private
   */
   
  #validateActivePlan(world) {
    if (!this.#activePlan) {
      return { valid: false, reason: 'No active plan' };
    }

    // Extract state hash from world object
    // NOTE: World structure TBD - fallback if world IS the state
    const currentState = world.state || world;

    // Build context with required actorId
    const context = {
      actorId: this.#activePlan.actorId,
    };

    // Use plan invalidation detector with correct signature
    const validation = this.#invalidationDetector.checkPlanValidity(
      this.#activePlan, // Plan with tasks array
      currentState, // Symbolic state hash
      context, // { actorId: string }
      'strict' // Check all tasks
    );

    // Update validation timestamp if still valid
    if (validation.valid) {
      this.#activePlan.lastValidated = Date.now();
    } else {
      // Dispatch plan invalidated event
      this.#dispatchEvent(
        GOAP_EVENTS.PLAN_INVALIDATED,
        {
          goalId: this.#activePlan.goal.id,
          reason: validation.reason,
          currentStep: this.#activePlan.currentStep,
          totalSteps: this.#activePlan.tasks.length,
        },
        {
          actorId: this.#activePlan.actorId,
          goalId: this.#activePlan.goal.id,
        }
      );

      this.#logger.warn('Plan invalidated', {
        goalId: this.#activePlan.goal.id,
        invalidatedAt: validation.invalidatedAt,
        task: validation.task,
        reason: validation.reason,
        currentStep: this.#activePlan.currentStep,
      });
    }

    return validation;
  }

  /**
   * Advance plan to next step
   * To be implemented in GOAPIMPL-021-03 (Plan State Management)
   *
   * @private
   */
   
  /**
   * Advance plan to next task
   *
   * @returns {boolean} True if plan continues, false if complete
   * @private
   */
   
  #advancePlan() {
    if (!this.#activePlan) {
      throw new Error('Cannot advance: no active plan');
    }

    this.#activePlan.currentStep++;

    const isComplete =
      this.#activePlan.currentStep >= this.#activePlan.tasks.length;

    if (isComplete) {
      // Dispatch goal achieved event
      this.#dispatchEvent(
        GOAP_EVENTS.GOAL_ACHIEVED,
        {
          goalId: this.#activePlan.goal.id,
          totalSteps: this.#activePlan.tasks.length,
          duration: Date.now() - this.#activePlan.createdAt,
        },
        {
          actorId: this.#activePlan.actorId,
          goalId: this.#activePlan.goal.id,
        }
      );

      this.#logger.info('Plan completed', {
        goalId: this.#activePlan.goal.id,
        totalSteps: this.#activePlan.tasks.length,
      });
    } else {
      this.#logger.debug('Plan advanced', {
        goalId: this.#activePlan.goal.id,
        currentStep: this.#activePlan.currentStep,
        totalSteps: this.#activePlan.tasks.length,
      });
    }

    return !isComplete;
  }

  /**
   * Clear the active plan
   * To be implemented in GOAPIMPL-021-03 (Plan State Management)
   *
   * @private
   */
   
  /**
   * Clear the active plan
   *
   * @param {string} reason - Reason for clearing
   * @private
   */
   
  #clearPlan(reason) {
    if (!this.#activePlan) {
      return;
    }

    const goalId = this.#activePlan.goal.id;

    this.#logger.info('Plan cleared', {
      goalId,
      reason,
      stepsCompleted: this.#activePlan.currentStep,
      totalSteps: this.#activePlan.tasks.length,
    });

    this.#activePlan = null;
  }

  /**
   * Extract action hint from refinement step results
   * To be implemented in GOAPIMPL-021-04 (Action Hint Extraction)
   *
   * @param {object} _stepResults - Refinement step results
   * @returns {object|null} Action hint or null
   * @private
   */
   

  /**
   * Refine current task to executable step results
   * 
   * @param {object} task - Task from plan
   * @param {string} task.taskId - Task identifier
   * @param {object} task.params - Task parameters
   * @param {object} actor - Actor entity
   * @param {string} actor.id - Actor entity ID
   * @returns {Promise<object>} Refinement result with ALL fields:
   *   - success: boolean
   *   - stepResults: Array<object>
   *   - methodId: string
   *   - taskId: string
   *   - actorId: string
   *   - timestamp: number
   *   - replan?: boolean (critical for failure handling)
   *   - skipped?: boolean (handles optional tasks)
   *   - error?: string
   * @private
   */
  async #refineTask(task, actor) {
    assertPresent(task, 'Task is required');
    assertPresent(actor, 'Actor is required');
    assertNonBlankString(actor.id, 'Actor ID', '#refineTask', this.#logger);

    this.#logger.debug('Refining task', {
      taskId: task.taskId,
      actorId: actor.id,
      params: task.params,
    });

    // Call refinement engine
    const result = await this.#refinementEngine.refine(
      task.taskId,
      actor.id,
      task.params
    );

    // Log all returned fields for debugging
    this.#logger.debug('Refinement completed', {
      success: result.success,
      methodId: result.methodId,
      stepCount: result.stepResults?.length || 0,
      replan: result.replan,
      skipped: result.skipped,
      timestamp: result.timestamp,
    });

    return result;
  }

  /**
   * Resolve step bindings (placeholders like "task.params.item") to actual entity IDs
   * 
   * @param {object} stepBindings - Target bindings from refinement method step
   * @param {object} task - Task from plan
   * @param {object} actor - Actor entity
   * @returns {Promise<object>} Resolved bindings (placeholder values replaced with entity IDs)
   * @private
   */
  async #resolveStepBindings(stepBindings, task, actor) {
    assertPresent(stepBindings, 'Step bindings are required');
    assertPresent(task, 'Task is required');
    assertPresent(actor, 'Actor is required');

    // Build context for parameter resolution
    // Context structure matches what ParameterResolutionService expects
    const context = {
      task: {
        id: task.taskId,
        params: task.params || {},
      },
      actor: actor,
      refinement: {
        localState: {}, // Empty state for hint extraction (no prior step results)
      },
    };

    try {
      // Resolve placeholders to actual values
      const resolvedBindings = await this.#parameterResolutionService.resolve(
        stepBindings,
        context
      );

      this.#logger.debug('Step bindings resolved', {
        original: stepBindings,
        resolved: resolvedBindings,
      });

      return resolvedBindings;
    } catch (err) {
      this.#logger.error('Failed to resolve step bindings', {
        stepBindings,
        task: task.taskId,
        actor: actor.id,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Extract action hint from refinement result by re-resolving bindings
   * OPTION B: Fetches method definition and re-resolves bindings
   *
   * @param {object} refinementResult - Result from refinement engine
   * @param {object} task - Task from plan
   * @param {object} actor - Actor entity
   * @returns {Promise<object|null>} Action hint or null if extraction fails
   * @private
   */
  async #extractActionHint(refinementResult, task, actor) {
    assertPresent(refinementResult, 'Refinement result is required');
    assertPresent(task, 'Task is required');
    assertPresent(actor, 'Actor is required');

    if (!refinementResult.success) {
      this.#logger.warn('Refinement failed, cannot extract hint', {
        error: refinementResult.error,
      });
      return null;
    }

    // Get refinement method from registry
    const methodId = refinementResult.methodId;
    if (!methodId) {
      this.#logger.error('Refinement result missing methodId', {
        taskId: refinementResult.taskId,
      });
      return null;
    }

    const method = this.#dataRegistry.get('refinementMethod', methodId);

    if (!method || !method.steps || method.steps.length === 0) {
      this.#logger.error('Cannot find refinement method or first step', {
        methodId,
      });
      return null;
    }

    const firstMethodStep = method.steps[0];

    if (!firstMethodStep.actionId) {
      this.#logger.error('First method step has no actionId', {
        methodId,
        step: firstMethodStep,
      });
      return null;
    }

    // Re-resolve target bindings using parameter resolution service
    try {
      const resolvedBindings = await this.#resolveStepBindings(
        firstMethodStep.targetBindings || {},
        task,
        actor
      );

      const actionHint = {
        actionId: firstMethodStep.actionId,
        targetBindings: resolvedBindings,
      };

      // Dispatch action hint generated event
      this.#dispatchEvent(
        GOAP_EVENTS.ACTION_HINT_GENERATED,
        {
          actionId: actionHint.actionId,
          targetBindings: actionHint.targetBindings,
          taskId: task.taskId,
        },
        {
          actorId: actor.id,
          taskId: task.taskId,
          goalId: this.#activePlan?.goal?.id,
        }
      );

      this.#logger.info('Action hint extracted via re-resolution', {
        actionId: actionHint.actionId,
        bindings: actionHint.targetBindings,
      });

      return actionHint;
    } catch (err) {
      // Dispatch action hint failed event
      this.#dispatchEvent(
        GOAP_EVENTS.ACTION_HINT_FAILED,
        {
          actionId: firstMethodStep.actionId,
          bindings: firstMethodStep.targetBindings || {},
          reason: err.message || 'Failed to resolve bindings',
        },
        {
          actorId: actor.id,
          taskId: task.taskId,
          goalId: this.#activePlan?.goal?.id,
        }
      );

      // Error already logged by #resolveStepBindings()
      return null;
    }
  }

  /**
   * Track failed goal to prevent infinite retry loops
   *
   * @param {string} goalId - Goal ID that failed
   * @param {string} reason - Failure reason
   * @returns {boolean} True if max failures reached (≥3 recent attempts)
   * @private
   */
  #trackFailedGoal(goalId, reason, code = 'UNKNOWN_PLANNER_FAILURE') {
    const now = Date.now();
    const FAILURE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
    const MAX_FAILURES = 3;

    // Get or create failure history for this goal
    if (!this.#failedGoals.has(goalId)) {
      this.#failedGoals.set(goalId, []);
    }

    const failures = this.#failedGoals.get(goalId);

    // Prune old failures (older than 5 minutes)
    const recentFailures = failures.filter(
      (failure) => now - failure.timestamp < FAILURE_EXPIRY_MS
    );

    // Add new failure
    recentFailures.push({ reason, code, timestamp: now });

    // Update map with pruned + new failures
    this.#failedGoals.set(goalId, recentFailures);

    // Check if max failures reached
    if (recentFailures.length >= MAX_FAILURES) {
      this.#logger.error('Goal failed too many times', {
        goalId,
        failureCount: recentFailures.length,
        recentFailures: recentFailures.map((f) => f.reason),
      });
      return true;
    }

    this.#logger.warn('Goal failure tracked', {
      goalId,
      reason,
      code,
      failureCount: recentFailures.length,
    });

    return false;
  }

  /**
   * Track failed task to prevent infinite retry loops
   *
   * @param {string} taskId - Task ID that failed
   * @param {string} reason - Failure reason
   * @returns {boolean} True if max failures reached (≥3 recent attempts)
   * @private
   */
  #trackFailedTask(taskId, reason, code = 'TASK_FAILURE') {
    const now = Date.now();
    const FAILURE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
    const MAX_FAILURES = 3;

    // Get or create failure history for this task
    if (!this.#failedTasks.has(taskId)) {
      this.#failedTasks.set(taskId, []);
    }

    const failures = this.#failedTasks.get(taskId);

    // Prune old failures (older than 5 minutes)
    const recentFailures = failures.filter(
      (failure) => now - failure.timestamp < FAILURE_EXPIRY_MS
    );

    // Add new failure
    recentFailures.push({ reason, code, timestamp: now });

    // Update map with pruned + new failures
    this.#failedTasks.set(taskId, recentFailures);

    // Check if max failures reached
    if (recentFailures.length >= MAX_FAILURES) {
      this.#logger.error('Task failed too many times', {
        taskId,
        failureCount: recentFailures.length,
        recentFailures: recentFailures.map((f) => f.reason),
      });
      return true;
    }

    this.#logger.warn('Task failure tracked', {
      taskId,
      reason,
      code,
      failureCount: recentFailures.length,
    });

    return false;
  }

  /**
   * Handle planning failure for a goal
   *
   * Strategy: Track failure and return null to idle this turn.
   * Next turn will attempt to select a different goal or retry after expiry.
   *
   * @param {object} goal - Goal that failed to plan
   * @returns {null} Returns null to idle this turn
   * @private
   */
  #handlePlanningFailure(goal, failureInfo = null) {
    // Track failed goal with reason
    const reason = failureInfo?.reason || 'Planner returned no tasks';
    const failureCode = failureInfo?.code || 'UNKNOWN_PLANNER_FAILURE';
    this.#trackFailedGoal(goal.id, reason, failureCode);

    // Dispatch planning failed event
    this.#dispatchEvent(
      GOAP_EVENTS.PLANNING_FAILED,
      {
        actorId: this.#currentActor,
        goalId: goal.id,
        reason,
        code: failureCode,
      },
      {
        actorId: this.#currentActor,
        goalId: goal.id,
      }
    );

    // Log warning with goal details
    this.#logger.warn('Planning failed for goal', {
      goalId: goal.id,
      goalName: goal.name,
      reason,
      failureCode,
    });

    // Return null to idle this turn
    // Next turn will select different goal or retry after failure expiry
    return null;
  }

  /**
   * Handle refinement failure for a task
   *
   * Supports 4 fallback strategies:
   * - 'replan' (default): Clear plan, track goal failure, replan next turn
   * - 'continue': Skip failed task, advance plan, try next task (with recursion limit)
   * - 'fail': Clear plan, track goal as failed, return null
   * - 'idle': Clear plan, return null (no tracking)
   *
   * @param {object} task - Task that failed to refine
   * @param {object} refinementResult - Refinement result with failure info
   * @returns {Promise<object|null>} Action hint or null based on fallback behavior
   * @private
   */
  async #handleRefinementFailure(task, refinementResult) {
    const fallbackBehavior = refinementResult.fallbackBehavior || 'replan';
    const reason = refinementResult.error || 'Refinement failed';

    this.#logger.info('Handling refinement failure', {
      taskId: task.taskId,
      fallbackBehavior,
      reason,
      recursionDepth: this.#recursionDepth,
    });

    // Dispatch refinement failed event
    this.#dispatchEvent(
      GOAP_EVENTS.REFINEMENT_FAILED,
      {
        actorId: this.#currentActor,
        taskId: task.taskId,
        reason,
        fallbackBehavior,
      },
      {
        actorId: this.#currentActor,
        taskId: task.taskId,
        goalId: this.#activePlan?.goal?.id,
      }
    );

    switch (fallbackBehavior) {
      case 'replan': {
        // Default: Clear plan and track goal failure
        this.#trackFailedGoal(
          this.#activePlan.goal.id,
          `Task failed: ${reason}`,
          'REFINEMENT_FAILURE_REPLAN'
        );
        this.#clearPlan(`Refinement failed: ${reason}`);
        return null; // Will replan next turn
      }

      case 'continue': {
        // Skip failed task, advance to next task, retry decideTurn
        this.#trackFailedTask(task.taskId, reason, 'REFINEMENT_CONTINUE');

        // Check recursion depth limit
        if (this.#recursionDepth >= 10) {
          this.#logger.error('Recursion depth exceeded during continue fallback', {
            taskId: task.taskId,
            recursionDepth: this.#recursionDepth,
          });
          this.#clearPlan('Too many consecutive task failures');
          this.#recursionDepth = 0;
          return null;
        }

        // Advance to next task
        const planContinues = this.#advancePlan();

        if (!planContinues) {
          // No more tasks → goal achieved (all remaining tasks were skippable failures)
          this.#clearPlan('Goal achieved (remaining tasks failed but skippable)');
          this.#recursionDepth = 0;
          return null;
        }

        // Recursive call to try next task
        this.#recursionDepth++;
        const result = await this.decideTurn(
          { id: this.#currentActor },
          this.#currentWorld
        );
        this.#recursionDepth--;
        return result;
      }

      case 'fail': {
        // Critical failure → track goal and clear plan
        this.#trackFailedGoal(
          this.#activePlan.goal.id,
          `Task failed critically: ${reason}`,
          'REFINEMENT_FAILURE_CRITICAL'
        );
        this.#trackFailedTask(task.taskId, reason, 'REFINEMENT_FAILURE_CRITICAL');
        this.#clearPlan(`Critical task failure: ${reason}`);
        return null;
      }

      case 'idle': {
        // Just clear plan without tracking (transient failure)
        this.#clearPlan(`Temporary task failure: ${reason}`);
        return null;
      }

      default: {
        // Unknown fallback behavior → treat as 'replan'
        this.#logger.warn('Unknown fallback behavior, treating as replan', {
          fallbackBehavior,
          taskId: task.taskId,
        });
        this.#trackFailedGoal(
          this.#activePlan.goal.id,
          `Task failed: ${reason}`,
          'REFINEMENT_FAILURE_UNKNOWN'
        );
        this.#clearPlan(`Refinement failed: ${reason}`);
        return null;
      }
    }
  }

  // ==================== Debug API (Read-Only) ====================

  /**
   * Get the active plan for an actor (debug API).
   *
   * @param {string} actorId - Entity ID of actor
   * @returns {object|null} Deep copy of active plan or null if no plan exists
   */
  getActivePlan(actorId) {
    assertNonBlankString(actorId, 'actorId', 'GoapController.getActivePlan', this.#logger);

    if (!this.#activePlan || this.#activePlan.actorId !== actorId) {
      return null;
    }

    // Return deep copy to prevent external modification
    return {
      goal: { ...this.#activePlan.goal },
      tasks: this.#activePlan.tasks.map(task => ({ ...task })),
      currentStep: this.#activePlan.currentStep,
      actorId: this.#activePlan.actorId,
      createdAt: this.#activePlan.createdAt,
      lastValidated: this.#activePlan.lastValidated,
    };
  }

  /**
   * Get failed goals for an actor (debug API).
   *
   * ⚠️ CORRECTED: Returns failure arrays, NOT goal objects.
   * The actual structure stores goalId → Array<{reason, code, timestamp}>,
   * NOT goalId → {goal, timestamp, reason}.
   *
   * @param {string} actorId - Entity ID of actor
   * @returns {Array} Array of { goalId, failures: Array<{reason, code, timestamp}> }
   */
  getFailedGoals(actorId) {
    assertNonBlankString(actorId, 'actorId', 'GoapController.getFailedGoals', this.#logger);

    const now = Date.now();
    const FAILURE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes (from #trackFailedGoal)
    const results = [];

    for (const [goalId, failures] of this.#failedGoals.entries()) {
      // Filter out expired failures (consistent with #trackFailedGoal pruning)
      const recentFailures = failures.filter(
        (failure) => now - failure.timestamp < FAILURE_EXPIRY_MS
      );

      // Only include goals with non-expired failures
      // Note: Cannot filter by actorId since goals don't have actorId property
      // Goals are selected per-turn, not actor-specific in storage
      if (recentFailures.length > 0) {
        results.push({
          goalId,
          failures: recentFailures.map(f => ({
            reason: f.reason,
            code: f.code || 'UNKNOWN_PLANNER_FAILURE',
            timestamp: f.timestamp,
          })),
        });
      }
    }

    return results;
  }

  /**
   * Get failed tasks for an actor (debug API).
   *
   * ⚠️ CORRECTED: Returns failure arrays, NOT task objects.
   * The actual structure stores taskId → Array<{reason, code, timestamp}>,
   * NOT taskId → {task, timestamp, reason}.
   *
   * Task failures are actor-agnostic (tasks don't store actorId).
   *
   * @param {string} actorId - Entity ID of actor (for consistency, not used for filtering)
   * @returns {Array} Array of { taskId, failures: Array<{reason, code, timestamp}> }
   */
  getFailedTasks(actorId) {
    assertNonBlankString(actorId, 'actorId', 'GoapController.getFailedTasks', this.#logger);

    const now = Date.now();
    const FAILURE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes (from #trackFailedTask)
    const results = [];

    for (const [taskId, failures] of this.#failedTasks.entries()) {
      // Filter out expired failures (consistent with #trackFailedTask pruning)
      const recentFailures = failures.filter(
        (failure) => now - failure.timestamp < FAILURE_EXPIRY_MS
      );

      // Only include tasks with non-expired failures
      // Task failures are actor-agnostic, return all
      if (recentFailures.length > 0) {
        results.push({
          taskId,
          failures: recentFailures.map(f => ({
            reason: f.reason,
            code: f.code || 'TASK_FAILURE',
            timestamp: f.timestamp,
          })),
        });
      }
    }

    return results;
  }

  /**
   * Expose dependency diagnostics captured during construction.
   * @returns {Array<object>} Snapshot entries per dependency.
   */
  getDependencyDiagnostics() {
    return Array.from(this.#dependencyDiagnostics.values()).map((snapshot) => ({
      ...snapshot,
      requiredMethods: [...snapshot.requiredMethods],
      providedMethods: [...snapshot.providedMethods],
      missingMethods: [...snapshot.missingMethods],
    }));
  }

  /**
   * Report the diagnostics contract version consumed by the controller + debugger.
   * @returns {string}
   */
  getDiagnosticsContractVersion() {
    return GOAP_CONTROLLER_DIAGNOSTICS_CONTRACT_VERSION;
  }

  /**
   * Get the most recent task library diagnostics for an actor.
   *
   * @param {string} actorId - Entity ID of actor
   * @returns {object|null} Diagnostics payload or null if none captured
   */
  getTaskLibraryDiagnostics(actorId) {
    assertNonBlankString(
      actorId,
      'actorId',
      'GoapController.getTaskLibraryDiagnostics',
      this.#logger
    );

    const diagnostics = this.#taskLibraryDiagnostics.get(actorId);
    if (!diagnostics) {
      return null;
    }

    return JSON.parse(JSON.stringify(diagnostics));
  }

  /**
   * Return planning-state diagnostics captured via PlanningStateView instrumentation.
   * @param {string} actorId
   * @returns {object|null}
   */
  getPlanningStateDiagnostics(actorId) {
    assertNonBlankString(
      actorId,
      'actorId',
      'GoapController.getPlanningStateDiagnostics',
      this.#logger
    );

    return getPlanningStateDiagnosticsSnapshot(actorId);
  }

  /**
   * Return GOAP event-dispatch compliance diagnostics for an actor (plus global aggregate).
   *
   * @param {string} actorId - Target actor identifier or 'global'
   * @returns {{ actor: object|null, global: object|null } | null}
   */
  getEventComplianceDiagnostics(actorId) {
    assertNonBlankString(
      actorId,
      'actorId',
      'GoapController.getEventComplianceDiagnostics',
      this.#logger
    );

    if (
      !this.#eventDispatcher ||
      typeof this.#eventDispatcher.getComplianceForActor !== 'function'
    ) {
      return null;
    }

    const actorDiagnostics = this.#eventDispatcher.getComplianceForActor(actorId);
    const globalDiagnostics = this.#eventDispatcher.getComplianceForActor('global');

    if (!actorDiagnostics && !globalDiagnostics) {
      return null;
    }

    return {
      actor: actorDiagnostics,
      global: globalDiagnostics,
    };
  }

  /**
   * Get the current task from active plan (debug API).
   *
   * @param {string} actorId - Entity ID of actor
   * @returns {object|null} Current task or null if no active plan
   */
  getCurrentTask(actorId) {
    assertNonBlankString(actorId, 'actorId', 'GoapController.getCurrentTask', this.#logger);

    const plan = this.getActivePlan(actorId);
    if (!plan || plan.currentStep >= plan.tasks.length) {
      return null;
    }

    return { ...plan.tasks[plan.currentStep] };
  }
}

export default GoapController;
