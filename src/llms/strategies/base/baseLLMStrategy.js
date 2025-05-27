// src/llms/strategies/base/BaseLLMStrategy.js
// --- FILE START ---

// Assuming ILLMStrategy is a class that can be extended, located at:
// import { ILLMStrategy } from '../../interfaces/ILLMStrategy.js';
// For the purpose of this example, if ILLMStrategy.js is not meant to be a concrete base,
// this class can stand alone or extend a different abstract base if one exists.
// We'll assume it can extend ILLMStrategy from the user-provided files.
// If ILLMStrategy is more of an interface, this class might not need to extend it,
// and concrete strategies would `implement` ILLMStrategy and `extend` BaseLLMStrategy.
// Given the user's ILLMStrategy.js is a class, we extend it.

/**
 * @typedef {import('../../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../services/llmConfigLoader.js').LLMModelConfig} LLMModelConfig
 */

// Try to get ILLMStrategy from the uploaded files.
// This is a placeholder for actual import if the file structure was fully known
// and if direct extension is the pattern.
let ILLMStrategyBase;
try {
    // This is a conceptual dynamic import for the sake of the example,
    // in a real scenario, you'd use static imports.
    // import { ILLMStrategy } from '../../interfaces/ILLMStrategy.js'; // Adjust path as needed
    // ILLMStrategyBase = ILLMStrategy;

    // For now, let's define a simple base if ILLMStrategy is not available for extension here
    ILLMStrategyBase = class {
        /**
         * @param {string} gameSummary
         * @param {LLMModelConfig} llmConfig
         * @param {string | null} apiKey
         * @param {ILogger} logger
         * @returns {Promise<string>}
         */
        async execute(gameSummary, llmConfig, apiKey, logger) {
            throw new Error("ILLMStrategy.execute method not implemented by base.");
        }
    };

} catch (e) {
    console.warn("Failed to dynamically import ILLMStrategy, using a placeholder for BaseLLMStrategy extension.");
    ILLMStrategyBase = class {
        async execute(gameSummary, llmConfig, apiKey, logger) {
            throw new Error("ILLMStrategy.execute method not implemented by base.");
        }
    };
}


/**
 * @class BaseLLMStrategy
 * @extends ILLMStrategyBase
 * @description Abstract base class for LLM strategies, primarily to handle common
 * dependencies like the logger.
 */
export class BaseLLMStrategy extends ILLMStrategyBase {
    /**
     * @protected
     * @type {ILogger}
     */
    logger;

    /**
     * Constructs a new BaseLLMStrategy.
     * @param {ILogger} logger - The logger instance.
     * @throws {Error} If a valid logger instance (compliant with ILogger, having at least an 'info' method) is not provided.
     * This constructor ensures that `this.logger` is always a valid, functional logger.
     * It is assumed that any logger passed, if it has an `info` method, will also
     * adhere to the full ILogger interface (debug, warn, error).
     */
    constructor(logger) {
        super();
        if (!logger || typeof logger.info !== 'function') {
            throw new Error("BaseLLMStrategy constructor: Valid logger instance (ILogger, with at least an 'info' method) is required.");
        }
        this.logger = logger;
    }

    /**
     * Abstract method for constructing the prompt-specific part of the payload.
     * To be implemented by subclasses (BaseChatLLMStrategy, BaseCompletionLLMStrategy).
     *
     * @protected
     * @param {string} gameSummary - The detailed textual representation of the game state.
     * @param {object | string | undefined} promptFrame - The promptFrame object from the LLM configuration.
     * @param {LLMModelConfig} llmConfig - The full LLM configuration.
     * @returns {object} An object containing either a `messages` array or a `prompt` string.
     * @throws {Error} If the method is not implemented by a subclass.
     */
    _constructPromptPayload(gameSummary, promptFrame, llmConfig) {
        this.logger.error("BaseLLMStrategy._constructPromptPayload: Method not implemented. Subclasses must override this.");
        throw new Error("BaseLLMStrategy._constructPromptPayload: Method not implemented.");
    }

    // The main execute method would be implemented by concrete strategies that extend further down
    // (e.g., OpenAIToolCallingStrategy extends BaseChatLLMStrategy).
    // BaseLLMStrategy itself doesn't provide a concrete execute implementation.
}

// --- FILE END ---