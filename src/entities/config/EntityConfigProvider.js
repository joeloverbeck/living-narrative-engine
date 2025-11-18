/**
 * @file EntityConfigProvider - Provides access to entity configuration
 * @module EntityConfigProvider
 */

import EntityConfig from './EntityConfig.js';
import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import { ProcessEnvironmentProvider } from '../../configuration/ProcessEnvironmentProvider.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IEnvironmentProvider.js').IEnvironmentProvider} IEnvironmentProvider */

/**
 * @class EntityConfigProvider
 * @description Provides centralized access to entity configuration
 */
export default class EntityConfigProvider {
  /** @type {object} */
  #config;
  /** @type {ILogger} */
  #logger;
  /** @type {IEnvironmentProvider} */
  #environmentProvider;
  /** @type {boolean} */
  #initialized = false;

  /**
   * @class
   * @param {object} deps - Dependencies
   * @param {ILogger} deps.logger - Logger instance
   * @param {IEnvironmentProvider} [deps.environmentProvider] - Environment provider
   * @param {object} [deps.userConfig] - User configuration overrides
   * @param {boolean} [deps.autoInitialize] - Whether to initialize immediately
   */
  constructor({
    logger,
    environmentProvider = new ProcessEnvironmentProvider(),
    userConfig = {},
    autoInitialize = true,
  }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'error', 'warn', 'debug'],
    });
    this.#logger = ensureValidLogger(logger, 'EntityConfigProvider');
    this.#environmentProvider = environmentProvider;

    if (autoInitialize) {
      this.#initialize(userConfig);
    }
  }

  /**
   * Initializes the configuration provider.
   *
   * @param {object} userConfig - User configuration overrides
   */
  #initialize(userConfig) {
    try {
      // Get base configuration without environment overrides
      const baseConfig = EntityConfig.getConfig();

      // Apply environment-specific overrides
      this.#applyEnvironmentOverrides(baseConfig);

      // Merge with user config
      this.#config = this.#deepMerge(baseConfig, userConfig);

      // Update environment section with actual environment provider values
      this.#config.environment = this.#environmentProvider.getEnvironment();

      // Validate final configuration
      EntityConfig.validateConfig(this.#config);

      this.#initialized = true;

      this.#logger.debug('EntityConfigProvider initialized successfully');
      this.#logger.debug('Configuration loaded:', {
        environment: this.#config.environment.NODE_ENV,
        features: this.#getEnabledFeatures(),
      });
    } catch (error) {
      this.#logger.error(
        `Failed to initialize EntityConfigProvider: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Applies environment-specific configuration overrides.
   *
   * @param {object} config - Configuration to apply overrides to
   */
  #applyEnvironmentOverrides(config) {
    const env = this.#environmentProvider.getEnvironment();

    if (env.IS_PRODUCTION) {
      config.logging.ENABLE_DEBUG_LOGGING = false;
      config.performance.ENABLE_OPERATION_TRACING = false;
      config.validation.STRICT_MODE = true;
    } else if (env.IS_DEVELOPMENT) {
      config.logging.ENABLE_DEBUG_LOGGING = true;
      config.performance.ENABLE_OPERATION_TRACING = true;
      config.validation.STRICT_MODE = false;
    } else if (env.IS_TEST) {
      config.logging.ENABLE_DEBUG_LOGGING = false;
      config.performance.ENABLE_MONITORING = false;
      config.cache.ENABLE_VALIDATION_CACHE = false;
      config.cache.ENABLE_DEFINITION_CACHE = false;
    }
  }

  /**
   * Gets enabled features for logging.
   *
   * @returns {object} Enabled features
   */
  #getEnabledFeatures() {
    return {
      monitoring: this.#config.performance.ENABLE_MONITORING,
      debugging: this.#config.logging.ENABLE_DEBUG_LOGGING,
      validation: this.#config.validation.STRICT_MODE,
      caching: this.#config.cache.ENABLE_DEFINITION_CACHE,
    };
  }

  /**
   * Deep merges two objects.
   *
   * @param {object} target - Target object
   * @param {object} source - Source object
   * @returns {object} Merged object
   */
  #deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        if (
          source[key] &&
          typeof source[key] === 'object' &&
          !Array.isArray(source[key])
        ) {
          result[key] = this.#deepMerge(result[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  /**
   * Gets the complete configuration.
   *
   * @returns {object} Complete configuration object
   */
  getConfig() {
    this.#ensureInitialized();
    return { ...this.#config };
  }

  /**
   * Gets a specific configuration section.
   *
   * @param {string} section - Section name
   * @returns {object} Configuration section
   */
  getSection(section) {
    this.#ensureInitialized();
    return this.#config[section] || null;
  }

  /**
   * Gets performance limits.
   *
   * @returns {object} Performance limits
   */
  getLimits() {
    return this.getSection('limits');
  }

  /**
   * Gets cache settings.
   *
   * @returns {object} Cache settings
   */
  getCacheSettings() {
    return this.getSection('cache');
  }

  /**
   * Gets validation settings.
   *
   * @returns {object} Validation settings
   */
  getValidationSettings() {
    return this.getSection('validation');
  }

  /**
   * Gets performance settings.
   *
   * @returns {object} Performance settings
   */
  getPerformanceSettings() {
    return this.getSection('performance');
  }

  /**
   * Gets logging settings.
   *
   * @returns {object} Logging settings
   */
  getLoggingSettings() {
    return this.getSection('logging');
  }

  /**
   * Gets error handling settings.
   *
   * @returns {object} Error handling settings
   */
  getErrorHandlingSettings() {
    return this.getSection('errorHandling');
  }

  /**
   * Gets default component settings.
   *
   * @returns {object} Default component settings
   */
  getDefaultsSettings() {
    return this.getSection('defaults');
  }

  /**
   * Gets entity creation settings.
   *
   * @returns {object} Entity creation settings
   */
  getEntityCreationSettings() {
    return this.getSection('entityCreation');
  }

  /**
   * Gets spatial index settings.
   *
   * @returns {object} Spatial index settings
   */
  getSpatialIndexSettings() {
    return this.getSection('spatialIndex');
  }

  /**
   * Checks if a feature is enabled.
   *
   * @param {string} feature - Feature path (e.g., 'performance.ENABLE_MONITORING')
   * @returns {boolean} True if feature is enabled
   */
  isFeatureEnabled(feature) {
    this.#ensureInitialized();
    const parts = feature.split('.');
    let current = this.#config;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return false;
      }
    }

    return Boolean(current);
  }

  /**
   * Gets a specific configuration value.
   *
   * @param {string} path - Configuration path (e.g., 'limits.MAX_ENTITIES')
   * @returns {*} Configuration value
   */
  getValue(path) {
    this.#ensureInitialized();
    const parts = path.split('.');
    let current = this.#config;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Sets a configuration value (for testing purposes).
   *
   * @param {string} path - Configuration path
   * @param {*} value - Value to set
   */
  setValue(path, value) {
    this.#ensureInitialized();
    const parts = path.split('.');
    let current = this.#config;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (part === '__proto__' || part === 'constructor') {
        throw new Error(
          `Invalid configuration path: '${part}' is a reserved property name.`
        );
      }
      if (!(part in current) || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }

    const lastPart = parts[parts.length - 1];
    if (lastPart === '__proto__' || lastPart === 'constructor') {
      throw new Error(
        `Invalid configuration path: '${lastPart}' is a reserved property name.`
      );
    }
    current[lastPart] = value;

    this.#logger.debug(`Configuration value set: ${path} = ${value}`);
  }

  /**
   * Validates current configuration.
   *
   * @returns {boolean} True if configuration is valid
   * @throws {Error} If configuration is invalid
   */
  validateConfig() {
    this.#ensureInitialized();
    return EntityConfig.validateConfig(this.#config);
  }

  /**
   * Reloads configuration with new user overrides.
   *
   * @param {object} userConfig - New user configuration
   */
  reload(userConfig = {}) {
    this.#logger.info('Reloading EntityConfigProvider configuration');
    this.#initialize(userConfig);
  }

  /**
   * Gets environment information.
   *
   * @returns {object} Environment information
   */
  getEnvironment() {
    return this.getSection('environment');
  }

  /**
   * Checks if running in production.
   *
   * @returns {boolean} True if production environment
   */
  isProduction() {
    return this.getValue('environment.IS_PRODUCTION');
  }

  /**
   * Checks if running in development.
   *
   * @returns {boolean} True if development environment
   */
  isDevelopment() {
    return this.getValue('environment.IS_DEVELOPMENT');
  }

  /**
   * Checks if running in test.
   *
   * @returns {boolean} True if test environment
   */
  isTest() {
    return this.getValue('environment.IS_TEST');
  }

  /**
   * Gets configuration summary for logging.
   *
   * @returns {object} Configuration summary
   */
  getConfigSummary() {
    this.#ensureInitialized();
    return {
      environment: this.#config.environment.NODE_ENV,
      maxEntities: this.#config.limits.MAX_ENTITIES,
      maxComponentSize: this.#config.limits.MAX_COMPONENT_SIZE,
      cachingEnabled: this.#config.cache.ENABLE_DEFINITION_CACHE,
      monitoringEnabled: this.#config.performance.ENABLE_MONITORING,
      strictValidation: this.#config.validation.STRICT_MODE,
    };
  }

  /**
   * Ensures the provider is initialized.
   *
   * @throws {Error} If not initialized
   */
  #ensureInitialized() {
    if (!this.#initialized) {
      throw new Error('EntityConfigProvider is not initialized');
    }
  }
}
