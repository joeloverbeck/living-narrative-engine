// utils/proxyApiKeyFileRetriever.js

import * as fs from 'node:fs/promises'; // Keep ESM imports
import * as path from 'node:path';   // Keep ESM imports

/**
 * @file apiKeyFileRetriever.js
 * @module ApiKeyFileRetriever
 * @description Provides a utility for securely retrieving API keys from text files
 * on the server's file system. This module is strictly for server-side use.
 */

/**
 * @typedef {object} ILogger
 * @description Defines a basic logger interface.
 * @property {(message: any, ...optionalParams: any[]) => void} debug - Logs a debug message.
 * @property {(message: any, ...optionalParams: any[]) => void} info - Logs an informational message.
 * @property {(message: any, ...optionalParams: any[]) => void} warn - Logs a warning message.
 * @property {(message: any, ...optionalParams: any[]) => void} error - Logs an error message.
 */

/**
 * Retrieves an API key from a specified text file within a given project root directory.
 * This function is intended for server-side use ONLY, typically by a backend proxy,
 * where file system access is secure and appropriate.
 *
 * @async
 * @function getApiKeyFromFile
 * @param {string} fileName - The name of the text file (e.g., "openrouter_api_key.txt").
 * **Security Note**: This `fileName` MUST be determined or validated securely by the
 * calling server-side code (e.g., derived from a secure configuration based on an
 * LLM ID) and MUST NOT be passed directly from untrusted client input to prevent
 * path traversal or arbitrary file read vulnerabilities.
 * @param {string} projectRootPath - An absolute path to the project's root directory
 * or a designated secure directory on the server where API key files are located.
 * @param {ILogger} logger - A logger instance for warnings and errors.
 * @returns {Promise<string|null>} A promise that resolves with the API key as a string
 * if successful, or `null` if the file is not found, not readable, or empty.
 * @throws {Error} If an unexpected error occurs during file operations (other than
 * file not found/unreadable or empty key, which return `null`).
 */
export async function getApiKeyFromFile(fileName, projectRootPath, logger) {
    if (!fileName || typeof fileName !== 'string' || fileName.trim() === '') {
        if (logger && typeof logger.error === 'function') {
            logger.error("ApiKeyFileRetriever: 'fileName' parameter must be a non-empty string.", {fileName});
        }
        throw new Error("'fileName' parameter must be a non-empty string.");
    }
    if (!projectRootPath || typeof projectRootPath !== 'string' || projectRootPath.trim() === '') {
        if (logger && typeof logger.error === 'function') {
            logger.error("ApiKeyFileRetriever: 'projectRootPath' parameter must be a non-empty string.", {projectRootPath});
        }
        throw new Error("'projectRootPath' parameter must be a non-empty string.");
    }
    if (!logger || typeof logger.warn !== 'function' || typeof logger.error !== 'function') {
        console.warn("ApiKeyFileRetriever: A valid logger instance was not provided. Using console for critical messages.");
        logger = console; // Fallback to console if logger is insufficient
    }

    const safeFileName = path.basename(fileName); // Mitigate basic path traversal if caller isn't careful
    if (safeFileName !== fileName) {
        logger.warn(`ApiKeyFileRetriever: Original fileName '${fileName}' was normalized to '${safeFileName}' to prevent path traversal. Ensure the provided fileName is just the file's name.`);
    }

    const fullPath = path.join(projectRootPath, safeFileName);

    try {
        const apiKey = await fs.readFile(fullPath, 'utf-8');
        const trimmedKey = apiKey.trim();

        if (trimmedKey === '') {
            logger.warn(`ApiKeyFileRetriever: API key file '${fullPath}' is empty or contains only whitespace.`);
            return null;
        }

        // For security, avoid logging the key itself, even at debug. Log its presence and length.
        if (logger && typeof logger.debug === 'function') {
            logger.debug(`ApiKeyFileRetriever: Successfully retrieved API key from '${fullPath}'. Key length: ${trimmedKey.length}`);
        }
        return trimmedKey;

    } catch (error) {
        if (error.code === 'ENOENT' || error.code === 'EACCES' || error.code === 'EPERM') {
            logger.warn(`ApiKeyFileRetriever: API key file '${fullPath}' not found or not readable. Error code: ${error.code}.`);
            return null;
        } else {
            logger.error(`ApiKeyFileRetriever: Unexpected error reading API key file '${fullPath}'. Error: ${error.message}`, {
                errorCode: error.code,
                errorDetails: error
            });
            throw new Error(`Failed to read API key file '${fullPath}': ${error.message}`);
        }
    }
}