/**
 * @file Error class for step execution failures in the GOAP system
 * @description Error thrown when an individual refinement step fails to execute
 * @see GoapError.js - Base class for all GOAP errors
 */

import GoapError from './goapError.js';

/**
 * Error thrown when a refinement step fails to execute.
 * Used for failures during individual action, subtask, or condition step execution.
 *
 * @class
 * @augments {GoapError}
 */
class StepExecutionError extends GoapError {
  /**
   * Creates a new StepExecutionError instance
   *
   * @param {string} message - Error message describing the failure
   * @param {object} [context] - Error context information
   * @param {number} [context.stepIndex] - Index of step that failed
   * @param {string} [context.stepType] - Type of step (action/subtask/condition)
   * @param {string} [context.actionId] - Action ID if step is an action
   * @param {object} [context.targetBindings] - Parameter bindings for the step
   * @param {string} [context.reason] - Why the step execution failed
   * @param {string} [context.methodId] - Method ID containing the failed step
   * @param {string} [context.taskId] - Task ID being refined
   * @param {string} [context.actorId] - Actor executing the step
   * @param {object} [options] - Additional options passed to GoapError
   * @param {string} [options.correlationId] - Custom correlation ID
   */
  constructor(message, context = {}, options = {}) {
    super(message, 'GOAP_STEP_EXECUTION_ERROR', context, options);
  }
}

export default StepExecutionError;
