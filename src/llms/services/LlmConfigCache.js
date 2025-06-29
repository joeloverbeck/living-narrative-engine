/**
 * @file Provides a simple in-memory cache for LLM configurations.
 */

/**
 * @typedef {object} LLMConfig
 * @property {string} configId
 * @property {string} modelIdentifier
 * @property {Array<object>} promptElements
 * @property {string[]} promptAssemblyOrder
 */

/**
 * @typedef {object} ILogger
 * @property {(message: string, ...args: any[]) => void} info
 * @property {(message: string, ...args: any[]) => void} warn
 * @property {(message: string, ...args: any[]) => void} error
 * @property {(message: string, ...args: any[]) => void} debug
 */

/**
 * @class LlmConfigCache
 * @description Manages an in-memory collection of LLM configuration objects.
 */
export class LlmConfigCache {
  #cache = new Map();
  #logger;

  /**
   * @param {object} [options]
   * @param {ILogger} [options.logger] - Logger instance used for debug output.
   */
  constructor(options = {}) {
    this.#logger = options.logger || console;
  }

  #isValidConfig(config) {
    if (!config || typeof config !== 'object') {
      this.#logger.debug(
        'LlmConfigCache.#isValidConfig: Config is null or not an object.'
      );
      return false;
    }
    if (typeof config.configId !== 'string' || config.configId.trim() === '') {
      this.#logger.debug(
        'LlmConfigCache.#isValidConfig: Missing or empty configId.',
        { config }
      );
      return false;
    }
    if (
      typeof config.modelIdentifier !== 'string' ||
      config.modelIdentifier.trim() === ''
    ) {
      this.#logger.debug(
        'LlmConfigCache.#isValidConfig: Missing or empty modelIdentifier.',
        { config }
      );
      return false;
    }
    if (!Array.isArray(config.promptElements)) {
      this.#logger.debug(
        'LlmConfigCache.#isValidConfig: promptElements is not an array.',
        { config }
      );
      return false;
    }
    if (!Array.isArray(config.promptAssemblyOrder)) {
      this.#logger.debug(
        'LlmConfigCache.#isValidConfig: promptAssemblyOrder is not an array.',
        { config }
      );
      return false;
    }
    if (
      config.promptElements.some(
        (el) =>
          typeof el !== 'object' || el === null || typeof el.key !== 'string'
      )
    ) {
      this.#logger.debug(
        'LlmConfigCache.#isValidConfig: One or more promptElements are invalid (not an object or missing key).',
        { configId: config.configId }
      );
      return false;
    }
    if (config.promptAssemblyOrder.some((key) => typeof key !== 'string')) {
      this.#logger.debug(
        'LlmConfigCache.#isValidConfig: One or more keys in promptAssemblyOrder are not strings.',
        { configId: config.configId }
      );
      return false;
    }
    return true;
  }

  /**
   * Adds or updates configurations in the cache.
   *
   * @param {LLMConfig[]} configs
   * @param {boolean} [isInitialLoad]
   * @returns {{added: number, updated: number, skipped: number}}
   */
  addOrUpdateConfigs(configs, isInitialLoad = false) {
    if (!Array.isArray(configs)) {
      this.#logger.error(
        'LlmConfigCache.addOrUpdateConfigs: Input must be an array of LLMConfig objects.'
      );
      return { added: 0, updated: 0, skipped: configs ? 1 : 0 };
    }

    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const config of configs) {
      if (this.#isValidConfig(config)) {
        if (this.#cache.has(config.configId)) {
          updatedCount++;
        } else {
          addedCount++;
        }
        this.#cache.set(config.configId, { ...config });
        this.#logger.debug(
          `LlmConfigCache.addOrUpdateConfigs: Successfully added/updated config: ${config.configId}`
        );
      } else {
        skippedCount++;
        this.#logger.warn(
          `LlmConfigCache.addOrUpdateConfigs: Skipping invalid configuration object.`,
          { configAttempted: config }
        );
      }
    }

    if (addedCount > 0 || updatedCount > 0) {
      this.#logger.debug(
        `LlmConfigCache.addOrUpdateConfigs: Processed ${configs.length} configs: ${addedCount} added, ${updatedCount} updated, ${skippedCount} skipped.`
      );
    } else if (skippedCount > 0) {
      this.#logger.warn(
        `LlmConfigCache.addOrUpdateConfigs: Processed ${configs.length} configs: All were skipped due to validation errors.`
      );
    } else {
      this.#logger.debug(
        `LlmConfigCache.addOrUpdateConfigs: No new or valid configurations to add/update from the provided array (length ${configs.length}).`
      );
    }

    return { added: addedCount, updated: updatedCount, skipped: skippedCount };
  }

  /**
   * Retrieves a configuration from the cache using configId or modelIdentifier.
   *
   * @param {string} llmId
   * @returns {LLMConfig | undefined}
   */
  getConfig(llmId) {
    if (!llmId || typeof llmId !== 'string' || llmId.trim() === '') {
      this.#logger.error(
        'LlmConfigCache.getConfig: llmId must be a non-empty string.',
        { llmIdAttempted: llmId }
      );
      return undefined;
    }

    if (this.#cache.has(llmId)) {
      this.#logger.debug(
        `LlmConfigCache.getConfig: Found configuration by direct configId match for "${llmId}".`
      );
      return { ...this.#cache.get(llmId) };
    }

    let exactModelMatchConfig;
    let bestWildcardMatchConfig;
    let longestWildcardPrefixLength = -1;

    for (const config of this.#cache.values()) {
      if (config.modelIdentifier === llmId) {
        if (!exactModelMatchConfig) {
          exactModelMatchConfig = config;
          this.#logger.debug(
            `LlmConfigCache.getConfig: Found potential exact modelIdentifier match for "${llmId}". ConfigId: "${config.configId}".`
          );
        }
      }
      if (config.modelIdentifier && config.modelIdentifier.endsWith('*')) {
        const wildcardPrefix = config.modelIdentifier.slice(0, -1);
        if (llmId.startsWith(wildcardPrefix)) {
          if (wildcardPrefix.length > longestWildcardPrefixLength) {
            longestWildcardPrefixLength = wildcardPrefix.length;
            bestWildcardMatchConfig = config;
            this.#logger.debug(
              `LlmConfigCache.getConfig: Found new best wildcard modelIdentifier match for "${llmId}". Pattern: "${config.modelIdentifier}", ConfigId: "${config.configId}".`
            );
          } else if (
            wildcardPrefix.length === longestWildcardPrefixLength &&
            bestWildcardMatchConfig
          ) {
            this.#logger.debug(
              `LlmConfigCache.getConfig: Found another wildcard modelIdentifier match with same prefix length for "${llmId}". Pattern: "${config.modelIdentifier}", ConfigId: "${config.configId}". Current best: "${bestWildcardMatchConfig.configId}".`
            );
          }
        }
      }
    }

    if (exactModelMatchConfig) {
      this.#logger.debug(
        `LlmConfigCache.getConfig: Selected configuration by exact modelIdentifier match for "${llmId}". ConfigId: "${exactModelMatchConfig.configId}".`
      );
      return { ...exactModelMatchConfig };
    }

    if (bestWildcardMatchConfig) {
      this.#logger.debug(
        `LlmConfigCache.getConfig: Selected configuration by wildcard modelIdentifier match for "${llmId}". Pattern: "${bestWildcardMatchConfig.modelIdentifier}", ConfigId: "${bestWildcardMatchConfig.configId}".`
      );
      return { ...bestWildcardMatchConfig };
    }

    this.#logger.warn(
      `LlmConfigCache.getConfig: No configuration found for identifier "${llmId}" after checking configId, exact modelIdentifier, and wildcard modelIdentifier.`
    );
    return undefined;
  }

  /**
   * Clears the cache.
   */
  resetCache() {
    this.#cache.clear();
  }

  /**
   * Returns the internal cache map. Intended for testing only.
   *
   * @returns {Map<string, LLMConfig>}
   */
  getCache() {
    return this.#cache;
  }
}

export default LlmConfigCache;
