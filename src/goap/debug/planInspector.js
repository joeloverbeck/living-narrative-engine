/**
 * @file Plan Inspector for GOAP debugging
 * Provides human-readable display of active GOAP plans
 * @see goapController.js
 */

import { assertNonBlankString } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import { goalHasPureNumericRoot } from '../planner/goalConstraintUtils.js';

/**
 * Inspects and formats GOAP plans for debugging
 *
 * Reads plan state via GoapController debug API
 */
class PlanInspector {
  #goapController;
  #dataRegistry;
  #entityManager;
  #entityDisplayDataProvider;
  #logger;

  /**
   * Creates a new PlanInspector instance
   *
   * @param {object} dependencies - Service dependencies
   * @param {object} dependencies.goapController - GOAP controller with debug API
   * @param {object} dependencies.dataRegistry - Data registry for goal/task definitions
   * @param {object} dependencies.entityManager - Entity manager for entity lookup
   * @param {object} dependencies.entityDisplayDataProvider - Entity name provider
   * @param {object} dependencies.logger - Logger instance
   */
  constructor({
    goapController,
    dataRegistry,
    entityManager,
    entityDisplayDataProvider,
    logger,
  }) {
    ensureValidLogger(logger, 'logger');
    this.#logger = logger;

    if (!goapController) {
      throw new Error('goapController is required');
    }
    if (!dataRegistry) {
      throw new Error('dataRegistry is required');
    }
    if (!entityManager) {
      throw new Error('entityManager is required');
    }
    if (!entityDisplayDataProvider) {
      throw new Error('entityDisplayDataProvider is required');
    }

    this.#goapController = goapController;
    this.#dataRegistry = dataRegistry;
    this.#entityManager = entityManager;
    this.#entityDisplayDataProvider = entityDisplayDataProvider;
  }

  /**
   * Inspect active plan for an actor (text format)
   *
   * @param {string} actorId - Actor ID to inspect
   * @returns {string} Formatted plan text
   */
  inspect(actorId) {
    assertNonBlankString(actorId, 'actorId', 'PlanInspector.inspect', this.#logger);

    const plan = this.#goapController.getActivePlan(actorId);
    if (!plan) {
      return this.#formatNoActivePlan(actorId);
    }

    return this.#formatPlan(plan);
  }

  /**
   * Inspect active plan for an actor (JSON format)
   *
   * @param {string} actorId - Actor ID to inspect
   * @returns {object|null} Plan data or null
   */
  inspectJSON(actorId) {
    assertNonBlankString(actorId, 'actorId', 'PlanInspector.inspectJSON', this.#logger);

    const plan = this.#goapController.getActivePlan(actorId);
    if (!plan) {
      return null;
    }

    const goalDef = this.#dataRegistry.getGoalDefinition(plan.goal.id);
    const failedGoals = this.#goapController.getFailedGoals(actorId);
    const failedTasks = this.#goapController.getFailedTasks(actorId);

    const heuristicSummary = this.#describeNumericHeuristic(plan.goal);

    return {
      actorId: plan.actorId,
      goal: {
        id: plan.goal.id,
        name: goalDef?.name || plan.goal.id,
        description: goalDef?.description || '',
        priority: plan.goal.priority,
        numericHeuristic: heuristicSummary,
      },
      tasks: plan.tasks.map((task, index) => {
        const taskDef = this.#dataRegistry.get('tasks', task.id);
        return {
          id: task.id,
          name: taskDef?.name || task.id,
          description: taskDef?.description || '',
          parameters: task.parameters || {},
          status:
            index < plan.currentStep
              ? 'COMPLETED'
              : index === plan.currentStep
                ? 'CURRENT'
                : 'PENDING',
        };
      }),
      currentStep: plan.currentStep,
      createdAt: plan.createdAt,
      lastValidated: plan.lastValidated,
      failures: {
        goals: this.#formatFailureCount(failedGoals),
        tasks: this.#formatFailureCount(failedTasks),
      },
    };
  }

  /**
   * Format complete plan as text
   *
   * @private
   * @param {object} plan - Active plan
   * @returns {string} Formatted text
   */
  #formatPlan(plan) {
    const goalDef = this.#dataRegistry.getGoalDefinition(plan.goal.id);
    const failedGoals = this.#goapController.getFailedGoals(plan.actorId);
    const failedTasks = this.#goapController.getFailedTasks(plan.actorId);

    const heuristicSummary = this.#describeNumericHeuristic(plan.goal);

    const lines = [];
    lines.push(`=== GOAP Plan: Achieve '${plan.goal.id}' ===`);
    lines.push(`Actor: ${plan.actorId}`);
    lines.push(`Goal: ${goalDef?.name || plan.goal.id}`);

    if (goalDef?.description) {
      lines.push(`Description: ${goalDef.description}`);
    }

    lines.push(`Goal Priority: ${plan.goal.priority}`);
    lines.push(`Numeric Heuristic: ${heuristicSummary.status}`);
    lines.push(`Heuristic Reason: ${heuristicSummary.reason}`);
    lines.push(`Plan Length: ${plan.tasks.length} task(s)`);
    lines.push(`Created: ${new Date(plan.createdAt).toISOString()}`);
    lines.push(`Last Validated: ${new Date(plan.lastValidated).toISOString()}`);
    lines.push('');
    lines.push('Tasks:');

    plan.tasks.forEach((task, index) => {
      lines.push(this.#formatTask(task, index, plan.currentStep));
    });

    lines.push('');
    lines.push('Failure Tracking:');
    lines.push(`  Failed Goals: ${this.#formatFailureCount(failedGoals)}`);
    lines.push(`  Failed Tasks: ${this.#formatFailureCount(failedTasks)}`);

    if (failedGoals.length > 0) {
      lines.push('');
      lines.push('  Goal Failure Details:');
      failedGoals.forEach(({ goalId, failures }) => {
        lines.push(`    ${goalId}: ${failures.length} failure(s)`);
        failures.forEach(({ reason, code, timestamp }) => {
          const label = code ? `[${code}] ` : '';
          lines.push(`      - ${label}${reason} (${new Date(timestamp).toISOString()})`);
        });
      });
    }

    if (failedTasks.length > 0) {
      lines.push('');
      lines.push('  Task Failure Details:');
      failedTasks.forEach(({ taskId, failures }) => {
        lines.push(`    ${taskId}: ${failures.length} failure(s)`);
        failures.forEach(({ reason, code, timestamp }) => {
          const label = code ? `[${code}] ` : '';
          lines.push(`      - ${label}${reason} (${new Date(timestamp).toISOString()})`);
        });
      });
    }

    lines.push('');
    lines.push('=== End Plan ===');

    return lines.join('\n');
  }

  /**
   * Describe whether numeric heuristics are active for the goal.
   *
   * @param {object} goal - Goal definition
   * @returns {{status: string, reason: string, active: boolean}}
   */
  #describeNumericHeuristic(goal) {
    if (!goal) {
      return {
        status: 'UNKNOWN',
        reason: 'Goal not available',
        active: false,
      };
    }

    const active = goalHasPureNumericRoot(goal);
    return active
      ? {
          status: 'ACTIVE (pure numeric root comparator)',
          reason: 'Root operator is <=, <, >=, or >',
          active: true,
        }
      : {
          status: 'BYPASSED (composite/structural goal)',
          reason: 'Root operator is not a numeric comparator',
          active: false,
        };
  }

  /**
   * Format single task with status
   *
   * @private
   * @param {object} task - Task object
   * @param {number} index - Task index
   * @param {number} currentStep - Current step index
   * @returns {string} Formatted task
   */
  #formatTask(task, index, currentStep) {
    const taskDef = this.#dataRegistry.get('tasks', task.id);
    const status =
      index < currentStep ? 'COMPLETED' : index === currentStep ? 'CURRENT' : 'PENDING';

    const lines = [];
    lines.push(`  ${index + 1}. [${task.id}] (${status})`);

    if (taskDef?.description) {
      lines.push(`     ${taskDef.description}`);
    }

    if (task.parameters && Object.keys(task.parameters).length > 0) {
      lines.push('     Parameters:');
      Object.entries(task.parameters).forEach(([key, value]) => {
        lines.push(`       - ${this.#formatParameter(key, value)}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Format parameter with entity resolution
   *
   * @private
   * @param {string} key - Parameter key
   * @param {string|number|boolean|object} value - Parameter value
   * @returns {string} Formatted parameter
   */
  #formatParameter(key, value) {
    // If value looks like an entity ID, try to resolve name
    if (typeof value === 'string' && this.#entityManager.getEntityInstance(value)) {
      const entityName = this.#entityDisplayDataProvider.getEntityName(value, value);
      return `${key}: "${entityName}" (${value})`;
    }

    // Otherwise, display as-is
    return `${key}: ${JSON.stringify(value)}`;
  }

  /**
   * Count total failures from failure data
   *
   * @private
   * @param {Array<{goalId?: string, taskId?: string, failures: Array<{reason: string, timestamp: number}>}>} failureData - Failure data array
   * @returns {number} Total failure count
   */
  #formatFailureCount(failureData) {
    return failureData.reduce((total, item) => total + item.failures.length, 0);
  }

  /**
   * Format no active plan message
   *
   * @private
   * @param {string} actorId - Actor ID
   * @returns {string} No plan message
   */
  #formatNoActivePlan(actorId) {
    return `No active GOAP plan for actor: ${actorId}`;
  }
}

export default PlanInspector;
