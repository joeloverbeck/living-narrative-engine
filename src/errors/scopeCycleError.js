import BaseError from './baseError.js';

class ScopeCycleError extends BaseError {
  /**
   * @param {string} message
   * @param {Array<string>} cyclePath - The path of nodes/edges forming the cycle
   */
  constructor(message, cyclePath) {
    const context = { cyclePath };
    super(message, 'SCOPE_CYCLE_ERROR', context);
    this.name = 'ScopeCycleError';
    // Backward compatibility
    this.cyclePath = cyclePath;
  }

  /**
   * @returns {string} Severity level for scope cycle errors
   */
  getSeverity() {
    return 'error';
  }

  /**
   * @returns {boolean} Scope cycle errors are not recoverable
   */
  isRecoverable() {
    return false;
  }
}

export default ScopeCycleError;
