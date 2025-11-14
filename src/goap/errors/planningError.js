/**
 * @file Error class for GOAP planner failures
 * @description Error thrown when the GOAP planner cannot find a plan to achieve a goal
 * @see GoapError.js - Base class for all GOAP errors
 */

import GoapError from './goapError.js';

/**
 * Error thrown when the GOAP planner fails to find a plan.
 * Used when no sequence of actions can achieve the desired goal state.
 *
 * @class
 * @augments {GoapError}
 */
class PlanningError extends GoapError {
  /**
   * Creates a new PlanningError instance
   *
   * @param {string} message - Error message describing the failure
   * @param {object} [context] - Error context information
   * @param {string} [context.goalId] - ID of the goal being planned for
   * @param {string} [context.actorId] - Actor being planned for
   * @param {object} [context.worldState] - Current world state snapshot
   * @param {string} [context.reason] - Why planning failed (e.g., "no path to goal")
   * @param {object} [options] - Additional options passed to GoapError
   * @param {string} [options.correlationId] - Custom correlation ID
   */
  constructor(message, context = {}, options = {}) {
    super(message, 'GOAP_PLANNING_ERROR', context, options);
  }

  /**
   * Planning failures are usually recoverable (can try alternative goals)
   * Override to set warning severity instead of error
   *
   * @returns {string} Severity level ('warning')
   * @override
   */
  getSeverity() {
    return 'warning';
  }
}

export default PlanningError;
