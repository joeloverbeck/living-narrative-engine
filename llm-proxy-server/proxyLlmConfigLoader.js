// llm-proxy-server/proxyLlmConfigLoader.js
// --- FILE START ---

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/**
 * @typedef {object} ILogger
 * @description Defines a basic logger interface.
 * @property {(message: any, ...optionalParams: any[]) => void} debug - Logs a debug message.
 * @property {(message: any, ...optionalParams: any[]) => void} info - Logs an informational message.
 * @property {(message: any, ...optionalParams: any[]) => void} warn - Logs a warning message.
 * @property {(message: any, ...optionalParams: any[]) => void} error - Logs an error message.
 */

/**
 * @typedef {import('../../src/services/llmConfigLoader.js').LLMModelConfig} LLMModelConfig
 */

/**
 * @typedef {object} LLMConfigurationFileForProxy
 * @description Represents the structure of the parsed llm-configs.json file for the proxy.
 * Similar to LLMConfigurationFile from the main app, but the proxy uses it to know
 * actual provider URLs and how to retrieve keys.
 * @property {string} [defaultLlmId] - Specifies the ID of the LLM configuration to use by default (less relevant for proxy).
 * @property {Object<string, LLMModelConfig>} llms - A dictionary where each key is a unique LLM
 * configuration ID and its value is the detailed settings for that LLM.
 */

/**
 * @typedef {object} ProxyLoadConfigsErrorResult
 * @description Represents the structure of a failed configuration load attempt for the proxy.
 * @property {true} error - Indicates an error occurred.
 * @property {string} message - A description of the error.
 * @property {string} [stage] - The stage where the error occurred (e.g., 'read', 'parse', 'validation').
 * @property {Error} [originalError] - The original error object, if any.
 * @property {string} [pathAttempted] - The file path that was attempted.
 */

/**
 * @typedef {object} ProxyLoadConfigsSuccessResult
 * @description Represents the structure of a successful configuration load attempt for the proxy.
 * @property {false} error - Indicates no error occurred.
 * @property {LLMConfigurationFileForProxy} llmConfigs - The loaded and parsed LLM configurations.
 */

/**
 * Loads and parses the LLM configuration file from the specified path.
 * This function is intended for server-side use by the proxy.
 *
 * @async
 * @param {string} configFilePath - The absolute or relative path to the llm-configs.json file.
 * @param {ILogger} logger - A logger instance.
 * @returns {Promise<ProxyLoadConfigsSuccessResult | ProxyLoadConfigsErrorResult>} A promise that resolves with the parsed
 * configurations or an error object.
 */
export async function loadProxyLlmConfigs(configFilePath, logger) {
    const resolvedPath = path.resolve(configFilePath);
    logger.info(`ProxyLlmConfigLoader: Attempting to load LLM configurations from: ${resolvedPath}`);

    try {
        const fileContent = await fs.readFile(resolvedPath, 'utf-8');
        logger.debug(`ProxyLlmConfigLoader: Successfully read file content from ${resolvedPath}. Length: ${fileContent.length}`);

        const parsedConfigs = JSON.parse(fileContent);
        logger.debug(`ProxyLlmConfigLoader: Successfully parsed JSON content from ${resolvedPath}.`);

        // Basic validation of the overall structure (Task 2.1.4 in LlmConfigLoader was similar)
        if (typeof parsedConfigs !== 'object' || parsedConfigs === null || typeof parsedConfigs.llms !== 'object' || parsedConfigs.llms === null) {
            logger.error(`ProxyLlmConfigLoader: Configuration file from ${resolvedPath} is malformed or missing 'llms' object.`, {
                path: resolvedPath,
                parsedContentPreview: JSON.stringify(parsedConfigs)?.substring(0, 200)
            });
            return {
                error: true,
                message: `Configuration file from ${resolvedPath} is malformed (e.g., not an object or missing 'llms' property).`,
                stage: 'validation',
                pathAttempted: resolvedPath
            };
        }
        // Further validation of individual LLMModelConfig entries could be added here if needed,
        // mirroring the schema details from 'Jira Epics for ILLMAdapter' Table 3.
        // For this ticket, ensuring `llms` is an object is the primary structural check.

        logger.info(`ProxyLlmConfigLoader: LLM configurations loaded and validated successfully from ${resolvedPath}. Found ${Object.keys(parsedConfigs.llms).length} LLM configurations.`);
        return {
            error: false,
            llmConfigs: parsedConfigs,
        };

    } catch (error) {
        let stage = 'unknown';
        if (error instanceof SyntaxError) {
            stage = 'parse';
        } else if (error.code === 'ENOENT') {
            stage = 'read_file_not_found';
        } else if (error.code) { // Other fs errors
            stage = 'read_file_error';
        }

        logger.error(`ProxyLlmConfigLoader: Failed to load or parse LLM configurations from ${resolvedPath}. Stage: ${stage}, Error: ${error.message}`, {
            pathAttempted: resolvedPath,
            originalError: {name: error.name, message: error.message, code: error.code, stack: error.stack}
        });

        return {
            error: true,
            message: `Failed to load or parse LLM configurations from ${resolvedPath}: ${error.message}`,
            stage: stage,
            originalError: error,
            pathAttempted: resolvedPath
        };
    }
}

// --- FILE END ---