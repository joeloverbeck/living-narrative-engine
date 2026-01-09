// src/interfaces/IPromptStaticContentService.js
// --- FILE START ---
/**
 * @interface IPromptStaticContentService
 * @description Defines the contract for a service that provides static text
 * blocks and templates for LLM prompts.
 */
export class IPromptStaticContentService {
  /**
   * Returns the core task description text.
   *
   * @returns {string}
   */
  getCoreTaskDescriptionText() {
    throw new Error(
      "Method 'getCoreTaskDescriptionText()' must be implemented."
    );
  }

  /**
   * Returns the mood update task definition text.
   *
   * @returns {string}
   */
  getMoodUpdateTaskDefinitionText() {
    throw new Error(
      "Method 'getMoodUpdateTaskDefinitionText()' must be implemented."
    );
  }

  /**
   * Returns character portrayal guidelines.
   *
   * @param {string} characterName - The name of the character.
   * @returns {string}
   */
  getCharacterPortrayalGuidelines(characterName) {
    throw new Error(
      "Method 'getCharacterPortrayalGuidelines()' must be implemented."
    );
  }

  /**
   * Returns mood update portrayal guidelines.
   *
   * @param {string} characterName - The name of the character.
   * @returns {string}
   */
  getMoodUpdatePortrayalGuidelines(characterName) {
    throw new Error(
      "Method 'getMoodUpdatePortrayalGuidelines()' must be implemented."
    );
  }

  /**
   * Returns the NC-21 content policy text.
   *
   * @returns {string}
   */
  getNc21ContentPolicyText() {
    throw new Error("Method 'getNc21ContentPolicyText()' must be implemented.");
  }

  /**
   * Returns the final LLM instruction text.
   *
   * @returns {string}
   */
  getFinalLlmInstructionText() {
    throw new Error(
      "Method 'getFinalLlmInstructionText()' must be implemented."
    );
  }

  /**
   * Returns the mood-only update instruction text for Phase 1 prompts.
   *
   * @returns {string}
   */
  getMoodUpdateInstructionText() {
    throw new Error(
      "Method 'getMoodUpdateInstructionText()' must be implemented."
    );
  }
}

// --- FILE END ---
