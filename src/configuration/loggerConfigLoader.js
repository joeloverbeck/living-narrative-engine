// src/configuration/loggerConfigLoader.js
// --- FILE START ---

import {Workspace_retry} from '../utils/apiUtils.js';

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * @typedef {object} LoggerConfigurationFile
 * @description Represents the structure of the logger-config.json file.
 * @property {string} [logLevel] - Specifies the desired log level (e.g., "DEBUG", "INFO", "WARN", "ERROR", "NONE").
 * The value is case-insensitive.
 */

/**
 * @typedef {object} LoadLoggerConfigErrorResult
 * @description Represents the structure of a failed logger configuration load attempt.
 * @property {true} error - Indicates an error occurred.
 * @property {string} message - A description of the error.
 * @property {string} [stage] - The stage where the error occurred (e.g., 'fetch', 'parse', 'validation').
 * @property {Error} [originalError] - The original error object, if any.
 * @property {string} [path] - The file path that was attempted.
 */

/**
 * @class LoggerConfigLoader
 * @description Service responsible for loading and parsing the logger-config.json file.
 * It fetches the configuration file, typically served as a static asset.
 */
export class LoggerConfigLoader {
    /**
     * @private
     * @type {ILogger}
     */
    #logger;

    /**
     * @private
     * @type {string} - Default path to the logger configuration file.
     */
    #defaultConfigPath = 'config/logger-config.json';

    /**
     * @private
     * @type {number}
     */
    #defaultMaxRetries = 2;

    /**
     * @private
     * @type {number}
     */
    #defaultBaseDelayMs = 300;

    /**
     * @private
     * @type {number}
     */
    #defaultMaxDelayMs = 1000;

    /**
     * Creates an instance of LoggerConfigLoader.
     *
     * @param {object} [dependencies] - Optional dependencies.
     * @param {ILogger} [dependencies.logger] - An optional logger instance. Uses `console` for its own logging if not provided,
     * which is important during early bootstrap when the main app logger might not be fully configured.
     * @param {string} [dependencies.configPath] - Optional override for the default dependencyInjection file path.
     */
    constructor(dependencies = {}) {
        // Use the provided logger, or fallback to the global console object.
        // This is crucial because this loader might run very early in the app lifecycle.
        this.#logger = dependencies.logger || console;
        if (
            dependencies.configPath &&
            typeof dependencies.configPath === 'string'
        ) {
            this.#defaultConfigPath = dependencies.configPath;
        }
    }

    /**
     * Loads and parses the logger configuration file from the specified path,
     * or a default path if none is provided.
     *
     * @async
     * @param {string} [filePath] - The path to the logger-config.json file.
     * If not provided, the configured default path will be used.
     * @returns {Promise<LoggerConfigurationFile | LoadLoggerConfigErrorResult>} A promise that resolves with the parsed
     * JavaScript object representing the logger configuration, or an error object if loading/parsing fails.
     */
    async loadConfig(filePath) {
        const path =
            typeof filePath === 'string' && filePath.trim() !== ''
                ? filePath.trim()
                : this.#defaultConfigPath;

        // Use a safe way to log, as this.#logger could be console or a full ILogger
        const logInfo = (msg, ...args) =>
            this.#logger.info
                ? this.#logger.info(msg, ...args)
                : console.info(msg, ...args);
        const logError = (msg, ...args) =>
            this.#logger.error
                ? this.#logger.error(msg, ...args)
                : console.error(msg, ...args);
        const logWarn = (msg, ...args) =>
            this.#logger.warn
                ? this.#logger.warn(msg, ...args)
                : console.warn(msg, ...args);

        logInfo(
            `[LoggerConfigLoader] Attempting to load logger configuration from: ${path}`
        );

        let parsedResponse;
        try {
            parsedResponse = await Workspace_retry(
                path,
                {method: 'GET', headers: {Accept: 'application/json'}},
                this.#defaultMaxRetries,
                this.#defaultBaseDelayMs,
                this.#defaultMaxDelayMs
            );

            logInfo(
                `[LoggerConfigLoader] Successfully fetched and parsed logger configuration from ${path}.`
            );

            if (typeof parsedResponse !== 'object' || parsedResponse === null) {
                logWarn(
                    `[LoggerConfigLoader] Configuration file from ${path} is malformed (not an object). Content:`,
                    parsedResponse
                );
                return {
                    error: true,
                    message: `Configuration file from ${path} is malformed (e.g., not an object). Ensure it's valid JSON.`,
                    stage: 'validation',
                    path: path,
                };
            }

            if (Object.keys(parsedResponse).length === 0) {
                logInfo(
                    `[LoggerConfigLoader] Logger configuration file at ${path} is empty or contains an empty JSON object. No log level specified.`
                );
                // Return empty object, indicates no specific dependencyInjection found but file was parsable
                return {};
            }

            if (parsedResponse.logLevel !== undefined) {
                if (typeof parsedResponse.logLevel !== 'string') {
                    logWarn(
                        `[LoggerConfigLoader] 'logLevel' in ${path} must be a string. Found: ${typeof parsedResponse.logLevel}. Value: ${parsedResponse.logLevel}`
                    );
                    return {
                        error: true,
                        message: `'logLevel' in ${path} must be a string. Found: ${typeof parsedResponse.logLevel}.`,
                        stage: 'validation',
                        path: path,
                    };
                }
                // Case-insensitivity for logLevel value will be handled by ConsoleLogger's setLogLevel
            } else {
                logInfo(
                    `[LoggerConfigLoader] 'logLevel' property not found in ${path}. No log level specified.`
                );
                // This is not an error, just means no specific level set in the file.
            }

            return /** @type {LoggerConfigurationFile} */ (parsedResponse);
        } catch (error) {
            // Errors from Workspace_retry (fetch/parse failures)
            logError(
                `[LoggerConfigLoader] Failed to load or parse logger configuration from ${path}. Error: ${error.message}`,
                {
                    path,
                    originalError: {
                        message: error.message,
                        name: error.name,
                        stack: error.stack,
                    }, // Include more error details
                }
            );

            let stage = 'fetch_or_parse';
            if (error.message) {
                const lowerMsg = error.message.toLowerCase();
                if (
                    lowerMsg.includes('json') ||
                    lowerMsg.includes('parse') ||
                    lowerMsg.includes('token')
                ) {
                    stage = 'parse';
                } else if (
                    lowerMsg.includes('failed to fetch') ||
                    lowerMsg.includes('network') ||
                    lowerMsg.includes('not found') ||
                    lowerMsg.includes('status')
                ) {
                    stage = 'fetch';
                }
            }

            return {
                error: true,
                message: `Failed to load or parse logger configurations from ${path}: ${error.message}`,
                stage: stage,
                originalError: error,
                path: path,
            };
        }
    }
}

// --- FILE END ---
