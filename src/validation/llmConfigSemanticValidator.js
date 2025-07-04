// src/validators/llmConfigSemanticValidator.js
// --- FILE START ---

/**
 * @typedef {import('../llms/llmConfigTypes.js').LLMConfiguration}        LLMConfiguration
 * @typedef {import('../llms/llmConfigTypes.js').LLMConfigPromptElement}  LLMConfigPromptElement
 */

/**
 * @typedef {object} SemanticValidationError
 * @description Describes a single semantic validation error found in an LLM configuration object.
 * @property {string} configId - The ID of the configuration object where the error was found (key from the configs map), or a special string for root errors.
 * @property {string} [problematic_key_ref] - The key reference from promptAssemblyOrder that was not found in promptElements.
 * @property {number} [index_in_assembly_order] - The index of the problematic key_ref within its promptAssemblyOrder array.
 * @property {string[]} [promptAssemblyOrder] - The full promptAssemblyOrder array where the error occurred.
 * @property {string[]} [available_prompt_element_keys] - A list of keys that were available in the promptElements array for this dependencyInjection.
 * @property {string} message - A human-readable error message.
 * @property {string} [path] - Path to the problematic element relative to the dependencyInjection object (e.g., "promptAssemblyOrder[2]") or an identifier for root issues (e.g., "(root).configs").
 * @property {string} [errorType="SEMANTIC_VALIDATION"] - Specific type of semantic error (e.g., "SEMANTIC_VALIDATION_MISSING_ASSEMBLY_KEY", "SEMANTIC_VALIDATION_INVALID_CONFIGS_STRUCTURE").
 */

/**
 * Enum-like constants for semantic validation error types.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const SemanticErrorTypes = Object.freeze({
  INVALID_CONFIGS_STRUCTURE: 'SEMANTIC_VALIDATION_INVALID_CONFIGS_STRUCTURE',
  INVALID_CONFIG_OBJECT: 'SEMANTIC_VALIDATION_INVALID_CONFIG_OBJECT',
  MISSING_PROMPT_ELEMENTS_FOR_ASSEMBLY:
    'SEMANTIC_VALIDATION_MISSING_PROMPT_ELEMENTS_FOR_ASSEMBLY',
  INVALID_ASSEMBLY_KEY_TYPE: 'SEMANTIC_VALIDATION_INVALID_ASSEMBLY_KEY_TYPE',
  MISSING_ASSEMBLY_KEY: 'SEMANTIC_VALIDATION_MISSING_ASSEMBLY_KEY',
});

/**
 * Pushes a formatted semantic error onto the provided array.
 *
 * @param {SemanticValidationError[]} errors - Error array to mutate.
 * @param {object} params
 * @param {string} params.configId
 * @param {string} params.message
 * @param {string} params.path
 * @param {string} params.type - One of {@link SemanticErrorTypes}.
 * @param {object} [params.extras]
 * @returns {void}
 */
export function addSemanticError(
  errors,
  { configId, message, path, type, extras = {} }
) {
  errors.push({
    configId,
    message,
    path,
    errorType: type,
    ...extras,
  });
}

/**
 * Performs semantic validations on the LLM configurations map.
 * The primary check ensures that all string keys listed in any `promptAssemblyOrder`
 * array correspond to actual `key` values defined in the `promptElements` array
 * within the same configuration object.
 *
 * @param {Record<string, LLMConfiguration>} configsMap - The map of LLM configurations (e.g., parsedRootObject.configs).
 * @returns {SemanticValidationError[]} An array of semantic error objects. If no errors are found, it returns an empty array.
 */
export function performSemanticValidations(configsMap) {
  const errors = [];

  if (
    typeof configsMap !== 'object' ||
    configsMap === null ||
    Array.isArray(configsMap)
  ) {
    addSemanticError(errors, {
      configId: 'N/A - Root "configs" property',
      message: 'The "configs" property is not a valid object map as expected.',
      path: '(root).configs',
      type: SemanticErrorTypes.INVALID_CONFIGS_STRUCTURE,
    });
    return errors;
  }

  for (const configId in configsMap) {
    if (Object.prototype.hasOwnProperty.call(configsMap, configId)) {
      const config = configsMap[configId];

      if (typeof config !== 'object' || config === null) {
        addSemanticError(errors, {
          configId: configId,
          message: `The configuration for ID '${configId}' is not a valid object.`,
          path: `(config object root)`,
          type: SemanticErrorTypes.INVALID_CONFIG_OBJECT,
        });
        continue; // Skip this malformed dependencyInjection object
      }

      // Schema ensures dependencyInjection.configId should ideally match the key `configId`.
      // An explicit check could be added here if strict consistency is required beyond schema.
      // e.g., if (dependencyInjection.configId !== configId) { errors.push(...); }

      const promptElements = Array.isArray(config.promptElements)
        ? config.promptElements
        : [];
      const promptAssemblyOrder = Array.isArray(config.promptAssemblyOrder)
        ? config.promptAssemblyOrder
        : [];

      // Check if promptElements is missing when promptAssemblyOrder is present (and vice-versa if needed)
      // This could be a schema concern, but semantic validation can also catch it.
      if (config.promptAssemblyOrder && !config.promptElements) {
        addSemanticError(errors, {
          configId: configId,
          message: `In config '${configId}', 'promptElements' array is missing or not an array, but 'promptAssemblyOrder' is defined.`,
          path: `promptElements`,
          type: SemanticErrorTypes.MISSING_PROMPT_ELEMENTS_FOR_ASSEMBLY,
        });
        // Depending on desired strictness, you might 'continue' here
      }

      const promptElementKeys = new Set();
      promptElements.forEach((element) => {
        if (element && typeof element.key === 'string') {
          promptElementKeys.add(element.key);
        }
        // Optionally, validate structure of promptElements items if not fully covered by schema
        // else { errors.push({ configId, message: `Invalid prompt element structure in ${configId}`, path: `promptElements[index]` ...}) }
      });

      promptAssemblyOrder.forEach((keyRef, index) => {
        if (typeof keyRef !== 'string') {
          addSemanticError(errors, {
            configId: configId,
            message: `In config '${configId}', an item at index ${index} of 'promptAssemblyOrder' is not a string. Found: ${JSON.stringify(keyRef)}.`,
            path: `promptAssemblyOrder[${index}]`,
            type: SemanticErrorTypes.INVALID_ASSEMBLY_KEY_TYPE,
            extras: {
              problematic_key_ref: JSON.stringify(keyRef),
              index_in_assembly_order: index,
              promptAssemblyOrder: [...promptAssemblyOrder],
              available_prompt_element_keys: Array.from(promptElementKeys),
            },
          });
        } else if (!promptElementKeys.has(keyRef)) {
          addSemanticError(errors, {
            configId: configId,
            message: `In config '${configId}', the key '${keyRef}' at index ${index} of 'promptAssemblyOrder' was not found in its 'promptElements' keys. Available keys: [${Array.from(promptElementKeys).join(', ')}].`,
            path: `promptAssemblyOrder[${index}]`,
            type: SemanticErrorTypes.MISSING_ASSEMBLY_KEY,
            extras: {
              problematic_key_ref: keyRef,
              index_in_assembly_order: index,
              promptAssemblyOrder: [...promptAssemblyOrder],
              available_prompt_element_keys: Array.from(promptElementKeys),
            },
          });
        }
      });
    }
  }

  return errors;
}

// --- FILE END ---
