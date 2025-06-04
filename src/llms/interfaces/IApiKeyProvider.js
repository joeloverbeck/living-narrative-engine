// src/llms/interfaces/IApiKeyProvider.js
// --- FILE START ---

/**
 * @file Defines the IApiKeyProvider interface for retrieving API keys for LLM services.
 * This interface establishes a contract for obtaining API keys, abstracting the
 * specific retrieval logic (e.g., from environment variables, files, or secure vaults).
 */

/**
 * @typedef {import('../services/llmConfigLoader.js').LLMModelConfig} LLMModelConfig
 * @typedef {import('../environmentContext.js').EnvironmentContext} EnvironmentContext
 */

/**
 * @interface IApiKeyProvider
 * @description
 * Defines a standardized contract for retrieving API keys required by Large Language Model (LLM) services.
 * Abstracting API key retrieval allows for different implementations (e.g., for server-side vs. client-side logic,
 * or future secure vault integration) and improves testability.
 *
 * Implementations of this interface are responsible for securely accessing and providing
 * the API key based on the LLM's configuration and the current execution environment.
 */
export class IApiKeyProvider {
  /**
   * Retrieves the API key for a specific LLM service based on its configuration and the execution environment.
   *
   * Implementations should handle various retrieval strategies:
   * - For server-side execution, this might involve reading from environment variables (using `llmConfig.apiKeyEnvVar`)
   * or from a secure file (using `llmConfig.apiKeyFileName` and `environmentContext.projectRootPath`).
   * - For client-side execution, this method might return `null` if API keys are managed by a backend proxy,
   * indicating that the key is not directly accessible or needed by the client-facing adapter.
   * - It should also gracefully handle cases where a key is not configured or not found, returning `null`.
   *
   * @async
   * @param {LLMModelConfig} llmConfig - An object representing the configuration of the specific LLM
   * for which the key is needed. This configuration should provide necessary details for key lookup,
   * such as `apiKeyEnvVar` (for environment variables) or `apiKeyFileName` (for file-based keys).
   * @param {EnvironmentContext} environmentContext - An instance of the EnvironmentContext class,
   * providing context such as the execution environment (`client` or `server`) and, if applicable,
   * the `projectRootPath` for resolving file paths on the server.
   * @returns {Promise<string | null>} A Promise that resolves to:
   * - The API key as a string if found and applicable for the current context.
   * - `null` if the API key is not found, not applicable for the environment (e.g., client-side
   * where a proxy is expected to handle API key injection), or if a non-critical error occurs
   * that indicates no key is available but should not halt the application.
   * @throws {Error} Implementations may throw an error for critical, unrecoverable issues
   * encountered during the key retrieval process that prevent any meaningful outcome (e.g.,
   * misconfiguration that makes key lookup impossible when a key is strictly required).
   * However, returning `null` is generally preferred for non-blocking failures like "key not found."
   */
  async getKey(llmConfig, environmentContext) {
    throw new Error('IApiKeyProvider.getKey method not implemented.');
  }
}

// --- FILE END ---
