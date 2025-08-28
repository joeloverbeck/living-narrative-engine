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
  #schemaId =
    'schema://living-narrative-engine/debug-logging-config.schema.json';

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

      this.#logger.debug(
        'Validating debug logging configuration against schema'
      );

      const result = this.#schemaValidator.validateAgainstSchema(
        config,
        this.#schemaId
      );

      if (!result.isValid) {
        this.#logger.warn('Debug logging configuration validation failed', {
          errors: result.errors,
          config,
        });
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
      this.#logger.error(`Error validating category '${categoryName}'`, error);

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
   * Validates semantic rules and business logic constraints
   *
   * @param {object} config - Configuration object to validate
   * @returns {ValidationResult} Semantic validation result with warnings
   */
  validateSemanticRules(config) {
    const errors = [];
    const warnings = [];

    try {
      // Check batch size vs interval balance
      if (
        config.remote?.batchSize > 500 &&
        config.remote?.flushInterval < 500
      ) {
        warnings.push({
          rule: 'batch-flush-balance',
          message:
            'Large batch with short interval may cause performance issues',
          suggestion:
            'Consider increasing flushInterval or decreasing batchSize',
        });
      }

      // Check mode vs category consistency
      if (config.mode === 'none' && config.categories) {
        const enabledCategories = Object.entries(config.categories).filter(
          ([, categoryConfig]) => categoryConfig.enabled
        );

        if (enabledCategories.length > 0) {
          errors.push({
            rule: 'mode-category-mismatch',
            message: `Categories enabled but mode is "none": ${enabledCategories.map(([name]) => name).join(', ')}`,
            suggestion: 'Change mode to enable logging or disable categories',
          });
        }
      }

      // Check remote mode without endpoint
      if (
        (config.mode === 'remote' || config.mode === 'hybrid') &&
        !config.remote?.endpoint
      ) {
        errors.push({
          rule: 'remote-mode-no-endpoint',
          message: 'Remote or hybrid mode enabled but no endpoint specified',
          suggestion: 'Add remote.endpoint or change mode',
        });
      }

      // Check for excessive retry delays
      if (config.remote?.retryMaxDelay > 60000) {
        warnings.push({
          rule: 'excessive-retry-delay',
          message: 'Very high retry max delay may cause poor user experience',
          suggestion: 'Consider reducing retryMaxDelay below 60 seconds',
        });
      }

      // Check circuit breaker configuration balance
      if (
        config.remote?.circuitBreakerThreshold > 10 &&
        config.remote?.circuitBreakerTimeout < 30000
      ) {
        warnings.push({
          rule: 'circuit-breaker-imbalance',
          message:
            'High failure threshold with short timeout may cause frequent circuit breaker activation',
          suggestion: 'Consider lowering threshold or increasing timeout',
        });
      }

      return {
        isValid: errors.length === 0,
        errors: errors.map((e) => e.message),
        warnings: warnings.map((w) => w.message),
        formattedErrors: errors.map((e) => e.message).join('; '),
        details: { errors, warnings },
      };
    } catch (error) {
      this.#logger.error('Error during semantic validation', error);
      return {
        isValid: false,
        errors: [`Semantic validation error: ${error.message}`],
        warnings: [],
        formattedErrors: `Semantic validation error: ${error.message}`,
        details: { errors: [], warnings: [] },
      };
    }
  }

  /**
   * Validates security constraints and environment-specific requirements
   *
   * @param {object} config - Configuration object to validate
   * @returns {ValidationResult} Security validation result
   */
  validateSecurityConstraints(config) {
    const issues = [];
    const warnings = [];

    try {
      // Check for localhost in production
      if (
        process.env.NODE_ENV === 'production' &&
        config.remote?.endpoint?.includes('localhost')
      ) {
        issues.push({
          rule: 'localhost-in-production',
          message: 'Using localhost endpoint in production environment',
          suggestion: 'Use proper production endpoint URL',
        });
      }

      // Check for insecure HTTP in production
      if (
        process.env.NODE_ENV === 'production' &&
        config.remote?.endpoint?.startsWith('http://')
      ) {
        warnings.push({
          rule: 'insecure-endpoint',
          message: 'Using insecure HTTP endpoint in production',
          suggestion: 'Consider using HTTPS for secure logging',
        });
      }

      // Check for excessive batch sizes
      if (config.remote?.batchSize > 1000) {
        warnings.push({
          rule: 'large-batch-size',
          message: 'Very large batch size may cause memory issues',
          suggestion: 'Consider reducing batchSize below 1000',
        });
      }

      // Check for very short flush intervals
      if (config.remote?.flushInterval < 200) {
        warnings.push({
          rule: 'excessive-flush-frequency',
          message:
            'Very short flush interval may cause performance degradation',
          suggestion: 'Consider increasing flushInterval above 200ms',
        });
      }

      // Check for overly permissive circuit breaker
      if (config.remote?.circuitBreakerThreshold > 50) {
        warnings.push({
          rule: 'permissive-circuit-breaker',
          message:
            'Very high circuit breaker threshold may not provide adequate protection',
          suggestion: 'Consider lowering circuitBreakerThreshold below 50',
        });
      }

      return {
        isValid: issues.length === 0,
        errors: issues.map((i) => i.message),
        warnings: warnings.map((w) => w.message),
        formattedErrors: issues.map((i) => i.message).join('; '),
        details: { issues, warnings },
      };
    } catch (error) {
      this.#logger.error('Error during security validation', error);
      return {
        isValid: false,
        errors: [`Security validation error: ${error.message}`],
        warnings: [],
        formattedErrors: `Security validation error: ${error.message}`,
        details: { issues: [], warnings: [] },
      };
    }
  }

  /**
   * Validates endpoint reachability with network checks
   *
   * @param {string} endpoint - Endpoint URL to validate
   * @param {number} timeout - Timeout in milliseconds (default: 5000)
   * @returns {Promise<ValidationResult>} Async validation result
   */
  async validateEndpointReachability(endpoint, timeout = 5000) {
    try {
      if (!endpoint || typeof endpoint !== 'string') {
        return {
          isValid: false,
          errors: ['Endpoint must be a non-empty string'],
          formattedErrors: 'Endpoint must be a non-empty string',
        };
      }

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(endpoint, {
          method: 'HEAD',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        return {
          isValid: response.ok,
          errors: response.ok
            ? []
            : [`Endpoint returned status: ${response.status}`],
          formattedErrors: response.ok
            ? ''
            : `Endpoint returned status: ${response.status}`,
        };
      } catch (fetchError) {
        clearTimeout(timeoutId);

        const errorMessage =
          fetchError.name === 'AbortError'
            ? `Endpoint timeout after ${timeout}ms`
            : `Cannot reach endpoint: ${fetchError.message}`;

        return {
          isValid: false,
          errors: [errorMessage],
          formattedErrors: errorMessage,
        };
      }
    } catch (error) {
      this.#logger.error(
        'Error during endpoint reachability validation',
        error
      );
      return {
        isValid: false,
        errors: [`Endpoint validation error: ${error.message}`],
        formattedErrors: `Endpoint validation error: ${error.message}`,
      };
    }
  }

  /**
   * Performs comprehensive multi-layer configuration validation
   *
   * @param {object} config - Configuration object to validate
   * @param {object} options - Validation options
   * @param {boolean} options.skipSchema - Skip schema validation layer
   * @param {boolean} options.skipSemantic - Skip semantic validation layer
   * @param {boolean} options.skipSecurity - Skip security validation layer
   * @param {boolean} options.skipRuntime - Skip runtime/network validation layer
   * @returns {Promise<object>} Comprehensive validation result
   */
  async performComprehensiveValidation(config, options = {}) {
    const startTime = Date.now();
    const results = {
      isValid: true,
      errors: [],
      warnings: [],
      layers: {
        schema: null,
        semantic: null,
        runtime: null,
        security: null,
      },
      validationDurationMs: 0,
    };

    try {
      // Layer 1: Schema (existing method)
      if (!options.skipSchema) {
        results.layers.schema = this.validateConfig(config);
        if (!results.layers.schema.isValid) {
          results.isValid = false;
          results.errors.push(...results.layers.schema.errors);
        }
      }

      // Layer 2: Semantic (new method)
      if (!options.skipSemantic) {
        results.layers.semantic = this.validateSemanticRules(config);
        if (!results.layers.semantic.isValid) {
          results.isValid = false;
          results.errors.push(...results.layers.semantic.errors);
        }
        if (results.layers.semantic.warnings) {
          results.warnings.push(...results.layers.semantic.warnings);
        }
      }

      // Layer 3: Security (new method)
      if (!options.skipSecurity) {
        results.layers.security = this.validateSecurityConstraints(config);
        if (!results.layers.security.isValid) {
          results.isValid = false;
          results.errors.push(...results.layers.security.errors);
        }
        if (results.layers.security.warnings) {
          results.warnings.push(...results.layers.security.warnings);
        }
      }

      // Layer 4: Runtime (async - new method)
      if (!options.skipRuntime && config.remote?.endpoint) {
        results.layers.runtime = await this.validateEndpointReachability(
          config.remote.endpoint
        );
        // Runtime failures generate warnings, not errors
        if (!results.layers.runtime.isValid) {
          results.warnings.push(...results.layers.runtime.errors);
        }
      }

      results.validationDurationMs = Date.now() - startTime;

      this.#logger.debug(
        `Comprehensive validation completed in ${results.validationDurationMs}ms`,
        {
          isValid: results.isValid,
          errorCount: results.errors.length,
          warningCount: results.warnings.length,
          layersExecuted: Object.keys(results.layers).filter(
            (layer) => results.layers[layer] !== null
          ),
        }
      );

      return results;
    } catch (error) {
      this.#logger.error('Error during comprehensive validation', error);
      return {
        isValid: false,
        errors: [`Comprehensive validation error: ${error.message}`],
        warnings: [],
        layers: results.layers,
        validationDurationMs: Date.now() - startTime,
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
        for (const [categoryName, categoryConfig] of Object.entries(
          config.categories
        )) {
          const categoryResult = this.validateCategory(
            categoryName,
            categoryConfig
          );
          report.categories[categoryName] = {
            isValid: categoryResult.isValid,
            errors: categoryResult.errors || [],
          };

          if (!categoryResult.isValid) {
            report.isValid = false;
            report.errors.push(
              `Category '${categoryName}': ${categoryResult.formattedErrors}`
            );
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
        report.warnings.push(
          'Logging disabled but mode is not "none" - consider setting mode to "none"'
        );
      }

      if (config.performance?.slowLogThreshold < 100) {
        report.warnings.push(
          'Very low slow log threshold may impact performance'
        );
      }

      report.validationDurationMs = Date.now() - startTime;

      this.#logger.debug(
        `Detailed validation completed in ${report.validationDurationMs}ms`,
        {
          isValid: report.isValid,
          errorCount: report.errors.length,
          warningCount: report.warnings.length,
        }
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
