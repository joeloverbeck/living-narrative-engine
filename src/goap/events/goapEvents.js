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
   * Payload: { actorId, goalId, reason }
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
   * Dispatched when a task is successfully refined to action steps
   * Payload: { actorId, taskId, stepsGenerated, actionRefs }
   */
  TASK_REFINED: 'goap:task_refined',

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
};
