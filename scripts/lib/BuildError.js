/**
 * @file Custom error class for build system
 * Provides detailed error information with formatting
 */

const { default: chalk } = require('chalk');

class BuildError extends Error {
  /**
   * Create a new BuildError instance
   *
   * @param {string} message - Error message
   * @param {object} details - Additional error details
   * @param {string} [details.step] - Build step where error occurred
   * @param {Array} [details.errors] - Array of specific errors
   * @param {string} [details.suggestion] - Suggested fix
   */
  constructor(message, details = {}) {
    super(message);
    this.name = 'BuildError';
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  /**
   * Format error for display
   *
   * @returns {string} Formatted error message
   */
  format() {
    const lines = [
      chalk.red.bold(`Build Error: ${this.message}`),
      chalk.gray(`Time: ${this.timestamp}`),
    ];

    if (this.details.step) {
      lines.push(chalk.yellow(`Step: ${this.details.step}`));
    }

    if (this.details.errors && this.details.errors.length > 0) {
      lines.push(chalk.red('\nErrors:'));
      this.details.errors.forEach((error, index) => {
        lines.push(chalk.red(`  ${index + 1}. ${error.message}`));
        if (error.bundle) {
          lines.push(chalk.gray(`     Bundle: ${error.bundle}`));
        }
        if (error.entry) {
          lines.push(chalk.gray(`     Entry: ${error.entry}`));
        }
        if (error.outfile) {
          lines.push(chalk.gray(`     Outfile: ${error.outfile}`));
        }
        if (error.file) {
          lines.push(chalk.gray(`     File: ${error.file}`));
        }
        if (error.type) {
          lines.push(chalk.gray(`     Type: ${error.type}`));
        }
        if (error.command) {
          lines.push(chalk.gray(`     Command: ${error.command}`));
        }
      });
    }

    if (this.details.suggestion) {
      lines.push(chalk.cyan(`\nSuggestion: ${this.details.suggestion}`));
    }

    if (this.stack && process.env.NODE_ENV !== 'production') {
      lines.push(chalk.gray('\nStack trace:'));
      // Clean up stack trace to show only relevant lines
      const stackLines = this.stack
        .split('\n')
        .slice(1) // Remove first line (error message)
        .filter((line) => !line.includes('node_modules')) // Filter out node_modules
        .slice(0, 10); // Limit to 10 lines
      lines.push(chalk.gray(stackLines.join('\n')));
    }

    return lines.join('\n');
  }

  /**
   * Create error for missing file
   *
   * @param {string} file - File path
   * @returns {BuildError} New BuildError instance
   */
  static missingFile(file) {
    return new BuildError(`Required file missing: ${file}`, {
      step: 'validation',
      errors: [
        {
          type: 'missing_file',
          file,
          message: `File not found in build output`,
        },
      ],
      suggestion:
        'Check that the source file exists and the build configuration is correct',
    });
  }

  /**
   * Create error for build failure
   *
   * @param {string} bundleName - Bundle name
   * @param {Error} originalError - Original error
   * @returns {BuildError} New BuildError instance
   */
  static buildFailure(bundleName, originalError) {
    return new BuildError(`Failed to build bundle: ${bundleName}`, {
      step: 'javascript_bundling',
      errors: [
        {
          type: 'bundle_error',
          message: originalError.message,
          bundle: bundleName,
          entry: originalError.entry,
          outfile: originalError.outfile,
          command: originalError.command,
        },
      ],
      suggestion: 'Fix the reported bundle error and re-run the build',
    });
  }

  /**
   * Create error for validation failure
   *
   * @param {Array} errors - Validation errors
   * @returns {BuildError} New BuildError instance
   */
  static validationFailure(errors) {
    return new BuildError('Build validation failed', {
      step: 'validation',
      errors,
      suggestion: 'Fix the reported issues and run the build again',
    });
  }
}

module.exports = BuildError;
