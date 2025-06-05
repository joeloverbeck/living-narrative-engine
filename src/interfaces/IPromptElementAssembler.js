// src/interfaces/IPromptElementAssembler.js
// --- FILE START ---

/**
 * @file Defines the IPromptElementAssembler interface.
 * This interface specifies the contract for classes that are responsible for
 * assembling a specific type of prompt element into its string representation.
 */

/**
 * @typedef {import('../prompting/promptBuilder.js').PromptElement} PromptElement
 * @description The configuration object for a specific prompt element.
 */

/**
 * @typedef {import('../prompting/promptBuilder.js').PromptData} PromptData
 * @description The global PromptData object containing all raw content and flags.
 */

/**
 * @typedef {import('../utils/placeholderResolver.js').PlaceholderResolver} PlaceholderResolver
 * @description An instance of the PlaceholderResolver utility.
 */

/**
 * @interface IPromptElementAssembler
 * @description Defines a contract for components responsible for assembling a specific
 * type of prompt element based on its configuration and provided data.
 * Implementers of this interface will provide the logic to transform a
 * PromptElement configuration and PromptData into a final string segment for the prompt.
 */
export class IPromptElementAssembler {
  /**
   * Assembles a single prompt element into its string representation.
   *
   * This method is responsible for taking the configuration of a specific prompt element,
   * the global prompt data, a placeholder resolver, and a map of all prompt elements,
   * and producing the final string output for that element.
   *
   * @param {PromptElement} elementConfig - The configuration for the specific prompt element to assemble.
   * @param {PromptData} promptData - The global prompt data object, containing all raw content parts,
   * flags, and other necessary data (like perceptionLogArray) needed for assembly.
   * @param {PlaceholderResolver} placeholderResolver - An instance of the utility for resolving
   * placeholders within prefixes, suffixes, or other parts of the element's content if applicable.
   * @param {Map<string, PromptElement>} allPromptElementsMap - A map of all prompt element configurations
   * for the current LLM (keyed by `elementConfig.key`). This allows an assembler to look up details
   * of other related elements if needed (e.g., a wrapper element needing the configuration of its child entries,
   * or an element needing to reference another element's settings).
   * @returns {string} The assembled string content for this prompt element.
   * This may be an empty string if the element, according to its logic and data,
   * results in no output (e.g., empty content with no prefix/suffix, a condition for
   * the element not being met internally by the assembler, or if a specialized assembler
   * determines no output is appropriate based on its specific rules).
   * @throws {Error} If critical errors occur during the assembly process that prevent
   * a meaningful output from being generated for this element. Implementations should
   * throw an error for unrecoverable issues.
   */
  assemble(
    elementConfig,
    promptData,
    placeholderResolver,
    allPromptElementsMap
  ) {
    // This method serves as an interface definition and should be implemented by concrete classes.
    // If a class inherits from IPromptElementAssembler and does not override this method,
    // calling it will result in this error, signaling an incomplete implementation.
    throw new Error(
      "Method 'assemble(elementConfig, promptData, placeholderResolver, allPromptElementsMap)' must be implemented by concrete classes."
    );
  }
}

// --- FILE END ---
