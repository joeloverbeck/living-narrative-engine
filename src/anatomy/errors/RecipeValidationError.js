/**
 * @file Error for recipe validation failures
 * @description Enhanced error for overall recipe validation failures with report summary
 */

import AnatomyError from './AnatomyError.js';

/**
 * Error thrown when a recipe fails validation with multiple errors
 *
 * @class
 * @augments {AnatomyError}
 */
class RecipeValidationError extends AnatomyError {
  /**
   * Creates a new RecipeValidationError instance
   *
   * @param {object} params - Error parameters
   * @param {string} params.message - The primary error message
   * @param {object} params.report - The validation report object
   * @param {object} params.report.summary - Summary section of the report
   * @param {string} params.report.summary.recipeId - Recipe ID
   * @param {Array} params.report.errors - Array of error objects
   * @param {Array} params.report.warnings - Array of warning objects
   */
  constructor({ message, report }) {
    const errorCount = report.errors.length;
    const warningCount = report.warnings.length;

    super({
      context: `Recipe Validation: ${report.summary.recipeId}`,
      problem: message,
      impact: `Recipe cannot be loaded due to ${errorCount} validation error(s)`,
      fix: [
        'Review validation report for details:',
        '',
        `Errors: ${errorCount}`,
        `Warnings: ${warningCount}`,
        '',
        'Check RecipePreflightValidator for validation logic',
      ],
      references: [
        'docs/anatomy/troubleshooting.md',
        'docs/anatomy/anatomy-system-guide.md',
        'src/anatomy/validation/RecipePreflightValidator.js',
      ],
    });

    this.report = report;
  }
}

export default RecipeValidationError;
