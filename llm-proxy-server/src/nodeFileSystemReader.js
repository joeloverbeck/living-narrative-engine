// llm-proxy-server/src/nodeFileSystemReader.js

import * as fs from 'node:fs/promises';

// No import needed for IFileSystemReader when using JSDoc @interface and @implements.
// JSDoc tools will resolve the type name.

/**
 * @class NodeFileSystemReader
 * @implements {IFileSystemReader}
 * @description A Node.js-based implementation of IFileSystemReader that uses the 'node:fs/promises' module.
 */
export class NodeFileSystemReader {
    /**
     * Asynchronously reads the entire contents of a file using Node.js `fs.readFile`.
     * This method fulfills the contract of IFileSystemReader#readFile.
     * @async
     * @param {string} filePath - The path to the file to be read.
     * @param {string} encoding - The character encoding to use (e.g., 'utf-8').
     * @returns {Promise<string>} A Promise that resolves with the file content as a string.
     * @throws {Error} If the file cannot be read. Errors from `fs.readFile` (e.g., ENOENT, EACCES) will propagate.
     */
    async readFile(filePath, encoding) {
        if (typeof filePath !== 'string' || filePath.trim() === '') {
            throw new Error('NodeFileSystemReader.readFile: filePath must be a non-empty string.');
        }
        // fs.readFile will handle encoding validation (e.g., throw for invalid encoding).
        return fs.readFile(filePath, {encoding});
    }
}