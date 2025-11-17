/**
 * @file GOAP lifecycle event types
 *
 * Event constants for the GOAP (Goal-Oriented Action Planning) system.
 * These events enable monitoring, debugging, and integration with other systems
 * through the event bus.
 *
 * Event Naming Convention: 'goap:event_name' (namespace:event_name pattern)
 */

/**
 * GOAP system event types
 *
 * @constant {Record<string, string>}
 */
export const GOAP_EVENTS = {
  /**
   * Dispatched when a goal is selected for planning
   * Payload: { actorId, goalId, priority }
   */
  GOAL_SELECTED: 'goap:goal_selected',

  /**
   * Dispatched when heuristics/operators cannot resolve a planning-state path
   * Payload: { actorId, goalId?, taskId?, path?, entityId?, componentId?, origin }
   */
  STATE_MISS: 'goap:state_miss',

  /**
   * Dispatched when a dependency contract validation completes
   * Payload: { dependency, requiredMethods, providedMethods, missingMethods, timestamp, status }
   */
  DEPENDENCY_VALIDATED: 'goap:dependency_validated',

  /**
   * Dispatched when an event violates the GOAP dispatch contract
   * Payload: { actorId?, eventType, code, reason, stack, timestamp }
   */
  EVENT_CONTRACT_VIOLATION: 'goap:event_contract_violation',

  /**
   * Dispatched when planning starts for a goal
   * Payload: { actorId, goalId }
   */
  PLANNING_STARTED: 'goap:planning_started',

  /**
   * Dispatched when planning completes successfully
   * Payload: { actorId, goalId, planLength, tasks }
   */
  PLANNING_COMPLETED: 'goap:planning_completed',

  /**
   * Dispatched when planning fails
   * Payload: { actorId, goalId, reason, code }
   */
  PLANNING_FAILED: 'goap:planning_failed',

  /**
   * Dispatched when an active plan becomes invalid
   * Payload: { goalId, reason, currentStep, totalSteps }
   */
  PLAN_INVALIDATED: 'goap:plan_invalidated',

  /**
   * Dispatched when replanning starts after invalidation
   * Payload: { goalId, previousStep }
   */
  REPLANNING_STARTED: 'goap:replanning_started',

  /**
   * Dispatched when task refinement process begins
   * Payload: { taskId, actorId, timestamp }
   */
  REFINEMENT_STARTED: 'goap:refinement_started',

  /**
   * Dispatched when a refinement method is selected
   * Payload: { taskId, methodId, actorId }
   */
  METHOD_SELECTED: 'goap:method_selected',

  /**
   * Dispatched when a task is successfully refined to action steps
   * Payload: { actorId, taskId, stepsGenerated, actionRefs }
   */
  TASK_REFINED: 'goap:task_refined',

  /**
   * Dispatched when task refinement process completes successfully
   * Payload: { taskId, methodId, actorId, stepsExecuted, success }
   */
  REFINEMENT_COMPLETED: 'goap:refinement_completed',

  /**
   * Dispatched when task refinement fails
   * Payload: { actorId, taskId, reason, fallbackBehavior }
   */
  REFINEMENT_FAILED: 'goap:refinement_failed',

  /**
   * Dispatched when an action hint is successfully generated
   * Payload: { actionId, targetBindings, taskId }
   */
  ACTION_HINT_GENERATED: 'goap:action_hint_generated',

  /**
   * Dispatched when action hint extraction/generation fails
   * Payload: { actionId, bindings, reason }
   */
  ACTION_HINT_FAILED: 'goap:action_hint_failed',

  /**
   * Dispatched when a goal is achieved (plan completes)
   * Payload: { goalId, totalSteps, duration }
   */
  GOAL_ACHIEVED: 'goap:goal_achieved',

  /**
   * Dispatched when a refinement method step begins execution
   * Payload: { actorId, taskId, methodId, stepIndex, step, timestamp }
   */
  REFINEMENT_STEP_STARTED: 'goap:refinement_step_started',

  /**
   * Dispatched when a refinement method step completes successfully
   * Payload: { actorId, taskId, methodId, stepIndex, result, duration, timestamp }
   */
  REFINEMENT_STEP_COMPLETED: 'goap:refinement_step_completed',

  /**
   * Dispatched when a refinement method step fails
   * Payload: { actorId, taskId, methodId, stepIndex, error, timestamp }
   */
  REFINEMENT_STEP_FAILED: 'goap:refinement_step_failed',

  /**
   * Dispatched when refinement local state is updated
   * Payload: { actorId, taskId, key, oldValue, newValue, timestamp }
   */
  REFINEMENT_STATE_UPDATED: 'goap:refinement_state_updated',
};
