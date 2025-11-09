/**
 * @file Validation report with structured results
 */

/**
 * Validation report with structured results
 */
export class ValidationReport {
  #results;

  constructor(results) {
    this.#results = results;
  }

  /**
   * Check if validation passed (no errors)
   *
   * @returns {boolean} True if no errors
   */
  get isValid() {
    return this.#results.errors.length === 0;
  }

  /**
   * Check if validation has warnings
   *
   * @returns {boolean} True if warnings exist
   */
  get hasWarnings() {
    return this.#results.warnings.length > 0;
  }

  /**
   * Check if validation has suggestions
   *
   * @returns {boolean} True if suggestions exist
   */
  get hasSuggestions() {
    return this.#results.suggestions.length > 0;
  }

  /**
   * Get all errors
   *
   * @returns {Array} Array of error objects
   */
  get errors() {
    return [...this.#results.errors];
  }

  /**
   * Get all warnings
   *
   * @returns {Array} Array of warning objects
   */
  get warnings() {
    return [...this.#results.warnings];
  }

  /**
   * Get all suggestions
   *
   * @returns {Array} Array of suggestion objects
   */
  get suggestions() {
    return [...this.#results.suggestions];
  }

  /**
   * Get summary statistics
   *
   * @returns {object} Summary object with statistics
   */
  get summary() {
    return {
      recipeId: this.#results.recipeId,
      recipePath: this.#results.recipePath,
      timestamp: this.#results.timestamp,
      totalErrors: this.#results.errors.length,
      totalWarnings: this.#results.warnings.length,
      totalSuggestions: this.#results.suggestions.length,
      passedChecks: this.#results.passed.length,
      isValid: this.isValid,
    };
  }

  /**
   * Format report for console output
   *
   * @returns {string} Formatted report string
   */
  toString() {
    const lines = [];

    lines.push(`\n${'='.repeat(80)}`);
    lines.push(`Validation Report: ${this.#results.recipeId}`);
    if (this.#results.recipePath) {
      lines.push(`Path: ${this.#results.recipePath}`);
    }
    lines.push(`${'='.repeat(80)}\n`);

    // Passed checks
    if (this.#results.passed.length > 0) {
      lines.push('✓ Passed Checks:');
      for (const check of this.#results.passed) {
        lines.push(`  ✓ ${check.message}`);
      }
      lines.push('');
    }

    // Errors
    if (this.#results.errors.length > 0) {
      lines.push('✗ Errors:');
      for (const error of this.#results.errors) {
        lines.push(this.#formatError(error));
      }
      lines.push('');
    }

    // Warnings
    if (this.#results.warnings.length > 0) {
      lines.push('⚠ Warnings:');
      for (const warning of this.#results.warnings) {
        lines.push(this.#formatWarning(warning));
      }
      lines.push('');
    }

    // Suggestions
    if (this.#results.suggestions.length > 0) {
      lines.push('💡 Suggestions:');
      for (const suggestion of this.#results.suggestions) {
        lines.push(this.#formatSuggestion(suggestion));
      }
      lines.push('');
    }

    // Summary
    lines.push(`${'─'.repeat(80)}`);
    if (this.isValid) {
      lines.push(`✅ Validation PASSED`);
    } else {
      lines.push(
        `❌ Validation FAILED with ${this.#results.errors.length} error(s)`
      );
    }
    lines.push(`${'='.repeat(80)}\n`);

    return lines.join('\n');
  }

  #formatError(error) {
    const lines = [];
    lines.push(`\n  [ERROR] ${error.message}`);

    if (error.location) {
      lines.push(`  Location: ${error.location.type} '${error.location.name}'`);
    }

    if (error.componentId) {
      lines.push(`  Component: ${error.componentId}`);
    }

    if (error.fix) {
      lines.push(`  Fix: ${error.fix}`);
    }

    if (error.context?.location) {
      lines.push(
        `  Location: ${error.context.location.type} '${error.context.location.name}'`
      );
    }

    if (error.suggestion) {
      lines.push(`  Suggestion: ${error.suggestion}`);
    }

    return lines.join('\n');
  }

  #formatWarning(warning) {
    const lines = [];
    lines.push(`\n  [WARNING] ${warning.message}`);

    if (warning.location) {
      lines.push(
        `  Location: ${warning.location.type} '${warning.location.name}'`
      );
    }

    if (warning.suggestion) {
      lines.push(`  Suggestion: ${warning.suggestion}`);
    }

    return lines.join('\n');
  }

  #formatSuggestion(suggestion) {
    const lines = [];
    lines.push(`\n  [SUGGESTION] ${suggestion.message}`);

    if (suggestion.location) {
      lines.push(
        `  Location: ${suggestion.location.type} '${suggestion.location.name}'`
      );
    }

    if (suggestion.suggestion) {
      lines.push(`  Suggestion: ${suggestion.suggestion}`);
    }

    if (suggestion.reason) {
      lines.push(`  Reason: ${suggestion.reason}`);
    }

    if (suggestion.impact) {
      lines.push(`  Impact: ${suggestion.impact}`);
    }

    return lines.join('\n');
  }

  /**
   * Format report as JSON
   *
   * @returns {object} Results object
   */
  toJSON() {
    return this.#results;
  }
}
