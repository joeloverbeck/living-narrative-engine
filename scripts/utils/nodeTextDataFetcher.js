/**
 * @file Implements the ITextDataFetcher interface using Node.js fs module
 * to retrieve text data from file system paths.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * @typedef {import('../../src/interfaces/coreServices.js').ITextDataFetcher} ITextDataFetcher
 */

/**
 * Fetches raw text data from the local file system using Node.js fs module.
 * Designed for CLI and server environments where file system access is available.
 *
 * @implements {ITextDataFetcher}
 */
class NodeTextDataFetcher {
  /**
   * Fetches text data from the local file system.
   * Handles both absolute and relative paths, resolving relative paths from the project root.
   *
   * @param {string} identifier - The file path to read from.
   * @returns {Promise<string>} A promise that resolves with the raw text content from the file.
   * @throws {Error} Throws an error if the identifier is invalid, the file doesn't exist, or reading fails.
   */
  async fetch(identifier) {
    // Validate input identifier
    if (
      !identifier ||
      typeof identifier !== 'string' ||
      identifier.trim() === ''
    ) {
      throw new Error(
        'NodeTextDataFetcher: fetch requires a valid non-empty string identifier (file path).'
      );
    }

    let filePath = identifier;
    try {
      // Convert relative paths to absolute paths from project root
      if (!path.isAbsolute(filePath)) {
        // Get the current module URL and convert to file path
        const currentModuleFile = fileURLToPath(import.meta.url);
        // Navigate to project root (assuming this file is in scripts/utils/)
        const projectRoot = path.resolve(
          path.dirname(currentModuleFile),
          '..',
          '..'
        );
        filePath = path.resolve(projectRoot, filePath);
      }

      // Read the file as text
      const fileContent = await fs.readFile(filePath, 'utf-8');
      return fileContent;
    } catch (error) {
      // Handle specific error types with better messages
      if (error.code === 'ENOENT') {
        throw new Error(
          `NodeTextDataFetcher: File not found at ${identifier} (resolved to ${filePath || identifier})`
        );
      }

      // Log and re-throw other errors
      console.error(`NodeTextDataFetcher: Error reading ${identifier}:`, error);
      throw error;
    }
  }
}

export default NodeTextDataFetcher;
