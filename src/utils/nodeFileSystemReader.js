// src/utils/NodeFileSystemReader.js
// --- NEW FILE START ---

import * as fs from 'node:fs/promises';
import {IFileSystemReader} from '../interfaces/IServerUtils.js'; // Adjust path as needed

/**
 * @class NodeFileSystemReader
 * @implements {IFileSystemReader}
 * @description A Node.js-based implementation of IFileSystemReader that uses the 'node:fs/promises' module.
 */
export class NodeFileSystemReader extends IFileSystemReader {
    /**
     * Asynchronously reads the entire contents of a file using Node.js `fs.readFile`.
     * @async
     * @param {string} filePath - The path to the file to be read.
     * @param {string} encoding - The character encoding to use (e.g., 'utf-8').
     * @returns {Promise<string>} A Promise that resolves with the file content as a string.
     * @throws {Error} If the file cannot be read. Errors from `fs.readFile` (e.g., ENOENT, EACCES) will propagate.
     */
    async readFile(filePath, encoding) {
        // Input validation could be added here if desired, but the ticket implies
        // allowing fs.readFile to handle invalid paths/encodings by throwing.
        if (typeof filePath !== 'string' || filePath.trim() === '') {
            throw new Error('NodeFileSystemReader.readFile: filePath must be a non-empty string.');
        }
        if (typeof encoding !== 'string' || encoding.trim() === '') {
            // fs.readFile would likely throw for an invalid encoding, but explicit check can be clearer.
            // For now, rely on fs.readFile's error handling for encoding.
            // Consider if a default encoding or more specific validation is needed.
        }
        return fs.readFile(filePath, {encoding});
    }
}

// --- NEW FILE END ---