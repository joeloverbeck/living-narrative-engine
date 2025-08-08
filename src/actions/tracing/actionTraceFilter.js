/**
 * @file ActionTraceFilter - Provides filtering logic for action-specific tracing
 * @description Implements filtering decisions for which actions should be traced
 * and at what verbosity levels, with configurable inclusion/exclusion patterns.
 */

import { string, logger } from '../../utils/validationCore.js';
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

  /**
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
   * @param {string} actionId - The action ID to check (e.g., 'core:go')
   * @returns {boolean} True if the action should be traced
   */
  shouldTrace(actionId) {
    if (!this.#enabled) {
      return false;
    }

    string.assertNonBlank(
      actionId,
      'actionId',
      'ActionTraceFilter.shouldTrace'
    );

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

    this.#logger.debug(
      `Action '${actionId}' tracing decision: ${shouldTrace}`,
      {
        actionId,
        tracedPatterns: Array.from(this.#tracedActions),
        excludedPatterns: Array.from(this.#excludedActions),
      }
    );

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
        try {
          const regex = new RegExp(pattern.slice(1, -1));
          if (regex.test(actionId)) {
            return true;
          }
        } catch (error) {
          this.#logger.warn(`Invalid regex pattern: ${pattern}`, error);
        }
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
}

export default ActionTraceFilter;
