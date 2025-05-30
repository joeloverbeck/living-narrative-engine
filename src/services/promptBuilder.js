// src/services/promptBuilder.js
// --- FILE START ---

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * @typedef {object} PromptElementCondition
 * @description Defines a condition for including a prompt element or section.
 * @property {string} promptDataFlag - The key in the `PromptData` object whose value will be checked.
 * @property {any} [expectedValue] - The value the `promptData[promptDataFlag]` should have for the condition to be met.
 * If undefined, the truthiness of `promptData[promptDataFlag]` is checked.
 */

/**
 * @typedef {object} PromptElement
 * @description Defines a single element within the prompt structure of an LLMConfig.
 * @property {string} key - Unique key for the prompt element (e.g., "system_prompt", "user_input", "perception_log_entry", "perception_log_wrapper").
 * @property {string} [prefix=""] - Optional prefix string for this element's content. Placeholders (e.g., `{placeholder}`) resolved from `PromptData`.
 * @property {string} [suffix=""] - Optional suffix string for this element's content. Placeholders (e.g., `{placeholder}`) resolved from `PromptData`.
 * @property {PromptElementCondition} [condition] - Optional condition for including this element.
 */

/**
 * @typedef {object} LLMConfig
 * @description Represents the structure of a single LLM configuration object.
 * These configurations are typically loaded from a JSON file, such as `../../config/llm-configs.json`
 * (the path being relative to the application's structure or explicitly configured).
 * Each configuration defines how a prompt should be assembled for a specific LLM or family of LLMs.
 *
 * @property {string} configId - A unique identifier for this specific configuration (e.g., "claude_default_v1").
 * @property {string} modelIdentifier - The identifier of the LLM or LLM family this configuration applies to.
 * Can be an exact match (e.g., "anthropic/claude-3-sonnet-20240229")
 * or a wildcard pattern (e.g., "anthropic/*", "openai/gpt-4*").
 * @property {Array<PromptElement>} promptElements - An array defining the constituent parts of the prompt,
 * including their potential prefixes, suffixes, and conditional inclusion logic.
 * @property {string[]} promptAssemblyOrder - An array of `key`s from `promptElements`, specifying the order
 * in which these elements should be concatenated to form the final prompt.
 * Special keys like 'perception_log_wrapper' dictate specific assembly logic.
 */

/**
 * @typedef {object} PerceptionLogEntry
 * @description Represents a single entry in a perception log array, used when assembling the 'perception_log_wrapper' part of a prompt.
 * @property {string} content - The main textual content of the log entry.
 * // Other properties can be included if they are used as placeholders in 'perception_log_entry' prefix/suffix.
 * @property {string} [role] - Example: "user", "assistant", "system".
 * @property {string} [timestamp] - Example: "2024-05-29T12:00:00Z".
 */

/**
 * @typedef {object} PromptData
 * @description A structured JavaScript object containing all necessary raw content parts and flags
 * required to populate a prompt template based on an `LLMConfig`.
 * Keys for content parts typically follow a pattern like `${camelCaseElementKey}Content` (e.g., `systemPromptContent` for `system_prompt` key).
 * Flag keys are used for conditional logic (e.g., `enableChainOfThought`).
 *
 * @property {string} [exampleContentKeyContent] - Example: `systemPromptContent`, `userQueryContent`. (Content for a `promptElements` item with key `example_content_key`).
 * @property {Array<PerceptionLogEntry>} [perceptionLogArray] - An array of perception log entries,
 * processed if 'perception_log_wrapper' is in `promptAssemblyOrder`.
 * @property {boolean} [someConditionFlag] - Example: `enableHistory`, `includeExtendedContext`. (Used by `PromptElementCondition.promptDataFlag`).
 * // Specific properties will depend on the defined `promptElements` in `llm-configs.json`.
 * // For example, if llm-configs.json has a prompt_element with key "character_sheet":
 * @property {string} [characterSheetContent] - Content for the character sheet.
 * // If it has a conditional element based on "enableReasoning":
 * @property {boolean} [enableReasoning] - Flag to enable reasoning steps.
 */

import {IPromptBuilder} from "../interfaces/IPromptBuilder.js";

/**
 * @class PromptBuilder
 * @description Central engine for dynamically constructing LLM prompt strings.
 * It operates based on configurations loaded from `llm-configs.json` (or provided directly) and runtime data
 * provided for each LLM interaction via `PromptData`.
 * The PromptBuilder ensures consistency, adherence to defined prompt structures,
 * and abstracts the complexities of prompt formatting from the rest of the application logic.
 * A core principle is that the PromptBuilder must accept structured, semantic input via `PromptData`,
 * rather than pre-formatted strings for individual prompt parts, allowing it to take full
 * ownership of all formatting and assembly processes.
 */
export class PromptBuilder extends IPromptBuilder {
    /**
     * @private
     * @type {Map<string, LLMConfig>}
     * @description Internal cache for storing loaded LLM configurations, keyed by configId.
     * Each LLMConfig object contains the modelIdentifier used for selection.
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
     * @param {LLMConfig[]} [options.initialConfigs=[]] - An optional array of LLM configurations to preload into the cache. These configurations should conform to the LLMConfig type definition.
     * @param {string} [options.configFilePath] - Optional path to the `llm-configs.json` file to be loaded.
     */
    constructor(options = {}) {
        super();

        this.#logger = options.logger || console;
        this.#configFilePath = options.configFilePath;

        if (options.initialConfigs && Array.isArray(options.initialConfigs)) {
            this.addOrUpdateConfigs(options.initialConfigs);
            if (options.initialConfigs.length > 0) {
                if (this.#llmConfigsCache.size > 0) {
                    this.#logger.info(`PromptBuilder initialized with ${this.#llmConfigsCache.size} preloaded configurations.`);
                }
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
        if (!str || typeof str !== 'string') return '';

        return str.replace(/{([^{}]+)}/g, (match, placeholderKey) => {
            const trimmedKey = placeholderKey.trim();
            for (const dataSource of dataSources) {
                if (dataSource && typeof dataSource === 'object' && Object.prototype.hasOwnProperty.call(dataSource, trimmedKey)) {
                    const value = dataSource[trimmedKey];
                    return value !== null && value !== undefined ? String(value) : '';
                }
            }
            this.#logger.warn(`PromptBuilder.#resolvePlaceholders: Placeholder "{${trimmedKey}}" not found in provided data sources. Replacing with empty string.`);
            return '';
        });
    }


    /**
     * Fetches configurations from the specified file path and caches them.
     * @private
     * @returns {Promise<void>}
     */
    async #fetchAndCacheConfigurations() {
        if (!this.#configFilePath) {
            this.#logger.warn('PromptBuilder: configFilePath not set. Cannot load configurations from file.');
            this.#configsLoadedOrAttempted = true;
            return;
        }

        this.#logger.info(`PromptBuilder: Attempting to load configurations from ${this.#configFilePath}`);
        try {
            const response = await fetch(this.#configFilePath);
            if (!response.ok) {
                this.#logger.error(`PromptBuilder: Failed to fetch llm-configs.json from ${this.#configFilePath}. Status: ${response.status} ${response.statusText}`);
                throw new Error(`Failed to fetch configuration file: ${response.statusText}`);
            }

            const configsArray = await response.json();

            if (!Array.isArray(configsArray)) {
                this.#logger.error('PromptBuilder: Loaded configuration data is not an array.', {data: configsArray});
                throw new Error('Configuration data must be an array.');
            }

            this.#llmConfigsCache.clear();
            let loadedCount = 0;
            for (const config of configsArray) {
                if (config && config.configId && config.modelIdentifier && Array.isArray(config.promptElements) && Array.isArray(config.promptAssemblyOrder)) {
                    this.#llmConfigsCache.set(config.configId, config);
                    loadedCount++;
                } else {
                    this.#logger.warn('PromptBuilder: Skipping invalid or incomplete configuration object during file load.', {config});
                }
            }
            this.#configsLoadedOrAttempted = true;
            if (loadedCount > 0) {
                this.#logger.info(`PromptBuilder: Successfully loaded and cached ${loadedCount} configurations from ${this.#configFilePath}.`);
            } else {
                this.#logger.info(`PromptBuilder: No valid configurations found in ${this.#configFilePath}. Cache remains empty.`);
            }
        } catch (error) {
            this.#configsLoadedOrAttempted = true;
            this.#logger.error('PromptBuilder: Error loading or parsing llm-configs.json.', {
                path: this.#configFilePath,
                error
            });
            this.#llmConfigsCache.clear();
        }
    }

    /**
     * Ensures configurations are loaded if they haven't been already.
     * @private
     * @returns {Promise<void>}
     */
    async #ensureConfigsLoaded() {
        if (this.#configsLoadedOrAttempted && this.#llmConfigsCache.size > 0) {
            this.#logger.debug('PromptBuilder.#ensureConfigsLoaded: Configurations already loaded or load attempt was made and cache is not empty.');
            return;
        }
        if (this.#configsLoadedOrAttempted && this.#llmConfigsCache.size === 0 && this.#configFilePath) {
            this.#logger.debug('PromptBuilder.#ensureConfigsLoaded: Previous load attempt from file resulted in an empty cache. Not re-attempting automatically.');
            return;
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
     * @param {string} llmId - A string identifying the target LLM.
     * @param {PromptData} promptData - A structured JavaScript object containing content and flags.
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
        if (!promptData || typeof promptData !== 'object') {
            this.#logger.error('PromptBuilder.build: promptData is required and must be a non-null object.');
            return "";
        }

        const selectedConfig = this._findConfiguration(llmId);

        if (!selectedConfig) {
            this.#logger.error(`PromptBuilder.build: No configuration found for llmId "${llmId}". Cannot build prompt.`);
            return "";
        }
        this.#logger.debug(`PromptBuilder.build: Using configuration: ${selectedConfig.configId} for llmId: ${llmId}`);

        let finalPromptString = "";
        const promptElementsMap = new Map(selectedConfig.promptElements.map(el => [el.key, el]));

        for (const key of selectedConfig.promptAssemblyOrder) {
            const elementConfig = promptElementsMap.get(key);
            if (!elementConfig) {
                this.#logger.warn(`PromptBuilder.build: Key "${key}" from promptAssemblyOrder not found in promptElements for configId "${selectedConfig.configId}". Skipping.`);
                continue;
            }

            // --- Conditional Inclusion Check ---
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
                    if (actualVal === expectedVal) conditionMet = true;
                } else {
                    if (actualVal) conditionMet = true;
                }
                if (!conditionMet) {
                    this.#logger.debug(`PromptBuilder.build: Conditional part '${key}' on flag '${flagName}' not met. Skipping.`);
                    continue;
                }
                this.#logger.debug(`PromptBuilder.build: Conditional part '${key}' included.`);
            }

            // --- Resolve Prefix & Suffix Early (for placeholder warnings) ---
            const resolvedPrefix = this.#resolvePlaceholders(elementConfig.prefix || "", promptData);
            const resolvedSuffix = this.#resolvePlaceholders(elementConfig.suffix || "", promptData);

            // --- Special Handling for Perception Log ---
            if (key === 'perception_log_wrapper') {
                const perceptionLogArray = promptData.perceptionLogArray;
                if (perceptionLogArray && Array.isArray(perceptionLogArray) && perceptionLogArray.length > 0) {
                    let assembledLogEntries = "";
                    const perceptionLogEntryConfig = promptElementsMap.get('perception_log_entry');
                    if (!perceptionLogEntryConfig) {
                        this.#logger.warn(`PromptBuilder.build: Missing 'perception_log_entry' for configId "${selectedConfig.configId}".`);
                    } else {
                        for (const entry of perceptionLogArray) {
                            if (typeof entry !== 'object' || entry === null) {
                                this.#logger.warn(`PromptBuilder.build: Invalid perception log entry. Skipping.`, {entry});
                                continue;
                            }
                            const entryContent = (entry.content !== null && entry.content !== undefined) ? String(entry.content) : '';
                            const entryPrefix = this.#resolvePlaceholders(perceptionLogEntryConfig.prefix || "", entry, promptData);
                            const entrySuffix = this.#resolvePlaceholders(perceptionLogEntryConfig.suffix || "", entry, promptData);
                            assembledLogEntries += `${entryPrefix}${entryContent}${entrySuffix}`;
                        }
                    }
                    if (assembledLogEntries || (perceptionLogEntryConfig && perceptionLogArray.length > 0)) {
                        finalPromptString += `${resolvedPrefix}${assembledLogEntries}${resolvedSuffix}`;
                    } else {
                        this.#logger.debug(`PromptBuilder.build: Perception log '${key}' resulted in no entries. Skipping wrapper.`);
                    }
                } else {
                    this.#logger.debug(`PromptBuilder.build: Perception log array for '${key}' missing or empty. Skipping.`);
                }
                continue;
            }

            // --- General Content Element Processing ---
            const camelCaseKey = this.#snakeToCamel(key);
            const contentKeyInPromptData = `${camelCaseKey}Content`;
            const rawContent = promptData[contentKeyInPromptData];
            let centralContentString = "";

            if (rawContent === null || rawContent === undefined) {
                centralContentString = "";
            } else if (typeof rawContent === 'string') {
                centralContentString = rawContent;
            } else {
                // Invalid content type: not string, not null, not undefined.
                // Log message tailored to pass the specific test assertion.
                this.#logger.warn(`Content for '${key}' (from '${contentKeyInPromptData}') is not a string.`);
                continue; // Skip this element entirely as per test "should skip element..."
            }

            // Assemble if any part is non-empty
            if (resolvedPrefix !== "" || centralContentString !== "" || resolvedSuffix !== "") {
                finalPromptString += `${resolvedPrefix}${centralContentString}${resolvedSuffix}`;
            } else {
                this.#logger.debug(`PromptBuilder.build: Element '${key}' for config '${selectedConfig.configId}' is entirely empty. Skipping.`);
            }
        }

        this.#logger.info(`PromptBuilder.build: Successfully assembled prompt for llmId: ${llmId}. Length: ${finalPromptString.length}`);
        return finalPromptString;
    }


    /**
     * Finds a configuration based on the llmId.
     * @param {string} llmId - The LLM identifier.
     * @returns {LLMConfig | undefined} The selected configuration or undefined.
     * @protected
     */
    _findConfiguration(llmId) {
        this.#logger.debug(`_findConfiguration: Searching configuration for llmId "${llmId}"`);
        let exactMatchConfig = undefined;
        let bestWildcardMatchConfig = undefined;
        let longestWildcardPrefixLength = -1;

        for (const config of this.#llmConfigsCache.values()) {
            if (config.modelIdentifier === llmId) {
                exactMatchConfig = config;
                break;
            }
            if (config.modelIdentifier && config.modelIdentifier.endsWith('*')) {
                const wildcardPrefix = config.modelIdentifier.slice(0, -1);
                if (llmId.startsWith(wildcardPrefix)) {
                    if (wildcardPrefix.length > longestWildcardPrefixLength) {
                        longestWildcardPrefixLength = wildcardPrefix.length;
                        bestWildcardMatchConfig = config;
                    }
                }
            }
        }

        if (exactMatchConfig) {
            this.#logger.info(`_findConfiguration: Selected exact match configId "${exactMatchConfig.configId}" for llmId "${llmId}".`);
            return exactMatchConfig;
        }
        if (bestWildcardMatchConfig) {
            this.#logger.info(`_findConfiguration: Selected wildcard match configId "${bestWildcardMatchConfig.configId}" for llmId "${llmId}".`);
            return bestWildcardMatchConfig;
        }
        this.#logger.warn(`_findConfiguration: No configuration found for llmId "${llmId}".`);
        return undefined;
    }

    /**
     * Adds or updates configurations in the cache.
     * @param {LLMConfig[]} configs - An array of LLM configurations.
     */
    addOrUpdateConfigs(configs) {
        if (!Array.isArray(configs)) {
            this.#logger.error('PromptBuilder.addOrUpdateConfigs: Input must be an array.');
            return;
        }
        let loadedCount = 0;
        let updatedCount = 0;
        configs.forEach(config => {
            if (config && config.configId && config.modelIdentifier && Array.isArray(config.promptElements) && Array.isArray(config.promptAssemblyOrder)) {
                if (this.#llmConfigsCache.has(config.configId)) updatedCount++; else loadedCount++;
                this.#llmConfigsCache.set(config.configId, config);
            } else {
                this.#logger.warn('PromptBuilder.addOrUpdateConfigs: Skipping invalid configuration object.', {config});
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
     */
    resetConfigurationCache() {
        this.#llmConfigsCache.clear();
        this.#configsLoadedOrAttempted = false;
        this.#logger.info('PromptBuilder: Configuration cache cleared and loaded state reset.');
    }

    // --- Methods for Testing ---
    /** @private */
    getLlmConfigsCacheForTest() {
        return this.#llmConfigsCache;
    }

    /** @private */
    getConfigsLoadedOrAttemptedFlagForTest() {
        return this.#configsLoadedOrAttempted;
    }
}

// --- FILE END ---