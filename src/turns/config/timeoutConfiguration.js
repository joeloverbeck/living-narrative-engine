/**
 * @file Timeout configuration for turn states
 * Encapsulates timeout resolution logic with environment detection
 */

import { ProcessEnvironmentProvider } from '../../configuration/ProcessEnvironmentProvider.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';

/**
 * Manages timeout configuration for turn states
 *
 * @class
 */
class TimeoutConfiguration {
  /**
   * Default timeout for production environment (30 seconds)
   *
   * @type {number}
   * @static
   * @readonly
   */
  static DEFAULT_TIMEOUT_PRODUCTION = 30_000;

  /**
   * Default timeout for development environment (3 seconds)
   *
   * @type {number}
   * @static
   * @readonly
   */
  static DEFAULT_TIMEOUT_DEVELOPMENT = 3_000;

  /** @type {import('../../interfaces/IEnvironmentProvider.js').IEnvironmentProvider} */
  #environmentProvider;
  /** @type {number | undefined} */
  #explicitTimeoutMs;
  /** @type {import('../../interfaces/ILogger.js').ILogger | undefined} */
  #logger;
  /** @type {number | null} */
  #resolvedTimeout;

  /**
   * Creates a timeout configuration instance
   *
   * @param {object} options - Configuration options
   * @param {number} [options.timeoutMs] - Explicit timeout in milliseconds
   * @param {import('../../interfaces/IEnvironmentProvider.js').IEnvironmentProvider} [options.environmentProvider] - Environment provider
   * @param {import('../../interfaces/ILogger.js').ILogger} [options.logger] - Logger for warnings
   */
  constructor({ timeoutMs, environmentProvider, logger } = {}) {
    this.#explicitTimeoutMs = timeoutMs;
    this.#environmentProvider =
      environmentProvider ?? new ProcessEnvironmentProvider();
    this.#logger = logger;
    this.#resolvedTimeout = null; // Lazy resolution
  }

  /**
   * Gets the configured timeout value
   * Resolves on first call and caches result
   *
   * @returns {number} Timeout in milliseconds
   */
  getTimeoutMs() {
    if (this.#resolvedTimeout === null) {
      this.#resolvedTimeout = this.#resolveTimeout();
      this.#validateTimeout(this.#resolvedTimeout);
    }
    return this.#resolvedTimeout;
  }

  /**
   * Resolves timeout from explicit value or environment
   *
   * @returns {number} Resolved timeout
   */
  #resolveTimeout() {
    // Explicit timeout takes precedence
    if (
      this.#explicitTimeoutMs !== undefined &&
      this.#explicitTimeoutMs !== null
    ) {
      return this.#explicitTimeoutMs;
    }

    // Use environment provider
    try {
      const env = this.#environmentProvider.getEnvironment();
      const isProduction = env?.IS_PRODUCTION ?? true; // Fail-safe to production
      return isProduction
        ? TimeoutConfiguration.DEFAULT_TIMEOUT_PRODUCTION
        : TimeoutConfiguration.DEFAULT_TIMEOUT_DEVELOPMENT;
    } catch (error) {
      // If environment provider fails, use production timeout as safe default
      this.#logger?.warn?.(
        'Environment provider failed, defaulting to production timeout',
        error
      );
      return TimeoutConfiguration.DEFAULT_TIMEOUT_PRODUCTION;
    }
  }

  /**
   * Validates timeout is positive finite number
   *
   * @param {number} timeout - Timeout to validate
   * @throws {InvalidArgumentError} If timeout is invalid
   */
  #validateTimeout(timeout) {
    if (!Number.isFinite(timeout) || timeout <= 0) {
      throw new InvalidArgumentError(
        `timeoutMs must be a positive finite number, got: ${timeout} (type: ${typeof timeout})`
      );
    }
  }
}

export default TimeoutConfiguration;
