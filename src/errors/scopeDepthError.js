/**
 * @file ScopeDepthError - thrown when scope expression depth limit is exceeded
 */

/**
 * Error thrown when a scope expression exceeds the maximum allowed depth.
 * The Scope-DSL limits expressions to a maximum of 4 edge traversals from the source node
 * to prevent infinite recursion and performance issues.
 */
class ScopeDepthError extends Error {
  /**
   * @param {string} message - Error message
   * @param {number} depth - The depth that was exceeded
   * @param {number} maxDepth - The maximum allowed depth
   */
  constructor(message, depth, maxDepth) {
    super(message);
    this.name = 'ScopeDepthError';
    this.depth = depth;
    this.maxDepth = maxDepth;
  }
}

export default ScopeDepthError;
