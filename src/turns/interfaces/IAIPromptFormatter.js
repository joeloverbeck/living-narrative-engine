// src/turns/interfaces/IAIPromptFormatter.js
// --- FILE START ---

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/** @typedef {import('../dtos/AIGameStateDTO.js').AIGameStateDTO} AIGameStateDTO */

/**
 * @interface IAIPromptFormatter
 * @description Defines the contract for a component that transforms structured AI game state data
 * (AIGameStateDTO) into a textual prompt string for an LLM.
 */
export class IAIPromptFormatter {
    /**
     * Formats the provided AIGameStateDTO into a string suitable for use as an LLM prompt.
     * This method encapsulates all "prompt engineering" logic, including how information
     * about the actor, location, events, and actions is presented to the LLM.
     *
     * @param {AIGameStateDTO} gameState - The structured game state data for the AI actor.
     * @param {ILogger} logger - An instance of the logger for recording information or warnings
     * during the prompt formatting process.
     * @returns {string} The fully formatted LLM prompt string.
     * If critical data is missing from `gameState` making prompt generation impossible,
     * implementations might return an error message string or throw an error.
     */
    formatPrompt(gameState, logger) {
        // This is an interface; concrete classes will implement this.
        // Enforce implementation by throwing an error.
        throw new Error("Method 'formatPrompt(gameState, logger)' must be implemented by concrete classes.");
    }
}

// --- FILE END ---