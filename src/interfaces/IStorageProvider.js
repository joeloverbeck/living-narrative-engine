// src/interfaces/IStorageProvider.js

/**
 * @interface IStorageProvider
 * Defines the contract for a service that handles actual file system operations.
 * This allows abstracting away the specific storage mechanism (e.g., File System Access API,
 * Node.js fs, or a mock for testing).
 */
export class IStorageProvider {
  /**
   * Writes data to a file atomically.
   * This typically involves writing to a temporary file first, then renaming.
   *
   * @param {string} filePath - The final path for the file.
   * @param {Uint8Array} data - The data to write.
   * @returns {Promise<{
   *   success: boolean,
   *   error?: string,
   *   code?: import('../storage/storageErrors.js').StorageErrorCodes
   * }>}
   * @async
   */
  async writeFileAtomically(filePath, data) {
    throw new Error('Not implemented');
  }

  /**
   * Lists files in a given directory matching a pattern.
   *
   * @param {string} directoryPath - The directory to scan.
   * @param {string} pattern - A pattern to match filenames (e.g., "*.sav").
   * @returns {Promise<Array<string>>} A list of file names.
   * @async
   */
  async listFiles(directoryPath, pattern) {
    throw new Error('Not implemented');
  }

  /**
   * Reads data from a file.
   *
   * @param {string} filePath - The path to the file.
   * @returns {Promise<Uint8Array>} The file content.
   * @async
   */
  async readFile(filePath) {
    throw new Error('Not implemented');
  }

  /**
   * Deletes a file.
   *
   * @param {string} filePath - The path to the file.
   * @returns {Promise<{success: boolean, error?: string}>}
   * @async
   */
  async deleteFile(filePath) {
    throw new Error('Not implemented');
  }

  /**
   * Checks if a file exists.
   *
   * @param {string} filePath - The path to the file.
   * @returns {Promise<boolean>} True if the file exists, false otherwise.
   * @async
   */
  async fileExists(filePath) {
    throw new Error('Not implemented');
  }
}
