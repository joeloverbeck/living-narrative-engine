// src/llms/strategies/base/baseLLMStrategy.js
// --- FILE START ---

import { ILLMStrategy } from '../../interfaces/ILLMStrategy.js';

/**
 * @typedef {import('../../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../services/llmConfigLoader.js').LLMModelConfig} LLMModelConfig
 */

/**
 * @class BaseLLMStrategy
 * @augments ILLMStrategy
 * @description Abstract base class for LLM strategies, primarily to handle common
 * dependencies like the logger.
 */
export class BaseLLMStrategy extends ILLMStrategy {
  /**
   * @protected
   * @type {ILogger}
   */
  logger;

  /**
   * Constructs a new BaseLLMStrategy.
   *
   * @param {ILogger} logger - The logger instance.
   * @throws {Error} If a valid logger instance (compliant with ILogger, having at least an 'info' method) is not provided.
   * This constructor ensures that `this.logger` is always a valid, functional logger.
   * It is assumed that any logger passed, if it has an `info` method, will also
   * adhere to the full ILogger interface (debug, warn, error).
   */
  constructor(logger) {
    super();
    if (!logger) {
      throw new Error(
        "BaseLLMStrategy constructor: Valid logger instance (ILogger, with at least an 'info' method) is required."
      );
    }
    this.logger = logger;
  }

  /**
   * Abstract method for constructing the prompt-specific part of the payload.
   * To be implemented by subclasses (BaseChatLLMStrategy, BaseCompletionLLMStrategy).
   *
   * @protected
   * @param {string} gameSummary - The detailed textual representation of the game state.
   * @param {LLMModelConfig} llmConfig - The full LLM configuration.
   * @returns {object} An object containing either a `messages` array or a `prompt` string.
   * @throws {Error} If the method is not implemented by a subclass.
   */
  _constructPromptPayload(gameSummary, llmConfig) {
    this.logger.error(
      'BaseLLMStrategy._constructPromptPayload: Method not implemented. Subclasses must override this.'
    );
    throw new Error(
      'BaseLLMStrategy._constructPromptPayload: Method not implemented.'
    );
  }

  /**
   * Default implementation of buildToolSchema.
   * Base strategies do not support custom tool schema generation by default.
   * Strategies that support tool schema customization should override this method.
   *
   * @param {Array<object>} tools - Array of tool definitions to generate schema for
   * @param {object} [requestOptions] - Optional request-specific options that may affect schema generation
   * @returns {object|null} Custom tool schema object, or null if strategy doesn't support custom schemas
   */
  buildToolSchema(tools, requestOptions = {}) {
    // Default implementation returns null indicating no custom schema support
    return null;
  }

  /**
   * Default implementation of requiresCustomToolSchema.
   * Base strategies do not require custom tool schema generation by default.
   * Strategies that support tool schema customization should override this method.
   *
   * @returns {boolean} True if the strategy supports custom tool schema generation, false otherwise
   */
  requiresCustomToolSchema() {
    // Default implementation returns false
    return false;
  }

  // The main execute method would be implemented by concrete strategies that extend further down
  // (e.g., OpenAIToolCallingStrategy extends BaseChatLLMStrategy).
  // BaseLLMStrategy itself doesn't provide a concrete execute implementation.
}

// --- FILE END ---
