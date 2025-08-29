/**
 * @file Filters sensitive data from log messages using configurable patterns
 * @module SensitiveDataFilter
 */

import { ensureValidLogger } from '../utils/loggerUtils.js';

/**
 * Filters sensitive data from log messages and objects
 */
class SensitiveDataFilter {
  #logger;
  #enabled;
  #patterns;
  #replacementStrategies;
  #defaultStrategy;

  /**
   * @param {Object} params
   * @param {Object} params.logger - Logger instance
   * @param {boolean} params.enabled - Whether filtering is enabled
   * @param {Object} params.config - Filter configuration
   */
  constructor({ logger, enabled = true, config = {} }) {
    if (!logger) {
      throw new Error('Logger is required for SensitiveDataFilter');
    }
    ensureValidLogger(logger, 'logger', 'SensitiveDataFilter');
    this.#logger = logger;
    this.#enabled = enabled;
    this.#defaultStrategy = config.strategy || 'mask';
    
    // Initialize default patterns for common sensitive data
    this.#patterns = {
      apiKey: /((?:api[_-]?key|apikey)[\s:=]+)([\w-]{10,})/gi,
      bearerToken: /(Bearer\s+)([\w.-]+)/gi,
      password: /((?:password|passwd|pwd)[\s:=]+)(\S+)/gi,
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
      ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
      ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
      jwt: /eyJ[\w-]+\.eyJ[\w-]+\.[\w-]+/g,
      awsKey: /(?:AKIA|A3T|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[\w]{16}/g,
      privateKey: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----[\s\S]+?-----END\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g,
      ...this.#parseCustomPatterns(config.patterns)
    };

    // Initialize replacement strategies
    this.#replacementStrategies = {
      mask: () => '[REDACTED]',
      partial: (match) => this.#partialMask(match),
      hash: (match) => this.#hashValue(match),
      remove: () => '',
      ...config.strategies
    };
  }

  /**
   * Filters sensitive data from a log entry
   * @param {*} data - Data to filter (string, object, or array)
   * @param {string} strategy - Replacement strategy to use
   * @returns {*} Filtered data
   */
  filter(data, strategy = 'mask') {
    if (!this.#enabled) {
      return data;
    }

    try {
      if (typeof data === 'string') {
        return this.#filterString(data, strategy);
      } else if (typeof data === 'object' && data !== null) {
        return this.#filterObject(data, strategy);
      }
      return data;
    } catch (err) {
      this.#logger.warn('Failed to filter sensitive data', err);
      return data; // Return original data on error
    }
  }

  /**
   * Filters sensitive data from a string
   * @private
   */
  #filterString(str, strategy) {
    let filtered = str;
    
    for (const [patternName, pattern] of Object.entries(this.#patterns)) {
      if (pattern instanceof RegExp) {
        const replacer = this.#replacementStrategies[strategy] || this.#replacementStrategies.mask;
        filtered = filtered.replace(pattern, (match, ...groups) => {
          this.#logger.debug(`Filtered ${patternName} from log message`);
          
          // Check if we have capturing groups (for patterns like password, apiKey)
          if (groups.length >= 2 && groups[0] && groups[1]) {
            // First group is the prefix, second group is the sensitive value
            const prefix = groups[0];
            const sensitiveValue = groups[1];
            return prefix + replacer(sensitiveValue, patternName);
          } else {
            // No capturing groups, filter the entire match
            return replacer(match, patternName);
          }
        });
      }
    }
    
    return filtered;
  }

  /**
   * Filters sensitive data from an object
   * @private
   */
  #filterObject(obj, strategy) {
    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map(item => this.filter(item, strategy));
    }

    // Create a deep copy to avoid mutating original
    const filtered = {};
    
    for (const [key, value] of Object.entries(obj)) {
      // Check if the key itself indicates sensitive data
      if (this.#isSensitiveKey(key)) {
        const replacer = this.#replacementStrategies[strategy] || this.#replacementStrategies.mask;
        filtered[key] = replacer(value, key);
        this.#logger.debug(`Filtered sensitive field: ${key}`);
      } else if (typeof value === 'string') {
        filtered[key] = this.#filterString(value, strategy);
      } else if (typeof value === 'object' && value !== null) {
        filtered[key] = this.#filterObject(value, strategy);
      } else {
        filtered[key] = value;
      }
    }
    
    return filtered;
  }

  /**
   * Checks if a key name indicates sensitive data
   * @private
   */
  #isSensitiveKey(key) {
    const sensitiveKeys = [
      'password', 'passwd', 'pwd', 'secret', 'token', 'apikey', 
      'api_key', 'apiKey', 'auth', 'authorization', 'credential',
      'private', 'privateKey', 'private_key', 'ssn', 'social_security',
      'credit_card', 'creditCard', 'card_number', 'cardNumber'
    ];
    
    const lowerKey = key.toLowerCase();
    return sensitiveKeys.some(sensitive => lowerKey.includes(sensitive));
  }

  /**
   * Partially masks a value, showing only first and last few characters
   * @private
   */
  #partialMask(value) {
    const str = String(value);
    if (str.length <= 8) {
      return '[REDACTED]';
    }
    
    const visibleChars = 3;
    const prefix = str.substring(0, visibleChars);
    const suffix = str.substring(str.length - visibleChars);
    const masked = '*'.repeat(Math.max(0, str.length - (visibleChars * 2)));
    
    return `${prefix}${masked}${suffix}`;
  }

  /**
   * Creates a simple hash of a value for consistent replacement
   * @private
   */
  #hashValue(value) {
    const str = String(value);
    let hash = 0;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return `[HASH:${Math.abs(hash).toString(16).toUpperCase()}]`;
  }

  /**
   * Parses custom patterns from configuration
   * @private
   */
  #parseCustomPatterns(patterns = {}) {
    const parsed = {};
    
    for (const [name, pattern] of Object.entries(patterns)) {
      try {
        if (typeof pattern === 'string') {
          parsed[name] = new RegExp(pattern, 'gi');
        } else if (pattern instanceof RegExp) {
          parsed[name] = pattern;
        }
      } catch (err) {
        this.#logger.warn(`Invalid pattern for ${name}: ${pattern}`, err);
      }
    }
    
    return parsed;
  }

  /**
   * Updates filter configuration
   * @param {Object} config - New configuration
   */
  updateConfig(config) {
    if (config.enabled !== undefined) {
      this.#enabled = config.enabled;
    }
    
    if (config.patterns) {
      Object.assign(this.#patterns, this.#parseCustomPatterns(config.patterns));
    }
    
    if (config.strategies) {
      Object.assign(this.#replacementStrategies, config.strategies);
    }
  }

  /**
   * Checks if filtering is enabled
   * @returns {boolean}
   */
  isEnabled() {
    return this.#enabled;
  }

  /**
   * Enables or disables filtering
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this.#enabled = Boolean(enabled);
  }

  /**
   * Gets the default strategy
   * @returns {string}
   */
  get strategy() {
    return this.#defaultStrategy;
  }

  /**
   * Sets the default strategy
   * @param {string} strategy
   */
  set strategy(strategy) {
    this.#defaultStrategy = strategy;
  }
}

export default SensitiveDataFilter;