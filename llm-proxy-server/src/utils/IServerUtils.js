// llm-proxy-server/src/utils/IServerUtils.js
// --- FILE START ---

/**
 * @file Defines interfaces for server-side utility abstractions,
 * such as file system reading and environment variable access.
 * These interfaces facilitate testability and decoupling.
 */

/**
 * @interface IFileSystemReader
 * @description Defines a contract for reading files from the file system.
 * Implementations are expected to handle errors such as file not found or permission issues
 * by throwing an error.
 */
export class IFileSystemReader {
  /**
   * Asynchronously reads the entire contents of a file.
   * @async
   * @param {string} _filePath - The path to the file to be read.
   * @param {string} _encoding - The character encoding to use (e.g., 'utf-8').
   * @returns {Promise<string>} A Promise that resolves with the file content as a string.
   * @throws {Error} If the file cannot be read (e.g., not found, insufficient permissions, or other I/O errors).
   * Implementations should allow specific errors from the underlying file system module to propagate.
   */
  async readFile(_filePath, _encoding) {
    throw new Error('IFileSystemReader.readFile method not implemented.');
  }
}

/**
 * @interface IEnvironmentVariableReader
 * @description Defines a contract for accessing environment variables.
 */
export class IEnvironmentVariableReader {
  /**
   * Retrieves the value of an environment variable.
   * @param {string} _variableName - The name of the environment variable.
   * @returns {string | undefined} The value of the environment variable if set, otherwise undefined.
   */
  getEnv(_variableName) {
    throw new Error(
      'IEnvironmentVariableReader.getEnv method not implemented.'
    );
  }
}

// --- FILE END ---
