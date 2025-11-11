/**
 * @file Prerequisite Evaluation Error
 * @description Rich error class for prerequisite evaluation failures
 */

/**
 * Error thrown when prerequisite evaluation fails with enhanced context.
 *
 * @description Provides rich error context for prerequisite evaluation failures including
 * the failed logic, expected/actual results, entity state, and helpful debugging hints.
 */
export class PrerequisiteEvaluationError extends Error {
  /**
   * Create a new PrerequisiteEvaluationError with enhanced context.
   *
   * @param {object} context - Error context
   * @param {string} context.actionId - Action ID being evaluated
   * @param {number} context.prerequisiteIndex - Index of failed prerequisite
   * @param {object} context.prerequisiteLogic - The prerequisite logic that failed
   * @param {boolean|number|string} context.expectedResult - Expected evaluation result
   * @param {boolean|number|string} context.actualResult - Actual evaluation result
   * @param {object} context.entityState - Relevant entity state
   * @param {string} context.hint - Debugging hint
   */
  constructor(context) {
    const message = PrerequisiteEvaluationError.formatMessage(context);
    super(message);

    this.name = 'PrerequisiteEvaluationError';
    this.actionId = context.actionId;
    this.prerequisiteIndex = context.prerequisiteIndex;
    this.prerequisiteLogic = context.prerequisiteLogic;
    this.expectedResult = context.expectedResult;
    this.actualResult = context.actualResult;
    this.entityState = context.entityState;
    this.hint = context.hint;
    this.context = context;
  }

  /**
   * Format error message with context.
   *
   * @param {object} context - Error context
   * @returns {string} Formatted error message
   */
  static formatMessage(context) {
    const parts = [];

    // Header
    parts.push(`Action '${context.actionId}' not discovered`);

    // Failed prerequisite
    parts.push(
      `  Prerequisite #${context.prerequisiteIndex + 1} failed: ` +
        `${JSON.stringify(context.prerequisiteLogic)}`
    );

    // Expected vs Actual
    parts.push(`  Expected: ${formatValue(context.expectedResult)}`);
    parts.push(`  Actual: ${formatValue(context.actualResult)}`);

    // Entity state
    if (context.entityState) {
      parts.push('  Entity State:');
      for (const [key, value] of Object.entries(context.entityState)) {
        parts.push(`    ${key}: ${formatValue(value)}`);
      }
    }

    // Hint
    if (context.hint) {
      parts.push(`  💡 Hint: ${context.hint}`);
    }

    return parts.join('\n');
  }

  /**
   * Convert error to JSON for structured logging.
   *
   * @returns {object} JSON representation
   */
  toJSON() {
    return {
      error: this.name,
      actionId: this.actionId,
      prerequisiteIndex: this.prerequisiteIndex,
      prerequisiteLogic: this.prerequisiteLogic,
      expectedResult: this.expectedResult,
      actualResult: this.actualResult,
      entityState: this.entityState,
      hint: this.hint,
    };
  }
}

/**
 * Format a value for display in error messages.
 *
 * @param {boolean|number|string|object|Array|null|undefined} value - Value to format
 * @returns {string} Formatted value
 */
function formatValue(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return `"${value}"`;
  if (Array.isArray(value)) {
    if (value.length === 0) return '[] (empty array)';
    return `[${value.map((v) => formatValue(v)).join(', ')}] (${value.length} items)`;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) return '{} (empty object)';
    return `{ ${keys.join(', ')} } (${keys.length} keys)`;
  }
  return String(value);
}
