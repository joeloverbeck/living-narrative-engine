class ScopeCycleError extends Error {
  /**
   * @param {string} message
   * @param {Array<string>} cyclePath - The path of nodes/edges forming the cycle
   */
  constructor(message, cyclePath) {
    super(message);
    this.name = 'ScopeCycleError';
    this.cyclePath = cyclePath;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ScopeCycleError);
    }
  }
}

export default ScopeCycleError;
