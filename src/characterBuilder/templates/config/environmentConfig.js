/**
 * @file Environment-specific configuration loader
 * @module characterBuilder/templates/config/environmentConfig
 */

import { EnvironmentDetectionError } from '../errors/templateConfigurationError.js';

/**
 * Environment-specific configuration loader
 * Detects the current environment and provides appropriate configurations
 */
export class EnvironmentConfigLoader {
  #environment;
  #configs;
  #detectionMethod;

  /**
   * @param {object} [options] - Loader options
   * @param {string} [options.forceEnvironment] - Force a specific environment
   * @param {Function} [options.customDetector] - Custom environment detector
   */
  constructor(options = {}) {
    this.#configs = new Map();
    this.#detectionMethod = options.customDetector ? 'custom' : 'automatic';
    
    // Initialize environment configurations
    this.#loadEnvironmentConfigs();
    
    // Detect or set environment
    if (options.forceEnvironment) {
      this.#environment = options.forceEnvironment;
      this.#detectionMethod = 'forced';
    } else if (options.customDetector) {
      this.#environment = options.customDetector();
    } else {
      this.#environment = this.#detectEnvironment();
    }
    
    // Validate detected environment
    if (!this.#configs.has(this.#environment)) {
      throw new EnvironmentDetectionError(
        `Unknown environment: ${this.#environment}. Valid environments: ${Array.from(this.#configs.keys()).join(', ')}`
      );
    }
  }

  /**
   * Detect current environment
   * 
   * @private
   * @returns {string} Detected environment
   */
  #detectEnvironment() {
    // Check for browser environment
    if (typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname;
      const pathname = window.location.pathname;
      
      // Development indicators
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.includes('.local') ||
        pathname.includes('/dev/') ||
        pathname.includes('/development/')
      ) {
        return 'development';
      }
      
      // Staging indicators
      if (
        hostname.includes('staging') ||
        hostname.includes('stage') ||
        hostname.includes('test') ||
        hostname.includes('uat') ||
        hostname.includes('preview') ||
        pathname.includes('/staging/') ||
        pathname.includes('/test/')
      ) {
        return 'staging';
      }
      
      // Production by default for public domains
      return 'production';
    }
    
    // Check Node.js environment variable
    // eslint-disable-next-line no-undef
    if (typeof process !== 'undefined' && process.env) {
      // eslint-disable-next-line no-undef
      const nodeEnv = process.env.NODE_ENV;
      
      if (nodeEnv === 'production' || nodeEnv === 'prod') {
        return 'production';
      }
      if (nodeEnv === 'staging' || nodeEnv === 'stage') {
        return 'staging';
      }
      if (nodeEnv === 'test' || nodeEnv === 'testing') {
        return 'test';
      }
      if (nodeEnv === 'development' || nodeEnv === 'dev') {
        return 'development';
      }
    }
    
    // Default to development
    return 'development';
  }

  /**
   * Load environment-specific configurations
   * 
   * @private
   */
  #loadEnvironmentConfigs() {
    // Development environment
    this.#configs.set('development', {
      performance: {
        cacheTimeout: 0, // No caching in dev
        lazyLoad: false, // Load everything immediately
        virtualScrollThreshold: 50, // Lower threshold for testing
        debounceDelay: 100, // Faster response
        throttleDelay: 50,
      },
      validation: {
        strict: true,
        warnOnMissingData: true,
        throwOnError: true,
        validateOnRender: true,
        sanitizeInput: true,
      },
      debug: {
        enabled: true,
        logLevel: 'debug',
        showPerformanceMetrics: true,
        highlightUpdates: true,
        showRenderCount: true,
        showConfigSource: true,
      },
      styling: {
        animations: true,
        transitions: true,
        showDebugBorders: false,
        highlightInteractive: false,
      },
      events: {
        logEvents: true,
        validateHandlers: true,
      },
      accessibility: {
        enforceStandards: true,
        warnOnViolations: true,
      },
    });

    // Staging environment
    this.#configs.set('staging', {
      performance: {
        cacheTimeout: 1800000, // 30 minutes
        lazyLoad: true,
        virtualScrollThreshold: 100,
        debounceDelay: 200,
        throttleDelay: 75,
      },
      validation: {
        strict: true,
        warnOnMissingData: true,
        throwOnError: false,
        validateOnRender: true,
        sanitizeInput: true,
      },
      debug: {
        enabled: true,
        logLevel: 'info',
        showPerformanceMetrics: false,
        highlightUpdates: false,
        showRenderCount: false,
        showConfigSource: false,
      },
      styling: {
        animations: true,
        transitions: true,
        showDebugBorders: false,
        highlightInteractive: false,
      },
      events: {
        logEvents: false,
        validateHandlers: true,
      },
      accessibility: {
        enforceStandards: true,
        warnOnViolations: false,
      },
    });

    // Production environment
    this.#configs.set('production', {
      performance: {
        cacheTimeout: 3600000, // 1 hour
        lazyLoad: true,
        virtualScrollThreshold: 100,
        debounceDelay: 300,
        throttleDelay: 100,
        minifyOutput: true,
      },
      validation: {
        strict: false,
        warnOnMissingData: false,
        throwOnError: false,
        validateOnRender: false,
        sanitizeInput: true,
      },
      debug: {
        enabled: false,
        logLevel: 'error',
        showPerformanceMetrics: false,
        highlightUpdates: false,
        showRenderCount: false,
        showConfigSource: false,
      },
      styling: {
        animations: true,
        transitions: true,
        showDebugBorders: false,
        highlightInteractive: false,
      },
      events: {
        logEvents: false,
        validateHandlers: false,
      },
      accessibility: {
        enforceStandards: false,
        warnOnViolations: false,
      },
      security: {
        sanitizeAll: true,
        cspEnabled: true,
        strictMode: true,
      },
    });

    // Test environment
    this.#configs.set('test', {
      performance: {
        cacheTimeout: 0, // No caching in tests
        lazyLoad: false,
        virtualScrollThreshold: 10,
        debounceDelay: 0, // Immediate for tests
        throttleDelay: 0,
      },
      validation: {
        strict: true,
        warnOnMissingData: false, // Don't warn in tests
        throwOnError: true,
        validateOnRender: true,
        sanitizeInput: false, // Skip in tests for speed
      },
      debug: {
        enabled: false, // No debug output in tests
        logLevel: 'error',
        showPerformanceMetrics: false,
        highlightUpdates: false,
        showRenderCount: false,
        showConfigSource: false,
      },
      styling: {
        animations: false, // No animations in tests
        transitions: false,
        showDebugBorders: false,
        highlightInteractive: false,
      },
      events: {
        logEvents: false,
        validateHandlers: false,
      },
      accessibility: {
        enforceStandards: false,
        warnOnViolations: false,
      },
    });
  }

  /**
   * Get configuration for current environment
   * 
   * @returns {object} Environment-specific configuration
   */
  getConfig() {
    return this.#configs.get(this.#environment) || {};
  }

  /**
   * Get configuration for a specific environment
   * 
   * @param {string} environment - Environment name
   * @returns {object} Environment configuration
   */
  getConfigForEnvironment(environment) {
    return this.#configs.get(environment) || {};
  }

  /**
   * Get current environment name
   * 
   * @returns {string} Current environment
   */
  getEnvironment() {
    return this.#environment;
  }

  /**
   * Get detection method used
   * 
   * @returns {string} Detection method ('automatic', 'forced', or 'custom')
   */
  getDetectionMethod() {
    return this.#detectionMethod;
  }

  /**
   * Override environment (for testing)
   * 
   * @param {string} env - Environment to set
   * @throws {EnvironmentDetectionError} If environment is unknown
   */
  setEnvironment(env) {
    if (!this.#configs.has(env)) {
      throw new EnvironmentDetectionError(
        `Unknown environment: ${env}. Valid environments: ${Array.from(this.#configs.keys()).join(', ')}`
      );
    }
    
    this.#environment = env;
    this.#detectionMethod = 'override';
  }

  /**
   * Get all available environments
   * 
   * @returns {string[]} Available environment names
   */
  getAvailableEnvironments() {
    return Array.from(this.#configs.keys());
  }

  /**
   * Check if an environment exists
   * 
   * @param {string} environment - Environment to check
   * @returns {boolean} True if environment exists
   */
  hasEnvironment(environment) {
    return this.#configs.has(environment);
  }

  /**
   * Get environment detection info
   * 
   * @returns {object} Detection information
   */
  getDetectionInfo() {
    const info = {
      detectedEnvironment: this.#environment,
      detectionMethod: this.#detectionMethod,
      availableEnvironments: this.getAvailableEnvironments(),
    };
    
    // Add browser info if available
    if (typeof window !== 'undefined' && window.location) {
      info.browser = {
        hostname: window.location.hostname,
        pathname: window.location.pathname,
        protocol: window.location.protocol,
      };
    }
    
    // Add Node.js info if available
    // eslint-disable-next-line no-undef
    if (typeof process !== 'undefined' && process.env) {
      info.node = {
        // eslint-disable-next-line no-undef
        NODE_ENV: process.env.NODE_ENV,
      };
    }
    
    return info;
  }

  /**
   * Register custom environment configuration
   * 
   * @param {string} name - Environment name
   * @param {object} config - Environment configuration
   */
  registerEnvironment(name, config) {
    this.#configs.set(name, config);
  }
}