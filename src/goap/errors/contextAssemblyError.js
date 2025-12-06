/**
 * @file Error class for context assembly failures in the GOAP system.
 * @description Error thrown when context assembly fails during planning, refinement, or condition evaluation
 * @see GoapError.js - Base class for all GOAP errors
 */

import GoapError from './goapError.js';

/**
 * Error thrown when context assembly fails.
 * Used for failures during planning, refinement, or condition context assembly.
 *
 * @class
 * @augments {GoapError}
 */
class ContextAssemblyError extends GoapError {
  #details; // Backward compatibility with existing usage

  /**
   * Creates a new ContextAssemblyError instance
   *
   * @param {string} message - Error message describing the failure
   * @param {object} [details] - Additional error details (backward compatibility)
   *   Can include: actorId, contextType, missingData, reason, etc.
   * @param {object} [options] - Additional options passed to GoapError
   * @param {string} [options.correlationId] - Custom correlation ID
   */
  constructor(message, details = {}, options = {}) {
    // Convert details to context for BaseError
    const context = {
      actorId: details.actorId,
      contextType: details.contextType,
      missingData: details.missingData,
      reason: details.reason,
      ...details, // Include all other details
    };

    super(message, 'GOAP_CONTEXT_ASSEMBLY_ERROR', context, options);

    // Preserve backward compatibility with 'details' property
    this.#details = details;
  }

  /**
   * Gets the details object (backward compatibility)
   *
   * @returns {object} Error details
   */
  get details() {
    return this.#details;
  }
}

export default ContextAssemblyError;
