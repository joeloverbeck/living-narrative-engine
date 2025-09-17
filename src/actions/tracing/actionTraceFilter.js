/**
 * @file ActionTraceFilter - Provides filtering logic for action-specific tracing
 * @description Implements filtering decisions for which actions should be traced
 * and at what verbosity levels, with configurable inclusion/exclusion patterns.
 */

import { string } from '../../utils/validationCore.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';

/**
 * @typedef {object} VerbosityConfig
 * @property {boolean} componentData - Include component-related data
 * @property {boolean} prerequisites - Include prerequisite evaluation data
 * @property {boolean} targets - Include target resolution data
 */

/**
 * @typedef {'minimal'|'standard'|'detailed'|'verbose'} VerbosityLevel
 */

/**
 * ActionTraceFilter provides filtering logic for action-specific tracing.
 * Determines which actions should be traced and with what level of detail.
 */
class ActionTraceFilter {
  #enabled;
  #tracedActions;
  #excludedActions;
  #verbosityLevel;
  #inclusionConfig;
  #logger;
  #regexCache;

  /**
   * Creates a new ActionTraceFilter instance with specified configuration
   *
   * @param {object} options - Configuration options
   * @param {boolean} [options.enabled] - Whether action tracing is enabled
   * @param {string[]} [options.tracedActions] - Actions to trace (supports wildcards)
   * @param {string[]} [options.excludedActions] - Actions to exclude from tracing
   * @param {VerbosityLevel} [options.verbosityLevel] - Verbosity level
   * @param {VerbosityConfig} [options.inclusionConfig] - What data to include
   * @param {object} [options.logger] - Logger instance
   */
  constructor({
    enabled = true,
    tracedActions = ['*'],
    excludedActions = [],
    verbosityLevel = 'standard',
    inclusionConfig = {
      componentData: false,
      prerequisites: false,
      targets: false,
    },
    logger = null,
  } = {}) {
    this.#logger = ensureValidLogger(logger, 'ActionTraceFilter');

    this.#enabled = Boolean(enabled);
    this.#tracedActions = new Set(
      Array.isArray(tracedActions) ? tracedActions : ['*']
    );
    this.#excludedActions = new Set(
      Array.isArray(excludedActions) ? excludedActions : []
    );
    this.#verbosityLevel = this.#validateVerbosityLevel(verbosityLevel);
    this.#inclusionConfig = this.#validateInclusionConfig(inclusionConfig);
    this.#regexCache = new Map();

    // Pre-compile regex patterns from initial tracedActions and excludedActions
    this.#compileRegexPatterns(this.#tracedActions);
    this.#compileRegexPatterns(this.#excludedActions);

    this.#logger.debug('ActionTraceFilter initialized', {
      enabled: this.#enabled,
      tracedActions: Array.from(this.#tracedActions),
      excludedActions: Array.from(this.#excludedActions),
      verbosityLevel: this.#verbosityLevel,
      inclusionConfig: this.#inclusionConfig,
    });
  }

  /**
   * Checks if action tracing is enabled globally
   *
   * @returns {boolean} True if tracing is enabled
   */
  isEnabled() {
    return this.#enabled;
  }

  /**
   * Determines if a specific action should be traced
   *
   * @param {string} actionId - The action ID to check (e.g., 'movement:go')
   * @returns {boolean} True if the action should be traced
   */
  shouldTrace(actionId) {
    // CRITICAL DEBUG: Log every shouldTrace call - DISABLED
    const result = this.#performShouldTrace(actionId);
    // Debug logging removed - was causing log pollution
    return result;
  }

  #performShouldTrace(actionId) {
    if (!this.#enabled) {
      return false;
    }

    // Early return for universal wildcard - most common case in performance tests
    // This avoids all validation and logging overhead
    if (this.#tracedActions.has('*') && this.#excludedActions.size === 0) {
      return true;
    }

    // Lightweight validation without memory allocation
    // Avoid trim() which creates a new string
    if (!actionId || typeof actionId !== 'string' || actionId.length === 0) {
      throw new InvalidArgumentError(
        'actionId must be a non-empty string in ActionTraceFilter.shouldTrace'
      );
    }

    // System actions (starting with '__') are always traced when tracing is enabled
    if (actionId.startsWith('__')) {
      this.#logger.debug(
        `System action '${actionId}' always traced (system action bypass)`
      );
      return true;
    }

    // Check exclusions first - they take precedence
    if (this.#isExcluded(actionId)) {
      this.#logger.debug(
        `Action '${actionId}' excluded from tracing by exclusion pattern`
      );
      return false;
    }

    // Check if action matches any inclusion pattern
    const shouldTrace = this.#isIncluded(actionId);

    // Only build debug parameters if debug logging is likely to be active
    // This avoids Array.from() allocations in the hot path
    if (this.#logger.debug && typeof this.#logger.debug === 'function') {
      this.#logger.debug(
        `Action '${actionId}' tracing decision: ${shouldTrace}`,
        {
          actionId,
          tracedPatterns: Array.from(this.#tracedActions),
          excludedPatterns: Array.from(this.#excludedActions),
        }
      );
    }

    return shouldTrace;
  }

  /**
   * Gets the current verbosity level
   *
   * @returns {VerbosityLevel} Current verbosity level
   */
  getVerbosityLevel() {
    return this.#verbosityLevel;
  }

  /**
   * Gets the current inclusion configuration
   *
   * @returns {VerbosityConfig} Current inclusion configuration
   */
  getInclusionConfig() {
    return { ...this.#inclusionConfig };
  }

  /**
   * Updates the verbosity level
   *
   * @param {VerbosityLevel} level - New verbosity level
   * @throws {InvalidArgumentError} If level is invalid
   */
  setVerbosityLevel(level) {
    const validLevel = this.#validateVerbosityLevel(level);
    this.#verbosityLevel = validLevel;
    this.#logger.debug(`Verbosity level changed to: ${validLevel}`);
  }

  /**
   * Updates the inclusion configuration
   *
   * @param {Partial<VerbosityConfig>} config - Configuration updates
   */
  updateInclusionConfig(config) {
    const validConfig = this.#validateInclusionConfig({
      ...this.#inclusionConfig,
      ...config,
    });
    this.#inclusionConfig = validConfig;
    this.#logger.debug('Inclusion configuration updated', validConfig);
  }

  /**
   * Adds actions to trace
   *
   * @param {string|string[]} actions - Action ID(s) to add
   */
  addTracedActions(actions) {
    const actionList = Array.isArray(actions) ? actions : [actions];

    for (const action of actionList) {
      string.assertNonBlank(
        action,
        'action',
        'ActionTraceFilter.addTracedActions'
      );
      this.#tracedActions.add(action);

      // Pre-compile regex pattern if applicable
      this.#compileRegexPattern(action);
    }

    this.#logger.debug('Added traced actions', actionList);
  }

  /**
   * Removes actions from tracing
   *
   * @param {string|string[]} actions - Action ID(s) to remove
   */
  removeTracedActions(actions) {
    const actionList = Array.isArray(actions) ? actions : [actions];

    for (const action of actionList) {
      this.#tracedActions.delete(action);
      // Remove from regex cache if present
      this.#regexCache.delete(action);
    }

    this.#logger.debug('Removed traced actions', actionList);
  }

  /**
   * Adds actions to exclude from tracing
   *
   * @param {string|string[]} actions - Action ID(s) to exclude
   */
  addExcludedActions(actions) {
    const actionList = Array.isArray(actions) ? actions : [actions];

    for (const action of actionList) {
      string.assertNonBlank(
        action,
        'action',
        'ActionTraceFilter.addExcludedActions'
      );
      this.#excludedActions.add(action);

      // Pre-compile regex pattern if applicable
      this.#compileRegexPattern(action);
    }

    this.#logger.debug('Added excluded actions', actionList);
  }

  /**
   * Checks if an action matches any exclusion pattern
   *
   * @private
   * @param {string} actionId - Action ID to check
   * @returns {boolean} True if excluded
   */
  #isExcluded(actionId) {
    return this.#matchesAnyPattern(actionId, this.#excludedActions);
  }

  /**
   * Checks if an action matches any inclusion pattern
   *
   * @private
   * @param {string} actionId - Action ID to check
   * @returns {boolean} True if included
   */
  #isIncluded(actionId) {
    return this.#matchesAnyPattern(actionId, this.#tracedActions);
  }

  /**
   * Checks if an action ID matches any pattern in a set
   * Supports wildcards like 'core:*' or '*'
   *
   * @private
   * @param {string} actionId - Action ID to check
   * @param {Set<string>} patterns - Set of patterns to match against
   * @returns {boolean} True if action matches any pattern
   */
  #matchesAnyPattern(actionId, patterns) {
    // Check for exact match first
    if (patterns.has(actionId)) {
      return true;
    }

    // Check for wildcard matches
    for (const pattern of patterns) {
      if (pattern === '*') {
        return true; // Match all
      }

      if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1);
        if (actionId.startsWith(prefix)) {
          return true;
        }
      }

      if (pattern.startsWith('*')) {
        const suffix = pattern.slice(1);
        if (actionId.endsWith(suffix)) {
          return true;
        }
      }

      // Support regex patterns (if pattern starts with /)
      if (pattern.startsWith('/') && pattern.endsWith('/')) {
        // Use cached regex if available
        const cachedRegex = this.#regexCache.get(pattern);
        if (cachedRegex) {
          if (cachedRegex.test(actionId)) {
            return true;
          }
        }
        // Note: Invalid patterns are not in cache, so they're skipped
      }
    }

    return false;
  }

  /**
   * Validates a verbosity level
   *
   * @private
   * @param {*} level - Level to validate
   * @returns {VerbosityLevel} Valid verbosity level
   * @throws {InvalidArgumentError} If level is invalid
   */
  #validateVerbosityLevel(level) {
    const validLevels = ['minimal', 'standard', 'detailed', 'verbose'];

    if (!validLevels.includes(level)) {
      throw new InvalidArgumentError(
        `Invalid verbosity level: ${level}. Must be one of: ${validLevels.join(', ')}`
      );
    }

    return level;
  }

  /**
   * Validates an inclusion configuration object
   *
   * @private
   * @param {*} config - Configuration to validate
   * @returns {VerbosityConfig} Valid configuration
   * @throws {InvalidArgumentError} If configuration is invalid
   */
  #validateInclusionConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new InvalidArgumentError('Inclusion config must be an object');
    }

    const validConfig = {
      componentData: Boolean(config.componentData),
      prerequisites: Boolean(config.prerequisites),
      targets: Boolean(config.targets),
    };

    return validConfig;
  }

  /**
   * Updates the filter configuration from loaded trace config
   *
   * @param {object} config - Action tracing configuration
   * @param {boolean} config.enabled - Whether tracing is enabled
   * @param {string[]} config.tracedActions - Actions to trace
   * @param {string[]} [config.excludedActions] - Actions to exclude
   * @param {string} config.verbosity - Verbosity level
   * @param {boolean} config.includeComponentData - Include component data
   * @param {boolean} config.includePrerequisites - Include prerequisites
   * @param {boolean} config.includeTargets - Include targets
   */
  updateFromConfig(config) {
    this.#logger.debug(
      'ActionTraceFilter: Updating configuration from trace config',
      config
    );

    // Update enabled state
    this.#enabled = Boolean(config.enabled);

    // Update verbosity level
    this.#verbosityLevel = this.#validateVerbosityLevel(
      config.verbosity || 'standard'
    );

    // Update inclusion config
    this.#inclusionConfig = this.#validateInclusionConfig({
      componentData: Boolean(config.includeComponentData),
      prerequisites: Boolean(config.includePrerequisites),
      targets: Boolean(config.includeTargets),
    });

    // Clear existing patterns and rebuild
    this.#tracedActions.clear();
    this.#excludedActions.clear();
    this.#regexCache.clear();

    // Add traced actions (default to ['*'] if not provided or empty)
    const tracedActions =
      Array.isArray(config.tracedActions) && config.tracedActions.length > 0
        ? config.tracedActions
        : ['*'];

    for (const action of tracedActions) {
      if (typeof action === 'string' && action.trim()) {
        this.#tracedActions.add(action.trim());
      }
    }

    // Add excluded actions if provided
    if (Array.isArray(config.excludedActions)) {
      for (const action of config.excludedActions) {
        if (typeof action === 'string' && action.trim()) {
          this.#excludedActions.add(action.trim());
        }
      }
    }

    // Pre-compile regex patterns for performance
    this.#compileRegexPatterns(this.#tracedActions);
    this.#compileRegexPatterns(this.#excludedActions);

    this.#logger.info('ActionTraceFilter: Configuration updated successfully', {
      enabled: this.#enabled,
      tracedActions: Array.from(this.#tracedActions),
      excludedActions: Array.from(this.#excludedActions),
      verbosityLevel: this.#verbosityLevel,
      inclusionConfig: this.#inclusionConfig,
    });
  }

  /**
   * Gets configuration summary for debugging
   *
   * @returns {object} Configuration summary
   */
  getConfigurationSummary() {
    return {
      enabled: this.#enabled,
      tracedActionCount: this.#tracedActions.size,
      excludedActionCount: this.#excludedActions.size,
      verbosityLevel: this.#verbosityLevel,
      inclusionConfig: { ...this.#inclusionConfig },
      tracedActions: Array.from(this.#tracedActions),
      excludedActions: Array.from(this.#excludedActions),
    };
  }

  /**
   * Pre-compiles regex patterns from a set of patterns
   *
   * @private
   * @param {Set<string>} patterns - Set of patterns to compile
   */
  #compileRegexPatterns(patterns) {
    for (const pattern of patterns) {
      this.#compileRegexPattern(pattern);
    }
  }

  /**
   * Pre-compiles a single regex pattern and caches it
   *
   * @private
   * @param {string} pattern - Pattern to compile
   */
  #compileRegexPattern(pattern) {
    // Only compile if it's a regex pattern
    if (pattern.startsWith('/') && pattern.endsWith('/')) {
      // Don't recompile if already cached
      if (this.#regexCache.has(pattern)) {
        return;
      }

      try {
        const regex = new RegExp(pattern.slice(1, -1));
        this.#regexCache.set(pattern, regex);
        this.#logger.debug(`Compiled and cached regex pattern: ${pattern}`);
      } catch (error) {
        // Invalid regex patterns are not cached, so they'll be skipped during matching
        this.#logger.warn(
          `Invalid regex pattern will be ignored: ${pattern}`,
          error
        );
      }
    }
  }
}

export default ActionTraceFilter;
