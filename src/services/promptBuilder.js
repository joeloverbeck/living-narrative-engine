// src/services/promptBuilder.js
// --- FILE START ---

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../types/llmConfigs.js').LLMConfig} LLMConfig
 * @typedef {import('../types/llmConfigs.js').PromptElement} PromptElement
 * @typedef {import('../types/promptData.js').PromptData} PromptData
 */

/**
 * @class PromptBuilder
 * @description Central engine for dynamically constructing LLM prompt strings.
 * It operates based on configurations loaded from llm-configs.json and runtime data
 * provided for each LLM interaction.
 * The PromptBuilder ensures consistency, adherence to defined prompt structures,
 * and abstracts the complexities of prompt formatting from the rest of the application logic.
 * A core principle is that the PromptBuilder must accept structured, semantic input via promptData,
 * rather than pre-formatted strings for individual prompt parts, allowing it to take full
 * ownership of all formatting and assembly processes.
 */
export class PromptBuilder {
    /**
     * @private
     * @type {Map<string, LLMConfig>}
     * @description Internal cache for storing loaded LLM configurations, keyed by config_id.
     * Each LLMConfig object contains the model_identifier used for selection.
     *
     */
    #llmConfigsCache = new Map();

    /**
     * @private
     * @type {ILogger | Console}
     * @description Logger instance. Defaults to console if no logger is provided.
     */
    #logger;

    /**
     * @private
     * @type {string | undefined}
     * @description Path to the llm-configs.json file.
     */
    #configFilePath;

    /**
     * @private
     * @type {boolean}
     * @description Flag to indicate if configurations have been loaded or an attempt was made.
     * Used to ensure configurations are loaded only once unless explicitly refreshed.
     */
    #configsLoadedOrAttempted = false;


    /**
     * Initializes a new instance of the PromptBuilder.
     * @param {object} [options={}] - The options for the PromptBuilder.
     * @param {ILogger} [options.logger=console] - An optional logger instance. Defaults to the console.
     * @param {LLMConfig[]} [options.initialConfigs=[]] - An optional array of LLM configurations to preload into the cache.
     * @param {string} [options.configFilePath] - Optional path to the `llm-configs.json` file to be loaded.
     */
    constructor(options = {}) {
        this.#logger = options.logger || console;
        this.#configFilePath = options.configFilePath;

        if (options.initialConfigs && Array.isArray(options.initialConfigs)) {
            this.addOrUpdateConfigs(options.initialConfigs);
            if (options.initialConfigs.length > 0) {
                this.#configsLoadedOrAttempted = true; // Mark as loaded if initial configs were provided
                this.#logger.info(`PromptBuilder initialized with ${this.#llmConfigsCache.size} preloaded configurations.`);
            }
        }

        if (!this.#configsLoadedOrAttempted) {
            this.#logger.info('PromptBuilder initialized. Configurations will be loaded from file on demand if configFilePath is set.');
        }
    }

    /**
     * Converts a snake_case string to camelCase.
     * Example: "system_prompt" -> "systemPrompt"
     * @private
     * @param {string} str - The string to convert.
     * @returns {string} The camelCased string.
     */
    #snakeToCamel(str) {
        if (!str) return '';
        return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
    }

    /**
     * Resolves placeholders (e.g., {placeholder_name}) in a string using data from one or more source objects.
     * Placeholders are searched in the order dataSources are provided.
     * If a placeholder is not found in any dataSource, it's replaced with an empty string and a warning is logged.
     * @private
     * @param {string} str - The string containing placeholders.
     * @param {...object} dataSources - Objects to source placeholder values from. For perception log entries,
     * this might be `entry` (the log entry itself) then `promptData` (global data).
     * @returns {string} The string with placeholders substituted.
     */
    #resolvePlaceholders(str, ...dataSources) {
        if (!str || typeof str !== 'string') return ''; // Ensure str is a non-empty string

        return str.replace(/{([^{}]+)}/g, (match, placeholderKey) => {
            const trimmedKey = placeholderKey.trim(); // Handle accidental spaces like { character_name }
            for (const dataSource of dataSources) {
                if (dataSource && typeof dataSource === 'object' && Object.prototype.hasOwnProperty.call(dataSource, trimmedKey)) {
                    const value = dataSource[trimmedKey];
                    // Return empty string for null/undefined, otherwise stringify the value.
                    return value !== null && value !== undefined ? String(value) : '';
                }
            }
            this.#logger.warn(`PromptBuilder.#resolvePlaceholders: Placeholder "{${trimmedKey}}" not found in provided data sources. Replacing with empty string.`);
            return ''; // Default strategy: replace with empty string
        });
    }


    /**
     * Fetches configurations from the specified file path and caches them.
     * This implements the primary loading mechanism from llm-configs.json.
     * @private
     * @returns {Promise<void>}
     */
    async #fetchAndCacheConfigurations() {
        if (!this.#configFilePath) {
            this.#logger.warn('PromptBuilder: configFilePath not set. Cannot load configurations from file.');
            this.#configsLoadedOrAttempted = true; // Mark as attempted to prevent re-attempts without a path
            return;
        }

        this.#logger.info(`PromptBuilder: Attempting to load configurations from ${this.#configFilePath}`);
        try {
            const response = await fetch(this.#configFilePath);
            if (!response.ok) {
                this.#logger.error(`PromptBuilder: Failed to fetch llm-configs.json from ${this.#configFilePath}. Status: ${response.status} ${response.statusText}`);
                throw new Error(`Failed to fetch configuration file: ${response.statusText}`); //
            }

            const configsArray = await response.json();

            if (!Array.isArray(configsArray)) {
                this.#logger.error('PromptBuilder: Loaded configuration data is not an array.', {data: configsArray});
                throw new Error('Configuration data must be an array.'); //
            }

            this.#llmConfigsCache.clear(); // Clear previous cache before loading new file configs
            let loadedCount = 0;
            for (const config of configsArray) {
                if (config && config.config_id && config.model_identifier && Array.isArray(config.prompt_elements) && Array.isArray(config.prompt_assembly_order)) {
                    this.#llmConfigsCache.set(config.config_id, config);
                    loadedCount++;
                } else {
                    this.#logger.warn('PromptBuilder: Skipping invalid or incomplete configuration object during file load.', {config});
                }
            }
            this.#configsLoadedOrAttempted = true;
            this.#logger.info(`PromptBuilder: Successfully loaded and cached ${loadedCount} configurations from ${this.#configFilePath}.`); //
        } catch (error) {
            this.#configsLoadedOrAttempted = true; // Mark as attempted even if failed, to prevent retry loops by default
            this.#logger.error('PromptBuilder: Error loading or parsing llm-configs.json.', {
                path: this.#configFilePath,
                error
            }); //
        }
    }

    /**
     * Ensures configurations are loaded if they haven't been already.
     * This is called on an as-needed basis, typically before building a prompt.
     * @private
     * @returns {Promise<void>}
     */
    async #ensureConfigsLoaded() {
        if (this.#configsLoadedOrAttempted && this.#llmConfigsCache.size > 0) {
            this.#logger.debug('PromptBuilder.#ensureConfigsLoaded: Configurations already loaded or load attempt was made and cache is not empty.');
            return;
        }
        if (this.#configsLoadedOrAttempted && this.#llmConfigsCache.size === 0 && this.#configFilePath) {
            this.#logger.debug('PromptBuilder.#ensureConfigsLoaded: Load attempt was made, but cache is empty. Re-attempting if filepath exists is currently disabled by load-once policy.');
        }


        if (!this.#configsLoadedOrAttempted) {
            if (this.#configFilePath) {
                await this.#fetchAndCacheConfigurations();
            } else if (this.#llmConfigsCache.size === 0) {
                this.#logger.warn('PromptBuilder.#ensureConfigsLoaded: No configFilePath set and no initial configurations loaded. PromptBuilder may not function correctly.');
                this.#configsLoadedOrAttempted = true;
            }
        }
    }


    /**
     * Assembles a final prompt string based on the provided LLM identifier and structured prompt data.
     * This method is the primary public interface for the PromptBuilder.
     *
     * @param {string} llmId - A string identifying the target LLM (e.g., "anthropic/claude-3-sonnet-20240229").
     * This ID is used to select the appropriate configuration.
     * @param {PromptData} promptData - A structured JavaScript object containing all necessary raw content parts
     * required to populate the prompt. Keys in this object are typically camelCase versions of prompt_elements keys
     * with a "Content" suffix (e.g., systemPromptContent for system_prompt key), or specific keys like `perceptionLogArray`.
     * It also contains flags for conditional prompt part inclusion (e.g. `enableChainOfThought`).
     * Placeholders in prefixes/suffixes are resolved using this object.
     * @returns {Promise<string>} The fully assembled prompt string, or an empty string if a prompt cannot be built.
     */
    async build(llmId, promptData) {
        this.#logger.info(`PromptBuilder.build called for llmId: ${llmId}`);

        await this.#ensureConfigsLoaded();

        if (this.#llmConfigsCache.size === 0) {
            this.#logger.error('PromptBuilder.build: No configurations available. Cannot build prompt.');
            return "";
        }

        if (!llmId || typeof llmId !== 'string') {
            this.#logger.error('PromptBuilder.build: llmId is required and must be a string.');
            return "";
        }
        if (!promptData || typeof promptData !== 'object' || promptData === null) {
            this.#logger.error('PromptBuilder.build: promptData is required and must be a non-null object.');
            return "";
        }

        const selectedConfig = this._findConfiguration(llmId);

        if (!selectedConfig) {
            this.#logger.error(`PromptBuilder.build: No configuration found for llmId "${llmId}". Cannot build prompt.`);
            return "";
        }
        this.#logger.debug(`PromptBuilder.build: Using configuration: ${selectedConfig.config_id} for llmId: ${llmId}`);

        let finalPromptString = "";
        const promptElementsMap = new Map(selectedConfig.prompt_elements.map(el => [el.key, el]));

        for (const key of selectedConfig.prompt_assembly_order) {
            const elementConfig = promptElementsMap.get(key);
            if (!elementConfig) {
                this.#logger.warn(`PromptBuilder.build: Key "${key}" from prompt_assembly_order not found in prompt_elements for config_id "${selectedConfig.config_id}". Skipping.`);
                continue;
            }

            // --- Conditional Inclusion Check (Ticket 2.6) ---
            // [cite: 424, 425]
            if (elementConfig.condition) {
                if (typeof elementConfig.condition.promptDataFlag !== 'string') {
                    this.#logger.warn(`PromptBuilder.build: Conditional part '${key}' has invalid 'promptDataFlag' in its condition. Skipping.`, {condition: elementConfig.condition});
                    continue;
                }
                const flagName = elementConfig.condition.promptDataFlag;
                const actualVal = promptData[flagName];

                let conditionMet = false;
                if (Object.prototype.hasOwnProperty.call(elementConfig.condition, 'expectedValue')) {
                    const expectedVal = elementConfig.condition.expectedValue;
                    if (actualVal === expectedVal) {
                        conditionMet = true;
                    } else {
                        this.#logger.debug(`PromptBuilder.build: Conditional part '${key}' condition not met. Flag '${flagName}' (value: ${actualVal}) did not match expected value (${expectedVal}). Skipping.`);
                    }
                } else { // If expectedValue is not defined, check for truthiness of the actual flag value
                    if (actualVal) {
                        conditionMet = true;
                    } else {
                        this.#logger.debug(`PromptBuilder.build: Conditional part '${key}' condition not met. Flag '${flagName}' is falsy (value: ${actualVal}) and no expectedValue was set. Skipping.`);
                    }
                }

                if (!conditionMet) {
                    continue; // Skip this element if its condition is not met
                }
                this.#logger.debug(`PromptBuilder.build: Conditional part '${key}' included. Condition on flag '${flagName}' passed.`);
            }


            // --- Special Handling for Perception Log (Ticket 2.5) ---
            if (key === 'perception_log_wrapper') {
                const perceptionLogArray = promptData.perceptionLogArray;

                // Gracefully omit the entire section if perceptionLogArray is not a non-empty array [cite: 410]
                if (perceptionLogArray && Array.isArray(perceptionLogArray) && perceptionLogArray.length > 0) {
                    let assembledLogEntries = "";
                    const perceptionLogEntryConfig = promptElementsMap.get('perception_log_entry');

                    if (!perceptionLogEntryConfig) {
                        this.#logger.warn(`PromptBuilder.build: Missing 'perception_log_entry' configuration for perception log assembly in config_id "${selectedConfig.config_id}". Perception log entries will not be formatted.`);
                    } else {
                        // Iterate through each entry in the perceptionLogArray
                        for (const entry of perceptionLogArray) {
                            if (typeof entry !== 'object' || entry === null) {
                                this.#logger.warn(`PromptBuilder.build: Invalid perception log entry in perceptionLogArray. Expected object, got ${typeof entry}. Skipping entry.`, {entry});
                                continue;
                            }
                            const entryContent = (entry.content !== null && entry.content !== undefined) ? String(entry.content) : '';

                            const resolvedEntryPrefix = this.#resolvePlaceholders(perceptionLogEntryConfig.prefix, entry, promptData);
                            const resolvedEntrySuffix = this.#resolvePlaceholders(perceptionLogEntryConfig.suffix, entry, promptData);

                            assembledLogEntries += `${resolvedEntryPrefix}${entryContent}${resolvedEntrySuffix}`;
                        }
                    }

                    if (assembledLogEntries || (perceptionLogEntryConfig && perceptionLogArray.length > 0)) { // Check if any entries were actually processed or if config was present
                        const resolvedWrapperPrefix = this.#resolvePlaceholders(elementConfig.prefix, promptData);
                        const resolvedWrapperSuffix = this.#resolvePlaceholders(elementConfig.suffix, promptData);
                        finalPromptString += `${resolvedWrapperPrefix}${assembledLogEntries}${resolvedWrapperSuffix}`;
                    } else {
                        this.#logger.debug(`PromptBuilder.build: Perception log for '${key}' resulted in no formatted entries. Skipping wrapper.`);
                    }
                } else {
                    this.#logger.debug(`PromptBuilder.build: Perception log array for '${key}' is missing, empty, or not an array. Skipping this part.`); // [cite: 423]
                }
                continue; // Move to the next key in prompt_assembly_order
            }

            // --- General Content Element Processing ---
            const camelCaseKey = this.#snakeToCamel(key);
            const contentKeyInPromptData = `${camelCaseKey}Content`; // e.g. system_prompt -> systemPromptContent
            let content = promptData[contentKeyInPromptData];

            // Optional Parts (Graceful Omission): Skip if content is missing [cite: 416, 423]
            if (content === null || content === undefined || content === '') {
                this.#logger.debug(`PromptBuilder.build: Content for '${key}' (checked as '${contentKeyInPromptData}') is missing or empty. Skipping part.`);
                continue;
            }

            // Ensure content is a string for general processing. Other types (like arrays for perception_log) handled separately.
            if (typeof content !== 'string') {
                this.#logger.warn(`PromptBuilder.build: Content for '${key}' (from '${contentKeyInPromptData}') is not a string. Skipping. Received type: ${typeof content}, value: ${JSON.stringify(content)}`);
                continue;
            }

            const resolvedPrefix = this.#resolvePlaceholders(elementConfig.prefix, promptData);
            const resolvedSuffix = this.#resolvePlaceholders(elementConfig.suffix, promptData);

            finalPromptString += `${resolvedPrefix}${content}${resolvedSuffix}`;
        }

        this.#logger.info(`PromptBuilder.build: Successfully assembled prompt for llmId: ${llmId}. Length: ${finalPromptString.length}`);
        return finalPromptString;
    }


    /**
     * Finds a configuration based on the llmId, adhering to the hierarchy:
     * 1. Exact Match on `model_identifier`.
     * 2. Model Family Wildcard Match (`model_identifier` ending with `*`):
     * The wildcard matching the `llmId` with the longest prefix takes precedence.
     * If no match is found, returns `undefined`.
     *
     * @param {string} llmId - The LLM identifier (e.g., "anthropic/claude-3-sonnet-20240229").
     * @returns {LLMConfig | undefined} The selected configuration or undefined if no suitable match is found.
     * @protected
     */
    _findConfiguration(llmId) {
        this.#logger.debug(`_findConfiguration: Searching configuration for llmId "${llmId}"`);

        let exactMatchConfig = undefined;
        let bestWildcardMatchConfig = undefined;
        let longestWildcardPrefixLength = -1;

        for (const config of this.#llmConfigsCache.values()) {
            if (config.model_identifier === llmId) {
                this.#logger.debug(`_findConfiguration: Found exact match for llmId "${llmId}" with config_id "${config.config_id}"`);
                exactMatchConfig = config;
                break;
            }

            if (config.model_identifier && config.model_identifier.endsWith('*')) {
                const wildcardPrefix = config.model_identifier.slice(0, -1);
                if (llmId.startsWith(wildcardPrefix)) {
                    if (wildcardPrefix.length > longestWildcardPrefixLength) {
                        longestWildcardPrefixLength = wildcardPrefix.length;
                        bestWildcardMatchConfig = config;
                        this.#logger.debug(`_findConfiguration: Found new best wildcard match for llmId "${llmId}" with config_id "${config.config_id}" (pattern: "${config.model_identifier}", prefix length: ${wildcardPrefix.length}).`);
                    } else if (wildcardPrefix.length === longestWildcardPrefixLength) {
                        this.#logger.debug(`_findConfiguration: Found another wildcard match for llmId "${llmId}" with config_id "${config.config_id}" (pattern: "${config.model_identifier}") with the same prefix length (${wildcardPrefix.length}) as current best. Current best (${bestWildcardMatchConfig?.config_id}) is kept.`);
                    }
                }
            }
        }

        if (exactMatchConfig) {
            this.#logger.info(`_findConfiguration: Selected exact match config_id "${exactMatchConfig.config_id}" for llmId "${llmId}".`);
            return exactMatchConfig;
        }

        if (bestWildcardMatchConfig) {
            this.#logger.info(`_findConfiguration: Selected wildcard match config_id "${bestWildcardMatchConfig.config_id}" (pattern: "${bestWildcardMatchConfig.model_identifier}") for llmId "${llmId}".`);
            return bestWildcardMatchConfig;
        }

        this.#logger.warn(`_findConfiguration: No configuration found for llmId "${llmId}" after checking exact and wildcard matches.`);
        return undefined;
    }

    /**
     * Adds or updates configurations in the cache programmatically.
     * Useful for directly injecting configurations, e.g., from initial setup or dynamic updates.
     * @param {LLMConfig[]} configs - An array of LLM configurations to load or update.
     */
    addOrUpdateConfigs(configs) {
        if (!Array.isArray(configs)) {
            this.#logger.error('PromptBuilder.addOrUpdateConfigs: Input must be an array of configurations.');
            return;
        }
        let loadedCount = 0;
        let updatedCount = 0;
        configs.forEach(config => {
            if (config && config.config_id && config.model_identifier) {
                if (this.#llmConfigsCache.has(config.config_id)) {
                    updatedCount++;
                } else {
                    loadedCount++;
                }
                this.#llmConfigsCache.set(config.config_id, config);
            } else {
                this.#logger.warn('PromptBuilder.addOrUpdateConfigs: Skipping invalid or incomplete configuration object.', {config});
            }
        });
        if (loadedCount > 0 || updatedCount > 0) {
            this.#logger.info(`PromptBuilder.addOrUpdateConfigs: Loaded ${loadedCount} new, updated ${updatedCount} existing configurations.`);
        }
        if (this.#llmConfigsCache.size > 0) {
            this.#configsLoadedOrAttempted = true;
        }
    }

    /**
     * Clears the configuration cache and resets the loaded state.
     * Useful for forcing a reload from file on next build, e.g., for testing or dynamic updates.
     */
    resetConfigurationCache() {
        this.#llmConfigsCache.clear();
        this.#configsLoadedOrAttempted = false;
        this.#logger.info('PromptBuilder: Configuration cache cleared and loaded state reset.');
    }
}

// --- FILE END ---