import { ScopeDslError } from '../errors/scopeDslError.js';

/**
 * Factory for creating standardized error messages for unknown node types.
 */
export default {
  /**
   * Creates a ScopeDslError for unknown node kinds.
   *
   * @param {string} kind - The unknown node kind
   * @param {*} value - The full node value for context
   * @returns {ScopeDslError} A new ScopeDslError instance
   */
  unknown(kind, value) {
    return new ScopeDslError(
      `Unknown node kind: '${kind}'. Full node: ${JSON.stringify(value)}`
    );
  },
};
