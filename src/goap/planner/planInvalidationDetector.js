/**
 * @file Plan invalidation detector for GOAP system
 * @see goapPlanner.js
 * @see jsonLogicEvaluationService.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import { normalizePlanningPreconditions } from '../utils/planningPreconditionUtils.js';

/**
 * Invalidation reason constants for diagnostic output
 */
const INVALIDATION_REASONS = {
  PRECONDITION_VIOLATED: 'precondition_violated',
  EVALUATION_ERROR: 'evaluation_error',
  TASK_NOT_FOUND: 'task_not_found',
  INVALID_PLAN_STRUCTURE: 'invalid_plan_structure',
};

/**
 * Plan invalidation detector for GOAP system
 *
 * Re-checks task preconditions before execution to detect when world state changes
 * invalidate the current plan. Enables responsive AI that adapts to dynamic environments.
 *
 * Invalidation policies:
 * - strict: Check all tasks in plan (most responsive, highest cost)
 * - lenient: Check only critical tasks (balanced approach)
 * - periodic: Check every N tasks (performance optimization)
 *
 * @class
 */
class PlanInvalidationDetector {
  /** @type {import('../../logging/logger.js').default} */
  #logger;

  /** @type {import('../../logic/services/jsonLogicEvaluationService.js').default} */
  #jsonLogicService;

  /** @type {import('../../data/interfaces/IDataRegistry.js').IDataRegistry} */
  #dataRegistry;

  /**
   * Create new plan invalidation detector instance
   *
   * @param {object} deps - Dependencies
   * @param {import('../../logging/logger.js').default} deps.logger - Logger instance
   * @param {import('../../logic/services/jsonLogicEvaluationService.js').default} deps.jsonLogicEvaluationService - JSON Logic evaluation service
   * @param {import('../../data/interfaces/IDataRegistry.js').IDataRegistry} deps.dataRegistry - Data registry for loading task definitions
   */
  constructor({ logger, jsonLogicEvaluationService, dataRegistry }) {
    this.#logger = ensureValidLogger(logger);

    validateDependency(
      jsonLogicEvaluationService,
      'JsonLogicEvaluationService',
      this.#logger,
      {
        requiredMethods: ['evaluate'],
      }
    );
    this.#jsonLogicService = jsonLogicEvaluationService;

    validateDependency(dataRegistry, 'IDataRegistry', this.#logger, {
      requiredMethods: ['get', 'getAll'],
    });
    this.#dataRegistry = dataRegistry;

    this.#logger.info('PlanInvalidationDetector initialized');
  }

  /**
   * Check if plan is still valid given current world state
   *
   * Re-evaluates task preconditions against current state to detect invalidation.
   * Returns detailed diagnostic information for debugging and analysis.
   *
   * @param {object} plan - Plan object from planner with tasks array
   * @param {object} currentState - Current world state (symbolic facts hash)
   * @param {object} context - Additional evaluation context
   * @param {string} context.actorId - Actor entity ID
   * @param {string} policy - Invalidation policy: 'strict' | 'lenient' | 'periodic'
   * @returns {object} Validation result with diagnostics
   * @example
   * const result = detector.checkPlanValidity(plan, currentState, { actorId: 'actor-123' }, 'strict');
   * // Returns: {
   * //   valid: false,
   * //   invalidatedAt: 2,
   * //   task: 'core:consume_food',
   * //   reason: 'precondition_violated',
   * //   precondition: { "var": "actor.has_food" },
   * //   currentStateSnapshot: {...},
   * //   diagnostics: [...]
   * // }
   */
  checkPlanValidity(plan, currentState, context, policy = 'strict') {
    // 1. Validate inputs
    if (!plan || !plan.tasks || !Array.isArray(plan.tasks)) {
      this.#logger.warn('Invalid plan structure', { plan });
      return {
        valid: false,
        reason: INVALIDATION_REASONS.INVALID_PLAN_STRUCTURE,
        diagnostics: [],
      };
    }

    if (!currentState || typeof currentState !== 'object') {
      this.#logger.warn('Invalid current state', { currentState });
      return {
        valid: false,
        reason: INVALIDATION_REASONS.INVALID_PLAN_STRUCTURE,
        diagnostics: [],
      };
    }

    if (!context || !context.actorId) {
      this.#logger.warn('Invalid context - actorId required', { context });
      return {
        valid: false,
        reason: INVALIDATION_REASONS.INVALID_PLAN_STRUCTURE,
        diagnostics: [],
      };
    }

    // 2. Empty plan is vacuously valid
    if (plan.tasks.length === 0) {
      this.#logger.debug('Empty plan is valid');
      return {
        valid: true,
        diagnostics: [],
      };
    }

    this.#logger.info('Checking plan validity', {
      actorId: context.actorId,
      taskCount: plan.tasks.length,
      policy,
    });

    // 3. Select tasks to check based on policy
    const stepsToCheck = this.#selectStepsForPolicy(plan.tasks, policy);

    // 4. Build evaluation context from current state
    const evaluationContext = this.#buildEvaluationContext(
      currentState,
      context.actorId
    );

    // 5. Collect diagnostics for each task
    const diagnostics = [];

    // 6. Check each selected task
    for (const [taskIndex, planStep] of stepsToCheck) {
      // 6.1 Load task definition
      const taskDefinition = this.#getTaskDefinition(planStep.taskId);

      if (!taskDefinition) {
        this.#logger.warn('Task definition not found', {
          taskId: planStep.taskId,
          taskIndex,
        });

        diagnostics.push({
          taskIndex,
          taskId: planStep.taskId,
          status: 'not_found',
        });

        return {
          valid: false,
          invalidatedAt: taskIndex,
          task: planStep.taskId,
          reason: INVALIDATION_REASONS.TASK_NOT_FOUND,
          currentStateSnapshot: this.#createStateSnapshot(currentState),
          diagnostics,
        };
      }

      const planningPreconditions = normalizePlanningPreconditions(
        taskDefinition,
        this.#logger,
        {
          actorId: context.actorId,
          origin: 'PlanInvalidationDetector.checkPlanValidity',
        }
      );

      // 6.2 Check if task has preconditions
      if (planningPreconditions.length === 0) {
        this.#logger.debug('Task has no preconditions, always valid', {
          taskId: planStep.taskId,
          taskIndex,
        });

        diagnostics.push({
          taskIndex,
          taskId: planStep.taskId,
          allPreconditionsSatisfied: true,
          noPreconditions: true,
        });

        continue;
      }

      // 6.3 Build context with task parameters
      const taskContext = {
        ...evaluationContext,
        ...(planStep.parameters || {}),
      };

      // 6.4 Evaluate each precondition
      let preconditionViolated = null;

      for (const precondition of planningPreconditions) {
        try {
          const satisfied = this.#jsonLogicService.evaluate(
            precondition.condition,
            taskContext
          );

          if (!satisfied) {
            // Precondition violated - plan is invalid
            this.#logger.info('Precondition violated', {
              taskId: planStep.taskId,
              taskIndex,
              precondition: precondition.description,
            });

            preconditionViolated = precondition;
            break;
          }
        } catch (err) {
          // Evaluation error - treat as conservative invalidation
          this.#logger.error('Precondition evaluation error', err, {
            taskId: planStep.taskId,
            taskIndex,
            precondition: precondition.description,
          });

          diagnostics.push({
            taskIndex,
            taskId: planStep.taskId,
            evaluationError: err.message,
            precondition: precondition.condition,
          });

          return {
            valid: false,
            invalidatedAt: taskIndex,
            task: planStep.taskId,
            reason: INVALIDATION_REASONS.EVALUATION_ERROR,
            error: err.message,
            precondition: precondition.condition,
            currentStateSnapshot: this.#createStateSnapshot(currentState),
            diagnostics,
          };
        }
      }

      // 6.5 Record diagnostic for this task
      if (preconditionViolated) {
        diagnostics.push({
          taskIndex,
          taskId: planStep.taskId,
          violatedPrecondition: preconditionViolated.condition,
          description: preconditionViolated.description,
        });

        return {
          valid: false,
          invalidatedAt: taskIndex,
          task: planStep.taskId,
          reason: INVALIDATION_REASONS.PRECONDITION_VIOLATED,
          precondition: preconditionViolated.condition,
          description: preconditionViolated.description,
          currentStateSnapshot: this.#createStateSnapshot(currentState),
          diagnostics,
        };
      } else {
        diagnostics.push({
          taskIndex,
          taskId: planStep.taskId,
          allPreconditionsSatisfied: true,
        });
      }
    }

    // 7. All checked tasks are valid
    this.#logger.info('Plan is valid', {
      actorId: context.actorId,
      tasksChecked: stepsToCheck.length,
      totalTasks: plan.tasks.length,
      policy,
    });

    return {
      valid: true,
      diagnostics,
    };
  }

  /**
   * Select tasks to check based on invalidation policy
   *
   * @param {Array<object>} tasks - Plan tasks array
   * @param {string} policy - Invalidation policy
   * @returns {Array<[number, object]>} Array of [index, task] tuples to check
   * @private
   */
  #selectStepsForPolicy(tasks, policy) {
    switch (policy) {
      case 'strict':
        // Check all tasks
        return tasks.map((task, index) => [index, task]);

      case 'lenient':
        // Check only critical tasks (those marked with isCritical flag)
        return tasks
          .map((task, index) => [index, task])
          .filter(([, task]) => task.isCritical === true);

      case 'periodic':
        // Check every 3rd task (configurable)
        return tasks
          .map((task, index) => [index, task])
          .filter(([index]) => index % 3 === 0);

      default:
        this.#logger.warn('Unknown policy, defaulting to strict', { policy });
        return tasks.map((task, index) => [index, task]);
    }
  }

  /**
   * Build JSON Logic evaluation context from planning state
   *
   * Converts flat state hash format to nested object structure for JSON Logic.
   * Mirrors the implementation from GoapPlanner for consistency.
   *
   * @param {object} state - Planning state hash
   * @param {string} actorId - Actor entity ID for context
   * @returns {object} Evaluation context
   * @private
   * @example
   * const state = {
   *   'entity-1:core:hungry': true,
   *   'entity-1:core:health': 50
   * };
   * const context = this.#buildEvaluationContext(state, 'entity-1');
   * // Returns: {
   * //   'entity-1': { core: { hungry: true, health: 50 } },
   * //   actor: 'entity-1',
   * //   state: { ... }
   * // }
   */
  #buildEvaluationContext(state, actorId) {
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

      // Add actor placeholder and state reference for custom operators
      context.actor = actorId;
      context.state = state;

      return context;
    } catch (err) {
      this.#logger.error('Context building failed', err, { state });
      return {
        actor: actorId,
        state: {},
      };
    }
  }

  /**
   * Get task definition from registry
   *
   * @param {string} taskId - Task ID in format 'modId:taskName'
   * @returns {object|null} Task definition or null if not found
   * @private
   */
  #getTaskDefinition(taskId) {
    try {
      // Validate task ID format
      if (!taskId || typeof taskId !== 'string') {
        this.#logger.warn('Invalid task ID', { taskId });
        return null;
      }

      // Get task directly from registry using qualified ID
      const task = this.#dataRegistry.get('tasks', taskId);

      if (!task) {
        this.#logger.warn('Task not found in registry', { taskId });
        return null;
      }

      return task;
    } catch (err) {
      this.#logger.error('Failed to get task definition', err, { taskId });
      return null;
    }
  }

  /**
   * Create minimal state snapshot for diagnostics
   *
   * @param {object} state - Full state hash
   * @returns {object} Minimal state snapshot for debugging
   * @private
   */
  #createStateSnapshot(state) {
    // For now, return a shallow clone
    // Future: could implement smart filtering to include only relevant facts
    return { ...state };
  }
}

export default PlanInvalidationDetector;
