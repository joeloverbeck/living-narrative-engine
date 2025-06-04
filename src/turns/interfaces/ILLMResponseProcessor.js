// src/turns/interfaces/ILLMResponseProcessor.js
// --- FILE START ---

/** @typedef {import('./IActorTurnStrategy.js').ITurnAction} ITurnAction */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * @interface ILLMResponseProcessor
 * @description Defines the contract for a component that parses, validates, and transforms
 * a raw JSON string response from an LLM into a valid ITurnAction object.
 * It also handles errors encountered during this processing.
 */
export class ILLMResponseProcessor {
  /**
   * Parses the provided JSON string (from an LLM), validates its structure against
   * expected action formats, and transforms it into an ITurnAction.
   * If parsing, validation, or transformation fails, this method is responsible for
   * generating an appropriate fallback ITurnAction and logging the error.
   *
   * This method is asynchronous to accommodate potentially long-running parsing/repair operations.
   *
   * @async
   * @param {string} llmJsonResponse - The raw JSON string received from the LLM.
   * @param {string} actorId - The ID of the actor for whom this action is being processed.
   * Used for logging and potentially in fallback actions.
   * @param {ILogger} logger - An instance of the logger for recording information, warnings,
   * or errors during response processing.
   * @returns {Promise<ITurnAction>} A Promise that resolves to a valid ITurnAction derived
   * from the LLM response, or a fallback ITurnAction if processing fails.
   */
  async processResponse(llmJsonResponse, actorId, logger) {
    // This is an interface; concrete classes will implement this.
    // Enforce implementation by throwing an error.
    throw new Error(
      "Method 'processResponse(llmJsonResponse, actorId, logger)' must be implemented by concrete classes."
    );
  }
}

// --- FILE END ---
