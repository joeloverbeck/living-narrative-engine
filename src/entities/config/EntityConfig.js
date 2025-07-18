/* eslint-env node */
/**
 * @file EntityConfig - Centralized configuration for entities module
 * @module EntityConfig
 */

/**
 * @class EntityConfig
 * @description Centralized configuration object for entities module
 */
export default class EntityConfig {
  // Performance limits
  static get LIMITS() {
    return {
      MAX_ENTITIES: 10000,
      MAX_COMPONENT_SIZE: 1024 * 1024, // 1MB
      MAX_COMPONENT_DEPTH: 10,
      MAX_COMPONENT_PROPERTIES: 1000,
      MAX_STRING_LENGTH: 10000,
      MAX_BATCH_SIZE: 100,
    };
  }

  // Cache settings
  static get CACHE() {
    return {
      DEFINITION_CACHE_TTL: 300000, // 5 minutes
      VALIDATION_CACHE_SIZE: 1000,
      COMPONENT_CACHE_SIZE: 5000,
      ENABLE_VALIDATION_CACHE: true,
      ENABLE_DEFINITION_CACHE: true,
    };
  }

  // Validation settings
  static get VALIDATION() {
    return {
      STRICT_MODE: true,
      ALLOW_UNKNOWN_COMPONENTS: false,
      VALIDATE_COMPONENT_SCHEMAS: true,
      COERCE_TYPES: false,
      REMOVE_ADDITIONAL_PROPERTIES: false,
      ENABLE_CIRCULAR_REFERENCE_CHECK: true,
    };
  }

  // Performance monitoring
  static get PERFORMANCE() {
    return {
      ENABLE_MONITORING: true,
      SLOW_OPERATION_THRESHOLD: 100, // ms
      MEMORY_WARNING_THRESHOLD: 0.8, // 80% of max
      ENABLE_OPERATION_TRACING: false,
      BATCH_OPERATION_TIMEOUT: 30000, // 30 seconds
    };
  }

  // Logging settings
  static get LOGGING() {
    return {
      DEFAULT_LOG_LEVEL: 'info',
      ENABLE_DEBUG_LOGGING: false,
      ENABLE_PERFORMANCE_LOGGING: true,
      ENABLE_VALIDATION_LOGGING: false,
      MAX_LOG_MESSAGE_LENGTH: 1000,
    };
  }

  // Error handling
  static get ERROR_HANDLING() {
    return {
      ENABLE_ERROR_RECOVERY: true,
      MAX_RETRY_ATTEMPTS: 3,
      RETRY_DELAY_MS: 1000,
      ENABLE_CIRCUIT_BREAKER: true,
      CIRCUIT_BREAKER_THRESHOLD: 5,
      CIRCUIT_BREAKER_TIMEOUT: 60000, // 1 minute
    };
  }

  // Component defaults
  static get DEFAULTS() {
    return {
      ENABLE_DEFAULT_COMPONENTS: true,
      DEFAULT_COMPONENT_TYPES: [
        'core:short_term_memory',
        'core:notes',
        'core:goals',
      ],
      INJECT_DEFAULTS_ON_CREATION: true,
      INJECT_DEFAULTS_ON_RECONSTRUCTION: true,
    };
  }

  // Entity creation settings
  static get ENTITY_CREATION() {
    return {
      ENABLE_ID_VALIDATION: true,
      ALLOW_CUSTOM_INSTANCE_IDS: true,
      REQUIRE_UNIQUE_IDS: true,
      ENABLE_DUPLICATE_CHECK: true,
      ENABLE_COMPONENT_VALIDATION: true,
    };
  }

  // Spatial indexing settings
  static get SPATIAL_INDEX() {
    return {
      ENABLE_SPATIAL_INDEXING: true,
      ENABLE_LOCATION_CACHING: true,
      MAX_ENTITIES_PER_LOCATION: 1000,
      ENABLE_INDEX_VALIDATION: true,
    };
  }

  // Monitoring settings
  static get MONITORING() {
    return {
      ENABLE_HEALTH_CHECKS: true,
      HEALTH_CHECK_INTERVAL: 30000, // 30 seconds
      ALERT_RETENTION_HOURS: 24,
      ENABLE_PERFORMANCE_ALERTS: true,
      SLOW_OPERATION_ALERT_THRESHOLD: 200, // ms
    };
  }

  // Environment-specific overrides
  static get ENVIRONMENT() {
    return {
      NODE_ENV: globalThis.process?.env.NODE_ENV || 'development',
      IS_PRODUCTION: globalThis.process?.env.NODE_ENV === 'production',
      IS_DEVELOPMENT: globalThis.process?.env.NODE_ENV === 'development',
      IS_TEST: globalThis.process?.env.NODE_ENV === 'test',
    };
  }

  /**
   * Gets the complete configuration object with environment-specific overrides.
   *
   * @returns {object} Complete configuration object
   */
  static getConfig() {
    const config = {
      limits: this.LIMITS,
      cache: this.CACHE,
      validation: this.VALIDATION,
      performance: this.PERFORMANCE,
      logging: this.LOGGING,
      errorHandling: this.ERROR_HANDLING,
      defaults: this.DEFAULTS,
      entityCreation: this.ENTITY_CREATION,
      spatialIndex: this.SPATIAL_INDEX,
      monitoring: this.MONITORING,
      environment: this.ENVIRONMENT,
    };

    // Apply environment-specific overrides
    if (this.ENVIRONMENT.IS_PRODUCTION) {
      config.logging.ENABLE_DEBUG_LOGGING = false;
      config.performance.ENABLE_OPERATION_TRACING = false;
      config.validation.STRICT_MODE = true;
    } else if (this.ENVIRONMENT.IS_DEVELOPMENT) {
      config.logging.ENABLE_DEBUG_LOGGING = true;
      config.performance.ENABLE_OPERATION_TRACING = true;
      config.validation.STRICT_MODE = false;
    } else if (this.ENVIRONMENT.IS_TEST) {
      config.logging.ENABLE_DEBUG_LOGGING = false;
      config.performance.ENABLE_MONITORING = false;
      config.cache.ENABLE_VALIDATION_CACHE = false;
      config.cache.ENABLE_DEFINITION_CACHE = false;
    }

    return config;
  }

  /**
   * Validates configuration values.
   *
   * @param {object} config - Configuration to validate
   * @returns {boolean} True if configuration is valid
   * @throws {Error} If configuration is invalid
   */
  static validateConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('EntityConfig: Configuration must be an object');
    }

    // Validate limits
    if (config.limits) {
      if (config.limits.MAX_ENTITIES <= 0) {
        throw new Error('EntityConfig: MAX_ENTITIES must be positive');
      }
      if (config.limits.MAX_COMPONENT_SIZE <= 0) {
        throw new Error('EntityConfig: MAX_COMPONENT_SIZE must be positive');
      }
      if (config.limits.MAX_BATCH_SIZE <= 0) {
        throw new Error('EntityConfig: MAX_BATCH_SIZE must be positive');
      }
    }

    // Validate cache settings
    if (config.cache) {
      if (config.cache.DEFINITION_CACHE_TTL <= 0) {
        throw new Error('EntityConfig: DEFINITION_CACHE_TTL must be positive');
      }
      if (config.cache.VALIDATION_CACHE_SIZE <= 0) {
        throw new Error('EntityConfig: VALIDATION_CACHE_SIZE must be positive');
      }
    }

    // Validate performance settings
    if (config.performance) {
      if (config.performance.SLOW_OPERATION_THRESHOLD <= 0) {
        throw new Error(
          'EntityConfig: SLOW_OPERATION_THRESHOLD must be positive'
        );
      }
      if (
        config.performance.MEMORY_WARNING_THRESHOLD <= 0 ||
        config.performance.MEMORY_WARNING_THRESHOLD > 1
      ) {
        throw new Error(
          'EntityConfig: MEMORY_WARNING_THRESHOLD must be between 0 and 1'
        );
      }
    }

    return true;
  }

  /**
   * Merges user configuration with defaults.
   *
   * @param {object} userConfig - User-provided configuration
   * @returns {object} Merged configuration
   */
  static mergeConfig(userConfig = {}) {
    const defaultConfig = this.getConfig();

    // Deep merge user config with defaults
    const mergedConfig = this.#deepMerge(defaultConfig, userConfig);

    // Validate merged configuration
    this.validateConfig(mergedConfig);

    return mergedConfig;
  }

  /**
   * Deep merges two objects.
   *
   * @param {object} target - Target object
   * @param {object} source - Source object
   * @returns {object} Merged object
   */
  static #deepMerge(target, source) {
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
   * Gets a specific configuration section.
   *
   * @param {string} section - Configuration section name
   * @returns {object} Configuration section
   */
  static getSection(section) {
    const config = this.getConfig();
    return config[section] || null;
  }

  /**
   * Checks if a feature is enabled.
   *
   * @param {string} feature - Feature name (e.g., 'performance.ENABLE_MONITORING')
   * @returns {boolean} True if feature is enabled
   */
  static isFeatureEnabled(feature) {
    const config = this.getConfig();
    const parts = feature.split('.');
    let current = config;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return false;
      }
    }

    return Boolean(current);
  }
}
