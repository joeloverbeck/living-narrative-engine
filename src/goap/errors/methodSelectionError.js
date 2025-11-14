/**
 * @file Error class for method selection failures in the GOAP system
 * @description Error thrown when no applicable method can be found during refinement
 * @see GoapError.js - Base class for all GOAP errors
 */

import GoapError from './goapError.js';

/**
 * Error thrown when no applicable method is found for a task during refinement.
 * Used when refinement method selection fails to find any suitable method.
 *
 * @class
 * @augments {GoapError}
 */
class MethodSelectionError extends GoapError {
  /**
   * Creates a new MethodSelectionError instance
   *
   * @param {string} message - Error message describing the failure
   * @param {object} [context] - Error context information
   * @param {string} [context.taskId] - Task being refined
   * @param {string[]} [context.methodIds] - List of candidate methods considered
   * @param {object[]} [context.evaluationResults] - Results of applicability checks
   * @param {string} [context.actorId] - Actor performing method selection
   * @param {string} [context.reason] - Why no method was applicable
   * @param {object} [options] - Additional options passed to GoapError
   * @param {string} [options.correlationId] - Custom correlation ID
   */
  constructor(message, context = {}, options = {}) {
    super(message, 'GOAP_METHOD_SELECTION_ERROR', context, options);
  }
}

export default MethodSelectionError;
