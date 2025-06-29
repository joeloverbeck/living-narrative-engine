// src/services/llmConfigService.js
// --- FILE START ---

/**
 * @file Defines the LLMConfigService for centralized LLM configuration management.
 */

/**
 * @typedef {import('./services/llmConfigLoader.js').LlmConfigLoader} LlmConfigLoader
 */

/**
 * @typedef {import('./services/LlmConfigCache.js').LlmConfigCache} LlmConfigCache
 */

/**
 * @typedef {object} LLMConfig
 * @description Represents the structure of a single LLM configuration object.
 * This mirrors the definition used in PromptBuilder and expected from the configuration source.
 * @property {string} configId - A unique identifier for this specific configuration (e.g., "claude_default_v1").
 * @property {string} modelIdentifier - The identifier of the LLM or LLM family this configuration applies to.
 * Can be an exact match (e.g., "anthropic/claude-3-sonnet-20240229")
 * or a wildcard pattern (e.g., "anthropic/*", "openai/gpt-4*").
 * @property {Array<object>} promptElements - An array defining the constituent parts of the prompt.
 * (Detailed structure of PromptElement is not strictly validated by LLMConfigService itself beyond existence).
 * @property {string[]} promptAssemblyOrder - An array of keys from `promptElements`, specifying the order.
 * @property {string} [displayName] - A user-friendly name for this configuration.
 * @property {string} [endpointUrl] - The base API endpoint URL.
 * @property {string} [apiType] - Identifier for the API type (e.g., 'openrouter').
 * // ... other properties as defined in llm-configs.schema.json under definitions.llmConfiguration.properties
 */

/**
 * @typedef {object} ILogger
 * @description A simple logger interface.
 * @property {(message: string, ...args: any[]) => void} info - Logs informational messages.
 * @property {(message: string, ...args: any[]) => void} warn - Logs warning messages.
 * @property {(message: string, ...args: any[]) => void} error - Logs error messages.
 * @property {(message: string, ...args: any[]) => void} debug - Logs debug messages.
 */

/**
 * @class LLMConfigService
 * @description Manages LLM configuration retrieval and selection. Configuration
 * data is loaded through a {@link LlmConfigLoader} instance and cached via
 * {@link LlmConfigCache}.
 */
export class LLMConfigService {
  /**
   * @private
   * @type {LlmConfigLoader}
   * @description Loader used to fetch and validate configuration data.
   */
  #loader;

  /**
   * @private
   * @type {LlmConfigCache}
   * @description Cache instance for storing configurations.
   */
  #cache;

  /**
   * @private
   * @type {ILogger}
   * @description Logger instance.
   */
  #logger;

  /**
   * @private
   * @type {string | undefined}
   * @description Identifier for the configuration source (e.g., file path or URL).
   */
  #configSourceIdentifier;

  /**
   * @private
   * @type {boolean}
   * @description Flag to indicate if configurations have been loaded or an attempt was made.
   */
  #configsLoadedOrAttempted = false;

  /**
   * Creates an instance of LLMConfigService.
   *
   * @param {object} options - The options for the LLMConfigService.
   * @param {LlmConfigLoader} options.loader - Loader used to fetch configurations.
   * @param {LlmConfigCache} options.cache - Cache instance for storing configurations.
   * @param {ILogger} options.logger - An ILogger instance for logging.
   * @param {string} [options.configSourceIdentifier] - Optional identifier for the configuration source.
   * @param {LLMConfig[]} [options.initialConfigs] - Optional array of LLM configurations to preload.
   */
  constructor(options) {
    if (!options || !options.loader || !options.cache || !options.logger) {
      const errorMsg =
        'LLMConfigService: loader, cache and logger are required options.';
      const logger = options && options.logger ? options.logger : console;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }
    this.#loader = options.loader;
    this.#cache = options.cache;
    this.#logger = options.logger;
    this.#configSourceIdentifier = options.configSourceIdentifier;

    this.#logger.debug('LLMConfigService: Initializing...');

    if (options.initialConfigs) {
      if (
        Array.isArray(options.initialConfigs) &&
        options.initialConfigs.length > 0
      ) {
        this.#logger.debug(
          `LLMConfigService: Processing ${options.initialConfigs.length} initial configurations.`
        );
        this.addOrUpdateConfigs(options.initialConfigs, true); // Pass true to indicate these are initial
        if (this.#cache.getCache().size > 0) {
          this.#configsLoadedOrAttempted = true; // Mark as attempted if initial configs were successfully loaded
          this.#logger.debug(
            `LLMConfigService: Successfully loaded ${this.#cache.getCache().size} initial configurations into cache.`
          );
        } else {
          this.#logger.warn(
            `LLMConfigService: Initial configurations provided, but none were valid or loaded.`
          );
        }
      } else if (
        Array.isArray(options.initialConfigs) &&
        options.initialConfigs.length === 0
      ) {
        this.#logger.debug(
          'LLMConfigService: Empty array provided for initialConfigs. No initial configurations loaded.'
        );
      } else if (!Array.isArray(options.initialConfigs)) {
        this.#logger.warn(
          'LLMConfigService: initialConfigs was provided but is not an array. Ignoring.'
        );
      }
    }

    if (this.#configSourceIdentifier) {
      this.#logger.debug(
        `LLMConfigService: Configuration source identifier set to: ${this.#configSourceIdentifier}. Configurations will be loaded on demand.`
      );
    } else if (!this.#configsLoadedOrAttempted) {
      // Only log if no initial configs and no source ID
      this.#logger.debug(
        'LLMConfigService: No configuration source identifier provided and no initial configs loaded. Service will rely on programmatic additions.'
      );
    }
    this.#logger.debug('LLMConfigService: Initialization complete.');
  }

  /**
   * Validates the basic structure of an individual LLMConfig object.
   *
   * @private
   * @param {any} config - The configuration object to validate.
   * @returns {boolean} True if the dependencyInjection is valid, false otherwise.
   */
  #isValidConfig(config) {
    if (!config || typeof config !== 'object') {
      this.#logger.debug(
        'LLMConfigService.#isValidConfig: Config is null or not an object.'
      );
      return false;
    }
    if (typeof config.configId !== 'string' || config.configId.trim() === '') {
      this.#logger.debug(
        'LLMConfigService.#isValidConfig: Missing or empty configId.',
        { config }
      );
      return false;
    }
    if (
      typeof config.modelIdentifier !== 'string' ||
      config.modelIdentifier.trim() === ''
    ) {
      this.#logger.debug(
        'LLMConfigService.#isValidConfig: Missing or empty modelIdentifier.',
        { config }
      );
      return false;
    }
    if (!Array.isArray(config.promptElements)) {
      this.#logger.debug(
        'LLMConfigService.#isValidConfig: promptElements is not an array.',
        { config }
      );
      return false;
    }
    if (!Array.isArray(config.promptAssemblyOrder)) {
      this.#logger.debug(
        'LLMConfigService.#isValidConfig: promptAssemblyOrder is not an array.',
        { config }
      );
      return false;
    }
    // Basic check for promptElements content, can be expanded
    if (
      config.promptElements.some(
        (el) =>
          typeof el !== 'object' || el === null || typeof el.key !== 'string'
      )
    ) {
      this.#logger.debug(
        'LLMConfigService.#isValidConfig: One or more promptElements are invalid (not an object or missing key).',
        { configId: config.configId }
      );
      return false;
    }
    // Basic check for promptAssemblyOrder content
    if (config.promptAssemblyOrder.some((key) => typeof key !== 'string')) {
      this.#logger.debug(
        'LLMConfigService.#isValidConfig: One or more keys in promptAssemblyOrder are not strings.',
        { configId: config.configId }
      );
      return false;
    }

    return true;
  }

  /**
   * Adds or updates configurations in the cache.
   * Validates each configuration before adding.
   *
   * @param {LLMConfig[]} configs - An array of LLMConfig objects to add or update.
   * @param {boolean} [isInitialLoad] - Internal flag to adjust behavior for constructor loading.
   * @returns {void}
   * @public
   */
  addOrUpdateConfigs(configs, isInitialLoad = false) {
    if (!Array.isArray(configs)) {
      this.#logger.error(
        'LLMConfigService.addOrUpdateConfigs: Input must be an array of LLMConfig objects.'
      );
      return;
    }

    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const config of configs) {
      if (this.#isValidConfig(config)) {
        if (this.#cache.getCache().has(config.configId)) {
          updatedCount++;
        } else {
          addedCount++;
        }
        this.#cache.addOrUpdateConfigs([config]);
        this.#logger.debug(
          `LLMConfigService.addOrUpdateConfigs: Successfully added/updated config: ${config.configId}`
        );
      } else {
        skippedCount++;
        this.#logger.warn(
          `LLMConfigService.addOrUpdateConfigs: Skipping invalid configuration object.`,
          { configAttempted: config }
        );
      }
    }

    if (addedCount > 0 || updatedCount > 0) {
      this.#logger.debug(
        `LLMConfigService.addOrUpdateConfigs: Processed ${configs.length} configs: ${addedCount} added, ${updatedCount} updated, ${skippedCount} skipped.`
      );
    } else if (skippedCount > 0) {
      this.#logger.warn(
        `LLMConfigService.addOrUpdateConfigs: Processed ${configs.length} configs: All were skipped due to validation errors.`
      );
    } else {
      this.#logger.debug(
        `LLMConfigService.addOrUpdateConfigs: No new or valid configurations to add/update from the provided array (length ${configs.length}).`
      );
    }

    if (
      !isInitialLoad &&
      (addedCount > 0 || updatedCount > 0) &&
      !this.#configsLoadedOrAttempted
    ) {
      if (this.#cache.getCache().size > 0) {
        this.#logger.debug(
          'LLMConfigService.addOrUpdateConfigs: Configurations added programmatically. Marking cache as "loaded/attempted" to potentially bypass source loading if not explicitly reset.'
        );
        this.#configsLoadedOrAttempted = true;
      }
    }
  }

  /**
   * Fetches configurations from the configured source using IConfigurationProvider,
   * validates them, and populates the internal cache.
   * Sets the #configsLoadedOrAttempted flag regardless of success or failure.
   *
   * @private
   * @async
   * @returns {Promise<void>}
   */
  async #loadAndCacheConfigurationsFromSource() {
    if (!this.#configSourceIdentifier) {
      this.#logger.warn(
        'LLMConfigService.#loadAndCacheConfigurationsFromSource: No configSourceIdentifier set. Cannot load configurations from source.'
      );
      this.#configsLoadedOrAttempted = true;
      return;
    }

    this.#logger.debug(
      `LLMConfigService: Attempting to load configurations from source: ${this.#configSourceIdentifier}`
    );

    try {
      const result = await this.#loader.loadConfigs(
        this.#configSourceIdentifier
      );
      if (result && !result.error) {
        const configsArray = Object.values(result.configs || {});
        this.#cache.resetCache();
        this.#cache.addOrUpdateConfigs(configsArray);
        this.#logger.debug(
          `LLMConfigService.#loadAndCacheConfigurationsFromSource: Successfully loaded and cached ${configsArray.length} configurations from ${this.#configSourceIdentifier}.`
        );
      } else {
        this.#cache.resetCache();
        this.#logger.error(
          `LLMConfigService.#loadAndCacheConfigurationsFromSource: ${result?.message || 'Unknown error loading configurations.'}`,
          { details: result }
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.#logger.error(
        `LLMConfigService.#loadAndCacheConfigurationsFromSource: Error loading configurations from ${this.#configSourceIdentifier}. Detail: ${message}`,
        { error }
      );
      this.#cache.resetCache();
    } finally {
      this.#configsLoadedOrAttempted = true;
      this.#logger.debug(
        `LLMConfigService.#loadAndCacheConfigurationsFromSource: Finished attempt to load from source. configsLoadedOrAttempted set to true.`
      );
    }
  }

  /**
   * Ensures that configurations are loaded into the cache if they haven't been already.
   * This method handles the logic to load configurations only once unless explicitly refreshed.
   * It considers if a source identifier is set or if initial configs were provided.
   *
   * @private
   * @async
   * @returns {Promise<void>}
   */
  async #ensureConfigsLoaded() {
    this.#logger.debug(
      'LLMConfigService.#ensureConfigsLoaded: Check triggered.'
    );
    if (this.#configsLoadedOrAttempted && this.#cache.getCache().size > 0) {
      this.#logger.debug(
        'LLMConfigService.#ensureConfigsLoaded: Configurations previously loaded and cache is populated. Skipping load.'
      );
      return;
    }

    if (this.#configsLoadedOrAttempted && this.#cache.getCache().size === 0) {
      if (this.#configSourceIdentifier) {
        this.#logger.debug(
          'LLMConfigService.#ensureConfigsLoaded: Load previously attempted from source, but cache is empty (e.g., load failed or source had no valid data). Not re-attempting automatically.'
        );
      } else {
        this.#logger.debug(
          'LLMConfigService.#ensureConfigsLoaded: Load previously marked as attempted (e.g. no initial configs, no source). Cache is empty. Nothing to load.'
        );
      }
      return;
    }

    if (!this.#configsLoadedOrAttempted) {
      this.#logger.debug(
        'LLMConfigService.#ensureConfigsLoaded: Configurations not yet loaded or attempted.'
      );
      if (this.#configSourceIdentifier) {
        this.#logger.debug(
          `LLMConfigService.#ensureConfigsLoaded: Source identifier "${this.#configSourceIdentifier}" is present. Attempting load.`
        );
        await this.#loadAndCacheConfigurationsFromSource();
      } else if (this.#cache.getCache().size === 0) {
        this.#logger.warn(
          'LLMConfigService.#ensureConfigsLoaded: No configSourceIdentifier set and no initial configurations were loaded. Cache is empty. Marking as loaded/attempted.'
        );
        this.#configsLoadedOrAttempted = true;
      } else {
        this.#logger.debug(
          'LLMConfigService.#ensureConfigsLoaded: Configurations not loaded from source, but cache has items (e.g. from initial configs). Marking as loaded/attempted.'
        );
        this.#configsLoadedOrAttempted = true;
      }
    } else {
      this.#logger.debug(
        'LLMConfigService.#ensureConfigsLoaded: Fallback - state is unexpected but indicates no load action needed now.'
      );
    }
  }

  /**
   * Retrieves a specific LLM configuration by its identifier (llmId).
   * It ensures configurations are loaded before attempting retrieval.
   * The selection logic prioritizes:
   * 1. Direct match by `configId`.
   * 2. Exact match by `modelIdentifier`.
   * 3. Wildcard match by `modelIdentifier` (longest prefix wins).
   *
   * @public
   * @async
   * @param {string} llmId - The identifier of the LLM configuration to retrieve.
   * This can be a `configId` or a `modelIdentifier`.
   * @returns {Promise<LLMConfig | undefined>} A promise that resolves to the found LLMConfig
   * or undefined if no matching configuration is found.
   */
  async getConfig(llmId) {
    await this.#ensureConfigsLoaded();

    if (typeof llmId !== 'string' || llmId.trim() === '') {
      this.#logger.error(
        'LLMConfigService.getConfig: llmId must be a non-empty string.',
        { llmIdAttempted: llmId }
      );
      return undefined;
    }

    this.#logger.debug(
      `LLMConfigService.getConfig: Searching for configuration with identifier: "${llmId}"`
    );

    if (this.#cache.getCache().size === 0) {
      this.#logger.warn(
        `LLMConfigService.getConfig: Cache is empty. Cannot find configuration for "${llmId}".`
      );
      return undefined;
    }

    // 1. Direct match by configId
    if (this.#cache.getCache().has(llmId)) {
      const config = this.#cache.getConfig(llmId);
      this.#logger.debug(
        `LLMConfigService.getConfig: Found configuration by direct configId match for "${llmId}". ConfigId: "${config.configId}".`
      );
      return { ...config }; // Return a copy
    }
    this.#logger.debug(
      `LLMConfigService.getConfig: No direct match for configId "${llmId}". Attempting modelIdentifier matching.`
    );

    // 2. Fallback to modelIdentifier matching (exact and wildcard)
    let exactModelMatchConfig = undefined;
    let bestWildcardMatchConfig = undefined;
    let longestWildcardPrefixLength = -1;

    for (const config of this.#cache.getCache().values()) {
      // Check for exact modelIdentifier match
      if (config.modelIdentifier === llmId) {
        if (!exactModelMatchConfig) {
          // First exact match wins
          exactModelMatchConfig = config;
          this.#logger.debug(
            `LLMConfigService.getConfig: Found potential exact modelIdentifier match for "${llmId}". ConfigId: "${config.configId}".`
          );
        } else {
          this.#logger.debug(
            `LLMConfigService.getConfig: Additional exact modelIdentifier match found for "${llmId}" (ConfigId: "${config.configId}"), but an earlier one ("${exactModelMatchConfig.configId}") is already selected.`
          );
        }
      }
      // Check for wildcard modelIdentifier match (e.g., "provider/*")
      if (config.modelIdentifier && config.modelIdentifier.endsWith('*')) {
        const wildcardPrefix = config.modelIdentifier.slice(0, -1);
        if (llmId.startsWith(wildcardPrefix)) {
          if (wildcardPrefix.length > longestWildcardPrefixLength) {
            longestWildcardPrefixLength = wildcardPrefix.length;
            bestWildcardMatchConfig = config;
            this.#logger.debug(
              `LLMConfigService.getConfig: Found new best wildcard modelIdentifier match for "${llmId}". Pattern: "${config.modelIdentifier}", ConfigId: "${config.configId}".`
            );
          } else if (
            wildcardPrefix.length === longestWildcardPrefixLength &&
            bestWildcardMatchConfig
          ) {
            this.#logger.debug(
              `LLMConfigService.getConfig: Found another wildcard modelIdentifier match with same prefix length for "${llmId}". Pattern: "${config.modelIdentifier}", ConfigId: "${config.configId}". Current best: "${bestWildcardMatchConfig.configId}". Keeping first one found with this length.`
            );
          }
        }
      }
    }

    if (exactModelMatchConfig) {
      this.#logger.debug(
        `LLMConfigService.getConfig: Selected configuration by exact modelIdentifier match for "${llmId}". ConfigId: "${exactModelMatchConfig.configId}".`
      );
      return { ...exactModelMatchConfig }; // Return a copy
    }

    if (bestWildcardMatchConfig) {
      this.#logger.debug(
        `LLMConfigService.getConfig: Selected configuration by wildcard modelIdentifier match for "${llmId}". Pattern: "${bestWildcardMatchConfig.modelIdentifier}", ConfigId: "${bestWildcardMatchConfig.configId}".`
      );
      return { ...bestWildcardMatchConfig }; // Return a copy
    }

    this.#logger.warn(
      `LLMConfigService.getConfig: No configuration found for identifier "${llmId}" after checking configId, exact modelIdentifier, and wildcard modelIdentifier.`
    );
    return undefined;
  }

  /**
   * Clears the internal LLM configurations cache and resets the loaded state flag.
   * This forces a fresh load from the source on the next getConfig call if a source is configured.
   *
   * @public
   * @returns {void}
   */
  resetCache() {
    this.#cache.resetCache();
    this.#configsLoadedOrAttempted = false;
    this.#logger.debug(
      'LLMConfigService: Cache cleared and loaded state reset. Configurations will be reloaded from source on next request if source is configured.'
    );
  }

  // --- Testing Utilities ---

  /**
   * Retrieves the internal LLM configurations cache.
   * NOTE: This method is intended for testing purposes only.
   * Modifying the returned map directly can lead to unpredictable behavior.
   *
   * @public
   * @returns {Map<string, LLMConfig>} The internal map of LLM configurations.
   */
  getLlmConfigsCacheForTest() {
    return this.#cache.getCache();
  }

  /**
   * Retrieves the internal flag indicating if configurations have been loaded or an attempt was made.
   * NOTE: This method is intended for testing purposes only.
   *
   * @public
   * @returns {boolean} The value of the #configsLoadedOrAttempted flag.
   */
  getConfigsLoadedOrAttemptedFlagForTest() {
    return this.#configsLoadedOrAttempted;
  }
}

// --- FILE END ---
