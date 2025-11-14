/**
 * @file Configuration merger for debug logging system
 * @description Merges default configuration with overrides and environment variables
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import {
  DEFAULT_CONFIG,
  CONFIG_PRESETS,
  ENV_VAR_MAPPINGS,
} from './defaultConfig.js';

/* global process */

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * Configuration merger for debug logging system
 * Handles deep merging with proper precedence: env vars > overrides > defaults
 */
export class DebugLoggingConfigMerger {
  /**
   * @private
   * @type {ILogger}
   */
  #logger;

  /**
   * Creates an instance of DebugLoggingConfigMerger
   *
   * @param {object} dependencies - Dependencies
   * @param {ILogger} dependencies.logger - Logger instance
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    this.#logger = logger;
  }

  /**
   * Merges configuration with proper precedence
   * Priority: environment variables > overrides > preset > defaults
   *
   * @param {object} [overrides] - Configuration overrides
   * @param {string} [preset] - Preset name to apply
   * @param {object} [envVars] - Environment variables
   * @returns {object} Merged configuration
   */
  mergeConfig(overrides = {}, preset = null, envVars = process.env) {
    try {
      this.#logger.debug('Starting configuration merge', {
        hasOverrides: !!overrides && Object.keys(overrides).length > 0,
        preset,
        envVarCount: Object.keys(envVars || {}).length,
      });

      // Start with default configuration
      let config = this.deepClone(DEFAULT_CONFIG);

      // Apply preset if specified
      if (preset && CONFIG_PRESETS[preset]) {
        this.#logger.debug(`Applying preset: ${preset}`);
        config = this.deepMerge(config, CONFIG_PRESETS[preset]);
      } else if (preset) {
        this.#logger.warn(`Unknown preset requested: ${preset}`);
      }

      // Apply overrides
      if (overrides && typeof overrides === 'object') {
        this.#logger.debug('Applying configuration overrides');
        config = this.deepMerge(config, overrides);
      }

      // Apply environment variable overrides
      config = this.applyEnvironmentVariables(config, envVars);

      this.#logger.debug('Configuration merge completed', {
        mode: config.mode,
        enabled: config.enabled,
        categoriesCount: Object.keys(config.categories || {}).length,
      });

      return config;
    } catch (error) {
      this.#logger.error('Error during configuration merge', error);
      throw new Error(`Configuration merge failed: ${error.message}`);
    }
  }

  /**
   * Performs deep merge of two configuration objects
   * Arrays are replaced, not merged
   *
   * @param {object} target - Target object (will be modified)
   * @param {object} source - Source object
   * @returns {object} Merged object
   */
  deepMerge(target, source) {
    if (!source || typeof source !== 'object') {
      return target;
    }

    if (!target || typeof target !== 'object') {
      return this.deepClone(source);
    }

    const result = this.deepClone(target);

    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const sourceValue = source[key];
        const targetValue = result[key];

        if (sourceValue === null || sourceValue === undefined) {
          result[key] = sourceValue;
        } else if (Array.isArray(sourceValue)) {
          // Replace arrays completely, don't merge them
          result[key] = [...sourceValue];
        } else if (
          typeof sourceValue === 'object' &&
          !Array.isArray(sourceValue)
        ) {
          // Recursively merge objects
          result[key] = this.deepMerge(targetValue, sourceValue);
        } else {
          // Replace primitive values
          result[key] = sourceValue;
        }
      }
    }

    return result;
  }

  /**
   * Creates a deep clone of an object
   *
   * @param {*} obj - Object to clone
   * @returns {*} Cloned object
   */
  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }

    if (obj instanceof Set) {
      return new Set(Array.from(obj).map((item) => this.deepClone(item)));
    }

    if (obj instanceof Map) {
      const clonedMap = new Map();
      for (const [key, value] of obj) {
        clonedMap.set(this.deepClone(key), this.deepClone(value));
      }
      return clonedMap;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.deepClone(item));
    }

    const cloned = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        cloned[key] = this.deepClone(obj[key]);
      }
    }

    return cloned;
  }

  /**
   * Applies environment variable overrides to configuration
   *
   * @param {object} config - Configuration object to modify
   * @param {object} envVars - Environment variables
   * @returns {object} Modified configuration
   */
  applyEnvironmentVariables(config, envVars) {
    if (!envVars || typeof envVars !== 'object') {
      return config;
    }

    let envVarCount = 0;
    const result = this.deepClone(config);

    // Apply mapped environment variables
    for (const [envVarName, configPath] of Object.entries(ENV_VAR_MAPPINGS)) {
      if (envVars[envVarName] !== undefined) {
        const value = this.parseEnvironmentValue(envVars[envVarName]);
        this.setNestedValue(result, configPath, value);
        envVarCount++;

        this.#logger.debug(`Applied env var: ${envVarName} -> ${configPath}`, {
          value,
        });
      }
    }

    // Apply category-specific environment variables
    // Format: DEBUG_LOG_CATEGORY_<CATEGORY_NAME>_ENABLED or _LEVEL
    for (const envVarName in envVars) {
      if (envVarName.startsWith('DEBUG_LOG_CATEGORY_')) {
        const match = envVarName.match(
          /^DEBUG_LOG_CATEGORY_([A-Z_]+)_(ENABLED|LEVEL)$/
        );
        if (match) {
          const categoryName = match[1].toLowerCase();
          const property = match[2].toLowerCase();
          const value = this.parseEnvironmentValue(envVars[envVarName]);

          if (!result.categories) {
            result.categories = {};
          }
          if (!result.categories[categoryName]) {
            result.categories[categoryName] = { enabled: true, level: 'info' };
          }

          result.categories[categoryName][property] = value;
          envVarCount++;

          this.#logger.debug(`Applied category env var: ${envVarName}`, {
            category: categoryName,
            property,
            value,
          });
        }
      }
    }

    if (envVarCount > 0) {
      this.#logger.info(
        `Applied ${envVarCount} environment variable overrides`
      );
    }

    return result;
  }

  /**
   * Parses environment variable value to appropriate type
   *
   * @param {string} value - String value from environment
   * @returns {*} Parsed value
   */
  parseEnvironmentValue(value) {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();

    // Boolean values
    if (trimmed.toLowerCase() === 'true') return true;
    if (trimmed.toLowerCase() === 'false') return false;

    // Numeric values
    if (/^\d+$/.test(trimmed)) {
      return parseInt(trimmed, 10);
    }
    if (/^\d+\.\d+$/.test(trimmed)) {
      return parseFloat(trimmed);
    }

    // String values
    return trimmed;
  }

  /**
   * Sets a nested value in an object using dot notation
   *
   * @param {object} obj - Object to modify
   * @param {string} path - Dot-separated path (e.g., 'remote.endpoint')
   * @param {*} value - Value to set
   * @returns {void}
   */
  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * Gets a nested value from an object using dot notation
   *
   * @param {object} obj - Object to read from
   * @param {string} path - Dot-separated path
   * @param {*} [defaultValue] - Default value if path doesn't exist
   * @returns {*} Value at path or default value
   */
  getNestedValue(obj, path, defaultValue = undefined) {
    if (!obj || typeof obj !== 'object') {
      return defaultValue;
    }

    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (
        current === null ||
        current === undefined ||
        typeof current !== 'object'
      ) {
        return defaultValue;
      }
      current = current[key];
    }

    return current !== undefined ? current : defaultValue;
  }

  /**
   * Merges configuration with legacy support
   * Handles old logger-config.json format and migrates it
   *
   * @param {object} [currentConfig] - Current configuration
   * @param {object} [legacyConfig] - Legacy configuration to migrate
   * @param {string} [preset] - Preset to apply
   * @param {object} [envVars] - Environment variables
   * @returns {object} Merged configuration with migration
   */
  mergeWithLegacySupport(
    currentConfig = {},
    legacyConfig = null,
    preset = null,
    envVars = process.env
  ) {
    try {
      // let baseConfig = DEFAULT_CONFIG; // Not currently used

      // Handle legacy configuration migration
      if (legacyConfig) {
        this.#logger.info('Migrating legacy configuration');

        // Simple migration for basic logLevel
        if (legacyConfig.logLevel) {
          currentConfig.logLevel = legacyConfig.logLevel;

          // Convert logLevel to mode if not already set
          if (!currentConfig.mode) {
            if (legacyConfig.logLevel === 'NONE') {
              currentConfig.mode = 'none';
              currentConfig.enabled = false;
            } else {
              currentConfig.mode = 'development';
              currentConfig.enabled = true;
            }
          }
        }
      }

      return this.mergeConfig(currentConfig, preset, envVars);
    } catch (error) {
      this.#logger.error('Error during legacy configuration merge', error);
      throw new Error(`Legacy configuration merge failed: ${error.message}`);
    }
  }

  /**
   * Validates configuration precedence and reports what was applied
   * Useful for debugging configuration issues
   *
   * @param {object} [overrides] - Configuration overrides
   * @param {string} [preset] - Preset name
   * @param {object} [envVars] - Environment variables
   * @returns {object} Configuration with metadata about what was applied
   */
  mergeWithReport(overrides = {}, preset = null, envVars = process.env) {
    const report = {
      config: null,
      appliedPreset: null,
      appliedOverrides: [],
      appliedEnvVars: [],
      warnings: [],
    };

    try {
      // Track what gets applied
      if (preset && CONFIG_PRESETS[preset]) {
        report.appliedPreset = preset;
      } else if (preset) {
        report.warnings.push(`Unknown preset: ${preset}`);
      }

      if (overrides && typeof overrides === 'object') {
        report.appliedOverrides = Object.keys(overrides);
      }

      // Check for environment variables
      for (const envVarName of Object.keys(ENV_VAR_MAPPINGS)) {
        if (envVars && envVars[envVarName] !== undefined) {
          report.appliedEnvVars.push(envVarName);
        }
      }

      // Perform the merge
      report.config = this.mergeConfig(overrides, preset, envVars);

      this.#logger.debug('Configuration merge report generated', {
        preset: report.appliedPreset,
        overrideCount: report.appliedOverrides.length,
        envVarCount: report.appliedEnvVars.length,
        warningCount: report.warnings.length,
      });

      return report;
    } catch (error) {
      this.#logger.error('Error generating configuration merge report', error);
      throw error;
    }
  }
}
