/**
 * @file Client service for mod discovery via backend API
 * @see llm-proxy-server/src/services/modScannerService.js
 */

/**
 * @typedef {Object} ModDependency
 * @property {string} id - Dependency mod ID
 * @property {string} version - SemVer version range required
 */

/**
 * @typedef {Object} ModMetadata
 * @property {string} id - Mod identifier
 * @property {string} name - Display name
 * @property {string} version - SemVer version
 * @property {string} description - Mod description
 * @property {string} author - Mod author
 * @property {ModDependency[]} dependencies - Required mods
 * @property {string[]} conflicts - Conflicting mod IDs
 * @property {boolean} hasWorlds - Whether mod contains worlds
 * @property {{backgroundColor: string, textColor: string}|null} actionVisual - Visual styling from first action
 */

/**
 * @typedef {Object} ModDiscoveryResponse
 * @property {boolean} success
 * @property {ModMetadata[]} mods
 * @property {number} count
 * @property {string} scannedAt
 * @property {string} [message] - Error message when success is false
 */

/**
 * @typedef {Object} ILogger
 * @property {function(string, ...any): void} debug - Debug level logging
 * @property {function(string, ...any): void} info - Info level logging
 * @property {function(string, ...any): void} warn - Warning level logging
 * @property {function(string, ...any): void} error - Error level logging
 */


/**
 * Custom error for mod discovery failures
 */
export class ModDiscoveryError extends Error {
  /**
   * @param {string} message
   * @param {Error} [cause]
   */
  constructor(message, cause) {
    super(message);
    this.name = 'ModDiscoveryError';
    this.cause = cause;
  }
}

/**
 * Service for discovering available mods via backend API
 */
export class ModDiscoveryService {
  /** @type {ILogger} */
  #logger;
  /** @type {string} */
  #apiBaseUrl;
  /** @type {ModMetadata[]|null} */
  #cache;
  /** @type {number} */
  #cacheTimestamp;
  /** @type {number} */
  #cacheDuration;

  /**
   * @param {Object} options
   * @param {ILogger} options.logger - Logger instance
   * @param {string} [options.apiBaseUrl] - Base URL for API (default: from env)
   * @param {number} [options.cacheDuration] - Cache duration in ms (default: 60000)
   */
  constructor({ logger, apiBaseUrl, cacheDuration = 60000 }) {
    if (!logger) {
      throw new Error('ModDiscoveryService: logger is required');
    }
    this.#logger = logger;
    this.#apiBaseUrl = apiBaseUrl || this.#getDefaultApiUrl();
    this.#cache = null;
    this.#cacheTimestamp = 0;
    this.#cacheDuration = cacheDuration;
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
   * Fetch all available mods from the backend
   * @param {Object} [options]
   * @param {boolean} [options.bypassCache=false] - Skip cache and fetch fresh
   * @returns {Promise<ModMetadata[]>}
   */
  async discoverMods({ bypassCache = false } = {}) {
    // Check cache first
    if (!bypassCache && this.#isCacheValid()) {
      this.#logger.debug('Returning cached mods');
      return this.#cache;
    }

    this.#logger.info('Fetching mods from API...');

    try {
      const response = await fetch(`${this.#apiBaseUrl}/api/mods`);

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      /** @type {ModDiscoveryResponse} */
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'API returned unsuccessful response');
      }

      // Update cache
      this.#cache = data.mods;
      this.#cacheTimestamp = Date.now();

      this.#logger.info(`Discovered ${data.count} mods`);
      return data.mods;
    } catch (/** @type {any} */ error) {
      this.#logger.error('Failed to discover mods', error);
      throw new ModDiscoveryError(
        `Failed to fetch mods: ${error.message}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get a specific mod by ID
   * @param {string} modId - Mod identifier
   * @returns {Promise<ModMetadata|null>}
   */
  async getModById(modId) {
    const mods = await this.discoverMods();
    return mods.find((mod) => mod.id === modId) || null;
  }

  /**
   * Get mods that have worlds
   * @returns {Promise<ModMetadata[]>}
   */
  async getModsWithWorlds() {
    const mods = await this.discoverMods();
    return mods.filter((mod) => mod.hasWorlds);
  }

  /**
   * Clear the cache to force fresh fetch
   */
  clearCache() {
    this.#cache = null;
    this.#cacheTimestamp = 0;
    this.#logger.debug('Cache cleared');
  }

  /**
   * Check if cache is still valid
   * @returns {boolean}
   */
  #isCacheValid() {
    if (!this.#cache) return false;
    return Date.now() - this.#cacheTimestamp < this.#cacheDuration;
  }
}

export default ModDiscoveryService;
