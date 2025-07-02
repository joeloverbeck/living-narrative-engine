// src/llms/services/LlmConfigCache.js
// --- FILE START ---

/**
 * @file Provides a simple in-memory cache for LLM configuration objects.
 */

import { isNonBlankString } from '../../utils/textUtils.js';

/**
 * @typedef {object} LLMConfig
 * @description Represents the structure of a single LLM configuration object.
 * This mirrors the minimal fields used by {@link LlmConfigCache}.
 * @property {string} configId - Unique identifier for the configuration.
 * @property {string} modelIdentifier - Identifier for the LLM or model family.
 * @property {Array<object>} promptElements - Array describing prompt parts.
 * @property {string[]} promptAssemblyOrder - Ordered list of prompt element keys.
 */

/**
 * @class LlmConfigCache
 * @description In-memory cache for validated LLM configuration objects.
 * It allows adding/updating configs, retrieving them, and clearing the cache.
 */
export class LlmConfigCache {
  /**
   * Internal map storing configurations keyed by configId.
   *
   * @private
   * @type {Map<string, LLMConfig>}
   */
  #cache = new Map();

  /**
   * Adds or updates configuration objects in the cache.
   * Only configurations passing validation are stored.
   *
   * @param {LLMConfig[]} configs - Array of configuration objects to store.
   * @returns {void}
   */
  addOrUpdateConfigs(configs) {
    if (!Array.isArray(configs)) {
      return;
    }

    for (const cfg of configs) {
      if (this.#isValidConfig(cfg)) {
        this.#cache.set(cfg.configId, { ...cfg });
      }
    }
  }

  /**
   * Retrieves a configuration by its identifier.
   *
   * @param {string} configId - Identifier of the configuration to retrieve.
   * @returns {LLMConfig | undefined} A shallow copy of the configuration if found.
   */
  getConfig(configId) {
    if (!isNonBlankString(configId)) {
      return undefined;
    }
    const cfg = this.#cache.get(configId);
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
   * Validates that the provided object conforms to the minimal LLMConfig shape.
   *
   * @private
   * @param {any} config - The configuration object to validate.
   * @returns {boolean} True if the configuration appears valid.
   */
  #isValidConfig(config) {
    return (
      config &&
      isNonBlankString(config.configId) &&
      isNonBlankString(config.modelIdentifier) &&
      Array.isArray(config.promptElements) &&
      Array.isArray(config.promptAssemblyOrder)
    );
  }
}

// --- FILE END ---
