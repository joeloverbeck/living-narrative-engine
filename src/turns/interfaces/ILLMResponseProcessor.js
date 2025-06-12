/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * @typedef {object} LlmProcessingResult
 * @property {boolean} success            – true when the JSON parsed & validated
 * @property {{ chosenIndex: number; speech: string }} action – The structured action data.
 * @property {{thoughts: string; notes?: string[]}|null} extractedData – Extracted metadata.
 */

/**
 * @interface ILLMResponseProcessor
 * Parses, validates, and extracts structured data from an LLM's raw JSON output.
 */
export class ILLMResponseProcessor {
  /**
   * @param {string}   llmJsonResponse Raw JSON string from the LLM
   * @param {string}   actorId         For logging
   * @returns {Promise<LlmProcessingResult>}
   */
  async processResponse(llmJsonResponse, actorId) {
    throw new Error('processResponse must be implemented by concrete classes.');
  }
}
