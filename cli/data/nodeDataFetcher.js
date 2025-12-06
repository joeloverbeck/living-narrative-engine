/**
 * @file Implements the IDataFetcher interface using Node.js fs module
 * to retrieve data from file system paths.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher
 */

/**
 * Fetches raw data from the local file system using Node.js fs module.
 * Designed for CLI and server environments where file system access is available.
 *
 * @implements {IDataFetcher}
 */
class NodeDataFetcher {
  /**
   * Fetches data from the local file system.
   * Handles both absolute and relative paths, resolving relative paths from the project root.
   *
   * @param {string} identifier - The file path to read from.
   * @returns {Promise<any>} A promise that resolves with the parsed JSON object from the file.
   * @throws {Error} Throws an error if the identifier is invalid, the file doesn't exist, or JSON parsing fails.
   */
  async fetch(identifier) {
    // Validate input identifier
    if (
      !identifier ||
      typeof identifier !== 'string' ||
      identifier.trim() === ''
    ) {
      throw new Error(
        'NodeDataFetcher: fetch requires a valid non-empty string identifier (file path).'
      );
    }

    try {
      // Convert relative paths to absolute paths from project root
      let filePath = identifier;
      if (!path.isAbsolute(filePath)) {
        // Get the current module URL and convert to file path
        const currentModuleFile = fileURLToPath(import.meta.url);
        // Navigate to project root (assuming this file is in src/data/)
        const projectRoot = path.resolve(
          path.dirname(currentModuleFile),
          '..',
          '..'
        );
        filePath = path.resolve(projectRoot, filePath);
      }

      // Read the file
      const fileContent = await fs.readFile(filePath, 'utf-8');

      // Parse as JSON
      const jsonData = JSON.parse(fileContent);
      return jsonData;
    } catch (error) {
      // Handle specific error types with better messages
      if (error.code === 'ENOENT') {
        throw new Error(
          `NodeDataFetcher: File not found at ${identifier} (resolved to ${filePath || identifier})`
        );
      }

      if (error instanceof SyntaxError) {
        throw new Error(
          `NodeDataFetcher: Invalid JSON in file ${identifier}: ${error.message}`
        );
      }

      // Log and re-throw other errors
      // eslint-disable-next-line no-console
      console.error(
        `NodeDataFetcher: Error reading or parsing ${identifier}:`,
        error
      );
      throw error;
    }
  }
}

export default NodeDataFetcher;
