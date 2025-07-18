/**
 * @file IPathConfiguration interface for managing application file paths
 * @description Defines the interface for path configuration services that provide
 * file paths for various application components. This abstraction allows for
 * different implementations for production and testing environments.
 */

/**
 * @interface IPathConfiguration
 * @description Abstract interface for path configuration services.
 * Provides methods to resolve file paths for different application components.
 */
export class IPathConfiguration {
  /**
   * Gets the path to the LLM configuration file.
   *
   * @returns {string} The path to the LLM configuration file
   * @abstract
   */
  getLLMConfigPath() {
    throw new Error(
      'IPathConfiguration.getLLMConfigPath() must be implemented'
    );
  }

  /**
   * Gets the filename for the prompt text file.
   *
   * @returns {string} The filename for the prompt text file
   * @abstract
   */
  getPromptTextFilename() {
    throw new Error(
      'IPathConfiguration.getPromptTextFilename() must be implemented'
    );
  }

  /**
   * Gets the base directory for configuration files.
   *
   * @returns {string} The base directory for configuration files
   * @abstract
   */
  getConfigDirectory() {
    throw new Error(
      'IPathConfiguration.getConfigDirectory() must be implemented'
    );
  }

  /**
   * Gets the base directory for prompt files.
   *
   * @returns {string} The base directory for prompt files
   * @abstract
   */
  getPromptsDirectory() {
    throw new Error(
      'IPathConfiguration.getPromptsDirectory() must be implemented'
    );
  }
}
