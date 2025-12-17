/**
 * @file Client service for persisting game configuration via backend API
 * @see llm-proxy-server/src/handlers/gameConfigController.js
 */

/**
 * @typedef {Object} GameConfig
 * @property {string[]} mods - Array of mod IDs
 * @property {string} startWorld - World ID in format modId:worldId
 */

/**
 * @typedef {Object} SaveResult
 * @property {boolean} success
 * @property {string} message
 * @property {GameConfig} [config]
 * @property {string} [error]
 */

/**
 * @typedef {Object} ILogger
 * @property {function(string, ...any): void} debug - Debug level logging
 * @property {function(string, ...any): void} info - Info level logging
 * @property {function(string, ...any): void} warn - Warning level logging
 * @property {function(string, ...any): void} error - Error level logging
 */

/**
 * Custom error for config persistence failures
 */
export class ConfigPersistenceError extends Error {
  /**
   * @param {string} message
   * @param {Error} [cause]
   */
  constructor(message, cause) {
    super(message);
    this.name = 'ConfigPersistenceError';
    this.cause = cause;
  }
}

/**
 * Service for loading and saving game configuration
 */
export class ConfigPersistenceService {
  /** @type {ILogger} */
  #logger;
  /** @type {string} */
  #apiBaseUrl;
  /** @type {AbortController|null} */
  #pendingSave;

  /**
   * @param {Object} options
   * @param {ILogger} options.logger - Logger instance
   * @param {string} [options.apiBaseUrl] - Base URL for API
   */
  constructor({ logger, apiBaseUrl }) {
    if (!logger) {
      throw new Error('ConfigPersistenceService: logger is required');
    }
    this.#logger = logger;
    this.#apiBaseUrl = apiBaseUrl || this.#getDefaultApiUrl();
    this.#pendingSave = null;
  }

  /**
   * Get default API URL from build-time environment variables
   * @returns {string}
   */
  #getDefaultApiUrl() {
    // These globals are injected by esbuild from build.config.js
    /* eslint-disable no-undef */
    const host =
      typeof __PROXY_HOST__ !== 'undefined' ? __PROXY_HOST__ : 'localhost';
    const port =
      typeof __PROXY_PORT__ !== 'undefined' ? __PROXY_PORT__ : '3001';
    const useHttps =
      typeof __PROXY_USE_HTTPS__ !== 'undefined'
        ? __PROXY_USE_HTTPS__ === 'true'
        : false;
    /* eslint-enable no-undef */
    const protocol = useHttps ? 'https' : 'http';
    return `${protocol}://${host}:${port}`;
  }

  /**
   * Load current game configuration from backend
   * @returns {Promise<GameConfig>}
   */
  async loadConfig() {
    this.#logger.info('Loading current game configuration...');

    try {
      const response = await fetch(
        `${this.#apiBaseUrl}/api/game-config/current`
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to load configuration');
      }

      this.#logger.info(
        `Loaded config: ${data.config.mods.length} mods, world: ${data.config.startWorld}`
      );
      return data.config;
    } catch (/** @type {any} */ error) {
      this.#logger.error('Failed to load configuration', error);
      throw new ConfigPersistenceError(
        `Failed to load config: ${error.message}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Save game configuration to backend
   * @param {GameConfig} config - Configuration to save
   * @returns {Promise<SaveResult>}
   */
  async saveConfig(config) {
    // Validate before sending
    const validation = this.#validateConfig(config);
    if (!validation.valid) {
      return {
        success: false,
        message: validation.error,
        error: validation.error,
      };
    }

    this.#logger.info('Saving game configuration...', {
      modCount: config.mods.length,
      startWorld: config.startWorld,
    });

    // Cancel any pending save
    if (this.#pendingSave) {
      this.#pendingSave.abort();
    }

    const controller = new AbortController();
    this.#pendingSave = controller;

    try {
      const response = await fetch(
        `${this.#apiBaseUrl}/api/game-config/save`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(config),
          signal: controller.signal,
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        const errorMsg = data.message || `API error: ${response.status}`;
        this.#logger.error('Save failed', { error: errorMsg });
        return {
          success: false,
          message: errorMsg,
          error: errorMsg,
        };
      }

      this.#logger.info('Configuration saved successfully');
      return {
        success: true,
        message: data.message || 'Configuration saved successfully',
        config: data.config,
      };
    } catch (/** @type {any} */ error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          message: 'Save cancelled',
          error: 'Save cancelled',
        };
      }

      this.#logger.error('Failed to save configuration', error);
      return {
        success: false,
        message: `Failed to save: ${error.message}`,
        error: error.message,
      };
    } finally {
      this.#pendingSave = null;
    }
  }

  /**
   * Validate configuration before saving
   * @param {GameConfig} config
   * @returns {{valid: boolean, error?: string}}
   */
  #validateConfig(config) {
    if (!config) {
      return { valid: false, error: 'Configuration is required' };
    }

    if (!config.mods || !Array.isArray(config.mods)) {
      return { valid: false, error: 'Mods must be an array' };
    }

    if (config.mods.length === 0) {
      return { valid: false, error: 'At least one mod must be selected' };
    }

    if (!config.mods.every((m) => typeof m === 'string' && m.length > 0)) {
      return { valid: false, error: 'All mod IDs must be non-empty strings' };
    }

    if (!config.startWorld || typeof config.startWorld !== 'string') {
      return { valid: false, error: 'Start world must be selected' };
    }

    if (!config.startWorld.includes(':')) {
      return {
        valid: false,
        error: 'Start world must be in format modId:worldId',
      };
    }

    return { valid: true };
  }

  /**
   * Check if a save is currently in progress
   * @returns {boolean}
   */
  isSaving() {
    return this.#pendingSave !== null;
  }

  /**
   * Cancel any pending save operation
   */
  cancelPendingSave() {
    if (this.#pendingSave) {
      this.#pendingSave.abort();
      this.#pendingSave = null;
      this.#logger.debug('Pending save cancelled');
    }
  }

  /**
   * Check if configuration has changed from saved state
   * @param {GameConfig} current - Current UI state
   * @param {GameConfig} saved - Last saved state
   * @returns {boolean}
   */
  hasChanges(current, saved) {
    if (!saved) return true;
    if (current.startWorld !== saved.startWorld) return true;
    if (current.mods.length !== saved.mods.length) return true;

    const sortedCurrent = [...current.mods].sort();
    const sortedSaved = [...saved.mods].sort();
    return !sortedCurrent.every((m, i) => m === sortedSaved[i]);
  }
}

export default ConfigPersistenceService;
