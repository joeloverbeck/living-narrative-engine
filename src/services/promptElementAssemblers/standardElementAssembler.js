// src/services/promptElementAssemblers/standardElementAssembler.js
/**
 * @fileoverview Implements the StandardElementAssembler for generic prompt elements.
 */

import {IPromptElementAssembler} from '../../interfaces/IPromptElementAssembler.js';
import {snakeToCamel} from '../../utils/textUtils.js'; // Import the shared utility

// JSDoc Typedefs for dependency contracts and data structures
/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 */
/**
 * @typedef {import('../promptBuilder.js').PromptElement} PromptElement
 * @description Configuration for a single prompt element.
 */
/**
 * @typedef {import('../promptBuilder.js').PromptData} PromptData
 * @description Data object containing content and flags for prompt assembly.
 */

/**
 * @typedef {import('../../utils/placeholderResolver.js').PlaceholderResolver} PlaceholderResolver
 * @description Utility class for resolving placeholders in strings.
 */

/**
 * @class StandardElementAssembler
 * @implements {IPromptElementAssembler}
 * @description Handles the assembly of common/generic prompt elements.
 * These elements typically consist of an optional prefix, a central piece of content
 * derived from `PromptData` using a conventional key, and an optional suffix.
 */
export class StandardElementAssembler extends IPromptElementAssembler {
    /**
     * @private
     * @type {ILogger}
     * @description Logger instance.
     */
    #logger;

    // #snakeToCamel method has been removed from here and moved to stringUtils.js

    /**
     * Initializes a new instance of the StandardElementAssembler.
     * @param {object} [options={}] - Optional parameters.
     * @param {ILogger} [options.logger=console] - An ILogger instance. Defaults to the global console.
     */
    constructor({logger = console} = {}) {
        super();
        this.#logger = logger;
    }

    /**
     * Assembles a single "standard" prompt element into its string representation.
     *
     * Standard elements are composed of:
     * 1. An optional prefix (placeholders resolved).
     * 2. A central content string retrieved from `PromptData` based on `elementConfig.key`
     * (e.g., `system_prompt` key leads to `promptData.systemPromptContent`).
     * 3. An optional suffix (placeholders resolved).
     *
     * @param {PromptElement} elementConfig - The configuration for the prompt element.
     * @param {PromptData} promptData - The global prompt data object.
     * @param {PlaceholderResolver} placeholderResolver - Utility for resolving placeholders.
     * @param {Map<string, PromptElement>} [allPromptElementsMap] - A map of all prompt element configurations.
     * (This parameter is part of the interface but not used by this specific assembler).
     * @returns {string} The assembled string for this element, or an empty string if all parts are empty.
     */
    assemble(elementConfig, promptData, placeholderResolver, allPromptElementsMap) {
        if (!elementConfig || !promptData || !placeholderResolver) {
            this.#logger.error('StandardElementAssembler.assemble: Missing required parameters (elementConfig, promptData, or placeholderResolver).', {
                elementConfigProvided: !!elementConfig,
                promptDataProvider: !!promptData,
                placeholderResolverProvided: !!placeholderResolver,
            });
            return ""; // Or throw an error, depending on desired strictness. Returning empty for robustness.
        }

        const {key, prefix = "", suffix = ""} = elementConfig;

        if (!key || typeof key !== 'string') {
            this.#logger.warn(`StandardElementAssembler.assemble: Invalid or missing 'key' in elementConfig. Cannot process element.`, {elementConfig});
            return "";
        }

        const resolvedPrefix = placeholderResolver.resolve(prefix, promptData);
        const resolvedSuffix = placeholderResolver.resolve(suffix, promptData);

        const camelCaseKey = snakeToCamel(key); // Use the imported utility
        const contentKeyInPromptData = `${camelCaseKey}Content`;

        const rawContent = promptData[contentKeyInPromptData];
        let centralContentString = "";

        if (rawContent === null || rawContent === undefined) {
            centralContentString = "";
            // Optional debug log, as per ticket specification.
            this.#logger.debug(`StandardElementAssembler: Content for '${key}' (derived key: '${contentKeyInPromptData}') is null or undefined. Treating as empty string.`);
        } else if (typeof rawContent === 'string') {
            centralContentString = rawContent;
        } else {
            this.#logger.warn(`StandardElementAssembler: Content for '${key}' (derived key: '${contentKeyInPromptData}') is not a string, null, or undefined. It is of type '${typeof rawContent}'. Treating as empty string for this element.`);
            centralContentString = ""; // Treat as empty for robustness.
        }

        if (resolvedPrefix || centralContentString || resolvedSuffix) {
            return `${resolvedPrefix}${centralContentString}${resolvedSuffix}`;
        } else {
            // Optional: Log if the entire element output is empty
            this.#logger.debug(`StandardElementAssembler: Element '${key}' is entirely empty (prefix, content, suffix). Output for this element is empty.`);
            return "";
        }
    }
}