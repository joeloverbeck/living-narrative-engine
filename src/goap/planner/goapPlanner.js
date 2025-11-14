/**
 * @file GOAP planner implementing A* search for goal-based planning
 * @see planningNode.js
 * @see planningEffectsSimulator.js
 * @see heuristicRegistry.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import MinHeap from './minHeap.js';
import PlanningNode from './planningNode.js';

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

  /** @type {import('./planningEffectsSimulator.js').default} */
  #effectsSimulator;

  /** @type {import('./heuristicRegistry.js').default} */
  #heuristicRegistry;

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
   * @param {import('./planningEffectsSimulator.js').default} deps.effectsSimulator - Effects simulator for state transformation
   * @param {import('./heuristicRegistry.js').default} deps.heuristicRegistry - Heuristic registry for A* estimates
   */
  constructor({ logger, jsonLogicService, gameDataRepository, entityManager, scopeRegistry, scopeEngine, spatialIndexManager, effectsSimulator, heuristicRegistry }) {
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

    validateDependency(effectsSimulator, 'IPlanningEffectsSimulator', this.#logger, {
      requiredMethods: ['simulateEffects'],
    });
    this.#effectsSimulator = effectsSimulator;

    validateDependency(heuristicRegistry, 'IHeuristicRegistry', this.#logger, {
      requiredMethods: ['calculate'],
    });
    this.#heuristicRegistry = heuristicRegistry;

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
   * @param {object} options - Search configuration
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
  plan(actorId, goal, initialState, options = {}) {
    // 1. Extract and validate options
    const heuristic = options.heuristic || 'goal-distance';
    const maxNodes = options.maxNodes || 1000;
    const maxTime = options.maxTime || 5000;
    const maxDepth = options.maxDepth || 20;

    this.#logger.info('Starting A* search', {
      actorId,
      goalId: goal.id,
      heuristic,
      limits: { maxNodes, maxTime, maxDepth },
    });

    // 2. Get task library for actor
    const taskLibrary = this.#getTaskLibrary(actorId);
    if (taskLibrary.length === 0) {
      this.#logger.warn('No tasks available for actor', { actorId });
      return null;
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
        return null;
      }

      // 7.2 Check node limit
      if (nodesExpanded >= maxNodes) {
        this.#logger.warn('Node limit reached', {
          nodesExpanded,
          maxNodes,
        });
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

      this.#logger.debug('Expanding node', {
        gScore: current.gScore,
        hScore: current.hScore,
        fScore: current.fScore,
        task: current.task?.id,
      });

      // 7.4 Goal check - BEFORE adding to closed set
      if (this.#goalSatisfied(current.state, goal)) {
        this.#logger.info('Goal reached', {
          nodesExpanded,
          planLength: current.gScore,
          timeElapsed: Date.now() - startTime,
        });
        return current.getPath();
      }

      // 7.5 Add to closed set
      const currentHash = this.#hashState(current.state);
      closedSet.add(currentHash);

      // 7.6 Check depth limit
      if (current.gScore >= maxDepth) {
        this.#logger.debug('Depth limit reached for node', {
          depth: current.gScore,
          maxDepth,
        });
        continue; // Skip expanding this node
      }

      // 7.7 Generate successors
      const applicableTasks = this.#getApplicableTasks(
        taskLibrary,
        current.state,
        actorId
      );

      for (const task of applicableTasks) {
        // 7.7.1 Build effect simulation context
        const effectContext = {
          actorId,
          taskId: task.id,
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
            taskId: task.id,
            error: err.message,
          });
          continue; // Skip this task
        }

        if (!simulationResult.success) {
          this.#logger.debug('Effect simulation unsuccessful', {
            taskId: task.id,
            error: simulationResult.error,
          });
          continue; // Skip this task
        }

        const successorState = simulationResult.state;
        const successorHash = this.#hashState(successorState);

        // 7.7.3 Skip if already in closed set
        if (closedSet.has(successorHash)) {
          this.#logger.debug('State already visited', {
            taskId: task.id,
          });
          continue;
        }

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
            taskId: task.id,
            error: err.message,
          });
          successorHScore = Infinity; // Inadmissible - will be deprioritized
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
              taskId: task.id,
              oldGScore: existing.gScore,
              newGScore: successor.gScore,
            });
            openList.remove(existingIndex);
            openList.push(successor);
          } else {
            this.#logger.debug('Keeping existing better path', {
              taskId: task.id,
            });
          }
        } else {
          // New state - add to open list
          this.#logger.debug('Adding successor to open list', {
            taskId: task.id,
            gScore: successor.gScore,
            hScore: successor.hScore,
            fScore: successor.fScore,
          });
          openList.push(successor);
        }
      }
    }

    // 8. Open list exhausted - no solution
    this.#logger.warn('Goal unsolvable - open list exhausted', {
      nodesExpanded,
      timeElapsed: Date.now() - startTime,
    });
    return null;
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
