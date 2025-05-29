// src/turns/interfaces/IAIPromptContentProvider.js
// --- FILE START ---

/**
 * @typedef {import('../../services/AIPromptContentProvider.js').AIPromptContentProvider} AIPromptContentProvider // For JSDoc link if needed, though interface methods are key
 * @typedef {import('../dtos/AIGameStateDTO.js').AIGameStateDTO} AIGameStateDTO
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../types/promptData.js').PromptData} PromptData
 */

/**
 * @interface IAIPromptContentProvider
 * @description Defines the contract for a service that provides various pieces of content
 * required to construct prompts for an AI Language Model (LLM). This interface
 * focuses on abstracting the source and formatting of these content pieces.
 */
export class IAIPromptContentProvider {
    /**
     * Assembles the complete PromptData object required for constructing an LLM prompt.
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
     * @param {AIGameStateDTO} gameStateDto - The game state DTO.
     * @param {ILogger} [logger] - Optional logger instance.
     * @returns {string} The formatted character segment.
     * @throws {Error} If the method is not implemented.
     */
    getCharacterPersonaContent(gameStateDto, logger) {
        throw new Error("Method 'getCharacterPersonaContent()' must be implemented.");
    }

    /**
     * Generates the world context content (location, exits, other characters).
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
     * @param {AIGameStateDTO} gameStateDto - The game state DTO.
     * @param {ILogger} [logger] - Optional logger instance.
     * @returns {string} The formatted actions segment.
     * @throws {Error} If the method is not implemented.
     */
    getAvailableActionsInfoContent(gameStateDto, logger) {
        throw new Error("Method 'getAvailableActionsInfoContent()' must be implemented.");
    }

    /**
     * Returns the core task description text.
     * @returns {string}
     * @throws {Error} If the method is not implemented.
     */
    getTaskDefinitionContent() {
        throw new Error("Method 'getTaskDefinitionContent()' must be implemented.");
    }

    /**
     * Returns character portrayal guidelines.
     * @param {string} characterName - The name of the character.
     * @returns {string}
     * @throws {Error} If the method is not implemented.
     */
    getCharacterPortrayalGuidelinesContent(characterName) {
        throw new Error("Method 'getCharacterPortrayalGuidelinesContent()' must be implemented.");
    }

    /**
     * Returns the content policy text (e.g., NC-21).
     * @returns {string}
     * @throws {Error} If the method is not implemented.
     */
    getContentPolicyContent() {
        throw new Error("Method 'getContentPolicyContent()' must be implemented.");
    }

    /**
     * Returns the final LLM instruction text.
     * @returns {string}
     * @throws {Error} If the method is not implemented.
     */
    getFinalInstructionsContent() {
        throw new Error("Method 'getFinalInstructionsContent()' must be implemented.");
    }
}

// --- FILE END ---