/**
 * @file Centralized endpoint configuration for LLM proxy server connections
 * @description Provides configurable endpoints to replace hardcoded URLs throughout the codebase
 */

/**
 * @typedef {object} EndpointConfiguration
 * @property {string} baseUrl - Base URL for the LLM proxy server
 * @property {string} debugLog - Debug log endpoint
 * @property {string} llmRequest - LLM request endpoint
 * @property {string} tracesWrite - Traces write endpoint
 * @property {string} tracesWriteBatch - Batch traces write endpoint
 * @property {string} health - Health check endpoint
 */

/**
 * @description Normalizes boolean-like configuration flags to actual booleans.
 *
 * @param {unknown} value - Configuration value to normalize.
 * @returns {boolean} {@code true} when the input represents an enabled flag.
 */
function normalizeBooleanFlag(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
    if (normalized === '1') {
      return true;
    }
    if (normalized === '0') {
      return false;
    }
  }

  return Boolean(value);
}

/**
 * Environment-based endpoint configuration
 * Allows configuration via environment variables while providing sensible defaults
 */
class EndpointConfig {
  /** @type {string} */
  #baseUrl;

  /** @type {boolean} */
  #useSecureConnection;

  /**
   * Constructor initializes endpoint configuration from environment or defaults
   */
  constructor() {
    // In browser builds, use build-time injected values
    // In Node.js (tests), fall back to process.env
    const proxyUseHttps =
      typeof __PROXY_USE_HTTPS__ !== 'undefined'
        ? __PROXY_USE_HTTPS__
        : typeof process !== 'undefined'
          ? process.env.PROXY_USE_HTTPS
          : 'false';

    const host =
      typeof __PROXY_HOST__ !== 'undefined'
        ? __PROXY_HOST__
        : typeof process !== 'undefined'
          ? process.env.PROXY_HOST || 'localhost'
          : 'localhost';

    const port =
      typeof __PROXY_PORT__ !== 'undefined'
        ? __PROXY_PORT__
        : typeof process !== 'undefined'
          ? process.env.PROXY_PORT || '3001'
          : '3001';

    this.#useSecureConnection = normalizeBooleanFlag(proxyUseHttps);

    const protocol = this.#useSecureConnection ? 'https' : 'http';

    this.#baseUrl = `${protocol}://${host}:${port}`;
  }

  /**
   * Get the base URL for the proxy server
   *
   * @returns {string} Base URL (e.g., 'http://localhost:3001')
   */
  getBaseUrl() {
    return this.#baseUrl;
  }

  /**
   * Get the complete endpoint configuration
   *
   * @returns {EndpointConfiguration} Complete endpoint configuration
   */
  getEndpoints() {
    return {
      baseUrl: this.#baseUrl,
      debugLog: `${this.#baseUrl}/api/debug-log`,
      llmRequest: `${this.#baseUrl}/api/llm-request`,
      tracesWrite: `${this.#baseUrl}/api/traces/write`,
      tracesWriteBatch: `${this.#baseUrl}/api/traces/write-batch`,
      health: `${this.#baseUrl}/health`,
    };
  }

  /**
   * Get debug log endpoint URL
   *
   * @returns {string} Debug log endpoint URL
   */
  getDebugLogEndpoint() {
    return `${this.#baseUrl}/api/debug-log`;
  }

  /**
   * Get LLM request endpoint URL
   *
   * @returns {string} LLM request endpoint URL
   */
  getLlmRequestEndpoint() {
    return `${this.#baseUrl}/api/llm-request`;
  }

  /**
   * Get traces write endpoint URL
   *
   * @returns {string} Traces write endpoint URL
   */
  getTracesWriteEndpoint() {
    return `${this.#baseUrl}/api/traces/write`;
  }

  /**
   * Get batch traces write endpoint URL
   *
   * @returns {string} Batch traces write endpoint URL
   */
  getTracesWriteBatchEndpoint() {
    return `${this.#baseUrl}/api/traces/write-batch`;
  }

  /**
   * Get health check endpoint URL
   *
   * @returns {string} Health check endpoint URL
   */
  getHealthEndpoint() {
    return `${this.#baseUrl}/health`;
  }

  /**
   * Test connectivity to the proxy server
   *
   * @returns {Promise<boolean>} True if server is reachable
   */
  async testConnectivity() {
    try {
      const response = await fetch(this.getHealthEndpoint(), {
        method: 'GET',
        timeout: 5000,
      });
      return response.ok;
    } catch (error) {
      // Try the debug log endpoint as fallback if health endpoint doesn't exist
      try {
        const fallbackResponse = await fetch(this.getDebugLogEndpoint(), {
          method: 'OPTIONS',
          timeout: 5000,
        });
        return fallbackResponse.status !== 0; // Any response means server is reachable
      } catch (fallbackError) {
        return false;
      }
    }
  }

  /**
   * Create configuration for different environments
   *
   * @param {'development'|'production'|'test'} environment - Target environment
   * @returns {EndpointConfig} Configured endpoint instance
   */
  static forEnvironment(environment) {
    // Only works in Node.js environments (tests)
    if (typeof process === 'undefined') {
      throw new Error(
        'forEnvironment() is only available in Node.js environments'
      );
    }

    const originalEnv = process.env.NODE_ENV;

    switch (environment) {
      case 'development':
        process.env.PROXY_HOST = 'localhost';
        process.env.PROXY_PORT = '3001';
        process.env.PROXY_USE_HTTPS = 'false';
        break;
      case 'production':
        // Production values should be set via environment variables
        // This just ensures defaults if not set
        process.env.PROXY_HOST = process.env.PROXY_HOST || 'localhost';
        process.env.PROXY_PORT = process.env.PROXY_PORT || '3001';
        process.env.PROXY_USE_HTTPS = process.env.PROXY_USE_HTTPS || 'false';
        break;
      case 'test':
        process.env.PROXY_HOST = 'localhost';
        process.env.PROXY_PORT = process.env.PROXY_PORT || '3002'; // Different port for tests
        process.env.PROXY_USE_HTTPS = 'false';
        break;
      default:
        throw new Error(`Unknown environment: ${environment}`);
    }

    const config = new EndpointConfig();

    // Restore original NODE_ENV
    if (originalEnv) {
      process.env.NODE_ENV = originalEnv;
    }

    return config;
  }
}

// Create and export singleton instance
let endpointConfigInstance = null;

/**
 * Get the singleton endpoint configuration instance
 *
 * @returns {EndpointConfig} Singleton endpoint configuration
 */
export function getEndpointConfig() {
  if (!endpointConfigInstance) {
    endpointConfigInstance = new EndpointConfig();
  }
  return endpointConfigInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetEndpointConfig() {
  endpointConfigInstance = null;
}

export default EndpointConfig;
