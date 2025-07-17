/**
 * @file Logger configuration management for enhanced logging system
 * @description Provides environment-aware configuration for colors, icons, and formatting
 */

/**
 * @typedef {object} LoggerConfig
 * @property {boolean} enableColors - Whether to enable terminal colors
 * @property {boolean} enableIcons - Whether to enable Unicode icons
 * @property {boolean} prettyFormat - Whether to use pretty formatting
 * @property {string} timestampFormat - Timestamp format string
 * @property {number} maxMessageLength - Maximum message length before truncation
 * @property {boolean} showContext - Whether to show context objects
 * @property {string} environment - Current environment (development/production)
 */

/**
 * Logger configuration class for environment-aware settings
 */
class LoggerConfiguration {
  /** @type {LoggerConfig} */
  #config;

  /** @type {boolean} */
  #isTTY;

  /**
   *
   */
  constructor() {
    this.#isTTY = this.#detectTTY();
    this.#config = this.#loadConfiguration();
  }

  /**
   * Detect if running in a TTY environment
   * @returns {boolean} Whether running in a TTY environment
   * @private
   */
  #detectTTY() {
    // If TTY properties are missing (deleted in tests), default to true for development
    const stdoutTTY = process.stdout.isTTY;
    const stderrTTY = process.stderr.isTTY;

    // If both are explicitly false, we're definitely not in a TTY
    if (stdoutTTY === false && stderrTTY === false) {
      return false;
    }

    // If either is undefined (missing), default to true for development environments
    if (stdoutTTY === undefined || stderrTTY === undefined) {
      const env = process.env.NODE_ENV || 'development';
      return env !== 'production';
    }

    // Normal case: both are present, use standard check
    return Boolean(stdoutTTY && stderrTTY);
  }

  /**
   * Load configuration based on environment variables and defaults
   * @returns {LoggerConfig} The loaded configuration
   * @private
   */
  #loadConfiguration() {
    const env = process.env.NODE_ENV || 'development';
    const isDevelopment = env !== 'production';

    return {
      enableColors: this.#shouldEnableColors(env),
      enableIcons: this.#getEnvBoolean('LOG_ICON_MODE', isDevelopment),
      prettyFormat: this.#getEnvBoolean(
        'LOG_ENHANCED_FORMATTING',
        isDevelopment
      ),
      timestampFormat: process.env.LOG_TIMESTAMP_FORMAT || 'HH:mm:ss.SSS',
      maxMessageLength: this.#getEnvNumber('LOG_MAX_MESSAGE_LENGTH', 200),
      showContext: this.#getEnvBoolean(
        'LOG_CONTEXT_PRETTY_PRINT',
        isDevelopment
      ),
      environment: env,
      forceEmoji: this.#getEnvBoolean('LOG_FORCE_EMOJI', false),
      disableEmoji: this.#getEnvBoolean('LOG_DISABLE_EMOJI', false),
    };
  }

  /**
   * Determine if colors should be enabled based on environment and TTY
   * @param {string} env - Current environment
   * @returns {boolean} Whether colors should be enabled
   * @private
   */
  #shouldEnableColors(env) {
    const colorMode = process.env.LOG_COLOR_MODE || 'auto';

    switch (colorMode) {
      case 'always':
        return true;
      case 'never':
        return false;
      case 'auto':
      default:
        // Auto mode: enable colors in development with TTY, disable in production
        return env !== 'production' && this.#isTTY;
    }
  }

  /**
   * Get boolean value from environment variable with default
   * @param {string} key - Environment variable key
   * @param {boolean} defaultValue - Default value if not set
   * @returns {boolean} The boolean value
   * @private
   */
  #getEnvBoolean(key, defaultValue) {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === 'true';
  }

  /**
   * Get number value from environment variable with default
   * @param {string} key - Environment variable key
   * @param {number} defaultValue - Default value if not set
   * @returns {number} The number value
   * @private
   */
  #getEnvNumber(key, defaultValue) {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * Get the current configuration
   * @returns {LoggerConfig} Current configuration
   */
  getConfig() {
    return { ...this.#config };
  }

  /**
   * Check if colors are enabled
   * @returns {boolean} Whether colors are enabled
   */
  isColorsEnabled() {
    return this.#config.enableColors;
  }

  /**
   * Check if icons are enabled
   * @returns {boolean} Whether icons are enabled
   */
  isIconsEnabled() {
    return this.#config.enableIcons;
  }

  /**
   * Check if pretty formatting is enabled
   * @returns {boolean} Whether pretty formatting is enabled
   */
  isPrettyFormatEnabled() {
    return this.#config.prettyFormat;
  }

  /**
   * Get timestamp format
   * @returns {string} Timestamp format string
   */
  getTimestampFormat() {
    return this.#config.timestampFormat;
  }

  /**
   * Get maximum message length
   * @returns {number} Maximum message length
   */
  getMaxMessageLength() {
    return this.#config.maxMessageLength;
  }

  /**
   * Check if context should be shown
   * @returns {boolean} Whether to show context objects
   */
  shouldShowContext() {
    return this.#config.showContext;
  }

  /**
   * Check if running in development mode
   * @returns {boolean} Whether in development mode
   */
  isDevelopment() {
    return this.#config.environment === 'development';
  }

  /**
   * Check if running in production mode
   * @returns {boolean} Whether in production mode
   */
  isProduction() {
    return this.#config.environment === 'production';
  }

  /**
   * Update configuration at runtime (for testing or dynamic changes)
   * @param {Partial<LoggerConfig>} updates - Configuration updates
   */
  updateConfig(updates) {
    this.#config = { ...this.#config, ...updates };
  }
}

// Export singleton instance
let configInstance = null;

/**
 * Get the singleton logger configuration instance
 * @returns {LoggerConfiguration} The configuration instance
 */
export function getLoggerConfiguration() {
  if (!configInstance) {
    configInstance = new LoggerConfiguration();
  }
  return configInstance;
}

export default LoggerConfiguration;
