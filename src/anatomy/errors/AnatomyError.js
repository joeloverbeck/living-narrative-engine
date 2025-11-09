/**
 * @file Base error class for anatomy system errors
 * @description Provides enhanced error messages with context, problem, impact, fix, and references
 */

/**
 * Base error class for anatomy system errors with enhanced formatting
 *
 * @class
 * @augments {Error}
 */
class AnatomyError extends Error {
  /**
   * Creates a new AnatomyError instance
   *
   * @param {object} params - Error parameters
   * @param {string} [params.context] - Where the error occurred
   * @param {string} params.problem - What went wrong
   * @param {string} [params.impact] - Why it matters
   * @param {string|string[]} [params.fix] - How to fix it (string or array of steps)
   * @param {string[]} [params.references] - Related files/docs
   * @param {Error} [params.originalError] - Wrapped error if any
   */
  constructor({ context, problem, impact, fix, references, originalError }) {
    super(problem);

    this.name = this.constructor.name;
    this.context = context;
    this.problem = problem;
    this.impact = impact;
    this.fix = fix;
    this.references = references || [];
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();

    // Capture stack trace for V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Creates a formatted string representation with clear sections
   *
   * @returns {string} Formatted error string
   */
  toString() {
    const lines = [];

    lines.push(`\n${'='.repeat(80)}`);
    lines.push(`[${this.name}]`);
    lines.push(`${'='.repeat(80)}`);
    lines.push('');

    if (this.context) {
      lines.push(`Context:  ${this.context}`);
      lines.push('');
    }

    lines.push(`Problem:  ${this.problem}`);
    lines.push('');

    if (this.impact) {
      lines.push(`Impact:   ${this.impact}`);
      lines.push('');
    }

    if (this.fix) {
      if (Array.isArray(this.fix)) {
        lines.push('Fix:');
        for (const step of this.fix) {
          lines.push(`  ${step}`);
        }
      } else {
        lines.push(`Fix:      ${this.fix}`);
      }
      lines.push('');
    }

    if (this.references && this.references.length > 0) {
      lines.push('References:');
      for (const ref of this.references) {
        lines.push(`  - ${ref}`);
      }
      lines.push('');
    }

    if (this.originalError) {
      lines.push('Original Error:');
      lines.push(`  ${this.originalError.message}`);
      lines.push('');
    }

    lines.push(`${'='.repeat(80)}\n`);

    return lines.join('\n');
  }

  /**
   * Serializes the error for programmatic use
   *
   * @returns {object} Serialized error object
   */
  toJSON() {
    return {
      name: this.name,
      context: this.context,
      problem: this.problem,
      impact: this.impact,
      fix: this.fix,
      references: this.references,
      originalError: this.originalError?.message,
      timestamp: this.timestamp,
    };
  }
}

export default AnatomyError;
