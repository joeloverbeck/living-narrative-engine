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

  /**
   * Create new GOAP planner instance
   *
   * @param {object} deps - Dependencies
   * @param {import('../../logging/logger.js').default} deps.logger - Logger instance
   * @param {import('../../logic/services/jsonLogicEvaluationService.js').default} deps.jsonLogicService - JSON Logic evaluation service
   * @param {import('../../data/gameDataRepository.js').GameDataRepository} deps.gameDataRepository - Game data repository for loading tasks
   * @param {import('../../interfaces/IEntityManager.js').IEntityManager} deps.entityManager - Entity manager for retrieving actor entities
   * @param {import('../../scopeDsl/scopeRegistry.js').default} deps.scopeRegistry - Scope registry for retrieving scope ASTs
   * @param {import('../../scopeDsl/engine.js').default} deps.scopeEngine - Scope engine for resolving scopes
   * @param {import('../../interfaces/ISpatialIndexManager.js').ISpatialIndexManager} deps.spatialIndexManager - Spatial index manager for runtime context
   */
  constructor({ logger, jsonLogicService, gameDataRepository, entityManager, scopeRegistry, scopeEngine, spatialIndexManager }) {
    this.#logger = ensureValidLogger(logger);

    validateDependency(jsonLogicService, 'JsonLogicEvaluationService', this.#logger, {
      requiredMethods: ['evaluateCondition'],
    });
    this.#jsonLogicService = jsonLogicService;

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
    // 1. Get all tasks from repository
    // Tasks are stored in registry with key 'tasks' and retrieved via generic get()
    const tasksData = this.#gameDataRepository.get('tasks');

    if (!tasksData) {
      this.#logger.warn('No tasks available in repository');
      return [];
    }

    // 2. Flatten tasks from all mods into single array
    // Tasks are stored as: { modId: { taskId: taskData, ... }, ... }
    const allTasks = [];
    for (const modId in tasksData) {
      const modTasks = tasksData[modId];
      if (modTasks && typeof modTasks === 'object') {
        for (const taskId in modTasks) {
          allTasks.push(modTasks[taskId]);
        }
      }
    }

    if (allTasks.length === 0) {
      this.#logger.warn('No tasks found in repository data');
      return [];
    }

    this.#logger.debug(`Filtering ${allTasks.length} tasks for actor ${actorId}`);

    // 3. Get actor entity for structural gate evaluation
    // CRITICAL: Use getEntityInstance() not getEntity()
    const actor = this.#entityManager.getEntityInstance(actorId);

    if (!actor) {
      this.#logger.error(`Actor not found: ${actorId}`);
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

    // 2. CRITICAL: Use scopeRegistry.getScopeAst(), NOT gameDataRepository.getScope()
    const scopeAst = this.#scopeRegistry.getScopeAst(task.planningScope);
    if (!scopeAst) {
      this.#logger.warn(`Planning scope not found: ${task.planningScope}`, {
        taskId: task.id,
      });
      return null;
    }

    // 3. Get actor entity
    const actorEntity = this.#entityManager.getEntityInstance(actorId);
    if (!actorEntity) {
      this.#logger.error(`Actor entity not found: ${actorId}`, {
        taskId: task.id,
      });
      return null;
    }

    // 4. CRITICAL: Build runtimeCtx matching RuntimeContext type exactly
    // Property name is "jsonLogicEval" not "jsonLogicService"
    // spatialIndexManager is REQUIRED
    const runtimeCtx = {
      entityManager: this.#entityManager,
      spatialIndexManager: this.#spatialIndexManager,
      jsonLogicEval: this.#jsonLogicService,
      logger: this.#logger,
    };

    // 5. Resolve scope to entity set
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
          actorId,
        });
        return null;
      }

      // 6. Optimistic binding: take first entity from Set
      const iterator = scopeResult.values();
      const first = iterator.next();

      if (first.done) {
        this.#logger.debug('Scope returned empty iterator', {
          taskId: task.id,
          scopeId: task.planningScope,
        });
        return null;
      }

      // 7. Bind to parameter (convention: 'target' for single-target scopes)
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
        scopeId: task.planningScope,
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
   * 3. Returns only tasks that successfully bind parameters
   *
   * Tasks without planningScope are included as-is (no parameter binding needed).
   * Tasks that fail parameter binding are excluded from the result.
   *
   * @param {Array<object>} tasks - Task library (pre-filtered by structural gates)
   * @param {object} state - Current planning state
   * @param {string} actorId - Actor entity ID
   * @returns {Array<object>} Tasks with bound parameters added to each task object
   * @private
   * @example
   * const taskLibrary = this.#getTaskLibrary('actor-123');
   * const applicable = this.#getApplicableTasks(taskLibrary, state, 'actor-123');
   * // Returns: [
   * //   { id: 'core:consume_item', boundParams: { target: 'apple-456' }, ... },
   * //   { id: 'core:rest', ... } // No params needed
   * // ]
   */
  #getApplicableTasks(tasks, state, actorId) {
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
   * @returns {Array<object>} Applicable tasks with bound parameters
   */
  testGetApplicableTasks(tasks, state, actorId) {
    return this.#getApplicableTasks(tasks, state, actorId);
  }
}

export default GoapPlanner;
