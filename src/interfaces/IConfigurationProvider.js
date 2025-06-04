// src/interfaces/IConfigurationProvider.js
// --- FILE START ---

/**
 * @file Defines the IConfigurationProvider interface for fetching LLM configuration data.
 * This interface abstracts the source and method of retrieval for configurations,
 * allowing for different implementations (e.g., file system, HTTP, database).
 */

/**
 * @typedef {object} LLMConfig
 * @description Represents the structure of a single LLM configuration object.
 * For the purpose of IConfigurationProvider, this is part of the structure returned,
 * but the provider itself deals with the raw data object.
 * Detailed properties are defined elsewhere (e.g., in schemas or consuming services).
 * @property {string} configId - A unique identifier for this specific configuration.
 * @property {string} modelIdentifier - The identifier of the LLM or LLM family.
 * @property {Array<object>} promptElements - Configuration for prompt elements.
 * @property {string[]} promptAssemblyOrder - Order of prompt element assembly.
 * // ... other properties as typically found in an LLMConfig
 */

/**
 * @typedef {object} RootLLMConfigsFile
 * @description Represents the root structure of the LLM configuration data source
 * (e.g., the content of a file like `llm-configs.json`).
 * This is the expected structure of the object resolved by {@link IConfigurationProvider#fetchData}.
 * @property {string} defaultConfigId - The ID of the default LLM configuration.
 * @property {Object<string, LLMConfig>} configs - A map of LLM configurations,
 * where each key is a `configId` and the value is an `LLMConfig` object.
 */

/**
 * @interface IConfigurationProvider
 * @description Defines a contract for components responsible for fetching
 * raw LLM configuration data from a specified source.
 * Implementations of this interface will handle the specifics of
 * accessing and retrieving the data (e.g., from a file system, HTTP endpoint, database).
 */
export class IConfigurationProvider {
  /**
   * Fetches raw configuration data from the specified source.
   * @async
   * @param {string} sourceIdentifier - A string identifying the source of the configuration data
   * (e.g., a file path, a URL, a database query key).
   * @returns {Promise<object>} A promise that resolves to the raw, parsed configuration data.
   * This object is expected to conform to the {@link RootLLMConfigsFile} structure.
   * @throws {Error} If fetching or parsing the data fails, or if the method is not implemented.
   */
  async fetchData(sourceIdentifier) {
    // This is an interface method and should be implemented by concrete classes.
    // Throwing an error here ensures that if this class is somehow instantiated
    // and this method is called directly, it signals that it's not implemented.
    console.error('IConfigurationProvider.fetchData: Method not implemented.', {
      sourceIdentifier,
    });
    throw new Error(
      "Method 'fetchData(sourceIdentifier)' must be implemented."
    );
  }
}

// --- FILE END ---
