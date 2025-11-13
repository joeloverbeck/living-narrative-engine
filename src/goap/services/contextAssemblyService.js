/**
 * @file Context assembly service for GOAP planning, refinement, and condition evaluation.
 * @see docs/goap/refinement-parameter-binding.md
 * @see docs/goap/refinement-condition-context.md
 */

import { validateDependency, assertNonBlankString } from '../../utils/dependencyUtils.js';
import { deepClone } from '../../utils/cloneUtils.js';
import ContextAssemblyError from '../errors/contextAssemblyError.js';

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../interfaces/coreServices.js').IEntityManager} IEntityManager
 */

/**
 * @typedef {object} Actor
 * @property {string} id - Entity ID
 * @property {object} components - Actor component data
 * @property {string[]} [knowledge] - Known entity IDs (when knowledge limitation enabled)
 */

/**
 * @typedef {object} World
 * @property {object} [locations] - Location data
 * @property {object} [time] - Time data
 */

/**
 * @typedef {object} Task
 * @property {string} id - Task ID (e.g., "core:consume_nourishing_item")
 * @property {object} params - Task parameters with resolved entity references
 */

/**
 * @typedef {object} Refinement
 * @property {object} localState - Accumulated step results during refinement
 */

/**
 * @typedef {object} PlanningContext
 * @property {Actor} actor - Actor data and knowledge
 * @property {World} world - World state snapshot
 */

/**
 * @typedef {object} RefinementContext
 * @property {Actor} actor - Actor data and knowledge
 * @property {World} world - World state snapshot
 * @property {Task} task - Current task being refined
 * @property {Refinement} refinement - Refinement execution state
 */

/**
 * Service for assembling execution contexts for GOAP operations.
 *
 * Provides the data environment for:
 * - Planning (GOAP state-space search)
 * - Refinement (task-to-primitive-action decomposition)
 * - Condition Evaluation (JSON Logic variable resolution)
 *
 * Knowledge Limitation:
 * - Default: Omniscient mode (all entities accessible)
 * - Feature flag: `enableKnowledgeLimitation` (for future core:known_to integration)
 * - Future: Filter entities by actor's knowledge when GOAPIMPL-023 completes
 */
class ContextAssemblyService {
  /** @type {IEntityManager} */
  #entityManager;

  /** @type {ILogger} */
  #logger;

  /** @type {boolean} */
  #enableKnowledgeLimitation;

  /**
   * @param {object} dependencies
   * @param {IEntityManager} dependencies.entityManager - Entity and component queries
   * @param {ILogger} dependencies.logger - Logging service
   * @param {boolean} [dependencies.enableKnowledgeLimitation] - Enable knowledge filtering
   */
  constructor({ entityManager, logger, enableKnowledgeLimitation = false }) {
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getEntity', 'getComponent'],
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });

    this.#entityManager = entityManager;
    this.#logger = logger;
    this.#enableKnowledgeLimitation = enableKnowledgeLimitation;

    if (this.#enableKnowledgeLimitation) {
      this.#logger.warn(
        '[ContextAssemblyService] Knowledge limitation enabled but core:known_to component not yet implemented. Defaulting to omniscient mode.'
      );
    }
  }

  /**
   * Assemble context for GOAP planning operations.
   *
   * @param {string} actorId - ID of the planning actor
   * @returns {PlanningContext} Planning context with actor and world data
   * @throws {ContextAssemblyError} If actor is invalid or context assembly fails
   */
  assemblePlanningContext(actorId) {
    assertNonBlankString(
      actorId,
      'Actor ID',
      'assemblePlanningContext',
      this.#logger
    );

    this.#logger.debug(
      `[ContextAssemblyService] Assembling planning context for actor: ${actorId}`
    );

    try {
      const actor = this.#assembleActorData(actorId);
      const world = this.#assembleWorldState();

      const context = {
        actor,
        world,
      };

      this.#logger.debug(
        `[ContextAssemblyService] Planning context assembled successfully for actor: ${actorId}`
      );

      return context;
    } catch (error) {
      const message = `Failed to assemble planning context for actor ${actorId}: ${error.message}`;
      this.#logger.error(`[ContextAssemblyService] ${message}`, error);
      throw new ContextAssemblyError(message, { actorId, cause: error });
    }
  }

  /**
   * Assemble context for task refinement operations.
   *
   * @param {string} actorId - ID of the actor refining the task
   * @param {object} task - Task to be refined
   * @param {string} task.id - Task ID (namespaced format: "modId:taskName")
   * @param {object} task.params - Task parameters
   * @param {object} [localState] - Current refinement local state
   * @returns {RefinementContext} Refinement context with actor, world, task, and refinement data
   * @throws {ContextAssemblyError} If actor or task is invalid, or context assembly fails
   */
  assembleRefinementContext(actorId, task, localState = {}) {
    assertNonBlankString(
      actorId,
      'Actor ID',
      'assembleRefinementContext',
      this.#logger
    );

    if (!task || typeof task !== 'object') {
      const message = 'Task must be a valid object';
      this.#logger.error(`[ContextAssemblyService] ${message}`);
      throw new ContextAssemblyError(message, { actorId, task });
    }

    assertNonBlankString(
      task.id,
      'Task ID',
      'assembleRefinementContext',
      this.#logger
    );

    if (!task.params || typeof task.params !== 'object') {
      const message = 'Task params must be a valid object';
      this.#logger.error(`[ContextAssemblyService] ${message}`);
      throw new ContextAssemblyError(message, { actorId, task });
    }

    this.#logger.debug(
      `[ContextAssemblyService] Assembling refinement context for actor: ${actorId}, task: ${task.id}`
    );

    try {
      const actor = this.#assembleActorData(actorId);
      const world = this.#assembleWorldState();

      const context = {
        actor,
        world,
        task: {
          id: task.id,
          params: deepClone(task.params),
        },
        refinement: {
          localState: deepClone(localState || {}),
        },
      };

      this.#logger.debug(
        `[ContextAssemblyService] Refinement context assembled successfully for actor: ${actorId}, task: ${task.id}`
      );

      return context;
    } catch (error) {
      const message = `Failed to assemble refinement context for actor ${actorId}, task ${task.id}: ${error.message}`;
      this.#logger.error(`[ContextAssemblyService] ${message}`, error);
      throw new ContextAssemblyError(message, {
        actorId,
        taskId: task.id,
        cause: error,
      });
    }
  }

  /**
   * Assemble context for JSON Logic condition evaluation.
   *
   * Transforms a context into a structure compatible with JSON Logic evaluation,
   * flattening nested objects for direct variable access.
   *
   * @param {PlanningContext|RefinementContext} context - Source context
   * @returns {object} Flattened context for JSON Logic evaluation
   * @throws {ContextAssemblyError} If context is invalid
   */
  assembleConditionContext(context) {
    if (!context || typeof context !== 'object') {
      const message = 'Context must be a valid object';
      this.#logger.error(`[ContextAssemblyService] ${message}`);
      throw new ContextAssemblyError(message, { context });
    }

    this.#logger.debug(
      '[ContextAssemblyService] Assembling condition evaluation context'
    );

    try {
      // JSON Logic expects direct property access
      // Transform nested structure to flat variable access
      const conditionContext = {
        actor: context.actor,
        world: context.world,
      };

      // Add task and refinement data if present (refinement context)
      if (context.task) {
        conditionContext.task = context.task;
      }

      if (context.refinement) {
        conditionContext.refinement = context.refinement;
      }

      this.#logger.debug(
        '[ContextAssemblyService] Condition context assembled successfully'
      );

      return conditionContext;
    } catch (error) {
      const message = `Failed to assemble condition context: ${error.message}`;
      this.#logger.error(`[ContextAssemblyService] ${message}`, error);
      throw new ContextAssemblyError(message, { cause: error });
    }
  }

  /**
   * Assemble actor data with components and knowledge.
   *
   * @private
   * @param {string} actorId - Actor entity ID
   * @returns {Actor} Actor data with components and optional knowledge
   * @throws {ContextAssemblyError} If actor doesn't exist or is invalid
   */
  #assembleActorData(actorId) {
    const entity = this.#entityManager.getEntity(actorId);

    if (!entity) {
      const message = `Actor entity not found: ${actorId}`;
      this.#logger.error(`[ContextAssemblyService] ${message}`);
      throw new ContextAssemblyError(message, { actorId });
    }

    const actorData = {
      id: actorId,
      components: deepClone(entity.components),
    };

    // Add knowledge data if knowledge limitation is enabled
    if (this.#enableKnowledgeLimitation) {
      actorData.knowledge = this.#getActorKnowledge(actorId);
    }

    return actorData;
  }

  /**
   * Get list of entities known to the actor.
   *
   * @private
   * @param {string} actorId - Actor entity ID
   * @returns {string[]} Array of known entity IDs
   */
  #getActorKnowledge(actorId) {
    // Feature flag implementation: Default to omniscient mode
    // Future: Query core:known_to component when GOAPIMPL-023 completes
    this.#logger.debug(
      `[ContextAssemblyService] Knowledge limitation enabled but not yet implemented. Returning all entities for actor: ${actorId}`
    );

    // Return all entity IDs (omniscient mode)
    const allEntities = Array.from(this.#entityManager.entities || []);
    return allEntities.map((entity) => entity.id);
  }

  /**
   * Assemble world state snapshot.
   *
   * Provides preliminary world data structure.
   * Phase 1: Basic world facts (locations, time)
   * Phase 2: Complete entity queries and scope DSL integration
   *
   * @private
   * @returns {World} World state data
   */
  #assembleWorldState() {
    // Preliminary world state structure
    // Future expansion: Complete entity queries, scope DSL integration
    const world = {
      locations: this.#getWorldLocations(),
      time: this.#getWorldTime(),
    };

    return world;
  }

  /**
   * Get world location data.
   *
   * @private
   * @returns {object} Location data
   */
  #getWorldLocations() {
    // Preliminary implementation
    // Future: Complete location query system
    return {};
  }

  /**
   * Get world time data.
   *
   * @private
   * @returns {object} Time data
   */
  #getWorldTime() {
    // Preliminary implementation
    // Future: Integrate with time management system
    return {};
  }
}

export default ContextAssemblyService;
