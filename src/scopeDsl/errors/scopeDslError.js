/**
 * Base class for all custom errors in the Scope-DSL module.
 */
export class ScopeDslError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
} 