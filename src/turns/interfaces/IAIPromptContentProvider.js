// src/turns/interfaces/IAIPromptContentProvider.js
// --- FILE START ---

/**
 * @typedef {import('../../prompting/AIPromptContentProvider.js').AIPromptContentProvider} AIPromptContentProvider // For JSDoc link if needed, though interface methods are key
 * @typedef {import('../dtos/AIGameStateDTO.js').AIGameStateDTO} AIGameStateDTO
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../types/promptData.js').PromptData} PromptData
 */

/**
 * @interface IAIPromptContentProvider
 * @description Defines the contract for a service that provides various pieces of content
 * required to construct prompts for an AI Language Model (LLM). This interface
 * focuses on abstracting the source and formatting of these content pieces.
 * @remarks
 * REVIEW (Ticket 19, 2025-06-01):
 * This interface was reviewed after the refactoring of its primary concrete implementation,
 * `AIPromptContentProvider` (Phases 1-4, Tickets 13-17).
 *
 * Conformance:
 * The refactored `AIPromptContentProvider` correctly implements all methods of this
 * interface without requiring signature changes.
 *
 * Future Considerations:
 * 1. Granularity: Several methods (e.g., `getCharacterPersonaContent`,
 * `getWorldContextContent`, `getAvailableActionsInfoContent`, and the static
 * content getters like `getTaskDefinitionContent`) are primarily consumed by
 * `getPromptData` within the concrete implementation. For a stricter, more
 * minimalist interface, these could be considered implementation details if
 * not intended for direct external use by other systems consuming
 * `IAIPromptContentProvider`. Future versions might consider streamlining the
 * interface to fewer methods (e.g., primarily `getPromptData` and
 * `validateGameStateForPrompting`) if this simplifies integration and reduces
 * the public contract surface. However, the current granularity allows consumers
 * to fetch specific content pieces if needed.
 *
 * 2. Logger Parameter Usage: Some methods in this interface include an optional `logger`
 * parameter (e.g., `getCharacterPersonaContent`, `getWorldContextContent`,
 * `getAvailableActionsInfoContent`). While implementations must accept
 * this parameter to conform, they might opt to use their own internal/instance
 * loggers for their detailed operational logging. If a consistent logging behavior
 * (i.e., the passed-in logger receiving all logs for the operation including
 * sub-operations) is a strict requirement for consumers of this interface, this
 * expectation should be explicitly documented and potentially enforced more
 * rigorously in implementations. The `getPromptData` method's use of its passed-in
 * `logger` parameter when calling `this.validateGameStateForPrompting` is a
 * good example of the intended propagation of the logger.
 */
export class IAIPromptContentProvider {
  /**
   * Assembles the complete PromptData object required for constructing an LLM prompt.
   *
   * @param {AIGameStateDTO} gameStateDto - The comprehensive game state for the current AI actor.
   * @param {ILogger} logger - Logger instance for logging during the assembly process.
   * @returns {Promise<PromptData>} A promise that resolves to the fully assembled PromptData object.
   * @throws {Error} If critical information is missing and PromptData cannot be safely constructed.
   */
  async getPromptData(gameStateDto, logger) {
    throw new Error("Method 'getPromptData()' must be implemented.");
  }

  /**
   * Generates the character definition content.
   *
   * @param {AIGameStateDTO} gameStateDto - The game state DTO.
   * @param {ILogger} [logger] - Optional logger instance.
   * @returns {string} The formatted character segment.
   * @throws {Error} If the method is not implemented.
   */
  getCharacterPersonaContent(gameStateDto, logger) {
    throw new Error(
      "Method 'getCharacterPersonaContent()' must be implemented."
    );
  }

  /**
   * Generates the world context content (location, exits, other characters).
   *
   * @param {AIGameStateDTO} gameStateDto - The game state DTO.
   * @param {ILogger} [logger] - Optional logger instance.
   * @returns {string} The formatted world context segment.
   * @throws {Error} If the method is not implemented.
   */
  getWorldContextContent(gameStateDto, logger) {
    throw new Error("Method 'getWorldContextContent()' must be implemented.");
  }

  /**
   * Generates the available actions content.
   *
   * @param {AIGameStateDTO} gameStateDto - The game state DTO.
   * @param {ILogger} [logger] - Optional logger instance.
   * @returns {string} The formatted actions segment.
   * @throws {Error} If the method is not implemented.
   */
  getAvailableActionsInfoContent(gameStateDto, logger) {
    throw new Error(
      "Method 'getAvailableActionsInfoContent()' must be implemented."
    );
  }

  /**
   * Returns the core task description text.
   *
   * @returns {string}
   * @throws {Error} If the method is not implemented.
   */
  getTaskDefinitionContent() {
    throw new Error("Method 'getTaskDefinitionContent()' must be implemented.");
  }

  /**
   * Returns character portrayal guidelines.
   *
   * @param {string} characterName - The name of the character.
   * @returns {string}
   * @throws {Error} If the method is not implemented.
   */
  getCharacterPortrayalGuidelinesContent(characterName) {
    throw new Error(
      "Method 'getCharacterPortrayalGuidelinesContent()' must be implemented."
    );
  }

  /**
   * Returns the content policy text (e.g., NC-21).
   *
   * @returns {string}
   * @throws {Error} If the method is not implemented.
   */
  getContentPolicyContent() {
    throw new Error("Method 'getContentPolicyContent()' must be implemented.");
  }

  /**
   * Returns the final LLM instruction text.
   *
   * @returns {string}
   * @throws {Error} If the method is not implemented.
   */
  getFinalInstructionsContent() {
    throw new Error(
      "Method 'getFinalInstructionsContent()' must be implemented."
    );
  }

  /**
   * Validates if the provided AIGameStateDTO contains the critical information
   * necessary for generating prompt data.
   *
   * @param {AIGameStateDTO} gameStateDto - The game state DTO to validate.
   * @param {ILogger} logger - Logger instance for logging validation issues.
   * @returns {{isValid: boolean, errorContent: string | null}} An object indicating if the state is valid
   * and an error message if not.
   * @throws {Error} May throw an error if validation itself fails unexpectedly.
   */
  validateGameStateForPrompting(gameStateDto, logger) {
    throw new Error(
      "Method 'validateGameStateForPrompting()' must be implemented."
    );
  }
}

// --- FILE END ---
