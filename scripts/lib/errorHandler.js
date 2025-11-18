/**
 * @file Enhanced error handling for mod validation CLI
 * @description Provides context-aware error messages and actionable suggestions
 */

import chalk from 'chalk';
import fs from 'fs/promises';

/**
 * Enhanced error handler with context-aware suggestions
 */
export class ValidationCLIError extends Error {
  constructor(message, type = 'GENERAL_ERROR', suggestions = []) {
    super(message);
    this.name = 'ValidationCLIError';
    this.type = type;
    this.suggestions = suggestions;
  }
}

/**
 * Handles and displays CLI errors with helpful suggestions
 *
 * @param {Error} error - Error to handle
 * @param {object} config - CLI configuration for context
 */
export function handleCLIError(error, config = {}) {
  console.error(chalk.red('❌ Error:'), error.message);

  if (error instanceof ValidationCLIError) {
    // Show error-specific suggestions
    if (error.suggestions.length > 0) {
      console.error('\n💡 Suggestions:');
      error.suggestions.forEach((suggestion, i) => {
        console.error(chalk.yellow(`   ${i + 1}. ${suggestion}`));
      });
    }

    // Show context-specific help
    showContextualHelp(error.type, config);
  }

  if (config.verbose && error.stack) {
    console.error('\n🔍 Stack trace:');
    console.error(error.stack);
  }

  console.error(`\n📖 Use ${chalk.cyan('--help')} for usage information.`);
}

/**
 * Shows contextual help based on error type
 *
 * @param errorType
 * @param config
 */
function showContextualHelp(errorType, config) {
  const contextHelp = {
    INVALID_MOD: [
      'Check that the mod exists in the data/mods/ directory',
      'Verify the mod name is spelled correctly',
      'Use --ecosystem to validate all mods',
    ],
    INVALID_FORMAT: [
      'Supported formats: console, json, html, markdown, junit, csv',
      'Use --format console for terminal output',
      'Use --format json for machine-readable output',
    ],
    VALIDATION_TIMEOUT: [
      'Increase timeout with --timeout <milliseconds>',
      'Reduce concurrency with --concurrency <number>',
      'Try validating specific mods instead of entire ecosystem',
    ],
    DEPENDENCY_INJECTION_FAILED: [
      'Ensure all required dependencies are properly installed',
      'Check that the project is properly built',
      'Try running npm install to restore dependencies',
    ],
    MISSING_DEPENDENCY: [
      'Check that all required modules are installed',
      'Run npm install to ensure dependencies are up to date',
      'Verify that the dependency injection container is properly configured',
    ],
    FILE_ACCESS_ERROR: [
      'Check file permissions for the mod directory',
      'Ensure you are running from the project root directory',
      'Verify that the mod manifest files exist',
    ],
    CONFIGURATION_ERROR: [
      'Check that configuration file is valid JSON',
      'Use validateMods --help to see valid configuration options',
      'Try removing the configuration file and using defaults',
    ],
  };

  const help = contextHelp[errorType];
  if (help && help.length > 0) {
    console.error('\n🎯 Specific help:');
    help.forEach((tip, i) => {
      console.error(chalk.blue(`   ${i + 1}. ${tip}`));
    });
  }
}

/**
 * Validates CLI environment and provides setup suggestions
 */
export async function validateEnvironment() {
  const issues = [];

  // Check for required directories
  try {
    await fs.access('data/mods');
  } catch (error) {
    issues.push({
      type: 'MISSING_MODS_DIRECTORY',
      message: 'Mods directory not found',
      suggestion: 'Ensure you are running from the project root directory',
    });
  }

  // Check for dependency injection container
  try {
    const { container } = await import(
      '../../src/dependencyInjection/container.js'
    );
    // Test container resolution
    const logger = container.resolve('ILogger');
    if (!logger) {
      throw new Error('Logger not found');
    }
  } catch (error) {
    issues.push({
      type: 'DEPENDENCY_INJECTION_FAILED',
      message: 'Dependency injection system not available',
      suggestion: 'Run npm install and ensure project is properly built',
    });
  }

  // Check for required validation services
  try {
    const { coreTokens } = await import(
      '../../src/dependencyInjection/tokens/tokens-core.js'
    );
    const { container } = await import(
      '../../src/dependencyInjection/container.js'
    );
    
    const requiredServices = [
      coreTokens.IModValidationOrchestrator,
      coreTokens.IViolationReporter,
      coreTokens.IModCrossReferenceValidator
    ];
    
    for (const token of requiredServices) {
      const service = container.resolve(token);
      if (!service) {
        issues.push({
          type: 'MISSING_SERVICE',
          message: `Required service ${token} not registered`,
          suggestion: 'Ensure all validation services are properly registered in the DI container',
        });
      }
    }
  } catch (error) {
    issues.push({
      type: 'SERVICE_VALIDATION_FAILED',
      message: 'Could not validate required services',
      suggestion: 'Check that the project is properly built and configured',
    });
  }

  return issues;
}

/**
 * Creates a user-friendly error message from validation issues
 *
 * @param {Array} issues - Array of validation issues
 * @returns {string} Formatted error message
 */
export function formatEnvironmentIssues(issues) {
  if (issues.length === 0) {
    return null;
  }

  const lines = [
    chalk.red('❌ Environment validation failed:'),
    ''
  ];

  issues.forEach((issue, index) => {
    lines.push(chalk.yellow(`${index + 1}. ${issue.message}`));
    if (issue.suggestion) {
      lines.push(chalk.gray(`   → ${issue.suggestion}`));
    }
  });

  lines.push('');
  lines.push(chalk.cyan('Please fix these issues before running validation.'));

  return lines.join('\n');
}

/**
 * Wraps an async function with error handling
 *
 * @param {Function} fn - Async function to wrap
 * @param {object} config - Configuration for error handling
 * @returns {Function} Wrapped function
 */
export function withErrorHandling(fn, config = {}) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleCLIError(error, config);
      process.exit(1);
    }
  };
}

/**
 * Creates a progress reporter for long-running operations
 *
 * @param {object} options - Progress reporter options
 * @returns {object} Progress reporter interface
 */
export function createProgressReporter(options = {}) {
  const { quiet = false, verbose = false } = options;
  let currentTask = null;
  let startTime = null;

  return {
    start(task) {
      if (quiet) return;
      currentTask = task;
      startTime = Date.now();
      process.stdout.write(`${task}... `);
    },

    update(message) {
      if (quiet || !verbose) return;
      process.stdout.write(`\n  ${chalk.gray(message)}`);
    },

    success(message) {
      if (quiet) return;
      const elapsed = startTime ? Date.now() - startTime : 0;
      process.stdout.write(chalk.green(`✓`) + ` ${message || 'done'}`);
      if (verbose && elapsed > 0) {
        process.stdout.write(chalk.gray(` (${elapsed}ms)`));
      }
      process.stdout.write('\n');
      currentTask = null;
      startTime = null;
    },

    error(message) {
      if (quiet) return;
      process.stdout.write(chalk.red(`✗`) + ` ${message || 'failed'}\n`);
      currentTask = null;
      startTime = null;
    },

    info(message) {
      if (quiet) return;
      console.log(chalk.blue('ℹ'), message);
    },

    warn(message) {
      if (quiet) return;
      console.log(chalk.yellow('⚠'), message);
    }
  };
}

/**
 * Formats validation statistics for display
 *
 * @param {object} stats - Validation statistics
 * @returns {string} Formatted statistics
 */
export function formatValidationStats(stats) {
  const lines = [];
  
  if (stats.totalMods !== undefined) {
    lines.push(`Total mods: ${stats.totalMods}`);
  }
  
  if (stats.validMods !== undefined) {
    lines.push(`Valid mods: ${chalk.green(stats.validMods)}`);
  }
  
  if (stats.invalidMods !== undefined && stats.invalidMods > 0) {
    lines.push(`Invalid mods: ${chalk.red(stats.invalidMods)}`);
  }
  
  if (stats.totalViolations !== undefined && stats.totalViolations > 0) {
    lines.push(`Total violations: ${chalk.yellow(stats.totalViolations)}`);
  }
  
  if (stats.criticalViolations !== undefined && stats.criticalViolations > 0) {
    lines.push(`Critical violations: ${chalk.red(stats.criticalViolations)}`);
  }
  
  return lines.join('\n');
}