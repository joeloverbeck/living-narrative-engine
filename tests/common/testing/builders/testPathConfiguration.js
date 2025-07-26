/**
 * @file testPathConfiguration.js
 * @description Test implementation of IPathConfiguration interface
 * @see IPathConfiguration.js
 */

import path from 'path';
import { IPathConfiguration } from '../../../../src/interfaces/IPathConfiguration.js';

/**
 * @class TestPathConfiguration
 * @augments IPathConfiguration
 * @implements {IPathConfiguration}
 * @description Test implementation of path configuration that provides
 * isolated test file paths to prevent interference with production files.
 */
export class TestPathConfiguration extends IPathConfiguration {
  /**
   * Creates a new TestPathConfiguration instance.
   *
   * @param {string} tempDirectory - The temporary directory to use for test files
   */
  constructor(tempDirectory) {
    super();
    if (!tempDirectory || typeof tempDirectory !== 'string') {
      throw new Error(
        'TestPathConfiguration requires a valid temporary directory path'
      );
    }
    this.#tempDirectory = tempDirectory;
  }

  /**
   * @private
   * @type {string}
   */
  #tempDirectory;

  /**
   * Gets the path to the test LLM configuration file.
   *
   * @returns {string} The path to the test LLM configuration file
   * @override
   */
  getLLMConfigPath() {
    // Convert to relative path for fetch API compatibility
    const relativePath = path.relative(
      process.cwd(),
      path.join(this.#tempDirectory, 'llm-configs.json')
    );
    return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
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
   * Gets the base directory for test configuration files.
   *
   * @returns {string} The base directory for test configuration files
   * @override
   */
  getConfigDirectory() {
    return this.#tempDirectory;
  }

  /**
   * Gets the base directory for test prompt files.
   *
   * @returns {string} The base directory for test prompt files
   * @override
   */
  getPromptsDirectory() {
    return path.join(this.#tempDirectory, 'prompts');
  }
}
