import BaseError from './baseError.js';

export class UnknownAstNodeError extends BaseError {
  constructor(nodeType) {
    const context = { nodeType };
    super(
      `Unknown AST node type: ${nodeType}`,
      'UNKNOWN_AST_NODE_ERROR',
      context
    );
    this.name = 'UnknownAstNodeError';
    // Backward compatibility
    this.nodeType = nodeType;
  }

  /**
   * @returns {string} Severity level for unknown AST node errors
   */
  getSeverity() {
    return 'error';
  }

  /**
   * @returns {boolean} Unknown AST node errors are not recoverable
   */
  isRecoverable() {
    return false;
  }
}
