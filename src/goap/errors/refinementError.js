/**
 * @file Error class for refinement method execution failures in the GOAP system
 * @description Error thrown when a refinement method fails to execute successfully
 * @see GoapError.js - Base class for all GOAP errors
 */

import GoapError from './goapError.js';

/**
 * Error thrown when refinement method execution fails.
 * Used for failures during hierarchical task decomposition in the GOAP planner.
 *
 * @class
 * @augments {GoapError}
 */
class RefinementError extends GoapError {
  /**
   * Creates a new RefinementError instance
   *
   * @param {string} message - Error message describing the failure
   * @param {object} [context] - Error context information
   * @param {string} [context.taskId] - ID of the task being refined
   * @param {string} [context.methodId] - ID of the refinement method that failed
   * @param {number} [context.stepIndex] - Index of the step that failed
   * @param {string} [context.actorId] - Actor performing the task
   * @param {string} [context.reason] - Why the refinement failed
   * @param {object} [options] - Additional options passed to GoapError
   * @param {string} [options.correlationId] - Custom correlation ID
   */
  constructor(message, context = {}, options = {}) {
    super(message, 'GOAP_REFINEMENT_ERROR', context, options);
  }
}

export default RefinementError;
