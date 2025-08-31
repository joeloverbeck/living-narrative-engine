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
   * Sanitize and validate individual configuration values
   *
   * @param {*} value - Value to sanitize
   * @param {string} fieldName - Name of the field being sanitized
   * @param {*} defaultValue - Default value to use if invalid
   * @returns {*} Sanitized value
   */
  static #sanitizeValue(value, fieldName, defaultValue) {
    switch (fieldName) {
      case 'outputFormats':
        if (!Array.isArray(value)) {
          return defaultValue;
        }
        // Check if all formats are valid - if any are invalid, fallback to defaults
        const validFormats = ['json', 'text', 'html', 'markdown'];
        const hasInvalidFormat = value.some(
          (format) => !validFormats.includes(format)
        );
        return hasInvalidFormat ? defaultValue : value;

      case 'textFormatOptions':
        if (!value || typeof value !== 'object') {
          return defaultValue;
        }
        return {
          enableColors:
            typeof value.enableColors === 'boolean'
              ? value.enableColors
              : defaultValue.enableColors,
          lineWidth:
            typeof value.lineWidth === 'number' &&
            value.lineWidth >= 80 &&
            value.lineWidth <= 200
              ? value.lineWidth
              : defaultValue.lineWidth,
          indentSize:
            typeof value.indentSize === 'number' &&
            value.indentSize >= 0 &&
            value.indentSize <= 8
              ? value.indentSize
              : defaultValue.indentSize,
          sectionSeparator:
            typeof value.sectionSeparator === 'string' &&
            value.sectionSeparator.length === 1
              ? value.sectionSeparator
              : defaultValue.sectionSeparator,
          includeTimestamps:
            typeof value.includeTimestamps === 'boolean'
              ? value.includeTimestamps
              : defaultValue.includeTimestamps,
          performanceSummary:
            typeof value.performanceSummary === 'boolean'
              ? value.performanceSummary
              : defaultValue.performanceSummary,
        };

      case 'verbosity':
        const validVerbosity = ['minimal', 'standard', 'detailed', 'verbose'];
        return validVerbosity.includes(value) ? value : defaultValue;

      case 'rotationPolicy':
        const validPolicies = ['age', 'count'];
        return validPolicies.includes(value) ? value : defaultValue;

      case 'maxTraceFiles':
        return typeof value === 'number' && value >= 1 && value <= 1000
          ? value
          : defaultValue;

      case 'maxFileAge':
        return typeof value === 'number' && value >= 3600
          ? value
          : defaultValue;

      case 'enabled':
      case 'includeComponentData':
      case 'includePrerequisites':
      case 'includeTargets':
        return typeof value === 'boolean' ? value : defaultValue;

      case 'tracedActions':
        return Array.isArray(value) ? value : defaultValue;

      case 'outputDirectory':
        return typeof value === 'string' && value.trim() ? value : defaultValue;

      default:
        /* istanbul ignore next - All fields are explicitly handled above */
        return defaultValue;
    }
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

    // Sanitize and merge each field
    const enabled = this.#sanitizeValue(
      userConfig.enabled,
      'enabled',
      defaults.enabled
    );
    const tracedActions = this.#sanitizeValue(
      userConfig.tracedActions,
      'tracedActions',
      defaults.tracedActions
    );
    const outputDirectory = this.#sanitizeValue(
      userConfig.outputDirectory,
      'outputDirectory',
      defaults.outputDirectory
    );
    const verbosity = this.#sanitizeValue(
      userConfig.verbosity,
      'verbosity',
      defaults.verbosity
    );
    const includeComponentData = this.#sanitizeValue(
      userConfig.includeComponentData,
      'includeComponentData',
      defaults.includeComponentData
    );
    const includePrerequisites = this.#sanitizeValue(
      userConfig.includePrerequisites,
      'includePrerequisites',
      defaults.includePrerequisites
    );
    const includeTargets = this.#sanitizeValue(
      userConfig.includeTargets,
      'includeTargets',
      defaults.includeTargets
    );
    const maxTraceFiles = this.#sanitizeValue(
      userConfig.maxTraceFiles,
      'maxTraceFiles',
      defaults.maxTraceFiles
    );
    const rotationPolicy = this.#sanitizeValue(
      userConfig.rotationPolicy,
      'rotationPolicy',
      defaults.rotationPolicy
    );
    const maxFileAge = this.#sanitizeValue(
      userConfig.maxFileAge,
      'maxFileAge',
      defaults.maxFileAge
    );
    const outputFormats = this.#sanitizeValue(
      userConfig.outputFormats,
      'outputFormats',
      defaults.outputFormats
    );
    const textFormatOptions = this.#sanitizeValue(
      userConfig.textFormatOptions,
      'textFormatOptions',
      defaults.textFormatOptions
    );

    return {
      enabled,
      tracedActions,
      outputDirectory,
      verbosity,
      includeComponentData,
      includePrerequisites,
      includeTargets,
      maxTraceFiles,
      rotationPolicy,
      maxFileAge,
      outputFormats,
      textFormatOptions,
    };
  }
}

export default ActionTracingConfigMigration;
