// src/services/promptBuilder.js
// --- FILE START ---

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * @typedef {import('./llmConfigService.js').LLMConfigService} LLMConfigService
 */

/**
 * @typedef {import('./llmConfigService.js').LLMConfig} LLMConfig
 */

/**
 * @typedef {import('../utils/placeholderResolver.js').PlaceholderResolver} PlaceholderResolver
 */

/**
 * @typedef {import('./promptElementAssemblers/StandardElementAssembler.js').StandardElementAssembler} StandardElementAssembler
 */

/**
 * @typedef {import('./promptElementAssemblers/PerceptionLogAssembler.js').PerceptionLogAssembler} PerceptionLogAssembler
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

// LLMConfig is now imported from LLMConfigService, so this typedef can be removed or adapted if it differs.
// For now, assuming it's the same structure and can be referenced via the import.

/**
 * @typedef {object} PerceptionLogEntry
 * @description Represents a single entry in a perception log array, used when assembling the 'perception_log_wrapper' part of a prompt.
 * @property {string} content - The main textual content of the log entry.
 * // Other properties can be included if they are used as placeholders in 'perception_log_entry' prefix/suffix.
 * @property {string} [role] - Example: "user", "assistant", "system".
 * @property {string} [timestamp] - Example: "2024-05-29T12:00:00Z". // This property will be ignored for rendering if present in data.
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
import {StandardElementAssembler} from './promptElementAssemblers/StandardElementAssembler.js';
import {PerceptionLogAssembler} from './promptElementAssemblers/PerceptionLogAssembler.js';

// Define constants for special element keys
const PERCEPTION_LOG_WRAPPER_KEY = 'perception_log_wrapper';

// const PERCEPTION_LOG_ENTRY_KEY = 'perception_log_entry'; // No longer needed directly by PromptBuilder

/**
 * @class PromptBuilder
 * @description Central engine for dynamically constructing LLM prompt strings.
 * It orchestrates prompt assembly based on configurations retrieved from an {@link LLMConfigService}
 * and runtime data provided for each LLM interaction via `PromptData`.
 * It now primarily acts as an orchestrator, delegating the detailed assembly of individual
 * prompt elements to specialized assembler components.
 * A core principle is that the PromptBuilder must accept structured, semantic input via `PromptData`,
 * rather than pre-formatted strings for individual prompt parts, allowing the assemblers to take full
 * ownership of all formatting and assembly processes based on the provided configuration.
 */
export class PromptBuilder extends IPromptBuilder {
    /**
     * @private
     * @type {ILogger | Console}
     * @description Logger instance. Defaults to console if no logger is provided.
     */
    #logger;

    /**
     * @private
     * @type {LLMConfigService}
     * @description Service for LLM configuration management.
     */
    #llmConfigService;

    /**
     * @private
     * @type {PlaceholderResolver}
     * @description Utility for resolving placeholders.
     */
    #placeholderResolver;

    /**
     * @private
     * @type {StandardElementAssembler}
     * @description Assembler for standard prompt elements.
     */
    #standardElementAssembler;

    /**
     * @private
     * @type {PerceptionLogAssembler}
     * @description Assembler for perception log elements.
     */
    #perceptionLogAssembler;


    /**
     * Initializes a new instance of the PromptBuilder.
     * @param {object} dependencies - The dependencies for the PromptBuilder.
     * @param {ILogger} [dependencies.logger=console] - An optional logger instance.
     * @param {LLMConfigService} dependencies.llmConfigService - Service for LLM configuration management.
     * @param {PlaceholderResolver} dependencies.placeholderResolver - Utility for resolving placeholders.
     * @param {StandardElementAssembler} dependencies.standardElementAssembler - Assembler for standard prompt elements.
     * @param {PerceptionLogAssembler} dependencies.perceptionLogAssembler - Assembler for perception log elements.
     */
    constructor({
                    logger = console,
                    llmConfigService,
                    placeholderResolver,
                    standardElementAssembler,
                    perceptionLogAssembler
                }) {
        super();
        this.#logger = logger;

        if (!llmConfigService) {
            const errorMsg = "PromptBuilder: LLMConfigService is a required dependency.";
            this.#logger.error(errorMsg);
            throw new Error(errorMsg);
        }
        this.#llmConfigService = llmConfigService;

        if (!placeholderResolver) {
            const errorMsg = "PromptBuilder: PlaceholderResolver is a required dependency.";
            this.#logger.error(errorMsg);
            throw new Error(errorMsg);
        }
        this.#placeholderResolver = placeholderResolver;

        if (!standardElementAssembler) {
            const errorMsg = "PromptBuilder: StandardElementAssembler is a required dependency.";
            this.#logger.error(errorMsg);
            throw new Error(errorMsg);
        }
        this.#standardElementAssembler = standardElementAssembler;

        if (!perceptionLogAssembler) {
            const errorMsg = "PromptBuilder: PerceptionLogAssembler is a required dependency.";
            this.#logger.error(errorMsg);
            throw new Error(errorMsg);
        }
        this.#perceptionLogAssembler = perceptionLogAssembler;

        this.#logger.info('PromptBuilder initialized with LLMConfigService, PlaceholderResolver, and Assemblers.');
    }

    /**
     * @private
     * Evaluates if a prompt element's condition is met based on PromptData.
     * @param {PromptElementCondition | undefined} condition - The condition object from the prompt element.
     * @param {PromptData} promptData - The prompt data object.
     * @returns {boolean} True if the condition is met or if there is no condition, false otherwise.
     */
    #isElementConditionMet(condition, promptData) {
        // If no condition is defined, the element should always be included.
        if (!condition) {
            return true;
        }

        if (typeof condition.promptDataFlag !== 'string' || !condition.promptDataFlag.trim()) {
            this.#logger.warn(`PromptBuilder.#isElementConditionMet: Conditional element has invalid or empty 'promptDataFlag'. Assuming condition not met.`, {condition});
            return false;
        }

        const flagName = condition.promptDataFlag;
        const actualVal = promptData[flagName];
        let conditionMet = false;

        if (Object.prototype.hasOwnProperty.call(condition, 'expectedValue')) {
            const expectedVal = condition.expectedValue;
            if (actualVal === expectedVal) {
                conditionMet = true;
            }
        } else {
            if (actualVal) { // Truthiness check
                conditionMet = true;
            }
        }

        if (!conditionMet) {
            let expectedValueMessage = "truthy"; // Default for truthiness check
            if (Object.prototype.hasOwnProperty.call(condition, 'expectedValue')) {
                expectedValueMessage = `'${condition.expectedValue}'`;
            }
            this.#logger.debug(`PromptBuilder.#isElementConditionMet: Condition on flag '${flagName}' (value: ${actualVal}) not met for expected value ${expectedValueMessage}. Element will be skipped.`);
        } else {
            this.#logger.debug(`PromptBuilder.#isElementConditionMet: Condition on flag '${flagName}' (value: ${actualVal}) met. Element will be included.`);
        }
        return conditionMet;
    }

    /**
     * Assembles a final prompt string based on the provided LLM identifier and structured prompt data.
     * This method orchestrates the assembly by delegating to specialized assembler components.
     * @param {string} llmId - A string identifying the target LLM. This is typically the `configId` of an LLM configuration,
     * or a `modelIdentifier` that the `LLMConfigService` can resolve.
     * @param {PromptData} promptData - A structured JavaScript object containing content and flags.
     * @returns {Promise<string>} The fully assembled prompt string, or an empty string if a prompt cannot be built.
     */
    async build(llmId, promptData) {
        this.#logger.info(`PromptBuilder.build called for llmId: ${llmId}`);

        if (!llmId || typeof llmId !== 'string') {
            this.#logger.error('PromptBuilder.build: llmId is required and must be a string.');
            return "";
        }
        if (!promptData || typeof promptData !== 'object' || promptData === null) {
            this.#logger.error('PromptBuilder.build: promptData is required and must be a non-null object.');
            return "";
        }

        const selectedConfig = await this.#llmConfigService.getConfig(llmId);

        if (!selectedConfig) {
            this.#logger.error(`PromptBuilder.build: No configuration found or provided by LLMConfigService for llmId "${llmId}". Cannot build prompt.`);
            return "";
        }
        this.#logger.debug(`PromptBuilder.build: Using configuration: ${selectedConfig.configId} (provided by LLMConfigService) for llmId: ${llmId}`);

        let finalPromptString = "";
        const promptElementsMap = new Map(selectedConfig.promptElements.map(el => [el.key, el]));

        for (const key of selectedConfig.promptAssemblyOrder) {
            const elementConfig = promptElementsMap.get(key);
            if (!elementConfig) {
                this.#logger.warn(`PromptBuilder.build: Key "${key}" from promptAssemblyOrder not found in promptElements for configId "${selectedConfig.configId}". Skipping.`);
                continue;
            }

            if (!this.#isElementConditionMet(elementConfig.condition, promptData)) {
                this.#logger.debug(`PromptBuilder.build: Element '${key}' skipped due to its condition not being met.`);
                continue;
            }
            this.#logger.debug(`PromptBuilder.build: Element '${key}' included as its condition was met (or no condition defined).`);

            let currentElementOutput = "";
            let assemblerToUse;

            if (key === PERCEPTION_LOG_WRAPPER_KEY) {
                assemblerToUse = this.#perceptionLogAssembler;
            } else {
                assemblerToUse = this.#standardElementAssembler;
            }

            if (assemblerToUse) {
                try {
                    currentElementOutput = assemblerToUse.assemble(
                        elementConfig,
                        promptData,
                        this.#placeholderResolver,
                        promptElementsMap // Pass the full map
                    );
                } catch (error) {
                    this.#logger.error(`PromptBuilder.build: Error during element assembly for key '${key}' using assembler '${assemblerToUse.constructor.name}'. Skipping element.`, {
                        error,
                        elementConfig,
                        llmId: selectedConfig.configId
                    });
                    currentElementOutput = ""; // Ensure graceful failure for this element
                }
            } else {
                // This case should ideally not be reached if assemblers are correctly injected
                // and the if/else logic for selecting assemblerToUse is comprehensive.
                this.#logger.warn(`PromptBuilder.build: No assembler found or assigned for key '${key}'. This could indicate missing dependencies or an unhandled element type. Skipping element.`, {
                    elementKey: key,
                    configId: selectedConfig.configId
                });
                currentElementOutput = "";
            }

            finalPromptString += currentElementOutput;
        }

        this.#logger.info(`PromptBuilder.build: Successfully assembled prompt for llmId: ${llmId} using config ${selectedConfig.configId}. Length: ${finalPromptString.length}`);
        return finalPromptString;
    }
}

// --- FILE END ---