/**
 * @file Core validation logic for recipe CLI
 * Extracted for unit testing without process spawning
 */

/**
 * Validate CLI arguments (no formatting - pure logic)
 *
 * @param {Array<string>} recipes - Recipe file paths
 * @returns {object} Validation result with exitCode and isValid
 */
export function validateCliArgs(recipes) {
  if (!recipes || recipes.length === 0) {
    return {
      exitCode: 1,
      isValid: false,
      errorType: 'NO_RECIPES_PROVIDED',
    };
  }

  return { exitCode: 0, isValid: true };
}

/**
 * Format CLI args validation error message
 *
 * @param {object} chalk - Chalk instance
 * @returns {string} Error message
 */
export function formatNoRecipesError(chalk) {
  return (
    chalk.red('\n❌ Error: No recipe files specified\n') +
    'Usage: npm run validate:recipe <recipe-file> [<recipe-file> ...]\n' +
    'Example: npm run validate:recipe data/mods/anatomy/recipes/red_dragon.recipe.json\n'
  );
}

/**
 * Calculate summary statistics (pure logic)
 *
 * @param {Array} results - Array of validation reports
 * @returns {object} Summary statistics
 */
export function calculateSummaryStats(results) {
  const totalRecipes = results.length;
  const validRecipes = results.filter((r) => r.isValid).length;
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);
  const totalSuggestions = results.reduce(
    (sum, r) => sum + r.suggestions.length,
    0
  );

  return {
    totalRecipes,
    validRecipes,
    invalidRecipes: totalRecipes - validRecipes,
    totalErrors,
    totalWarnings,
    totalSuggestions,
  };
}

/**
 * Format summary statistics with colors
 *
 * @param {Array} results - Array of validation reports
 * @param {object} chalk - Chalk instance
 * @returns {string} Formatted summary
 */
export function formatSummary(results, chalk) {
  const stats = calculateSummaryStats(results);

  let summary = '\n' + chalk.bold('═'.repeat(80)) + '\n';
  summary += chalk.bold('VALIDATION SUMMARY') + '\n';
  summary += chalk.bold('═'.repeat(80)) + '\n\n';

  summary += `Recipes Validated: ${stats.totalRecipes}\n`;
  summary += `Valid: ${chalk.green(stats.validRecipes)} | Invalid: ${chalk.red(stats.invalidRecipes)}\n`;
  summary += `Errors: ${chalk.red(stats.totalErrors)} | Warnings: ${chalk.yellow(stats.totalWarnings)} | Suggestions: ${chalk.blue(stats.totalSuggestions)}\n`;

  return summary;
}

/**
 * Format validation report as JSON
 *
 * @param {object} report - Validation report
 * @returns {string} JSON string
 */
export function formatJsonOutput(report) {
  return JSON.stringify(report.toJSON(), null, 2);
}

/**
 * Determine exit code from validation results (pure logic)
 *
 * @param {Array} results - Validation results
 * @returns {object} Exit result with code, passed, and stats
 */
export function determineExitCode(results) {
  const totalErrors = results.reduce(
    (sum, r) => sum + (r.errors?.length || 0),
    0
  );
  const totalWarnings = results.reduce(
    (sum, r) => sum + (r.warnings?.length || 0),
    0
  );

  return {
    exitCode: totalErrors > 0 ? 1 : 0,
    passed: totalErrors === 0,
    totalErrors,
    totalWarnings,
    totalRecipes: results.length,
  };
}

/**
 * Format exit message with colors
 *
 * @param {object} exitResult - Result from determineExitCode
 * @param {object} chalk - Chalk instance
 * @returns {string} Formatted message
 */
export function formatExitMessage(exitResult, chalk) {
  if (exitResult.passed) {
    return chalk.green(
      `\n✅ Validation PASSED: ${exitResult.totalRecipes} recipe(s) valid\n`
    );
  } else {
    return chalk.red(
      `\n❌ Validation FAILED: ${exitResult.totalErrors} error(s), ${exitResult.totalWarnings} warning(s)\n`
    );
  }
}

/**
 * Format error result for failed validation
 *
 * @param {string} recipePath - Path to recipe
 * @param {Error} error - Error object
 * @returns {object} Error result
 */
export function formatErrorResult(recipePath, error) {
  return {
    isValid: false,
    errors: [{ message: error.message }],
    warnings: [],
    suggestions: [],
    recipePath,
  };
}
