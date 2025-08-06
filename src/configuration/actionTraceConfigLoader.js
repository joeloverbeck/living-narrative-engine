/**
 * @file Loads and validates action tracing configuration from trace-config.json
 * @see traceConfigLoader.js
 */

import { validateDependency } from '../utils/dependencyUtils.js';
import { ConfigurationError } from '../errors/configurationError.js';

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 */

/**
 * @typedef {object} ActionTracingConfig
 * @property {boolean} enabled - Enable or disable action tracing globally
 * @property {string[]} tracedActions - Action IDs to trace. Supports wildcards
 * @property {string} outputDirectory - Directory for trace output files
 * @property {'minimal'|'standard'|'detailed'|'verbose'} verbosity - Level of detail in traces
 * @property {boolean} includeComponentData - Include component data in traces
 * @property {boolean} includePrerequisites - Include prerequisite evaluation details
 * @property {boolean} includeTargets - Include target resolution details
 * @property {number} maxTraceFiles - Maximum number of trace files to keep
 * @property {'age'|'count'} rotationPolicy - How to rotate old trace files
 * @property {number} maxFileAge - Maximum age of trace files in seconds
 */

/**
 * Loads and validates action tracing configuration from the trace configuration file
 */
class ActionTraceConfigLoader {
  #traceConfigLoader;
  #logger;
  #validator;
  #cachedConfig;

  /**
   * @param {object} dependencies
   * @param {object} dependencies.traceConfigLoader - Loader for trace configuration
   * @param {ILogger} dependencies.logger - Logger instance
   * @param {ISchemaValidator} dependencies.validator - Schema validator instance
   */
  constructor({ traceConfigLoader, logger, validator }) {
    validateDependency(traceConfigLoader, 'ITraceConfigLoader', null, {
      requiredMethods: ['loadConfig'],
    });
    validateDependency(logger, 'ILogger', null, {
      requiredMethods: ['info', 'error', 'warn'],
    });
    validateDependency(validator, 'ISchemaValidator', null, {
      requiredMethods: ['validate'],
    });

    this.#traceConfigLoader = traceConfigLoader;
    this.#logger = logger;
    this.#validator = validator;
    this.#cachedConfig = null;
  }

  /**
   * Load action tracing configuration from the trace config file
   *
   * @returns {Promise<ActionTracingConfig>} Action tracing configuration
   */
  async loadConfig() {
    if (this.#cachedConfig) {
      return this.#cachedConfig;
    }

    try {
      // Load the entire trace configuration
      const fullConfig = await this.#traceConfigLoader.loadConfig();

      // Handle error results from TraceConfigLoader
      if (fullConfig.error) {
        this.#logger.warn(
          'Failed to load trace configuration, using defaults',
          fullConfig
        );
        return this.#getDefaultConfig();
      }

      // Extract action tracing section
      const actionTracingConfig =
        fullConfig.actionTracing || this.#getDefaultConfig();

      // Validate configuration against schema
      const validationResult = await this.#validator.validate(
        'action-trace-config',
        { actionTracing: actionTracingConfig }
      );

      if (!validationResult.isValid) {
        this.#logger.error(
          'Invalid action tracing configuration, using defaults',
          { errors: validationResult.errors }
        );
        // Return safe defaults on validation error
        return this.#getDefaultConfig();
      }

      // Cache the validated configuration
      this.#cachedConfig = actionTracingConfig;

      this.#logger.info('Action tracing configuration loaded', {
        enabled: actionTracingConfig.enabled,
        tracedActionsCount: actionTracingConfig.tracedActions.length,
        outputDirectory: actionTracingConfig.outputDirectory,
      });

      return actionTracingConfig;
    } catch (error) {
      this.#logger.error('Failed to load action tracing configuration', error);

      // Return safe defaults on error
      return this.#getDefaultConfig();
    }
  }

  /**
   * Get default configuration when loading fails or section is missing
   *
   * @private
   * @returns {ActionTracingConfig}
   */
  #getDefaultConfig() {
    return {
      enabled: false,
      tracedActions: [],
      outputDirectory: './traces/actions',
      verbosity: 'standard',
      includeComponentData: true,
      includePrerequisites: true,
      includeTargets: true,
      maxTraceFiles: 100,
      rotationPolicy: 'age',
      maxFileAge: 86400,
    };
  }

  /**
   * Reload configuration (for hot reloading support)
   *
   * @returns {Promise<ActionTracingConfig>}
   */
  async reloadConfig() {
    this.#cachedConfig = null;
    return this.loadConfig();
  }

  /**
   * Check if action tracing is enabled
   *
   * @returns {Promise<boolean>}
   */
  async isEnabled() {
    const config = await this.loadConfig();
    return config.enabled === true;
  }

  /**
   * Get specific configuration value
   *
   * @param {string} key - Configuration key
   * @returns {Promise<*>}
   */
  async getConfigValue(key) {
    const config = await this.loadConfig();
    return config[key];
  }

  /**
   * Check if a specific action should be traced
   *
   * @param {string} actionId - Action ID to check (e.g., 'core:go')
   * @returns {Promise<boolean>}
   */
  async shouldTraceAction(actionId) {
    const config = await this.loadConfig();

    if (!config.enabled) {
      return false;
    }

    // Check if action matches any traced patterns
    return config.tracedActions.some((pattern) => {
      // Handle wildcard patterns
      if (pattern === '*') {
        return true;
      }

      // Handle mod-specific wildcards (e.g., 'core:*')
      if (pattern.endsWith(':*')) {
        const modId = pattern.slice(0, -2);
        return actionId.startsWith(modId + ':');
      }

      // Exact match
      return pattern === actionId;
    });
  }
}

export default ActionTraceConfigLoader;
