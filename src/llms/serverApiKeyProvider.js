// src/llms/ServerApiKeyProvider.js
// --- FILE START ---

import {IApiKeyProvider} from './interfaces/IApiKeyProvider.js'; // Adjusted path assuming IApiKeyProvider is in src/llms/interfaces/
import path from 'node:path';

/**
 * @typedef {import('./environmentContext.js').EnvironmentContext} EnvironmentContext
 * @typedef {import('../services/llmConfigLoader.js').LLMModelConfig} LLMModelConfig
 * @typedef {import('./interfaces/ILogger.js').ILogger} ILogger
 */

/**
 * @typedef {object} IFileSystemReader
 * @description Defines an interface for reading files from the file system.
 * (To be formally defined in Ticket 5)
 * @property {(filePath: string, encoding: string) => Promise<string | null>} readFile
 * Reads a file and returns its content as a string, or null if not found/error.
 */

/**
 * @typedef {object} IEnvironmentVariableReader
 * @description Defines an interface for reading environment variables.
 * (To be formally defined in Ticket 5)
 * @property {(varName: string) => string | null} getEnv
 * Gets the value of an environment variable, or null if not set.
 */

/**
 * @class ServerApiKeyProvider
 * @implements {IApiKeyProvider}
 * @description Retrieves API keys when the application is running in a 'server' environment.
 * It supports fetching keys from environment variables or from text files.
 */
export class ServerApiKeyProvider extends IApiKeyProvider {
    /**
     * @private
     * @type {ILogger}
     */
    #logger;

    /**
     * @private
     * @type {IFileSystemReader}
     */
    #fileSystemReader;

    /**
     * @private
     * @type {IEnvironmentVariableReader}
     */
    #environmentVariableReader;

    /**
     * Creates an instance of ServerApiKeyProvider.
     * @param {object} params - The parameters for the ServerApiKeyProvider.
     * @param {ILogger} params.logger - An instance conforming to ILogger for internal logging.
     * @param {IFileSystemReader} params.fileSystemReader - An instance for file system access.
     * @param {IEnvironmentVariableReader} params.environmentVariableReader - An instance for environment variable access.
     * @throws {Error} If logger, fileSystemReader, or environmentVariableReader is invalid.
     */
    constructor({logger, fileSystemReader, environmentVariableReader}) {
        super();

        if (!logger || typeof logger.info !== 'function' || typeof logger.warn !== 'function' || typeof logger.error !== 'function' || typeof logger.debug !== 'function') {
            const errorMsg = 'ServerApiKeyProvider: Constructor requires a valid logger instance.';
            // Use console.error as a last resort if logger is completely unusable
            (logger && typeof logger.error === 'function' ? logger : console).error(errorMsg);
            throw new Error(errorMsg);
        }
        this.#logger = logger;

        if (!fileSystemReader || typeof fileSystemReader.readFile !== 'function') {
            const errorMsg = 'ServerApiKeyProvider: Constructor requires a valid fileSystemReader instance with a readFile method.';
            this.#logger.error(errorMsg);
            throw new Error(errorMsg);
        }
        this.#fileSystemReader = fileSystemReader;

        if (!environmentVariableReader || typeof environmentVariableReader.getEnv !== 'function') {
            const errorMsg = 'ServerApiKeyProvider: Constructor requires a valid environmentVariableReader instance with a getEnv method.';
            this.#logger.error(errorMsg);
            throw new Error(errorMsg);
        }
        this.#environmentVariableReader = environmentVariableReader;

        this.#logger.debug('ServerApiKeyProvider: Instance created and dependencies stored.');
    }

    /**
     * Retrieves the API key for a specific LLM service based on its configuration and server environment.
     *
     * @async
     * @param {LLMModelConfig} llmConfig - Configuration for the LLM.
     * @param {EnvironmentContext} environmentContext - Context about the execution environment.
     * @returns {Promise<string | null>} A Promise that resolves to the API key string or null.
     */
    async getKey(llmConfig, environmentContext) {
        const llmId = llmConfig?.id || 'UnknownLLM'; // For logging context

        if (!environmentContext || typeof environmentContext.isServer !== 'function' || typeof environmentContext.getProjectRootPath !== 'function') {
            this.#logger.error(`ServerApiKeyProvider.getKey (${llmId}): Invalid environmentContext provided.`);
            return null;
        }

        if (!environmentContext.isServer()) {
            this.#logger.warn(`ServerApiKeyProvider.getKey (${llmId}): Attempted to use in a non-server environment. This provider is only for server-side execution. Environment: ${environmentContext.getExecutionEnvironment()}`);
            return null;
        }

        // Attempt 1: Retrieve from Environment Variable
        if (llmConfig && llmConfig.apiKeyEnvVar && typeof llmConfig.apiKeyEnvVar === 'string' && llmConfig.apiKeyEnvVar.trim() !== '') {
            const envVarName = llmConfig.apiKeyEnvVar.trim();
            this.#logger.debug(`ServerApiKeyProvider.getKey (${llmId}): Attempting to retrieve API key from environment variable '${envVarName}'.`);
            try {
                const keyFromEnv = this.#environmentVariableReader.getEnv(envVarName);
                if (keyFromEnv && typeof keyFromEnv === 'string' && keyFromEnv.trim() !== '') {
                    const trimmedKey = keyFromEnv.trim();
                    this.#logger.info(`ServerApiKeyProvider.getKey (${llmId}): Successfully retrieved API key from environment variable '${envVarName}'.`);
                    return trimmedKey;
                } else if (keyFromEnv !== null) { // Env var exists but is empty or whitespace
                    this.#logger.warn(`ServerApiKeyProvider.getKey (${llmId}): Environment variable '${envVarName}' found but is empty or contains only whitespace.`);
                } else {
                    this.#logger.info(`ServerApiKeyProvider.getKey (${llmId}): Environment variable '${envVarName}' not found or not set.`);
                }
            } catch (error) {
                this.#logger.error(`ServerApiKeyProvider.getKey (${llmId}): Error while reading environment variable '${envVarName}'. Error: ${error.message}`, {error});
                // Continue to file attempt, as this might be a transient issue or misconfiguration for this specific var.
            }
        } else {
            this.#logger.debug(`ServerApiKeyProvider.getKey (${llmId}): No 'apiKeyEnvVar' specified in llmConfig or it's empty. Skipping environment variable retrieval.`);
        }

        // Attempt 2: Retrieve from File
        if (llmConfig && llmConfig.apiKeyFileName && typeof llmConfig.apiKeyFileName === 'string' && llmConfig.apiKeyFileName.trim() !== '') {
            const fileName = llmConfig.apiKeyFileName.trim();
            this.#logger.debug(`ServerApiKeyProvider.getKey (${llmId}): Attempting to retrieve API key from file '${fileName}'.`);

            const projectRootPath = environmentContext.getProjectRootPath();
            if (!projectRootPath || typeof projectRootPath !== 'string' || projectRootPath.trim() === '') {
                this.#logger.error(`ServerApiKeyProvider.getKey (${llmId}): Cannot retrieve key from file '${fileName}' because projectRootPath is missing or invalid in EnvironmentContext.`);
                return null;
            }

            // Ensure llmConfig.apiKeyFileName is treated as a base name
            const safeBaseName = path.basename(fileName);
            if (safeBaseName !== fileName) {
                this.#logger.warn(`ServerApiKeyProvider.getKey (${llmId}): Provided apiKeyFileName '${fileName}' was sanitized to '${safeBaseName}' to prevent path traversal. Ensure apiKeyFileName is just the file's name.`);
            }
            const fullPath = path.join(projectRootPath, safeBaseName);

            try {
                const keyFromFile = await this.#fileSystemReader.readFile(fullPath, 'utf-8');
                if (keyFromFile && typeof keyFromFile === 'string' && keyFromFile.trim() !== '') {
                    const trimmedKey = keyFromFile.trim();
                    this.#logger.info(`ServerApiKeyProvider.getKey (${llmId}): Successfully retrieved API key from file '${fullPath}'.`);
                    return trimmedKey;
                } else if (keyFromFile !== null) { // File read successfully but content was empty or whitespace
                    this.#logger.warn(`ServerApiKeyProvider.getKey (${llmId}): API key file '${fullPath}' found but is empty or contains only whitespace.`);
                } else { // readFile returned null (e.g., file not found, not readable by IFileSystemReader impl)
                    this.#logger.warn(`ServerApiKeyProvider.getKey (${llmId}): API key file '${fullPath}' not found or could not be read (IFileSystemReader.readFile returned null).`);
                }
            } catch (error) {
                this.#logger.error(`ServerApiKeyProvider.getKey (${llmId}): Error while reading API key file '${fullPath}'. Error: ${error.message}`, {error});
                return null; // Error during file read, return null
            }
        } else {
            this.#logger.debug(`ServerApiKeyProvider.getKey (${llmId}): No 'apiKeyFileName' specified in llmConfig or it's empty. Skipping file retrieval.`);
        }

        // No Key Found from any source
        if (llmConfig && (!llmConfig.apiKeyEnvVar || llmConfig.apiKeyEnvVar.trim() === '') && (!llmConfig.apiKeyFileName || llmConfig.apiKeyFileName.trim() === '')) {
            this.#logger.warn(`ServerApiKeyProvider.getKey (${llmId}): Neither 'apiKeyEnvVar' nor 'apiKeyFileName' were specified in the LLM configuration. Unable to retrieve API key.`);
        } else {
            this.#logger.info(`ServerApiKeyProvider.getKey (${llmId}): API key not found through any configured method (environment variable or file).`);
        }
        return null;
    }
}

// --- FILE END ---