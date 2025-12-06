import BaseError from './baseError.js';

export class UnknownSourceError extends BaseError {
  constructor(sourceKind) {
    const context = { sourceKind };
    super(
      `Unknown source kind: ${sourceKind}`,
      'UNKNOWN_SOURCE_ERROR',
      context
    );
    this.name = 'UnknownSourceError';
    // Backward compatibility
    this.sourceKind = sourceKind;
  }

  /**
   * @returns {string} Severity level for unknown source errors
   */
  getSeverity() {
    return 'warning';
  }

  /**
   * @returns {boolean} Unknown source errors are recoverable
   */
  isRecoverable() {
    return true;
  }
}
