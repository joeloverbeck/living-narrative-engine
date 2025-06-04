// llm-proxy-server/src/interfaces/IFileSystemReader.js
/**
 * @interface IFileSystemReader
 * @description Defines an interface for reading files from the file system.
 */

/**
 * Asynchronously reads the entire contents of a file.
 *
 * @function
 * @name IFileSystemReader#readFile
 * @param {string} filePath - The path to the file to be read.
 * @param {string} encoding - The character encoding to use (e.g., 'utf-8').
 * @returns {Promise<string>} A Promise that resolves with the file content as a string.
 * @throws {Error} If the file cannot be read (e.g., for reasons like file not found or permissions issues).
 */
export {}; // Ensures it's treated as an ES module for tooling compatibility
