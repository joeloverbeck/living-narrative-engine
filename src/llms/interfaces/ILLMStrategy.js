// src/llms/interfaces/ILLMStrategy.js
// --- NEW FILE START ---

/**
 * @file Defines the ILLMStrategy interface and related types for the LLM interaction framework.
 * This file centralizes the core contract for different LLM communication strategies.
 */

/**
 * @typedef {import('../services/llmConfigLoader.js').LLMModelConfig} LLMModelConfig
 * @typedef {import('../environmentContext.js').EnvironmentContext} EnvironmentContext
 * @typedef {import('../retryHttpClient.js').HttpClientError} HttpClientError
 * @typedef {import('../../turns/adapters/configurableLLMAdapter.js').ConfigurationError} ConfigurationError
 */

/**
 * @typedef {Error} LLMStrategyError
 * @description A custom error type that can be thrown by ILLMStrategy implementations
 * to indicate a failure specific to the strategy's execution logic (e.g., failure to construct
 * a provider-specific payload, failure to extract data from a well-formed provider response).
 * It's recommended that concrete strategies throw instances of this error or more specific
 * errors derived from it for better error handling by the caller.
 */

/**
 * @typedef {object} LLMStrategyExecuteParams
 * @description Defines the single parameter object passed to the `execute` method of an `ILLMStrategy`.
 * This object encapsulates all necessary information for a strategy to perform its function.
 * @property {string} gameSummary - The textual representation of the game state or prompt input
 * that will be sent to the Large Language Model.
 * @property {LLMModelConfig} llmConfig - The configuration object for the specific LLM being used.
 * This includes details like endpoint URL, model identifier, API type, and any default parameters.
 * @property {string | null} apiKey - The API key for the LLM service, if applicable and already retrieved.
 * For client-side strategies using a proxy, this might be null as the proxy handles the key.
 * For server-side strategies, this would be the actual key if successfully retrieved by the caller.
 * @property {EnvironmentContext} environmentContext - Provides the execution context, such as
 * whether the environment is 'client' or 'server'. This can affect how requests are made (e.g., via a proxy)
 * or how certain configurations are interpreted.
 */

/**
 * @interface ILLMStrategy
 * @description
 * Defines a contract for different strategies that handle communication with various Large Language Models (LLMs).
 * Each concrete strategy implementing this interface will encapsulate the provider-specific logic for:
 * 1. Constructing the request payload tailored to the LLM provider and the chosen JSON output method
 * (e.g., OpenAI's tool calling, Anthropic's tool calling, native JSON mode, etc.).
 * 2. Invoking the LLM API, which typically involves making an HTTP request. This may include
 * setting up provider-specific headers, authentication, and using a configured HTTP client.
 * 3. Extracting the raw, unparsed JSON string output from the LLM's response. The structure of this
 * JSON string is dictated by the LLM and the JSON output method being used.
 *
 * This interface is fundamental to decoupling the main `ConfigurableLLMAdapter` (or similar orchestrator)
 * from the specifics of individual LLM providers (e.g., "openai", "anthropic", "ollama") and their
 * various JSON output mechanisms (e.g., `jsonOutputStrategy.method` like "tool_calling", "native_json_mode").
 * Concrete classes like `OpenAIToolCallingStrategy` or `OllamaNativeJsonStrategy` will implement this interface.
 */
export class ILLMStrategy {
  /**
   * Executes the LLM communication strategy.
   * This method is responsible for preparing the request according to the specific LLM provider's API
   * and the configured `jsonOutputStrategy.method`, making the API call (usually via an IHttpClient
   * instance provided indirectly or directly), and then extracting the raw JSON string from the
   * LLM's response.
   * @async
   * @param {LLMStrategyExecuteParams} params - An object containing all necessary parameters for execution,
   * including the game summary, LLM configuration, API key (if applicable), and environment context.
   * @returns {Promise<string>} A Promise that resolves to a string. This string is expected to be
   * the raw, extracted JSON output from the LLM. It should be suitable for further parsing by
   * an `LLMResponseProcessor` or a similar component that handles the final transformation
   * into a structured game action (e.g., an `ITurnAction` object).
   * The content of this string depends heavily on the LLM and the `jsonOutputStrategy.method` used
   * (e.g., for OpenAI tool calling, it would be the JSON string found in `tool_calls[0].function.arguments`).
   * @throws {LLMStrategyError | HttpClientError | ConfigurationError | Error}
   * The method should throw an appropriate error if any part of the strategy execution fails.
   * This includes, but is not limited to:
   * - `ConfigurationError`: If essential configuration is missing or invalid for the strategy to operate
   * (e.g., `llmConfig` missing a field required by this specific strategy).
   * - `LLMStrategyError` (or a more specific custom error derived from it): If there's an issue specific
   * to the strategy's logic, such as an inability to construct a valid payload for the target LLM
   * based on the provided `gameSummary` and `llmConfig`, or if the LLM's response, while successfully
   * received, does not conform to the expected structure for the strategy, making it impossible
   * to reliably extract the JSON content.
   * - `HttpClientError`: If the underlying HTTP request to the LLM API fails (e.g., network errors,
   * non-2xx HTTP status codes like 401 Unauthorized, 403 Forbidden, 429 Too Many Requests, 500 Internal Server Error,
   * or request timeouts) and these errors are propagated from the HTTP client.
   * - Standard `Error` objects: For any other unexpected issues.
   *
   * Callers should be prepared to catch these errors to handle failures gracefully, potentially
   * falling back to default actions or logging detailed diagnostics.
   */
  async execute(params) {
    // This is an interface method and should not be called directly on ILLMStrategy itself.
    // Concrete implementations must override this method.
    throw new Error('ILLMStrategy.execute method not implemented.');
  }
}

// --- NEW FILE END ---
