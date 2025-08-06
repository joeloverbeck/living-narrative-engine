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
  // Performance optimization fields
  #tracedActionsSet = new Set(); // O(1) exact match lookups
  #wildcardPatterns = []; // Pre-compiled wildcard patterns for performance
  #lookupStatistics = {
    exactMatches: 0,
    wildcardMatches: 0,
    totalLookups: 0,
    averageLookupTime: 0,
  };

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
      requiredMethods: ['info', 'error', 'warn', 'debug'],
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
        const defaultConfig = this.#getDefaultConfig();
        this.#buildLookupStructures(defaultConfig);
        return defaultConfig;
      }

      // Extract action tracing section
      const actionTracingConfig =
        fullConfig.actionTracing || this.#getDefaultConfig();

      // If using defaults due to missing section, build lookup structures immediately
      if (!fullConfig.actionTracing) {
        this.#buildLookupStructures(actionTracingConfig);
      }

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
        const defaultConfig = this.#getDefaultConfig();
        this.#buildLookupStructures(defaultConfig);
        return defaultConfig;
      }

      // Cache the validated configuration
      this.#cachedConfig = actionTracingConfig;

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
    this.#cachedConfig = null;
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
   * @returns {{exactMatches: number, wildcardMatches: number, totalLookups: number, averageLookupTime: number, tracedActionsCount: number, wildcardPatternsCount: number}}
   */
  getStatistics() {
    return {
      exactMatches: this.#lookupStatistics.exactMatches,
      wildcardMatches: this.#lookupStatistics.wildcardMatches,
      totalLookups: this.#lookupStatistics.totalLookups,
      averageLookupTime: this.#lookupStatistics.averageLookupTime,
      tracedActionsCount: this.#tracedActionsSet.size,
      wildcardPatternsCount: this.#wildcardPatterns.length,
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
            `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[a-z_]+$`
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
    // Escape regex special chars, then replace * with .*
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');

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

    // Validate mod name format if pattern contains colon
    if (pattern.includes(':')) {
      const modPart = pattern.split(':')[0];
      // Allow wildcards in mod names for general patterns, otherwise enforce strict format
      if (modPart !== '*' && !/^[a-z][a-z0-9_]*$/.test(modPart)) {
        result.valid = false;
        result.errors.push(
          `Invalid mod name '${modPart}' - must be lowercase alphanumeric with underscores, or '*' for wildcard`
        );
      }
    }

    return result;
  }

  /**
   * Update lookup time statistics
   *
   * @private
   * @param {number} startTime - Performance start time
   */
  #updateLookupTime(startTime) {
    const duration = performance.now() - startTime;
    const currentAvg = this.#lookupStatistics.averageLookupTime;
    const totalLookups = this.#lookupStatistics.totalLookups;

    // Calculate rolling average
    this.#lookupStatistics.averageLookupTime =
      (currentAvg * (totalLookups - 1) + duration) / totalLookups;
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
