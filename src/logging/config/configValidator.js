/**
 * @file Configuration validator for debug logging system
 * @description Validates debug logging configuration using AJV schema validation
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../interfaces/coreServices.js').ValidationResult} ValidationResult
 */

/**
 * Configuration validator for debug logging system
 * Leverages the existing AJV schema validation infrastructure
 */
export class DebugLoggingConfigValidator {
  /**
   * @private
   * @type {ISchemaValidator}
   */
  #schemaValidator;

  /**
   * @private
   * @type {ILogger}
   */
  #logger;

  /**
   * @private
   * @type {string}
   */
  #schemaId = 'schema://living-narrative-engine/debug-logging-config.schema.json';

  /**
   * Creates an instance of DebugLoggingConfigValidator
   * 
   * @param {object} dependencies - Dependencies
   * @param {ISchemaValidator} dependencies.schemaValidator - Schema validator instance
   * @param {ILogger} dependencies.logger - Logger instance
   */
  constructor({ schemaValidator, logger }) {
    validateDependency(schemaValidator, 'ISchemaValidator', logger, {
      requiredMethods: ['validateAgainstSchema'],
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    this.#schemaValidator = schemaValidator;
    this.#logger = logger;
  }

  /**
   * Validates a debug logging configuration object against the schema
   * 
   * @param {object} config - Configuration object to validate
   * @returns {ValidationResult} Validation result with success flag and errors
   */
  validateConfig(config) {
    try {
      if (!config || typeof config !== 'object') {
        return {
          isValid: false,
          errors: ['Configuration must be a non-null object'],
          formattedErrors: 'Configuration must be a non-null object',
        };
      }

      this.#logger.debug('Validating debug logging configuration against schema');

      const result = this.#schemaValidator.validateAgainstSchema(
        config,
        this.#schemaId
      );

      if (!result.isValid) {
        this.#logger.warn(
          'Debug logging configuration validation failed',
          { errors: result.errors, config }
        );
      } else {
        this.#logger.debug('Debug logging configuration validation passed');
      }

      return result;
    } catch (error) {
      this.#logger.error(
        'Error during debug logging configuration validation',
        error
      );
      
      return {
        isValid: false,
        errors: [`Validation error: ${error.message}`],
        formattedErrors: `Validation error: ${error.message}`,
      };
    }
  }

  /**
   * Validates configuration and throws an error if invalid
   * Useful for fail-fast scenarios
   * 
   * @param {object} config - Configuration object to validate
   * @throws {Error} If configuration is invalid
   * @returns {void}
   */
  validateConfigOrThrow(config) {
    const result = this.validateConfig(config);
    
    if (!result.isValid) {
      throw new Error(
        `Invalid debug logging configuration: ${result.formattedErrors}`
      );
    }
  }

  /**
   * Validates a specific category configuration
   * 
   * @param {string} categoryName - Name of the category
   * @param {object} categoryConfig - Category configuration object
   * @returns {ValidationResult} Validation result
   */
  validateCategory(categoryName, categoryConfig) {
    try {
      if (!categoryName || typeof categoryName !== 'string') {
        return {
          isValid: false,
          errors: ['Category name must be a non-empty string'],
          formattedErrors: 'Category name must be a non-empty string',
        };
      }

      if (!categoryConfig || typeof categoryConfig !== 'object') {
        return {
          isValid: false,
          errors: ['Category configuration must be a non-null object'],
          formattedErrors: 'Category configuration must be a non-null object',
        };
      }

      // Create a minimal config with just this category to validate
      const testConfig = {
        enabled: true,
        mode: 'development',
        categories: {
          [categoryName]: categoryConfig,
        },
      };

      return this.validateConfig(testConfig);
    } catch (error) {
      this.#logger.error(
        `Error validating category '${categoryName}'`,
        error
      );
      
      return {
        isValid: false,
        errors: [`Category validation error: ${error.message}`],
        formattedErrors: `Category validation error: ${error.message}`,
      };
    }
  }

  /**
   * Validates remote logging configuration
   * 
   * @param {object} remoteConfig - Remote configuration object
   * @returns {ValidationResult} Validation result
   */
  validateRemoteConfig(remoteConfig) {
    try {
      if (!remoteConfig || typeof remoteConfig !== 'object') {
        return {
          isValid: false,
          errors: ['Remote configuration must be a non-null object'],
          formattedErrors: 'Remote configuration must be a non-null object',
        };
      }

      // Create a minimal config with just remote config to validate
      const testConfig = {
        enabled: true,
        mode: 'remote',
        remote: remoteConfig,
      };

      return this.validateConfig(testConfig);
    } catch (error) {
      this.#logger.error('Error validating remote configuration', error);
      
      return {
        isValid: false,
        errors: [`Remote validation error: ${error.message}`],
        formattedErrors: `Remote validation error: ${error.message}`,
      };
    }
  }

  /**
   * Performs comprehensive configuration validation with detailed error reporting
   * 
   * @param {object} config - Configuration object to validate
   * @returns {object} Detailed validation report
   */
  performDetailedValidation(config) {
    const startTime = Date.now();
    const report = {
      isValid: true,
      errors: [],
      warnings: [],
      categories: {},
      remote: null,
      console: null,
      performance: null,
      validationDurationMs: 0,
    };

    try {
      // Overall schema validation
      const schemaResult = this.validateConfig(config);
      report.isValid = schemaResult.isValid;
      report.errors = schemaResult.errors || [];

      if (!report.isValid) {
        report.validationDurationMs = Date.now() - startTime;
        return report;
      }

      // Validate categories individually
      if (config.categories && typeof config.categories === 'object') {
        for (const [categoryName, categoryConfig] of Object.entries(config.categories)) {
          const categoryResult = this.validateCategory(categoryName, categoryConfig);
          report.categories[categoryName] = {
            isValid: categoryResult.isValid,
            errors: categoryResult.errors || [],
          };

          if (!categoryResult.isValid) {
            report.isValid = false;
            report.errors.push(`Category '${categoryName}': ${categoryResult.formattedErrors}`);
          }
        }
      }

      // Validate remote configuration
      if (config.remote) {
        const remoteResult = this.validateRemoteConfig(config.remote);
        report.remote = {
          isValid: remoteResult.isValid,
          errors: remoteResult.errors || [],
        };

        if (!remoteResult.isValid) {
          report.isValid = false;
          report.errors.push(`Remote config: ${remoteResult.formattedErrors}`);
        }
      }

      // Add warnings for potential issues
      if (config.mode === 'remote' && !config.remote?.endpoint) {
        report.warnings.push('Remote mode enabled but no endpoint specified');
      }

      if (config.enabled === false && config.mode !== 'none') {
        report.warnings.push('Logging disabled but mode is not "none" - consider setting mode to "none"');
      }

      if (config.performance?.slowLogThreshold < 100) {
        report.warnings.push('Very low slow log threshold may impact performance');
      }

      report.validationDurationMs = Date.now() - startTime;
      
      this.#logger.debug(
        `Detailed validation completed in ${report.validationDurationMs}ms`,
        { isValid: report.isValid, errorCount: report.errors.length, warningCount: report.warnings.length }
      );

      return report;
    } catch (error) {
      this.#logger.error('Error during detailed validation', error);
      
      return {
        isValid: false,
        errors: [`Detailed validation error: ${error.message}`],
        warnings: [],
        categories: {},
        remote: null,
        console: null,
        performance: null,
        validationDurationMs: Date.now() - startTime,
      };
    }
  }
}