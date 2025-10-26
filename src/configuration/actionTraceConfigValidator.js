/**
 * @file Configuration validator for action tracing system
 * Provides comprehensive validation using JSON Schema and custom rules
 */

import { validateDependency, assertPresent } from '../utils/dependencyUtils.js';
import { formatAjvErrors } from '../utils/ajvUtils.js';
// Removed path import - not available in browser environment

/**
 * Validates action tracing configuration against schema and custom rules
 */
class ActionTraceConfigValidator {
  #schemaValidator;
  #logger;
  #customValidators;

  /**
   * @param {object} dependencies
   * @param {ISchemaValidator} dependencies.schemaValidator - AJV schema validator
   * @param {ILogger} dependencies.logger - Logger instance
   */
  constructor({ schemaValidator, logger }) {
    validateDependency(schemaValidator, 'ISchemaValidator', null, {
      requiredMethods: ['validate', 'addSchema', 'removeSchema'],
    });
    validateDependency(logger, 'ILogger', null, {
      requiredMethods: ['info', 'error', 'warn', 'debug'],
    });

    this.#schemaValidator = schemaValidator;
    this.#logger = logger;
    this.#customValidators = new Map();

    this.#setupCustomValidators();
  }

  /**
   * Initialize validator
   * Note: Schema validation is deferred until actual validation is needed,
   * after schemas have been loaded by the application
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      this.#logger.debug('Initializing action trace config validator');

      this.#logger.info(
        'Action trace config validator initialized successfully'
      );
    } catch (error) {
      this.#logger.error('Failed to initialize config validator', error);
      throw new Error(`Validator initialization failed: ${error.message}`);
    }
  }

  /**
   * Validate action tracing configuration
   *
   * @param {object} config - Configuration to validate
   * @returns {ValidationResult} Validation result with errors if any
   */
  async validateConfiguration(config) {
    assertPresent(config, 'Configuration is required');

    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      normalizedConfig: null,
    };

    try {
      // Step 1: JSON Schema validation
      const schemaResult = await this.#validateAgainstSchema(config);
      if (!schemaResult.isValid) {
        result.isValid = false;
        result.errors.push(...schemaResult.errors);
      }

      // Step 2: Custom validation rules
      const customResult = await this.#runCustomValidation(config);
      if (!customResult.isValid) {
        result.isValid = false;
        result.errors.push(...customResult.errors);
      }

      // Step 3: Add warnings for non-critical issues
      result.warnings.push(...customResult.warnings);

      // Step 4: Normalize configuration if valid
      if (result.isValid) {
        result.normalizedConfig = await this.#normalizeConfiguration(config);
      }

      // Log validation results
      this.#logValidationResult(result);

      return result;
    } catch (error) {
      this.#logger.error('Configuration validation failed', error);

      return {
        isValid: false,
        errors: [`Validation error: ${error.message}`],
        warnings: [],
        normalizedConfig: null,
      };
    }
  }

  /**
   * Validate specific configuration property
   *
   * @param {string} property - Property name to validate
   * @param {*} value - Value to validate
   * @returns {ValidationResult} Property validation result
   */
  validateProperty(property, value) {
    const validator = this.#customValidators.get(property);
    if (!validator) {
      return {
        isValid: true,
        errors: [],
        warnings: [],
      };
    }

    try {
      const result = validator(value);
      // Ensure the result has the expected structure
      return {
        isValid: result.errors ? result.errors.length === 0 : true,
        errors: result.errors || [],
        warnings: result.warnings || [],
      };
    } catch (error) {
      this.#logger.error(`Property validation failed for ${property}`, error);
      return {
        isValid: false,
        errors: [`Property ${property} validation error: ${error.message}`],
        warnings: [],
      };
    }
  }

  /**
   * Validate against JSON schema
   *
   * @param config
   * @private
   */
  async #validateAgainstSchema(config) {
    // Use the AjvSchemaValidator's validate method
    const validationResult = await this.#schemaValidator.validate(
      'schema://living-narrative-engine/trace-config.schema.json',
      config
    );

    // Handle both validation result formats (isValid or valid)
    const isValid =
      validationResult.isValid !== undefined
        ? validationResult.isValid
        : validationResult.valid;

    if (isValid) {
      return { isValid: true, errors: [] };
    }

    // Format AJV errors for user-friendly messages
    let formattedErrors = [];
    if (validationResult.errors && Array.isArray(validationResult.errors)) {
      formattedErrors = validationResult.errors.map((error) =>
        this.#formatSchemaError(error)
      );
    } else if (validationResult.errors) {
      // If errors is not an array, handle it as a single error
      formattedErrors = [this.#formatSchemaError(validationResult.errors)];
    }

    return {
      isValid: false,
      errors: formattedErrors,
    };
  }

  /**
   * Run custom validation rules
   *
   * @param config
   * @private
   */
  async #runCustomValidation(config) {
    const errors = [];
    const warnings = [];

    // Extract action tracing config
    const actionTraceConfig = config.actionTracing || {};

    // Custom validation: tracedActions patterns
    const actionResult = this.#validateTracedActions(
      actionTraceConfig.tracedActions
    );
    errors.push(...actionResult.errors);
    warnings.push(...actionResult.warnings);

    // Custom validation: output directory
    const dirResult = this.#validateOutputDirectory(
      actionTraceConfig.outputDirectory
    );
    errors.push(...dirResult.errors);
    warnings.push(...dirResult.warnings);

    // Custom validation: file rotation configuration
    const rotationResult = this.#validateRotationConfig(actionTraceConfig);
    errors.push(...rotationResult.errors);
    warnings.push(...rotationResult.warnings);

    // Custom validation: performance impact assessment
    const performanceResult =
      this.#validatePerformanceImpact(actionTraceConfig);
    warnings.push(...performanceResult.warnings);

    // NEW: Cross-field validation
    const crossFieldResult =
      this.#validateCrossFieldConstraints(actionTraceConfig);
    errors.push(...crossFieldResult.errors);
    warnings.push(...crossFieldResult.warnings);

    // NEW: Generate configuration recommendations
    const recommendations =
      this.#generateConfigurationRecommendations(actionTraceConfig);
    warnings.push(...recommendations);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate traced actions configuration
   *
   * @param tracedActions
   * @private
   */
  #validateTracedActions(tracedActions) {
    const errors = [];
    const warnings = [];

    if (!tracedActions || !Array.isArray(tracedActions)) {
      return { errors, warnings };
    }

    // Check for duplicate actions
    const duplicates = tracedActions.filter(
      (action, index, arr) => arr.indexOf(action) !== index
    );

    if (duplicates.length > 0) {
      warnings.push(`Duplicate traced actions found: ${duplicates.join(', ')}`);
    }

    // Validate action ID patterns - separate critical errors from warnings
    const criticallyInvalidActions = [];
    const warningPatterns = [];

    tracedActions.forEach((action) => {
      if (typeof action !== 'string') {
        criticallyInvalidActions.push(action);
        return;
      }

      // Extended valid patterns:
      // - 'mod:action' (exact match)
      // - '*' (universal wildcard)
      // - 'mod:*' (mod wildcard)
      // - 'prefix*' (prefix wildcard)
      // - '*suffix' (suffix wildcard)
      // - '*middle*' (contains wildcard)
      // - 'mod:prefix*' (mod with action prefix)
      // - 'mod:*suffix' (mod with action suffix)

      // Basic validation: non-empty string
      if (action.length === 0) {
        warningPatterns.push({ pattern: action, reason: 'Empty pattern' });
        return;
      }

      // Check for multiple consecutive asterisks - warning not error
      if (action.includes('**')) {
        warningPatterns.push({
          pattern: action,
          reason: 'Redundant asterisks',
        });
        return;
      }

      // Check for invalid characters - allow uppercase as warning
      const strictAllowedPattern = /^[a-z0-9_:\-*]+$/;
      const lenientAllowedPattern = /^[a-zA-Z0-9_:\-*]+$/;

      if (!lenientAllowedPattern.test(action)) {
        // Contains truly invalid characters
        criticallyInvalidActions.push(action);
        return;
      }

      if (!strictAllowedPattern.test(action)) {
        // Contains uppercase - warning
        warningPatterns.push({
          pattern: action,
          reason: 'Contains uppercase characters',
        });
        return;
      }

      // Check if pattern contains a colon (namespace separator)
      if (action.includes(':')) {
        const parts = action.split(':');
        if (parts.length !== 2) {
          criticallyInvalidActions.push(action); // Only one colon allowed
          return;
        }

        const [modPart, actionPart] = parts;

        // Mod part must be either '*' or valid mod name (no wildcards in mod name except full wildcard)
        if (modPart !== '*' && modPart.includes('*')) {
          warningPatterns.push({
            pattern: action,
            reason: 'Mod name contains partial wildcards',
          });
          return;
        }

        // Check mod name format - be lenient with uppercase
        if (modPart !== '*') {
          if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(modPart)) {
            criticallyInvalidActions.push(action);
            return;
          }
          if (!/^[a-z][a-z0-9_-]*$/.test(modPart)) {
            warningPatterns.push({
              pattern: action,
              reason: 'Mod name should be lowercase',
            });
            return;
          }
        }

        // Action part can contain wildcards
        if (actionPart.length === 0) {
          warningPatterns.push({
            pattern: action,
            reason: 'Empty action part after colon',
          });
          return;
        }
      } else {
        // No colon - must be a wildcard pattern or it's invalid
        // Valid patterns without colon: '*', 'prefix*', '*suffix', '*middle*'
        if (!action.includes('*')) {
          // Not a wildcard and no namespace - this is invalid
          criticallyInvalidActions.push(action);
          return;
        }
        // Even with wildcards, patterns without colons (except '*') are invalid
        // This maintains strict mod:action format requirement
        if (action !== '*') {
          criticallyInvalidActions.push(action);
          return;
        }
      }
    });

    // Only add critical errors that prevent processing
    if (criticallyInvalidActions.length > 0) {
      errors.push(
        `Invalid action ID patterns: ${criticallyInvalidActions.join(', ')}. ` +
          `Valid formats: 'mod:action', '*', 'mod:*', 'prefix*', '*suffix', '*middle*', 'mod:prefix*'`
      );
    }

    // Add warnings for patterns that can be processed but are not ideal
    warningPatterns.forEach(({ pattern, reason }) => {
      warnings.push(`Invalid pattern '${pattern}': ${reason}`);
    });

    // Performance warning for too many traced actions
    if (tracedActions.length > 20) {
      warnings.push(
        `Tracing ${tracedActions.length} actions may impact performance. ` +
          `Consider using wildcards or reducing the count.`
      );
    }

    // Check for wildcard conflicts
    const hasWildcard = tracedActions.includes('*');
    if (hasWildcard && tracedActions.length > 1) {
      warnings.push(
        `Wildcard '*' will trace all actions, making other specific actions redundant.`
      );
    }

    return { errors, warnings };
  }

  /**
   * Validate output directory configuration
   *
   * @param outputDirectory
   * @private
   */
  #validateOutputDirectory(outputDirectory) {
    const errors = [];
    const warnings = [];

    if (!outputDirectory) {
      return { errors, warnings };
    }

    // Path validation removed - not applicable in browser environment
    // Previously checked for path traversal and absolute paths
    // These checks are not meaningful in browser context

    // Removed path permission checks - not applicable in browser environment

    return { errors, warnings };
  }

  /**
   * Validate file rotation configuration
   *
   * @param config
   * @private
   */
  #validateRotationConfig(config) {
    const errors = [];
    const warnings = [];

    const { rotationPolicy, maxTraceFiles, maxFileAge } = config;

    // Validate rotation policy consistency
    if (rotationPolicy === 'count' && !maxTraceFiles) {
      warnings.push(
        `Rotation policy 'count' specified but maxTraceFiles not set. ` +
          `Files may accumulate indefinitely.`
      );
    }

    if (rotationPolicy === 'age' && !maxFileAge) {
      warnings.push(
        `Rotation policy 'age' specified but maxFileAge not set. ` +
          `Files may accumulate indefinitely.`
      );
    }

    // Performance warnings
    if (maxTraceFiles && maxTraceFiles > 500) {
      warnings.push(
        `High maxTraceFiles value (${maxTraceFiles}) may impact filesystem performance.`
      );
    }

    if (maxFileAge && maxFileAge < 3600) {
      warnings.push(
        `Very short maxFileAge (${maxFileAge}s) may cause frequent file cleanup.`
      );
    }

    return { errors, warnings };
  }

  /**
   * Assess potential performance impact of configuration
   *
   * @param config
   * @private
   */
  #validatePerformanceImpact(config) {
    const warnings = [];

    if (!config.enabled) {
      return { warnings };
    }

    // Removed performance impact warning - users who select verbose mode
    // with all details enabled want that level of detail

    return { warnings };
  }

  /**
   * Validate cross-field constraints and dependencies
   *
   * @param config
   * @private
   */
  #validateCrossFieldConstraints(config) {
    const errors = [];
    const warnings = [];

    // Check if text format options are specified when text format is not enabled
    if (
      config.textFormatOptions &&
      (!config.outputFormats || !config.outputFormats.includes('text'))
    ) {
      warnings.push(
        `Text format options are configured but 'text' is not in outputFormats. ` +
          `These options will be ignored unless text output is enabled.`
      );
    }

    // Check for HTML/Markdown format without appropriate text options
    if (config.outputFormats) {
      if (
        config.outputFormats.includes('html') &&
        config.textFormatOptions?.enableColors === true
      ) {
        warnings.push(
          `ANSI colors are enabled but HTML output is selected. ` +
            `Colors may not render correctly in HTML format.`
        );
      }

      if (
        config.outputFormats.includes('markdown') &&
        config.textFormatOptions?.sectionSeparator &&
        config.textFormatOptions.sectionSeparator.length !== 1
      ) {
        warnings.push(
          `Invalid section separator for Markdown output. ` +
            `Separator should be a single character.`
        );
      }
    }

    // Validate verbosity vs inclusion settings
    if (
      config.verbosity === 'minimal' &&
      (config.includeComponentData ||
        config.includePrerequisites ||
        config.includeTargets)
    ) {
      warnings.push(
        `Verbosity is set to 'minimal' but detailed inclusions are enabled. ` +
          `These inclusions will be ignored at minimal verbosity level.`
      );
    }

    // Check for conflicting rotation policies - only warn if the conflicting field actually exists
    if (config.rotationPolicy === 'count' && config.maxFileAge !== undefined) {
      warnings.push(
        `Both 'count' rotation policy and maxFileAge are specified. ` +
          `maxFileAge will be ignored when using count-based rotation.`
      );
    }

    if (config.rotationPolicy === 'age' && config.maxTraceFiles !== undefined) {
      warnings.push(
        `Both 'age' rotation policy and maxTraceFiles are specified. ` +
          `maxTraceFiles will be ignored when using age-based rotation.`
      );
    }

    // Validate text format options ranges
    if (config.textFormatOptions) {
      const opts = config.textFormatOptions;

      if (
        opts.lineWidth !== undefined &&
        (opts.lineWidth < 40 || opts.lineWidth > 300)
      ) {
        errors.push(
          `Text format lineWidth ${opts.lineWidth} is out of recommended range (40-300).`
        );
      }

      if (
        opts.indentSize !== undefined &&
        (opts.indentSize < 0 || opts.indentSize > 8)
      ) {
        errors.push(
          `Text format indentSize ${opts.indentSize} is out of valid range (0-8).`
        );
      }
    }

    return { errors, warnings };
  }

  /**
   * Generate configuration recommendations for optimization
   *
   * @param config
   * @private
   * @returns {string[]} Array of recommendation messages
   */
  #generateConfigurationRecommendations(config) {
    const recommendations = [];

    // Recommend wildcard usage for multiple actions from same mod
    if (config.tracedActions && config.tracedActions.length > 5) {
      const modCounts = {};
      config.tracedActions.forEach((action) => {
        if (action.includes(':')) {
          const mod = action.split(':')[0];
          modCounts[mod] = (modCounts[mod] || 0) + 1;
        }
      });

      Object.entries(modCounts).forEach(([mod, count]) => {
        if (count >= 3) {
          recommendations.push(
            `Recommendation: Consider using '${mod}:*' wildcard instead of ${count} individual actions from '${mod}' mod.`
          );
        }
      });
    }

    // Removed verbosity recommendation - verbose mode is a valid choice
    // and users who select it want the detailed output

    // Recommend performance settings based on traced actions count
    if (
      config.tracedActions &&
      config.tracedActions.includes('*') &&
      config.verbosity !== 'minimal'
    ) {
      recommendations.push(
        `Recommendation: Tracing all actions with '${config.verbosity}' verbosity will impact performance. ` +
          `Consider using 'minimal' verbosity or specific action patterns.`
      );
    }

    // Recommend text format optimization
    if (
      config.outputFormats &&
      config.outputFormats.includes('text') &&
      config.textFormatOptions?.performanceSummary === false
    ) {
      recommendations.push(
        `Recommendation: Enable 'performanceSummary' in textFormatOptions for better performance insights.`
      );
    }

    // Recommend appropriate rotation settings
    if (
      config.maxTraceFiles &&
      config.maxTraceFiles > 200 &&
      config.rotationPolicy === 'count'
    ) {
      recommendations.push(
        `Recommendation: High maxTraceFiles (${config.maxTraceFiles}) may impact directory performance. ` +
          `Consider age-based rotation or lower file count.`
      );
    }

    // Recommend enabling useful features
    if (config.enabled && !config.textFormatOptions?.includeTimestamps) {
      recommendations.push(
        `Recommendation: Enable 'includeTimestamps' in textFormatOptions for better trace correlation.`
      );
    }

    return recommendations;
  }

  /**
   * Normalize configuration for consistent usage
   *
   * @param config
   * @private
   */
  async #normalizeConfiguration(config) {
    const normalized = JSON.parse(JSON.stringify(config));
    const actionTracing = normalized.actionTracing;

    // Remove duplicate traced actions
    if (actionTracing.tracedActions) {
      actionTracing.tracedActions = [...new Set(actionTracing.tracedActions)];
    }

    // Skip path normalization - not applicable in browser environment
    // Output directory is kept as-is

    // Set default rotation values based on policy
    if (
      actionTracing.rotationPolicy === 'count' &&
      !actionTracing.maxTraceFiles
    ) {
      actionTracing.maxTraceFiles = 100;
    }

    if (actionTracing.rotationPolicy === 'age' && !actionTracing.maxFileAge) {
      actionTracing.maxFileAge = 86400; // 24 hours
    }

    return normalized;
  }

  /**
   * Setup custom validation functions for specific properties
   *
   * @private
   */
  #setupCustomValidators() {
    // Add custom validators for complex validation logic
    this.#customValidators.set('tracedActions', (value) => {
      return this.#validateTracedActions(value);
    });

    this.#customValidators.set('outputDirectory', (value) => {
      return this.#validateOutputDirectory(value);
    });
  }

  /**
   * Format schema validation error for user-friendly display
   *
   * @param error
   * @private
   */
  #formatSchemaError(error) {
    const property =
      error.instancePath?.replace('/actionTracing/', '') || 'root';
    const message = error.message;
    const value = error.data;

    switch (error.keyword) {
      case 'required':
        return `Missing required property: ${error.params?.missingProperty}`;

      case 'enum':
        return `Invalid value '${value}' for ${property}. Valid values: ${error.params?.allowedValues?.join(', ')}`;

      case 'pattern':
        return `Invalid format for ${property}: '${value}'. Expected pattern: ${error.params?.pattern}`;

      case 'minimum':
      case 'maximum':
        return `Value ${value} for ${property} is outside valid range (${error.params?.limit})`;

      case 'type':
        return `Property ${property} must be of type ${error.params?.type}, got ${typeof value}`;

      default:
        return `${property}: ${message}`;
    }
  }

  /**
   * Log validation results
   *
   * @param result
   * @private
   */
  #logValidationResult(result) {
    if (result.isValid) {
      this.#logger.debug('Action tracing configuration validation passed', {
        warningCount: result.warnings.length,
      });
    } else {
      this.#logger.warn('Action tracing configuration validation failed', {
        errorCount: result.errors.length,
        warningCount: result.warnings.length,
      });
    }

    // Log individual errors and warnings at appropriate levels
    result.errors.forEach((error) =>
      this.#logger.error(`Config validation error: ${error}`)
    );
    result.warnings.forEach((warning) =>
      this.#logger.warn(`Config validation warning: ${warning}`)
    );
  }
}

export default ActionTraceConfigValidator;
