/**
 * @file Template Configuration Manager
 * @module characterBuilder/templates/utilities/templateConfigManager
 * @description Handles default configs, overrides, and environment-specific settings
 */

import { assertPresent } from '../../../utils/dependencyUtils.js';
import {
  InvalidConfigError,
  ConfigMergeError,
} from '../errors/templateConfigurationError.js';

/**
 * Template Configuration Manager
 * Manages configuration with multiple precedence levels and caching
 */
export class TemplateConfigManager {
  #defaults;
  #environment;
  #validator;
  #configs;
  #overrides;
  #cache;
  #precedenceLevels;
  #cacheEnabled;

  /**
   * @param {object} options - Manager options
   * @param {object} [options.defaults] - Default configurations
   * @param {string} [options.environment] - Current environment
   * @param {object} [options.validator] - Configuration validator
   * @param {boolean} [options.enableCache] - Enable caching (default: true)
   */
  constructor(options = {}) {
    const { defaults = {}, environment = 'development', validator, enableCache = true } = options;

    this.#defaults = this.#deepFreeze(defaults);
    this.#environment = environment;
    this.#validator = validator;
    this.#configs = new Map();
    this.#overrides = new Map();
    this.#cache = new Map();
    this.#cacheEnabled = enableCache;

    // Configuration precedence levels (highest to lowest)
    this.#precedenceLevels = [
      'runtime', // Runtime overrides (highest priority)
      'page', // Page-specific configuration
      'environment', // Environment-specific (dev/staging/prod)
      'global', // Global overrides
      'default', // Default configuration (lowest priority)
    ];
  }

  /**
   * Get merged configuration for a template
   * 
   * @param {string} templateId - Template identifier
   * @param {object} [runtimeOverrides] - Runtime-specific overrides
   * @returns {object} Merged configuration
   * @throws {InvalidConfigError} If configuration is invalid
   */
  getConfig(templateId, runtimeOverrides = {}) {
    assertPresent(templateId, 'Template ID is required');

    // Check cache
    if (this.#cacheEnabled) {
      const cacheKey = this.#generateCacheKey(templateId, runtimeOverrides);
      if (this.#cache.has(cacheKey)) {
        return this.#cache.get(cacheKey);
      }
    }

    try {
      // Build configuration chain
      const configChain = this.#buildConfigChain(templateId);

      // Add runtime overrides to chain (at the end for highest precedence)
      if (Object.keys(runtimeOverrides).length > 0) {
        configChain.push({ level: 'runtime', config: runtimeOverrides });
      }

      // Merge configurations
      const merged = this.#mergeConfigs(configChain);

      // Validate merged configuration
      if (this.#validator) {
        const validation = this.#validator.validate(merged, templateId);
        if (!validation.valid) {
          throw new InvalidConfigError(validation.errors, templateId);
        }
      }

      // Cache and return
      if (this.#cacheEnabled) {
        const cacheKey = this.#generateCacheKey(templateId, runtimeOverrides);
        this.#cache.set(cacheKey, merged);
      }

      return merged;
    } catch (error) {
      if (error instanceof InvalidConfigError) {
        throw error;
      }
      throw new ConfigMergeError(error.message, { templateId, runtimeOverrides });
    }
  }

  /**
   * Set configuration for a specific level
   * 
   * @param {string} level - Configuration level
   * @param {string} templateId - Template identifier
   * @param {object} config - Configuration object
   * @throws {Error} If level is invalid
   */
  setConfig(level, templateId, config) {
    if (!this.#precedenceLevels.includes(level)) {
      throw new Error(`Invalid configuration level: ${level}. Valid levels are: ${this.#precedenceLevels.join(', ')}`);
    }

    assertPresent(templateId, 'Template ID is required');
    assertPresent(config, 'Configuration is required');

    const key = `${level}:${templateId}`;
    this.#configs.set(key, config);

    // Invalidate cache for this template
    this.#invalidateCache(templateId);
  }

  /**
   * Register global override
   * 
   * @param {string} path - Configuration path (dot notation)
   * @param {*} value - Override value
   */
  setGlobalOverride(path, value) {
    assertPresent(path, 'Path is required');
    
    this.#overrides.set(path, value);
    this.#cache.clear(); // Clear all cache
  }

  /**
   * Remove global override
   * 
   * @param {string} path - Configuration path to remove
   */
  removeGlobalOverride(path) {
    this.#overrides.delete(path);
    this.#cache.clear();
  }

  /**
   * Clear all configurations for a level
   * 
   * @param {string} [level] - Level to clear, or all if not specified
   */
  clearConfigs(level) {
    if (level) {
      // Clear specific level
      for (const key of this.#configs.keys()) {
        if (key.startsWith(`${level}:`)) {
          this.#configs.delete(key);
        }
      }
    } else {
      // Clear all configs
      this.#configs.clear();
    }
    
    this.#cache.clear();
  }

  /**
   * Get current environment
   * 
   * @returns {string} Current environment
   */
  getEnvironment() {
    return this.#environment;
  }

  /**
   * Set environment
   * 
   * @param {string} environment - New environment
   */
  setEnvironment(environment) {
    this.#environment = environment;
    this.#cache.clear();
  }

  /**
   * Build configuration chain for merging
   * 
   * @private
   * @param {string} templateId - Template identifier
   * @returns {Array<{level: string, config: object}>} Configuration chain
   */
  #buildConfigChain(templateId) {
    const chain = [];

    // Add configurations in precedence order (reversed for merging)
    [...this.#precedenceLevels].reverse().forEach((level) => {
      if (level === 'default') {
        // Get default config for template type
        const templateType = this.#getTemplateType(templateId);
        const defaultConfig =
          this.#defaults[templateType] || this.#defaults.common || {};
        if (Object.keys(defaultConfig).length > 0) {
          chain.push({ level, config: defaultConfig });
        }
      } else if (level === 'environment') {
        // Get environment-specific config
        const envKey = `environment:${templateId}`;
        if (this.#configs.has(envKey)) {
          chain.push({ level, config: this.#configs.get(envKey) });
        }
      } else {
        const key = `${level}:${templateId}`;
        if (this.#configs.has(key)) {
          chain.push({ level, config: this.#configs.get(key) });
        }
      }
    });

    return chain;
  }

  /**
   * Get template type from template ID
   * 
   * @private
   * @param {string} templateId - Template identifier
   * @returns {string} Template type
   */
  #getTemplateType(templateId) {
    // Extract type from template ID
    // Examples: 'page', 'panel', 'modal', 'form', etc.
    const parts = templateId.split('-');
    
    // Check common patterns
    if (templateId.includes('page')) return 'page';
    if (templateId.includes('panel')) return 'panel';
    if (templateId.includes('modal')) return 'modal';
    if (templateId.includes('form')) return 'form';
    if (templateId.includes('button')) return 'button';
    if (templateId.includes('input')) return 'input';
    if (templateId.includes('list') || templateId.includes('table')) return 'list';
    if (templateId.includes('notification') || templateId.includes('toast')) return 'notification';
    
    // Default to first part or 'common'
    return parts[0] || 'common';
  }

  /**
   * Merge configuration chain
   * 
   * @private
   * @param {Array<{level: string, config: object}>} configChain - Configs to merge
   * @returns {object} Merged configuration
   */
  #mergeConfigs(configChain) {
    let merged = {};

    configChain.forEach(({ config }) => {
      merged = this.#deepMerge(merged, config);
    });

    // Apply global overrides
    this.#overrides.forEach((value, path) => {
      this.#setNestedProperty(merged, path, value);
    });

    return merged;
  }

  /**
   * Deep merge two objects
   * 
   * @private
   * @param {object} target - Target object
   * @param {object} source - Source object
   * @returns {object} Merged object
   */
  #deepMerge(target, source) {
    if (!source || typeof source !== 'object') {
      return source;
    }

    const output = { ...target };

    Object.keys(source).forEach((key) => {
      if (source[key] === undefined) {
        // Skip undefined values
        return;
      }

      if (source[key] === null) {
        // Null overwrites
        output[key] = null;
      } else if (Array.isArray(source[key])) {
        // Arrays are replaced, not merged
        output[key] = [...source[key]];
      } else if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
        // Recursively merge objects
        output[key] = this.#deepMerge(target[key] || {}, source[key]);
      } else {
        // Primitive values are replaced
        output[key] = source[key];
      }
    });

    return output;
  }

  /**
   * Set nested property using dot notation
   * 
   * @private
   * @param {object} obj - Object to modify
   * @param {string} path - Dot notation path
   * @param {*} value - Value to set
   */
  #setNestedProperty(obj, path, value) {
    const parts = path.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part] || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }

    current[parts[parts.length - 1]] = value;
  }

  /**
   * Deep freeze object to prevent mutations
   * 
   * @private
   * @param {object} obj - Object to freeze
   * @returns {object} Frozen object
   */
  #deepFreeze(obj) {
    Object.freeze(obj);
    
    Object.values(obj).forEach((value) => {
      if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
        this.#deepFreeze(value);
      }
    });
    
    return obj;
  }

  /**
   * Generate cache key
   * 
   * @private
   * @param {string} templateId - Template identifier
   * @param {object} overrides - Runtime overrides
   * @returns {string} Cache key
   */
  #generateCacheKey(templateId, overrides) {
    // Create a simple hash of the overrides
    const overridesHash = Object.keys(overrides).length > 0
      ? JSON.stringify(overrides).split('').reduce((a, b) => {
          a = ((a << 5) - a) + b.charCodeAt(0);
          return a & a;
        }, 0).toString(36)
      : 'none';
    
    return `${this.#environment}:${templateId}:${overridesHash}`;
  }

  /**
   * Invalidate cache for a template
   * 
   * @private
   * @param {string} templateId - Template identifier
   */
  #invalidateCache(templateId) {
    if (!this.#cacheEnabled) return;

    // Remove all cache entries for this template
    for (const key of this.#cache.keys()) {
      if (key.includes(`:${templateId}:`)) {
        this.#cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clearCache() {
    this.#cache.clear();
  }

  /**
   * Get cache statistics
   * 
   * @returns {object} Cache statistics
   */
  getCacheStats() {
    return {
      enabled: this.#cacheEnabled,
      size: this.#cache.size,
      keys: Array.from(this.#cache.keys()),
    };
  }

  /**
   * Enable or disable caching
   * 
   * @param {boolean} enabled - Whether to enable caching
   */
  setCacheEnabled(enabled) {
    this.#cacheEnabled = enabled;
    if (!enabled) {
      this.#cache.clear();
    }
  }
}