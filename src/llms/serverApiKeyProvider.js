// src/llms/ServerApiKeyProvider.js
// --- MODIFIED FILE START ---

import {IApiKeyProvider} from './interfaces/IApiKeyProvider.js';
import * as path from 'node:path'; // Corrected import style
import {IFileSystemReader, IEnvironmentVariableReader} from '../../llm-proxy-server/src/interfaces/IServerUtils.js';

/**
 * @typedef {import('./environmentContext.js').EnvironmentContext} EnvironmentContext
 * @typedef {import('./services/llmConfigLoader.js').LLMModelConfig} LLMModelConfig
 * @typedef {import('./interfaces/ILogger.js').ILogger} ILogger
 */

export class ServerApiKeyProvider extends IApiKeyProvider {
    /** @private @type {ILogger} */
    #logger;
    /** @private @type {IFileSystemReader} */
    #fileSystemReader;
    /** @private @type {IEnvironmentVariableReader} */
    #environmentVariableReader;

    constructor({logger, fileSystemReader, environmentVariableReader}) {
        super();
        if (!logger || typeof logger.info !== 'function' || typeof logger.warn !== 'function' || typeof logger.error !== 'function' || typeof logger.debug !== 'function') {
            const errorMsg = 'ServerApiKeyProvider: Constructor requires a valid logger instance.';
            (logger && typeof logger.error === 'function' ? logger : console).error(errorMsg);
            throw new Error(errorMsg);
        }
        this.#logger = logger;
        if (!fileSystemReader || typeof fileSystemReader.readFile !== 'function') {
            const errorMsg = 'ServerApiKeyProvider: Constructor requires a valid fileSystemReader instance that implements IFileSystemReader (must have an async readFile method).';
            this.#logger.error(errorMsg);
            throw new Error(errorMsg);
        }
        this.#fileSystemReader = fileSystemReader;
        if (!environmentVariableReader || typeof environmentVariableReader.getEnv !== 'function') {
            const errorMsg = 'ServerApiKeyProvider: Constructor requires a valid environmentVariableReader instance that implements IEnvironmentVariableReader (must have a getEnv method).';
            this.#logger.error(errorMsg);
            throw new Error(errorMsg);
        }
        this.#environmentVariableReader = environmentVariableReader;
        this.#logger.debug('ServerApiKeyProvider: Instance created and dependencies stored.');
    }

    async getKey(llmConfig, environmentContext) {
        const llmId = llmConfig?.id || 'UnknownLLM';

        if (!environmentContext || typeof environmentContext.isServer !== 'function' || typeof environmentContext.getProjectRootPath !== 'function') {
            this.#logger.error(`ServerApiKeyProvider.getKey (${llmId}): Invalid environmentContext provided.`);
            return null;
        }
        if (!environmentContext.isServer()) {
            this.#logger.warn(`ServerApiKeyProvider.getKey (${llmId}): Attempted to use in a non-server environment. This provider is only for server-side execution. Environment: ${environmentContext.getExecutionEnvironment()}`);
            return null;
        }

        let retrievedApiKey = null;
        const envVarSpecified = llmConfig?.apiKeyEnvVar && typeof llmConfig.apiKeyEnvVar === 'string' && llmConfig.apiKeyEnvVar.trim() !== '';
        const fileSpecified = llmConfig?.apiKeyFileName && typeof llmConfig.apiKeyFileName === 'string' && llmConfig.apiKeyFileName.trim() !== '';

        // Attempt 1: Retrieve from Environment Variable
        if (envVarSpecified) {
            const envVarName = llmConfig.apiKeyEnvVar.trim();
            this.#logger.debug(`ServerApiKeyProvider.getKey (${llmId}): Attempting to retrieve API key from environment variable '${envVarName}'.`);
            try {
                const keyFromEnv = this.#environmentVariableReader.getEnv(envVarName);
                if (keyFromEnv !== undefined) {
                    if (keyFromEnv.trim() !== '') {
                        retrievedApiKey = keyFromEnv.trim();
                        this.#logger.info(`ServerApiKeyProvider.getKey (${llmId}): Successfully retrieved API key from environment variable '${envVarName}'.`);
                    } else {
                        this.#logger.warn(`ServerApiKeyProvider.getKey (${llmId}): Environment variable '${envVarName}' found but is empty or contains only whitespace.`);
                    }
                } else {
                    this.#logger.info(`ServerApiKeyProvider.getKey (${llmId}): Environment variable '${envVarName}' not found or not set.`);
                }
            } catch (error) {
                this.#logger.error(`ServerApiKeyProvider.getKey (${llmId}): Error while reading environment variable '${envVarName}'. Error: ${error.message}`, {error});
            }
        } else {
            this.#logger.debug(`ServerApiKeyProvider.getKey (${llmId}): No 'apiKeyEnvVar' specified in llmConfig or it's empty. Skipping environment variable retrieval.`);
        }

        // Attempt 2: Retrieve from File, only if not already found and file is specified
        if (!retrievedApiKey && fileSpecified) {
            const fileName = llmConfig.apiKeyFileName.trim();
            this.#logger.debug(`ServerApiKeyProvider.getKey (${llmId}): Attempting to retrieve API key from file '${fileName}'.`);

            const projectRootPath = environmentContext.getProjectRootPath();
            if (!projectRootPath || typeof projectRootPath !== 'string' || projectRootPath.trim() === '') {
                this.#logger.error(`ServerApiKeyProvider.getKey (${llmId}): Cannot retrieve key from file '${fileName}' because projectRootPath is missing or invalid in EnvironmentContext.`);
                // This is a critical setup error for file retrieval, so an early exit here is okay.
                // However, to ensure the final "not found" log is consistent if env var was also specified but failed,
                // we will let it proceed to the final logging.
                // return null; // Old: return null;
            } else { // Only proceed if projectRootPath is valid
                const safeBaseName = path.basename(fileName);
                if (safeBaseName !== fileName) {
                    this.#logger.warn(`ServerApiKeyProvider.getKey (${llmId}): Provided apiKeyFileName '${fileName}' was sanitized to '${safeBaseName}' to prevent path traversal. Ensure apiKeyFileName is just the file's name.`);
                }
                const fullPath = path.join(projectRootPath, safeBaseName);

                try {
                    const keyFromFile = await this.#fileSystemReader.readFile(fullPath, 'utf-8');
                    if (keyFromFile.trim() !== '') {
                        retrievedApiKey = keyFromFile.trim();
                        this.#logger.info(`ServerApiKeyProvider.getKey (${llmId}): Successfully retrieved API key from file '${fullPath}'.`);
                    } else {
                        this.#logger.warn(`ServerApiKeyProvider.getKey (${llmId}): API key file '${fullPath}' found but is empty or contains only whitespace.`);
                    }
                } catch (error) {
                    if (error.code === 'ENOENT') {
                        this.#logger.warn(`ServerApiKeyProvider.getKey (${llmId}): API key file '${fullPath}' not found. Error: ${error.message}`);
                    } else if (error.code === 'EACCES' || error.code === 'EPERM') {
                        this.#logger.warn(`ServerApiKeyProvider.getKey (${llmId}): API key file '${fullPath}' not readable due to permissions. Error: ${error.message}`);
                    } else {
                        this.#logger.error(`ServerApiKeyProvider.getKey (${llmId}): Unexpected error while reading API key file '${fullPath}'. Error: ${error.message}`, {
                            errorCode: error.code,
                            errorDetails: error
                        });
                    }
                }
            }
        } else if (!retrievedApiKey && !fileSpecified) { // Env not specified or failed, AND file not specified
            this.#logger.debug(`ServerApiKeyProvider.getKey (${llmId}): No 'apiKeyFileName' specified in llmConfig or it's empty. Skipping file retrieval.`);
        } else if (retrievedApiKey && fileSpecified) { // Key found from ENV, file was specified but skipped
            this.#logger.debug(`ServerApiKeyProvider.getKey (${llmId}): API key already found from environment variable. Skipping file retrieval for '${llmConfig.apiKeyFileName.trim()}'.`);
        }


        // Final decision and logging
        if (retrievedApiKey) {
            return retrievedApiKey;
        }

        // If we reach here, API key was not retrieved.
        // Log why if at least one retrieval method was configured.
        if (!envVarSpecified && !fileSpecified) {
            this.#logger.warn(`ServerApiKeyProvider.getKey (${llmId}): Neither 'apiKeyEnvVar' nor 'apiKeyFileName' were specified in the LLM configuration. Unable to retrieve API key.`);
        } else {
            // This means at least one method was specified, but all attempted methods failed to yield a key.
            this.#logger.info(`ServerApiKeyProvider.getKey (${llmId}): API key not found through any configured method (environment variable or file).`);
        }
        return null;
    }
}

// --- MODIFIED FILE END ---