/**
 * @file ScopeDepthError - thrown when scope expression depth limit is exceeded
 */

import BaseError from './baseError.js';

/**
 * Error thrown when a scope expression exceeds the maximum allowed depth.
 * The Scope-DSL limits expressions to a maximum of 4 edge traversals from the source node
 * to prevent infinite recursion and performance issues.
 */
class ScopeDepthError extends BaseError {
  /**
   * @param {string} message - Error message
   * @param {number} depth - The depth that was exceeded
   * @param {number} maxDepth - The maximum allowed depth
   */
  constructor(message, depth, maxDepth) {
    const context = { depth, maxDepth };
    super(message, 'SCOPE_DEPTH_ERROR', context);
    this.name = 'ScopeDepthError';
    // Backward compatibility
    this.depth = depth;
    this.maxDepth = maxDepth;
  }

  /**
   * @returns {string} Severity level for scope depth errors
   */
  getSeverity() {
    return 'error';
  }

  /**
   * @returns {boolean} Scope depth errors are not recoverable
   */
  isRecoverable() {
    return false;
  }
}

export default ScopeDepthError;
