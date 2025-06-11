/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * @typedef {object} LlmProcessingResult
 * @property {boolean} success            – true when the JSON parsed & validated
 * @property {number|null} chosenIndex    – index selected by the LLM (null if failure)
 * @property {{thoughts?:string,notes?:string[]}|null} extractedData
 */

/**
 * @interface ILLMResponseProcessor
 * Parses, validates, and *now* just tells the caller whether it worked and
 * which index was picked. No more ITurnAction construction here.
 */
export class ILLMResponseProcessor {
  /**
   * @param {string}   llmJsonResponse Raw JSON string from the LLM
   * @param {string}   actorId         For logging
   * @param {ILogger}  logger          Project-wide logging interface
   * @returns {Promise<LlmProcessingResult>}
   */
  async processResponse(llmJsonResponse, actorId, logger) {
    throw new Error('processResponse must be implemented by concrete classes.');
  }
}
