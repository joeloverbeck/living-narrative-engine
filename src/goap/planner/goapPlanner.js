/**
 * @file GOAP Planner - A* search-based goal-oriented action planning
 *
 * Architecture:
 * - Planning operates on tasks with planning_preconditions and planning_effects
 * - Tasks are abstract intentions (task:consume_nourishing_item), not concrete actions
 * - Tasks are refined to executable actions post-planning (refinement process)
 * - See specs/goap-system-specs.md for complete architecture explanation
 *
 * Features:
 * - Task-level planning with knowledge-limited scoping
 * - Numeric goal support via goal-distance and RPG heuristics
 * - Configurable cost and task limits (maxCost, maxActions in goal definition)
 * - Multi-action planning with task reusability (maxReuse per task)
 * - Admissible heuristics for A* optimality
 *
 * @see planningNode.js - Planning state representation
 * @see planningEffectsSimulator.js - Task effect simulation
 * @see heuristicRegistry.js - Distance estimation functions
 * @see docs/goap/multi-action-planning.md - Usage guide
 * @see docs/goap/debugging-multi-action.md - Debugging workflows
 * @see specs/goap-system-specs.md - Architecture reference
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import { deepClone } from '../../utils/cloneUtils.js';
import MinHeap from './minHeap.js';
import PlanningNode from './planningNode.js';
import { detectGoalType, allowsOvershoot } from './goalTypeDetector.js';
import { goalHasPureNumericRoot } from './goalConstraintUtils.js';
import { GOAP_PLANNER_FAILURES } from './goapPlannerFailureReasons.js';
import { createPlanningStateView } from './planningStateView.js';
import { normalizePlanningPreconditions } from '../utils/planningPreconditionUtils.js';
import { validateGoalPaths, shouldEnforceGoalPathLint } from './goalPathValidator.js';

/**
 * GOAP Planner - A* search for task-level planning
 *
 * Core Capabilities:
 * - A* search on task operators with planning preconditions/effects
 * - Multi-action plans with task reusability and overshoot handling
 * - Heuristic-guided search (goal-distance or RPG) for efficiency
 * - Configurable stopping criteria (maxCost, maxActions from goal definition)
 * - Knowledge-limited scoping via core:known_to and core:visible components
 *
 * Planning Process:
 * 1. Start with initial planning state (symbolic facts about world)
 * 2. Apply task operators via planning_effects simulation
 * 3. Use heuristics to guide A* search efficiently
 * 4. Find minimum-cost task sequence satisfying goal conditions
 * 5. Return plan of abstract tasks (refinement to actions happens later)
 *
 * State Management (GOAPIMPL-018-02):
 * - State hashing for duplicate detection in closed set (msgpack-based)
 * - Goal satisfaction via JSON Logic evaluation of goal state
 * - Evaluation context building for preconditions and goal checking
 *
 * Multi-Action Planning:
 * - Tasks can be reused up to task.maxReuse times (default: 10)
 * - Each task application must reduce distance to goal
 * - Plans stop when: goal reached, cost limit exceeded, or action limit exceeded
 * - Overshoot allowed for inequality goals (≤, ≥), not equality goals (=)
 *
 * @class
 * @see docs/goap/multi-action-planning.md for usage examples
 * @see docs/goap/debugging-multi-action.md for troubleshooting
 */
class GoapPlanner {
  /** @type {import('../../logging/logger.js').default} */
  #logger;

  /** @type {import('../../logic/services/jsonLogicEvaluationService.js').default} */
  #jsonLogicService;

  /** @type {import('../../data/gameDataRepository.js').GameDataRepository} */
  #gameDataRepository;

  /** @type {import('../../interfaces/IEntityManager.js').IEntityManager} */
  #entityManager;

  /** @type {import('../../scopeDsl/scopeRegistry.js').default} */
  #scopeRegistry;

  /** @type {import('../../scopeDsl/engine.js').default} */
  #scopeEngine;

  /** @type {import('../../interfaces/ISpatialIndexManager.js').ISpatialIndexManager} */
  #spatialIndexManager;

  /** @type {import('./planningEffectsSimulator.js').default} */
  #effectsSimulator;

  /** @type {import('./heuristicRegistry.js').default} */
  #heuristicRegistry;

  /** @type {{code: string, reason: string, details?: object}|null} */
  #lastFailure;

  /** @type {object|null} */
  #lastTaskLibraryDiagnostics;

  /** @type {object|null} */
  #externalTaskLibraryDiagnostics;

  /** @type {Map<string, object>} */
  #goalPathDiagnostics;

  /** @type {Map<string, object>} */
  #effectFailureTelemetry;

  /**
   * Create new GOAP planner instance
   *
   * @param {object} deps - Dependencies
   * @param {import('../../logging/logger.js').default} deps.logger - Logger instance
   * @param {import('../../logic/services/jsonLogicEvaluationService.js').default} deps.jsonLogicEvaluationService - JSON Logic evaluation service
   * @param {import('../../data/gameDataRepository.js').GameDataRepository} deps.gameDataRepository - Game data repository for loading tasks
   * @param {import('../../interfaces/IEntityManager.js').IEntityManager} deps.entityManager - Entity manager for retrieving actor entities
   * @param {import('../../scopeDsl/scopeRegistry.js').default} deps.scopeRegistry - Scope registry for retrieving scope ASTs
   * @param {import('../../scopeDsl/engine.js').default} deps.scopeEngine - Scope engine for resolving scopes
   * @param {import('../../interfaces/ISpatialIndexManager.js').ISpatialIndexManager} deps.spatialIndexManager - Spatial index manager for runtime context
   * @param {import('./planningEffectsSimulator.js').default} deps.planningEffectsSimulator - Effects simulator for state transformation
   * @param {import('./heuristicRegistry.js').default} deps.heuristicRegistry - Heuristic registry for A* estimates
   */
  constructor({ logger, jsonLogicEvaluationService, gameDataRepository, entityManager, scopeRegistry, scopeEngine, spatialIndexManager, planningEffectsSimulator, heuristicRegistry }) {
    this.#logger = ensureValidLogger(logger);

    validateDependency(jsonLogicEvaluationService, 'JsonLogicEvaluationService', this.#logger, {
      requiredMethods: ['evaluateCondition'],
    });
    this.#jsonLogicService = jsonLogicEvaluationService;

    validateDependency(gameDataRepository, 'GameDataRepository', this.#logger, {
      requiredMethods: ['get'], // Uses generic get() method to retrieve tasks
    });
    this.#gameDataRepository = gameDataRepository;

    validateDependency(entityManager, 'IEntityManager', this.#logger, {
      requiredMethods: ['getEntityInstance'], // Note: uses getEntityInstance, not getEntity
    });
    this.#entityManager = entityManager;

    validateDependency(scopeRegistry, 'IScopeRegistry', this.#logger, {
      requiredMethods: ['getScopeAst'],
    });
    this.#scopeRegistry = scopeRegistry;

    validateDependency(scopeEngine, 'IScopeEngine', this.#logger, {
      requiredMethods: ['resolve'],
    });
    this.#scopeEngine = scopeEngine;

    validateDependency(spatialIndexManager, 'ISpatialIndexManager', this.#logger, {
      requiredMethods: [], // Spatial index manager just needs to exist for runtime context
    });
    this.#spatialIndexManager = spatialIndexManager;

    validateDependency(planningEffectsSimulator, 'IPlanningEffectsSimulator', this.#logger, {
      requiredMethods: ['simulateEffects'],
    });
    this.#effectsSimulator = planningEffectsSimulator;

    validateDependency(heuristicRegistry, 'IHeuristicRegistry', this.#logger, {
      requiredMethods: ['calculate'],
    });
    this.#heuristicRegistry = heuristicRegistry;

    this.#logger.info('GoapPlanner initialized');
    this.#lastFailure = null;
    this.#lastTaskLibraryDiagnostics = null;
    this.#externalTaskLibraryDiagnostics = null;
    this.#goalPathDiagnostics = new Map();
    this.#effectFailureTelemetry = new Map();
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
      const stateView = this.#buildPlanningStateView(state, {
        origin: 'GoapPlanner.goalSatisfied',
        goalId: goal?.id,
      });
      const actorId = stateView.getActorId();

      const validation = validateGoalPaths(goal.goalState, {
        actorId,
        goalId: goal?.id ?? null,
      });

      if (validation.violations.length > 0) {
        this.#handleGoalPathViolations(actorId, goal, validation.violations);
        return false;
      }

      // Build evaluation context from state
      const context = stateView.getEvaluationContext();

      // Add planning state for operators that need it (e.g., has_component)
      context.state = state;

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
  #buildPlanningStateView(state, metadata = {}) {
    return createPlanningStateView(state, {
      logger: this.#logger,
      metadata,
    });
  }

  #buildEvaluationContext(state) {
    const stateView = this.#buildPlanningStateView(state, {
      origin: 'GoapPlanner.buildEvaluationContext',
    });
    return stateView.getEvaluationContext();
  }

  /**
   * Build task library for actor by filtering all tasks through structural gates
   *
   * Structural gates are coarse "is this task even relevant?" filters based on:
   * - Actor capabilities (e.g., core:digestive_system, core:has_hands)
   * - World knowledge (e.g., knows instruments exist)
   * - Permanent attributes (e.g., is_musician, is_combatant)
   *
   * Different from preconditions which check "can I do this RIGHT NOW?"
   *
   * @param {string} actorId - Actor entity ID (UUID)
   * @returns {Array<object>} Filtered task definitions
   * @private
   * @example
   * const tasks = this.#getTaskLibrary('actor-uuid-123');
   * // Returns: [
   * //   { id: 'core:consume_nourishing_item', ... },
   * //   { id: 'core:find_shelter', ... }
   * // ]
   */
  #getTaskLibrary(actorId) {
    const diagnostics = {
      actorId,
      timestamp: Date.now(),
      namespaces: {},
      totalTasks: 0,
      warnings: this.#externalTaskLibraryDiagnostics?.warnings
        ? [...this.#externalTaskLibraryDiagnostics.warnings]
        : [],
      missingActors: [],
      errors: [],
      preconditionNormalizations: [],
    };

    // 1. Get all tasks from repository
    // Tasks are stored in registry with key 'tasks' and retrieved via generic get()
    const tasksData = this.#gameDataRepository.get('tasks');

    if (!tasksData) {
      this.#logger.warn('No tasks available in repository');
       diagnostics.errors.push('TASK_REGISTRY_MISSING');
       this.#lastTaskLibraryDiagnostics = diagnostics;
      return [];
    }

    // 2. Flatten tasks from all mods into single array
    // Tasks are stored as: { modId: { taskId: taskData, ... }, ... }
    const allTasks = [];
    for (const modId in tasksData) {
      const modTasks = tasksData[modId];
      if (!modTasks || typeof modTasks !== 'object') {
        diagnostics.warnings.push(
          `Task namespace "${modId}" is not an object. Ignoring malformed entry.`
        );
        continue;
      }

      const taskIds = Object.keys(modTasks);
      diagnostics.namespaces[modId] = {
        taskCount: taskIds.length,
      };
      diagnostics.totalTasks += taskIds.length;

      for (const taskId of taskIds) {
        allTasks.push(modTasks[taskId]);
      }
    }

    if (allTasks.length === 0) {
      this.#logger.warn('No tasks found in repository data');
      diagnostics.errors.push('TASK_LIBRARY_EMPTY');
      this.#lastTaskLibraryDiagnostics = diagnostics;
      return [];
    }

    this.#logger.debug(`Filtering ${allTasks.length} tasks for actor ${actorId}`);

    // 3. Get actor entity for structural gate evaluation
    // CRITICAL: Use getEntityInstance() not getEntity()
    const actor = this.#entityManager.getEntityInstance(actorId);

    if (!actor) {
      this.#logger.error(`Actor not found: ${actorId}`);
      diagnostics.missingActors.push(actorId);
      diagnostics.lastErrorCode = 'GOAP_SETUP_MISSING_ACTOR';
      this.#lastTaskLibraryDiagnostics = diagnostics;
      return [];
    }

    // 4. Build evaluation context for structural gates
    const context = {
      actor: actor,
      // Future: add world-level facts if needed (e.g., world state, game config)
    };

    // 5. Filter by structural gates
    const filteredTasks = allTasks.filter(task => {
      // Tasks without structural gates are always relevant
      if (!task.structuralGates || !task.structuralGates.condition) {
        this.#logger.debug(`Task ${task.id} has no structural gates, including`);
        return true;
      }

      try {
        // Evaluate structural gate condition
        const passed = this.#jsonLogicService.evaluateCondition(
          task.structuralGates.condition,
          context
        );

        if (passed) {
          this.#logger.debug(`Task ${task.id} structural gates passed`);
        } else {
          this.#logger.debug(`Task ${task.id} structural gates failed, excluding`);
        }

        return passed;

      } catch (err) {
        this.#logger.error(`Structural gate evaluation failed for ${task.id}`, err, {
          condition: task.structuralGates.condition,
        });
        return false; // Conservative: exclude on error
      }
    });

    this.#logger.info(`Task library for ${actorId}: ${filteredTasks.length} / ${allTasks.length} tasks`);

    diagnostics.filteredTaskCount = filteredTasks.length;
    this.#lastTaskLibraryDiagnostics = diagnostics;
    return filteredTasks;
  }

  /**
   * Bind task parameters from planning scope to concrete entity IDs
   *
   * Uses scope resolution to find candidate entities and applies optimistic binding
   * strategy (takes first entity from scope result). This connects planning-level
   * task parameters with execution-level primitive actions.
   *
   * @param {object} task - Task definition with optional planningScope
   * @param {object} state - Current planning state (unused in current implementation)
   * @param {string} actorId - Actor entity ID performing the task
   * @returns {object|null} Bound parameters object { target: entityId } or null if binding fails
   * @private
   * @example
   * const task = {
   *   id: 'core:consume_nourishing_item',
   *   planningScope: 'core:edible_items_in_reach'
   * };
   * const params = this.#bindTaskParameters(task, state, 'actor-123');
   * // Returns: { target: 'apple-456' }
   */
  #bindTaskParameters(task, state, actorId) {
    // 1. Validate task has planningScope
    if (!task.planningScope) {
      this.#logger.debug(`Task ${task.id} has no planningScope defined`);
      return null;
    }

    // 2. Handle special scopes: 'self' and 'none' don't need parameter binding
    if (task.planningScope === 'self' || task.planningScope === 'none') {
      this.#logger.debug(`Task ${task.id} uses special scope ${task.planningScope}, no parameter binding needed`);
      return {}; // Empty parameters for self-targeting tasks
    }

    // 3. CRITICAL: Use scopeRegistry.getScopeAst(), NOT gameDataRepository.getScope()
    const scopeAst = this.#scopeRegistry.getScopeAst(task.planningScope);
    if (!scopeAst) {
      this.#logger.warn(`Planning scope not found: ${task.planningScope}`, {
        taskId: task.id,
        scopeId: task.planningScope,
      });
      return null;
    }

    // 4. Get actor entity
    const actorEntity = this.#entityManager.getEntityInstance(actorId);
    if (!actorEntity) {
      this.#logger.error(`Actor entity not found: ${actorId}`, {
        taskId: task.id,
        actorId,
      });
      return null;
    }

    // 5. CRITICAL: Build runtimeCtx matching RuntimeContext type exactly
    // Property name is "jsonLogicEval" not "jsonLogicService"
    // spatialIndexManager is REQUIRED
    const runtimeCtx = {
      entityManager: this.#entityManager,
      spatialIndexManager: this.#spatialIndexManager,
      jsonLogicEval: this.#jsonLogicService,
      logger: this.#logger,
    };

    // 6. Resolve scope to entity set
    try {
      const scopeResult = this.#scopeEngine.resolve(
        scopeAst,
        actorEntity,
        runtimeCtx,
        null // trace - optional, null for no tracing
      );

      if (!scopeResult || scopeResult.size === 0) {
        this.#logger.debug(`No entities in scope ${task.planningScope}`, {
          taskId: task.id,
          scopeId: task.planningScope,
          actorId,
        });
        return null;
      }

      // 7. Optimistic binding: take first entity from Set
      const iterator = scopeResult.values();
      const first = iterator.next();

      if (first.done) {
        this.#logger.debug('Scope returned empty iterator', {
          taskId: task.id,
          scopeId: task.planningScope,
        });
        return null;
      }

      // 8. Bind to parameter (convention: 'target' for single-target scopes)
      const boundParams = {
        target: first.value, // Entity ID string
      };

      this.#logger.debug(`Bound task parameters successfully`, {
        taskId: task.id,
        scopeId: task.planningScope,
        entityId: first.value,
        totalCandidates: scopeResult.size,
      });

      return boundParams;

    } catch (err) {
      this.#logger.error('Scope resolution failed during parameter binding', err, {
        taskId: task.id,
        actorId,
      });
      return null;
    }
  }

  /**
   * Get applicable tasks for actor by filtering task library and binding parameters
   *
   * This method:
   * 1. Gets the structurally-filtered task library for the actor
   * 2. Attempts to bind parameters for each task via scope resolution
   * 3. Checks planning preconditions are satisfied
   * 4. If goal provided, verifies task reduces distance to goal
   * 5. Returns only tasks that pass all checks
   *
   * Tasks without planningScope are included as-is (no parameter binding needed).
   * Tasks that fail parameter binding are excluded from the result.
   *
   * @param {Array<object>} tasks - Task library (pre-filtered by structural gates)
   * @param {object} state - Current planning state
   * @param {string} actorId - Actor entity ID
   * @param {object|null} goal - Optional goal for distance reduction checking
   * @param {object|null} [diagnostics] - Optional object collecting rejection stats
   * @returns {Array<object>} Tasks with bound parameters added to each task object
   * @private
   * @example
   * const taskLibrary = this.#getTaskLibrary('actor-123');
   * const applicable = this.#getApplicableTasks(taskLibrary, state, 'actor-123', goal);
   * // Returns: [
   * //   { id: 'core:consume_item', boundParams: { target: 'apple-456' }, ... },
   * //   { id: 'core:rest', ... } // No params needed
   * // ]
   */
  #getApplicableTasks(tasks, state, actorId, goal = null, diagnostics = null) {
    if (!tasks || tasks.length === 0) {
      this.#logger.debug('No tasks provided to filter for applicability');
      return [];
    }

    const applicableTasks = [];

    for (const task of tasks) {

      // Try to bind parameters
      const boundParams = this.#bindTaskParameters(task, state, actorId);

      // Tasks without planningScope (boundParams === null) are still applicable
      // Only exclude if binding was attempted but failed
      if (task.planningScope && !boundParams) {
        this.#logger.debug(`Task ${task.id} excluded - parameter binding failed`);
        continue;
      }


      const planningPreconditions = normalizePlanningPreconditions(
        task,
        this.#logger,
        {
          diagnostics: this.#lastTaskLibraryDiagnostics,
          actorId,
          goalId: goal?.id ?? null,
          origin: 'GoapPlanner.#getApplicableTasks',
        }
      );

      // Check planning preconditions
      if (planningPreconditions.length > 0) {
        let preconditionsSatisfied = true;

        // Build context for precondition evaluation (similar to #goalSatisfied)
        const context = this.#buildEvaluationContext(state);
        context.state = state; // Add planning state for operators

        // Add actor placeholder resolution
        context.actor = actorId;

        // Add bound parameters if available
        if (boundParams) {
          Object.assign(context, boundParams);
        }

        for (const precondition of planningPreconditions) {
          try {
            // Evaluate precondition with full context
            const satisfied = this.#jsonLogicService.evaluateCondition(
              precondition.condition,
              context
            );


            if (!satisfied) {
              this.#logger.debug(`Task ${task.id} excluded - precondition not satisfied: ${precondition.description}`);
              preconditionsSatisfied = false;
              break;
            }
          } catch (err) {
            this.#logger.warn(`Task ${task.id} precondition evaluation failed: ${err.message}`);
            preconditionsSatisfied = false;
            break;
          }
        }

        if (!preconditionsSatisfied) {
          continue;
        }
      }

      // Check if task reduces distance to goal (only for numeric goals)
      if (goal && this.#hasNumericConstraints(goal)) {
        if (diagnostics) {
          diagnostics.numericGuardCandidates =
            (diagnostics.numericGuardCandidates || 0) + 1;
        }
        const reduces = this.#taskReducesDistance(task, state, goal, actorId);
        if (!reduces) {
          if (diagnostics) {
            diagnostics.numericGuardRejects =
              (diagnostics.numericGuardRejects || 0) + 1;
          }
          this.#logger.debug(`Task ${task.id} excluded - does not reduce distance to goal`);
          continue;
        }
      }

      // Add bound parameters to task (or leave undefined if no binding needed)
      const applicableTask = {
        ...task,
        ...(boundParams && { boundParams }),
      };

      applicableTasks.push(applicableTask);
    }

    this.#logger.debug(`Applicable tasks for actor ${actorId}`, {
      total: tasks.length,
      applicable: applicableTasks.length,
    });

    return applicableTasks;
  }

  /**
   * Check if goal has numeric constraints
   *
   * Detects if goal state contains numeric comparison operators like <=, >=, <, >.
   * Used to determine if distance reduction checking should be applied.
   *
   * @param {object} goal - Goal definition with goalState
   * @returns {boolean} True if goal has numeric constraints
   * @private
   * @example
   * const goal1 = { goalState: { '<=': [{ 'var': 'hunger' }, 30] } };
   * this.#hasNumericConstraints(goal1); // Returns: true
   *
   * const goal2 = { goalState: { '!': { has_component: ['actor', 'hungry'] } } };
   * this.#hasNumericConstraints(goal2); // Returns: false
   */
  #hasNumericConstraints(goal) {
    // Guardrail documented in specs/goap-system-specs.md: only pure numeric comparators
    // activate distance heuristics. Mixed structural goals stay boolean-only.
    return goalHasPureNumericRoot(goal);
  }

  /**
   * Check if task reduces distance to goal
   *
   * Simulates task effects and compares goal distance before and after.
   * Used during action applicability checking to filter out tasks that
   * satisfy preconditions but make no progress toward the goal.
   *
   * @param {object} task - Task definition with planningEffects
   * @param {object} currentState - Current planning state
   * @param {object} goal - Goal definition for distance calculation
   * @param {string} actorId - Actor entity ID for parameter resolution
   * @returns {boolean} True if task reduces distance to goal
   * @private
   * @example
   * const reduces = this.#taskReducesDistance(
   *   task,
   *   { 'actor.state.hunger': 80 },
   *   { goalState: { '<=': [{ 'var': 'actor.state.hunger' }, 30] } },
   *   'actor-123'
   * );
   * // Returns: true (if task reduces hunger by 60, distance goes from 50 to 0)
   */
  #taskReducesDistance(task, currentState, goal, actorId) {
    try {
      // Build effect simulation context
      const effectContext = {
        actor: actorId, // For parameter resolution (entity_ref: 'actor')
        actorId,
        parameters: task.boundParams || {}
      };

      // Simulate applying task effects
      const simulationResult = this.#effectsSimulator.simulateEffects(
        currentState,
        task.planningEffects || [],
        effectContext
      );

      // Check simulation success
      if (!simulationResult.success) {
        this.#recordEffectFailureTelemetry(actorId, {
          taskId: task.id,
          goalId: goal?.id ?? null,
          phase: 'distance-check',
          message:
            simulationResult.error ||
            'PlanningEffectsSimulator returned unsuccessfully during distance check',
        });
        this.#failForInvalidEffect(
          task.id,
          simulationResult.error || 'PlanningEffectsSimulator returned unsuccessfully during distance check',
          {
            phase: 'distance-check',
            actorId,
          }
        );
      }

      const nextState = simulationResult.state;

      // Calculate distances
      const currentDistance = this.#heuristicRegistry.calculate(
        'goal-distance',
        currentState,
        goal,
        [] // task library not needed for distance calculation
      );

      const nextDistance = this.#heuristicRegistry.calculate(
        'goal-distance',
        nextState,
        goal,
        []
      );

      // Validate distance values
      if (!Number.isFinite(currentDistance) || !Number.isFinite(nextDistance)) {
        this.#logger.warn('Non-finite distance values', {
          taskId: task.id,
          currentDistance,
          nextDistance
        });
        return false;
      }

      // Action is applicable if it reduces distance (or achieves goal)
      const reduces = nextDistance < currentDistance;

      if (reduces) {
        this.#logger.debug('Task reduces distance to goal', {
          taskId: task.id,
          goalId: goal.id,
          currentDistance,
          nextDistance,
          reduction: currentDistance - nextDistance
        });
      } else {
        this.#logger.debug('Task does not reduce distance', {
          taskId: task.id,
          currentDistance,
          nextDistance,
          change: nextDistance - currentDistance
        });
      }

      return reduces;
    } catch (error) {
      if (error?.code === GOAP_PLANNER_FAILURES.INVALID_EFFECT_DEFINITION) {
        throw error;
      }
      this.#logger.error('Failed to check distance reduction', {
        taskId: task.id,
        goalId: goal.id,
        error: error.message,
        stack: error.stack
      });
      return false; // Treat as not applicable on error
    }
  }

  /**
   * Expose the last planning failure recorded by plan()
   *
   * @returns {{code: string, reason: string, details?: object}|null}
   */
  getLastFailure() {
    if (!this.#lastFailure) {
      return null;
    }

    const details = this.#lastFailure.details
      ? { ...this.#lastFailure.details }
      : undefined;

    return {
      code: this.#lastFailure.code,
      reason: this.#lastFailure.reason,
      ...(details ? { details } : {}),
    };
  }

  /**
   * Allow external callers (e.g., test harness) to attach normalization warnings.
   *
   * @param {{warnings?: string[]}|null} diagnostics - Optional diagnostics payload
   */
  setExternalTaskLibraryDiagnostics(diagnostics = null) {
    if (!diagnostics) {
      this.#externalTaskLibraryDiagnostics = null;
      return;
    }

    const cloned = deepClone(diagnostics);
    cloned.warnings = Array.isArray(cloned.warnings) ? [...cloned.warnings] : [];
    if (!Array.isArray(cloned.preconditionNormalizations)) {
      cloned.preconditionNormalizations = [];
    }
    this.#externalTaskLibraryDiagnostics = cloned;
  }

  /**
   * Return diagnostics collected during the most recent task library build.
   *
   * @returns {object|null} Diagnostics object with namespace counts, warnings, etc.
   */
  getTaskLibraryDiagnostics() {
    if (!this.#lastTaskLibraryDiagnostics) {
      return null;
    }

    return deepClone(this.#lastTaskLibraryDiagnostics);
  }

  getGoalPathDiagnostics(actorId) {
    if (!actorId) {
      return null;
    }

    const entry = this.#goalPathDiagnostics.get(actorId);
    if (!entry) {
      return null;
    }

    this.#goalPathDiagnostics.delete(actorId);
    return deepClone(entry);
  }

  getEffectFailureTelemetry(actorId) {
    if (!actorId) {
      return null;
    }

    const entry = this.#effectFailureTelemetry.get(actorId);
    if (!entry) {
      return null;
    }

    this.#effectFailureTelemetry.delete(actorId);
    return deepClone(entry);
  }

  /**
   * Record failure metadata for the most recent planning attempt
   *
   * @param {string} code - Failure code from GOAP_PLANNER_FAILURES
   * @param {string} reason - Human-readable reason
   * @param {object} [details] - Optional diagnostic payload
   * @private
   */
  #recordFailure(code, reason, details = {}) {
    this.#lastFailure = {
      code,
      reason,
      details,
    };
  }

  #recordGoalPathViolation(actorId, goal, violations) {
    const actorKey = actorId || 'unknown';
    if (!this.#goalPathDiagnostics.has(actorKey)) {
      this.#goalPathDiagnostics.set(actorKey, {
        actorId: actorKey,
        totalViolations: 0,
        lastViolationAt: null,
        entries: [],
      });
    }

    const entry = this.#goalPathDiagnostics.get(actorKey);
    const snapshot = {
      goalId: goal?.id ?? null,
      goalName: goal?.name ?? null,
      timestamp: Date.now(),
      violations: violations.map((violation) => ({
        path: violation.path,
        reason: violation.reason,
      })),
    };

    entry.totalViolations += violations.length;
    entry.lastViolationAt = snapshot.timestamp;
    entry.entries.push(snapshot);
    if (entry.entries.length > 5) {
      entry.entries.shift();
    }
  }

  #handleGoalPathViolations(actorId, goal, violations) {
    this.#recordGoalPathViolation(actorId, goal, violations);

    const paths = violations.map((violation) => violation.path).join(', ');
    const docHint = 'See docs/goap/debugging-tools.md#Planner Contract Checklist for remediation steps.';
    const goalLabel = goal?.id || goal?.name || 'unknown-goal';
    const reason = `Goal "${goalLabel}" referenced actor.* paths without actor.components.*: ${paths}`;

    if (shouldEnforceGoalPathLint()) {
      this.#recordFailure(
        GOAP_PLANNER_FAILURES.INVALID_GOAL_PATH,
        `${reason}. ${docHint}`,
        {
          actorId,
          goalId: goal?.id ?? null,
          goalPathViolations: violations.map((violation) => violation.path),
        }
      );

      const error = new Error(`${reason}. ${docHint}`);
      error.code = GOAP_PLANNER_FAILURES.INVALID_GOAL_PATH;
      error.details = {
        actorId,
        goalId: goal?.id ?? null,
        goalPathViolations: violations.map((violation) => violation.path),
        violations,
      };
      throw error;
    }

    this.#logger.warn('Goal JSON Logic referenced actor.* paths without actor.components.*', {
      actorId,
      goalId: goal?.id ?? null,
      violations,
      code: 'GOAP_INVALID_GOAL_PATH',
    });
  }

  #recordEffectFailureTelemetry(actorId, payload) {
    const actorKey = actorId || 'unknown';
    if (!this.#effectFailureTelemetry.has(actorKey)) {
      this.#effectFailureTelemetry.set(actorKey, {
        actorId: actorKey,
        totalFailures: 0,
        lastFailureAt: null,
        failures: [],
      });
    }

    const entry = this.#effectFailureTelemetry.get(actorKey);
    const snapshot = {
      ...payload,
      timestamp: Date.now(),
    };

    entry.totalFailures += 1;
    entry.lastFailureAt = snapshot.timestamp;
    entry.failures.push(snapshot);
    if (entry.failures.length > 10) {
      entry.failures.shift();
    }
  }

  /**
   * Record invalid planning effect metadata and throw a standardized error.
   *
   * @param {string} taskId - Task identifier
   * @param {string} message - Base error message
   * @param {object} [context={}] - Additional diagnostic data
   * @private
   */
  #failForInvalidEffect(taskId, message, context = {}) {
    const docHint = 'See docs/goap/debugging-tools.md#Planner Contract Checklist for schema details.';
    const reason = `Invalid planning effect in task "${taskId}": ${message}. ${docHint}`;
    this.#recordFailure(
      GOAP_PLANNER_FAILURES.INVALID_EFFECT_DEFINITION,
      reason,
      {
        taskId,
        ...context,
      }
    );

    const error = new Error(reason);
    error.code = GOAP_PLANNER_FAILURES.INVALID_EFFECT_DEFINITION;
    error.details = context;
    throw error;
  }

  /**
   * Find optimal task sequence to achieve goal using A* search
   *
   * Implements classic A* algorithm with:
   * - MinHeap-based open list (prioritized by fScore)
   * - Set-based closed list (visited state hashes)
   * - State deduplication via hashing
   * - Open list duplicate detection with path replacement
   * - Search limits (maxNodes, maxTime, maxDepth)
   * - Heuristic calculation for admissible estimates
   * - Effect simulation for state prediction
   *
   * @param {string} actorId - Acting entity ID (UUID format)
   * @param {object} goal - Goal definition with goalState JSON Logic condition
   * @param {object} initialState - Starting world state (symbolic facts hash)
   * @param {object} [options={}] - Search configuration
   * @param {string} options.heuristic - Heuristic name (default: 'goal-distance')
   * @param {number} options.maxNodes - Max nodes to explore (default: 1000)
   * @param {number} options.maxTime - Max time in ms (default: 5000)
   * @param {number} options.maxDepth - Max plan length (default: 20)
   * @returns {Array<{taskId: string, parameters: object}>|null} Plan or null if unsolvable
   * @example
   * const plan = planner.plan('actor-123', {
   *   id: 'reduce-hunger',
   *   goalState: { '==': [{ 'var': 'actor.core.hungry' }, false] }
   * }, initialState);
   * // Returns: [
   * //   { taskId: 'core:acquire_food', parameters: { target: 'apple-456' } },
   * //   { taskId: 'core:consume_food', parameters: { target: 'apple-456' } }
   * // ]
   */
  plan(actorId, goal, initialState, options) {
    const planningOptions = options ?? {};
    // 1. Extract and validate options
    const heuristic = planningOptions.heuristic || 'goal-distance';
    const maxNodes = planningOptions.maxNodes || 1000;
    const maxTime = planningOptions.maxTime || 5000;
    const maxDepth = planningOptions.maxDepth || 20;
    this.#lastFailure = null;
    const failureStats = {
      depthLimitHit: false,
      numericGuardBlocked: false,
      nodesWithoutApplicableTasks: 0,
    };

    const abortForInvalidEffect = (error) => {
      if (error?.code === GOAP_PLANNER_FAILURES.INVALID_EFFECT_DEFINITION) {
        this.#logger.error('Aborting planning due to invalid planning effect', {
          actorId,
          goalId: goal?.id,
          reason: error.message,
          details: error.details,
        });
        return true;
      }
      return false;
    };

    const abortForInvalidGoalPath = (error) => {
      if (error?.code === GOAP_PLANNER_FAILURES.INVALID_GOAL_PATH) {
        this.#logger.error('Aborting planning due to invalid goal path', {
          actorId,
          goalId: goal?.id,
          reason: error.message,
          violations: error.details?.goalPathViolations,
        });
        return true;
      }
      return false;
    };

    const upfrontGoalPathCheck = validateGoalPaths(goal.goalState, {
      goalId: goal?.id ?? null,
      actorId,
    });

    if (upfrontGoalPathCheck.violations.length > 0) {
      try {
        this.#handleGoalPathViolations(actorId, goal, upfrontGoalPathCheck.violations);
      } catch (error) {
        if (abortForInvalidGoalPath(error)) {
          return null;
        }
        throw error;
      }
    }

    // Normalize maxCost upfront to keep structural depth checks fully independent from cost
    const rawCostLimit = goal?.maxCost;
    const normalizedCostLimit =
      rawCostLimit === undefined || rawCostLimit === null
        ? Infinity
        : Number(rawCostLimit);
    const hasCostLimit = Number.isFinite(normalizedCostLimit);
    const maxCostLimit = hasCostLimit ? normalizedCostLimit : Infinity;

    this.#logger.info('Starting A* search', {
      actorId,
      goalId: goal.id,
      heuristic,
      limits: { maxNodes, maxTime, maxDepth },
    });

    // 2. Get task library for actor
    const taskLibrary = this.#getTaskLibrary(actorId);
    const latestDiagnostics = this.#lastTaskLibraryDiagnostics;
    if (taskLibrary.length === 0) {
      this.#logger.warn('No tasks available for actor', { actorId });
      this.#recordFailure(
        GOAP_PLANNER_FAILURES.TASK_LIBRARY_EXHAUSTED,
        'No planning tasks available for actor',
        {
          actorId,
          goalId: goal?.id,
          ...(latestDiagnostics ? { diagnostics: latestDiagnostics } : {}),
        }
      );
      return null;
    }

    // 2.1 Quick feasibility check (if maxCost is set)
    if (hasCostLimit) {
      // Only check if a limit is set
      const estimatedCost = this.#heuristicRegistry.calculate(
        'goal-distance',
        initialState,
        goal,
        taskLibrary // Pass task library array directly
      );

      if (estimatedCost > maxCostLimit) {
        this.#logger.warn('Goal estimated cost exceeds limit', {
          estimatedCost,
          maxCost: maxCostLimit,
          goalId: goal.id,
          actorId,
        });

        // Return null - caller (GoapController) will dispatch PLANNING_FAILED event
        this.#recordFailure(
          GOAP_PLANNER_FAILURES.ESTIMATED_COST_EXCEEDS_LIMIT,
          'Estimated planning cost exceeds goal maxCost',
          { actorId, goalId: goal.id, estimatedCost, maxCost: maxCostLimit }
        );
        return null;
      }
    }

    // 3. Calculate initial heuristic
    let initialHeuristic;
    try {
      initialHeuristic = this.#heuristicRegistry.calculate(
        heuristic,
        initialState,
        goal,
        taskLibrary
      );
    } catch (err) {
      this.#logger.error('Initial heuristic calculation failed', err);
      return null;
    }

    // 4. Create start node
    const startNode = new PlanningNode({
      state: initialState,
      gScore: 0,
      hScore: initialHeuristic,
      parent: null,
      task: null,
      taskParameters: null,
    });

    // 5. Initialize A* data structures
    const openList = new MinHeap((a, b) => a.fScore - b.fScore);
    const closedSet = new Set(); // Set of state hashes

    openList.push(startNode);

    // 6. Track performance
    const startTime = Date.now();
    let nodesExpanded = 0;

    // 7. Main A* loop
    while (!openList.isEmpty()) {
      // 7.1 Check time limit
      const elapsed = Date.now() - startTime;
      if (elapsed > maxTime) {
        this.#logger.warn('Search timeout', {
          elapsed,
          maxTime,
          nodesExpanded,
        });
        this.#recordFailure(
          GOAP_PLANNER_FAILURES.TIME_LIMIT_EXCEEDED,
          'Planner exceeded time limit',
          { actorId, goalId: goal.id, elapsed, maxTime, nodesExpanded }
        );
        return null;
      }

      // 7.2 Check node limit
      if (nodesExpanded >= maxNodes) {
        this.#logger.warn('Node limit reached', {
          nodesExpanded,
          maxNodes,
        });
        this.#recordFailure(
          GOAP_PLANNER_FAILURES.NODE_LIMIT_REACHED,
          'Planner explored maximum nodes without success',
          { actorId, goalId: goal.id, nodesExpanded, maxNodes }
        );
        return null;
      }

      // 7.3 Get node with lowest fScore
      const current = openList.pop();
      nodesExpanded++;

      // Log progress every 100 nodes
      if (nodesExpanded % 100 === 0) {
        this.#logger.info('Search progress', {
          nodesExpanded,
          openListSize: openList.size,
          closedSetSize: closedSet.size,
          currentFScore: current.fScore,
        });
      }

      // Depth semantics (GOAPNUMPLAHAR-001): depth == path length (task count), never cumulative cost
      const currentPathLength = current.getPath().length;

      this.#logger.debug('Expanding node', {
        gScore: current.gScore,
        hScore: current.hScore,
        fScore: current.fScore,
        task: current.task?.id,
        planLength: currentPathLength,
        maxDepth,
      });

      // 7.4 Goal check - BEFORE adding to closed set
      let goalReached = false;
      try {
        goalReached = this.#goalSatisfied(current.state, goal);
      } catch (error) {
        if (abortForInvalidEffect(error) || abortForInvalidGoalPath(error)) {
          return null;
        }
        throw error;
      }

      if (goalReached) {
        this.#logger.info('Goal reached', {
          nodesExpanded,
          planLength: currentPathLength,
          timeElapsed: Date.now() - startTime,
          gScore: current.gScore,
          maxDepth,
        });
        return {
          tasks: current.getPath(),
          cost: current.gScore,
          nodesExplored: nodesExpanded,
        };
      }

      // 7.4.1 Cost limit check
      if (hasCostLimit && current.gScore > maxCostLimit) {
        this.#logger.debug('Node exceeds cost limit, skipping', {
          currentCost: current.gScore,
          maxCost: maxCostLimit,
          actionCount: currentPathLength,
        });
        continue; // Skip this node, try other paths
      }

      // 7.4.2 Action count limit check
      const maxActions = goal.maxActions || 20; // Default: prevent runaway plans
      if (currentPathLength >= maxActions) {
        // Structural gate: number of abstract tasks, cost is handled separately by goal.maxCost
        this.#logger.debug('Node exceeds action count limit, skipping', {
          actionCount: currentPathLength,
          maxActions,
          currentCost: current.gScore,
        });
        continue; // Skip this node, try other paths
      }

      // 7.5 Add to closed set
      const currentHash = this.#hashState(current.state);
      closedSet.add(currentHash);

      // 7.6 Check depth limit
      // Depth guard must reflect path length (task count) to stay aligned with specs/goap-system-specs.md
      if (currentPathLength >= maxDepth) {
        this.#logger.debug('Depth limit reached for node', {
          planLength: currentPathLength,
          maxDepth,
        });
        failureStats.depthLimitHit = true;
        continue; // Skip expanding this node
      }

      // 7.7 Generate successors
      const applicabilityDiagnostics = {
        numericGuardCandidates: 0,
        numericGuardRejects: 0,
      };
      let applicableTasks;
      try {
        applicableTasks = this.#getApplicableTasks(
          taskLibrary,
          current.state,
          actorId,
          goal, // NEW: Pass goal for distance checking
          applicabilityDiagnostics
        );
      } catch (error) {
        if (abortForInvalidEffect(error)) {
          return null;
        }
        throw error;
      }

      if (applicableTasks.length === 0) {
        failureStats.nodesWithoutApplicableTasks += 1;
        if (
          applicabilityDiagnostics.numericGuardCandidates > 0 &&
          applicabilityDiagnostics.numericGuardRejects ===
            applicabilityDiagnostics.numericGuardCandidates
        ) {
          failureStats.numericGuardBlocked = true;
        }
      }


      try {
        for (const task of applicableTasks) {
          // 7.7.1 Build effect simulation context
          const effectContext = {
            actor: actorId, // For parameter resolution (entity_ref: 'actor')
            actorId,
            parameters: task.boundParams || {},
          };

          // 7.7.2 Simulate effects
          let simulationResult;
          try {
            simulationResult = this.#effectsSimulator.simulateEffects(
              current.state,
              task.planningEffects || [],
              effectContext
            );
          } catch (err) {
            this.#logger.warn('Effect simulation failed', {
              error: err.message,
            });
            continue; // Skip this task
          }

          if (!simulationResult.success) {
            this.#recordEffectFailureTelemetry(actorId, {
              taskId: task.id,
              goalId: goal?.id ?? null,
              phase: 'successor-expansion',
              message:
                simulationResult.error ||
                'PlanningEffectsSimulator returned unsuccessfully during successor expansion',
            });
            this.#failForInvalidEffect(
              task.id,
              simulationResult.error || 'PlanningEffectsSimulator returned unsuccessfully during successor expansion',
              { phase: 'successor-expansion', actorId }
            );
          }

          const successorState = simulationResult.state;
          const successorHash = this.#hashState(successorState);

          // 7.7.4 Calculate scores
          const taskCost = task.cost || 1; // Default cost is 1
          const successorGScore = current.gScore + taskCost;

          // 7.7.5 Calculate heuristic
          let successorHScore;
          try {
            successorHScore = this.#heuristicRegistry.calculate(
              heuristic,
              successorState,
              goal,
              taskLibrary
            );
          } catch (err) {
            this.#logger.warn('Heuristic calculation failed, using Infinity', {
              error: err.message,
            });
            successorHScore = Infinity; // Inadmissible - will be deprioritized
          }

          // 7.7.5.5 Check if task is reusable (AFTER simulation and heuristic calculation)
          // Calculate distances for reusability check (use goal-distance heuristic, not general heuristic)
          const currentDistance = this.#heuristicRegistry.calculate(
            'goal-distance',
            current.state,
            goal,
            [] // Empty task library for distance-only calculation
          );

          const successorDistance = this.#heuristicRegistry.calculate(
            'goal-distance',
            successorState,
            goal,
            [] // Empty task library for distance-only calculation
          );

          const isReusable = this.#isTaskReusable(task, current, successorState, successorDistance, currentDistance, goal);

          // 7.7.3 Skip if already in closed set (UNLESS task is reusable)
          if (closedSet.has(successorHash) && !isReusable) {
            this.#logger.debug('State already visited', {
            });
            continue;
          }

          // 7.7.6 Create successor node
          const successor = new PlanningNode({
            state: successorState,
            gScore: successorGScore,
            hScore: successorHScore,
            parent: current,
            task: task,
            taskParameters: task.boundParams || null,
          });

          // 7.7.7 Check if already in open list
          const existingIndex = openList.findIndex(node => {
            const existingHash = this.#hashState(node.state);
            return existingHash === successorHash;
          });

          if (existingIndex !== -1) {
            // State already in open list
            const existing = openList.get(existingIndex);
            if (successor.gScore < existing.gScore) {
              // Found better path - replace
              this.#logger.debug('Replacing path in open list', {
                oldGScore: existing.gScore,
                newGScore: successor.gScore,
              });
              openList.remove(existingIndex);
              openList.push(successor);
            } else {
              this.#logger.debug('Keeping existing better path', {
              });
            }
          } else {
            // New state - add to open list
            this.#logger.debug('Adding successor to open list', {
              gScore: successor.gScore,
              hScore: successor.hScore,
              fScore: successor.fScore,
            });
            openList.push(successor);
          }
        }
      } catch (error) {
        if (abortForInvalidEffect(error)) {
          return null;
        }
        throw error;
      }
    }

    // 8. Open list exhausted - no solution
    let failureCode = GOAP_PLANNER_FAILURES.NO_VALID_PLAN;
    let failureReason = 'No valid plan found within constraints';

    if (failureStats.numericGuardBlocked) {
      failureCode = GOAP_PLANNER_FAILURES.DISTANCE_GUARD_BLOCKED;
      failureReason = 'Distance guard rejected all numeric goal tasks';
    } else if (failureStats.depthLimitHit) {
      failureCode = GOAP_PLANNER_FAILURES.DEPTH_LIMIT_REACHED;
      failureReason = 'Depth limit reached before satisfying goal';
    } else if (failureStats.nodesWithoutApplicableTasks > 0) {
      failureCode = GOAP_PLANNER_FAILURES.NO_APPLICABLE_TASKS;
      failureReason = 'No applicable tasks available after filtering';
    }

    const failureDetails = {
      actorId,
      goalId: goal.id,
      nodesExpanded,
      closedSetSize: closedSet.size,
      maxCost: goal.maxCost,
      maxActions: goal.maxActions,
      failureStats,
    };

    this.#recordFailure(failureCode, failureReason, failureDetails);

    this.#logger.warn('Goal unsolvable - open list exhausted', {
      ...failureDetails,
      failureCode,
      message: failureReason,
    });

    // Note: No event bus dispatch - GoapController handles PLANNING_FAILED event
    return null;
  }

  /**
   * Check if a task is reusable for multi-action planning.
   *
   * A task is reusable if:
   * 1. It hasn't exceeded its reuse limit
   * 2. It reduces distance to goal when applied (checked via successor state distance)
   *
   * Note: This method assumes the task has already passed applicability checks
   * (preconditions, parameter binding, etc.). It only filters for multi-action reuse.
   *
   * @param {object} task - Task to check
   * @param {import('./planningNode.js').default} currentNode - Current search node (PlanningNode instance)
   * @param {object} _successorState - State after applying task (already simulated)
   * @param {number} successorDistance - Distance to goal from successor state (already calculated)
   * @param {number} currentDistance - Distance to goal from current state
   * @param {object} goal - Goal being planned for (used for diagnostic logging)
   * @returns {boolean} True if task can be reused
   * @private
   */
  #isTaskReusable(task, currentNode, _successorState, successorDistance, currentDistance, goal) {
    // 1. Check if distance reduced (same check as #taskReducesDistance)
    if (successorDistance >= currentDistance) {
      const goalType = detectGoalType(goal.goalState);
      const overshootAllowed = allowsOvershoot(goal.goalState);

      this.#logger.debug('Task does not reduce distance, not reusable', {
        taskId: task.id,
        currentDistance,
        successorDistance,
        goalType,
        allowsOvershoot: overshootAllowed,
      });
      return false;
    }

    // 2. Check reuse limit
    const actionPath = currentNode.getPath();
    const taskUsageCount = actionPath.filter((a) => a.taskId === task.id).length;
    const maxReuse = task.maxReuse || 10; // Default: max 10 instances

    if (taskUsageCount >= maxReuse) {
      this.#logger.debug('Task reuse limit reached', {
        taskId: task.id,
        usageCount: taskUsageCount,
        maxReuse,
      });
      return false;
    }

    return true;
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

  /**
   * Test-only accessor for #getTaskLibrary
   *
   * @param {string} actorId - Actor entity ID
   * @returns {Array<object>} Filtered task definitions
   */
  testGetTaskLibrary(actorId) {
    return this.#getTaskLibrary(actorId);
  }

  /**
   * Test-only accessor for #bindTaskParameters
   *
   * @param {object} task - Task definition
   * @param {object} state - Planning state
   * @param {string} actorId - Actor entity ID
   * @returns {object|null} Bound parameters or null
   */
  testBindTaskParameters(task, state, actorId) {
    return this.#bindTaskParameters(task, state, actorId);
  }

  /**
   * Test-only accessor for #getApplicableTasks
   *
   * @param {Array<object>} tasks - Task library
   * @param {object} state - Planning state
   * @param {string} actorId - Actor entity ID
   * @param {object|null} goal - Optional goal for distance checking
   * @returns {Array<object>} Applicable tasks with bound parameters
   */
  testGetApplicableTasks(tasks, state, actorId, goal = null) {
    return this.#getApplicableTasks(tasks, state, actorId, goal);
  }

  /**
   * Test-only accessor for #taskReducesDistance
   *
   * @param {object} task - Task definition
   * @param {object} currentState - Current planning state
   * @param {object} goal - Goal definition
   * @param {string} actorId - Actor entity ID
   * @returns {boolean} True if task reduces distance to goal
   */
  testTaskReducesDistance(task, currentState, goal, actorId) {
    return this.#taskReducesDistance(task, currentState, goal, actorId);
  }

  /**
   * Test-only accessor for #hasNumericConstraints
   *
   * @param {object} goal - Goal definition
   * @returns {boolean} True if goal has numeric constraints
   */
  testHasNumericConstraints(goal) {
    return this.#hasNumericConstraints(goal);
  }
}

export default GoapPlanner;
