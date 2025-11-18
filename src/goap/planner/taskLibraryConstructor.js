/**
 * @file TaskLibraryConstructor - Planning-phase optimization that pre-filters tasks
 * @description Evaluates structural gates to build per-actor libraries of applicable tasks,
 * reducing planning search space by filtering out structurally incompatible tasks.
 * @see goapPlanner.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * Constructs task libraries for actors by evaluating structural gates.
 * Structural gates are coarse "is this task even relevant in principle?" checks
 * that differ from execution-time gates (which check "can I do this right now?").
 *
 * Performance Impact:
 * - Without library: O(all_tasks × planning_steps)
 * - With library: O(applicable_tasks × planning_steps)
 * - Target: < 50ms for 100 tasks with cache miss
 * - Expected filtering: 50-80% of tasks
 *
 * @example
 * const library = taskLibraryConstructor.constructLibrary('actor-123');
 * // Returns only tasks whose structural gates pass for this actor
 * // e.g., tasks requiring digestive_system excluded for non-organic actors
 */
class TaskLibraryConstructor {
  #dataRegistry;
  #entityManager;
  #contextAssembly;
  #jsonLogicService;
  #logger;
  #cache;

  /**
   * Creates a new TaskLibraryConstructor instance.
   *
   * @param {object} dependencies - Injected dependencies
   * @param {object} dependencies.dataRegistry - IDataRegistry for task retrieval
   * @param {object} dependencies.entityManager - IEntityManager for actor components
   * @param {object} dependencies.contextAssembly - IContextAssemblyService for context building
   * @param {object} dependencies.jsonLogicService - IJsonLogicService for gate evaluation
   * @param dependencies.jsonLogicEvaluationService
   * @param {object} dependencies.logger - ILogger for logging
   */
  constructor({
    dataRegistry,
    entityManager,
    contextAssembly,
    jsonLogicService,
    jsonLogicEvaluationService,
    logger,
  }) {
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['getAll'],
    });
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getAllComponentTypesForEntity'],
    });
    validateDependency(contextAssembly, 'IContextAssemblyService', logger, {
      requiredMethods: ['assemblePlanningContext'],
    });

    const logicService = jsonLogicService ?? jsonLogicEvaluationService;

    validateDependency(logicService, 'JsonLogicEvaluationService', logger, {
      requiredMethods: ['evaluate'],
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error', 'info'],
    });

    this.#dataRegistry = dataRegistry;
    this.#entityManager = entityManager;
    this.#contextAssembly = contextAssembly;
    this.#jsonLogicService = logicService;
    this.#logger = logger;
    this.#cache = new Map();
  }

  /**
   * Constructs a task library for the given actor by evaluating structural gates.
   * Results are cached based on the actor's component set.
   *
   * @param {string} actorId - Entity ID of the actor
   * @returns {Array<object>} Array of task definitions applicable to this actor
   * @throws {Error} If actorId is missing or actor not found
   */
  constructLibrary(actorId) {
    if (!actorId || typeof actorId !== 'string') {
      const message = 'Actor ID must be a non-empty string';
      this.#logger.error(`[TaskLibraryConstructor] ${message}`);
      throw new Error(message);
    }

    this.#logger.debug(`[TaskLibraryConstructor] Constructing task library for actor: ${actorId}`);

    try {
      // 1. Generate cache key from actor's actual components
      const cacheKey = this.#generateCacheKey(actorId);

      // 2. Check cache
      if (this.#cache.has(cacheKey)) {
        this.#logger.debug(
          `[TaskLibraryConstructor] Cache hit for actor ${actorId} with key: ${cacheKey}`
        );
        return this.#cache.get(cacheKey);
      }

      this.#logger.debug(
        `[TaskLibraryConstructor] Cache miss for actor ${actorId}, constructing library...`
      );

      // 3. Get all tasks from registry
      const allTasks = this.#getAllTasksFromRegistry();
      this.#logger.debug(`[TaskLibraryConstructor] Retrieved ${allTasks.length} total tasks`);

      // 4. Filter by structural gates
      const applicableTasks = this.#filterTasksByStructuralGates(allTasks, actorId);

      // 5. Cache and log
      this.#cache.set(cacheKey, applicableTasks);
      this.#logLibraryStats(actorId, allTasks.length, applicableTasks.length);

      return applicableTasks;
    } catch (error) {
      const message = `Failed to construct task library for actor ${actorId}: ${error.message}`;
      this.#logger.error(`[TaskLibraryConstructor] ${message}`, error);
      throw new Error(message);
    }
  }

  /**
   * Clears the task library cache.
   * Should be called before each planning cycle to ensure fresh libraries.
   *
   * @returns {number} Number of cache entries cleared
   */
  clearCache() {
    const size = this.#cache.size;
    this.#cache.clear();
    this.#logger.debug(`[TaskLibraryConstructor] Cache cleared: ${size} entries removed`);
    return size;
  }

  /**
   * Gets cache statistics for monitoring and debugging.
   *
   * @returns {object} Cache statistics
   */
  getCacheStats() {
    return {
      size: this.#cache.size,
      keys: Array.from(this.#cache.keys()),
    };
  }

  /**
   * Generates a cache key based on the actor's current component set.
   * Uses dynamic component discovery (NOT hardcoded list).
   *
   * @private
   * @param {string} actorId - Entity ID of the actor
   * @returns {string} Cache key in format "actorId:component1|component2|..."
   */
  #generateCacheKey(actorId) {
    try {
      // Use getAllComponentTypesForEntity which directly returns component type IDs
      const componentIds = this.#entityManager.getAllComponentTypesForEntity(actorId);
      if (!componentIds || componentIds.length === 0) {
        throw new Error(`Actor not found or has no components: ${actorId}`);
      }

      // Sort for consistent cache keys
      const sortedComponentIds = [...componentIds].sort();
      const capabilitiesHash = sortedComponentIds.join('|');
      const cacheKey = `${actorId}:${capabilitiesHash}`;

      this.#logger.debug(
        `[TaskLibraryConstructor] Generated cache key for ${actorId}: ${cacheKey}`
      );

      return cacheKey;
    } catch (error) {
      const message = `Failed to generate cache key for actor ${actorId}: ${error.message}`;
      this.#logger.error(`[TaskLibraryConstructor] ${message}`, error);
      throw new Error(message);
    }
  }

  /**
   * Retrieves all task definitions from the registry across all mods.
   *
   * @private
   * @returns {Array<object>} Array of all task definitions
   */
  #getAllTasksFromRegistry() {
    try {
      // Get all tasks from registry (stored with category 'tasks')
      const allTasks = this.#dataRegistry.getAll('tasks') || [];

      this.#logger.debug(
        `[TaskLibraryConstructor] Retrieved ${allTasks.length} total tasks from registry`
      );

      return allTasks;
    } catch (error) {
      const message = `Failed to retrieve tasks from registry: ${error.message}`;
      this.#logger.error(`[TaskLibraryConstructor] ${message}`, error);
      throw new Error(message);
    }
  }

  /**
   * Filters tasks by evaluating their structural gates against the actor.
   *
   * @private
   * @param {Array<object>} tasks - All task definitions
   * @param {string} actorId - Entity ID of the actor
   * @returns {Array<object>} Filtered array of applicable tasks
   */
  #filterTasksByStructuralGates(tasks, actorId) {
    const applicableTasks = [];

    for (const task of tasks) {
      try {
        const isApplicable = this.#evaluateStructuralGates(task, actorId);
        if (isApplicable) {
          applicableTasks.push(task);
        }
      } catch (error) {
        // Safe default: exclude task on evaluation error
        this.#logger.warn(
          `[TaskLibraryConstructor] Failed to evaluate structural gates for task ${task.id || 'unknown'}, excluding from library: ${error.message}`
        );
      }
    }

    return applicableTasks;
  }

  /**
   * Evaluates the structural gates for a single task.
   *
   * @private
   * @param {object} task - Task definition
   * @param {string} actorId - Entity ID of the actor
   * @returns {boolean} True if task is applicable to this actor
   */
  #evaluateStructuralGates(task, actorId) {
    // If no structural gates, task is always applicable
    if (!task.structuralGates || !task.structuralGates.condition) {
      this.#logger.debug(
        `[TaskLibraryConstructor] Task ${task.id || 'unknown'} has no structural gates, including in library`
      );
      return true;
    }

    try {
      // Assemble planning context
      const context = this.#contextAssembly.assemblePlanningContext(actorId);

      // Evaluate structural gate condition
      const result = this.#jsonLogicService.evaluate(task.structuralGates.condition, context);

      this.#logger.debug(
        `[TaskLibraryConstructor] Structural gate evaluation for task ${task.id || 'unknown'}: ${result ? 'PASS' : 'FAIL'}`
      );

      return Boolean(result);
    } catch (error) {
      const message = `Structural gate evaluation failed for task ${task.id || 'unknown'}: ${error.message}`;
      this.#logger.warn(`[TaskLibraryConstructor] ${message}`);
      // Safe default: exclude task on error
      return false;
    }
  }

  /**
   * Logs statistics about the constructed library.
   *
   * @private
   * @param {string} actorId - Entity ID of the actor
   * @param {number} totalTasks - Total number of tasks considered
   * @param {number} applicableTasks - Number of applicable tasks
   */
  #logLibraryStats(actorId, totalTasks, applicableTasks) {
    const filteredCount = totalTasks - applicableTasks;
    const filterPercentage = totalTasks > 0 ? ((filteredCount / totalTasks) * 100).toFixed(1) : 0;

    this.#logger.info(
      `[TaskLibraryConstructor] Library constructed for ${actorId}: ${applicableTasks}/${totalTasks} tasks (${filterPercentage}% filtered)`
    );
  }
}

export default TaskLibraryConstructor;
