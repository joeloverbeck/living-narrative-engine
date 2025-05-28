// src/core/validators/llmConfigSemanticValidator.js
// --- FILE START ---

/**
 * @typedef {object} SemanticValidationError
 * @description Describes a single semantic validation error found in an LLM configuration object.
 * @property {string} config_id - The ID of the configuration object where the error was found.
 * @property {string} problematic_key_ref - The key reference from prompt_assembly_order that was not found in prompt_elements.
 * @property {number} index_in_assembly_order - The index of the problematic key_ref within its prompt_assembly_order array.
 * @property {string[]} prompt_assembly_order - The full prompt_assembly_order array where the error occurred.
 * @property {string[]} available_prompt_element_keys - A list of keys that were available in the prompt_elements array for this config.
 * @property {string} message - A human-readable error message.
 */

/**
 * @typedef {object} LLMConfigPromptElement
 * @property {string} key - The unique key for the prompt element.
 * @property {string} prefix - The prefix string.
 * @property {string} suffix - The suffix string.
 */

/**
 * @typedef {object} LLMConfigObject
 * @description Represents a single configuration object from the llm-configs.json array.
 * @property {string} config_id - Unique identifier for this configuration set.
 * @property {string} model_identifier - Specific model ID or family wildcard.
 * @property {LLMConfigPromptElement[]} prompt_elements - Array of prompt part definitions.
 * @property {string[]} prompt_assembly_order - Ordered list of prompt_elements keys.
 */

/**
 * Performs semantic validations on the parsed llm-configs.json data.
 * The primary check ensures that all string keys listed in any `prompt_assembly_order`
 * array correspond to actual `key` values defined in the `prompt_elements` array
 * within the same configuration object.
 *
 * @param {LLMConfigObject[]} llmConfigsData - The entire parsed llm-configs.json object (an array of configurations).
 * @returns {SemanticValidationError[]} An array of semantic error objects. If no errors are found, it returns an empty array.
 */
export function performSemanticValidations(llmConfigsData) {
    const errors = [];

    if (!Array.isArray(llmConfigsData)) {
        // This case should ideally be caught by schema validation,
        // but as a safeguard if this function is called with malformed top-level data.
        errors.push({
            config_id: 'N/A - Top level data is not an array',
            problematic_key_ref: 'N/A',
            index_in_assembly_order: -1,
            prompt_assembly_order: [],
            available_prompt_element_keys: [],
            message: 'The provided llmConfigsData is not an array as expected.'
        });
        return errors;
    }

    llmConfigsData.forEach((config, configIndex) => {
        // Schema validation should ensure these fields exist and are of the correct type.
        // However, defensive checks are good practice.
        if (typeof config !== 'object' || config === null) {
            errors.push({
                config_id: `Config at index ${configIndex} (ID unknown)`,
                problematic_key_ref: 'N/A',
                index_in_assembly_order: -1,
                prompt_assembly_order: [],
                available_prompt_element_keys: [],
                message: `Configuration at index ${configIndex} is not a valid object.`
            });
            return; // Skip this malformed config object
        }

        const configId = typeof config.config_id === 'string' ? config.config_id : `UnnamedConfigAtIndex_${configIndex}`;
        const promptElements = Array.isArray(config.prompt_elements) ? config.prompt_elements : [];
        const promptAssemblyOrder = Array.isArray(config.prompt_assembly_order) ? config.prompt_assembly_order : [];

        const promptElementKeys = new Set();
        promptElements.forEach(element => {
            if (element && typeof element.key === 'string') {
                promptElementKeys.add(element.key);
            }
        });

        promptAssemblyOrder.forEach((keyRef, index) => {
            if (typeof keyRef !== 'string' || !promptElementKeys.has(keyRef)) {
                const availableKeys = Array.from(promptElementKeys);
                errors.push({
                    config_id: configId,
                    problematic_key_ref: typeof keyRef === 'string' ? keyRef : JSON.stringify(keyRef),
                    index_in_assembly_order: index,
                    prompt_assembly_order: [...promptAssemblyOrder], // Clone for safety
                    available_prompt_element_keys: availableKeys,
                    message: `In config '${configId}', the key '${String(keyRef)}' at index ${index} of 'prompt_assembly_order' was not found in its 'prompt_elements' keys. Available keys: [${availableKeys.join(', ')}].`
                });
            }
        });
    });

    return errors;
}

// --- FILE END ---