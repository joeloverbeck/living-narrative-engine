// src/turns/interfaces/ILLMAdapter.js
/**
 * @interface ILLMAdapter
 * @description
 * Defines the contract for an adapter responsible for all communication with an
 * external Large Language Model (LLM) service.
 */
export class ILLMAdapter {
  /**
   * Sends a request to the LLM service to generate an action based on the
   * provided game summary.
   *
   * @async
   * @param {string} gameSummary - A string providing a summarized representation
   *   of the current game state and relevant actor information, structured
   *   as a prompt or query for the LLM.
   * @param {AbortSignal} [abortSignal] - Optional signal to cancel the LLM call.
   * @returns {Promise<string>} A Promise that resolves to a JSON string.
   * @throws {Error} If communication with the LLM fails or if the response
   *   is malformed beyond recovery.
   */
  async getAIDecision(gameSummary, abortSignal) {
    throw new Error('ILLMAdapter.getAIDecision method not implemented.');
  }
}
