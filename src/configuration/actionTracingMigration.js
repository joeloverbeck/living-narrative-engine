/**
 * @file Migrates existing trace configurations to include action tracing
 * @see actionTraceConfigLoader.js
 */

/**
 * @typedef {object} ActionTracingConfig
 * @property {boolean} enabled
 * @property {string[]} tracedActions
 * @property {string} outputDirectory
 * @property {'minimal'|'standard'|'detailed'|'verbose'} verbosity
 * @property {boolean} includeComponentData
 * @property {boolean} includePrerequisites
 * @property {boolean} includeTargets
 * @property {number} maxTraceFiles
 * @property {'age'|'count'} rotationPolicy
 * @property {number} maxFileAge
 * @property {string[]} outputFormats
 * @property {object} textFormatOptions
 * @property {boolean} textFormatOptions.enableColors
 * @property {number} textFormatOptions.lineWidth
 * @property {number} textFormatOptions.indentSize
 * @property {string} textFormatOptions.sectionSeparator
 * @property {boolean} textFormatOptions.includeTimestamps
 * @property {boolean} textFormatOptions.performanceSummary
 */

/**
 * Migrates existing trace configurations to include action tracing
 */
class ActionTracingConfigMigration {
  /**
   * Add action tracing to existing configuration
   *
   * @param {object} existingConfig - Current trace configuration
   * @returns {object} Updated configuration with action tracing
   */
  static migrateConfig(existingConfig) {
    // If already has actionTracing, no migration needed
    if (existingConfig.actionTracing) {
      return existingConfig;
    }

    // Add default action tracing configuration
    return {
      ...existingConfig,
      actionTracing: this.getDefaultActionTracingConfig(),
    };
  }

  /**
   * Get default action tracing configuration
   *
   * @returns {ActionTracingConfig}
   */
  static getDefaultActionTracingConfig() {
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
      outputFormats: ['json'],
      textFormatOptions: {
        enableColors: false,
        lineWidth: 120,
        indentSize: 2,
        sectionSeparator: '=',
        includeTimestamps: true,
        performanceSummary: true,
      },
    };
  }

  /**
   * Validate migrated configuration
   *
   * @param {object} config - Configuration to validate
   * @returns {boolean} True if configuration is valid
   */
  static isValidMigration(config) {
    if (!config.actionTracing) {
      return false;
    }

    const actionTracing = config.actionTracing;

    // Check required fields
    if (typeof actionTracing.enabled !== 'boolean') {
      return false;
    }

    if (!Array.isArray(actionTracing.tracedActions)) {
      return false;
    }

    if (typeof actionTracing.outputDirectory !== 'string') {
      return false;
    }

    // Check optional fields if present
    if (
      actionTracing.verbosity &&
      !['minimal', 'standard', 'detailed', 'verbose'].includes(
        actionTracing.verbosity
      )
    ) {
      return false;
    }

    if (
      actionTracing.rotationPolicy &&
      !['age', 'count'].includes(actionTracing.rotationPolicy)
    ) {
      return false;
    }

    if (
      actionTracing.maxTraceFiles !== undefined &&
      (typeof actionTracing.maxTraceFiles !== 'number' ||
        actionTracing.maxTraceFiles < 1 ||
        actionTracing.maxTraceFiles > 1000)
    ) {
      return false;
    }

    if (
      actionTracing.maxFileAge !== undefined &&
      (typeof actionTracing.maxFileAge !== 'number' ||
        actionTracing.maxFileAge < 3600)
    ) {
      return false;
    }

    return true;
  }

  /**
   * Merge user configuration with defaults
   *
   * @param {Partial<ActionTracingConfig>} userConfig - User-provided configuration
   * @returns {ActionTracingConfig} Complete configuration with defaults
   */
  static mergeWithDefaults(userConfig) {
    const defaults = this.getDefaultActionTracingConfig();

    if (!userConfig) {
      return defaults;
    }

    // Merge textFormatOptions separately to handle partial objects
    const mergedTextFormatOptions = {
      ...defaults.textFormatOptions,
      ...(userConfig.textFormatOptions || {}),
    };

    return {
      enabled: userConfig.enabled ?? defaults.enabled,
      tracedActions: userConfig.tracedActions ?? defaults.tracedActions,
      outputDirectory: userConfig.outputDirectory ?? defaults.outputDirectory,
      verbosity: userConfig.verbosity ?? defaults.verbosity,
      includeComponentData:
        userConfig.includeComponentData ?? defaults.includeComponentData,
      includePrerequisites:
        userConfig.includePrerequisites ?? defaults.includePrerequisites,
      includeTargets: userConfig.includeTargets ?? defaults.includeTargets,
      maxTraceFiles: userConfig.maxTraceFiles ?? defaults.maxTraceFiles,
      rotationPolicy: userConfig.rotationPolicy ?? defaults.rotationPolicy,
      maxFileAge: userConfig.maxFileAge ?? defaults.maxFileAge,
      outputFormats: userConfig.outputFormats ?? defaults.outputFormats,
      textFormatOptions: mergedTextFormatOptions,
    };
  }
}

export default ActionTracingConfigMigration;
