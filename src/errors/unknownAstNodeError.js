export class UnknownAstNodeError extends Error {
  constructor(nodeType) {
    super(`Unknown AST node type: ${nodeType}`);
    this.name = 'UnknownAstNodeError';
    this.nodeType = nodeType;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, UnknownAstNodeError);
    }
  }
}