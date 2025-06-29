// src/llms/services/LlmConfigCache.js
// --- FILE START ---

/**
 * @file Manages in-memory storage for LLM configurations.
 */

/**
 * @typedef {import('../llmConfigService.js').LLMConfig} LLMConfig
 */

/**
 * @class LlmConfigCache
 * @description Simple cache for storing and retrieving LLM configuration objects.
 */
export class LlmConfigCache {
  /**
   * @type {Map<string, LLMConfig>}
   * @private
   */
  #cache = new Map();

  /**
   * Adds or updates configurations in the cache.
   *
   * @param {LLMConfig[]} configs - Array of configs to add or update.
   * @returns {void}
   */
  addOrUpdateConfigs(configs = []) {
    if (!Array.isArray(configs)) return;
    for (const cfg of configs) {
      if (cfg && typeof cfg.configId === 'string') {
        this.#cache.set(cfg.configId, { ...cfg });
      }
    }
  }

  /**
   * Retrieves a configuration by its ID.
   *
   * @param {string} id - Config identifier.
   * @returns {LLMConfig | undefined} The configuration or undefined.
   */
  getConfig(id) {
    const cfg = this.#cache.get(id);
    return cfg ? { ...cfg } : undefined;
  }

  /**
   * Clears all cached configurations.
   *
   * @returns {void}
   */
  resetCache() {
    this.#cache.clear();
  }

  /**
   * Exposes the underlying cache for internal consumers.
   *
   * @returns {Map<string, LLMConfig>}
   */
  getCache() {
    return this.#cache;
  }
}

// --- FILE END ---
