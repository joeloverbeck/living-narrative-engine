/**
 * @file Loads and validates action tracing configuration from trace-config.json
 * @see traceConfigLoader.js
 */

import { validateDependency } from '../utils/dependencyUtils.js';
import { ConfigurationError } from '../errors/configurationError.js';
import ActionTraceConfigValidator from './actionTraceConfigValidator.js';

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
  #configValidator;
  #cachedConfig;
  // Performance optimization fields
  #tracedActionsSet = new Set(); // O(1) exact match lookups
  #wildcardPatterns = []; // Pre-compiled wildcard patterns for performance
  #lookupStatistics = {
    exactMatches: 0,
    wildcardMatches: 0,
    totalLookups: 0,
    averageLookupTime: 0,
    // Enhanced performance monitoring
    slowLookups: 0, // Count of lookups >1ms
    fastestLookup: Number.MAX_VALUE,
    slowestLookup: 0,
    totalLookupTime: 0, // For precise average calculation
  };

  /**
   * @param {object} dependencies
   * @param {object} dependencies.traceConfigLoader - Loader for trace configuration
   * @param {ILogger} dependencies.logger - Logger instance
   * @param {ISchemaValidator} dependencies.validator - Schema validator instance
   * @param {number} [dependencies.cacheTtl] - Cache TTL in milliseconds (default: 1 minute)
   */
  constructor({ traceConfigLoader, logger, validator, cacheTtl = 60000 }) {
    validateDependency(traceConfigLoader, 'ITraceConfigLoader', null, {
      requiredMethods: ['loadConfig'],
    });
    validateDependency(logger, 'ILogger', null, {
      requiredMethods: ['info', 'error', 'warn', 'debug'],
    });
    validateDependency(validator, 'ISchemaValidator', null, {
      requiredMethods: ['validate'],
    });

    this.#traceConfigLoader = traceConfigLoader;
    this.#logger = logger;
    this.#validator = validator;
    this.#cachedConfig = {
      data: null,
      timestamp: null,
      ttl: cacheTtl,
    };

    // Initialize enhanced config validator
    this.#configValidator = new ActionTraceConfigValidator({
      schemaValidator: validator,
      logger: this.#logger,
    });
  }

  /**
   * Load action tracing configuration from the trace config file
   *
   * @returns {Promise<ActionTracingConfig>} Action tracing configuration
   */
  async loadConfig() {
    if (this.#cachedConfig.data && !this.#isCacheExpired()) {
      return this.#cachedConfig.data;
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
        const defaultConfig = this.#getDefaultConfig();
        this.#buildLookupStructures(defaultConfig);
        return defaultConfig;
      }

      // Extract action tracing section
      let actionTracingConfig =
        fullConfig.actionTracing || this.#getDefaultConfig();

      // If using defaults due to missing section, build lookup structures immediately
      if (!fullConfig.actionTracing) {
        this.#buildLookupStructures(actionTracingConfig);
      }

      // Check if schema is loaded before attempting validation
      const schemaId =
        'schema://living-narrative-engine/trace-config.schema.json';
      const schemaLoaded =
        this.#validator.isSchemaLoaded &&
        typeof this.#validator.isSchemaLoaded === 'function' &&
        this.#validator.isSchemaLoaded(schemaId);

      let validationResult;

      if (!schemaLoaded) {
        // Schema not yet loaded - skip validation and log debug message
        this.#logger.debug(
          'Trace config schema not yet loaded, proceeding without schema validation'
        );
        validationResult = { isValid: true, warnings: [] };
      } else {
        // Schema is loaded, perform validation
        try {
          // Initialize the enhanced validator
          await this.#configValidator.initialize();

          // Use enhanced validator for comprehensive validation
          validationResult = await this.#configValidator.validateConfiguration({
            actionTracing: actionTracingConfig,
          });

          // Log warnings even if validation passed
          validationResult.warnings.forEach((warning) => {
            this.#logger.warn(`Configuration warning: ${warning}`);
          });

          // Use normalized configuration if available
          if (validationResult.normalizedConfig) {
            actionTracingConfig =
              validationResult.normalizedConfig.actionTracing;
            this.#logger.debug('Using normalized configuration', {
              originalCount: fullConfig.actionTracing?.tracedActions?.length,
              normalizedCount: actionTracingConfig.tracedActions?.length
            });
          }
        } catch (validatorError) {
          this.#logger.warn(
            'Enhanced validator failed, falling back to basic validation',
            validatorError
          );

          // Fall back to basic schema validation
          validationResult = await this.#validator.validate(schemaId, {
            actionTracing: actionTracingConfig,
          });
        }
      }

      // Handle both validation result formats (isValid or valid)
      const isValid =
        validationResult.isValid !== undefined
          ? validationResult.isValid
          : validationResult.valid;

      if (!isValid) {
        this.#logger.error(
          'Invalid action tracing configuration, using defaults',
          { errors: validationResult.errors }
        );
        // Return safe defaults on validation error
        const defaultConfig = this.#getDefaultConfig();
        this.#buildLookupStructures(defaultConfig);
        // Cache the default config to prevent re-validation
        this.#cachedConfig.data = defaultConfig;
        this.#cachedConfig.timestamp = Date.now();
        return defaultConfig;
      }

      // Cache the validated configuration with timestamp
      this.#cachedConfig.data = actionTracingConfig;
      this.#cachedConfig.timestamp = Date.now();

      // Build optimized lookup structures for performance
      this.#buildLookupStructures(actionTracingConfig);

      this.#logger.info('Action tracing configuration loaded', {
        enabled: actionTracingConfig.enabled,
        tracedActionsCount: actionTracingConfig.tracedActions.length,
        exactMatches: this.#tracedActionsSet.size,
        wildcardPatterns: this.#wildcardPatterns.length,
        outputDirectory: actionTracingConfig.outputDirectory,
      });

      return actionTracingConfig;
    } catch (error) {
      this.#logger.error('Failed to load action tracing configuration', error);

      // Return safe defaults on error
      const defaultConfig = this.#getDefaultConfig();
      this.#buildLookupStructures(defaultConfig);
      return defaultConfig;
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
    this.#cachedConfig = {
      data: null,
      timestamp: null,
      ttl: this.#cachedConfig.ttl, // Preserve TTL setting
    };
    // Reset performance optimization structures
    this.#tracedActionsSet.clear();
    this.#wildcardPatterns = [];
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
   * Get verbosity level for trace output
   *
   * @returns {Promise<'minimal'|'standard'|'detailed'|'verbose'>}
   */
  async getVerbosityLevel() {
    const config = await this.loadConfig();
    return config.verbosity;
  }

  /**
   * Get inclusion configuration for trace data
   *
   * @returns {Promise<{includeComponentData: boolean, includePrerequisites: boolean, includeTargets: boolean}>}
   */
  async getInclusionConfig() {
    const config = await this.loadConfig();
    return {
      includeComponentData: config.includeComponentData,
      includePrerequisites: config.includePrerequisites,
      includeTargets: config.includeTargets,
    };
  }

  /**
   * Get output directory for trace files
   *
   * @returns {Promise<string>}
   */
  async getOutputDirectory() {
    const config = await this.loadConfig();
    return config.outputDirectory;
  }

  /**
   * Get file rotation configuration
   *
   * @returns {Promise<{rotationPolicy: 'age'|'count', maxTraceFiles: number, maxFileAge: number}>}
   */
  async getRotationConfig() {
    const config = await this.loadConfig();
    return {
      rotationPolicy: config.rotationPolicy,
      maxTraceFiles: config.maxTraceFiles,
      maxFileAge: config.maxFileAge,
    };
  }

  /**
   * Filter trace data based on verbosity level
   *
   * @param {object} data - Raw trace data
   * @returns {Promise<object>}
   */
  async filterDataByVerbosity(data) {
    const verbosity = await this.getVerbosityLevel();
    const inclusion = await this.getInclusionConfig();

    const filteredData = {
      timestamp: data.timestamp,
      actionId: data.actionId,
    };

    // Include basic result information at all verbosity levels
    if (data.result !== undefined) {
      filteredData.result = data.result;
    }

    // Standard and above - include basic execution details
    if (verbosity !== 'minimal') {
      if (data.executionTime !== undefined) {
        filteredData.executionTime = data.executionTime;
      }
      if (data.success !== undefined) {
        filteredData.success = data.success;
      }
    }

    // Detailed and above - include configured inclusion options
    if (verbosity === 'detailed' || verbosity === 'verbose') {
      if (inclusion.includeComponentData && data.componentData) {
        filteredData.componentData = data.componentData;
      }
      if (inclusion.includePrerequisites && data.prerequisites) {
        filteredData.prerequisites = data.prerequisites;
      }
      if (inclusion.includeTargets && data.targets) {
        filteredData.targets = data.targets;
      }
    }

    // Verbose - include all available data
    if (verbosity === 'verbose') {
      if (data.debugInfo) {
        filteredData.debugInfo = data.debugInfo;
      }
      if (data.stackTrace) {
        filteredData.stackTrace = data.stackTrace;
      }
      if (data.systemState) {
        filteredData.systemState = data.systemState;
      }
    }

    return filteredData;
  }

  /**
   * Get performance and usage statistics
   *
   * @returns {{exactMatches: number, wildcardMatches: number, totalLookups: number, averageLookupTime: number, tracedActionsCount: number, wildcardPatternsCount: number, cacheTtl: number, cacheStatus: string, cacheAge: number}}
   */
  getStatistics() {
    const now = Date.now();
    const cacheAge = this.#cachedConfig.timestamp
      ? now - this.#cachedConfig.timestamp
      : 0;
    const cacheStatus = this.#cachedConfig.data
      ? this.#isCacheExpired()
        ? 'expired'
        : 'valid'
      : 'empty';

    return {
      exactMatches: this.#lookupStatistics.exactMatches,
      wildcardMatches: this.#lookupStatistics.wildcardMatches,
      totalLookups: this.#lookupStatistics.totalLookups,
      averageLookupTime: this.#lookupStatistics.averageLookupTime,
      // Enhanced performance metrics
      slowLookups: this.#lookupStatistics.slowLookups,
      fastestLookup:
        this.#lookupStatistics.fastestLookup === Number.MAX_VALUE
          ? 0
          : this.#lookupStatistics.fastestLookup,
      slowestLookup: this.#lookupStatistics.slowestLookup,
      slowLookupRate:
        this.#lookupStatistics.totalLookups > 0
          ? (this.#lookupStatistics.slowLookups /
              this.#lookupStatistics.totalLookups) *
            100
          : 0,
      tracedActionsCount: this.#tracedActionsSet.size,
      wildcardPatternsCount: this.#wildcardPatterns.length,
      cacheTtl: this.#cachedConfig.ttl,
      cacheStatus,
      cacheAge,
    };
  }

  /**
   * Reset performance statistics
   */
  resetStatistics() {
    this.#lookupStatistics = {
      exactMatches: 0,
      wildcardMatches: 0,
      totalLookups: 0,
      averageLookupTime: 0,
      // Enhanced performance monitoring
      slowLookups: 0,
      fastestLookup: Number.MAX_VALUE,
      slowestLookup: 0,
      totalLookupTime: 0,
    };
  }

  /**
   * Check if a specific action should be traced
   *
   * @param {string} actionId - Action ID to check (e.g., 'core:go')
   * @returns {Promise<boolean>}
   */
  async shouldTraceAction(actionId) {
    const startTime = performance.now();
    const config = await this.loadConfig();

    this.#lookupStatistics.totalLookups++;

    if (!config.enabled) {
      this.#updateLookupTime(startTime);
      return false;
    }

    // Fast path: O(1) exact match using Set
    if (this.#tracedActionsSet.has(actionId)) {
      this.#lookupStatistics.exactMatches++;
      this.#updateLookupTime(startTime);
      return true;
    }

    // Check pre-compiled wildcard patterns
    const wildcardMatch = this.#wildcardPatterns.some((pattern) => {
      if (pattern.type === 'all') {
        return true;
      }
      if (pattern.type === 'mod') {
        return (
          actionId.startsWith(pattern.prefix) && pattern.regex.test(actionId)
        );
      }
      if (pattern.type === 'general') {
        // NEW: Support for general wildcard patterns
        return pattern.regex.test(actionId);
      }
      return false;
    });

    if (wildcardMatch) {
      this.#lookupStatistics.wildcardMatches++;
    }

    this.#updateLookupTime(startTime);
    return wildcardMatch;
  }

  /**
   * Build optimized lookup structures from configuration
   *
   * @private
   * @param {ActionTracingConfig} config - Action tracing configuration
   */
  #buildLookupStructures(config) {
    this.#tracedActionsSet.clear();
    this.#wildcardPatterns = [];

    for (const pattern of config.tracedActions) {
      const validationResult = this.#validatePattern(pattern);
      if (!validationResult.valid) {
        this.#logger.warn(
          `Invalid pattern '${pattern}': ${validationResult.errors.join(', ')}`
        );
        continue;
      }

      if (pattern === '*') {
        this.#wildcardPatterns.push({ type: 'all' });
      } else if (pattern.endsWith(':*')) {
        // Existing mod wildcard support
        const prefix = pattern.slice(0, -1);
        this.#wildcardPatterns.push({
          type: 'mod',
          prefix,
          pattern: pattern,
          regex: new RegExp(
            `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.+$`
          ),
        });
      } else if (pattern.includes('*')) {
        // NEW: General wildcard patterns
        this.#wildcardPatterns.push({
          type: 'general',
          pattern: pattern,
          regex: this.#compileWildcardPattern(pattern),
        });
      } else {
        // Exact match - add to Set for O(1) lookup
        this.#tracedActionsSet.add(pattern);
      }
    }

    this.#logger.debug(`Pattern compilation complete`, {
      exactPatterns: this.#tracedActionsSet.size,
      wildcardPatterns: this.#wildcardPatterns.length,
    });
  }

  /**
   * Compile wildcard pattern to regex
   *
   * @private
   * @param {string} pattern - Pattern with wildcards
   * @returns {RegExp} Compiled regex
   */
  #compileWildcardPattern(pattern) {
    // Escape regex special chars except *, then replace * with .*
    const regexPattern = pattern
      .split('*')
      .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*');

    return new RegExp(`^${regexPattern}$`);
  }

  /**
   * Validate pattern syntax
   *
   * @private
   * @param {string} pattern - Pattern to validate
   * @returns {{valid: boolean, errors: string[]}}
   */
  #validatePattern(pattern) {
    const result = { valid: true, errors: [] };

    if (!pattern || typeof pattern !== 'string') {
      result.valid = false;
      result.errors.push('Pattern must be a non-empty string');
      return result;
    }

    // Check for redundant patterns
    if (pattern.includes('**')) {
      result.errors.push('Multiple consecutive asterisks are redundant');
    }

    // Check for invalid characters - be lenient with uppercase
    const lenientAllowedPattern = /^[a-zA-Z0-9_:*]+$/;
    if (!lenientAllowedPattern.test(pattern)) {
      result.valid = false;
      result.errors.push(
        `Pattern contains invalid characters - only alphanumeric, underscore, colon, and asterisk allowed`
      );
      return result;
    }

    // Warn about uppercase but don't fail
    const strictAllowedPattern = /^[a-z0-9_:*]+$/;
    if (!strictAllowedPattern.test(pattern)) {
      result.errors.push(
        'Pattern contains uppercase characters - should be lowercase'
      );
      // Don't set valid = false, just warn
    }

    // Validate mod name format if pattern contains colon
    if (pattern.includes(':')) {
      const parts = pattern.split(':');
      if (parts.length !== 2) {
        result.valid = false;
        result.errors.push('Pattern can only contain one colon');
        return result;
      }

      const [modPart, actionPart] = parts;

      // Mod part must be either '*' or valid mod name (no wildcards in mod name except full wildcard)
      if (modPart !== '*' && modPart.includes('*')) {
        result.valid = false;
        result.errors.push(
          `Invalid mod name '${modPart}' - mod name cannot contain partial wildcards`
        );
        return result;
      }

      if (modPart !== '*' && !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(modPart)) {
        result.valid = false;
        result.errors.push(
          `Invalid mod name '${modPart}' - must be alphanumeric with underscores, or '*' for wildcard`
        );
        return result;
      }

      // Warn about uppercase in mod name but don't fail
      if (modPart !== '*' && !/^[a-z][a-z0-9_]*$/.test(modPart)) {
        result.errors.push(`Mod name '${modPart}' should be lowercase`);
        // Don't set valid = false, just warn
      }

      if (actionPart.length === 0) {
        result.valid = false;
        result.errors.push('Action part after colon cannot be empty');
        return result;
      }
    }

    return result;
  }

  /**
   * Update lookup time statistics with enhanced monitoring
   *
   * @private
   * @param {number} startTime - Performance start time
   */
  #updateLookupTime(startTime) {
    const duration = performance.now() - startTime;
    const stats = this.#lookupStatistics;
    const totalLookups = stats.totalLookups;

    // Accumulate total time for precise average calculation
    stats.totalLookupTime += duration;
    stats.averageLookupTime = stats.totalLookupTime / totalLookups;

    // Track performance outliers
    if (duration > 1) {
      // >1ms is considered slow
      stats.slowLookups++;
      // Log performance warning for investigation
      this.#logger.warn('Slow action lookup detected', {
        duration: `${duration.toFixed(3)}ms`,
        totalLookups,
        slowLookupRate:
          ((stats.slowLookups / totalLookups) * 100).toFixed(2) + '%',
      });
    }

    // Update performance bounds
    if (duration < stats.fastestLookup) {
      stats.fastestLookup = duration;
    }
    if (duration > stats.slowestLookup) {
      stats.slowestLookup = duration;
    }
  }

  /**
   * Test a pattern against an action ID (for debugging)
   *
   * @param {string} pattern - Pattern to test
   * @param {string} actionId - Action ID to test against
   * @returns {{matches: boolean, patternType: string, explanation: string}}
   */
  testPattern(pattern, actionId) {
    const result = {
      matches: false,
      patternType: 'unknown',
      explanation: '',
    };

    if (pattern === '*') {
      result.matches = true;
      result.patternType = 'all';
      result.explanation = 'Matches all actions';
    } else if (pattern.endsWith(':*')) {
      const prefix = pattern.slice(0, -1);
      result.matches = actionId.startsWith(prefix);
      result.patternType = 'mod';
      result.explanation = `Matches actions starting with '${prefix}'`;
    } else if (pattern.includes('*')) {
      const regex = this.#compileWildcardPattern(pattern);
      result.matches = regex.test(actionId);
      result.patternType = 'general';
      result.explanation = `Matches pattern '${pattern}' using regex`;
    } else {
      result.matches = pattern === actionId;
      result.patternType = 'exact';
      result.explanation = 'Exact string match';
    }

    return result;
  }

  /**
   * Check if cache has expired based on TTL
   *
   * @private
   * @returns {boolean} True if cache is expired or no timestamp exists
   */
  #isCacheExpired() {
    if (!this.#cachedConfig.timestamp || this.#cachedConfig.ttl === 0) {
      return true;
    }
    return Date.now() - this.#cachedConfig.timestamp > this.#cachedConfig.ttl;
  }

  /**
   * Get which pattern(s) match an action ID
   *
   * @param {string} actionId - Action ID to check
   * @returns {Promise<{matches: boolean, matchingPatterns: Array}>}
   */
  async getMatchingPatterns(actionId) {
    const config = await this.loadConfig();
    const matchingPatterns = [];

    for (const pattern of config.tracedActions) {
      const testResult = this.testPattern(pattern, actionId);
      if (testResult.matches) {
        matchingPatterns.push({
          pattern,
          type: testResult.patternType,
          explanation: testResult.explanation,
        });
      }
    }

    return {
      matches: matchingPatterns.length > 0,
      matchingPatterns,
    };
  }
}

export default ActionTraceConfigLoader;
