/**
 * @file productionPathConfiguration.js
 * @description Production implementation of IPathConfiguration interface
 * @see IPathConfiguration.js
 */

import { IPathConfiguration } from '../interfaces/IPathConfiguration.js';

/**
 * @class ProductionPathConfiguration
 * @augments IPathConfiguration
 * @implements {IPathConfiguration}
 * @description Production implementation of path configuration that provides
 * standard production file paths for the application.
 */
export class ProductionPathConfiguration extends IPathConfiguration {
  /**
   * Gets the path to the LLM configuration file.
   *
   * @returns {string} The path to the production LLM configuration file
   * @override
   */
  getLLMConfigPath() {
    return './config/llm-configs.json';
  }

  /**
   * Gets the filename for the prompt text file.
   *
   * @returns {string} The filename for the prompt text file
   * @override
   */
  getPromptTextFilename() {
    return 'corePromptText.json';
  }

  /**
   * Gets the base directory for configuration files.
   *
   * @returns {string} The base directory for configuration files
   * @override
   */
  getConfigDirectory() {
    return './config';
  }

  /**
   * Gets the base directory for prompt files.
   *
   * @returns {string} The base directory for prompt files
   * @override
   */
  getPromptsDirectory() {
    return './data/prompts';
  }
}
