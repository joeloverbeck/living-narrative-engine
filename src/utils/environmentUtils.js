/**
 * @file Cross-platform environment detection and variable access utilities
 * @description Provides safe access to environment variables and runtime detection
 *              for both browser and Node.js environments.
 */

/**
 * Detects the current runtime environment
 * @returns {string} The detected environment: 'browser', 'node', 'webworker', or 'unknown'
 */
export function detectEnvironment() {
  // Check for Node.js environment
  if (
    typeof process !== 'undefined' &&
    process.versions &&
    process.versions.node
  ) {
    return 'node';
  }

  // Check for browser environment
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    return 'browser';
  }

  // Check for Web Worker environment
  if (typeof importScripts === 'function' && typeof navigator !== 'undefined') {
    return 'webworker';
  }

  return 'unknown';
}

/**
 * Checks if we're running in a Node.js environment
 * @returns {boolean} True if running in Node.js
 */
export function isNodeEnvironment() {
  return detectEnvironment() === 'node';
}

/**
 * Checks if we're running in a browser environment
 * @returns {boolean} True if running in browser
 */
export function isBrowserEnvironment() {
  return detectEnvironment() === 'browser';
}

/**
 * Checks if we're running in a test environment
 * @returns {boolean} True if running in test environment
 */
export function isTestEnvironment() {
  // Check various test environment indicators
  return (
    // Jest test environment
    (typeof globalThis !== 'undefined' && globalThis.jest) ||
    // NODE_ENV set to test (Node.js)
    (isNodeEnvironment() && process.env.NODE_ENV === 'test') ||
    // Browser build with test mode injected
    (typeof __TEST_MODE__ !== 'undefined' && __TEST_MODE__) ||
    // Manual test mode flag in global scope
    (typeof globalThis !== 'undefined' && globalThis.__TEST_MODE__)
  );
}

/**
 * Safely gets an environment variable with fallback support
 * @param {string} key - The environment variable key
 * @param {string} [defaultValue=''] - Default value if variable not found
 * @returns {string} The environment variable value or default
 */
export function getEnvironmentVariable(key, defaultValue = '') {
  // Try Node.js process.env first
  if (
    isNodeEnvironment() &&
    process.env &&
    typeof process.env[key] === 'string'
  ) {
    return process.env[key];
  }

  // Try browser build-time injected variables (esbuild define)
  const globalKey = `__${key}__`;
  if (typeof globalThis[globalKey] !== 'undefined') {
    return String(globalThis[globalKey]);
  }

  // Try browser window environment variables (if available)
  if (isBrowserEnvironment() && typeof window !== 'undefined' && window.env) {
    return window.env[key] || defaultValue;
  }

  // Try global environment object
  if (typeof globalThis.env === 'object' && globalThis.env) {
    return globalThis.env[key] || defaultValue;
  }

  return defaultValue;
}

/**
 * Gets the current NODE_ENV or equivalent
 * @returns {string} The environment mode: 'test', 'production', 'development'
 */
export function getEnvironmentMode() {
  // Check for test environment first
  if (isTestEnvironment()) {
    return 'test';
  }

  // Get NODE_ENV or equivalent
  const nodeEnv = getEnvironmentVariable('NODE_ENV', 'development');

  // Normalize to expected values
  switch (nodeEnv.toLowerCase()) {
    case 'test':
    case 'testing':
      return 'test';
    case 'prod':
    case 'production':
      return 'production';
    case 'dev':
    case 'development':
    default:
      return 'development';
  }
}

/**
 * Checks if debug configuration loading should be skipped
 * @returns {boolean} True if debug config loading should be skipped
 */
export function shouldSkipDebugConfig() {
  const skipValue = getEnvironmentVariable('SKIP_DEBUG_CONFIG', 'false');
  const normalizedValue = String(skipValue).trim().toLowerCase();

  // Handle various truthy values
  return (
    normalizedValue === 'true' ||
    normalizedValue === '1' ||
    normalizedValue === 'yes' ||
    normalizedValue === 'on'
  );
}

/**
 * Gets a configuration object with common environment settings
 * @returns {object} Configuration object with environment settings
 */
export function getEnvironmentConfig() {
  const env = detectEnvironment();
  const mode = getEnvironmentMode();

  return {
    environment: env,
    mode,
    isNode: env === 'node',
    isBrowser: env === 'browser',
    isTest: mode === 'test',
    isDevelopment: mode === 'development',
    isProduction: mode === 'production',
    skipDebugConfig: shouldSkipDebugConfig(),

    // Common environment variables
    nodeEnv: getEnvironmentVariable('NODE_ENV', 'development'),
    debugLogMode: getEnvironmentVariable('DEBUG_LOG_MODE', ''),
    debugLogSilent:
      getEnvironmentVariable('DEBUG_LOG_SILENT', 'false') === 'true',
  };
}

/**
 * Safe environment variable checker that doesn't throw in browser
 * @param {string} key - Environment variable key to check
 * @returns {boolean} True if the environment variable exists and is truthy
 */
export function hasEnvironmentVariable(key) {
  try {
    const value = getEnvironmentVariable(key);
    return value !== '' && value !== 'false' && value !== '0';
  } catch (error) {
    return false;
  }
}

/**
 * Creates a safe process.env-like object that works in both environments
 * @returns {object} Process.env-compatible object
 */
export function createProcessEnvShim() {
  // If we're in Node.js, return the real process.env
  if (isNodeEnvironment() && typeof process !== 'undefined' && process.env) {
    return process.env;
  }

  // Create a browser-compatible shim
  const envShim = {};

  // Add common environment variables that might be injected at build time
  const commonEnvVars = [
    'NODE_ENV',
    'DEBUG_LOG_MODE',
    'DEBUG_LOG_SILENT',
    'SKIP_DEBUG_CONFIG',
    'PROXY_HOST',
    'PROXY_PORT',
    'PROXY_USE_HTTPS',
  ];

  for (const key of commonEnvVars) {
    envShim[key] = getEnvironmentVariable(key, undefined);
  }

  return envShim;
}

/**
 * Check if garbage collection is available
 * @returns {boolean} True if GC is available (Node.js with --expose-gc flag)
 */
export function isGarbageCollectionAvailable() {
  // eslint-disable-next-line no-undef
  return typeof global !== 'undefined' &&
         typeof global.gc === 'function';
}

/**
 * Trigger garbage collection if available
 * @returns {boolean} True if GC was triggered
 */
export function triggerGarbageCollection() {
  if (isGarbageCollectionAvailable()) {
    // eslint-disable-next-line no-undef
    global.gc();
    return true;
  }
  return false;
}

/**
 * Get memory usage based on environment
 * @returns {object|null} Memory usage object or null if not available
 */
export function getMemoryUsage() {
  // Browser environment
  if (typeof performance !== 'undefined' && performance.memory) {
    return {
      heapUsed: performance.memory.usedJSHeapSize || 0,
      heapTotal: performance.memory.totalJSHeapSize || 0,
      heapLimit: performance.memory.jsHeapSizeLimit || 0,
      external: 0, // Not available in browser
    };
  }

  // Node.js environment
  if (isNodeEnvironment() && typeof process !== 'undefined' && process.memoryUsage) {
    const mem = process.memoryUsage();
    return {
      heapUsed: mem.heapUsed || 0,
      heapTotal: mem.heapTotal || 0,
      heapLimit: mem.heapTotal || 0, // Use heapTotal as limit in Node.js
      external: mem.external || 0,
    };
  }

  return null;
}

/**
 * Get memory usage value in bytes
 * @returns {number} Current memory usage in bytes or 0 if not available
 */
export function getMemoryUsageBytes() {
  const usage = getMemoryUsage();
  return usage ? usage.heapUsed : 0;
}

/**
 * Get memory usage percentage
 * @returns {number} Memory usage as percentage (0-1) or 0 if not available
 */
export function getMemoryUsagePercent() {
  const usage = getMemoryUsage();
  if (!usage || !usage.heapLimit) {
    return 0;
  }
  return usage.heapUsed / usage.heapLimit;
}
