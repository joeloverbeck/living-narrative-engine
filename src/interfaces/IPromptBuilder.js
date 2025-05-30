// src/interfaces/IPromptBuilder.js
// --- FILE START ---

/** @typedef {import('../types/promptData.js').PromptData} PromptData */

/**
 * @interface IPromptBuilder
 * @description Defines the contract for building a final prompt string from PromptData.
 */
export class IPromptBuilder {
    /**
     * Builds the final prompt string for a given LLM configuration and prompt data.
     * @async
     * @param {string} llmId - The identifier of the LLM configuration to use.
     * @param {PromptData} promptData - The structured data for the prompt.
     * @returns {Promise<string>} A promise that resolves to the final prompt string.
     * @throws {Error} If the method is not implemented or if critical errors occur during prompt building.
     */
    async build(llmId, promptData) {
        throw new Error("Method 'build(llmId, promptData)' must be implemented.");
    }
}

// --- FILE END ---